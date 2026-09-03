-- Migración 7 — Soporte para reforzar zonas en medio del operativo
--
-- 1. distribuir_zonas_encuestadores: NO destructivo. Antes hacía DELETE de todas
--    las asignaciones de las zonas antes de repartir en round-robin → borraba
--    cualquier refuerzo manual. Ahora solo AGREGA (ON CONFLICT DO NOTHING).
-- 2. get_respuestas_por_sesion: pasa a basarse en sesiones_respuesta.encuesta_id
--    (igual que get_encuesta_full) y acepta p_zona_ids opcional.
-- Rollback: 20260902220007_asignacion_mid_operativo_rollback.sql

-- ═══════════════════════════════════════════════════════════════════
-- 1. distribuir_zonas_encuestadores — no destructivo
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.distribuir_zonas_encuestadores(p_encuesta_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_equipo_id uuid;
  v_zonas     uuid[];
  v_encs      uuid[];
  n_zonas     int;
  n_encs      int;
  i           int;
  v_inserted  int := 0;
  resultado   jsonb := '[]'::jsonb;
begin
  for v_equipo_id in
    select distinct equipo_id from encuesta_zonas
    where encuesta_id = p_encuesta_id and equipo_id is not null
  loop
    select array_agg(id order by nombre) into v_zonas
    from encuesta_zonas
    where encuesta_id = p_encuesta_id and equipo_id = v_equipo_id;

    select array_agg(encuestador_id order by encuestador_id) into v_encs
    from equipo_encuestadores where equipo_id = v_equipo_id;

    n_zonas := coalesce(array_length(v_zonas, 1), 0);
    n_encs  := coalesce(array_length(v_encs,  1), 0);

    if n_zonas = 0 or n_encs = 0 then continue; end if;

    -- SIN DELETE — solo agrega las asignaciones que falten (round-robin como sugerencia inicial).
    if n_encs >= n_zonas then
      for i in 1..n_encs loop
        insert into asignaciones_encuesta (encuestador_id, encuesta_zona_id, activo)
        values (v_encs[i], v_zonas[((i-1) % n_zonas) + 1], true)
        on conflict (encuesta_zona_id, encuestador_id) do nothing;
        if found then v_inserted := v_inserted + 1; end if;
      end loop;
    else
      for i in 1..n_zonas loop
        insert into asignaciones_encuesta (encuestador_id, encuesta_zona_id, activo)
        values (v_encs[((i-1) % n_encs) + 1], v_zonas[i], true)
        on conflict (encuesta_zona_id, encuestador_id) do nothing;
        if found then v_inserted := v_inserted + 1; end if;
      end loop;
    end if;

    resultado := resultado || jsonb_build_object(
      'equipo_id', v_equipo_id, 'zonas', n_zonas, 'encuestadores', n_encs, 'asignaciones_nuevas', v_inserted
    );
    v_inserted := 0;
  end loop;

  return jsonb_build_object('ok', true, 'destructivo', false, 'equipos', resultado);
end;
$function$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. get_respuestas_por_sesion — fuente sesiones_respuesta.encuesta_id + p_zona_ids
-- ═══════════════════════════════════════════════════════════════════
-- La firma cambia (agrega p_zona_ids), hay que dropear la vieja de 2 args para
-- que la llamada get_respuestas_por_sesion(uuid, uuid) no quede ambigua.
drop function if exists public.get_respuestas_por_sesion(uuid, uuid);

create or replace function public.get_respuestas_por_sesion(
  p_encuesta_id uuid,
  p_org_id uuid,
  p_zona_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'sesiones', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'sesion_id',  sr.id,
            'zona_id',    sr.zona_id,
            'respuestas', (
              select jsonb_object_agg(
                r.pregunta_id::text,
                case
                  when r.valor_booleano is not null then case r.valor_booleano when true then 'Sí' else 'No' end
                  when r.opcion_id is not null then (select op.texto from opciones_pregunta op where op.id = r.opcion_id)
                  when r.valor_numero is not null then r.valor_numero::text
                  else r.valor_texto
                end
              )
              from respuestas r
              where r.sesion_id = sr.id
            )
          )
        )
        from sesiones_respuesta sr
        join encuestas en on en.id = sr.encuesta_id
        where sr.encuesta_id = p_encuesta_id
          and en.organizacion_id = p_org_id
          and sr.completada_en is not null
          and (p_zona_ids is null or sr.zona_id = any(p_zona_ids))
      ),
      '[]'::jsonb
    )
  ) into v_result;
  return v_result;
end;
$function$;
