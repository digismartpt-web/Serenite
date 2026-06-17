import { Router, Response } from 'express';
import { z } from 'zod';

import { query, queryOne } from '../lib/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Récupère l'ID de la famille de l'utilisateur.
 * Retourne null si l'utilisateur n'appartient à aucune famille.
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

const VaultBody = z.object({
  title:       z.string().min(1).max(255).trim(),
  description: z.string().max(2000).trim().optional(),
  filePath:    z.string().max(500).trim(),
  fileType:    z.string().max(50).trim().optional(),
  fileSize:    z.number().int().nonnegative().optional(),
  category:    z.string().max(100).trim().optional(),
});

// ─── GET /api/vault ────────────────────────────────────────────
/**
 * Liste tous les documents du coffre-fort pour la famille
 * de l'utilisateur connecté.
 * Query params : ?category=XXX (filtre optionnel)
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

    const params: unknown[] = [familyId];
    let categoryFilter = '';
    const category = req.query.category as string | undefined;
    if (category) {
      params.push(category);
      categoryFilter = ` AND v.category = $${params.length}`;
    }

    const rows = await query<{
      id: string;
      title: string;
      description: string | null;
      file_path: string;
      file_type: string | null;
      file_size: number | null;
      category: string | null;
      uploaded_by: string;
      created_at: string;
    }>(
      `SELECT v.id, v.title, v.description, v.file_path, v.file_type,
              v.file_size, v.category, v.uploaded_by,
              v.created_at
       FROM vault_documents v
       WHERE v.family_id = $1${categoryFilter}
       ORDER BY v.created_at DESC`,
      params
    );

    res.json({ documents: rows });
  }
);

// ─── POST /api/vault ───────────────────────────────────────────
/**
 * Ajoute un document au coffre-fort.
 * Le fichier doit d'abord être uploadé via /api/uploads,
 * puis on stocke l'URL retournée ici.
 */
router.post(
  '/',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = VaultBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Données invalides',
        fields: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const userId = req.user!.id;

    const familyId = await getFamilyId(userId);
    if (!familyId) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    const { title, description, filePath, fileType, fileSize, category } =
      parsed.data;

    const row = await queryOne<{
      id: string;
      title: string;
      file_path: string;
      created_at: string;
    }>(
      `INSERT INTO vault_documents (family_id, uploaded_by, title, description, file_path, file_type, file_size, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, file_path, created_at`,
      [
        familyId,
        userId,
        title,
        description ?? null,
        filePath,
        fileType ?? null,
        fileSize ?? null,
        category ?? 'other',
      ]
    );

    res.status(201).json({ document: row });
  }
);

// ─── DELETE /api/vault/:id ─────────────────────────────────────
/**
 * Supprime un document du coffre-fort.
 * Seul le membre de la famille propriétaire peut le faire.
 */
router.delete(
  '/:id',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;
    const docId = req.params.id;

    const familyId = await getFamilyId(userId);
    if (!familyId) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    const doc = await queryOne<{ id: string; family_id: string }>(
      `SELECT id, family_id FROM vault_documents WHERE id = $1`,
      [docId]
    );
    if (!doc) {
      res.status(404).json({ error: 'Document introuvable' });
      return;
    }
    if (doc.family_id !== familyId) {
      res.status(403).json({ error: 'Accès refusé' });
      return;
    }

    await query(`DELETE FROM vault_documents WHERE id = $1`, [docId]);
    res.status(204).send();
  }
);

export default router;
