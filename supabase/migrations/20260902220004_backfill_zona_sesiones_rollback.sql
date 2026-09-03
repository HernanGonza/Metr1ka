-- ROLLBACK Fase 1 · Paso 4/5 — vacía lo que puso el backfill.
-- (Si después se corre de nuevo el backfill, vuelve a llenar. Las columnas siguen existiendo.)

update public.sesiones_respuesta
set zona_id = null,
    encuesta_id = null,
    zona_por_gps = null;
