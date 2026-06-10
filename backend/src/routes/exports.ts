import { Router, Response } from 'express';
import PDFDocument from 'pdfkit';

import { query, queryOne } from '../lib/database';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// ─── Helpers ───────────────────────────────────────────────────

/**
 * Récupère l'ID de la famille de l'utilisateur.
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

/**
 * Calcule les dates de début et fin du mois en cours (YYYY-MM).
 */
function getMonthRange(
  year: number,
  month: number
): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  // Dernier jour du mois
  const end = new Date(year, month, 0).toISOString().slice(0, 10);
  return { start, end };
}

// ─── GET /api/exports/expenses/csv ─────────────────────────────
/**
 * Exporte les dépenses du mois en cours au format CSV.
 * Query params optionnels : ?year=2026&month=6 (1-indexé)
 */
router.get(
  '/expenses/csv',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const familyId = await getFamilyId(userId);
    if (!familyId) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    const now = new Date();
    const year = parseInt(req.query.year as string, 10) || now.getFullYear();
    const month = parseInt(req.query.month as string, 10) || now.getMonth() + 1;
    const { start, end } = getMonthRange(year, month);

    const rows = await query<{
      expense_date: string;
      title: string;
      category: string;
      amount: string;
      payer_first_name: string;
    }>(
      `SELECT e.expense_date, e.title, e.category, e.amount,
              u.first_name AS payer_first_name
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       WHERE e.family_id = $1
         AND e.expense_date >= $2
         AND e.expense_date <= $3
       ORDER BY e.expense_date ASC`,
      [familyId, start, end]
    );

    // En-têtes CSV (séparateur point-virgule)
    const csvHeader = 'Date;Titre;Catégorie;Montant;Payé par\n';
    const csvRows = rows
      .map(
        (r) =>
          `${r.expense_date};${r.title};${r.category};${r.amount};${r.payer_first_name}`
      )
      .join('\n');

    // Calcul du total
    const total = rows.reduce(
      (sum, r) => sum + parseFloat(r.amount),
      0
    );
    const csvTotal = `\nTotal;${total.toFixed(2).replace('.', ',')}\n`;

    const csvContent = csvHeader + csvRows + csvTotal;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="depenses-${year}-${String(month).padStart(2, '0')}.csv"`
    );
    // BOM UTF-8 pour Excel
    res.send('\uFEFF' + csvContent);
  }
);

// ─── GET /api/exports/expenses/pdf ─────────────────────────────
/**
 * Exporte les dépenses du mois en cours au format PDF.
 * Utilise pdfkit pour générer un rapport simple.
 */
router.get(
  '/expenses/pdf',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user!.id;

    const familyId = await getFamilyId(userId);
    if (!familyId) {
      res.status(404).json({ error: 'Aucune famille trouvée' });
      return;
    }

    const now = new Date();
    const year = parseInt(req.query.year as string, 10) || now.getFullYear();
    const month = parseInt(req.query.month as string, 10) || now.getMonth() + 1;
    const { start, end } = getMonthRange(year, month);

    const rows = await query<{
      expense_date: string;
      title: string;
      category: string;
      amount: string;
      payer_first_name: string;
    }>(
      `SELECT e.expense_date, e.title, e.category, e.amount,
              u.first_name AS payer_first_name
       FROM expenses e
       JOIN users u ON u.id = e.paid_by
       WHERE e.family_id = $1
         AND e.expense_date >= $2
         AND e.expense_date <= $3
       ORDER BY e.expense_date ASC`,
      [familyId, start, end]
    );

    // ── Génération du PDF ───────────────────────────────────
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Sérénité - Relevé de dépenses ${year}-${String(month).padStart(2, '0')}`,
        Author: 'Sérénité App',
      },
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="depenses-${year}-${String(month).padStart(2, '0')}.pdf"`
    );

    doc.pipe(res);

    // En-tête
    doc.fontSize(22).font('Helvetica-Bold').text('Sérénité - Relevé de dépenses', { align: 'center' });
    doc.moveDown(0.3);
    const monthNames = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ];
    doc.fontSize(14).font('Helvetica').text(
      `${monthNames[month - 1]} ${year}`,
      { align: 'center' }
    );
    doc.moveDown(1);

    // En-tête du tableau
    const tableTop = doc.y;
    const colX = [50, 140, 280, 370, 440];
    const colWidths = [80, 130, 80, 65, 100];

    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Date', colX[0], tableTop, { width: colWidths[0] });
    doc.text('Titre', colX[1], tableTop, { width: colWidths[1] });
    doc.text('Catégorie', colX[2], tableTop, { width: colWidths[2] });
    doc.text('Montant', colX[3], tableTop, { width: colWidths[3] });
    doc.text('Payé par', colX[4], tableTop, { width: colWidths[4] });

    // Ligne de séparation
    const lineY = doc.y + 4;
    doc.moveTo(50, lineY).lineTo(540, lineY).stroke();
    doc.moveDown(0.5);

    // Lignes de données
    doc.fontSize(9).font('Helvetica');
    let totalAmount = 0;

    for (const row of rows) {
      const y = doc.y;

      // Saut de page si nécessaire
      if (y > 700) {
        doc.addPage();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Date', colX[0], 50, { width: colWidths[0] });
        doc.text('Titre', colX[1], 50, { width: colWidths[1] });
        doc.text('Catégorie', colX[2], 50, { width: colWidths[2] });
        doc.text('Montant', colX[3], 50, { width: colWidths[3] });
        doc.text('Payé par', colX[4], 50, { width: colWidths[4] });
        const sepLine = 74;
        doc.moveTo(50, sepLine).lineTo(540, sepLine).stroke();
        doc.y = sepLine + 10;
        doc.fontSize(9).font('Helvetica');
      }

      const currentY = doc.y;
      const formattedDate = row.expense_date.slice(0, 10);
      const amount = parseFloat(row.amount);
      totalAmount += amount;

      doc.text(formattedDate, colX[0], currentY, { width: colWidths[0] });
      doc.text(row.title, colX[1], currentY, { width: colWidths[1] });
      doc.text(row.category, colX[2], currentY, { width: colWidths[2] });
      doc.text(`${amount.toFixed(2)} €`, colX[3], currentY, { width: colWidths[3] });
      doc.text(row.payer_first_name, colX[4], currentY, { width: colWidths[4] });
      doc.moveDown(0.4);
    }

    // Ligne de séparation avant total
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(540, doc.y).stroke();
    doc.moveDown(0.5);

    // Total
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text(`Total : ${totalAmount.toFixed(2)} €`, { align: 'right' });

    doc.end();
  }
);

export default router;
