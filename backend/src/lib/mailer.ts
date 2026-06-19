/**
 * Service d'envoi d'emails.
 *
 * En développement : affiche les URLs dans les logs (pas d'envoi réel).
 * En production    : brancher un provider dans sendMail() ci-dessous.
 *
 * Providers recommandés :
 *   - Resend        : npm i resend
 *   - Nodemailer    : npm i nodemailer @types/nodemailer
 *   - SendGrid      : npm i @sendgrid/mail
 */

const FROM    = process.env.MAIL_FROM    ?? 'noreply@serenite.app';
const APP_URL = process.env.APP_URL      ?? 'https://serenite.newappai.com';
const IS_PROD = process.env.NODE_ENV     === 'production';

// ─── Échappement HTML ─────────────────────────────────────────
/** Échappe les caractères HTML dangereux pour prévenir XSS. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Interface interne ────────────────────────────────────────

interface MailPayload {
  to:      string;
  subject: string;
  html:    string;
  text:    string;
}

/**
 * Fonction d'envoi bas niveau.
 * Remplacez le corps de cette fonction par votre provider réel.
 */
async function sendMail(payload: MailPayload): Promise<void> {
  if (!IS_PROD) {
    // En développement : juste un log (le PIN n'est jamais passé ici)
    console.log(
      `[MAIL DEV] À: ${payload.to} | Sujet: ${payload.subject}\n` +
      `  ${payload.text.slice(0, 200)}`
    );
    return;
  }

  // ── RESEND (exemple) ──────────────────────────────────────
  // import { Resend } from 'resend';
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({ from: FROM, ...payload });

  // ── NODEMAILER (exemple) ──────────────────────────────────
  // const transporter = nodemailer.createTransport({
  //   host: process.env.SMTP_HOST, port: 587,
  //   auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  // });
  // await transporter.sendMail({ from: FROM, ...payload });

  throw new Error('[MAIL] Aucun provider configuré pour la production');
}

// ─── Fonctions publiques ──────────────────────────────────────

/** Envoie le lien de vérification d'adresse email. */
export async function sendEmailVerification(
  to: string,
  firstName: string,
  verifyToken: string
): Promise<void> {
  const url = `${APP_URL}/verify-email?token=${verifyToken}`;

  await sendMail({
    to,
    subject: 'Vérifiez votre adresse email – Sérénité',
    text: `Bonjour ${firstName},\n\nCliquez sur ce lien pour vérifier votre adresse :\n${url}\n\nCe lien expire dans 1 heure.\n\nL'équipe Sérénité`,
    html: `
      <p>Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
      <p>
        <a href="${url}" style="
          display:inline-block;padding:12px 24px;
          background:#1A3A5C;color:#fff;border-radius:8px;
          text-decoration:none;font-weight:700;
        ">Vérifier mon adresse email</a>
      </p>
      <p style="color:#718096;font-size:13px;">Ce lien expire dans 1 heure.</p>
    `,
  });
}

/** Envoie un email de réinitialisation de PIN (lien). */
export async function sendPinReset(
  to: string,
  firstName: string,
  resetToken: string
): Promise<void> {
  const url = `${APP_URL}/reset-pin?token=${resetToken}`;

  await sendMail({
    to,
    subject: 'Réinitialisation de votre PIN – Sérénité',
    text: `Bonjour ${firstName},\n\nCliquez sur ce lien pour réinitialiser votre PIN :\n${url}\n\nCe lien expire dans 30 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\nL'équipe Sérénité`,
    html: `
      <p>Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
      <p>
        <a href="${url}" style="
          display:inline-block;padding:12px 24px;
          background:#1A3A5C;color:#fff;border-radius:8px;
          text-decoration:none;font-weight:700;
        ">Réinitialiser mon PIN</a>
      </p>
      <p style="color:#718096;font-size:13px;">Ce lien expire dans 30 minutes.</p>
      <p style="color:#718096;font-size:12px;">
        Si vous n'avez pas demandé cette action, ignorez cet email.
      </p>
    `,
  });
}

/** Envoie un code à 6 chiffres par email pour la réinitialisation de PIN. */
export async function sendPinResetCode(
  to: string,
  firstName: string,
  code: string
): Promise<void> {
  await sendMail({
    to,
    subject: 'Code de réinitialisation PIN – Sérénité',
    text: `Bonjour ${firstName},\n\nVotre code de réinitialisation PIN est : ${code}\n\nCe code expire dans 15 minutes.\n\nSi vous n'avez pas demandé cette réinitialisation, ignorez cet email.\n\nL'équipe Sérénité`,
    html: `
      <p>Bonjour <strong>${escapeHtml(firstName)}</strong>,</p>
      <p>Votre code de réinitialisation PIN est :</p>
      <p style="
        font-size:32px;font-weight:800;letter-spacing:8px;
        text-align:center;padding:20px;
        background:#F7FAFC;border-radius:12px;
        color:#1A3A5C;margin:20px 0;
      ">${escapeHtml(code)}</p>
      <p style="color:#718096;font-size:13px;">Ce code expire dans 15 minutes.</p>
      <p style="color:#718096;font-size:12px;">
        Si vous n'avez pas demandé cette action, ignorez cet email.
      </p>
    `,
  });
}
