#!/usr/bin/env bash
# Revierte TODO el refactor de zonas (migraciones 0001-0008), en orden inverso.
# Deja la base exactamente como estaba antes (mismo esquema y funciones).
# Los datos de sesiones_respuesta.zona_id/encuesta_id/zona_por_gps se pierden
# (son columnas nuevas) — el resto de los datos no se toca.
#
# Uso:  bash scripts/rollback-zonas.sh          (pide confirmación)
#       bash scripts/rollback-zonas.sh --yes     (sin preguntar)
#
# Requiere .secrets/db-url

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_URL="$(tr -d '[:space:]' < "$ROOT/.secrets/db-url")"
MIG="$ROOT/supabase/migrations"

ROLLBACKS=(
  "20260902220018_stats_todas_encuestas_rollback.sql"
  "20260902220017_limpiar_indices_redundantes_rollback.sql"
  "20260902220016_zona_geom_precomputada_rollback.sql"
  "20260902220015_stats_encuestadores_por_encuesta_fix_rollback.sql"
  "20260902220014_reportes_usan_snapshot_rollback.sql"
  "20260902220013_encuesta_config_snapshot_rollback.sql"
  "20260902220012_snapshot_equipo_historico_rollback.sql"
  "20260902220011_stats_por_zona_participa_fix_rollback.sql"
  "20260902220010_encuesta_full_por_zona_encuestador_rollback.sql"
  "20260902220009_zona_continuidad_temporal_rollback.sql"
  "20260902220008_harden_zona_feat_geom_rollback.sql"
  "20260902220007_asignacion_mid_operativo_rollback.sql"
  "20260902220006_fase2_stats_por_zona_id_rollback.sql"
  "20260902220005_get_stats_por_zona_rollback.sql"
  "20260902220004_backfill_zona_sesiones_rollback.sql"
  "20260902220003_trigger_resolver_zona_rollback.sql"
  "20260902220002_zona_de_punto_resolver_rollback.sql"
  "20260902220001_zona_sesion_columnas_rollback.sql"
)

echo "Se van a ejecutar, EN ORDEN, estos rollbacks contra producción:"
printf '  - %s\n' "${ROLLBACKS[@]}"
echo
if [[ "${1:-}" != "--yes" ]]; then
  read -rp "¿Seguro? escribí 'rollback' para continuar: " ans
  [[ "$ans" == "rollback" ]] || { echo "Cancelado."; exit 1; }
fi

for f in "${ROLLBACKS[@]}"; do
  echo "▶ $f"
  psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIG/$f"
done

# Borrar el registro de las migraciones revertidas
psql "$DB_URL" -v ON_ERROR_STOP=1 -c "
  delete from supabase_migrations.schema_migrations
  where name in ('zona_sesion_columnas','zona_de_punto_resolver','trigger_resolver_zona',
    'backfill_zona_sesiones','get_stats_por_zona','fase2_stats_por_zona_id',
    'asignacion_mid_operativo','harden_zona_feat_geom','zona_continuidad_temporal',
    'encuesta_full_por_zona_encuestador','stats_por_zona_participa_fix',
    'snapshot_equipo_historico','encuesta_config_snapshot','reportes_usan_snapshot',
    'stats_encuestadores_por_encuesta_fix','zona_geom_precomputada',
    'limpiar_indices_redundantes','stats_todas_encuestas');
"

echo
echo "✅ Rollback completo. La base volvió al estado previo al refactor de zonas."
echo "   (Revertí también los cambios de frontend con: git checkout src/pages/admin/EncuestaDetalle.jsx src/pages/admin/Reportes.jsx)"
