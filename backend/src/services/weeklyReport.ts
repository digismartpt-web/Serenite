import { query, queryOne } from '../lib/database';

// ─── Types ────────────────────────────────────────────────────

export interface WeeklyReport {
  familyId:      string;
  userId:        string;
  weekStart:     string;   // ISO date (Monday)
  weekEnd:       string;   // ISO date (Sunday)
  messageCount:  number;
  serenityScore: number;   // 0..1, 1 = très serein
  validatedExpenses: Array<{ title: string; amount: number; category: string }>;
  totalExpensesAmount: number;
  upcomingEvents: Array<{ title: string; date: string }>;
  summary:       string;   // Texte formaté pour notification
}

// ─── Service ──────────────────────────────────────────────────

export async function generateWeeklyReport(
  familyId: string,
  userId: string
): Promise<WeeklyReport> {
  // Définir la semaine courante (lundi → dimanche)
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0 = dimanche, 1 = lundi …
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(now);
  monday.setDate(now.getDate() + mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  const weekStart = monday.toISOString();
  const weekEnd   = sunday.toISOString();

  // ── Compter les messages de la semaine ─────────────────────
  const msgCount = await queryOne<{ count: string }>(
    `SELECT COUNT(*) AS count
     FROM messages
     WHERE family_id = $1
       AND created_at >= $2
       AND created_at <= $3`,
    [familyId, weekStart, weekEnd]
  );
  const messageCount = parseInt(msgCount?.count ?? '0', 10);

  // ── Score de sérénité moyen (inversé depuis aggressiveness) ─
  const scoreRow = await queryOne<{ avg_aggressiveness: string | null }>(
    `SELECT AVG(aggressiveness_score::numeric) AS avg_aggressiveness
     FROM messages
     WHERE family_id = $1
       AND aggressiveness_score IS NOT NULL
       AND created_at >= $2
       AND created_at <= $3`,
    [familyId, weekStart, weekEnd]
  );
  const avgAggressiveness = scoreRow?.avg_aggressiveness
    ? parseFloat(scoreRow.avg_aggressiveness)
    : 0;
  const serenityScore = parseFloat(
    Math.max(0, Math.min(1, 1 - avgAggressiveness)).toFixed(2)
  );

  // ── Dépenses validées de la semaine ────────────────────────
  const expenses = await query<{
    title: string; amount: string; category: string;
  }>(
    `SELECT title, amount, category
     FROM expenses
     WHERE family_id = $1
       AND validated_by IS NOT NULL
       AND expense_date >= $2
       AND expense_date <= $3
     ORDER BY expense_date DESC`,
    [familyId, weekStart, weekEnd]
  );

  const validatedExpenses = expenses.map((e) => ({
    title: e.title,
    amount: parseFloat(e.amount),
    category: e.category,
  }));

  const totalExpensesAmount = validatedExpenses.reduce((sum, e) => sum + e.amount, 0);

  // ── Prochains événements (transition de garde) ─────────────
  const events = await query<{ title: string; start_at: string }>(
    `SELECT title, start_at
     FROM events
     WHERE family_id = $1
       AND start_at >= $2
     ORDER BY start_at ASC
     LIMIT 5`,
    [familyId, weekEnd] // À partir de la fin de la semaine
  );

  const upcomingEvents = events.map((e) => ({
    title: e.title,
    date: new Date(e.start_at).toLocaleDateString('fr-FR', {
      weekday: 'long', day: 'numeric', month: 'long',
    }),
  }));

  // ── Générer le texte formaté ───────────────────────────────
  const summaryLines: string[] = [
    `📊 Résumé de votre semaine du ${monday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au ${sunday.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`,
    '',
  ];

  // Messages
  summaryLines.push(`💬 Messages échangés : ${messageCount}`);
  const serenityLabel =
    serenityScore >= 0.8 ? '🟢 Très serein' :
    serenityScore >= 0.6 ? '🟡 Calme' :
    serenityScore >= 0.4 ? '🟠 Tendu' :
                           '🔴 Très tendu';
  summaryLines.push(`🧘 Sérénité : ${serenityLabel} (${Math.round(serenityScore * 100)}%)`);

  // Dépenses
  if (validatedExpenses.length > 0) {
    summaryLines.push('');
    summaryLines.push(`💰 Dépenses validées : ${validatedExpenses.length} (${totalExpensesAmount.toFixed(2)} €)`);
    for (const exp of validatedExpenses.slice(0, 5)) {
      summaryLines.push(`  • ${exp.title} : ${exp.amount.toFixed(2)} €`);
    }
  } else {
    summaryLines.push('');
    summaryLines.push('💰 Aucune dépense validée cette semaine');
  }

  // Événements à venir
  if (upcomingEvents.length > 0) {
    summaryLines.push('');
    summaryLines.push('📅 Prochains événements :');
    for (const ev of upcomingEvents) {
      summaryLines.push(`  • ${ev.date} — ${ev.title}`);
    }
  } else {
    summaryLines.push('');
    summaryLines.push('📅 Aucun événement à venir');
  }

  summaryLines.push('');
  summaryLines.push('💡 Passez une excellente semaine !');

  return {
    familyId,
    userId,
    weekStart,
    weekEnd,
    messageCount,
    serenityScore,
    validatedExpenses,
    totalExpensesAmount,
    upcomingEvents,
    summary: summaryLines.join('\n'),
  };
}
