-- ROLLBACK Fase 1 · Paso 3/5 — quita el trigger. Vuelve a como estaba (nada rellena zona_id).

drop trigger if exists sesion_resolver_zona on public.sesiones_respuesta;
drop function if exists public.trg_sesion_resolver_zona();
