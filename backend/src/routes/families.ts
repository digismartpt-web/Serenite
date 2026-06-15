import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { query, queryOne } from '../lib/database';

const router = Router();

/** Calcule l'âge depuis une date de naissance */
function computeAge(birthDate: string): number {
  const birth = new Date(birthDate);
  const today = new Date();
  return today.getFullYear() - birth.getFullYear()
    - (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
}

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

// ─── POST /api/families ──────────────────────────────────────

/**
 * Crée une nouvelle famille pour l'utilisateur connecté.
 * Body: { name: string }
 */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const { name } = req.body as { name?: string };

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Le nom de la famille est requis' });
    return;
  }

  try {
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM families WHERE parent_a_id = $1 OR parent_b_id = $1`,
      [userId]
    );

    if (existing) {
      res.status(409).json({ error: 'Vous avez déjà une famille' });
      return;
    }

    const family = await queryOne<{
      id: string; name: string; parent_a_id: string;
      parent_b_id: string | null; status: string; created_at: string;
    }>(
      `INSERT INTO families (name, parent_a_id, status)
       VALUES ($1, $2, 'solo')
       RETURNING *`,
      [name.trim(), userId]
    );

    res.status(201).json({ family });
  } catch (err) {
    console.error('POST /families:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/families ───────────────────────────────────────

/**
 * Retourne la famille de l'utilisateur connecté.
 */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const family = await queryOne<{
      id: string; name: string; parent_a_id: string;
      parent_b_id: string | null; status: string; created_at: string;
    }>(
      `SELECT * FROM families WHERE parent_a_id = $1 OR parent_b_id = $1`,
      [userId]
    );

    if (!family) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    res.json({ family });
  } catch (err) {
    console.error('GET /families:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── POST /api/families/children ────────────────────────────

router.post('/children', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;
  const {
    firstName,
    birthDate,
    calendarColor     = '#EEEDFE',
    calendarColorText = '#3C3489',
    createAutonomousAccess = false,
    childPin,
    childEmail,
  } = req.body as {
    firstName: string;
    birthDate: string;
    calendarColor?: string;
    calendarColorText?: string;
    createAutonomousAccess?: boolean;
    childPin?: string;
    childEmail?: string;
  };

  if (!firstName || !birthDate) {
    res.status(400).json({ error: 'Prénom et date de naissance requis' });
    return;
  }

  try {
    const family = await queryOne<{ id: string }>(
      `SELECT id FROM families
       WHERE parent_a_id = $1 OR parent_b_id = $1`,
      [userId]
    );

    if (!family) {
      res.status(404).json({ error: 'Famille introuvable' });
      return;
    }

    const ageYrs = computeAge(birthDate);

    let familyAccessCode: string | null = null;
    if (ageYrs >= 12 && createAutonomousAccess) {
      familyAccessCode = generateChildCode();
    }

    let pinHash: string | null = null;
    if (ageYrs < 12 && childPin) {
      pinHash = await bcrypt.hash(childPin, 12);
    }

    let childUserId: string | null = null;
    let childAccountCreated = false;

    if (ageYrs >= 15 && createAutonomousAccess && childEmail) {
      const defaultPin = childPin || '1234';
      const hashedDefaultPin = await bcrypt.hash(defaultPin, 12);

      const newUser = await queryOne<{ id: string }>(
        `INSERT INTO users (email, first_name, role, pin_hash, children_count)
         VALUES ($1, $2, 'child', $3, 0)
         RETURNING id`,
        [childEmail, firstName, hashedDefaultPin]
      );

      childUserId = newUser!.id;
      childAccountCreated = true;
    }

    const child = await queryOne<{
      id: string;
      first_name: string;
      birth_date: string;
      calendar_color: string;
      calendar_color_text: string;
      family_access_code: string | null;
    }>(
      `INSERT INTO children
         (family_id, first_name, birth_date, calendar_color,
          calendar_color_text, family_access_code, created_by,
          pin_hash, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, first_name, birth_date,
                 calendar_color, calendar_color_text, family_access_code`,
      [
        family.id, firstName, birthDate, calendarColor,
        calendarColorText, familyAccessCode, userId, pinHash, childUserId,
      ]
    );

    const response: Record<string, unknown> = {
      id:                  child!.id,
      first_name:          child!.first_name,
      birth_date:          child!.birth_date,
      age:                 ageYrs,
      calendar_color:      child!.calendar_color,
      calendar_color_text: child!.calendar_color_text,
    };

    if (familyAccessCode) {
      response.family_access_code = familyAccessCode;
    }

    if (ageYrs >= 12 && ageYrs <= 14 && createAutonomousAccess) {
      response.activation_message =
        "Partagez ce code avec votre enfant pour qu'il puisse activer son accès autonome";
    }

    response.child_account_created = childAccountCreated;
    res.status(201).json(response);
  } catch (err) {
    console.error('POST /families/children:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/families/children ──────────────────────────────

router.get('/children', requireAuth, async (req: AuthRequest, res: Response) => {
  const userId = req.user!.id;

  try {
    const family = await queryOne<{ id: string }>(
      `SELECT id FROM families
       WHERE parent_a_id = $1 OR parent_b_id = $1`,
      [userId]
    );

    if (!family) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    const children = await query<{
      id: string;
      first_name: string;
      birth_date: string;
      calendar_color: string;
      calendar_color_text: string;
      family_access_code: string | null;
      user_id: string | null;
    }>(
      `SELECT id, first_name, birth_date,
              calendar_color, calendar_color_text, family_access_code,
              user_id
       FROM children
       WHERE family_id = $1
       ORDER BY birth_date`,
      [family.id]
    );

    // Ajouter l'âge calculé à chaque enfant
    const enriched = children.map(c => ({
      ...c,
      age: c.birth_date ? computeAge(c.birth_date) : null,
    }));

    res.json(enriched);
  } catch (err) {
    console.error('GET /families/children:', err);
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
      created_at: string;
    }>(
      `SELECT id, name, parent_a_id, parent_b_id, created_at
       FROM families
       WHERE parent_a_id = $1 OR parent_b_id = $1`,
      [userId]
    );

    if (!family) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    const parentIds = [family.parent_a_id, family.parent_b_id].filter(Boolean);
    const parents = await query<{
      id: string;
      first_name: string;
      last_name: string;
      phone: string;
    }>(
      `SELECT id, first_name, last_name, phone
       FROM users WHERE id = $1 OR id = $2`,
      [family.parent_a_id, family.parent_b_id ?? '00000000-0000-0000-0000-000000000000']
    );

    const parentA = parents.find((p) => p.id === family.parent_a_id) ?? null;
    const parentB = parents.find((p) => p.id === family.parent_b_id) ?? null;

    const children = await query<{
      id: string;
      first_name: string;
      birth_date: string;
      calendar_color: string;
      calendar_color_text: string;
      family_access_code: string | null;
    }>(
      `SELECT id, first_name, birth_date,
              calendar_color, calendar_color_text, family_access_code
       FROM children
       WHERE family_id = $1
       ORDER BY birth_date`,
      [family.id]
    );

    const enrichedChildren = children.map(c => ({
      ...c,
      age: c.birth_date ? computeAge(c.birth_date) : null,
    }));

    res.json({ family, parentA, parentB, children: enrichedChildren });
  } catch (err) {
    console.error('GET /families/me:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
