-- Migración 15 — get_stats_encuestadores_por_encuesta (usada por la app móvil, vista coordinador)
--
-- Dos bugs:
--  1. Fan-out: si un encuestador tiene VARIAS asignaciones activas (el caso M:N),
--     el LEFT JOIN sesiones ON encuestador_id multiplicaba los conteos por N.
--  2. "participa vacía": encuesta con pregunta 'participa' sin respuestas (Andresito)
--     → completadas = 0 para todos.
--
-- Fix: contar directo desde sesiones_respuesta por sr.encuesta_id / sr.encuestador_id
-- (una fila por sesión), y usar v_participa_ok. Equipo por el snapshot sr.equipo_id.
-- Firma y columnas de salida sin cambios. Rollback: ..._rollback.sql

create or replace function public.get_stats_encuestadores_por_encuesta(
  p_encuesta_id uuid,
  p_equipo_id uuid default null
)
returns table(encuestador_id uuid, completadas integer, no_respuesta integer, total integer, cuota integer)
language sql
stable security definer
set search_path to 'public'
as $function$
  with flags as (
    select
      exists (select 1 from preguntas where encuesta_id = p_encuesta_id and clave_base = 'participa')
      and exists (
        select 1 from respuestas r join preguntas p on p.id = r.pregunta_id
        where p.encuesta_id = p_encuesta_id and p.clave_base = 'participa'
      ) as participa_ok,
      coalesce((select (config_muestreo->>'cuota_por_encuestador')::int from encuestas where id = p_encuesta_id), 50) as cuota
  ),
  ses as (
    select
      sr.encuestador_id,
      sr.id as sesion_id,
      case
        when not (select participa_ok from flags) then
          exists (select 1 from respuestas r join preguntas p on p.id = r.pregunta_id
                  where r.sesion_id = sr.id and (p.clave_base is distinct from 'participa'))
        else
          exists (select 1 from respuestas r join preguntas p on p.id = r.pregunta_id
                  where r.sesion_id = sr.id and p.clave_base = 'participa' and r.valor_texto = 'Sí')
      end as es_completada
    from sesiones_respuesta sr
    left join encuesta_zonas ez       on ez.id = sr.zona_id
    left join equipo_encuestadores ee on ee.encuestador_id = sr.encuestador_id
    where sr.encuesta_id = p_encuesta_id
      and sr.completada_en is not null
      and (p_equipo_id is null or coalesce(sr.equipo_id, ez.equipo_id, ee.equipo_id) = p_equipo_id)
  ),
  -- encuestadores con asignación activa (aunque todavía no tengan sesiones)
  asignados as (
    select distinct ae.encuestador_id
    from asignaciones_encuesta ae
    join encuesta_zonas ez on ez.id = ae.encuesta_zona_id
    left join equipo_encuestadores ee on ee.encuestador_id = ae.encuestador_id
    where ez.encuesta_id = p_encuesta_id
      and ae.activo = true
      and (p_equipo_id is null or coalesce(ez.equipo_id, ee.equipo_id) = p_equipo_id)
  ),
  todos as (
    select encuestador_id from asignados
    union
    select encuestador_id from ses
  )
  select
    t.encuestador_id,
    count(s.sesion_id) filter (where s.es_completada)::int      as completadas,
    count(s.sesion_id) filter (where not s.es_completada)::int  as no_respuesta,
    count(s.sesion_id)::int                                     as total,
    (select cuota from flags)                                   as cuota
  from todos t
  left join ses s on s.encuestador_id = t.encuestador_id
  group by t.encuestador_id;
$function$;
