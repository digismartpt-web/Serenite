import { Router, Response } from 'express';
import { z }                from 'zod';

import { queryOne }                     from '../lib/database';
import { requireAuth, AuthRequest }     from '../middleware/auth';
import { sendPushNotification }         from '../utils/notifications';
import { generateWeeklyReport }         from '../services/weeklyReport';

const router = Router();

// ─── POST /api/notifications/weekly-report ────────────────────
// Génère et envoie le récapitulatif hebdomadaire par notification push.
// Le cron sera configuré par Hermes (exécution chaque dimanche soir).

const WeeklyReportSchema = z.object({
  familyId: z.string().uuid(),
  userId:   z.string().uuid(),
});

router.post(
  '/weekly-report',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = WeeklyReportSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Données invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { familyId, userId } = parsed.data;

    // Vérifier que l'utilisateur appartient à la famille
    const member = await queryOne<{ id: string }>(
      `SELECT id FROM families
       WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
      [familyId, userId]
    );
    if (!member) {
      res.status(403).json({ error: 'Accès refusé à cette famille' });
      return;
    }

    // Générer le rapport
    const report = await generateWeeklyReport(familyId, userId);

    // Récupérer le push_token de l'utilisateur
    const user = await queryOne<{ push_token: string | null }>(
      `SELECT push_token FROM users WHERE id = $1`,
      [userId]
    );

    if (user?.push_token) {
      await sendPushNotification(
        user.push_token,
        '📊 Résumé hebdomadaire',
        `${report.messageCount} messages • Sérénité ${Math.round(report.serenityScore * 100)}% • ${report.validatedExpenses.length} dépenses`,
        { screen: 'home', familyId, report: true }
      );
    }

    res.json({
      sent: !!user?.push_token,
      report: {
        weekStart: report.weekStart,
        weekEnd:   report.weekEnd,
        messageCount: report.messageCount,
        serenityScore: report.serenityScore,
        validatedExpenses: report.validatedExpenses.length,
        upcomingEvents: report.upcomingEvents.length,
      },
      summary: report.summary,
    });
  }
);

export default router;
