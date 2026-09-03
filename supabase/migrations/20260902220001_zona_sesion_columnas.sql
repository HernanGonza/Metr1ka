-- Fase 1 · Paso 1/5 — Columnas geográficas en sesiones_respuesta
-- Aditivo puro: 3 columnas nullable + índices. Nada las lee todavía.
-- Rollback: 20260902220001_zona_sesion_columnas_rollback.sql

alter table public.sesiones_respuesta
  add column if not exists zona_id      uuid    references public.encuesta_zonas(id) on delete set null,
  add column if not exists encuesta_id  uuid    references public.encuestas(id)      on delete set null,
  add column if not exists zona_por_gps boolean;

comment on column public.sesiones_respuesta.zona_id      is 'Zona geográfica donde se tomó la sesión (resuelta por GPS o por polígono más cercano). NULL = sin zona resoluble.';
comment on column public.sesiones_respuesta.encuesta_id  is 'Encuesta de la sesión, denormalizado para no depender de la cadena asignacion→zona.';
comment on column public.sesiones_respuesta.zona_por_gps is 'true = el punto GPS cae dentro del polígono de la zona. false = se usó la zona con el polígono más cercano. NULL = sin resolver.';

create index if not exists idx_sesiones_respuesta_zona_id        on public.sesiones_respuesta(zona_id);
create index if not exists idx_sesiones_respuesta_encuesta_id    on public.sesiones_respuesta(encuesta_id);
create index if not exists idx_sesiones_respuesta_encuestador_id on public.sesiones_respuesta(encuestador_id);
