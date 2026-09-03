-- ROLLBACK Fase 2 — restaura las 4 funciones de stats a su versión original (pre-zona_id).
-- Generado de pg_get_functiondef ANTES de aplicar la Fase 2.

-- ============ get_zonas_con_sesiones ============
CREATE OR REPLACE FUNCTION public.get_zonas_con_sesiones(p_encuesta_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',           ez.id,
      'nombre',       ez.nombre,
      'orden',        ez.orden,
      'area_geojson', ez.area_geojson,
      'sesiones',     COALESCE(s.total, 0)
    ) ORDER BY ez.orden, ez.nombre
  )
  FROM encuesta_zonas ez
  LEFT JOIN (
    -- Contar sesiones cuyo GPS cae dentro del polígono (sin importar asignación)
    SELECT ez2.id as zona_id, COUNT(DISTINCT sr.id) as total
    FROM encuesta_zonas ez2
    JOIN asignaciones_encuesta ae ON ae.encuesta_zona_id IN (
      SELECT id FROM encuesta_zonas WHERE encuesta_id = p_encuesta_id
    )
    JOIN sesiones_respuesta sr ON sr.asignacion_id = ae.id
      AND sr.completada_en IS NOT NULL
      AND sr.latitud  IS NOT NULL
      AND sr.longitud IS NOT NULL
    WHERE ez2.encuesta_id = p_encuesta_id
      AND ez2.area_geojson IS NOT NULL
      AND ST_Contains(
        ST_SetSRID(ST_GeomFromGeoJSON(ez2.area_geojson->'features'->0->>'geometry'), 4326),
        ST_SetSRID(ST_MakePoint(sr.longitud, sr.latitud), 4326)
      )
    GROUP BY ez2.id
  ) s ON s.zona_id = ez.id
  WHERE ez.encuesta_id = p_encuesta_id;
$function$

;

-- ============ get_resultados_encuesta_filtrado ============
CREATE OR REPLACE FUNCTION public.get_resultados_encuesta_filtrado(p_encuesta_id uuid, p_equipo_id uuid DEFAULT NULL::uuid, p_zona_id uuid DEFAULT NULL::uuid, p_encuestador_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_result             jsonb;
  v_hay_participa      boolean;
  v_participa_guardada boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM preguntas WHERE encuesta_id = p_encuesta_id AND clave_base = 'participa'
  ) INTO v_hay_participa;

  SELECT EXISTS (
    SELECT 1 FROM respuestas r
    JOIN preguntas p ON p.id = r.pregunta_id
    JOIN sesiones_respuesta sr ON sr.id = r.sesion_id
    JOIN asignaciones_encuesta ae ON ae.id = sr.asignacion_id
    JOIN encuesta_zonas ez ON ez.id = ae.encuesta_zona_id
    WHERE ez.encuesta_id = p_encuesta_id AND p.clave_base = 'participa'
  ) INTO v_participa_guardada;

  -- Macro para determinar si una sesión es "completada"
  -- Si participa se guarda: completada = tiene Sí en participa
  -- Si NO se guarda: completada = tiene al menos una respuesta en preguntas normales
  SELECT jsonb_build_object(
    'total_sesiones',    COUNT(DISTINCT sr.id),
    'total_completadas', COUNT(DISTINCT sr.id) FILTER (WHERE
      CASE
        WHEN v_hay_participa AND v_participa_guardada THEN EXISTS (
          SELECT 1 FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
          WHERE r.sesion_id = sr.id AND p.clave_base = 'participa' AND r.valor_texto = 'Sí'
        )
        ELSE EXISTS (
          SELECT 1 FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
          WHERE r.sesion_id = sr.id AND (p.clave_base IS NULL OR p.clave_base != 'participa')
        )
      END
    ),
    'total_no_respuesta', COUNT(DISTINCT sr.id) FILTER (WHERE
      CASE
        WHEN v_hay_participa AND v_participa_guardada THEN NOT EXISTS (
          SELECT 1 FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
          WHERE r.sesion_id = sr.id AND p.clave_base = 'participa' AND r.valor_texto = 'Sí'
        )
        ELSE NOT EXISTS (
          SELECT 1 FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
          WHERE r.sesion_id = sr.id AND (p.clave_base IS NULL OR p.clave_base != 'participa')
        )
      END
    ),
    'total_hoy', COUNT(DISTINCT sr.id) FILTER (WHERE
      sr.completada_en::date = CURRENT_DATE AND
      CASE
        WHEN v_hay_participa AND v_participa_guardada THEN EXISTS (
          SELECT 1 FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
          WHERE r.sesion_id = sr.id AND p.clave_base = 'participa' AND r.valor_texto = 'Sí'
        )
        ELSE EXISTS (
          SELECT 1 FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
          WHERE r.sesion_id = sr.id AND (p.clave_base IS NULL OR p.clave_base != 'participa')
        )
      END
    ),
    'respuestas', (
      SELECT jsonb_agg(jsonb_build_object(
        'pregunta_id',    r.pregunta_id,
        'valor_texto',    r.valor_texto,
        'valor_numero',   r.valor_numero,
        'valor_booleano', r.valor_booleano,
        'opcion_id',      r.opcion_id
      ))
      FROM respuestas r
      JOIN sesiones_respuesta sr2 ON sr2.id = r.sesion_id
      JOIN asignaciones_encuesta ae2 ON ae2.id = sr2.asignacion_id
      JOIN encuesta_zonas ez2 ON ez2.id = ae2.encuesta_zona_id
      JOIN preguntas p2 ON p2.id = r.pregunta_id
      WHERE ez2.encuesta_id = p_encuesta_id
        AND (p_equipo_id      IS NULL OR ez2.equipo_id      = p_equipo_id)
        AND (p_zona_id        IS NULL OR ez2.id             = p_zona_id)
        AND (p_encuestador_id IS NULL OR ae2.encuestador_id = p_encuestador_id)
        AND sr2.completada_en IS NOT NULL
        AND (p2.clave_base IS NULL OR p2.clave_base != 'participa')
    ),
    'por_dia', (
      SELECT jsonb_agg(jsonb_build_object('dia', fecha_dia, 'total', total) ORDER BY fecha_dia)
      FROM (
        SELECT sr3.completada_en::date AS fecha_dia, COUNT(*) AS total
        FROM sesiones_respuesta sr3
        JOIN asignaciones_encuesta ae3 ON ae3.id = sr3.asignacion_id
        JOIN encuesta_zonas ez3 ON ez3.id = ae3.encuesta_zona_id
        WHERE ez3.encuesta_id = p_encuesta_id
          AND (p_equipo_id      IS NULL OR ez3.equipo_id      = p_equipo_id)
          AND (p_zona_id        IS NULL OR ez3.id             = p_zona_id)
          AND (p_encuestador_id IS NULL OR ae3.encuestador_id = p_encuestador_id)
          AND sr3.completada_en IS NOT NULL
          AND CASE
            WHEN v_hay_participa AND v_participa_guardada THEN EXISTS (
              SELECT 1 FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
              WHERE r.sesion_id = sr3.id AND p.clave_base = 'participa' AND r.valor_texto = 'Sí'
            )
            ELSE EXISTS (
              SELECT 1 FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
              WHERE r.sesion_id = sr3.id AND (p.clave_base IS NULL OR p.clave_base != 'participa')
            )
          END
        GROUP BY fecha_dia ORDER BY fecha_dia DESC LIMIT 14
      ) sub
    )
  ) INTO v_result
  FROM sesiones_respuesta sr
  JOIN asignaciones_encuesta ae ON ae.id = sr.asignacion_id
  JOIN encuesta_zonas ez ON ez.id = ae.encuesta_zona_id
  WHERE ez.encuesta_id = p_encuesta_id
    AND (p_equipo_id      IS NULL OR ez.equipo_id      = p_equipo_id)
    AND (p_zona_id        IS NULL OR ez.id             = p_zona_id)
    AND (p_encuestador_id IS NULL OR ae.encuestador_id = p_encuestador_id)
    AND sr.completada_en IS NOT NULL;

  RETURN v_result;
END;
$function$

;

-- ============ get_respuestas_crudas ============
CREATE OR REPLACE FUNCTION public.get_respuestas_crudas(p_encuesta_id uuid, p_org_id uuid, p_equipo_id uuid DEFAULT NULL::uuid, p_encuestador_id uuid DEFAULT NULL::uuid, p_fecha_desde date DEFAULT NULL::date, p_fecha_hasta date DEFAULT NULL::date, p_zona_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        'lat',         sr.latitud,
        'lng',         sr.longitud,
        'encuestador', p.nombre_completo,
        'equipo',      eq.nombre,
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
      JOIN asignaciones_encuesta a  ON a.id = sr.asignacion_id
      JOIN encuesta_zonas ez        ON ez.id = a.encuesta_zona_id
      JOIN encuestas en             ON en.id = ez.encuesta_id
      JOIN perfiles p               ON p.id = a.encuestador_id
      LEFT JOIN equipo_encuestadores ee ON ee.encuestador_id = a.encuestador_id
      LEFT JOIN equipos eq          ON eq.id = ee.equipo_id
      WHERE ez.encuesta_id    = p_encuesta_id
        AND en.organizacion_id = p_org_id
        AND sr.completada_en IS NOT NULL
        AND (p_equipo_id      IS NULL OR ee.equipo_id     = p_equipo_id)
        AND (p_encuestador_id IS NULL OR a.encuestador_id = p_encuestador_id)
        AND (p_fecha_desde    IS NULL OR sr.completada_en::date >= p_fecha_desde)
        AND (p_fecha_hasta    IS NULL OR sr.completada_en::date <= p_fecha_hasta)
        AND (p_zona_ids IS NULL OR (
          sr.latitud IS NOT NULL AND sr.longitud IS NOT NULL AND
          EXISTS (
            SELECT 1 FROM encuesta_zonas ez2
            WHERE ez2.id = ANY(p_zona_ids)
              AND ez2.area_geojson IS NOT NULL
              AND ST_Contains(
                ST_SetSRID(ST_GeomFromGeoJSON(ez2.area_geojson->'features'->0->>'geometry'), 4326),
                ST_SetSRID(ST_MakePoint(sr.longitud, sr.latitud), 4326)
              )
          )
        ))
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$

;

-- ============ get_encuesta_full ============
CREATE OR REPLACE FUNCTION public.get_encuesta_full(p_encuesta_id uuid, p_org_id uuid, p_equipo_id uuid DEFAULT NULL::uuid, p_encuestador_id uuid DEFAULT NULL::uuid, p_fecha_desde date DEFAULT NULL::date, p_fecha_hasta date DEFAULT NULL::date, p_zona_ids uuid[] DEFAULT NULL::uuid[])
 RETURNS json
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_encuesta      json;
  v_preguntas     json;
  v_resumen       json;
  v_encuestadores json;
  v_equipos       json;
  v_respuestas    json;
  v_hay_participa boolean;
BEGIN
  SELECT row_to_json(e) INTO v_encuesta
  FROM encuestas e
  WHERE e.id = p_encuesta_id AND e.organizacion_id = p_org_id;

  IF v_encuesta IS NULL THEN RETURN json_build_object('error', 'not_found'); END IF;

  SELECT EXISTS (
    SELECT 1 FROM respuestas r JOIN preguntas p ON p.id = r.pregunta_id
    WHERE p.encuesta_id = p_encuesta_id AND p.clave_base = 'participa'
  ) INTO v_hay_participa;

  SELECT json_agg(
    json_build_object(
      'id', p.id, 'texto', p.texto, 'tipo', p.tipo,
      'requerida', p.requerida, 'orden', p.orden,
      'es_base', p.es_base, 'clave_base', p.clave_base,
      'condicionales', p.condicionales, 'config_matriz', p.config_matriz,
      'opciones_pregunta', COALESCE(opts.opciones, '[]'::json)
    ) ORDER BY p.orden
  ) INTO v_preguntas
  FROM preguntas p
  LEFT JOIN (
    SELECT o.pregunta_id,
      json_agg(json_build_object('id', o.id, 'texto', o.texto, 'orden', o.orden) ORDER BY o.orden) AS opciones
    FROM opciones_pregunta o
    JOIN preguntas p2 ON p2.id = o.pregunta_id
    WHERE p2.encuesta_id = p_encuesta_id
    GROUP BY o.pregunta_id
  ) opts ON opts.pregunta_id = p.id
  WHERE p.encuesta_id = p_encuesta_id;

  IF (v_encuesta->>'estado_produccion') IN ('publicada', 'completada') THEN

    WITH sesiones_encuesta AS (
      SELECT sr.id as sesion_id, sr.completada_en, sr.latitud, sr.longitud,
             ae.encuestador_id, ez.equipo_id, ez.id as zona_id
      FROM encuesta_zonas ez
      JOIN asignaciones_encuesta ae ON ae.encuesta_zona_id = ez.id
      JOIN sesiones_respuesta sr    ON sr.asignacion_id = ae.id
      WHERE ez.encuesta_id = p_encuesta_id AND sr.completada_en IS NOT NULL
        AND (p_equipo_id      IS NULL OR ez.equipo_id      = p_equipo_id)
        AND (p_encuestador_id IS NULL OR ae.encuestador_id = p_encuestador_id)
        AND (p_fecha_desde    IS NULL OR sr.completada_en::date >= p_fecha_desde)
        AND (p_fecha_hasta    IS NULL OR sr.completada_en::date <= p_fecha_hasta)
      UNION
      SELECT sr.id, sr.completada_en, sr.latitud, sr.longitud,
             NULL::uuid, ez.equipo_id, ez.id
      FROM sesiones_respuesta sr
      JOIN encuesta_zonas ez ON ez.encuesta_id = p_encuesta_id
      WHERE sr.completada_en IS NOT NULL
        AND sr.latitud IS NOT NULL AND sr.longitud IS NOT NULL
        AND (p_fecha_desde IS NULL OR sr.completada_en::date >= p_fecha_desde)
        AND (p_fecha_hasta IS NULL OR sr.completada_en::date <= p_fecha_hasta)
        AND NOT EXISTS (
          SELECT 1 FROM asignaciones_encuesta ae2
          JOIN encuesta_zonas ez2 ON ez2.id = ae2.encuesta_zona_id
          WHERE ae2.id = sr.asignacion_id AND ez2.encuesta_id = p_encuesta_id
        )
        AND EXISTS (SELECT 1 FROM preguntas p WHERE p.encuesta_id = p_encuesta_id
                    AND EXISTS (SELECT 1 FROM respuestas r WHERE r.sesion_id = sr.id AND r.pregunta_id = p.id))
    )
    SELECT json_build_object(
      'total_sesiones',        COUNT(DISTINCT sesion_id),
      'total_participaron',    CASE
        WHEN v_hay_participa THEN COUNT(DISTINCT sesion_id) FILTER (WHERE EXISTS (
          SELECT 1 FROM respuestas r2 JOIN preguntas p2 ON p2.id = r2.pregunta_id
          WHERE r2.sesion_id = se.sesion_id AND p2.clave_base = 'participa' AND r2.valor_texto = 'Sí'
        ))
        ELSE COUNT(DISTINCT sesion_id) FILTER (WHERE EXISTS (SELECT 1 FROM respuestas r WHERE r.sesion_id = se.sesion_id))
      END,
      'total_no_respondieron', CASE
        WHEN v_hay_participa THEN COUNT(DISTINCT sesion_id) FILTER (WHERE EXISTS (
          SELECT 1 FROM respuestas r2 JOIN preguntas p2 ON p2.id = r2.pregunta_id
          WHERE r2.sesion_id = se.sesion_id AND p2.clave_base = 'participa' AND r2.valor_texto != 'Sí'
        ))
        ELSE COUNT(DISTINCT sesion_id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM respuestas r WHERE r.sesion_id = se.sesion_id))
      END,
      'encuestadores',         COUNT(DISTINCT encuestador_id),
      'equipos',               COUNT(DISTINCT equipo_id),
      'ultima_respuesta',      MAX(completada_en)
    ) INTO v_resumen
    FROM sesiones_encuesta se;

    WITH sesiones_encuesta AS (
      SELECT sr.id as sesion_id, sr.completada_en,
             ae.encuestador_id, ez.equipo_id, eq.nombre as equipo_nombre, p.nombre_completo,
             ez.nombre as zona_nombre
      FROM encuesta_zonas ez
      JOIN asignaciones_encuesta ae ON ae.encuesta_zona_id = ez.id
      JOIN sesiones_respuesta sr    ON sr.asignacion_id = ae.id
      JOIN perfiles p               ON p.id = ae.encuestador_id
      JOIN equipos eq               ON eq.id = ez.equipo_id
      WHERE ez.encuesta_id = p_encuesta_id AND sr.completada_en IS NOT NULL
        AND (p_equipo_id      IS NULL OR ez.equipo_id      = p_equipo_id)
        AND (p_encuestador_id IS NULL OR ae.encuestador_id = p_encuestador_id)
        AND (p_fecha_desde    IS NULL OR sr.completada_en::date >= p_fecha_desde)
        AND (p_fecha_hasta    IS NULL OR sr.completada_en::date <= p_fecha_hasta)
      UNION
      SELECT sr.id, sr.completada_en,
             NULL::uuid, ez.equipo_id, eq.nombre, 'Sin asignar', '—'
      FROM sesiones_respuesta sr
      JOIN encuesta_zonas ez ON ez.encuesta_id = p_encuesta_id
      JOIN equipos eq ON eq.id = ez.equipo_id
      WHERE sr.completada_en IS NOT NULL
        AND sr.latitud IS NOT NULL AND sr.longitud IS NOT NULL
        AND (p_fecha_desde IS NULL OR sr.completada_en::date >= p_fecha_desde)
        AND (p_fecha_hasta IS NULL OR sr.completada_en::date <= p_fecha_hasta)
        AND NOT EXISTS (
          SELECT 1 FROM asignaciones_encuesta ae2
          JOIN encuesta_zonas ez2 ON ez2.id = ae2.encuesta_zona_id
          WHERE ae2.id = sr.asignacion_id AND ez2.encuesta_id = p_encuesta_id
        )
        AND EXISTS (SELECT 1 FROM preguntas p WHERE p.encuesta_id = p_encuesta_id
                    AND EXISTS (SELECT 1 FROM respuestas r WHERE r.sesion_id = sr.id AND r.pregunta_id = p.id))
    )
    SELECT json_agg(row_to_json(t)) INTO v_encuestadores
    FROM (
      SELECT encuestador_id, nombre_completo, equipo_id, equipo_nombre,
        COUNT(sesion_id) AS total,
        CASE WHEN v_hay_participa THEN COUNT(sesion_id) FILTER (WHERE EXISTS (
          SELECT 1 FROM respuestas r2 JOIN preguntas p2 ON p2.id = r2.pregunta_id
          WHERE r2.sesion_id = se.sesion_id AND p2.clave_base = 'participa' AND r2.valor_texto = 'Sí'
        )) ELSE COUNT(sesion_id) FILTER (WHERE EXISTS (SELECT 1 FROM respuestas r WHERE r.sesion_id = se.sesion_id))
        END AS completadas,
        CASE WHEN v_hay_participa THEN COUNT(sesion_id) FILTER (WHERE EXISTS (
          SELECT 1 FROM respuestas r2 JOIN preguntas p2 ON p2.id = r2.pregunta_id
          WHERE r2.sesion_id = se.sesion_id AND p2.clave_base = 'participa' AND r2.valor_texto != 'Sí'
        )) ELSE COUNT(sesion_id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM respuestas r WHERE r.sesion_id = se.sesion_id))
        END AS no_respuesta,
        STRING_AGG(DISTINCT zona_nombre, ', ' ORDER BY zona_nombre) AS zonas
      FROM sesiones_encuesta se
      GROUP BY encuestador_id, nombre_completo, equipo_id, equipo_nombre
      ORDER BY total DESC
    ) t;

    SELECT json_agg(json_build_object('id', id, 'nombre', nombre)) INTO v_equipos
    FROM equipos WHERE organizacion_id = p_org_id;

    WITH sesiones_encuesta AS (
      SELECT sr.id as sesion_id, sr.completada_en, ae.encuestador_id, ez.equipo_id
      FROM encuesta_zonas ez
      JOIN asignaciones_encuesta ae ON ae.encuesta_zona_id = ez.id
      JOIN sesiones_respuesta sr    ON sr.asignacion_id = ae.id
      WHERE ez.encuesta_id = p_encuesta_id AND sr.completada_en IS NOT NULL
        AND (p_equipo_id      IS NULL OR ez.equipo_id      = p_equipo_id)
        AND (p_encuestador_id IS NULL OR ae.encuestador_id = p_encuestador_id)
        AND (p_fecha_desde    IS NULL OR sr.completada_en::date >= p_fecha_desde)
        AND (p_fecha_hasta    IS NULL OR sr.completada_en::date <= p_fecha_hasta)
      UNION
      SELECT sr.id, sr.completada_en, NULL::uuid, ez.equipo_id
      FROM sesiones_respuesta sr
      JOIN encuesta_zonas ez ON ez.encuesta_id = p_encuesta_id
      WHERE sr.completada_en IS NOT NULL
        AND sr.latitud IS NOT NULL AND sr.longitud IS NOT NULL
        AND (p_fecha_desde IS NULL OR sr.completada_en::date >= p_fecha_desde)
        AND (p_fecha_hasta IS NULL OR sr.completada_en::date <= p_fecha_hasta)
        AND NOT EXISTS (
          SELECT 1 FROM asignaciones_encuesta ae2
          JOIN encuesta_zonas ez2 ON ez2.id = ae2.encuesta_zona_id
          WHERE ae2.id = sr.asignacion_id AND ez2.encuesta_id = p_encuesta_id
        )
        AND EXISTS (SELECT 1 FROM preguntas p WHERE p.encuesta_id = p_encuesta_id
                    AND EXISTS (SELECT 1 FROM respuestas r WHERE r.sesion_id = sr.id AND r.pregunta_id = p.id))
    )
    SELECT json_agg(row_to_json(t) ORDER BY t.pregunta_id, t.cantidad DESC)
    INTO v_respuestas
    FROM (
      SELECT r.pregunta_id, p2.tipo, p2.clave_base,
        CASE WHEN p2.tipo = 'si_no' AND r.valor_texto IS NULL AND r.valor_booleano IS NOT NULL
          THEN CASE WHEN r.valor_booleano THEN 'Sí' ELSE 'No' END
          ELSE r.valor_texto END AS valor_texto,
        CASE WHEN p2.tipo = 'si_no' THEN NULL ELSE r.valor_numero END AS valor_numero,
        NULL::boolean AS valor_booleano,
        r.opcion_id, op.texto AS opcion_texto,
        COUNT(*)::bigint AS cantidad
      FROM respuestas r
      JOIN sesiones_encuesta se     ON se.sesion_id = r.sesion_id
      JOIN preguntas p2             ON p2.id = r.pregunta_id
      LEFT JOIN opciones_pregunta op ON op.id = r.opcion_id
      WHERE p2.encuesta_id = p_encuesta_id
      GROUP BY r.pregunta_id, p2.tipo, p2.clave_base,
        CASE WHEN p2.tipo = 'si_no' AND r.valor_texto IS NULL AND r.valor_booleano IS NOT NULL
             THEN CASE WHEN r.valor_booleano THEN 'Sí' ELSE 'No' END ELSE r.valor_texto END,
        CASE WHEN p2.tipo = 'si_no' THEN NULL ELSE r.valor_numero END,
        r.opcion_id, op.texto
    ) t;

  END IF;

  RETURN json_build_object(
    'encuesta',      v_encuesta,
    'preguntas',     COALESCE(v_preguntas,     '[]'::json),
    'resumen',       v_resumen,
    'encuestadores', COALESCE(v_encuestadores, '[]'::json),
    'equipos',       COALESCE(v_equipos,       '[]'::json),
    'respuestas',    COALESCE(v_respuestas,    '[]'::json)
  );
END;
$function$

;
