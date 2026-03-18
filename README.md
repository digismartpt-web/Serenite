# Sérénité — Application de co-parentalité

Application mobile React Native / Expo pour faciliter la communication
entre parents séparés : messagerie CNV (reformulation IA), calendrier
de garde, finances partagées et espace enfant sécurisé.

---

## Stack technique

| Couche    | Technologie                                |
|-----------|--------------------------------------------|
| Frontend  | Expo ~52, Expo Router ~4, React Native 0.76 |
| Backend   | Node.js 20, Express 4, TypeScript 5        |
| Base      | PostgreSQL 15 (pg)                          |
| Auth      | JWT (jsonwebtoken), bcryptjs               |
| IA        | Anthropic Claude Haiku (`@anthropic-ai/sdk`) |
| Push      | Expo Server SDK                             |
| Docker    | Docker Compose, Traefik (Coolify)           |

---

## Structure du projet

```
/
├── app/                        # Frontend Expo Router
│   ├── (tabs)/                 # Navigation principale
│   │   ├── home.tsx            # Tableau de bord
│   │   ├── messages.tsx        # Messagerie CNV
│   │   ├── calendar.tsx        # Calendrier de garde
│   │   ├── finances.tsx        # Finances partagées
│   │   └── settings.tsx        # Paramètres & profil
│   ├── child/                  # Espace enfant (PIN 4 chiffres)
│   │   ├── _layout.tsx         # Guard PIN violet
│   │   └── home.tsx            # Interface enfant
│   ├── messages/
│   │   └── compose.tsx         # Composition + reformulation IA
│   ├── invite/                 # Tunnel invitation coparent
│   ├── onboarding/             # Inscription (5 étapes)
│   ├── context/
│   │   └── ThemeContext.tsx    # 8 thèmes adultes + 2 enfants
│   └── hooks/
│       └── useAuth.ts          # Hook authentification JWT
│
├── backend/                    # API Node.js / Express
│   ├── src/
│   │   ├── index.ts            # Entrée, helmet, cors, routes
│   │   ├── routes/
│   │   │   ├── auth.ts         # register, login, verify-email, me
│   │   │   ├── messages.ts     # reformulate (Claude), send
│   │   │   ├── events.ts       # Calendrier de garde
│   │   │   ├── expenses.ts     # Finances partagées
│   │   │   ├── invitations.ts  # Codes invitation famille
│   │   │   └── families.ts     # Famille, enfants
│   │   └── lib/
│   │       ├── database.ts     # Pool PostgreSQL
│   │       ├── jwt.ts          # signAuthToken, verifyAuthToken
│   │       ├── mailer.ts       # Emails (Resend)
│   │       └── rateLimit.ts    # Blocage anti-brute-force
│   ├── .env                    # Variables d'environnement (non committé)
│   ├── Dockerfile              # Build multi-stage Node 20 Alpine
│   └── package.json
│
├── database/
│   ├── schema.sql              # Tables PostgreSQL + triggers
│   └── seed.sql                # Données de test (Thomas & Marie)
│
└── docker-compose.yml          # Déploiement Coolify + Traefik
```

---

## Installation

### Prérequis

- Node.js 20+
- PostgreSQL 15+
- Un compte Anthropic (clé API Claude)
- (Production) Serveur avec Docker + Coolify

### 1. Cloner le repo

```bash
git clone https://github.com/Premium-a-juste-prix/Mediation.git
cd Mediation
```

### 2. Configurer le backend

```bash
cd backend
cp .env .env.local          # dupliquer le template
# Éditer .env.local avec tes vraies valeurs (voir section Variables)
```

### 3. Initialiser la base de données

```bash
psql -h IP_VPS -U USER -d serenite -f database/schema.sql
psql -h IP_VPS -U USER -d serenite -f database/seed.sql   # données de test
```

### 4. Installer les dépendances

```bash
# Backend
cd backend && npm install

# Frontend (racine)
cd .. && npm install
```

---

## Variables d'environnement

### Backend (`backend/.env`)

| Variable          | Obligatoire | Description                              |
|-------------------|:-----------:|------------------------------------------|
| `DB_HOST`         | Oui         | Hôte PostgreSQL                          |
| `DB_PORT`         | Non         | Port PostgreSQL (défaut : 5432)          |
| `DB_NAME`         | Oui         | Nom de la base (`serenite`)              |
| `DB_USER`         | Oui         | Utilisateur PostgreSQL                   |
| `DB_PASSWORD`     | Oui         | Mot de passe PostgreSQL                  |
| `JWT_SECRET`      | Oui         | Secret JWT ≥ 32 caractères              |
| `ANTHROPIC_API_KEY` | Oui       | Clé API Claude (reformulation CNV)       |
| `APP_URL`         | Oui         | URL publique de l'app                    |
| `CORS_ORIGIN`     | Non         | Origines autorisées (séparées par `,`)   |
| `NODE_ENV`        | Non         | `development` ou `production`            |
| `PORT`            | Non         | Port serveur (défaut : 3000)             |
| `MAIL_FROM`       | Non         | Expéditeur emails                        |
| `RESEND_API_KEY`  | Non         | Clé Resend pour les emails               |

Générer un `JWT_SECRET` sécurisé :
```bash
openssl rand -hex 32
```

### Frontend

| Variable                | Description                  |
|-------------------------|------------------------------|
| `EXPO_PUBLIC_API_URL`   | URL de l'API backend         |

Créer un fichier `.env` à la racine du projet :
```
EXPO_PUBLIC_API_URL=https://VOTRE_DOMAINE.com
```

---

## Lancement

### Développement

```bash
# Terminal 1 — Backend (hot reload)
cd backend
npm run dev

# Terminal 2 — Frontend
npx expo start
# Puis : s (Expo Go), a (Android), i (iOS)
```

### Production (Docker / Coolify)

```bash
# Build et lancement
docker compose up -d --build

# Logs en direct
docker compose logs -f backend

# Health check
curl https://VOTRE_DOMAINE.com/api/health
```

---

## Endpoints API principaux

| Méthode | Chemin                               | Description                    |
|---------|--------------------------------------|--------------------------------|
| GET     | `/api/health`                        | Liveness probe                 |
| POST    | `/api/auth/register`                 | Inscription                    |
| POST    | `/api/auth/login`                    | Connexion (JWT)                |
| GET     | `/api/auth/me`                       | Profil utilisateur             |
| PUT     | `/api/auth/update-pin`               | Changer le PIN                 |
| POST    | `/api/messages/reformulate`          | Reformulation CNV (Claude)     |
| POST    | `/api/messages/send`                 | Envoyer un message             |
| GET     | `/api/calendar/:year/:month`         | Calendrier mensuel             |
| POST    | `/api/calendar/events`               | Créer un événement             |
| POST    | `/api/expenses`                      | Ajouter une dépense            |
| POST    | `/api/invitations`                   | Créer un code invitation       |
| POST    | `/api/invitations/accept`            | Accepter une invitation        |

---

## Données de test

Après `seed.sql`, deux comptes sont disponibles :

| Prénom | Rôle  | Email                | PIN    |
|--------|-------|----------------------|--------|
| Thomas | Papa  | thomas@example.com   | `1234` |
| Marie  | Maman | marie@example.com    | `1234` |

---

## Déploiement sur Coolify

1. Connecter le repo GitHub à Coolify
2. Choisir **Docker Compose** comme type de déploiement
3. Renseigner les variables d'environnement dans l'interface Coolify
4. Coolify gère automatiquement Traefik + TLS Let's Encrypt
5. Le health check `/api/health` est utilisé pour le liveness probe

---

## Sécurité

- Helmet.js sur tous les headers HTTP
- Rate limiting sur `/api/auth/login` (5 échecs → blocage 15 min)
- Hachage bcrypt (coût 12) pour les mots de passe et PINs
- Timing-safe dummy hash pour éviter l'énumération d'emails
- JWT avec expiration 30 jours (auth) et 1 heure (email verify)
- SecureStore Expo pour le token JWT côté mobile
- Espace enfant cloisonné par PIN 4 chiffres (SecureStore)
- Journal enfant stocké localement uniquement (AsyncStorage)

---

## Licence

Propriétaire — Premium à juste prix © 2026. Tous droits réservés.
