-- Hora de FIN según el celular (completada_en_dispositivo)
--
-- Para el control de calidad por encuestador (src/lib/calidadEncuestador.js):
-- iniciada_en es la hora del CELULAR al tocar "Comenzar", pero
-- completada_en es la hora del SERVIDOR al guardar. Mezclar los dos relojes
-- da duraciones corridas por el desfase del celular (hasta ~40 s en San
-- Ignacio, set/2026) y, para encuestas guardadas sin señal y sincronizadas
-- después, un fin = hora de sincronización. Con la hora de fin del propio
-- celular, duración y superposición se miden con un solo reloj.
--
-- 1. Columna nueva sesiones_respuesta.completada_en_dispositivo (nullable:
--    sesiones viejas y apps sin actualizar quedan en null).
-- 2. guardar_encuesta_completa(): parámetro nuevo p_completada_en_dispositivo
--    al final, default null. OJO (ver 20260907070000): agregar un parámetro
--    con CREATE OR REPLACE crea un OVERLOAD nuevo en vez de reemplazar, y
--    con dos overloads que comparten nombres de parámetros los llamados de
--    supabase-js quedan ambiguos ("function is not unique") y la app no
--    puede guardar. Por eso DROP de la firma de 9 + CREATE de la de 10 en la
--    misma transacción, y se re-otorgan los permisos. La de 10 es superset:
--    las apps que llaman sin el parámetro nuevo siguen funcionando igual.
-- 3. get_respuestas_crudas(): suma 'fin_dispositivo' a cada fila (aditivo).
--
-- Rollback: 20260925010000_completada_en_dispositivo_rollback.sql

alter table public.sesiones_respuesta
  add column if not exists completada_en_dispositivo timestamptz;

drop function if exists public.guardar_encuesta_completa(uuid, numeric, numeric, jsonb, text, uuid, uuid, timestamptz, uuid);

CREATE FUNCTION public.guardar_encuesta_completa(
  p_asignacion_id uuid DEFAULT NULL::uuid,
  p_latitud numeric DEFAULT NULL::numeric,
  p_longitud numeric DEFAULT NULL::numeric,
  p_respuestas jsonb DEFAULT NULL::jsonb,
  p_razon_no_respuesta text DEFAULT NULL::text,
  p_participa_pregunta_id uuid DEFAULT NULL::uuid,
  p_encuestador_id uuid DEFAULT NULL::uuid,
  p_iniciada_en timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_idempotency_key uuid DEFAULT NULL::uuid,
  p_completada_en_dispositivo timestamp with time zone DEFAULT NULL::timestamp with time zone
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_sesion_id uuid;
  v_encuestador_id uuid;
begin
  set local statement_timeout = '90s';

  -- Idempotencia: si ya existe una sesión con esta key, devolverla tal cual
  -- (no insertar de nuevo, no pisar respuestas ya guardadas).
  if p_idempotency_key is not null then
    select id into v_sesion_id
    from sesiones_respuesta
    where idempotency_key = p_idempotency_key;

    if v_sesion_id is not null then
      return v_sesion_id;
    end if;
  end if;

  v_encuestador_id := coalesce(
    p_encuestador_id,
    (select ae.encuestador_id from asignaciones_encuesta ae where ae.id = p_asignacion_id),
    auth.uid()
  );

  begin
    insert into sesiones_respuesta (asignacion_id, encuestador_id, latitud, longitud, iniciada_en, completada_en, idempotency_key, completada_en_dispositivo)
    values (p_asignacion_id, v_encuestador_id, p_latitud, p_longitud, coalesce(p_iniciada_en, now()), now(), p_idempotency_key, p_completada_en_dispositivo)
    returning id into v_sesion_id;
  exception when unique_violation then
    -- Carrera: otra llamada con la misma key insertó primero. Devolver esa.
    select id into v_sesion_id
    from sesiones_respuesta
    where idempotency_key = p_idempotency_key;
    return v_sesion_id;
  end;

  -- Caso No Responde
  if p_razon_no_respuesta is not null and p_participa_pregunta_id is not null then
    insert into respuestas (sesion_id, pregunta_id, valor_texto)
    values (v_sesion_id, p_participa_pregunta_id, p_razon_no_respuesta);
    return v_sesion_id;
  end if;

  if p_respuestas is not null and jsonb_array_length(p_respuestas) > 0 then
    insert into respuestas (sesion_id, pregunta_id, opcion_id, valor_texto, valor_numero, valor_booleano)
    select
      v_sesion_id,
      (elem->>'pregunta_id')::uuid,
      nullif(trim(elem->>'opcion_id'), '')::uuid,
      case when elem ? 'valor_texto'    and elem->>'valor_texto'    is not null then elem->>'valor_texto'    else null end,
      case when elem ? 'valor_numero'   and elem->>'valor_numero'   is not null then (elem->>'valor_numero')::numeric else null end,
      case when elem ? 'valor_booleano' and elem->>'valor_booleano' is not null then (elem->>'valor_booleano')::boolean else null end
    from jsonb_array_elements(p_respuestas) as elem
    where elem->>'pregunta_id' is not null;
  end if;

  return v_sesion_id;
end;
$function$;

grant execute on function public.guardar_encuesta_completa(uuid, numeric, numeric, jsonb, text, uuid, uuid, timestamptz, uuid, timestamptz) to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_respuestas_crudas(p_encuesta_id uuid, p_org_id uuid, p_equipo_id uuid DEFAULT NULL::uuid, p_encuestador_id uuid DEFAULT NULL::uuid, p_fecha_desde date DEFAULT NULL::date, p_fecha_hasta date DEFAULT NULL::date, p_zona_ids uuid[] DEFAULT NULL::uuid[]) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'columnas', (
      SELECT jsonb_agg(jsonb_build_object('id', pq.id, 'texto', pq.texto, 'tipo', pq.tipo) ORDER BY pq.orden)
      FROM preguntas pq
      WHERE pq.encuesta_id = p_encuesta_id AND pq.clave_base IS DISTINCT FROM 'participa'
    ),
    'filas', (
      SELECT jsonb_agg(jsonb_build_object(
        'sesion_id',   sr.id,
        'fecha',       sr.completada_en,
        'inicio',      sr.iniciada_en,
        'fin_dispositivo', sr.completada_en_dispositivo,
        'lat',         coalesce(sr.latitud, sr.latitud_ip),
        'lng',         coalesce(sr.longitud, sr.longitud_ip),
        'origen',      sr.origen,
        'pais',        sr.pais,
        'ciudad',      sr.ciudad,
        'encuestador', p.nombre_completo,
        'equipo',      coalesce(sr.equipo_nombre, eq.nombre),
        'zona_id',     sr.zona_id,
        'zona_nombre', coalesce(sr.zona_nombre, ez.nombre),
        'respuestas',  (
          SELECT jsonb_object_agg(
            r.pregunta_id::text,
            CASE
              WHEN r.valor_booleano IS NOT NULL THEN CASE r.valor_booleano WHEN true THEN 'Sí' ELSE 'No' END
              WHEN r.opcion_id IS NOT NULL THEN (SELECT op.texto FROM opciones_pregunta op WHERE op.id = r.opcion_id)
              WHEN r.valor_numero IS NOT NULL THEN r.valor_numero::text
              ELSE r.valor_texto
            END
          )
          FROM respuestas r WHERE r.sesion_id = sr.id
        )
      ) ORDER BY sr.completada_en DESC)
      FROM sesiones_respuesta sr
      JOIN encuestas en                 ON en.id = sr.encuesta_id
      LEFT JOIN perfiles p              ON p.id = sr.encuestador_id
      LEFT JOIN encuesta_zonas ez       ON ez.id = sr.zona_id
      LEFT JOIN equipo_encuestadores ee ON ee.encuestador_id = sr.encuestador_id
      LEFT JOIN equipos eq              ON eq.id = coalesce(sr.equipo_id, ez.equipo_id, ee.equipo_id)
      WHERE sr.encuesta_id     = p_encuesta_id
        AND en.organizacion_id = p_org_id
        AND sr.completada_en IS NOT NULL
        AND (p_equipo_id      IS NULL OR coalesce(sr.equipo_id, ez.equipo_id, ee.equipo_id) = p_equipo_id)
        AND (p_encuestador_id IS NULL OR sr.encuestador_id = p_encuestador_id)
        AND (p_fecha_desde    IS NULL OR sr.completada_en::date >= p_fecha_desde)
        AND (p_fecha_hasta    IS NULL OR sr.completada_en::date <= p_fecha_hasta)
        AND (p_zona_ids       IS NULL OR sr.zona_id = ANY(p_zona_ids))
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;
