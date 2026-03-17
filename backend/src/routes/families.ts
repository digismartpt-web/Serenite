import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../db';

const router = Router();

// ─── Helpers ────────────────────────────────────────────────

/** Vérifie que l'utilisateur est parent de la famille */
async function assertParent(
  userId: string,
  familyId: string
): Promise<boolean> {
  const family = await queryOne<{ parent_a_id: string; parent_b_id: string }>(
    `SELECT parent_a_id, parent_b_id FROM families WHERE id = $1`,
    [familyId]
  );
  if (!family) return false;
  return family.parent_a_id === userId || family.parent_b_id === userId;
}

/** Génère un code d'accès à 8 chiffres (enfant autonome) */
function generateChildCode(): string {
  return String(Math.floor(10000000 + Math.random() * 90000000));
}

// ─── POST /api/families/children ────────────────────────────

router.post('/children', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const {
    firstName,
    birthDate,
    calendarColor     = '#EEEDFE',
    calendarColorText = '#3C3489',
    createAutonomousAccess = false,
  } = req.body as {
    firstName: string;
    birthDate: string;
    calendarColor?: string;
    calendarColorText?: string;
    createAutonomousAccess?: boolean;
  };

  if (!firstName || !birthDate) {
    res.status(400).json({ error: 'Prénom et date de naissance requis' });
    return;
  }

  try {
    // Trouver la famille du parent connecté
    const family = await queryOne<{ id: string }>(
      `SELECT id FROM families
       WHERE parent_a_id = $1 OR parent_b_id = $1`,
      [userId]
    );

    if (!family) {
      res.status(404).json({ error: 'Famille introuvable' });
      return;
    }

    // Calculer l'âge pour décider du code autonome
    const birth  = new Date(birthDate);
    const today  = new Date();
    const ageYrs = today.getFullYear() - birth.getFullYear()
                   - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);

    let familyAccessCode: string | null = null;

    if (ageYrs >= 12 && createAutonomousAccess) {
      familyAccessCode = generateChildCode();
    }

    const child = await queryOne<{
      id: string;
      first_name: string;
      birth_date: string;
      age: number;
      calendar_color: string;
      calendar_color_text: string;
      family_access_code: string | null;
    }>(
      `INSERT INTO family_children
         (family_id, first_name, birth_date, calendar_color,
          calendar_color_text, family_access_code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, first_name, birth_date, age,
                 calendar_color, calendar_color_text, family_access_code`,
      [
        family.id,
        firstName,
        birthDate,
        calendarColor,
        calendarColorText,
        familyAccessCode,
        userId,
      ]
    );

    res.status(201).json(child);
  } catch (err) {
    console.error('POST /families/children:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/families/me ────────────────────────────────────

router.get('/me', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const family = await queryOne<{
      id: string;
      name: string;
      parent_a_id: string;
      parent_b_id: string | null;
      solo_mode: boolean;
      created_at: string;
    }>(
      `SELECT id, name, parent_a_id, parent_b_id, solo_mode, created_at
       FROM families
       WHERE parent_a_id = $1 OR parent_b_id = $1`,
      [userId]
    );

    if (!family) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    // Récupérer les deux parents
    const parentIds = [family.parent_a_id, family.parent_b_id].filter(Boolean);
    const parents = await query<{
      id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    }>(
      `SELECT id, first_name, last_name, email, phone
       FROM users WHERE id = ANY($1::uuid[])`,
      [parentIds]
    );

    const parentA = parents.find((p) => p.id === family.parent_a_id) ?? null;
    const parentB = parents.find((p) => p.id === family.parent_b_id) ?? null;

    // Récupérer les enfants
    const children = await query<{
      id: string;
      first_name: string;
      birth_date: string;
      age: number;
      calendar_color: string;
      calendar_color_text: string;
      family_access_code: string | null;
    }>(
      `SELECT id, first_name, birth_date, age,
              calendar_color, calendar_color_text, family_access_code
       FROM family_children
       WHERE family_id = $1
       ORDER BY birth_date`,
      [family.id]
    );

    res.json({ family, parentA, parentB, children });
  } catch (err) {
    console.error('GET /families/me:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PATCH /api/families/solo ────────────────────────────────
// Activer le mode solo si le coparent ne rejoint pas

router.patch('/solo', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const family = await queryOne<{ id: string }>(
      `SELECT id FROM families WHERE parent_a_id = $1`,
      [userId]
    );

    if (!family) {
      res.status(404).json({ error: 'Famille introuvable' });
      return;
    }

    await query(
      `UPDATE families SET solo_mode = TRUE WHERE id = $1`,
      [family.id]
    );

    res.json({ success: true, soloMode: true });
  } catch (err) {
    console.error('PATCH /families/solo:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
