-- get_resultados_encuesta_filtrado(): dejar de perder sesiones online (y
-- cualquier sesión de campo con asignacion_id huérfano) por el mismo bug
-- ya documentado y resuelto en get_respuestas_crudas
-- (20260907150000_get_respuestas_crudas_zona_denormalizada.sql): esta
-- función arma su FROM con
--   JOIN asignaciones_encuesta ae ON ae.id = sr.asignacion_id
--   JOIN encuesta_zonas ez        ON ez.id = ae.encuesta_zona_id
-- Como son INNER JOIN, cualquier sesión sin asignacion_id desaparece
-- entera. Una sesión online NUNCA tiene asignacion_id (no hay zona ni
-- encuestador), así que esta función siempre devolvía 0 para encuestas
-- online — es lo que hacía que `app/(admin)/encuestas.tsx` y
-- `app/(admin)/encuesta/[id].tsx` en metr1ka-app mostraran "0 respuestas"
-- para una encuesta online que en realidad ya tenía respuestas guardadas.
--
-- Fix: usar sesiones_respuesta.zona_id / equipo_id / encuestador_id
-- (denormalizados en la sesión misma, resueltos al completarla — ver
-- 20260902220012_snapshot_equipo_historico.sql) en vez de derivarlos por
-- INNER JOIN contra la asignación administrativa. Mismo criterio ya usado
-- en get_respuestas_crudas y get_encuesta_full.
--
-- Rollback: 20260913010000_..._rollback.sql (restaura el body con INNER
-- JOIN vigente antes de este cambio)

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
    WHERE sr.encuesta_id = p_encuesta_id AND p.clave_base = 'participa'
  ) INTO v_participa_guardada;

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
    'promedio_segundos', (
      SELECT AVG(EXTRACT(EPOCH FROM (sr4.completada_en - sr4.iniciada_en)))
      FROM sesiones_respuesta sr4
      LEFT JOIN encuesta_zonas ez4       ON ez4.id = sr4.zona_id
      LEFT JOIN equipo_encuestadores ee4 ON ee4.encuestador_id = sr4.encuestador_id
      WHERE sr4.encuesta_id = p_encuesta_id
        AND (p_equipo_id      IS NULL OR coalesce(sr4.equipo_id, ez4.equipo_id, ee4.equipo_id) = p_equipo_id)
        AND (p_zona_id        IS NULL OR sr4.zona_id        = p_zona_id)
        AND (p_encuestador_id IS NULL OR sr4.encuestador_id = p_encuestador_id)
        AND sr4.completada_en IS NOT NULL
        AND sr4.iniciada_en   IS NOT NULL
        AND sr4.completada_en > sr4.iniciada_en
    ),
    'tiempo_objetivo_minutos', (SELECT e.tiempo_objetivo_minutos FROM encuestas e WHERE e.id = p_encuesta_id),
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
      LEFT JOIN encuesta_zonas ez2       ON ez2.id = sr2.zona_id
      LEFT JOIN equipo_encuestadores ee2 ON ee2.encuestador_id = sr2.encuestador_id
      JOIN preguntas p2 ON p2.id = r.pregunta_id
      WHERE sr2.encuesta_id = p_encuesta_id
        AND (p_equipo_id      IS NULL OR coalesce(sr2.equipo_id, ez2.equipo_id, ee2.equipo_id) = p_equipo_id)
        AND (p_zona_id        IS NULL OR sr2.zona_id        = p_zona_id)
        AND (p_encuestador_id IS NULL OR sr2.encuestador_id = p_encuestador_id)
        AND sr2.completada_en IS NOT NULL
        AND (p2.clave_base IS NULL OR p2.clave_base != 'participa')
    ),
    'por_dia', (
      SELECT jsonb_agg(jsonb_build_object('dia', fecha_dia, 'total', total) ORDER BY fecha_dia)
      FROM (
        SELECT sr3.completada_en::date AS fecha_dia, COUNT(*) AS total
        FROM sesiones_respuesta sr3
        LEFT JOIN encuesta_zonas ez3       ON ez3.id = sr3.zona_id
        LEFT JOIN equipo_encuestadores ee3 ON ee3.encuestador_id = sr3.encuestador_id
        WHERE sr3.encuesta_id = p_encuesta_id
          AND (p_equipo_id      IS NULL OR coalesce(sr3.equipo_id, ez3.equipo_id, ee3.equipo_id) = p_equipo_id)
          AND (p_zona_id        IS NULL OR sr3.zona_id        = p_zona_id)
          AND (p_encuestador_id IS NULL OR sr3.encuestador_id = p_encuestador_id)
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
  LEFT JOIN encuesta_zonas ez       ON ez.id = sr.zona_id
  LEFT JOIN equipo_encuestadores ee ON ee.encuestador_id = sr.encuestador_id
  WHERE sr.encuesta_id = p_encuesta_id
    AND (p_equipo_id      IS NULL OR coalesce(sr.equipo_id, ez.equipo_id, ee.equipo_id) = p_equipo_id)
    AND (p_zona_id        IS NULL OR sr.zona_id        = p_zona_id)
    AND (p_encuestador_id IS NULL OR sr.encuestador_id = p_encuestador_id)
    AND sr.completada_en IS NOT NULL;

  RETURN v_result;
END;
$function$;
