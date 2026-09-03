-- Migración 19 — get_encuestas_encuestador(): fallback a encuesta_zonas
-- cuando no existe el vínculo en encuestas_equipo
--
-- Problema: la función exigía JOIN encuestas_equipo además de las zonas para
-- que un equipo cuente como asignado a la encuesta. Nada en el código (ni la
-- app móvil ni MuestreoConfig.jsx en el panel web) crea esa fila
-- automáticamente al asignar zonas a un equipo — históricamente había que
-- insertarla a mano (ver ej. migración remota "agregar_encuestas_equipo_
-- jardin_america" del 16/mayo). Resultado: un equipo con zonas y
-- encuestadores asignados correctamente podía quedar invisible en la app,
-- aunque el panel admin lo mostrara como "asignado" (esa vista sí mira
-- encuesta_zonas).
--
-- Fix: usar encuesta_zonas.equipo_id como fuente de verdad del vínculo
-- equipo↔encuesta, igual que ya hacen EncuestasCoordinador.cargar() (app
-- móvil, metr1ka-app/app/(coordinador)/encuestas.tsx) y
-- get_encuesta_config_snapshot() (migración 20260902220013 de ayer).
--   - Rama coordinador: ya exigía zonas: se saca el JOIN extra a
--     encuestas_equipo (era redundante, ahora sobra).
--   - Rama encuestador: acepta el equipo si está en encuestas_equipo O en
--     encuesta_zonas (unión), preservando el comportamiento anterior y
--     agregando el fallback.
--
-- Complementa el fix en MuestreoConfig.jsx (abrirEquipo) que ahora crea el
-- vínculo en encuestas_equipo automáticamente al abrir un equipo — esta
-- migración es la red de seguridad para encuestas ya armadas antes de ese fix.
--
-- Cambio aditivo/más permisivo, no rompe consumidores existentes.
-- Rollback: 20260902220019_get_encuestas_encuestador_fallback_zona_rollback.sql

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
      select encuesta_id, equipo_id from encuestas_equipo
      union
      select encuesta_id, equipo_id from encuesta_zonas where equipo_id is not null
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
