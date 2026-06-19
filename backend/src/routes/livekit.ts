import { Router, Response } from 'express';
import { z }                from 'zod';
import { RoomServiceClient, AccessToken } from 'livekit-server-sdk';

import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// LiveKit Config
const LIVEKIT_API_KEY    = process.env.LIVEKIT_API_KEY    || 'API8mp9CRdXbeui';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'YYpsEhqfnZgnXknVpytI3bfmKmNMY2UzHLlkMRrA9v7';
const LIVEKIT_URL        = process.env.LIVEKIT_URL        || 'http://localhost:7880';

// POST /api/livekit/token - Genere un token d'acces a une room
const AccessTokenSchema = z.object({
  roomName: z.string().min(1).max(100).trim(),
  identity: z.string().min(1).max(100).trim(),
});

router.post(
  '/token',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = AccessTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Parametres invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { roomName, identity } = parsed.data;

    try {
      const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
        identity,
        ttl: '2h',
      });
      at.addGrant({ roomJoin: true, room: roomName });

      const token = at.toJwt();

      res.json({
        token,
        wsUrl: 'wss://' + req.headers.host + '/livekit/ws',
        url: LIVEKIT_URL,
      });
    } catch (err) {
      console.error('[livekit/token] Erreur generation token:', err);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  }
);

// POST /api/livekit/room - Cree une room LiveKit
const RoomSchema = z.object({
  roomName: z.string().min(1).max(100).trim(),
  maxParticipants: z.number().min(2).max(10).default(2),
});

router.post(
  '/room',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const parsed = RoomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Parametres invalides', fields: parsed.error.flatten().fieldErrors });
      return;
    }

    const { roomName, maxParticipants } = parsed.data;

    try {
      const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

      const room = await roomService.createRoom({
        name: roomName,
        maxParticipants,
      });

      res.json({
        room: {
          sid: room.sid,
          name: room.name,
          maxParticipants: room.maxParticipants,
        },
      });
    } catch (err) {
      console.error('[livekit/room] Erreur creation room:', err);
      res.status(500).json({ error: 'Erreur creation room' });
    }
  }
);

// GET /api/livekit/rooms - Liste les rooms actives
router.get(
  '/rooms',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      const rooms = await roomService.listRooms();

      res.json({
        rooms: rooms.map(r => ({
          sid: r.sid,
          name: r.name,
          participants: r.numParticipants,
          maxParticipants: r.maxParticipants,
        })),
      });
    } catch (err) {
      console.error('[livekit/rooms] Erreur listing rooms:', err);
      res.status(500).json({ error: 'Erreur listing rooms' });
    }
  }
);

// DELETE /api/livekit/room/:name - Supprime une room
router.delete(
  '/room/:name',
  requireAuth,
  async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const roomService = new RoomServiceClient(LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
      await roomService.deleteRoom(req.params.name);
      res.json({ ok: true });
    } catch (err) {
      console.error('[livekit/room] Erreur suppression room:', err);
      res.status(500).json({ error: 'Erreur suppression room' });
    }
  }
);

export default router;
