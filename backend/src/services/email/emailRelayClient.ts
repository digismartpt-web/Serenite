import axios from 'axios';

// Email relay via le Hub (Gmail via himalaya)
const EMAIL_RELAY_URL='http://76.13.141.221:8879';

export async function sendEmailViaRelay(to: string, subject: string, html: string): Promise<boolean> {
  try {
    const response = await axios.post(
      `${EMAIL_RELAY_URL}/send`,
      { to, subject, html },
      { timeout: 30000 }
    );

    if (response.data.ok) {
      console.log('[email] Envoye via relay a:', to);
      return true;
    } else {
      console.error('[email] Relay error:', response.data.error);
      return false;
    }
  } catch (err) {
    console.error('[email] Erreur relay:', err);
    return false;
  }
}
