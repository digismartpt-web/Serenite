import jwt from 'jsonwebtoken';

// ─── Types ────────────────────────────────────────────────────

export interface JwtPayload {
  userId: string;
  email:  string;
  role:   string;
}

export interface VerifyEmailPayload {
  userId:  string;
  email:   string;
  purpose: 'email-verification';
}

export interface PinResetPayload {
  userId:   string;
  codeHash: string;
  purpose:  'pin-reset';
}

// ─── Helpers ──────────────────────────────────────────────────

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('[JWT] JWT_SECRET non défini');
  return s;
}

/**
 * Génère un JWT d'authentification (30 jours par défaut).
 * Le payload ne contient jamais de données sensibles (pas de PIN, pas de hash).
 */
export function signAuthToken(payload: JwtPayload): string {
  return jwt.sign(payload, secret(), {
    expiresIn: (process.env.JWT_EXPIRES_IN ?? '30d') as jwt.SignOptions['expiresIn'],
    issuer:    'serenite-api',
    audience:  'serenite-app',
  });
}

/**
 * Génère un JWT de vérification d'email (1 heure).
 * Évite de stocker un token en base de données.
 */
export function signVerifyEmailToken(userId: string, email: string): string {
  const payload: VerifyEmailPayload = { userId, email, purpose: 'email-verification' };
  return jwt.sign(payload, secret(), {
    expiresIn: '1h',
    issuer:    'serenite-api',
    audience:  'serenite-verify',
  });
}

/**
 * Génère un JWT de réinitialisation de PIN (15 minutes).
 * Contient le hash du code à 6 chiffres — le code en clair n'est jamais stocké.
 */
export function signPinResetToken(userId: string, codeHash: string): string {
  const payload: PinResetPayload = { userId, codeHash, purpose: 'pin-reset' };
  return jwt.sign(payload, secret(), {
    expiresIn: '15m',
    issuer:    'serenite-api',
    audience:  'serenite-pin-reset',
  });
}

/** Vérifie et décode un JWT d'authentification. */
export function verifyAuthToken(token: string): JwtPayload {
  return jwt.verify(token, secret(), {
    issuer:   'serenite-api',
    audience: 'serenite-app',
  }) as JwtPayload;
}

/** Vérifie et décode un JWT de vérification d'email. */
export function verifyEmailToken(token: string): VerifyEmailPayload {
  const payload = jwt.verify(token, secret(), {
    issuer:   'serenite-api',
    audience: 'serenite-verify',
  }) as VerifyEmailPayload;

  if (payload.purpose !== 'email-verification') {
    throw new Error('Token invalide : mauvais usage');
  }
  return payload;
}

/** Vérifie et décode un JWT de réinitialisation de PIN. */
export function verifyPinResetToken(token: string): PinResetPayload {
  const payload = jwt.verify(token, secret(), {
    issuer:   'serenite-api',
    audience: 'serenite-pin-reset',
  }) as PinResetPayload;

  if (payload.purpose !== 'pin-reset') {
    throw new Error('Token invalide : mauvais usage');
  }
  return payload;
}
