import { Router, Response }   from 'express';
import crypto                  from 'crypto';
import axios                   from 'axios';
import { z }                   from 'zod';

import { query, queryOne, withTransaction } from '../lib/database';
import { requireAuth, AuthRequest }         from '../middleware/auth';
import { sendPushNotification }             from '../utils/notifications';
import { DEEPSEEK_API_URL, DEEPSEEK_API_KEY, DEEPSEEK_MODEL, CNV_SYSTEM_PROMPT } from '../services/ai/deepseekClient';

const router = Router();

// ─── Score d'agressivité ──────────────────────────────────────
// Algorithme léger, côté serveur (pas d'appel LLM supplémentaire)

const AGGRESSIVE_WORDS_FR = [
  'jamais', 'toujours', 'encore', 'arrête', 'nul', 'nulle',
  'impossible', 'inadmissible', 'honte', 'irresponsable',
  'incompétent', 'incompétente', 'idiot', 'idiote', 'stupide',
  'menteur', 'menteuse', 'fainéant', 'égoïste', 'pathétique',
  'lamentable', 'catastrophe', 'inacceptable', 'n\'importe quoi',
  'ridicule', 'scandaleux', 'scandaleux', 'pitoyable', 'zéro',
];

function computeAggressivenessScore(text: string): number {
  let score = 0;

  // 1. Proportion de majuscules (max +0.30)
  const letters = (text.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  if (letters > 0) {
    const uppers = (text.match(/[A-ZÀÂÉÈÊËÏÎÔÙÛÜÇ]/g) ?? []).length;
    score += Math.min((uppers / letters) * 0.6, 0.30);
  }

  // 2. Points d'exclamation (max +0.30, 0.10 par !)
  const exclamations = (text.match(/!/g) ?? []).length;
  score += Math.min(exclamations * 0.10, 0.30);

  // 3. Mots négatifs listés (max +0.40, 0.08 par mot)
  const lower = text.toLowerCase();
  let negCount = 0;
  for (const w of AGGRESSIVE_WORDS_FR) {
    if (lower.includes(w)) negCount++;
  }
  score += Math.min(negCount * 0.08, 0.40);

  return Math.min(parseFloat(score.toFixed(2)), 1);
}

// ─── Schémas Zod ──────────────────────────────────────────────

const ReformulateSchema = z.object({
  content:  z.string().min(1).max(2000).trim(),
  familyId: z.string().uuid(),
});

const SendSchema = z.object({
  content:             z.string().min(1).max(2000).trim(),
  familyId:            z.string().uuid(),
  originalContent:     z.string().optional(),
  isReformulated:      z.boolean().default(false),
  aggressivenessScore: z.number().min(0).max(1).optional(),
});

const ListSchema = z.object({
  limit:  z.coerce.number().int().min(1).max(100).default(50),
  before: z.string().datetime().optional(),
});

// ─── POST /api/messages/reformulate ───────────────────────────

router.post(
  '/reformulate',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = ReformulateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { content, familyId } = parsed.data;
    const userId = req.user!.id;

    // Vérifier que l'utilisateur appartient bien à cette famille
    const member = await queryOne<{ id: string }>(
      `SELECT id FROM families
       WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
      [familyId, userId]
    );
    if (!member) {
      res.status(403).json({ error: 'Accès refusé à cette famille' });
      return;
    }

    // Score d'agressivité (rapide, sans LLM)
    const aggressivenessScore = computeAggressivenessScore(content);
    const pauseRequired = aggressivenessScore > 0.7;

    // Appel DeepSeek v4 Flash pour reformulation
    let reformulatedContent: string;
    try {
      const dsResponse = await axios.post(
        `${DEEPSEEK_API_URL}/chat/completions`,
        {
          model: DEEPSEEK_MODEL,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: CNV_SYSTEM_PROMPT },
            { role: 'user',   content: content },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type':  'application/json',
          },
          timeout: 15_000,
        }
      );

      reformulatedContent = dsResponse.data.choices[0].message.content.trim();
    } catch (err) {
      console.error('[messages/reformulate] Erreur API DeepSeek (status:', (err as any)?.response?.status ?? 'inconnu', ')');
      res.status(502).json({ error: 'Service de reformulation temporairement indisponible' });
      return;
    }

    // Calcul de la date d'expiration de pause (si nécessaire)
    const pauseExpiresAt = pauseRequired
      ? new Date(Date.now() + 10 * 60 * 1000).toISOString()
      : null;

    // Déterminer si urgence (score très élevé)
    const isUrgent = aggressivenessScore > 0.9;

    res.json({
      reformulatedContent,
      aggressivenessScore,
      pauseRequired,
      pauseExpiresAt,
      ...(isUrgent && {
        urgence: {
          message: "Ce message semble très émotionnel. Prenez un moment pour vous.",
          soutien: "Service d'écoute parentale : 0 800 00 00 00",
          respiration: "Respiration guidée : inspirez 4s, bloquez 4s, expirez 6s. À répéter 5 fois.",
          modele: "J'ai besoin d'un temps de pause avant de répondre. Je te recontacte dans quelques minutes.",
        },
      }),
    });
  }
);

// ─── POST /api/messages/send ──────────────────────────────────

router.post(
  '/send',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = SendSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const {
      content, familyId, originalContent,
      isReformulated, aggressivenessScore,
    } = parsed.data;
    const userId = req.user!.id;

    // Vérifier l'appartenance à la famille
    const family = await queryOne<{ id: string; parent_a_id: string; parent_b_id: string }>(
      `SELECT id, parent_a_id, parent_b_id FROM families
       WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
      [familyId, userId]
    );
    if (!family) {
      res.status(403).json({ error: 'Accès refusé à cette famille' });
      return;
    }

    // Vérifier qu'une pause n'est pas en cours pour cet utilisateur
    const activePause = await queryOne<{ pause_expires_at: string }>(
      `SELECT pause_expires_at FROM messages
       WHERE family_id = $1 AND sender_id = $2
         AND pause_expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [familyId, userId]
    );
    if (activePause) {
      res.status(429).json({
        error:           'Pause de réflexion en cours',
        pauseExpiresAt:  activePause.pause_expires_at,
      });
      return;
    }

    // SHA-256 horodaté — preuve d'intégrité du message
    const timestamp = new Date().toISOString();
    const contentHash = crypto
      .createHash('sha256')
      .update(`${content}|${timestamp}|${userId}`)
      .digest('hex');

    // Insérer en base
    const message = await withTransaction(async (client) => {
      const row = await client.query(
        `INSERT INTO messages
           (family_id, sender_id, content, original_content,
            is_reformulated, aggressiveness_score, content_hash)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [
          familyId, userId, content,
          originalContent  ?? null,
          isReformulated,
          aggressivenessScore ?? null,
          contentHash,
        ]
      );
      return row.rows[0];
    });

    // Notification push vers l'autre parent
    const otherParentId =
      family.parent_a_id === userId ? family.parent_b_id : family.parent_a_id;

    if (otherParentId) {
      const otherParent = await queryOne<{ push_token: string | null; first_name: string }>(
        `SELECT push_token, first_name FROM users WHERE id = $1`,
        [otherParentId]
      );
      // Récupérer le prénom de l'expéditeur depuis la DB (pas dans le JWT)
      const sender = await queryOne<{ first_name: string }>(
        'SELECT first_name FROM users WHERE id = $1',
        [userId]
      );
      if (otherParent?.push_token) {
        await sendPushNotification(
          otherParent.push_token,
          `Nouveau message de ${sender?.first_name ?? 'votre coparent'}`,
          content.slice(0, 100) + (content.length > 100 ? '…' : ''),
          { screen: 'messages', familyId }
        ).catch(() => { /* notification non critique */ });
      }
    }

    res.status(201).json({ message });
  }
);

// ─── GET /api/messages/:familyId ──────────────────────────────

router.get(
  '/:familyId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { familyId } = req.params;
    const parsed = ListSchema.safeParse(req.query);
    const { limit, before } = parsed.success ? parsed.data : { limit: 50, before: undefined };
    const userId = req.user!.id;

    // Vérifier l'appartenance
    const member = await queryOne<{ id: string }>(
      `SELECT id FROM families
       WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
      [familyId, userId]
    );
    if (!member) {
      res.status(403).json({ error: 'Accès refusé à cette famille' });
      return;
    }

    const result = await query<{
      id: string; sender_id: string; content: string;
      original_content: string | null; is_reformulated: boolean;
      aggressiveness_score: string | null; read_at: string | null;
      created_at: string; sender_first_name: string;
      sender_parent_type: string | null;
    }>(
      `SELECT
         m.id, m.sender_id, m.content, m.original_content,
         m.is_reformulated, m.aggressiveness_score,
         m.read_at, m.created_at,
         u.first_name   AS sender_first_name,
         u.parent_type  AS sender_parent_type
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.family_id = $1
         ${before ? 'AND m.created_at < $3' : ''}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      before ? [familyId, limit, before] : [familyId, limit]
    );

    // Les messages ne sont plus marqués comme lus automatiquement ici
    // Utiliser PUT /api/messages/:familyId/read pour marquer les messages comme lus

    res.json({ messages: result.reverse() });
  }
);

// ─── GET /api/messages/:familyId/unread-count ─────────────────

router.get(
  '/:familyId/unread-count',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { familyId } = req.params;
    const userId = req.user!.id;

    const row = await queryOne<{ count: string }>(
      `SELECT COUNT(*) AS count FROM messages
       WHERE family_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [familyId, userId]
    );

    res.json({ unreadCount: parseInt(row?.count ?? '0', 10) });
  }
);


// ─── PUT /api/messages/:familyId/read ─────────────────────────
// Marque explicitement les messages de l'autre parent comme lus

router.put(
  '/:familyId/read',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { familyId } = req.params;
    const userId = req.user!.id;

    // Vérifier l'appartenance à la famille
    const member = await queryOne<{ id: string }>(
      `SELECT id FROM families
       WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
      [familyId, userId]
    );
    if (!member) {
      res.status(403).json({ error: 'Accès refusé à cette famille' });
      return;
    }

    await query(
      `UPDATE messages
       SET read_at = NOW()
       WHERE family_id = $1 AND sender_id != $2 AND read_at IS NULL`,
      [familyId, userId]
    );

    res.json({ success: true });
  }
);

// ── Modèles de messages ─────────────────────────────────────
const MESSAGE_TEMPLATES = [
  "Bonjour [Prénom], je te confirme que [jour] je prends les enfants à [heure].",
  "Pour la pension ce mois-ci, voici le récapitulatif des dépenses : …",
  "Je te propose d'échanger le [date1] contre le [date2] pour la garde.",
  "Pour le RDV médical du [date], j'emmène [enfant] à [heure].",
  "Pense à remplir le carnet de santé / prendre les affaires pour [enfant].",
];

router.get(
  '/templates',
  requireAuth,
  async (_req: AuthRequest, res: Response): Promise<void> => {
    res.json({ templates: MESSAGE_TEMPLATES });
  }
);

export default router;
