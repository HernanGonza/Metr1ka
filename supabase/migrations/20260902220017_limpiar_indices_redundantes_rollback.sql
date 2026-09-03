-- ROLLBACK Migración 17 — recrea los índices redundantes.
create index if not exists idx_asignaciones_encuesta_encuestador on public.asignaciones_encuesta (encuestador_id);
create index if not exists idx_asignaciones_encuestador          on public.asignaciones_encuesta (encuestador_id);
create index if not exists idx_asignaciones_zona                 on public.asignaciones_encuesta (encuesta_zona_id);
create index if not exists idx_encuestas_org_id                  on public.encuestas (organizacion_id);
create index if not exists encuestas_organizacion_id_idx         on public.encuestas (organizacion_id);
create index if not exists idx_ee_encuesta                       on public.encuestas_equipo (encuesta_id);
create index if not exists idx_ee_equipo                         on public.encuestas_equipo (equipo_id);
create index if not exists idx_opciones_pregunta                 on public.opciones_pregunta (pregunta_id);
create index if not exists idx_opciones_pregunta_id              on public.opciones_pregunta (pregunta_id);
create index if not exists opciones_pregunta_pregunta_id_idx     on public.opciones_pregunta (pregunta_id);
create index if not exists idx_preguntas_encuesta_orden          on public.preguntas (encuesta_id, orden);
create index if not exists idx_preguntas_encuesta               on public.preguntas (encuesta_id, orden);
create index if not exists preguntas_encuesta_id_idx             on public.preguntas (encuesta_id);
create index if not exists idx_preguntas_encuesta_id             on public.preguntas (encuesta_id);
create index if not exists idx_sesiones_completada               on public.sesiones_respuesta (completada_en) where completada_en is not null;
