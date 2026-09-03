-- Migración 11 — get_stats_por_zona: mismo fix "participa vacía" que la migración 10.
-- Si la encuesta tiene pregunta `participa` pero nunca se guardaron respuestas a
-- ella (ej. Andresito), "completada" caía a 0 para todo. Ahora: solo exige
-- participa='Sí' si esa pregunta realmente tiene respuestas.
-- Rollback: restaura la versión de la migración 5.

create or replace function public.get_stats_por_zona(p_encuesta_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $$
declare
  v_participa_ok boolean;
  v_result       jsonb;
begin
  select exists (select 1 from public.preguntas
                 where encuesta_id = p_encuesta_id and clave_base = 'participa')
     and exists (select 1 from public.respuestas r
                 join public.preguntas p on p.id = r.pregunta_id
                 where p.encuesta_id = p_encuesta_id and p.clave_base = 'participa')
  into v_participa_ok;

  with sess as (
    select
      sr.id,
      sr.zona_id,
      sr.encuestador_id,
      sr.zona_por_gps,
      case
        when v_participa_ok then exists (
          select 1 from public.respuestas r
          join public.preguntas p on p.id = r.pregunta_id
          where r.sesion_id = sr.id and p.clave_base = 'participa' and r.valor_texto = 'Sí'
        )
        else exists (
          select 1 from public.respuestas r
          join public.preguntas p on p.id = r.pregunta_id
          where r.sesion_id = sr.id and (p.clave_base is distinct from 'participa')
        )
      end as completada
    from public.sesiones_respuesta sr
    where sr.encuesta_id = p_encuesta_id
      and sr.completada_en is not null
  ),
  por_enc as (
    select s.zona_id, s.encuestador_id,
      count(*)                              as total,
      count(*) filter (where s.completada)  as completadas,
      count(*) filter (where not s.completada) as no_respuesta
    from sess s
    group by s.zona_id, s.encuestador_id
  ),
  zonas_agg as (
    select s.zona_id,
      count(*)                                 as total,
      count(*) filter (where s.completada)     as completadas,
      count(*) filter (where not s.completada) as no_respuesta,
      count(*) filter (where s.zona_por_gps is false) as fuera_de_poligono
    from sess s
    group by s.zona_id
  )
  select jsonb_build_object(
    'totales', jsonb_build_object(
      'total',             coalesce((select count(*) from sess), 0),
      'completadas',       coalesce((select count(*) from sess where completada), 0),
      'no_respuesta',      coalesce((select count(*) from sess where not completada), 0),
      'sin_zona',          coalesce((select count(*) from sess where zona_id is null), 0),
      'fuera_de_poligono', coalesce((select count(*) from sess where zona_por_gps is false), 0)
    ),
    'por_zona', coalesce((
      select jsonb_agg(t.z order by t.z_orden, t.z_nombre)
      from (
        select
          coalesce(ez.nombre, 'Sin zona') as z_nombre,
          coalesce(ez.orden, 999999)      as z_orden,
          jsonb_build_object(
            'zona_id',           za.zona_id,
            'zona_nombre',       coalesce(ez.nombre, 'Sin zona'),
            'orden',             ez.orden,
            'equipo_id',         ez.equipo_id,
            'equipo_nombre',     eq.nombre,
            'total',             za.total,
            'completadas',       za.completadas,
            'no_respuesta',      za.no_respuesta,
            'fuera_de_poligono', za.fuera_de_poligono,
            'encuestadores', coalesce((
              select jsonb_agg(jsonb_build_object(
                'encuestador_id', pe.encuestador_id,
                'nombre',         pf.nombre_completo,
                'total',          pe.total,
                'completadas',    pe.completadas,
                'no_respuesta',   pe.no_respuesta
              ) order by pe.total desc)
              from por_enc pe
              left join public.perfiles pf on pf.id = pe.encuestador_id
              where pe.zona_id is not distinct from za.zona_id
            ), '[]'::jsonb)
          ) as z
        from zonas_agg za
        left join public.encuesta_zonas ez on ez.id = za.zona_id
        left join public.equipos eq        on eq.id = ez.equipo_id
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;
