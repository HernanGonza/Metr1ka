-- ROLLBACK Fase 1 · Paso 1/5
-- Deja sesiones_respuesta exactamente como estaba (sin columnas geográficas).
-- Ejecutar SOLO después de los rollbacks 05, 04, 03 (nada debe referenciar estas columnas).

drop index if exists public.idx_sesiones_respuesta_zona_id;
drop index if exists public.idx_sesiones_respuesta_encuesta_id;
drop index if exists public.idx_sesiones_respuesta_encuestador_id;

alter table public.sesiones_respuesta
  drop column if exists zona_id,
  drop column if exists encuesta_id,
  drop column if exists zona_por_gps;
