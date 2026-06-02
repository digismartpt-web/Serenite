import { Router, Response } from 'express';

import { query, queryOne } from '../lib/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── Ressources multilingues ──────────────────────────────────

const RESOURCES = {
  fr: {
    emergency: [
      { name: "Allô Enfance en Danger", phone: "119", description: "Protection de l'enfance" },
      { name: "Violences Femmes Info", phone: "3919", description: "Violences conjugales" },
      { name: "SOS Amitié", phone: "09 72 39 40 50", description: "Écoute psychologique" },
      { name: "Numéro Vert Maltraitance", phone: "119", description: "Signalement maltraitance" },
    ],
    mediators: [
      { name: "Union des Médiateurs Familiaux", phone: "01 48 06 50 00", website: "https://www.mediationfamiliale.org" },
      { name: "Fédération Nationale des Médiateurs", phone: "01 47 70 18 11", website: "https://www.mediation-familiale.org" },
      { name: "Chambre Professionnelle de la Médiation Familiale", phone: "01 44 52 26 30", website: "https://www.cpmf-mediation.com" },
    ],
    resources: [
      { name: "Info Médiation Familiale", website: "https://www.mediationfamiliale.org" },
      { name: "Service Public - Médiation", website: "https://www.service-public.fr/mediation" },
    ]
  },
  es: {
    emergency: [
      { name: "Teléfono de la Esperanza", phone: "717 003 717", description: "Apoyo psicológico" },
      { name: "Violencia de Género", phone: "016", description: "Violencia machista" },
    ],
    mediators: [
      { name: "Asociación Española de Mediación", website: "https://www.asociacionmediacion.es" },
    ],
    resources: []
  },
  pt: {
    emergency: [
      { name: "SOS Criança", phone: "116 111", description: "Apoio à criança" },
      { name: "SOS Violência Doméstica", phone: "800 202 148", description: "Violência doméstica" },
    ],
    mediators: [],
    resources: []
  },
  en: {
    emergency: [
      { name: "Childline", phone: "0800 1111", description: "Child protection" },
      { name: "National Domestic Abuse Helpline", phone: "0808 2000 247", description: "Domestic abuse" },
      { name: "Samaritans", phone: "116 123", description: "Emotional support" },
    ],
    mediators: [
      { name: "UK College of Family Mediators", website: "https://www.familymediationcouncil.org.uk" },
    ],
    resources: []
  }
};

// ─── GET /api/mediators — Ressources d'urgence et annuaire ───

router.get('/', (_req, res: Response) => {
  res.json(RESOURCES);
});

// ─── GET /api/mediators/prepare-report/:familyId — Résumé pré-médiation ──

router.get(
  '/prepare-report/:familyId',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const { familyId } = req.params;
    const userId = req.user!.id;

    // Vérifier l'appartenance à la famille
    const member = await queryOne<{ id: string }>(
      `SELECT id FROM families
       WHERE id = $1 AND (parent_a_id = $2 OR parent_b_id = $2)`,
      [familyId, userId]
    );
    if (!member) {
      res.status(403).json({ error: 'Accès refusé à cette famille' });
      return;
    }

    // 1. Récupérer les 30 derniers messages
    const messages = await query<{
      id: string; sender_id: string; content: string;
      original_content: string | null; is_reformulated: boolean;
      aggressiveness_score: string | null; created_at: string;
      sender_first_name: string;
    }>(
      `SELECT
         m.id, m.sender_id, m.content, m.original_content,
         m.is_reformulated, m.aggressiveness_score,
         m.created_at,
         u.first_name AS sender_first_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.family_id = $1
       ORDER BY m.created_at DESC
       LIMIT 30`,
      [familyId]
    );

    // 2. Récupérer les dépenses en attente (non validées)
    const pendingExpenses = await query<{
      id: string; title: string; amount: string;
      category: string; expense_date: string; paid_by: string;
      payer_first_name: string; created_at: string;
    }>(
      `SELECT
         e.id, e.title, e.amount, e.category,
         e.expense_date, e.paid_by,
         u.first_name AS payer_first_name,
         e.created_at
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       WHERE e.family_id = $1 AND e.validated_by IS NULL
       ORDER BY e.created_at DESC`,
      [familyId]
    );

    // 3. Récupérer les demandes d'échange en cours
    const pendingExchanges = await query<{
      id: string; requested_by: string; event_id: string;
      reason: string | null; proposed_date: string | null;
      status: string; created_at: string; requester_first_name: string;
    }>(
      `SELECT
         er.id, er.requested_by, er.event_id,
         er.reason, er.proposed_date, er.status,
         er.created_at,
         u.first_name AS requester_first_name
       FROM exchange_requests er
       JOIN users u ON u.id = er.requested_by
       WHERE er.family_id = $1 AND er.status = 'pending'
       ORDER BY er.created_at DESC`,
      [familyId]
    );

    // 4. Calculer un résumé textuel
    const messageCount = messages.length;
    const pendingExpenseCount = pendingExpenses.length;
    const pendingExchangeCount = pendingExchanges.length;

    const summaryParts: string[] = [];
    summaryParts.push(`${messageCount} messages échangés récemment.`);

    if (pendingExpenseCount > 0) {
      const totalAmount = pendingExpenses.reduce(
        (sum, e) => sum + parseFloat(e.amount),
        0
      );
      summaryParts.push(
        `${pendingExpenseCount} dépense${pendingExpenseCount > 1 ? 's' : ''} en attente de validation (total : ${totalAmount.toFixed(2)} €).`
      );
    } else {
      summaryParts.push('Aucune dépense en attente.');
    }

    if (pendingExchangeCount > 0) {
      summaryParts.push(
        `${pendingExchangeCount} demande${pendingExchangeCount > 1 ? 's' : ''} d'échange de garde en cours.`
      );
    } else {
      summaryParts.push('Aucune demande d\'échange en cours.');
    }

    const summary = summaryParts.join(' ');

    res.json({
      summary,
      messageCount,
      pendingExpenses,
      pendingExchanges,
      messages: messages.reverse(), // du plus ancien au plus récent
    });
  }
);

export default router;
