-- Migración 8 — hardening: fija search_path en _zona_feat_geom
-- (el advisor de Supabase lo marcaba como "role mutable search_path").
-- Rollback: 20260902220008_harden_zona_feat_geom_rollback.sql

create or replace function public._zona_feat_geom(p_feat jsonb)
returns geometry
language plpgsql immutable parallel safe
set search_path to 'public', 'extensions'
as $$
begin
  return st_setsrid(st_geomfromgeojson(p_feat->'geometry'), 4326);
exception when others then
  return null;
end;
$$;
