-- get_respuestas_crudas(): sumar ubicación por IP para sesiones online
--
-- Primer paso de la separación de encuestas online del panel admin/gestor
-- (hoy comparten pantalla y RPCs con las encuestas de campo, mostrando
-- datos que no aplican — ver PLAN en la conversación). Esta función arma
-- lat/lng SOLO desde sr.latitud/longitud (GPS de campo), así que para una
-- sesión origen='online' (que nunca tiene GPS, solo latitud_ip/longitud_ip
-- — ver 20260912130000_encuestas_online_backend.sql) el mapa quedaba
-- siempre vacío.
--
-- Cambio: lat/lng usan coalesce(GPS, IP) — para encuestas de campo
-- latitud_ip/longitud_ip siempre es null, así que el resultado no cambia.
-- Se suman además pais/ciudad/origen a cada fila (aditivo, no rompe a
-- ningún consumidor existente que no las lea: ReporteVisualZona,
-- reportesAutomaticos.js, EncuestaDetalle.jsx).
--
-- Rollback: 20260913000000_get_respuestas_crudas_online_ip_rollback.sql

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
