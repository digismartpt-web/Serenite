import { Router, Response }   from 'express';
import crypto                  from 'crypto';
import axios                   from 'axios';
import { z }                   from 'zod';

import { query, queryOne } from '../lib/database';
import { requireAuth, AuthRequest }         from '../middleware/auth';
import { sendPushNotification }             from '../utils/notifications';
import { DEEPSEEK_API_URL, DEEPSEEK_API_KEY, DEEPSEEK_MODEL, CNV_SYSTEM_PROMPT } from '../services/ai/deepseekClient';

const router = Router();

// ─── Score d'agressivité ──────────────────────────────────────

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
  const letters = (text.match(/[a-zA-ZÀ-ÿ]/g) ?? []).length;
  if (letters > 0) {
    const uppers = (text.match(/[A-ZÀÂÉÈÊËÏÎÔÙÛÜÇ]/g) ?? []).length;
    score += Math.min((uppers / letters) * 0.6, 0.30);
  }
  const exclamations = (text.match(/!/g) ?? []).length;
  score += Math.min(exclamations * 0.10, 0.30);
  const lower = text.toLowerCase();
  const matches = AGGRESSIVE_WORDS_FR.filter(w => lower.includes(w)).length;
  score += Math.min(matches * 0.08, 0.40);
  return Math.round(Math.min(score, 1) * 100) / 100;
}

// ─── Schémas Zod ──────────────────────────────────────────────

const ReformulateSchema = z.object({
  content:  z.string().min(1).max(5000).trim(),
  familyId: z.string().uuid(),
});

const SendSchema = z.object({
  content:           z.string().min(1).max(5000).trim(),
  familyId:          z.string().uuid(),
  originalContent:   z.string().optional(),
  isReformulated:    z.boolean().default(false),
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

    const member = await queryOne<{ id: string }>(
      `SELECT id FROM families
       WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
      [familyId, userId]
    );
    if (!member) {
      res.status(403).json({ error: 'Accès refusé à cette famille' });
      return;
    }

    const score = computeAggressivenessScore(content);

    try {
      const aiResp = await axios.post(
        DEEPSEEK_API_URL + '/v1/chat/completions',
        {
          model: DEEPSEEK_MODEL,
          messages: [
            { role: 'system', content: CNV_SYSTEM_PROMPT },
            { role: 'user', content },
          ],
          temperature: 0.3,
          max_tokens: 1024,
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      const reformulated = aiResp.data.choices?.[0]?.message?.content?.trim() ?? content;

      res.json({
        original:       content,
        reformulated,
        score,
        level:          score < 0.3 ? 'low' : score < 0.6 ? 'medium' : 'high',
      });
    } catch (err: any) {
      console.error('[AI] Échec reformulation DeepSeek :', err.message);
      res.json({
        original:       content,
        reformulated:   content,
        score,
        level:          score < 0.3 ? 'low' : score < 0.6 ? 'medium' : 'high',
        warning:        'Reformulation IA indisponible — message envoyé tel quel',
      });
    }
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

    const { content, familyId, originalContent, isReformulated, aggressivenessScore } = parsed.data;
    const userId = req.user!.id;

    const member = await queryOne<{ id: string; parent_a_id: string; parent_b_id: string }>(
      `SELECT id, parent_a_id, parent_b_id FROM families
       WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
      [familyId, userId]
    );
    if (!member) {
      res.status(403).json({ error: 'Accès refusé à cette famille' });
      return;
    }

    const score = aggressivenessScore ?? computeAggressivenessScore(content);

    if (score >= 0.6) {
      const pauseMinutes = 5;
      const pauseExpires = new Date(Date.now() + pauseMinutes * 60 * 1000);
      res.status(429).json({
        error: `Message jugé agressif (score: ${score}). Pause de ${pauseMinutes} minutes avant de pouvoir envoyer un message.`,
        pauseExpiresAt: pauseExpires.toISOString(),
        aggressivenessScore: score,
        reformulated: originalContent ?? content,
      });
      return;
    }

    const contentHash = crypto.createHash('sha256').update(content).digest('hex');

    const result = await query<{ id: string; created_at: string }>(
      `INSERT INTO messages
         (family_id, sender_id, content, original_content, is_reformulated,
          aggressiveness_score, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [familyId, userId, content, originalContent ?? content, isReformulated, score, contentHash]
    );

    const message = result[0];

    // Notification push à l'autre parent
    const otherParentId = member.parent_a_id === userId ? member.parent_b_id : member.parent_a_id;
    if (otherParentId) {
      sendPushNotification(
        otherParentId,
        'Nouveau message Sérénité',
        `${req.user!.email} vous a envoyé un message.`,
        { screen: 'messages', familyId }
      ).catch(() => { /* notification non critique */ });
    }

    res.status(201).json({ message });
  }
);

// ── Modèles de messages (placé AVANT /:familyId) ──────────────

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

// ─── GET /api/messages/:familyId ──────────────────────────────

router.get(
  '/:familyId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { familyId } = req.params;
    const parsed = ListSchema.safeParse(req.query);
    const { limit, before } = parsed.success ? parsed.data : { limit: 50, before: undefined };
    const userId = req.user!.id;

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
         u.first_name AS sender_first_name,
         u.parent_type AS sender_parent_type
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.family_id = $1
         ${before ? 'AND m.created_at < $3' : ''}
       ORDER BY m.created_at DESC
       LIMIT $2`,
      before ? [familyId, limit, before] : [familyId, limit]
    );

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

router.put(
  '/:familyId/read',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { familyId } = req.params;
    const userId = req.user!.id;

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

export default router;
