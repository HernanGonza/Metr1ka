-- Migración 12 — Snapshot histórico de equipo (y nombre de zona)
--
-- Problema: si se borra un equipo, se pierde el registro de qué equipos se
-- usaron en cada encuesta y a qué equipo pertenecía cada encuestador entonces
-- (encuesta_zonas.equipo_id → NULL por FK, encuestas_equipo → CASCADE, y
-- equipo_encuestadores solo refleja la membresía ACTUAL).
--
-- Solución: columnas denormalizadas que guardan el NOMBRE (sobrevive al borrado):
--   sesiones_respuesta : equipo_id, equipo_nombre, zona_nombre
--   encuesta_zonas     : equipo_nombre
--   encuestas_equipo   : equipo_nombre
-- Triggers las mantienen. El nombre NUNCA se borra al quedar equipo_id en NULL.
--
-- Todo aditivo. Backfill = solo columnas nuevas. Rollback: ..._rollback.sql

-- ── 1. Columnas ─────────────────────────────────────────────────────────────
alter table public.sesiones_respuesta
  add column if not exists equipo_id     uuid references public.equipos(id) on delete set null,
  add column if not exists equipo_nombre text,
  add column if not exists zona_nombre   text;

alter table public.encuesta_zonas   add column if not exists equipo_nombre text;
alter table public.encuestas_equipo add column if not exists equipo_nombre text;

comment on column public.sesiones_respuesta.equipo_nombre is
  'Snapshot: nombre del equipo del encuestador al momento de la sesión. Sobrevive al borrado del equipo.';
comment on column public.sesiones_respuesta.zona_nombre is
  'Snapshot: nombre de la zona. Sobrevive al borrado de la zona.';

create index if not exists idx_sesiones_respuesta_equipo_id on public.sesiones_respuesta(equipo_id);

-- ── 2. Backfill ─────────────────────────────────────────────────────────────
update public.encuesta_zonas ez
set equipo_nombre = eq.nombre
from public.equipos eq
where eq.id = ez.equipo_id and ez.equipo_nombre is null;

update public.encuestas_equipo x
set equipo_nombre = eq.nombre
from public.equipos eq
where eq.id = x.equipo_id and x.equipo_nombre is null;

update public.sesiones_respuesta sr
set
  zona_nombre   = coalesce(sr.zona_nombre, ez.nombre),
  equipo_id     = coalesce(sr.equipo_id, ez.equipo_id, ee.equipo_id),
  equipo_nombre = coalesce(sr.equipo_nombre, eq.nombre)
from public.sesiones_respuesta sr0
left join public.encuesta_zonas ez        on ez.id = sr0.zona_id
left join public.equipo_encuestadores ee  on ee.encuestador_id = sr0.encuestador_id
left join public.equipos eq               on eq.id = coalesce(ez.equipo_id, ee.equipo_id)
where sr.id = sr0.id
  and (sr.zona_nombre is null or sr.equipo_id is null or sr.equipo_nombre is null);

-- ── 3. Trigger sesiones_respuesta: extender para snapshotear equipo/zona ─────
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
  if new.encuesta_id is null then
    if new.asignacion_id is not null then
      select ez.encuesta_id into v_encuesta_id
      from public.asignaciones_encuesta ae
      join public.encuesta_zonas ez on ez.id = ae.encuesta_zona_id
      where ae.id = new.asignacion_id;
    end if;
    if v_encuesta_id is null then
      select p.encuesta_id into v_encuesta_id
      from public.respuestas r
      join public.preguntas p on p.id = r.pregunta_id
      where r.sesion_id = new.id
      limit 1;
    end if;
    new.encuesta_id := v_encuesta_id;
  end if;

  if new.encuesta_id is not null and new.zona_id is null then
    select out_zona_id, out_metodo into v_res
    from public.resolver_zona_sesion(
      new.encuesta_id, new.latitud, new.longitud,
      new.encuestador_id, coalesce(new.completada_en, new.iniciada_en)
    );
    new.zona_id      := v_res.out_zona_id;
    new.zona_metodo  := v_res.out_metodo;
    new.zona_por_gps := (v_res.out_metodo = 'gps');
  end if;

  -- Snapshot de nombre de zona
  if new.zona_id is not null and new.zona_nombre is null then
    select nombre into new.zona_nombre from public.encuesta_zonas where id = new.zona_id;
  end if;

  -- Snapshot de equipo: el de la zona; si no, el equipo ACTUAL del encuestador
  if new.equipo_id is null then
    select coalesce(
      (select ez.equipo_id from public.encuesta_zonas ez where ez.id = new.zona_id),
      (select ee.equipo_id from public.equipo_encuestadores ee
        where ee.encuestador_id = new.encuestador_id limit 1)
    ) into new.equipo_id;
  end if;
  if new.equipo_id is not null and new.equipo_nombre is null then
    select nombre into new.equipo_nombre from public.equipos where id = new.equipo_id;
  end if;

  return new;
exception when others then
  return new;
end;
$$;

-- ── 4. Trigger encuesta_zonas: mantener equipo_nombre (nunca borrarlo) ──────
create or replace function public.trg_encuesta_zona_equipo_nombre()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if tg_op = 'INSERT' then
    if new.equipo_id is not null then
      new.equipo_nombre := (select nombre from public.equipos where id = new.equipo_id);
    end if;
  else -- UPDATE
    if new.equipo_id is not null and new.equipo_id is distinct from old.equipo_id then
      new.equipo_nombre := (select nombre from public.equipos where id = new.equipo_id);
    end if;
    -- si new.equipo_id quedó NULL (equipo borrado) → no se toca equipo_nombre
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists encuesta_zona_equipo_nombre on public.encuesta_zonas;
create trigger encuesta_zona_equipo_nombre
  before insert or update of equipo_id on public.encuesta_zonas
  for each row execute function public.trg_encuesta_zona_equipo_nombre();

-- ── 5. Trigger encuestas_equipo: setear equipo_nombre al insertar ──────────
create or replace function public.trg_encuestas_equipo_nombre()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.equipo_nombre is null and new.equipo_id is not null then
    new.equipo_nombre := (select nombre from public.equipos where id = new.equipo_id);
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists encuestas_equipo_nombre on public.encuestas_equipo;
create trigger encuestas_equipo_nombre
  before insert on public.encuestas_equipo
  for each row execute function public.trg_encuestas_equipo_nombre();
