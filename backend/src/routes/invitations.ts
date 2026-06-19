import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { query, queryOne, withTransaction } from '../lib/database';
import { sendPushNotification } from '../utils/notifications';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────

/** Génère un code numérique à 6 chiffres unique en base */
async function generateUniqueCode(): Promise<string> {
  for (let attempts = 0; attempts < 20; attempts++) {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const existing = await queryOne(
      `SELECT id FROM invitations WHERE code = $1 AND status = 'pending'`,
      [code]
    );
    if (!existing) return code;
  }
  throw new Error('Impossible de générer un code unique');
}

/** Génère un token URL-safe de 64 caractères */
function generateToken(): string {
  return uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '');
}

// ─── POST /api/invitations/create ───────────────────────────

router.post('/create', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    // Annuler les invitations pending existantes du même utilisateur
    await query(
      `UPDATE invitations SET status = 'cancelled'
       WHERE inviter_id = $1 AND status = 'pending'`,
      [userId]
    );

    // Récupérer ou créer la famille (dans une transaction pour éviter TOCTOU)
    let family = await queryOne<{ id: string }>(
      `SELECT id FROM families WHERE parent_a_id = $1`,
      [userId]
    );

    if (!family) {
      const user = await queryOne<{ first_name: string }>(
        `SELECT first_name FROM users WHERE id = $1`,
        [userId]
      );
      family = await withTransaction(async (client) => {
        // Vérifier à nouveau dans la transaction (SELECT FOR UPDATE)
        const existing = await client.query<{ id: string }>(
          `SELECT id FROM families WHERE parent_a_id = $1 FOR UPDATE`,
          [userId]
        );
        if (existing.rows.length > 0) {
          return existing.rows[0];
        }
        const row = await client.query<{ id: string }>(
          `INSERT INTO families (parent_a_id, name) VALUES ($1, $2) RETURNING id`,
          [userId, `Famille ${user?.first_name ?? ''}`]
        );
        return row.rows[0];
      });
    }

    const familyId = family!.id;
    const code    = await generateUniqueCode();
    const token   = generateToken();

    // Le lien expire dans 7 jours, le code expire dans 24h
    const codeExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const linkExpiresAt = new Date(Date.now() + 7  * 24 * 60 * 60 * 1000);

    // On crée une seule entrée — le champ expires_at correspond au lien (7 j)
    // Le code lui-même devient invalide au bout de 24h via une vérification
    const invitation = await queryOne<{
      id: string; code: string; token: string; expires_at: string;
    }>(
      `INSERT INTO invitations
         (family_id, inviter_id, code, token, method, expires_at)
       VALUES ($1, $2, $3, $4, 'code', $5)
       RETURNING id, code, token, expires_at`,
      [familyId, userId, code, token, linkExpiresAt.toISOString()]
    );

    const appLink = `${process.env.APP_URL ?? 'https://serenite.newappai.com'}/invite/join?token=${token}`;
    const deepLink = `serenite://join/${token}`;

    res.status(201).json({
      code: invitation!.code,
      token: invitation!.token,
      link: appLink,
      deepLink,
      qrData: appLink,
      codeExpiresAt: codeExpiresAt.toISOString(),
      linkExpiresAt: invitation!.expires_at,
      invitationId: invitation!.id,
    });
  } catch (err) {
    console.error('POST /invitations/create:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/invitations/accept ───────────────────────────

router.post('/accept', requireAuth, async (req: AuthRequest, res: Response) => {
  const { code, token } = req.body as { code?: string; token?: string };
  const userId = req.user!.id;

  if (!code && !token) {
    res.status(400).json({ error: 'Fournir un code ou un token' });
    return;
  }

  try {
    // Tout faire dans une transaction atomique pour éviter TOCTOU
    const result = await withTransaction(async (client) => {
      // Rechercher l'invitation avec verrouillage (SELECT FOR UPDATE)
      const invResult = await client.query<{
        id: string;
        family_id: string;
        inviter_id: string;
        status: string;
        expires_at: string;
        code: string;
      }>(
        `SELECT i.*, i.expires_at
         FROM invitations i
         WHERE ${code ? 'i.code = $1' : 'i.token = $1'}
           AND i.status = 'pending'
         FOR UPDATE`,
        [code ?? token]
      );

      const invitation = invResult.rows[0] ?? null;

      if (!invitation) {
        return { status: 404, json: { error: 'Invitation introuvable ou déjà utilisée' } };
      }

      // Vérifier l'expiration
      if (new Date(invitation.expires_at) < new Date()) {
        await client.query(
          `UPDATE invitations SET status = 'expired' WHERE id = $1`,
          [invitation.id]
        );
        return { status: 410, json: { error: 'Invitation expirée' } };
      }

      // Vérifier que l'accepteur n'est pas l'invitant
      if (invitation.inviter_id === userId) {
        return { status: 400, json: { error: 'Vous ne pouvez pas rejoindre votre propre famille' } };
      }

      // Lier le coparent à la famille (atomique grâce à FOR UPDATE)
      const updateResult = await client.query(
        `UPDATE families SET parent_b_id = $1 WHERE id = $2 AND parent_b_id IS NULL`,
        [userId, invitation.family_id]
      );

      if (updateResult.rowCount === 0) {
        // parent_b_id déjà défini (race condition ou invitation déjà utilisée)
        return { status: 409, json: { error: 'Cette famille a déjà un coparent' } };
      }

      // Mettre à jour l'invitation
      await client.query(
        `UPDATE invitations
         SET status = 'accepted', accepted_by = $1, accepted_at = NOW()
         WHERE id = $2`,
        [userId, invitation.id]
      );

      // Récupérer les données de la famille et des enfants
      const familyRows = await client.query<{
        id: string; name: string;
        parent_a_id: string; parent_b_id: string;
      }>(
        `SELECT id, name, parent_a_id, parent_b_id FROM families WHERE id = $1`,
        [invitation.family_id]
      );
      const family = familyRows.rows[0];

      const childrenRows = await client.query<{
        id: string; first_name: string; birth_date: string;
        age: number; calendar_color: string; calendar_color_text: string;
      }>(
        `SELECT id, first_name, birth_date, calendar_color, calendar_color_text
         FROM children WHERE family_id = $1 ORDER BY birth_date`,
        [invitation.family_id]
      );
      const children = childrenRows.rows;

      // Notifier le parent A (après commit, pas bloquant)
      const parentARows = await client.query<{
        push_token: string | null; first_name: string;
      }>(
        `SELECT push_token, first_name FROM users WHERE id = $1`,
        [invitation.inviter_id]
      );
      const parentA = parentARows.rows[0] ?? null;

      const joinerRows = await client.query<{ first_name: string }>(
        `SELECT first_name FROM users WHERE id = $1`,
        [userId]
      );
      const joiner = joinerRows.rows[0] ?? null;

      return {
        status: 200,
        json: { family, children },
        notification: {
          pushToken: parentA?.push_token,
          title: 'Famille liée !',
          body: `${joiner?.first_name ?? 'Votre coparent'} a rejoint Sérénité 🎉`,
        },
      };
    });

    // Notification push (après commit de la transaction)
    if ('notification' in result && result.notification?.pushToken) {
      sendPushNotification(
        result.notification.pushToken,
        result.notification.title,
        result.notification.body
      ).catch(() => { /* notification non critique */ });
    }

    res.status(result.status).json(result.json);
  } catch (err) {
    console.error('POST /invitations/accept:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/invitations/status ────────────────────────────

router.get('/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;

    const invitation = await queryOne<{
      id: string;
      code: string;
      token: string;
      status: string;
      expires_at: string;
      created_at: string;
      accepted_by: string | null;
    }>(
      `SELECT i.id, i.code, i.token, i.status, i.expires_at, i.created_at, i.accepted_by
       FROM invitations i
       WHERE i.inviter_id = $1
       ORDER BY i.created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (!invitation) {
      res.status(404).json({ error: 'Aucune invitation trouvée' });
      return;
    }

    // Enrichir avec le prénom du coparent si accepté
    let acceptedByName: string | null = null;
    if (invitation.accepted_by) {
      const acceptor = await queryOne<{ first_name: string }>(
        `SELECT first_name FROM users WHERE id = $1`,
        [invitation.accepted_by]
      );
      acceptedByName = acceptor?.first_name ?? null;
    }

    res.json({ ...invitation, acceptedByName });
  } catch (err) {
    console.error('GET /invitations/status:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── DELETE /api/invitations/:id ────────────────────────────

router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user!.id;

  try {
    const invitation = await queryOne<{ id: string; inviter_id: string; status: string }>(
      `SELECT id, inviter_id, status FROM invitations WHERE id = $1`,
      [id]
    );

    if (!invitation) {
      res.status(404).json({ error: 'Invitation introuvable' });
      return;
    }

    if (invitation.inviter_id !== userId) {
      res.status(403).json({ error: 'Non autorisé' });
      return;
    }

    if (invitation.status !== 'pending') {
      res.status(400).json({ error: `Impossible d'annuler une invitation ${invitation.status}` });
      return;
    }

    await query(
      `UPDATE invitations SET status = 'cancelled' WHERE id = $1`,
      [id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('DELETE /invitations/:id:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
