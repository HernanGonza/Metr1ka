-- Telemetría de fallos de GPS en la app del encuestador.
--
-- Contexto: operativo del 28/10, dos encuestadores guardaron todas sus
-- encuestas sin coordenadas. ubicaciones_encuestadores es un upsert de una
-- fila por encuestador (no guarda historial ni motivo), así que no sirve
-- para saber qué pasó con cada teléfono. Esta tabla registra cada fallo del
-- diagnóstico de GPS (permiso_denegado, permiso_aproximado, gps_apagado,
-- sin_senal) con datos del dispositivo. La app inserta best-effort: si la
-- tabla no existe todavía, el insert falla en silencio y no afecta nada.
--
-- Rollback: 20261029000000_gps_fallos_rollback.sql

create table if not exists public.gps_fallos (
  id              uuid primary key default gen_random_uuid(),
  encuestador_id  uuid not null,
  organizacion_id uuid,
  motivo          text not null,
  detalle         text,
  plataforma      text,
  version_so      text,
  creado_en       timestamptz not null default now()
);

create index if not exists gps_fallos_encuestador_idx
  on public.gps_fallos (encuestador_id, creado_en desc);

alter table public.gps_fallos enable row level security;

create policy gps_fallos_insert_propio on public.gps_fallos
  for insert to authenticated
  with check (encuestador_id = auth.uid());

create policy gps_fallos_select_org on public.gps_fallos
  for select to authenticated
  using (organizacion_id = (select p.organizacion_id from public.perfiles p where p.id = auth.uid()));
