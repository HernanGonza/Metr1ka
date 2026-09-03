-- Migración 18 — get_stats_todas_encuestas(org): conteos de TODAS las encuestas en 1 query
--
-- Hoy la app móvil (y potencialmente la web) hace N llamadas a
-- get_resultados_encuesta_filtrado (una por encuesta) solo para leer 3 números,
-- y cada llamada trae el array 'respuestas' completo. Esto lo reemplaza con una
-- sola pasada sobre sesiones_respuesta.
--
-- Función nueva, aditiva. Rollback: drop.

create or replace function public.get_stats_todas_encuestas(p_org_id uuid)
returns table(encuesta_id uuid, total integer, completadas integer, no_respuesta integer)
language sql
stable security definer
set search_path to 'public'
as $$
  with enc as (
    select e.id,
      exists (select 1 from preguntas p where p.encuesta_id = e.id and p.clave_base = 'participa')
      and exists (
        select 1 from respuestas r join preguntas p on p.id = r.pregunta_id
        where p.encuesta_id = e.id and p.clave_base = 'participa'
      ) as participa_ok
    from encuestas e
    where e.organizacion_id = p_org_id
      and e.estado_produccion in ('publicada','completada')
  ),
  ses as (
    select
      sr.encuesta_id,
      sr.id,
      case
        when not en.participa_ok then exists (
          select 1 from respuestas r join preguntas p on p.id = r.pregunta_id
          where r.sesion_id = sr.id and (p.clave_base is distinct from 'participa'))
        else exists (
          select 1 from respuestas r join preguntas p on p.id = r.pregunta_id
          where r.sesion_id = sr.id and p.clave_base = 'participa' and r.valor_texto = 'Sí')
      end as completada
    from sesiones_respuesta sr
    join enc en on en.id = sr.encuesta_id
    where sr.completada_en is not null
  )
  select
    en.id                                             as encuesta_id,
    coalesce(count(s.id), 0)::int                      as total,
    coalesce(count(s.id) filter (where s.completada), 0)::int      as completadas,
    coalesce(count(s.id) filter (where not s.completada), 0)::int  as no_respuesta
  from enc en
  left join ses s on s.encuesta_id = en.id
  group by en.id;
$$;
