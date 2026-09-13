-- RPC contar_respuestas_online — contador liviano para el listado de
-- encuestas online del panel admin/gestor (EncuestaCardOnline). Evita traer
-- todas las filas de sesiones_respuesta al cliente solo para contarlas.
--
-- Rollback: 20260913000100_contar_respuestas_online_rollback.sql

create or replace function public.contar_respuestas_online(p_org_id uuid)
returns table(encuesta_id uuid, total bigint)
language sql
stable security definer
set search_path to 'public'
as $$
  select sr.encuesta_id, count(*) as total
  from sesiones_respuesta sr
  join encuestas e on e.id = sr.encuesta_id
  where e.organizacion_id = p_org_id
    and e.tipo_encuesta = 'online'
    and sr.origen = 'online'
    and sr.completada_en is not null
  group by sr.encuesta_id;
$$;
