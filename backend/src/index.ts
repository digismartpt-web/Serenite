// ⚠️ dotenv doit être importé EN PREMIER, avant tout autre module
import 'dotenv/config';

// express-async-errors : attrape les erreurs dans les routeurs async
import 'express-async-errors';

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import helmet  from 'helmet';
import cors    from 'cors';
import rateLimit from 'express-rate-limit';

import { checkConnection } from './lib/database';
import authRouter        from './routes/auth';
import invitationsRouter from './routes/invitations';
import familiesRouter    from './routes/families';
import messagesRouter    from './routes/messages';
import eventsRouter      from './routes/events';
import expensesRouter    from './routes/expenses';
import usersRouter       from './routes/users';
import voiceRouter       from './routes/voice';
import notificationsRouter from './routes/notifications';
import mediatorsRouter    from './routes/mediators';
import uploadRoutes       from './routes/uploads';
import vaultRoutes        from './routes/vault';
import healthRoutes       from './routes/health';
import livekitRouter      from './routes/livekit';
import legalRouter        from './routes/legal';
import exportRoutes       from './routes/exports';

// ─── Validation des variables d'environnement critiques ───────
// L'application refuse de démarrer si une variable obligatoire manque.

const REQUIRED_ENV = [
  'JWT_SECRET',
  'DB_HOST',
  'DB_NAME',
  'DB_USER',
  'DB_PASSWORD',
] as const;

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Variable d'environnement manquante : ${key}`);
    process.exit(1);
  }
}

// JWT_SECRET trop court → risque de sécurité
if ((process.env.JWT_SECRET ?? '').length < 32) {
  console.error('[FATAL] JWT_SECRET trop court (minimum 32 caractères)');
  process.exit(1);
}

// Vérifier que JWT_SECRET n'est pas la valeur par défaut du .env.example
if (process.env.JWT_SECRET && process.env.JWT_SECRET.startsWith('CHANGE_ME')) {
  console.error('[SECURITY] JWT_SECRET still has default value! Change it in .env');
  process.exit(1);
}

// ─── Application Express ──────────────────────────────────────

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Rate Limiting ─────────────────────────────────────────────

const globalLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 100,              // max 100 requêtes par minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes. Réessayez dans une minute.' },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives d\'inscription. Réessayez plus tard.' },
});

const deepseekLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes au service IA. Réessayez dans une minute.' },
});

const voiceLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes vocales. Réessayez dans une minute.' },
});

app.set('trust proxy', 1); // Nécessaire pour req.ip derrière Traefik/Coolify
app.use(globalLimiter);

// ── Sécurité : Helmet ────────────────────────────────────────
// Sur Coolify, le TLS est géré par Traefik (reverse-proxy).
// Helmet sécurise les headers HTTP sans configuration HTTPS côté Node.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc:  ["'self'"],
        styleSrc:   ["'self'", "'unsafe-inline'"],
        imgSrc:     ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc:    ["'self'"],
        objectSrc:  ["'none'"],
        frameSrc:   ["'none'"],
        upgradeInsecureRequests: IS_PROD ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,  // compatible avec les deep links mobiles
    hsts: IS_PROD
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
  })
);

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

// En production, CORS_ORIGIN doit être défini
if (IS_PROD && allowedOrigins.length === 0) {
  console.error('[FATAL] CORS_ORIGIN doit être défini en production');
  process.exit(1);
}

app.use(
  cors({
    origin: IS_PROD
      ? (origin, cb) => {
          // Autorise les requêtes sans origine (mobile natif, Postman)
          if (!origin || allowedOrigins.includes(origin)) {
            cb(null, true);
          } else {
            cb(new Error(`Origine non autorisée : ${origin}`));
          }
        }
      : true, // En développement : toutes origines
    credentials:     true,
    allowedHeaders:  ['Content-Type', 'Authorization'],
    exposedHeaders:  ['X-Request-Id'],
    maxAge:          600, // Cache preflight 10 minutes
  })
);

// ── Parsing ───────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' })); // Limite raisonnable pour l'API
app.use(express.urlencoded({ extended: false }));

// ── Sécurité : ne jamais exposer la stack en production ───────

// ─── Rate limiters spécifiques ─────────────────────────────────
app.use('/api/auth/register', registerLimiter);
app.use('/api/messages/reformulate', deepseekLimiter);
app.use('/api/voice', voiceLimiter);

// ─── Routes ───────────────────────────────────────────────────

app.use('/api/auth',        authRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/families',    familiesRouter);
app.use('/api/messages',    messagesRouter);
// Calendrier : monté aux deux chemins (legacy /api/events + nouveau /api/calendar)
app.use('/api/events',      eventsRouter);
app.use('/api/calendar',    eventsRouter);
// Finances : monté aux deux chemins (legacy /api/expenses + nouveau /api/finances)
app.use('/api/expenses',    expensesRouter);
app.use('/api/finances',    expensesRouter);
app.use('/api/users',       usersRouter);
app.use('/api/voice',       voiceRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/mediators',     mediatorsRouter);

// Nouvelles fonctionnalités
app.use('/api/uploads',    uploadRoutes);
app.use('/api/vault',      vaultRoutes);
// ── Health check (utilisé par Coolify pour le liveness probe) ─
// ── Health check public (Coolify liveness probe) ─────────────
app.get("/api/status", (_req, res) => {
  res.json({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() });
});

app.use('/api/health',     healthRoutes);
app.use('/api/exports',    exportRoutes);
app.use('/api/livekit',     livekitRouter);
app.use('/api/legal',      legalRouter);

// Servir les fichiers uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));


// Alias legacy
app.get('/health', (_req, res) => {
  res.redirect(301, '/api/health');
});

// ─── Gestionnaire d'erreurs global ────────────────────────────
// ⚠️ Ne jamais inclure de données sensibles (PIN, hash, stack) dans la réponse

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({
    error: IS_PROD ? 'Erreur serveur interne' : err.message,
  });
});

// ─── Démarrage ────────────────────────────────────────────────

async function start(): Promise<void> {
  // Vérifier la connexion DB avant d'écouter
  await checkConnection();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[SERVER] Sérénité API démarrée — port ${PORT} (${process.env.NODE_ENV})`);
  });
}

start().catch((err) => {
  console.error('[FATAL] Impossible de démarrer le serveur :', err.message);
  process.exit(1);
});

export default app;
