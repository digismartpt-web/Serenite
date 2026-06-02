#!/bin/bash
# Backup de la base Supabase Sérénité
# À exécuter quotidiennement (cron)

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────────
# DATABASE_URL doit être défini dans l'environnement d'exécution
# (Coolify / Herodotus / crontab)
# Ex: postgresql://user:password@host:5432/dbname?schema=sereno

BACKUP_DIR="${BACKUP_DIR:-/root/.hermes-backups/serenite-app/db}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# ─── Préparation ────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

if [ -z "${DATABASE_URL:-}" ]; then
  # Fallback : charger le .env du backend
  if [ -f "/root/projects/serenite-app/Mediation/backend/.env" ]; then
    # Extraire DATABASE_URL ou construire depuis les vars individuelles
    if grep -q "^DATABASE_URL=" /root/projects/serenite-app/Mediation/backend/.env 2>/dev/null; then
      # shellcheck source=/dev/null
      source /root/projects/serenite-app/Mediation/backend/.env
    else
      # shellcheck source=/dev/null
      source /root/projects/serenite-app/Mediation/backend/.env
      DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT:-5432}/${DB_NAME}?sslmode=require"
    fi
  else
    echo "❌ DATABASE_URL non défini et aucun .env trouvé"
    exit 1
  fi
fi

# ─── Backup ─────────────────────────────────────────────────────
echo "⏳ Backup DB en cours…"

pg_dump "$DATABASE_URL" --no-owner --no-acl \
  > "$BACKUP_DIR/sereno_$TIMESTAMP.sql"

# Compresser
gzip "$BACKUP_DIR/sereno_$TIMESTAMP.sql"

# ─── Rétention ──────────────────────────────────────────────────
# Garder les N derniers backups (défaut : 7)
ls -t "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -n +$((RETENTION_DAYS + 1)) | xargs -r rm

echo "✅ Backup DB terminé : sereno_$TIMESTAMP.sql.gz ($(du -h "$BACKUP_DIR/sereno_$TIMESTAMP.sql.gz" | cut -f1))"
echo "📁 Dossier : $BACKUP_DIR"
echo "🔢 Retention : ${RETENTION_DAYS} jours"
