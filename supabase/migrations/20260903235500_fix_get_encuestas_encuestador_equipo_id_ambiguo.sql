-- Migración 20 — get_encuestas_encuestador(): fix "column reference equipo_id
-- is ambiguous"
--
-- Problema: la migración 20260902220019 agregó una subconsulta con UNION que
-- referencia la columna `equipo_id` sin calificar:
--
--   select encuesta_id, equipo_id from encuestas_equipo
--   union
--   select encuesta_id, equipo_id from encuesta_zonas where equipo_id is not null
--
-- La función devuelve `equipo_id` como columna de salida (RETURNS TABLE(...
-- equipo_id uuid ...)), y en plpgsql eso crea una variable con ese mismo
-- nombre visible en todo el cuerpo de la función. Cualquier referencia sin
-- calificar a una columna `equipo_id` dentro de una consulta ejecutada por la
-- función queda ambigua entre esa variable y la columna de la tabla.
--
-- Resultado real medido en logs: el 100% de los llamados a
-- get_encuestas_encuestador() para encuestadores (rama `else`) fallaban con
-- HTTP 400 / "column reference \"equipo_id\" is ambiguous", para cualquier
-- encuestador, en cualquier encuesta, sin importar cómo estuvieran armadas
-- las zonas o equipos. auto_asignar_encuestador() no se vio afectada (no usa
-- esa columna de salida) y por eso las asignaciones sí se creaban bien.
--
-- Fix: calificar las columnas con el nombre de tabla dentro del UNION.
-- Mismo comportamiento, sin la ambigüedad.
--
-- Rollback: 20260903235500_fix_get_encuestas_encuestador_equipo_id_ambiguo_rollback.sql

create or replace function public.get_encuestas_encuestador()
returns table(id uuid, nombre text, descripcion text, tipo_encuesta text, estado_produccion text, config_muestreo jsonb, asignacion_id uuid, zona_id uuid, zona_nombre text, zona_geojson jsonb, geofencing_activo boolean, equipo_id uuid, fecha_inicio date, fecha_fin date, todas_las_zonas jsonb)
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_rol rol_tipo := mi_rol();
begin
  if v_rol = 'coordinador' then
    return query
    select distinct on (e.id)
      e.id, e.nombre, e.descripcion, e.tipo_encuesta::text,
      e.estado_produccion::text, e.config_muestreo,
      null::uuid, ez.id, ez.nombre, ez.area_geojson, ez.geofencing_activo, ez.equipo_id,
      e.fecha_inicio, e.fecha_fin,
      (
        select jsonb_agg(jsonb_build_object(
          'asignacion_id', null,
          'zona_id', ez2.id,
          'zona_nombre', ez2.nombre,
          'zona_geojson', ez2.area_geojson
        ) order by ez2.nombre)
        from encuesta_zonas ez2
        where ez2.encuesta_id = e.id
          and ez2.equipo_id in (
            select ec.equipo_id from equipo_coordinadores ec where ec.coordinador_id = auth.uid()
          )
      ) as todas_las_zonas
    from equipo_coordinadores ec
    join encuesta_zonas ez on ez.equipo_id = ec.equipo_id
    join encuestas e on e.id = ez.encuesta_id
    where ec.coordinador_id = auth.uid()
      and e.estado_produccion = 'publicada'::estado_produccion_tipo
      and (e.fecha_inicio is null or e.fecha_inicio <= current_date)
      and (e.fecha_fin    is null or e.fecha_fin    >= current_date)
    order by e.id, ez.orden;
  else
    -- Encuestador: todas sus zonas asignadas para que pueda elegir la correcta por GPS
    return query
    select distinct on (e.id)
      e.id, e.nombre, e.descripcion, e.tipo_encuesta::text,
      e.estado_produccion::text, e.config_muestreo,
      ae.id, ez.id, ez.nombre, ez.area_geojson, ez.geofencing_activo, ez.equipo_id,
      e.fecha_inicio, e.fecha_fin,
      (
        select jsonb_agg(jsonb_build_object(
          'asignacion_id', ae2.id,
          'zona_id', ez2.id,
          'zona_nombre', ez2.nombre,
          'zona_geojson', ez2.area_geojson
        ) order by ez2.nombre)
        from asignaciones_encuesta ae2
        join encuesta_zonas ez2 on ez2.id = ae2.encuesta_zona_id
        where ae2.encuestador_id = auth.uid()
          and ae2.activo = true
          and ez2.encuesta_id = e.id
      ) as todas_las_zonas
    from equipo_encuestadores ee
    join (
      select encuestas_equipo.encuesta_id, encuestas_equipo.equipo_id from encuestas_equipo
      union
      select encuesta_zonas.encuesta_id, encuesta_zonas.equipo_id from encuesta_zonas where encuesta_zonas.equipo_id is not null
    ) eet on eet.equipo_id = ee.equipo_id
    join encuestas e on e.id = eet.encuesta_id
    left join encuesta_zonas ez on ez.encuesta_id = e.id and ez.equipo_id = ee.equipo_id
    left join asignaciones_encuesta ae on ae.encuesta_zona_id = ez.id and ae.encuestador_id = auth.uid() and ae.activo = true
    where ee.encuestador_id = auth.uid()
      and e.estado_produccion = 'publicada'::estado_produccion_tipo
      and (e.fecha_inicio is null or e.fecha_inicio <= current_date)
      and (e.fecha_fin    is null or e.fecha_fin    >= current_date)
    order by e.id, ae.id nulls last, ez.orden;
  end if;
end;
$function$;
