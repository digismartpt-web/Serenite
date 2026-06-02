import { Router, Response } from 'express';

import { query }                 from '../lib/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── GET /api/users/export ──────────────────────────────────────
// Export RGPD de toutes les données personnelles de l'utilisateur

router.get(
  '/export',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    // Informations de profil
    const userRows = await query<Record<string, unknown>>(
      `SELECT id, email, first_name, last_name, phone, address,
              birth_date, parent_type, status, children_count,
              language, email_verified, created_at, updated_at,
              -- notification_token retiré de l'export RGPD
       FROM users WHERE id = $1`,
      [userId]
    );
    const userProfile = userRows[0] ?? null;

    // Consents RGPD
    const consents = await query<Record<string, unknown>>(
      `SELECT consent_1, consent_2, consent_3, consent_4, ip_address,
              consented_at
       FROM consents WHERE user_id = $1 ORDER BY consented_at DESC`,
      [userId]
    );

    // Messages envoyés
    const messages = await query<Record<string, unknown>>(
      `SELECT m.id, m.content, m.original_content, m.is_reformulated,
              m.score, m.hash, m.created_at,
              u.first_name AS recipient_first_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.receiver_id
       WHERE m.sender_id = $1
       ORDER BY m.created_at ASC`,
      [userId]
    );

    // Messages reçus
    const receivedMessages = await query<Record<string, unknown>>(
      `SELECT m.id, m.content, m.is_reformulated, m.score, m.hash,
              m.created_at, m.read_at,
              u.first_name AS sender_first_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.receiver_id = $1
       ORDER BY m.created_at ASC`,
      [userId]
    );

    // Dépenses
    const expenses = await query<Record<string, unknown>>(
      `SELECT id, title, amount, category, split_ratio, receipt_url,
              status, created_at, updated_at
       FROM expenses
       WHERE paid_by = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    // Événements du calendrier créés par l'utilisateur
    const events = await query<Record<string, unknown>>(
      `SELECT e.id, e.title, e.description, e.start_at, e.end_at,
              e.all_day, e.category, e.color, e.created_at
       FROM events e
       WHERE e.created_by = $1
       ORDER BY e.start_at ASC`,
      [userId]
    );

    // Informations famille
    const families = await query<Record<string, unknown>>(
      `SELECT f.id, f.status, f.created_at,
              u.first_name AS parent_a_name,
              u2.first_name AS parent_b_name
       FROM families f
       LEFT JOIN users u ON u.id = f.parent_a_id
       LEFT JOIN users u2 ON u2.id = f.parent_b_id
       WHERE f.parent_a_id = $1 OR f.parent_b_id = $1`,
      [userId]
    );

    // Enfants de la famille
    const children = await query<Record<string, unknown>>(
      `SELECT fc.id, fc.first_name, fc.birth_date, fc.color,
              fc.age, fc.created_at
       FROM family_children fc
       JOIN families f ON f.id = fc.family_id
       WHERE f.parent_a_id = $1 OR f.parent_b_id = $1`,
      [userId]
    );

    res.json({
      exportedAt: new Date().toISOString(),
      user: {
        ...userProfile,
        consents,
      },
      messages: {
        sent: messages,
        received: receivedMessages,
      },
      expenses,
      events,
      families,
      children,
    });
  }
);


// ─── POST /api/users/update-push-token ─────────────────────────
// Met à jour le push token de l'utilisateur

router.post(
  '/update-push-token',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { pushToken } = req.body as { pushToken?: string };
    const userId = req.user!.id;

    if (!pushToken || typeof pushToken !== 'string') {
      res.status(400).json({ error: 'pushToken requis' });
      return;
    }

    await query(
      `UPDATE users SET push_token = $1, updated_at = NOW() WHERE id = $2`,
      [pushToken, userId]
    );

    res.json({ success: true });
  }
);

// ─── DELETE /api/users/push-token ──────────────────────────────
// Supprime le push token (quand expiré ou désinscrit)

router.delete(
  '/push-token',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    await query(
      `UPDATE users SET push_token = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    res.json({ success: true });
  }
);

export default router;
