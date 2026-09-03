-- Migración 10 — get_encuesta_full: `por_zona` por encuestador + fix "participa vacía"
--
-- 1. Agrega a cada objeto de `encuestadores[]` un array `por_zona`:
--      [{ zona_id, zona_nombre, total, completadas, no_respuesta }]
--    Respeta los filtros de la función (equipo, encuestador, fechas, p_zona_ids).
-- 2. FIX: si la encuesta tiene pregunta `participa` pero NUNCA se guardaron
--    respuestas a ella (ej. "Encuesta Provincial - Andresito"), "completada"
--    caía a 0 para todo. Ahora usa el mismo criterio que
--    get_resultados_encuesta_filtrado: solo exige participa='Sí' si esa pregunta
--    realmente tiene respuestas guardadas; si no, completada = tiene respuesta.
-- Cambio aditivo (nueva key) → no rompe consumidores existentes.
-- Rollback: 20260902220010_..._rollback.sql (restaura la versión de la migración 6)

create or replace function public.get_encuesta_full(
  p_encuesta_id uuid,
  p_org_id uuid,
  p_equipo_id uuid default null,
  p_encuestador_id uuid default null,
  p_fecha_desde date default null,
  p_fecha_hasta date default null,
  p_zona_ids uuid[] default null
)
returns json
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_encuesta      json;
  v_preguntas     json;
  v_resumen       json;
  v_encuestadores json;
  v_equipos       json;
  v_respuestas    json;
  v_hay_participa boolean;
  v_participa_ok  boolean;  -- pregunta participa existe Y tiene respuestas guardadas
begin
  select row_to_json(e) into v_encuesta
  from encuestas e
  where e.id = p_encuesta_id and e.organizacion_id = p_org_id;

  if v_encuesta is null then return json_build_object('error', 'not_found'); end if;

  select exists (
    select 1 from preguntas p
    where p.encuesta_id = p_encuesta_id and p.clave_base = 'participa'
  ) into v_hay_participa;

  select v_hay_participa and exists (
    select 1 from respuestas r join preguntas p on p.id = r.pregunta_id
    where p.encuesta_id = p_encuesta_id and p.clave_base = 'participa'
  ) into v_participa_ok;

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
        when v_participa_ok then count(distinct sesion_id) filter (where exists (
          select 1 from respuestas r2 join preguntas p2 on p2.id = r2.pregunta_id
          where r2.sesion_id = se.sesion_id and p2.clave_base = 'participa' and r2.valor_texto = 'Sí'
        ))
        else count(distinct sesion_id) filter (where exists (select 1 from respuestas r where r.sesion_id = se.sesion_id))
      end,
      'total_no_respondieron', case
        when v_participa_ok then count(distinct sesion_id) filter (where exists (
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

    -- ── encuestadores + desglose por_zona ──────────────────────────────
    with sesiones_encuesta as (
      select
        sr.id                                    as sesion_id,
        sr.completada_en,
        sr.encuestador_id,
        coalesce(ez.equipo_id, ee.equipo_id)     as equipo_id,
        eq.nombre                                as equipo_nombre,
        pf.nombre_completo,
        sr.zona_id,
        coalesce(ez.nombre, 'Sin zona')          as zona_nombre,
        ez.orden                                 as zona_orden,
        case when v_participa_ok
          then exists (select 1 from respuestas r2 join preguntas p2 on p2.id = r2.pregunta_id
                       where r2.sesion_id = sr.id and p2.clave_base = 'participa' and r2.valor_texto = 'Sí')
          else exists (select 1 from respuestas r where r.sesion_id = sr.id)
        end as es_completada,
        case when v_participa_ok
          then exists (select 1 from respuestas r2 join preguntas p2 on p2.id = r2.pregunta_id
                       where r2.sesion_id = sr.id and p2.clave_base = 'participa' and r2.valor_texto <> 'Sí')
          else not exists (select 1 from respuestas r where r.sesion_id = sr.id)
        end as es_no_respuesta
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
    select json_agg(row_to_json(t) order by t.total desc) into v_encuestadores
    from (
      select
        se.encuestador_id, se.nombre_completo, se.equipo_id, se.equipo_nombre,
        count(se.sesion_id)                          as total,
        count(se.sesion_id) filter (where se.es_completada)   as completadas,
        count(se.sesion_id) filter (where se.es_no_respuesta) as no_respuesta,
        string_agg(distinct se.zona_nombre, ', ' order by se.zona_nombre) as zonas,
        (
          select json_agg(row_to_json(z) order by z.zona_orden nulls last, z.zona_nombre)
          from (
            select
              se2.zona_id,
              se2.zona_nombre,
              min(se2.zona_orden)                          as zona_orden,
              count(*)                                     as total,
              count(*) filter (where se2.es_completada)    as completadas,
              count(*) filter (where se2.es_no_respuesta)  as no_respuesta
            from sesiones_encuesta se2
            where se2.encuestador_id is not distinct from se.encuestador_id
            group by se2.zona_id, se2.zona_nombre
          ) z
        ) as por_zona
      from sesiones_encuesta se
      group by se.encuestador_id, se.nombre_completo, se.equipo_id, se.equipo_nombre
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
$function$;
