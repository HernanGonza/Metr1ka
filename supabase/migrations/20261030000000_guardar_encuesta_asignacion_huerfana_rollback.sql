-- Vuelve a la versión de 20261029010000 (con flag de GPS, sin reenganche de asignaciones huérfanas).

CREATE OR REPLACE FUNCTION public.guardar_encuesta_completa(
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
  -- (no insertar de nuevo, no pisar respuestas ya guardadas, no revalidar).
  if p_idempotency_key is not null then
    select id into v_sesion_id
    from sesiones_respuesta
    where idempotency_key = p_idempotency_key;

    if v_sesion_id is not null then
      return v_sesion_id;
    end if;
  end if;

  -- Exigir GPS en callejeras (solo si el flag está activo).
  if (p_latitud is null or p_longitud is null)
     and p_asignacion_id is not null
     and coalesce((select (valor)::text = 'true' from configuracion_sistema where clave = 'exigir_gps_en_guardado'), false)
     and exists (
       select 1
       from asignaciones_encuesta ae
       join encuestas_equipo ee on ee.id = ae.encuestas_equipo_id
       join encuestas e on e.id = ee.encuesta_id
       where ae.id = p_asignacion_id and e.tipo_encuesta = 'callejera'
     )
  then
    raise exception 'GPS_REQUERIDO: la encuesta callejera no puede guardarse sin latitud y longitud'
      using errcode = 'P0001';
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
