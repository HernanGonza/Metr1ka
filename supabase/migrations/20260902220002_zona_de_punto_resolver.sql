-- Fase 1 · Paso 2/5 — Arreglo de zona_de_punto() + nueva resolver_zona_sesion()
-- zona_de_punto() hoy es código muerto (nadie la llama en web ni móvil) y está mal:
--   mira features[0], que suele ser una 'manzana' y no el polígono 'zona'.
-- Rollback: 20260902220002_zona_de_punto_resolver_rollback.sql (restaura la versión vieja)

-- Helper: convierte un feature GeoJSON a geometry de forma segura (NULL si está mal formado).
create or replace function public._zona_feat_geom(p_feat jsonb)
returns geometry
language plpgsql immutable parallel safe
as $$
begin
  return st_setsrid(st_geomfromgeojson(p_feat->'geometry'), 4326);
exception when others then
  return null;
end;
$$;

-- zona_de_punto: zona cuyo polígono 'zona' CONTIENE el punto (o NULL).
create or replace function public.zona_de_punto(p_encuesta_id uuid, p_lat double precision, p_lng double precision)
returns uuid
language sql
stable security definer
set search_path to 'public'
as $$
  select ez.id
  from public.encuesta_zonas ez
  cross join lateral jsonb_array_elements(ez.area_geojson->'features') feat
  where ez.encuesta_id = p_encuesta_id
    and p_lat is not null and p_lng is not null
    and ez.area_geojson is not null
    and feat->'properties'->>'tipo' = 'zona'
    and public._zona_feat_geom(feat) is not null
    and st_contains(public._zona_feat_geom(feat), st_setsrid(st_makepoint(p_lng, p_lat), 4326))
  order by ez.orden, ez.creado_en
  limit 1;
$$;

-- resolver_zona_sesion: la que usan el trigger y el backfill.
--   1) el punto cae dentro de un polígono 'zona'      -> esa zona,  out_por_gps = true
--   2) hay GPS pero cae fuera de todo polígono          -> zona con el polígono más cercano, out_por_gps = false
--   3) sin GPS / sin zonas con geometría / error        -> NULL, NULL
create or replace function public.resolver_zona_sesion(
  p_encuesta_id uuid,
  p_lat double precision,
  p_lng double precision,
  out out_zona_id uuid,
  out out_por_gps boolean
)
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_point geometry;
begin
  out_zona_id := null;
  out_por_gps := null;

  if p_encuesta_id is null then
    return;
  end if;

  -- 1) Contención
  out_zona_id := public.zona_de_punto(p_encuesta_id, p_lat, p_lng);
  if out_zona_id is not null then
    out_por_gps := true;
    return;
  end if;

  -- 2) Polígono más cercano (solo con GPS)
  if p_lat is not null and p_lng is not null then
    v_point := st_setsrid(st_makepoint(p_lng, p_lat), 4326);
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
      out_por_gps := false;
      return;
    end if;
  end if;

  out_zona_id := null;
  out_por_gps := null;
exception when others then
  out_zona_id := null;
  out_por_gps := null;
end;
$$;
