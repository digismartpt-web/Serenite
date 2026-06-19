import { sendEmailViaRelay } from './emailRelayClient';

// Re-export pour compatibilite
export const sendEmail = sendEmailViaRelay;

// Templates d'emails
export const emailTemplates = {
  invitation: (inviteeName: string, inviterName: string, link: string) => ({
    subject: `${inviterName} vous invite sur Serenite`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6B46C1;">Bienvenue sur Serenite</h2>
        <p><strong>${inviterName}</strong> vous invite a rejoindre l'application de mediation parentale.</p>
        <p>Serenite vous aide a gerer la communication avec l'autre parent de facon bienveillante, grace a l'IA de Communication Non-Violente.</p>
        <a href="${link}" style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Rejoindre Serenite
        </a>
        <p style="color: #666; font-size: 12px;">Ce lien expire dans 7 jours.</p>
      </div>
    `,
  }),

  welcome: (userName: string) => ({
    subject: 'Bienvenue sur Serenite !',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6B46C1;">Bienvenue ${userName} !</h2>
        <p>Votre compte Serenite est maintenant actif.</p>
        <p>Vous pouvez maintenant :</p>
        <ul>
          <li>Envoyer des messages reformules par l'IA CNV</li>
          <li>Gerer le calendrier de garde</li>
          <li>Suivre les depenses communes</li>
          <li>Planifier des appels video</li>
        </ul>
        <a href="https://serenite.newappai.com" style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Acceder a Serenite
        </a>
      </div>
    `,
  }),

  passwordReset: (userName: string, link: string) => ({
    subject: 'Reinitialisation de votre mot de passe',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #6B46C1;">Reinitialisation du mot de passe</h2>
        <p>Bonjour ${userName},</p>
        <p>Vous avez demande la reinitialisation de votre mot de passe.</p>
        <a href="${link}" style="display: inline-block; background: #6B46C1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; margin: 16px 0;">
          Reinitialiser mon mot de passe
        </a>
        <p style="color: #666; font-size: 12px;">Si vous n'avez pas demande cette reinitialisation, ignorez cet email.</p>
      </div>
    `,
  }),
};
