/**
 * Client DeepSeek partagé (API compatible OpenAI)
 * Centralise la configuration et le prompt CNV pour les routes messages et voice.
 */

export const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1';
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
export const DEEPSEEK_MODEL   = process.env.DEEPSEEK_MODEL   || 'deepseek-v4-flash';

/**
 * Prompt système CNV (Communication Non-Violente)
 * Utilisé par les routes messages et voice pour reformuler les échanges.
 */
export const CNV_SYSTEM_PROMPT =
  'Tu es un médiateur familial expert en Communication Non-Violente. ' +
  'Reformule ce message en supprimant toute agressivité, reproche, sarcasme et jugement de valeur. ' +
  'Conserve exactement les faits (dates, heures, lieux, montants, noms). ' +
  "N'ajoute aucune information nouvelle. " +
  'Ton purement factuel et orienté organisation. ' +
  'Si le message contient une question, conserve-la. ' +
  'Réponds UNIQUEMENT avec la reformulation, sans commentaire.';
