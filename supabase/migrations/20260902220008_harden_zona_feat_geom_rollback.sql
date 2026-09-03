-- ROLLBACK Migración 8 — vuelve _zona_feat_geom sin search_path fijo.
create or replace function public._zona_feat_geom(p_feat jsonb)
returns geometry
language plpgsql immutable parallel safe
as $$
begin
  return st_setsrid(st_geomfromgeojson(p_feat->'geometry'), 4326);
exception when others then
  return null;
end;
$$;
