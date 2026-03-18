#!/bin/bash
# ============================================================
# Sérénité — Script de déploiement
# Usage : bash scripts/deploy.sh [--domain DOMAINE]
# ============================================================

set -e  # Arrêt immédiat sur erreur

# ── Couleurs ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'  # No Color

log()  { echo -e "${GREEN}[deploy]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC}   $1"; }
err()  { echo -e "${RED}[error]${NC}  $1"; exit 1; }

# ── Domaine (argument ou variable d'env) ─────────────────────
DOMAIN="${DOMAIN:-localhost}"
while [[ "$#" -gt 0 ]]; do
  case $1 in
    --domain) DOMAIN="$2"; shift ;;
    *) warn "Argument inconnu : $1" ;;
  esac
  shift
done

log "=== Déploiement Sérénité → ${DOMAIN} ==="
log "Démarré le $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── 1. Récupérer le dernier code ─────────────────────────────
log "1/5 — Récupération du code (git pull)…"
git pull origin main || err "git pull a échoué"

# ── 2. Installer les dépendances backend ─────────────────────
log "2/5 — Installation des dépendances backend…"
cd backend
npm install --omit=dev || err "npm install a échoué"

# ── 3. Compiler TypeScript ────────────────────────────────────
log "3/5 — Compilation TypeScript…"
npm run build || err "npm run build a échoué"
cd ..

# ── 4. Redémarrer les conteneurs ──────────────────────────────
log "4/5 — Redémarrage Docker…"
docker compose down --remove-orphans || warn "docker compose down a échoué (ignoré)"
docker compose up -d --build         || err "docker compose up a échoué"

# ── 5. Vérifier le health check ───────────────────────────────
log "5/5 — Vérification du health check…"
echo ""

HEALTH_URL="https://${DOMAIN}/api/health"
MAX_RETRIES=10
WAIT_SEC=3
OK=false

for i in $(seq 1 $MAX_RETRIES); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || echo "000")
  if [ "${HTTP_CODE}" = "200" ]; then
    OK=true
    break
  fi
  warn "Tentative ${i}/${MAX_RETRIES} — code HTTP ${HTTP_CODE} — attente ${WAIT_SEC}s…"
  sleep $WAIT_SEC
done

echo ""
if [ "$OK" = true ]; then
  RESPONSE=$(curl -s "${HEALTH_URL}" 2>/dev/null)
  echo -e "${GREEN}✅ Déploiement terminé avec succès !${NC}"
  echo ""
  echo "   URL     : https://${DOMAIN}"
  echo "   Health  : ${RESPONSE}"
  echo "   Date    : $(date '+%Y-%m-%d %H:%M:%S')"
else
  err "Health check KO après ${MAX_RETRIES} tentatives — vérifier les logs : docker compose logs -f backend"
fi
