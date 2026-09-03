-- ROLLBACK Fase 1 · Paso 2/5 — restaura zona_de_punto() original y borra lo nuevo.

drop function if exists public.resolver_zona_sesion(uuid, double precision, double precision);

create or replace function public.zona_de_punto(p_encuesta_id uuid, p_lat double precision, p_lng double precision)
 returns uuid
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  SELECT ez.id
  FROM encuesta_zonas ez
  WHERE ez.encuesta_id = p_encuesta_id
    AND ez.area_geojson IS NOT NULL
    AND ST_Contains(
      ST_SetSRID(ST_GeomFromGeoJSON(ez.area_geojson->'features'->0->>'geometry'), 4326),
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
    )
  LIMIT 1;
$function$;

drop function if exists public._zona_feat_geom(jsonb);
