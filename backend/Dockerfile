# ─── Stage 1 : build ──────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copier uniquement les manifestes d'abord (cache Docker optimal)
COPY package.json tsconfig.json ./
RUN npm install --frozen-lockfile

# Compiler TypeScript
COPY src/ ./src/
RUN npm run build

# ─── Stage 2 : production ─────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Dépendances de production uniquement
COPY package.json ./
RUN npm install --omit=dev --frozen-lockfile

# Copier le build compilé
COPY --from=builder /app/dist ./dist

# Utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser  -S serenite -u 1001
USER serenite

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "dist/index.js"]
