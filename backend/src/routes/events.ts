import { Router, Response } from 'express';
import { z }                from 'zod';

import { query, queryOne, withTransaction } from '../lib/database';
import { requireAuth, AuthRequest }         from '../middleware/auth';

const router = Router();

// ─── Schémas Zod ──────────────────────────────────────────────

const CATEGORIES = ['visite', 'vacances', 'scolaire', 'medical', 'activite', 'autre'] as const;

const EventBody = z.object({
  familyId:    z.string().uuid(),
  title:       z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  startAt:     z.string().datetime(),
  endAt:       z.string().datetime(),
  allDay:      z.boolean().default(false),
  category:    z.enum(CATEGORIES).default('autre'),
  color:       z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  childrenIds: z.array(z.string().uuid()).max(20).default([]),
});

const UpdateBody = EventBody.partial().omit({ familyId: true });

const ListQuery = z.object({
  familyId: z.string().uuid(),
  from:     z.string().datetime().optional(),
  to:       z.string().datetime().optional(),
});

// ─── Vérification appartenance famille ────────────────────────

async function checkFamilyMember(familyId: string, userId: string): Promise<boolean> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM families
     WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
    [familyId, userId]
  );
  return !!row;
}

// ─── GET /api/events?familyId=&from=&to= ──────────────────────

router.get(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: 'Paramètres invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { familyId, from, to } = parsed.data;
    const userId = req.user!.id;

    if (!(await checkFamilyMember(familyId, userId))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    const conditions: string[] = ['e.family_id = $1'];
    const params: unknown[]    = [familyId];

    if (from) { params.push(from); conditions.push(`e.end_at >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`e.start_at <= $${params.length}`); }

    const result = await query<{
      id: string; title: string; description: string | null;
      start_at: string; end_at: string; all_day: boolean;
      category: string; color: string | null; created_by: string;
      created_at: string; creator_first_name: string;
      child_ids: string[] | null;
    }>(
      `SELECT
         e.id, e.title, e.description, e.start_at, e.end_at,
         e.all_day, e.category, e.color, e.created_by, e.created_at,
         u.first_name AS creator_first_name,
         ARRAY_AGG(ec.child_id) FILTER (WHERE ec.child_id IS NOT NULL) AS child_ids
       FROM events e
       JOIN users u ON u.id = e.created_by
       LEFT JOIN event_children ec ON ec.event_id = e.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY e.id, u.first_name
       ORDER BY e.start_at ASC`,
      params
    );

    res.json({ events: result.rows });
  }
);

// ─── POST /api/events ──────────────────────────────────────────

router.post(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = EventBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { familyId, title, description, startAt, endAt, allDay, category, color, childrenIds } = parsed.data;
    const userId = req.user!.id;

    if (new Date(endAt) < new Date(startAt)) {
      res.status(400).json({ error: 'La date de fin doit être après la date de début' });
      return;
    }

    if (!(await checkFamilyMember(familyId, userId))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    const event = await withTransaction(async (client) => {
      const row = await client.query(
        `INSERT INTO events (family_id, created_by, title, description, start_at, end_at, all_day, category, color)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [familyId, userId, title, description ?? null, startAt, endAt, allDay, category, color ?? null]
      );
      const ev = row.rows[0];

      if (childrenIds.length > 0) {
        for (const childId of childrenIds) {
          await client.query(
            `INSERT INTO event_children (event_id, child_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [ev.id, childId]
          );
        }
      }
      return ev;
    });

    res.status(201).json({ event });
  }
);

// ─── PATCH /api/events/:id ─────────────────────────────────────

router.patch(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = UpdateBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const userId  = req.user!.id;
    const eventId = req.params.id;

    const existing = await queryOne<{ id: string; family_id: string; created_by: string }>(
      `SELECT id, family_id, created_by FROM events WHERE id = $1`,
      [eventId]
    );
    if (!existing) { res.status(404).json({ error: 'Événement introuvable' }); return; }

    if (!(await checkFamilyMember(existing.family_id, userId))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    const { title, description, startAt, endAt, allDay, category, color, childrenIds } = parsed.data;

    if (startAt && endAt && new Date(endAt) < new Date(startAt)) {
      res.status(400).json({ error: 'La date de fin doit être après la date de début' });
      return;
    }

    const event = await withTransaction(async (client) => {
      const row = await client.query(
        `UPDATE events SET
           title       = COALESCE($2, title),
           description = COALESCE($3, description),
           start_at    = COALESCE($4, start_at),
           end_at      = COALESCE($5, end_at),
           all_day     = COALESCE($6, all_day),
           category    = COALESCE($7, category),
           color       = COALESCE($8, color)
         WHERE id = $1
         RETURNING *`,
        [eventId, title, description, startAt, endAt, allDay, category, color]
      );

      if (childrenIds !== undefined) {
        await client.query(`DELETE FROM event_children WHERE event_id = $1`, [eventId]);
        for (const childId of childrenIds) {
          await client.query(
            `INSERT INTO event_children (event_id, child_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
            [eventId, childId]
          );
        }
      }
      return row.rows[0];
    });

    res.json({ event });
  }
);

// ─── DELETE /api/events/:id ────────────────────────────────────

router.delete(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId  = req.user!.id;
    const eventId = req.params.id;

    const existing = await queryOne<{ id: string; family_id: string }>(
      `SELECT id, family_id FROM events WHERE id = $1`,
      [eventId]
    );
    if (!existing) { res.status(404).json({ error: 'Événement introuvable' }); return; }

    if (!(await checkFamilyMember(existing.family_id, userId))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    await query(`DELETE FROM events WHERE id = $1`, [eventId]);
    res.status(204).send();
  }
);

// ─── POST /api/calendar/exchange-request ──────────────────────
// Demande d'échange de jour de garde

const ExchangeBody = z.object({
  familyId:     z.string().uuid(),
  eventId:      z.string().uuid(),
  reason:       z.string().max(1000).trim().optional(),
  proposedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

router.post(
  '/exchange-request',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = ExchangeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { familyId, eventId, reason, proposedDate } = parsed.data;
    const userId = req.user!.id;

    if (!(await checkFamilyMember(familyId, userId))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    const event = await queryOne<{ id: string }>(`SELECT id FROM events WHERE id = $1`, [eventId]);
    if (!event) { res.status(404).json({ error: 'Événement introuvable' }); return; }

    const row = await query(
      `INSERT INTO exchange_requests (family_id, requested_by, event_id, reason, proposed_date)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [familyId, userId, eventId, reason ?? null, proposedDate ?? null]
    );

    res.status(201).json({ exchangeRequest: row.rows[0] });
  }
);

// ─── PUT /api/calendar/exchange-request/:id/respond ───────────

const RespondBody = z.object({
  status: z.enum(['accepted', 'refused']),
});

router.put(
  '/exchange-request/:id/respond',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = RespondBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données invalides' });
      return;
    }

    const userId     = req.user!.id;
    const requestId  = req.params.id;
    const { status } = parsed.data;

    const existing = await queryOne<{ id: string; family_id: string; requested_by: string; status: string }>(
      `SELECT id, family_id, requested_by, status FROM exchange_requests WHERE id = $1`,
      [requestId]
    );
    if (!existing)           { res.status(404).json({ error: 'Demande introuvable' }); return; }
    if (existing.status !== 'pending') { res.status(409).json({ error: 'Demande déjà traitée' }); return; }
    if (existing.requested_by === userId) { res.status(403).json({ error: 'Impossible de répondre à sa propre demande' }); return; }

    if (!(await checkFamilyMember(existing.family_id, userId))) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    const row = await query(
      `UPDATE exchange_requests
       SET status = $2, responded_at = NOW()
       WHERE id = $1 RETURNING *`,
      [requestId, status]
    );

    res.json({ exchangeRequest: row.rows[0] });
  }
);

export default router;
