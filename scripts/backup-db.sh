#!/usr/bin/env bash
# Backup completo de la base de Supabase (METR1KA) a ./backups/
# Uso:
#   1. Poné la connection string en .secrets/db-url  (session pooler, con password)
#   2. bash scripts/backup-db.sh
#
# La connection string se saca de: Supabase Dashboard > Project Settings > Database
#   > Connection string > "Session pooler"  (formato postgresql://postgres.<ref>:<pass>@...pooler.supabase.com:5432/postgres)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
URL_FILE="$ROOT/.secrets/db-url"
OUT_DIR="$ROOT/backups"
STAMP="$(date +%Y%m%d-%H%M%S)"

if [[ ! -f "$URL_FILE" ]]; then
  echo "ERROR: falta $URL_FILE con la connection string." >&2
  exit 1
fi

DB_URL="$(tr -d '[:space:]' < "$URL_FILE")"
mkdir -p "$OUT_DIR"

echo "▶ Dump de esquema + datos (formato custom, comprimido)..."
pg_dump "$DB_URL" \
  --format=custom \
  --no-owner --no-privileges \
  --file="$OUT_DIR/metr1ka-$STAMP.dump"

echo "▶ Dump de esquema solo (SQL plano, para diff/lectura)..."
pg_dump "$DB_URL" \
  --schema-only --no-owner --no-privileges \
  --schema=public \
  --file="$OUT_DIR/metr1ka-$STAMP.schema.sql"

echo "▶ Dump de datos solo (SQL plano, inserts)..."
pg_dump "$DB_URL" \
  --data-only --no-owner --no-privileges \
  --schema=public \
  --file="$OUT_DIR/metr1ka-$STAMP.data.sql"

echo
echo "✅ Backups en $OUT_DIR:"
ls -lh "$OUT_DIR" | grep "$STAMP"
echo
echo "Para restaurar el custom dump en una base local:"
echo "  pg_restore --clean --if-exists --no-owner --no-privileges -d <conn> $OUT_DIR/metr1ka-$STAMP.dump"
