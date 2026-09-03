-- ROLLBACK migración 07 — restaura get_respuestas_por_sesion y distribuir_zonas_encuestadores originales + borra helpers

-- La forward migration dropeó la de 2 args y creó una de 3; acá dropeamos la de 3 y recreamos la de 2.
drop function if exists public.get_respuestas_por_sesion(uuid, uuid, uuid[]);

CREATE OR REPLACE FUNCTION public.get_respuestas_por_sesion(p_encuesta_id uuid, p_org_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'sesiones', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'sesion_id', sr.id,
            'respuestas', (
              SELECT jsonb_object_agg(
                r.pregunta_id::text,
                CASE
                  WHEN r.valor_booleano IS NOT NULL THEN
                    CASE r.valor_booleano WHEN true THEN 'Sí' ELSE 'No' END
                  WHEN r.opcion_id IS NOT NULL THEN
                    (SELECT op.texto FROM opciones_pregunta op WHERE op.id = r.opcion_id)
                  WHEN r.valor_numero IS NOT NULL THEN r.valor_numero::text
                  ELSE r.valor_texto
                END
              )
              FROM respuestas r
              WHERE r.sesion_id = sr.id
            )
          )
        )
        FROM sesiones_respuesta sr
        JOIN asignaciones_encuesta a ON a.id = sr.asignacion_id
        JOIN encuesta_zonas ez ON ez.id = a.encuesta_zona_id
        JOIN encuestas en ON en.id = ez.encuesta_id
        WHERE ez.encuesta_id = p_encuesta_id
          AND en.organizacion_id = p_org_id
          AND sr.completada_en IS NOT NULL
      ),
      '[]'::jsonb
    )
  ) INTO v_result;
  RETURN v_result;
END;
$function$

;

CREATE OR REPLACE FUNCTION public.distribuir_zonas_encuestadores(p_encuesta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_equipo_id   uuid;
  v_zonas       uuid[];
  v_encs        uuid[];
  n_zonas       int;
  n_encs        int;
  i             int;
  v_inserted    int := 0;
  resultado     jsonb := '[]'::jsonb;
BEGIN
  FOR v_equipo_id IN
    SELECT DISTINCT equipo_id FROM encuesta_zonas
    WHERE encuesta_id = p_encuesta_id AND equipo_id IS NOT NULL
  LOOP
    SELECT ARRAY_AGG(id ORDER BY nombre) INTO v_zonas
    FROM encuesta_zonas
    WHERE encuesta_id = p_encuesta_id AND equipo_id = v_equipo_id;

    SELECT ARRAY_AGG(encuestador_id ORDER BY encuestador_id) INTO v_encs
    FROM equipo_encuestadores WHERE equipo_id = v_equipo_id;

    n_zonas := COALESCE(array_length(v_zonas, 1), 0);
    n_encs  := COALESCE(array_length(v_encs,  1), 0);

    IF n_zonas = 0 OR n_encs = 0 THEN CONTINUE; END IF;

    DELETE FROM asignaciones_encuesta WHERE encuesta_zona_id = ANY(v_zonas);

    IF n_encs >= n_zonas THEN
      -- Más encuestadores que zonas: recorrer array de encuestadores
      -- asignando en round-robin sobre las zonas. Los sobrantes vuelven a la primera.
      FOR i IN 1..n_encs LOOP
        INSERT INTO asignaciones_encuesta (encuestador_id, encuesta_zona_id, activo)
        VALUES (v_encs[i], v_zonas[((i-1) % n_zonas) + 1], true)
        ON CONFLICT DO NOTHING;
        v_inserted := v_inserted + 1;
      END LOOP;
    ELSE
      -- Más zonas que encuestadores: recorrer array de zonas
      -- asignando encuestadores en round-robin. Los sobrantes vuelven al primero.
      FOR i IN 1..n_zonas LOOP
        INSERT INTO asignaciones_encuesta (encuestador_id, encuesta_zona_id, activo)
        VALUES (v_encs[((i-1) % n_encs) + 1], v_zonas[i], true)
        ON CONFLICT DO NOTHING;
        v_inserted := v_inserted + 1;
      END LOOP;
    END IF;

    resultado := resultado || jsonb_build_object(
      'equipo_id', v_equipo_id, 'zonas', n_zonas, 'encuestadores', n_encs, 'asignaciones', v_inserted
    );
    v_inserted := 0;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'equipos', resultado);
END;
$function$

;

drop function if exists public.asignar_zona_encuestador(uuid,uuid);
drop function if exists public.desasignar_zona_encuestador(uuid,uuid);
