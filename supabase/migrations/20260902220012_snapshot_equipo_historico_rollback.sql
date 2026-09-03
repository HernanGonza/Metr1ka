-- ROLLBACK Migración 12 — quita snapshot de equipo/zona en sesiones y denorm en zonas/encuestas_equipo.

drop trigger if exists encuesta_zona_equipo_nombre on public.encuesta_zonas;
drop function if exists public.trg_encuesta_zona_equipo_nombre();
drop trigger if exists encuestas_equipo_nombre on public.encuestas_equipo;
drop function if exists public.trg_encuestas_equipo_nombre();

-- restaurar trg_sesion_resolver_zona a la versión de la migración 9
CREATE OR REPLACE FUNCTION public.trg_sesion_resolver_zona()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_encuesta_id uuid;
  v_res         record;
begin
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

  if new.encuesta_id is not null and new.zona_id is null then
    select out_zona_id, out_metodo
      into v_res
    from public.resolver_zona_sesion(
      new.encuesta_id, new.latitud, new.longitud,
      new.encuestador_id, coalesce(new.completada_en, new.iniciada_en)
    );

    new.zona_id      := v_res.out_zona_id;
    new.zona_metodo  := v_res.out_metodo;
    new.zona_por_gps := (v_res.out_metodo = 'gps');
  end if;

  return new;
exception when others then
  return new;
end;
$function$

;

drop index if exists public.idx_sesiones_respuesta_equipo_id;
alter table public.sesiones_respuesta drop column if exists equipo_id, drop column if exists equipo_nombre, drop column if exists zona_nombre;
alter table public.encuesta_zonas drop column if exists equipo_nombre;
alter table public.encuestas_equipo drop column if exists equipo_nombre;
