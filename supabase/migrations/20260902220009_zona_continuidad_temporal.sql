-- Migración 9 — Fallback por continuidad temporal
--
-- Cuando el GPS de una sesión cae fuera de todo polígono, antes de usar "polígono
-- más cercano" probamos: ¿el mismo encuestador venía tomando encuestas DENTRO de
-- una zona en los últimos 45 min, y este punto está a < 500 m de esa zona?
-- → asumimos esa misma zona.
--
-- Nueva columna `zona_metodo` ('gps' | 'continuidad' | 'cercania' | NULL).
-- `zona_por_gps` se mantiene sincronizado (= zona_metodo = 'gps') para no romper
-- nada que ya lo lea.
--
-- HISTÓRICOS: NO se re-resuelven. Solo se les deriva `zona_metodo` del flag que
-- ya tenían (true→'gps', false→'cercania'). Ningún zona_id histórico cambia.
--
-- Rollback: 20260902220009_zona_continuidad_temporal_rollback.sql

-- ── 1. Columna + índice para el lookup temporal ──────────────────────────────
alter table public.sesiones_respuesta
  add column if not exists zona_metodo text;

comment on column public.sesiones_respuesta.zona_metodo is
  'Cómo se resolvió zona_id: gps = dentro del polígono; continuidad = misma zona que las encuestas contiguas en el tiempo del mismo encuestador; cercania = polígono más cercano; NULL = sin resolver.';

create index if not exists idx_sesiones_resp_enc_temporal
  on public.sesiones_respuesta (encuestador_id, encuesta_id, completada_en)
  where completada_en is not null;

-- ── 2. Backfill de zona_metodo (derivación pura del flag existente) ──────────
update public.sesiones_respuesta
set zona_metodo = case
  when zona_por_gps is true  then 'gps'
  when zona_por_gps is false then 'cercania'
  else null
end
where zona_metodo is null;

-- ── 3. resolver_zona_sesion con continuidad temporal ─────────────────────────
drop function if exists public.resolver_zona_sesion(uuid, double precision, double precision);

create or replace function public.resolver_zona_sesion(
  p_encuesta_id uuid,
  p_lat double precision,
  p_lng double precision,
  p_encuestador_id uuid default null,
  p_fecha timestamptz default null,
  out out_zona_id uuid,
  out out_metodo text
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_point geometry;
  v_cand  uuid;
  v_dist  double precision;
begin
  out_zona_id := null;
  out_metodo  := null;
  if p_encuesta_id is null then return; end if;

  -- 1) Contención
  out_zona_id := public.zona_de_punto(p_encuesta_id, p_lat, p_lng);
  if out_zona_id is not null then
    out_metodo := 'gps';
    return;
  end if;

  if p_lat is null or p_lng is null then
    return;
  end if;
  v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326);

  -- 2) Continuidad temporal
  if p_encuestador_id is not null and p_fecha is not null then
    select sr.zona_id
      into v_cand
    from public.sesiones_respuesta sr
    where sr.encuestador_id = p_encuestador_id
      and sr.encuesta_id    = p_encuesta_id
      and sr.zona_metodo    = 'gps'
      and sr.zona_id is not null
      and sr.completada_en is not null
      and sr.completada_en <  p_fecha
      and sr.completada_en >= p_fecha - interval '45 minutes'
    order by sr.completada_en desc
    limit 1;

    if v_cand is not null then
      select min(st_distance(public._zona_feat_geom(feat)::geography, v_point::geography))
        into v_dist
      from public.encuesta_zonas ez
      cross join lateral jsonb_array_elements(ez.area_geojson->'features') feat
      where ez.id = v_cand
        and feat->'properties'->>'tipo' = 'zona'
        and public._zona_feat_geom(feat) is not null;

      if v_dist is not null and v_dist < 500 then
        out_zona_id := v_cand;
        out_metodo  := 'continuidad';
        return;
      end if;
    end if;
  end if;

  -- 3) Polígono más cercano
  select ez.id
    into out_zona_id
  from public.encuesta_zonas ez
  cross join lateral jsonb_array_elements(ez.area_geojson->'features') feat
  where ez.encuesta_id = p_encuesta_id
    and ez.area_geojson is not null
    and feat->'properties'->>'tipo' = 'zona'
    and public._zona_feat_geom(feat) is not null
  order by st_distance(public._zona_feat_geom(feat)::geography, v_point::geography), ez.orden
  limit 1;

  if out_zona_id is not null then
    out_metodo := 'cercania';
  end if;
exception when others then
  out_zona_id := null;
  out_metodo  := null;
end;
$$;

-- ── 4. Trigger: pasa encuestador + fecha, setea zona_metodo ──────────────────
create or replace function public.trg_sesion_resolver_zona()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_encuesta_id uuid;
  v_res         record;
begin
  if new.encuesta_id is null then
    if new.asignacion_id is not null then
      select ez.encuesta_id
        into v_encuesta_id
      from public.asignaciones_encuesta ae
      join public.encuesta_zonas ez on ez.id = ae.encuesta_zona_id
      where ae.id = new.asignacion_id;
    end if;

    if v_encuesta_id is null then
      select p.encuesta_id
        into v_encuesta_id
      from public.respuestas r
      join public.preguntas p on p.id = r.pregunta_id
      where r.sesion_id = new.id
      limit 1;
    end if;

    new.encuesta_id := v_encuesta_id;
  end if;

  if new.encuesta_id is not null and new.zona_id is null then
    select out_zona_id, out_metodo
      into v_res
    from public.resolver_zona_sesion(
      new.encuesta_id, new.latitud, new.longitud,
      new.encuestador_id, coalesce(new.completada_en, new.iniciada_en)
    );

    new.zona_id      := v_res.out_zona_id;
    new.zona_metodo  := v_res.out_metodo;
    new.zona_por_gps := (v_res.out_metodo = 'gps');
  end if;

  return new;
exception when others then
  return new;
end;
$$;
