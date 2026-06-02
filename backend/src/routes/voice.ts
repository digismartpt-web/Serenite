import { Router, Response } from 'express';
import { z }                from 'zod';
import axios                from 'axios';
import multer               from 'multer';
import FormData             from 'form-data';

import { requireAuth, AuthRequest } from '../middleware/auth';
import { DEEPSEEK_API_URL, DEEPSEEK_API_KEY, DEEPSEEK_MODEL, CNV_SYSTEM_PROMPT } from '../services/ai/deepseekClient';

const router  = Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// ─── POST /api/voice/transcribe ────────────────────────────────
// Reçoit un fichier audio (multipart/form-data) et le transmet à
// l'API Whisper de DeepSeek pour transcription.

const ALLOWED_AUDIO_MIMES = [
  'audio/wav',
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/webm',
  'audio/flac',
  'audio/x-wav',
  'audio/x-m4a',
  'audio/mp4',
  'video/mp4',       // Whisper accepte aussi la vidéo
];

const AUDIO_MAGIC_BYTES: Record<string, Uint8Array> = {
  'RIFF': new Uint8Array([0x52, 0x49, 0x46, 0x46]),  // WAV
  'OggS': new Uint8Array([0x4F, 0x67, 0x67, 0x53]),  // OGG
  'ftyp': new Uint8Array([0x66, 0x74, 0x79, 0x70]),  // MP4/M4A
  'ID3':  new Uint8Array([0x49, 0x44, 0x33]),        // MP3
};

function isValidAudioMime(mime: string): boolean {
  return ALLOWED_AUDIO_MIMES.includes(mime);
}

function hasAudioMagicBytes(buffer: Uint8Array): boolean {
  const header = buffer.slice(0, 8);
  for (const magic of Object.values(AUDIO_MAGIC_BYTES)) {
    if (header.subarray(0, magic.length).every((b, i) => b === magic[i])) {
      return true;
    }
  }
  return false;
}

router.post(
  '/transcribe',
  requireAuth,
  upload.single('audio'),
  async (req: AuthRequest, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: 'Fichier audio requis' });
      return;
    }

    // Validation du MIME type
    if (!isValidAudioMime(req.file.mimetype)) {
      res.status(400).json({ error: 'Format audio non supporté. Formats acceptés : WAV, MP3, OGG, WEBM, FLAC, M4A' });
      return;
    }

    // Validation des magic bytes
    const uint8 = new Uint8Array(req.file.buffer);
    if (!hasAudioMagicBytes(uint8)) {
      res.status(400).json({ error: 'Le fichier ne semble pas être un fichier audio valide' });
      return;
    }

    try {
      // Créer un FormData pour le forward vers DeepSeek Whisper
      const formData = new FormData();
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
      console.error('[voice/transcribe] Erreur API DeepSeek Whisper (status:', (err as any)?.response?.status ?? 'inconnu', ')');
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
      console.error('[voice/reformulate] Erreur API DeepSeek (status:', (err as any)?.response?.status ?? 'inconnu', ')');
      res.status(502).json({ error: 'Service de reformulation temporairement indisponible' });
    }
  }
);

export default router;
