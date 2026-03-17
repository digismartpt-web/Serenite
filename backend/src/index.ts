// ⚠️ dotenv doit être importé EN PREMIER, avant tout autre module
import 'dotenv/config';

import express, { Request, Response, NextFunction } from 'express';
import helmet  from 'helmet';
import cors    from 'cors';

import { checkConnection } from './lib/database';
import authRouter        from './routes/auth';
import invitationsRouter from './routes/invitations';
import familiesRouter    from './routes/families';

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

// ─── Application Express ──────────────────────────────────────

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3000', 10);
const IS_PROD = process.env.NODE_ENV === 'production';

// ── Sécurité : Helmet ────────────────────────────────────────
// Sur Coolify, le TLS est géré par Traefik (reverse-proxy).
// Helmet sécurise les headers HTTP sans configuration HTTPS côté Node.
app.use(
  helmet({
    contentSecurityPolicy: IS_PROD ? undefined : false, // désactivé en dev pour le playground
    crossOriginEmbedderPolicy: false,                   // compatible avec les deep links mobiles
    hsts: IS_PROD
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
  })
);

// ── CORS ─────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : [];

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
app.set('trust proxy', 1); // Nécessaire pour req.ip derrière Traefik/Coolify

// ─── Routes ───────────────────────────────────────────────────

app.use('/api/auth',        authRouter);
app.use('/api/invitations', invitationsRouter);
app.use('/api/families',    familiesRouter);

// ── Health check (utilisé par Coolify pour le liveness probe) ─
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() });
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
