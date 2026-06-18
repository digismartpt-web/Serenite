// ─── Configuration API ────────────────────────────────────────
// Toutes les constantes liées à l'API backend et aux modèles IA.
// Importez depuis ce fichier — ne dupliquez jamais process.env dans les composants.

// Note: la valeur vient de .env (EXPO_PUBLIC_API_URL) — rebuild si l'URL change
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'https://serenite.newappai.com';
export const API_BASE = API_URL;

export const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

// ─── Endpoints ────────────────────────────────────────────────

export const ENDPOINTS = {
  // Auth
  register:        `${API_URL}/api/auth/register`,
  login:           `${API_URL}/api/auth/login`,
  me:              `${API_URL}/api/auth/me`,
  verifyEmail:     `${API_URL}/api/auth/verify-email`,
  updatePin:       `${API_URL}/api/auth/update-pin`,

  // Messagerie CNV
  reformulate:     `${API_URL}/api/messages/reformulate`,
  sendMessage:     `${API_URL}/api/messages/send`,
  messages:        (familyId: string) => `${API_URL}/api/messages/${familyId}`,
  unreadCount:     (familyId: string) => `${API_URL}/api/messages/${familyId}/unread-count`,

  // Calendrier
  events:          `${API_URL}/api/calendar`,
  exchangeRequest: `${API_URL}/api/calendar/exchange-request`,

  // Finances
  expenses:        `${API_URL}/api/finances`,
  validateExpense: (id: string) => `${API_URL}/api/finances/${id}/validate`,

  // Famille
  familyMe:        `${API_URL}/api/families/me`,
  familySolo:      `${API_URL}/api/families/solo`,
  addChild:        `${API_URL}/api/families/children`,

  // Invitations
  createInvitation:  `${API_URL}/api/invitations`,
  acceptInvitation:  `${API_URL}/api/invitations/accept`,
  invitationStatus:  `${API_URL}/api/invitations/status`,

  // Santé
  health:          `${API_URL}/api/health`,
} as const;
