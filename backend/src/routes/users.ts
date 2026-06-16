import { Router, Response } from 'express';

import { query }                 from '../lib/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── Helper : wrappe un handler async avec try/catch ─────────

function asyncHandler(fn: (req: AuthRequest, res: Response) => Promise<void>) {
  return async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      await fn(req, res);
    } catch (err: any) {
      console.error(`[users] ${req.method} ${req.path}:`, err.message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  };
}

// ─── GET /api/users/export ──────────────────────────────────────

router.get(
  '/export',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    // Informations de profil
    const userRows = await query<Record<string, unknown>>(
      `SELECT id, email, first_name, last_name, phone, address,
              birth_date, role, parent_type, status, children_count,
              language, email_verified, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );
    const userProfile = userRows[0] ?? null;

    // Consents RGPD
    const consents = await query<Record<string, unknown>>(
      `SELECT cgu_accepted, data_processing_accepted,
              children_data_accepted, newsletter_accepted,
              ip_address, accepted_at
       FROM consents WHERE user_id = $1 ORDER BY accepted_at DESC`,
      [userId]
    );

    // Messages envoyés
    const messages = await query<Record<string, unknown>>(
      `SELECT id, content, original_content, is_reformulated,
              aggressiveness_score, created_at
       FROM messages
       WHERE sender_id = $1
       ORDER BY created_at ASC`,
      [userId]
    );

    // Messages reçus
    const receivedMessages = await query<Record<string, unknown>>(
      `SELECT id, content, is_reformulated, aggressiveness_score,
              created_at, read_at,
              sender_id
       FROM messages
       WHERE family_id IN (SELECT id FROM families WHERE parent_a_id = $1 OR parent_b_id = $1)
         AND sender_id != $1
       ORDER BY created_at ASC`,
      [userId]
    );

    // Dépenses
    const expenses = await query<Record<string, unknown>>(
      `SELECT id, title, amount, category, expense_date, notes, created_at
       FROM expenses
       WHERE paid_by = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    // Événements du calendrier
    const events = await query<Record<string, unknown>>(
      `SELECT id, title, description, start_at, end_at,
              all_day, category, color, created_at
       FROM events
       WHERE created_by = $1
       ORDER BY start_at ASC`,
      [userId]
    );

    // Informations famille
    const families = await query<Record<string, unknown>>(
      `SELECT id, name, status, created_at,
              parent_a_id, parent_b_id
       FROM families
       WHERE parent_a_id = $1 OR parent_b_id = $1`,
      [userId]
    );

    res.json({
      exportedAt: new Date().toISOString(),
      user: { ...userProfile, consents },
      messages: { sent: messages, received: receivedMessages },
      expenses,
      events,
      families,
    });
  })
);

// ─── POST /api/users/update-push-token ─────────────────────────

router.post(
  '/update-push-token',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
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
  })
);

// ─── DELETE /api/users/push-token ──────────────────────────────

router.delete(
  '/push-token',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    await query(
      `UPDATE users SET push_token = NULL, updated_at = NOW() WHERE id = $1`,
      [userId]
    );

    res.json({ success: true });
  })
);

// ─── DELETE /api/users/account ───────────────────────────────

router.delete(
  '/account',
  requireAuth,
  asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { confirm } = req.body as { confirm?: boolean };

    if (!confirm) {
      res.status(400).json({ error: 'Confirmation requise' });
      return;
    }

    // Supprimer les dépendances avant de supprimer l'utilisateur
    await query(
      `BEGIN;
       DELETE FROM health_records WHERE created_by = $1;
       DELETE FROM vault_documents WHERE uploaded_by = $1;
       DELETE FROM messages WHERE sender_id = $1;
       UPDATE expenses SET paid_by = NULL, validated_by = NULL WHERE paid_by = $1 OR validated_by = $1;
       DELETE FROM users WHERE id = $1;
       COMMIT;`,
      [userId]
    );
    res.json({ success: true, message: 'Compte supprimé' });
  })
);

export default router;
