import { Router, Request, Response, NextFunction } from 'express';
import { execSync } from 'child_process';
import path          from 'path';

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

      const output = execSync(`bash "${scriptPath}"`, {
        encoding: 'utf-8',
        timeout: 120_000, // 2 minutes max pour un backup
        env: {
          ...process.env,
          // S'assurer que les vars DB sont passées
          DATABASE_URL: process.env.DATABASE_URL ?? '',
        },
      });

      const lines = output.trim().split('\n');
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
