-- ROLLBACK Migración 10 — restaura get_encuesta_full de la migración 6 (sin por_zona, sin fix participa).

CREATE OR REPLACE FUNCTION public.get_encuesta_full(p_encuesta_id uuid, p_org_id uuid, p_equipo_id uuid DEFAULT NULL::uuid, p_encuestador_id uuid DEFAULT NULL::uuid, p_fecha_desde date DEFAULT NULL::date, p_fecha_hasta date DEFAULT NULL::date, p_zona_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_encuesta      json;
  v_preguntas     json;
  v_resumen       json;
  v_encuestadores json;
  v_equipos       json;
  v_respuestas    json;
  v_hay_participa boolean;
begin
  select row_to_json(e) into v_encuesta
  from encuestas e
  where e.id = p_encuesta_id and e.organizacion_id = p_org_id;

  if v_encuesta is null then return json_build_object('error', 'not_found'); end if;

  select exists (
    select 1 from respuestas r join preguntas p on p.id = r.pregunta_id
    where p.encuesta_id = p_encuesta_id and p.clave_base = 'participa'
  ) into v_hay_participa;

  select json_agg(
    json_build_object(
      'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
      'requerida', p.requerida, 'orden', p.orden,
      'es_base', p.es_base, 'clave_base', p.clave_base,
      'condicionales', p.condicionales, 'config_matriz', p.config_matriz,
      'opciones_pregunta', coalesce(opts.opciones, '[]'::json)
    ) order by p.orden
  ) into v_preguntas
  from preguntas p
  left join (
    select o.pregunta_id,
      json_agg(json_build_object('id', o.id, 'texto', o.texto, 'orden', o.orden) order by o.orden) as opciones
    from opciones_pregunta o
    join preguntas p2 on p2.id = o.pregunta_id
    where p2.encuesta_id = p_encuesta_id
    group by o.pregunta_id
  ) opts on opts.pregunta_id = p.id
  where p.encuesta_id = p_encuesta_id;

  if (v_encuesta->>'estado_produccion') in ('publicada', 'completada') then

    -- Fuente única: cada sesión completada de la encuesta, con su zona geográfica (sr.zona_id),
    -- su encuestador (sr.encuestador_id) y su equipo (de la zona, o del encuestador si la zona no tiene).
    with sesiones_encuesta as (
      select
        sr.id                                    as sesion_id,
        sr.completada_en,
        sr.latitud, sr.longitud,
        sr.encuestador_id,
        coalesce(ez.equipo_id, ee.equipo_id)     as equipo_id,
        sr.zona_id,
        eq.nombre                                as equipo_nombre,
        pf.nombre_completo,
        coalesce(ez.nombre, 'Sin zona')          as zona_nombre
      from sesiones_respuesta sr
      left join encuesta_zonas ez        on ez.id = sr.zona_id
      left join equipo_encuestadores ee  on ee.encuestador_id = sr.encuestador_id
      left join equipos eq               on eq.id = coalesce(ez.equipo_id, ee.equipo_id)
      left join perfiles pf              on pf.id = sr.encuestador_id
      where sr.encuesta_id = p_encuesta_id
        and sr.completada_en is not null
        and (p_equipo_id      is null or coalesce(ez.equipo_id, ee.equipo_id) = p_equipo_id)
        and (p_encuestador_id is null or sr.encuestador_id = p_encuestador_id)
        and (p_fecha_desde    is null or sr.completada_en::date >= p_fecha_desde)
        and (p_fecha_hasta    is null or sr.completada_en::date <= p_fecha_hasta)
        and (p_zona_ids       is null or sr.zona_id = any(p_zona_ids))
    )
    select json_build_object(
      'total_sesiones',        count(distinct sesion_id),
      'total_participaron',    case
        when v_hay_participa then count(distinct sesion_id) filter (where exists (
          select 1 from respuestas r2 join preguntas p2 on p2.id = r2.pregunta_id
          where r2.sesion_id = se.sesion_id and p2.clave_base = 'participa' and r2.valor_texto = 'Sí'
        ))
        else count(distinct sesion_id) filter (where exists (select 1 from respuestas r where r.sesion_id = se.sesion_id))
      end,
      'total_no_respondieron', case
        when v_hay_participa then count(distinct sesion_id) filter (where exists (
          select 1 from respuestas r2 join preguntas p2 on p2.id = r2.pregunta_id
          where r2.sesion_id = se.sesion_id and p2.clave_base = 'participa' and r2.valor_texto != 'Sí'
        ))
        else count(distinct sesion_id) filter (where not exists (select 1 from respuestas r where r.sesion_id = se.sesion_id))
      end,
      'encuestadores',         count(distinct encuestador_id),
      'equipos',               count(distinct equipo_id),
      'ultima_respuesta',      max(completada_en)
    ) into v_resumen
    from sesiones_encuesta se;

    with sesiones_encuesta as (
      select
        sr.id                                    as sesion_id,
        sr.completada_en,
        sr.encuestador_id,
        coalesce(ez.equipo_id, ee.equipo_id)     as equipo_id,
        eq.nombre                                as equipo_nombre,
        pf.nombre_completo,
        coalesce(ez.nombre, 'Sin zona')          as zona_nombre
      from sesiones_respuesta sr
      left join encuesta_zonas ez        on ez.id = sr.zona_id
      left join equipo_encuestadores ee  on ee.encuestador_id = sr.encuestador_id
      left join equipos eq               on eq.id = coalesce(ez.equipo_id, ee.equipo_id)
      left join perfiles pf              on pf.id = sr.encuestador_id
      where sr.encuesta_id = p_encuesta_id
        and sr.completada_en is not null
        and (p_equipo_id      is null or coalesce(ez.equipo_id, ee.equipo_id) = p_equipo_id)
        and (p_encuestador_id is null or sr.encuestador_id = p_encuestador_id)
        and (p_fecha_desde    is null or sr.completada_en::date >= p_fecha_desde)
        and (p_fecha_hasta    is null or sr.completada_en::date <= p_fecha_hasta)
        and (p_zona_ids       is null or sr.zona_id = any(p_zona_ids))
    )
    select json_agg(row_to_json(t)) into v_encuestadores
    from (
      select encuestador_id, nombre_completo, equipo_id, equipo_nombre,
        count(sesion_id) as total,
        case when v_hay_participa then count(sesion_id) filter (where exists (
          select 1 from respuestas r2 join preguntas p2 on p2.id = r2.pregunta_id
          where r2.sesion_id = se.sesion_id and p2.clave_base = 'participa' and r2.valor_texto = 'Sí'
        )) else count(sesion_id) filter (where exists (select 1 from respuestas r where r.sesion_id = se.sesion_id))
        end as completadas,
        case when v_hay_participa then count(sesion_id) filter (where exists (
          select 1 from respuestas r2 join preguntas p2 on p2.id = r2.pregunta_id
          where r2.sesion_id = se.sesion_id and p2.clave_base = 'participa' and r2.valor_texto != 'Sí'
        )) else count(sesion_id) filter (where not exists (select 1 from respuestas r where r.sesion_id = se.sesion_id))
        end as no_respuesta,
        string_agg(distinct zona_nombre, ', ' order by zona_nombre) as zonas
      from sesiones_encuesta se
      group by encuestador_id, nombre_completo, equipo_id, equipo_nombre
      order by total desc
    ) t;

    select json_agg(json_build_object('id', id, 'nombre', nombre)) into v_equipos
    from equipos where organizacion_id = p_org_id;

    with sesiones_encuesta as (
      select sr.id as sesion_id
      from sesiones_respuesta sr
      left join encuesta_zonas ez        on ez.id = sr.zona_id
      left join equipo_encuestadores ee  on ee.encuestador_id = sr.encuestador_id
      where sr.encuesta_id = p_encuesta_id
        and sr.completada_en is not null
        and (p_equipo_id      is null or coalesce(ez.equipo_id, ee.equipo_id) = p_equipo_id)
        and (p_encuestador_id is null or sr.encuestador_id = p_encuestador_id)
        and (p_fecha_desde    is null or sr.completada_en::date >= p_fecha_desde)
        and (p_fecha_hasta    is null or sr.completada_en::date <= p_fecha_hasta)
        and (p_zona_ids       is null or sr.zona_id = any(p_zona_ids))
    )
    select json_agg(row_to_json(t) order by t.pregunta_id, t.cantidad desc)
    into v_respuestas
    from (
      select r.pregunta_id, p2.tipo, p2.clave_base,
        case when p2.tipo = 'si_no' and r.valor_texto is null and r.valor_booleano is not null
          then case when r.valor_booleano then 'Sí' else 'No' end
          else r.valor_texto end as valor_texto,
        case when p2.tipo = 'si_no' then null else r.valor_numero end as valor_numero,
        null::boolean as valor_booleano,
        r.opcion_id, op.texto as opcion_texto,
        count(*)::bigint as cantidad
      from respuestas r
      join sesiones_encuesta se     on se.sesion_id = r.sesion_id
      join preguntas p2             on p2.id = r.pregunta_id
      left join opciones_pregunta op on op.id = r.opcion_id
      where p2.encuesta_id = p_encuesta_id
      group by r.pregunta_id, p2.tipo, p2.clave_base,
        case when p2.tipo = 'si_no' and r.valor_texto is null and r.valor_booleano is not null
             then case when r.valor_booleano then 'Sí' else 'No' end else r.valor_texto end,
        case when p2.tipo = 'si_no' then null else r.valor_numero end,
        r.opcion_id, op.texto
    ) t;

  end if;

  return json_build_object(
    'encuesta',      v_encuesta,
    'preguntas',     coalesce(v_preguntas,     '[]'::json),
    'resumen',       v_resumen,
    'encuestadores', coalesce(v_encuestadores, '[]'::json),
    'equipos',       coalesce(v_equipos,       '[]'::json),
    'respuestas',    coalesce(v_respuestas,    '[]'::json)
  );
end;
$function$

;
