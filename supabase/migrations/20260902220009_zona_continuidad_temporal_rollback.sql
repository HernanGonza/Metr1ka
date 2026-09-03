-- ROLLBACK Migración 9 — quita continuidad temporal y zona_metodo.
-- Restaura resolver_zona_sesion (3 args, out_por_gps) y el trigger de la migración 3.

drop function if exists public.resolver_zona_sesion(uuid,double precision,double precision,uuid,timestamptz);

CREATE OR REPLACE FUNCTION public.resolver_zona_sesion(p_encuesta_id uuid, p_lat double precision, p_lng double precision, OUT out_zona_id uuid, OUT out_por_gps boolean)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_point geometry;
begin
  out_zona_id := null;
  out_por_gps := null;

  if p_encuesta_id is null then
    return;
  end if;

  out_zona_id := public.zona_de_punto(p_encuesta_id, p_lat, p_lng);
  if out_zona_id is not null then
    out_por_gps := true;
    return;
  end if;

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
$function$

;

CREATE OR REPLACE FUNCTION public.trg_sesion_resolver_zona()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    select out_zona_id, out_por_gps
      into v_res
    from public.resolver_zona_sesion(new.encuesta_id, new.latitud, new.longitud);

    new.zona_id      := v_res.out_zona_id;
    new.zona_por_gps := v_res.out_por_gps;
  end if;

  return new;
exception when others then
  return new;
end;
$function$

;

drop index if exists public.idx_sesiones_resp_enc_temporal;
alter table public.sesiones_respuesta drop column if exists zona_metodo;
