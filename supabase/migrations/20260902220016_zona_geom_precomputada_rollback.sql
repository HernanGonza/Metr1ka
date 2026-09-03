-- ROLLBACK Migración 16
drop trigger if exists encuesta_zona_geom on public.encuesta_zonas;
drop function if exists public.trg_encuesta_zona_geom();
CREATE OR REPLACE FUNCTION public.zona_de_punto(p_encuesta_id uuid, p_lat double precision, p_lng double precision)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$

;
CREATE OR REPLACE FUNCTION public.resolver_zona_sesion(p_encuesta_id uuid, p_lat double precision, p_lng double precision, p_encuestador_id uuid DEFAULT NULL::uuid, p_fecha timestamp with time zone DEFAULT NULL::timestamp with time zone, OUT out_zona_id uuid, OUT out_metodo text)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$

;
drop index if exists public.idx_encuesta_zonas_zona_geom;
alter table public.encuesta_zonas drop column if exists zona_geom;
drop function if exists public._extraer_zona_geom(jsonb);
