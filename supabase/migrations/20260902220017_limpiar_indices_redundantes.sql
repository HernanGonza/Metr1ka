-- Migración 17 — PERFORMANCE: borrar índices redundantes
--
-- Cada uno de estos índices es IDÉNTICO a otro, o su función la cubre el prefijo
-- de un índice compuesto (varios respaldados por constraints UNIQUE).
-- Menos índices = inserts más rápidos (clave para el operativo, muchos INSERT de
-- sesiones/respuestas) + menos bloat. Ningún query pierde cobertura.
--
-- Rollback: ..._rollback.sql (recrea los índices exactos).

-- asignaciones_encuesta: (encuestador_id) x2 duplicado + cubierto por
--   idx_asignaciones_encuestador_zona_activo (encuestador_id, encuesta_zona_id, activo)
drop index if exists public.idx_asignaciones_encuesta_encuestador;
drop index if exists public.idx_asignaciones_encuestador;
-- (encuesta_zona_id) cubierto por UNIQUE (encuesta_zona_id, encuestador_id)
drop index if exists public.idx_asignaciones_zona;

-- encuestas: (organizacion_id) x3 idénticos -> se deja idx_encuestas_organizacion
drop index if exists public.idx_encuestas_org_id;
drop index if exists public.encuestas_organizacion_id_idx;

-- encuestas_equipo: (encuesta_id) x2 y (equipo_id) x2 -> se dejan los *_idx
drop index if exists public.idx_ee_encuesta;
drop index if exists public.idx_ee_equipo;

-- opciones_pregunta: (pregunta_id) x3 + cubierto por UNIQUE (pregunta_id, orden)
drop index if exists public.idx_opciones_pregunta;
drop index if exists public.idx_opciones_pregunta_id;
drop index if exists public.opciones_pregunta_pregunta_id_idx;

-- preguntas: (encuesta_id, orden) x3 -> se deja el UNIQUE; (encuesta_id) x2 cubierto por el compuesto
drop index if exists public.idx_preguntas_encuesta_orden;
drop index if exists public.idx_preguntas_encuesta;
drop index if exists public.preguntas_encuesta_id_idx;
drop index if exists public.idx_preguntas_encuesta_id;

-- sesiones_respuesta: (completada_en) WHERE not null x2 idénticos
drop index if exists public.idx_sesiones_completada;

analyze public.asignaciones_encuesta;
analyze public.encuestas;
analyze public.encuestas_equipo;
analyze public.opciones_pregunta;
analyze public.preguntas;
analyze public.sesiones_respuesta;
