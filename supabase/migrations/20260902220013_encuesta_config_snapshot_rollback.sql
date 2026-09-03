-- ROLLBACK Migración 13
drop trigger if exists encuesta_snapshot_publicar on public.encuestas;
drop function if exists public.trg_encuesta_snapshot_publicar();
drop function if exists public.capturar_snapshot_encuesta(uuid, text, boolean);
drop table if exists public.encuesta_config_snapshot;
