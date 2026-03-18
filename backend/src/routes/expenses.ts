import { Router, Response } from 'express';
import { z }                from 'zod';

import { query, queryOne, withTransaction } from '../lib/database';
import { requireAuth, AuthRequest }         from '../middleware/auth';

const router = Router();

// ─── Schémas Zod ──────────────────────────────────────────────

const CATEGORIES = [
  'garde', 'activite', 'sante', 'scolarite',
  'vetement', 'alimentation', 'loisir', 'autre',
] as const;

const ExpenseBody = z.object({
  familyId:    z.string().uuid(),
  title:       z.string().min(1).max(200).trim(),
  amount:      z.number().positive().max(999999.99),
  category:    z.enum(CATEGORIES).default('autre'),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  splitRatio:  z.number().min(0).max(1).default(0.5),
  notes:       z.string().max(1000).trim().optional(),
});

const UpdateBody = ExpenseBody.partial().omit({ familyId: true });

const ListQuery = z.object({
  familyId: z.string().uuid(),
  month:    z.string().regex(/^\d{4}-\d{2}$/).optional(), // YYYY-MM
  limit:    z.coerce.number().int().min(1).max(200).default(50),
});

// ─── Vérification appartenance famille ────────────────────────

async function checkFamilyMember(familyId: string, userId: string): Promise<{ id: string; parent_a_id: string; parent_b_id: string } | null> {
  return queryOne<{ id: string; parent_a_id: string; parent_b_id: string }>(
    `SELECT id, parent_a_id, parent_b_id FROM families
     WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
    [familyId, userId]
  );
}

// ─── GET /api/expenses?familyId=&month= ───────────────────────
// Retourne la liste + le bilan (balance)

router.get(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Paramètres invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { familyId, month, limit } = parsed.data;
    const userId = req.user!.id;

    const family = await checkFamilyMember(familyId, userId);
    if (!family) { res.status(403).json({ error: 'Accès refusé' }); return; }

    const conditions: string[] = ['e.family_id = $1'];
    const params: unknown[]    = [familyId];

    if (month) {
      const start = `${month}-01`;
      const end   = new Date(parseInt(month.slice(0, 4), 10), parseInt(month.slice(5, 7), 10), 0)
                      .toISOString().slice(0, 10);
      params.push(start); conditions.push(`e.expense_date >= $${params.length}`);
      params.push(end);   conditions.push(`e.expense_date <= $${params.length}`);
    }

    params.push(limit);
    const limitParam = params.length;

    const result = await query<{
      id: string; title: string; amount: string; category: string;
      expense_date: string; split_ratio: string; notes: string | null;
      paid_by: string; payer_first_name: string; created_at: string;
    }>(
      `SELECT
         e.id, e.title, e.amount, e.category,
         e.expense_date, e.split_ratio, e.notes,
         e.paid_by, u.first_name AS payer_first_name,
         e.created_at
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.expense_date DESC, e.created_at DESC
       LIMIT $${limitParam}`,
      params
    );

    // ── Calcul du bilan ───────────────────────────────────────
    // Pour chaque dépense : le payeur avance (amount).
    // L'autre doit (amount * (1 - split_ratio)) si payeur = parent_a, ou (amount * split_ratio) si payeur = parent_b.
    // On simplifie : chaque parent doit X % selon split_ratio.
    // balance > 0 → parent_b doit à parent_a ; balance < 0 → parent_a doit à parent_b.

    const balanceResult = await queryOne<{
      balance_a_to_b: string;  // ce que parent_a doit à parent_b
      balance_b_to_a: string;  // ce que parent_b doit à parent_a
    }>(
      `SELECT
         COALESCE(SUM(CASE WHEN paid_by = $2
                           THEN amount * split_ratio          -- parent_b paid, parent_a owes split_ratio
                           ELSE 0 END), 0) AS balance_a_to_b,
         COALESCE(SUM(CASE WHEN paid_by = $3
                           THEN amount * (1 - split_ratio)    -- parent_a paid, parent_b owes (1-split_ratio)
                           ELSE 0 END), 0) AS balance_b_to_a
       FROM expenses
       WHERE family_id = $1`,
      [familyId, family.parent_b_id, family.parent_a_id]
    );

    const aToB  = parseFloat(balanceResult?.balance_a_to_b ?? '0');
    const bToA  = parseFloat(balanceResult?.balance_b_to_a ?? '0');
    const net   = parseFloat((bToA - aToB).toFixed(2)); // > 0 → parent_b owes parent_a

    // Qui est l'utilisateur courant ?
    const iAmParentA = family.parent_a_id === userId;

    const balance = {
      net,
      // Du point de vue de l'utilisateur courant
      iOwe:   iAmParentA ? Math.max(0,  aToB - bToA) : Math.max(0, bToA - aToB),
      theyOwe: iAmParentA ? Math.max(0, bToA - aToB) : Math.max(0, aToB - bToA),
    };

    res.json({
      expenses: result.rows,
      balance,
      otherParentId: iAmParentA ? family.parent_b_id : family.parent_a_id,
    });
  }
);

// ─── POST /api/expenses ────────────────────────────────────────

router.post(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = ExpenseBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { familyId, title, amount, category, expenseDate, splitRatio, notes } = parsed.data;
    const userId = req.user!.id;

    if (!(await checkFamilyMember(familyId, userId))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    const expense = await withTransaction(async (client) => {
      const row = await client.query(
        `INSERT INTO expenses (family_id, paid_by, title, amount, category, expense_date, split_ratio, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [familyId, userId, title, amount, category, expenseDate, splitRatio, notes ?? null]
      );
      return row.rows[0];
    });

    res.status(201).json({ expense });
  }
);

// ─── PATCH /api/expenses/:id ───────────────────────────────────

router.patch(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const userId     = req.user!.id;
    const expenseId  = req.params.id;

    const existing = await queryOne<{ id: string; family_id: string; paid_by: string }>(
      `SELECT id, family_id, paid_by FROM expenses WHERE id = $1`,
      [expenseId]
    );
    if (!existing) { res.status(404).json({ error: 'Dépense introuvable' }); return; }
    if (existing.paid_by !== userId) { res.status(403).json({ error: 'Seul le créateur peut modifier' }); return; }

    if (!(await checkFamilyMember(existing.family_id, userId))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    const { title, amount, category, expenseDate, splitRatio, notes } = parsed.data;

    const expense = await withTransaction(async (client) => {
      const row = await client.query(
        `UPDATE expenses SET
           title        = COALESCE($2, title),
           amount       = COALESCE($3, amount),
           category     = COALESCE($4, category),
           expense_date = COALESCE($5, expense_date),
           split_ratio  = COALESCE($6, split_ratio),
           notes        = COALESCE($7, notes)
         WHERE id = $1
         RETURNING *`,
        [expenseId, title, amount, category, expenseDate, splitRatio, notes]
      );
      return row.rows[0];
    });

    res.json({ expense });
  }
);

// ─── DELETE /api/expenses/:id ──────────────────────────────────

router.delete(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId    = req.user!.id;
    const expenseId = req.params.id;

    const existing = await queryOne<{ id: string; family_id: string; paid_by: string }>(
      `SELECT id, family_id, paid_by FROM expenses WHERE id = $1`,
      [expenseId]
    );
    if (!existing) { res.status(404).json({ error: 'Dépense introuvable' }); return; }
    if (existing.paid_by !== userId) { res.status(403).json({ error: 'Seul le créateur peut supprimer' }); return; }

    await query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
    res.status(204).send();
  }
);

// ─── POST /api/finances/:id/validate ──────────────────────────
// L'autre parent valide (ou refuse) une dépense

const ValidateBody = z.object({
  action: z.enum(['validate', 'refuse']),
});

router.post(
  '/:id/validate',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = ValidateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'action doit être "validate" ou "refuse"' });
      return;
    }

    const userId    = req.user!.id;
    const expenseId = req.params.id;
    const { action } = parsed.data;

    const existing = await queryOne<{
      id: string; family_id: string; paid_by: string; validated_by: string | null;
    }>(
      `SELECT id, family_id, paid_by, validated_by FROM expenses WHERE id = $1`,
      [expenseId]
    );
    if (!existing)              { res.status(404).json({ error: 'Dépense introuvable' }); return; }
    if (existing.paid_by === userId) { res.status(403).json({ error: 'Impossible de valider sa propre dépense' }); return; }
    if (existing.validated_by)  { res.status(409).json({ error: 'Dépense déjà traitée' }); return; }

    if (!(await checkFamilyMember(existing.family_id, userId))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    if (action === 'refuse') {
      // On supprime la dépense refusée
      await query(`DELETE FROM expenses WHERE id = $1`, [expenseId]);
      res.json({ message: 'Dépense refusée et supprimée' });
      return;
    }

    // Validation
    const row = await query(
      `UPDATE expenses
       SET validated_by = $2, validated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [expenseId, userId]
    );

    res.json({ expense: row.rows[0] });
  }
);

export default router;
