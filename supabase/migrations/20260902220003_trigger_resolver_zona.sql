-- Fase 1 · Paso 3/5 — Trigger BEFORE INSERT en sesiones_respuesta
-- Rellena encuesta_id + zona_id + zona_por_gps al crear la sesión.
-- Todo el cuerpo va envuelto en EXCEPTION WHEN OTHERS THEN RETURN NEW:
--   si algo falla, la sesión se guarda IGUAL (sin zona). El guardado NO se puede romper.
-- No toca guardar_encuesta_completa ni crear_sesion_encuesta ni la cola offline.
-- Rollback: 20260902220003_trigger_resolver_zona_rollback.sql

create or replace function public.trg_sesion_resolver_zona()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_encuesta_id uuid;
  v_res         record;
begin
  -- 1) encuesta_id: de la cadena asignación→zona; si no, de las preguntas ya respondidas
  if new.encuesta_id is null then
    if new.asignacion_id is not null then
      select ez.encuesta_id
        into v_encuesta_id
      from public.asignaciones_encuesta ae
      join public.encuesta_zonas ez on ez.id = ae.encuesta_zona_id
      where ae.id = new.asignacion_id;
    end if;

    if v_encuesta_id is null then
      select p.encuesta_id
        into v_encuesta_id
      from public.respuestas r
      join public.preguntas p on p.id = r.pregunta_id
      where r.sesion_id = new.id
      limit 1;
    end if;

    new.encuesta_id := v_encuesta_id;
  end if;

  -- 2) zona_id + zona_por_gps por GPS
  if new.encuesta_id is not null and new.zona_id is null then
    select out_zona_id, out_por_gps
      into v_res
    from public.resolver_zona_sesion(new.encuesta_id, new.latitud, new.longitud);

    new.zona_id      := v_res.out_zona_id;
    new.zona_por_gps := v_res.out_por_gps;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists sesion_resolver_zona on public.sesiones_respuesta;
create trigger sesion_resolver_zona
  before insert on public.sesiones_respuesta
  for each row execute function public.trg_sesion_resolver_zona();
