-- Migración 16 — PERFORMANCE: polígono de zona precomputado + índice espacial
--
-- El trigger de resolución de zona parseaba los ~2000 features GeoJSON (incluidas
-- las manzanas) con ST_GeomFromGeoJSON en CADA insert de sesión → ~13 s por
-- encuesta guardada. Inaceptable para el operativo.
--
-- Fix: columna `zona_geom` en encuesta_zonas con el polígono 'zona' ya parseado
-- (128 geometrías), índice GiST, y resolver_zona_sesion/zona_de_punto usan eso.
-- Insert de sesión pasa de ~13 s a <5 ms.
--
-- Aditivo. Rollback: ..._rollback.sql

create extension if not exists postgis;

-- ── Helper: extrae y une los polígonos tipo='zona' de un area_geojson ──────
create or replace function public._extraer_zona_geom(p_geojson jsonb)
returns geometry
language plpgsql immutable parallel safe
set search_path to 'public', 'extensions'
as $$
declare
  v_geom geometry;
begin
  select st_makevalid(st_collect(g))
    into v_geom
  from (
    select st_setsrid(st_geomfromgeojson(feat->'geometry'), 4326) as g
    from jsonb_array_elements(coalesce(p_geojson->'features', '[]'::jsonb)) feat
    where feat->'properties'->>'tipo' = 'zona'
  ) q
  where g is not null;
  return v_geom;
exception when others then
  return null;
end;
$$;

-- ── Columna + backfill + índice ────────────────────────────────────────────
alter table public.encuesta_zonas add column if not exists zona_geom geometry(Geometry, 4326);

update public.encuesta_zonas
set zona_geom = public._extraer_zona_geom(area_geojson)
where area_geojson is not null and zona_geom is null;

create index if not exists idx_encuesta_zonas_zona_geom
  on public.encuesta_zonas using gist (zona_geom);

-- ── Trigger: mantener zona_geom cuando cambia area_geojson ─────────────────
create or replace function public.trg_encuesta_zona_geom()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  new.zona_geom := public._extraer_zona_geom(new.area_geojson);
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists encuesta_zona_geom on public.encuesta_zonas;
create trigger encuesta_zona_geom
  before insert or update of area_geojson on public.encuesta_zonas
  for each row execute function public.trg_encuesta_zona_geom();

-- ── zona_de_punto: usa zona_geom (indexado) ───────────────────────────────
create or replace function public.zona_de_punto(p_encuesta_id uuid, p_lat double precision, p_lng double precision)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select ez.id
  from public.encuesta_zonas ez
  where ez.encuesta_id = p_encuesta_id
    and p_lat is not null and p_lng is not null
    and ez.zona_geom is not null
    and st_contains(ez.zona_geom, st_setsrid(st_makepoint(p_lng, p_lat), 4326))
  order by ez.orden, ez.creado_en
  limit 1;
$$;

-- ── resolver_zona_sesion: contención + continuidad + cercanía, todo sobre zona_geom
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
    select sr.zona_id into v_cand
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
      select st_distance(ez.zona_geom::geography, v_point::geography)
        into v_dist
      from public.encuesta_zonas ez
      where ez.id = v_cand and ez.zona_geom is not null;

      if v_dist is not null and v_dist < 500 then
        out_zona_id := v_cand;
        out_metodo  := 'continuidad';
        return;
      end if;
    end if;
  end if;

  -- 3) Polígono más cercano (KNN con índice GiST)
  select ez.id into out_zona_id
  from public.encuesta_zonas ez
  where ez.encuesta_id = p_encuesta_id
    and ez.zona_geom is not null
  order by ez.zona_geom <-> v_point, ez.orden
  limit 1;

  if out_zona_id is not null then
    out_metodo := 'cercania';
  end if;
exception when others then
  out_zona_id := null;
  out_metodo  := null;
end;
$$;

-- get_stats / get_zonas_con_sesiones que hacían ST_Contains sobre area_geojson:
-- ya no lo hacen (usan sr.zona_id desde mig 6), así que no hace falta tocarlas.
