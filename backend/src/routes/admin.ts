import { Router, Request, Response, NextFunction } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path          from 'path';

const execAsync = promisify(exec);

import { query } from '../lib/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── Middleware admin ──────────────────────────────────────────
// Vérifie la présence du header X-Admin-Key correspondant à ADMIN_API_KEY dans .env
// Cette protection empêche les accès non autorisés à des opérations sensibles.

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(503).json({ error: 'Administration non configurée (ADMIN_API_KEY manquant)' });
    return;
  }

  const providedKey = req.headers['x-admin-key'] as string | undefined;
  if (!providedKey || providedKey !== adminKey) {
    res.status(403).json({ error: 'Accès administrateur refusé' });
    return;
  }

  next();
}

// ─── GET /api/admin/backup-db ──────────────────────────────────
// Déclenche manuellement un backup de la base de données.
// Nécessite requireAuth + requireAdmin.

router.get(
  '/backup-db',
  requireAuth,
  requireAdmin,
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const scriptPath = path.resolve(__dirname, '../../scripts/backup-db.sh');

      const { stdout } = await execAsync(`bash "${scriptPath}"`, {
        timeout: 120_000, // 2 minutes max pour un backup
        env: {
          DATABASE_URL: process.env.DATABASE_URL ?? '',
          NODE_ENV: process.env.NODE_ENV ?? 'production',
          PATH: process.env.PATH,
        },
      });

      const lines = stdout.trim().split('\n');
      const lastLine = lines[lines.length - 1];

      res.json({
        success: true,
        message: 'Backup DB effectué avec succès',
        details: lines,
        backupFile: lastLine,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('[admin/backup-db] Erreur :', message);
      res.status(500).json({ error: 'Échec du backup', details: message });
    }
  }
);


// ─── POST /api/admin/cleanup-invitations ───────────────────────
// Nettoie les invitations expirées (marque comme 'expired' les invitations
// dont la date d'expiration est dépassée)

router.post(
  '/cleanup-invitations',
  requireAuth,
  requireAdmin,
  async (_req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await query(
        `UPDATE invitations
         SET status = 'expired'
         WHERE status = 'pending' AND expires_at < NOW()
         RETURNING id`,
      );

      res.json({
        success: true,
        cleanedCount: result.length,
        message: `${result.length} invitation(s) expirée(s) nettoyée(s)`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      console.error('[admin/cleanup-invitations] Erreur :', message);
      res.status(500).json({ error: 'Échec du nettoyage', details: message });
    }
  }
);

// ─── GET /api/admin/health ─────────────────────────────────────
// Health check étendu (admin uniquement)

router.get(
  '/health',
  requireAuth,
  requireAdmin,
  async (_req: AuthRequest, res: Response): Promise<void> => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      node: process.version,
      timestamp: new Date().toISOString(),
    });
  }
);

export default router;
