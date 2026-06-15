import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z }  from 'zod';

import { query, queryOne } from '../lib/database';
import { signAuthToken, signVerifyEmailToken, verifyEmailToken } from '../lib/jwt';
import { loginTracker } from '../lib/rateLimit';
import { sendEmailVerification } from '../lib/mailer';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { UserRow, toPublicUser } from '../types';

const router = Router();

const BCRYPT_ROUNDS = 14;

// ─── Schémas Zod ──────────────────────────────────────────────

const RegisterSchema = z.object({
  firstName:     z.string().min(1).max(100).trim(),
  lastName:      z.string().min(1).max(100).trim(),
  email:         z.string().email('Email invalide').transform((v) => v.toLowerCase().trim()),
  phone:         z.string().max(20).trim().optional(),
  address:       z.string().max(500).trim().optional(),
  birthDate:     z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format attendu : YYYY-MM-DD')
    .optional(),
  role:          z.enum(['parent', 'child', 'solo']),
  parentType:    z.enum(['papa', 'maman', 'beau-pere', 'belle-mere']).optional(),
  status:        z.enum(['separated', 'divorced']).optional(),
  childrenCount: z.number().int().min(0).max(20).default(0),
  pin:           z
    .string()
    .length(6, 'Le PIN doit comporter exactement 6 chiffres')
    .regex(/^\d{6}$/, 'Le PIN doit être composé de 6 chiffres uniquement'),
  language:      z.string().max(5).default('fr'),
  // Consentements RGPD (envoyés depuis step5)
  consentCgu:          z.boolean(),
  consentData:         z.boolean(),
  consentChildren:     z.boolean(),
  consentNewsletter:   z.boolean().default(false),
});

const LoginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  pin:   z.string().length(6).regex(/^\d{6}$/),
});

const VerifyEmailSchema = z.object({
  token: z.string().min(1),
});

const UpdatePinSchema = z.object({
  currentPin: z
    .string()
    .length(6)
    .regex(/^\d{6}$/, 'PIN actuel invalide'),
  newPin: z
    .string()
    .length(6, 'Le nouveau PIN doit comporter exactement 6 chiffres')
    .regex(/^\d{6}$/, 'Le nouveau PIN doit être composé de 6 chiffres uniquement'),
});

// ─── POST /api/auth/register ──────────────────────────────────

router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const parsed = RegisterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error:  'Données invalides',
      fields: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const {
    firstName, lastName, email, phone, address,
    birthDate, role, parentType, status,
    childrenCount, pin, language,
    consentCgu, consentData, consentChildren, consentNewsletter,
  } = parsed.data;

  try {
    // Vérifier si l'email est déjà pris (AVANT de hasher le PIN)
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );
    if (existing) {
      res.status(409).json({ error: 'Cet email est déjà utilisé' });
      return;
    }

    // Hasher le PIN — jamais loggé, jamais retourné
    const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);

    // Transaction : créer utilisateur + consentements + famille en UNE requête CTE
    const rows = await query<UserRow & { family_id: string; family_name: string; family_status: string }>(
      `WITH ins_user AS (
         INSERT INTO users
           (first_name, last_name, email, phone, address, birth_date,
            role, parent_type, status, children_count,
            pin_hash, language)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING *
       ),
       _consent AS (
         INSERT INTO consents
           (user_id, cgu_accepted, data_processing_accepted,
            children_data_accepted, newsletter_accepted, ip_address)
           SELECT ins_user.id, $13, $14, $15, $16, $17
           FROM ins_user
       ),
       ins_family AS (
         INSERT INTO families (name, parent_a_id, status)
         SELECT 'Famille de ' || ins_user.first_name, ins_user.id, 'solo'
         FROM ins_user
         RETURNING id AS family_id, name AS family_name, status AS family_status
       )
       SELECT ins_user.*, ins_family.family_id, ins_family.family_name, ins_family.family_status
       FROM ins_user, ins_family`,
      [
        firstName, lastName, email,
        phone     ?? null,
        address   ?? null,
        birthDate ?? null,
        role,
        parentType ?? null,
        status     ?? null,
        childrenCount,
        pinHash,
        language,
        consentCgu, consentData, consentChildren, consentNewsletter,
        req.ip ?? null,
      ]
    );

    const user = rows[0]!;
    const family = { id: rows[0]!.family_id, name: rows[0]!.family_name, status: rows[0]!.family_status };

    // Générer le token de vérification email et l'envoyer
    const verifyToken = signVerifyEmailToken(user.id, user.email);
    // Ne pas await pour ne pas bloquer la réponse
    sendEmailVerification(user.email, user.first_name, verifyToken).catch((err) => {
      console.error('[AUTH] Échec envoi email vérification :', err.message);
      if (process.env.NODE_ENV === 'production') {
        console.warn('[AUTH] SMTP non configuré ? L\'utilisateur devra contacter le support pour vérifier son email.');
      }
    });

    // Générer le JWT d'auth (30 jours)
    const token = signAuthToken({ userId: user.id, email: user.email, role: user.role });

    // ⚠️ Le PIN en clair est maintenant hors scope — on ne le logue jamais
    res.status(201).json({ user: toPublicUser(user), family, token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[AUTH] register :', message);
    res.status(500).json({ error: 'Erreur serveur lors de la création du compte' });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────

router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email ou PIN invalide' });
    return;
  }

  const { email, pin } = parsed.data;

  // Vérifier le blocage AVANT toute requête DB
  if (loginTracker.isBlocked(email)) {
    const remaining = Math.ceil(loginTracker.remainingMs(email) / 60_000);
    res.status(429).json({
      error: `Trop de tentatives. Réessayez dans ${remaining} minute${remaining > 1 ? 's' : ''}.`,
      retryAfterMinutes: remaining,
    });
    return;
  }

  try {
    const user = await queryOne<UserRow>(
      'SELECT id, first_name, last_name, email, phone, address, birth_date, role, parent_type, status, children_count, pin_hash, push_token, onboarding_completed, language, theme_id, calendar_color, calendar_color_text, email_verified, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );
    // Délai constant pour éviter le timing attack
    // (comparer même si l'utilisateur n'existe pas)
    const DUMMY_HASH = bcrypt.hashSync('dummy-pin-placeholder', BCRYPT_ROUNDS);
    const hashToCompare = user?.pin_hash ?? DUMMY_HASH;

    const valid = await bcrypt.compare(pin, hashToCompare);

    if (!user || !valid) {
      loginTracker.recordFailure(email);
      const attempts = loginTracker.attemptsCount(email);
      const remaining = MAX_ATTEMPTS - attempts;

      if (loginTracker.isBlocked(email)) {
        res.status(429).json({
          error: 'Compte temporairement bloqué pour 15 minutes.',
          retryAfterMinutes: 15,
        });
      } else {
        res.status(401).json({
          error: `Email ou PIN incorrect. ${remaining} tentative${remaining > 1 ? 's' : ''} restante${remaining > 1 ? 's' : ''}.`,
        });
      }
      return;
    }

    // Connexion réussie — réinitialiser le compteur
    loginTracker.reset(email);

    const token = signAuthToken({ userId: user.id, email: user.email, role: user.role });
    res.json({ user: toPublicUser(user), token });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[AUTH] login :', message);
    res.status(500).json({ error: 'Erreur serveur lors de la connexion' });
  }
});

const MAX_ATTEMPTS = 5; // miroir de rateLimit.ts pour les messages

// ─── POST /api/auth/verify-email ──────────────────────────────

router.post('/verify-email', async (req: Request, res: Response): Promise<void> => {
  const parsed = VerifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Token manquant' });
    return;
  }

  try {
    const payload = verifyEmailToken(parsed.data.token);

    await queryOne(
      `UPDATE users
       SET email_verified = TRUE, updated_at = NOW()
       WHERE id = $1 AND email = $2`,
      [payload.userId, payload.email]
    );

    res.json({ success: true, message: 'Email vérifié avec succès' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('expired') || message.includes('invalid')) {
      res.status(400).json({ error: 'Lien de vérification invalide ou expiré' });
    } else {
      console.error('[AUTH] verify-email :', message);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
});


// ─── POST /api/auth/resend-verification ───────────────────────

const ResendVerificationSchema = z.object({
  email: z.string().email('Email invalide').transform((v) => v.toLowerCase().trim()),
});

router.post('/resend-verification', async (req: Request, res: Response): Promise<void> => {
  const parsed = ResendVerificationSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Email invalide' });
    return;
  }

  const { email } = parsed.data;

  try {
    const user = await queryOne<UserRow>(
      'SELECT id, first_name, last_name, email, role, email_verified, created_at, updated_at FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      // Ne pas révéler si l'email existe ou pas (sécurité)
      res.json({ success: true, message: 'Si cet email existe, un nouveau lien de vérification a été envoyé.' });
      return;
    }

    if (user.email_verified) {
      res.json({ success: true, message: 'Cet email est déjà vérifié.' });
      return;
    }

    // Générer un nouveau token et l'envoyer
    const verifyToken = signVerifyEmailToken(user.id, user.email);
    sendEmailVerification(user.email, user.first_name, verifyToken).catch((err) =>
      console.error('[AUTH] Échec envoi email vérification :', err.message)
    );

    res.json({ success: true, message: 'Si cet email existe, un nouveau lien de vérification a été envoyé.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[AUTH] resend-verification :', message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────


router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await queryOne<UserRow>(
      'SELECT id, first_name, last_name, email, phone, address, birth_date, role, parent_type, status, children_count, push_token, onboarding_completed, language, theme_id, calendar_color, calendar_color_text, email_verified, created_at, updated_at FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }

    res.json({ user: toPublicUser(user) });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[AUTH] me :', message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ─── PUT /api/auth/update-pin ─────────────────────────────────

router.put('/update-pin', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  const parsed = UpdatePinSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error:  'Données invalides',
      fields: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { currentPin, newPin } = parsed.data;

  try {
    const user = await queryOne<{ id: string; pin_hash: string }>(
      'SELECT id, pin_hash FROM users WHERE id = $1',
      [req.user!.id]
    );

    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }

    // Vérifier l'ancien PIN
    const valid = await bcrypt.compare(currentPin, user.pin_hash);
    if (!valid) {
      res.status(401).json({ error: 'PIN actuel incorrect' });
      return;
    }

    // Vérifier que le nouveau PIN est différent
    const samePin = await bcrypt.compare(newPin, user.pin_hash);
    if (samePin) {
      res.status(400).json({ error: "Le nouveau PIN doit être différent de l'ancien" });
      return;
    }

    // Hasher et enregistrer le nouveau PIN — jamais loggé
    const newPinHash = await bcrypt.hash(newPin, BCRYPT_ROUNDS);
    await queryOne(
      'UPDATE users SET pin_hash = $1, updated_at = NOW() WHERE id = $2',
      [newPinHash, user.id]
    );

    res.json({ success: true, message: 'PIN mis à jour avec succès' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erreur inconnue';
    console.error('[AUTH] update-pin :', message);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
