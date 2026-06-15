import { Router, Response } from 'express';
import { z } from 'zod';

import { query, queryOne } from '../lib/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Récupère l'ID de la famille de l'utilisateur.
 */
async function getFamilyId(userId: string): Promise<string | null> {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM families
     WHERE parent_a_id = $1 OR parent_b_id = $1
     LIMIT 1`,
    [userId]
  );
  return row?.id ?? null;
}

// ─── Schémas Zod ───────────────────────────────────────────────

const RECORD_TYPES = [
  'consultation',
  'vaccin',
  'medicament',
  'hospitalisation',
  'allergie',
  'poids',
  'taille',
  'autre',
] as const;

const HealthBody = z.object({
  childId:     z.string().uuid(),
  recordType:  z.enum(RECORD_TYPES),
  title:       z.string().min(1).max(255).trim(),
  description: z.string().max(5000).trim().optional(),
  recordDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
  doctorName:  z.string().max(255).trim().optional(),
  notes:       z.string().max(2000).trim().optional(),
  filePath:    z.string().max(500).trim().optional(),
});

// ─── GET /api/health ───────────────────────────────────────────
/**
 * Liste tous les enregistrements de santé pour la famille
 * de l'utilisateur connecté.
 */
router.get(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const familyId = await getFamilyId(userId);
    if (!familyId) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    const rows = await query<{
      id: string;
      child_id: string;
      child_first_name: string;
      record_type: string;
      title: string;
      description: string | null;
      record_date: string;
      doctor_name: string | null;
      notes: string | null;
      file_path: string | null;
      created_by: string;
      created_at: string;
    }>(
      `SELECT h.id, h.child_id,
              c.first_name AS child_first_name,
              h.record_type, h.title, h.description,
              h.record_date, h.doctor_name, h.notes, h.file_path,
              h.created_by, h.created_at
       FROM health_records h
       JOIN children c ON c.id = h.child_id
       WHERE c.family_id = $1
       ORDER BY h.record_date DESC, h.created_at DESC`,
      [familyId]
    );

    res.json({ records: rows });
  }
);

// ─── GET /api/health/child/:childId ────────────────────────────
/**
 * Liste les enregistrements de santé pour un enfant spécifique
 * de la famille.
 */
router.get(
  '/child/:childId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const { childId } = req.params;

    const familyId = await getFamilyId(userId);
    if (!familyId) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    // Vérifier que l'enfant appartient à la famille
    const child = await queryOne<{ id: string }>(
      `SELECT id FROM children WHERE id = $1 AND family_id = $2`,
      [childId, familyId]
    );
    if (!child) {
      res.status(404).json({ error: 'Enfant introuvable dans cette famille' });
      return;
    }

    const rows = await query<{
      id: string;
      child_id: string;
      record_type: string;
      title: string;
      description: string | null;
      record_date: string;
      doctor_name: string | null;
      notes: string | null;
      file_path: string | null;
      created_by: string;
      created_at: string;
    }>(
      `SELECT id, child_id, record_type, title, description,
              record_date, doctor_name, notes, file_path,
              created_by, created_at
       FROM health_records
       WHERE child_id = $1
       ORDER BY record_date DESC, created_at DESC`,
      [childId]
    );

    res.json({ records: rows });
  }
);

// ─── POST /api/health ──────────────────────────────────────────
/**
 * Ajoute un enregistrement dans le carnet de santé d'un enfant.
 * L'enfant doit appartenir à la famille de l'utilisateur.
 */
router.post(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = HealthBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Données invalides',
        fields: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const userId = req.user!.id;
    const { childId, recordType, title, description, recordDate, doctorName, notes, filePath } =
      parsed.data;

    const familyId = await getFamilyId(userId);
    if (!familyId) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    // Vérifier que l'enfant appartient à la famille
    const child = await queryOne<{ id: string }>(
      `SELECT id FROM children WHERE id = $1 AND family_id = $2`,
      [childId, familyId]
    );
    if (!child) {
      res.status(404).json({ error: 'Enfant introuvable dans cette famille' });
      return;
    }

    const row = await queryOne<{
      id: string;
      child_id: string;
      record_type: string;
      title: string;
      record_date: string;
      created_at: string;
    }>(
      `INSERT INTO health_records (child_id, created_by, record_type, title, description, record_date, doctor_name, notes, file_path)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, child_id, record_type, title, record_date, created_at`,
      [
        childId,
        userId,
        recordType,
        title,
        description ?? null,
        recordDate,
        doctorName ?? null,
        notes ?? null,
        filePath ?? null,
      ]
    );

    res.status(201).json({ record: row });
  }
);

// ─── DELETE /api/health/:id ────────────────────────────────────
/**
 * Supprime un enregistrement du carnet de santé.
 * Seul un membre de la famille peut supprimer un enregistrement
 * lié à un enfant de cette famille.
 */
router.delete(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const recordId = req.params.id;

    const familyId = await getFamilyId(userId);
    if (!familyId) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    // Vérifier que l'enregistrement existe et que l'enfant
    // appartient à la famille
    const record = await queryOne<{ id: string; child_id: string }>(
      `SELECT h.id, h.child_id
       FROM health_records h
       JOIN children c ON c.id = h.child_id
       WHERE h.id = $1 AND c.family_id = $2`,
      [recordId, familyId]
    );
    if (!record) {
      res.status(404).json({ error: 'Enregistrement introuvable' });
      return;
    }

    await query(`DELETE FROM health_records WHERE id = $1`, [recordId]);
    res.status(204).send();
  }
);

export default router;
