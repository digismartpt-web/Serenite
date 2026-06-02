import { Router, Response } from 'express';
import { z }                from 'zod';
import axios                from 'axios';
import multer               from 'multer';

import { requireAuth, AuthRequest } from '../middleware/auth';

const router  = Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ─── Client DeepSeek (API compatible OpenAI) ──────────────────
const DEEPSEEK_API_URL  = process.env.DEEPSEEK_API_URL  || 'https://api.deepseek.com/v1';
const DEEPSEEK_API_KEY  = process.env.DEEPSEEK_API_KEY  || '';
const DEEPSEEK_MODEL    = process.env.DEEPSEEK_MODEL    || 'deepseek-v4-flash';

// ─── Prompt CNV (identique à messages.ts) ─────────────────────
const CNV_SYSTEM_PROMPT =
  'Tu es un médiateur familial expert en Communication Non-Violente. ' +
  'Reformule ce message en supprimant toute agressivité, reproche, sarcasme et jugement de valeur. ' +
  'Conserve exactement les faits (dates, heures, lieux, montants, noms). ' +
  "N'ajoute aucune information nouvelle. " +
  'Ton purement factuel et orienté organisation. ' +
  'Si le message contient une question, conserve-la. ' +
  'Réponds UNIQUEMENT avec la reformulation, sans commentaire.';

// ─── POST /api/voice/transcribe ────────────────────────────────
// Reçoit un fichier audio (multipart/form-data) et le transmet à
// l'API Whisper de DeepSeek pour transcription.

router.post(
  '/transcribe',
  requireAuth,
  upload.single('audio'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'Fichier audio requis' });
      return;
    }

    try {
      // Créer un FormData pour le forward vers DeepSeek Whisper
      const formData = new FormData();
      const uint8 = new Uint8Array(req.file.buffer);
      const blob = new Blob([uint8], { type: req.file.mimetype });
      formData.append('file', blob, req.file.originalname || 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', 'fr');
      formData.append('response_format', 'json');

      const dsResponse = await axios.post(
        `${DEEPSEEK_API_URL}/audio/transcriptions`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            ...(formData as any).getHeaders?.(),
          },
          timeout: 30_000,
          maxBodyLength: 30 * 1024 * 1024,
        }
      );

      const transcribedText = (dsResponse.data.text as string)?.trim();
      if (!transcribedText) {
        res.status(502).json({ error: 'Transcription vide retournée par le service' });
        return;
      }

      res.json({ transcribedText });
    } catch (err) {
      const message = (err as Error).message;
      console.error('[voice/transcribe] Erreur API DeepSeek Whisper :', message);
      res.status(502).json({ error: 'Service de transcription temporairement indisponible' });
    }
  }
);

// ─── POST /api/voice/reformulate ───────────────────────────────
// Reçoit le texte transcrit et le reformule avec le moteur CNV.

const ReformulateSchema = z.object({
  text: z.string().min(1).max(2000).trim(),
});

router.post(
  '/reformulate',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = ReformulateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Texte invalide', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { text } = parsed.data;

    try {
      const dsResponse = await axios.post(
        `${DEEPSEEK_API_URL}/chat/completions`,
        {
          model: DEEPSEEK_MODEL,
          max_tokens: 1024,
          messages: [
            { role: 'system', content: CNV_SYSTEM_PROMPT },
            { role: 'user',   content: text },
          ],
        },
        {
          headers: {
            'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
            'Content-Type':  'application/json',
          },
          timeout: 15_000,
        }
      );

      const reformulatedText = dsResponse.data.choices[0].message.content.trim();

      res.json({ reformulatedText });
    } catch (err) {
      console.error('[voice/reformulate] Erreur API DeepSeek :', (err as Error).message);
      res.status(502).json({ error: 'Service de reformulation temporairement indisponible' });
    }
  }
);

export default router;
