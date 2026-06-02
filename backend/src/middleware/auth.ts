import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken } from '../lib/jwt';

// ─── Types ────────────────────────────────────────────────────

export interface AuthUser {
  id:    string;
  email: string;
  role:  string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// ─── Middleware principal ─────────────────────────────────────

/**
 * requireAuth
 * Vérifie le Bearer JWT et attache req.user.
 * Retourne 401 si le token est absent, invalide ou expiré.
 */
export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: "Token d'authentification manquant" });
    return;
  }

  const token = header.slice(7);
  try {
    const payload = verifyAuthToken(token);
    req.user = { id: payload.userId, email: payload.email, role: payload.role };
    next();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '';
    if (message.includes('expired')) {
      res.status(401).json({ error: 'Session expirée, veuillez vous reconnecter' });
    } else {
      res.status(401).json({ error: 'Token invalide' });
    }
  }
}

// ─── Middleware de rôle ───────────────────────────────────────

/**
 * requireRole(...roles)
 * À utiliser après requireAuth pour restreindre l'accès par rôle.
 *
 * @example
 * router.get('/admin', requireAuth, requireRole('parent'), handler)
 */
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Non authentifié' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Accès refusé : rôle insuffisant' });
      return;
    }
    next();
  };
}
