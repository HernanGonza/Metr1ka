-- Fase 1 · Paso 4/5 — Backfill de las sesiones históricas
-- Solo UPDATE de las 3 columnas nuevas. No toca respuestas, asignaciones ni zonas.
-- Idempotente: solo actualiza filas con encuesta_id / zona_id aún en NULL.
-- Rollback: 20260902220004_backfill_zona_sesiones_rollback.sql (vuelve a NULL las 3 columnas)

-- Paso A · encuesta_id (cadena asignación→zona; si no, por las respuestas)
update public.sesiones_respuesta sr
set encuesta_id = sub.encuesta_id
from (
  select s.id,
    coalesce(
      (select ez.encuesta_id
         from public.asignaciones_encuesta ae
         join public.encuesta_zonas ez on ez.id = ae.encuesta_zona_id
        where ae.id = s.asignacion_id),
      (select p.encuesta_id
         from public.respuestas r
         join public.preguntas p on p.id = r.pregunta_id
        where r.sesion_id = s.id
        limit 1)
    ) as encuesta_id
  from public.sesiones_respuesta s
  where s.encuesta_id is null
) sub
where sr.id = sub.id
  and sr.encuesta_id is null
  and sub.encuesta_id is not null;

-- Paso B · zona_id + zona_por_gps (GPS: contención -> polígono más cercano)
do $$
declare
  r   record;
  res record;
begin
  for r in
    select id, encuesta_id, latitud, longitud
    from public.sesiones_respuesta
    where zona_id is null and encuesta_id is not null
  loop
    select out_zona_id, out_por_gps
      into res
    from public.resolver_zona_sesion(r.encuesta_id, r.latitud, r.longitud);

    update public.sesiones_respuesta
    set zona_id = res.out_zona_id,
        zona_por_gps = res.out_por_gps
    where id = r.id;
  end loop;
end $$;
