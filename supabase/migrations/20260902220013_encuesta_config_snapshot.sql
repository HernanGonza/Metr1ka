-- Migración 13 — Snapshot de configuración de equipos por encuesta
--
-- Congela, por encuesta: qué equipos participaron, qué coordinadores y qué
-- encuestadores tenía cada equipo, y qué zonas le tocaban a cada equipo.
-- Independiente de cómo se reconfiguren los equipos después para otras encuestas.
--
-- Se captura al publicar y se puede re-capturar mientras la encuesta NO esté
-- 'completada'. Una vez completada, queda congelado (salvo p_forzar).
--
-- Aditivo. Rollback: ..._rollback.sql

create table if not exists public.encuesta_config_snapshot (
  encuesta_id   uuid primary key references public.encuestas(id) on delete cascade,
  snapshot      jsonb not null,
  origen        text,
  actualizado_en timestamptz not null default now()
);

comment on table public.encuesta_config_snapshot is
  'Foto de la configuración de equipos/coordinadores/encuestadores/zonas de una encuesta, congelada para reportes históricos.';

-- ── Función de captura ──────────────────────────────────────────────────────
create or replace function public.capturar_snapshot_encuesta(
  p_encuesta_id uuid,
  p_origen text default 'manual',
  p_forzar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_estado text;
  v_snap   jsonb;
begin
  select estado_produccion::text into v_estado from public.encuestas where id = p_encuesta_id;
  if v_estado is null then
    return null;
  end if;
  if v_estado = 'completada' and not p_forzar then
    -- ya congelada: devolver lo que haya
    return (select snapshot from public.encuesta_config_snapshot where encuesta_id = p_encuesta_id);
  end if;

  with equipos_enc as (
    -- equipos vía asignación explícita a la encuesta + vía zonas de la encuesta
    select distinct eq_id from (
      select ee.equipo_id as eq_id from public.encuestas_equipo ee where ee.encuesta_id = p_encuesta_id and ee.equipo_id is not null
      union
      select ez.equipo_id from public.encuesta_zonas ez where ez.encuesta_id = p_encuesta_id and ez.equipo_id is not null
      union
      select sr.equipo_id from public.sesiones_respuesta sr where sr.encuesta_id = p_encuesta_id and sr.equipo_id is not null
    ) x
  ),
  filas as (
    select
      eq.id as equipo_id,
      coalesce(eq.nombre,
               (select ez2.equipo_nombre from public.encuesta_zonas ez2
                 where ez2.encuesta_id = p_encuesta_id and ez2.equipo_id = ee.eq_id and ez2.equipo_nombre is not null limit 1),
               (select sr2.equipo_nombre from public.sesiones_respuesta sr2
                 where sr2.encuesta_id = p_encuesta_id and sr2.equipo_id = ee.eq_id and sr2.equipo_nombre is not null limit 1)
      ) as equipo_nombre,
      (
        select coalesce(jsonb_agg(distinct jsonb_build_object('id', c.id, 'nombre', c.nombre_completo)), '[]'::jsonb)
        from public.equipo_coordinadores ec
        join public.perfiles c on c.id = ec.coordinador_id
        where ec.equipo_id = ee.eq_id
      ) as coordinadores,
      (
        select coalesce(jsonb_agg(distinct jsonb_build_object('id', e.id, 'nombre', e.nombre_completo)), '[]'::jsonb)
        from public.equipo_encuestadores een
        join public.perfiles e on e.id = een.encuestador_id
        where een.equipo_id = ee.eq_id
      ) as encuestadores_actuales,
      (
        select coalesce(jsonb_agg(distinct jsonb_build_object('id', p.id, 'nombre', p.nombre_completo)), '[]'::jsonb)
        from public.sesiones_respuesta sr
        join public.perfiles p on p.id = sr.encuestador_id
        where sr.encuesta_id = p_encuesta_id and sr.equipo_id = ee.eq_id
      ) as encuestadores_que_trabajaron,
      (
        select coalesce(jsonb_agg(jsonb_build_object('zona_id', ez.id, 'zona_nombre', ez.nombre) order by ez.orden), '[]'::jsonb)
        from public.encuesta_zonas ez
        where ez.encuesta_id = p_encuesta_id and ez.equipo_id = ee.eq_id
      ) as zonas
    from equipos_enc ee
    left join public.equipos eq on eq.id = ee.eq_id
  )
  select jsonb_build_object(
    'capturado_en', now(),
    'origen', p_origen,
    'estado_al_capturar', v_estado,
    'equipos', coalesce((select jsonb_agg(jsonb_build_object(
        'equipo_id', equipo_id,
        'equipo_nombre', coalesce(equipo_nombre, 'Equipo eliminado'),
        'coordinadores', coordinadores,
        'encuestadores', encuestadores_actuales,
        'encuestadores_que_trabajaron', encuestadores_que_trabajaron,
        'zonas', zonas
      ) order by equipo_nombre) from filas), '[]'::jsonb),
    'zonas_sin_equipo', coalesce((
        select jsonb_agg(jsonb_build_object('zona_id', ez.id, 'zona_nombre', ez.nombre) order by ez.orden)
        from public.encuesta_zonas ez
        where ez.encuesta_id = p_encuesta_id and ez.equipo_id is null
      ), '[]'::jsonb)
  ) into v_snap;

  insert into public.encuesta_config_snapshot (encuesta_id, snapshot, origen, actualizado_en)
  values (p_encuesta_id, v_snap, p_origen, now())
  on conflict (encuesta_id) do update
    set snapshot = excluded.snapshot, origen = excluded.origen, actualizado_en = now();

  return v_snap;
end;
$$;

-- ── Trigger: capturar al publicar ──────────────────────────────────────────
create or replace function public.trg_encuesta_snapshot_publicar()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.estado_produccion = 'publicada'
     and (tg_op = 'INSERT' or old.estado_produccion is distinct from new.estado_produccion)
  then
    perform public.capturar_snapshot_encuesta(new.id, 'publicacion', false);
  end if;
  return new;
exception when others then
  return new;
end;
$$;

drop trigger if exists encuesta_snapshot_publicar on public.encuestas;
create trigger encuesta_snapshot_publicar
  after insert or update of estado_produccion on public.encuestas
  for each row execute function public.trg_encuesta_snapshot_publicar();

-- ── Backfill: capturar snapshot de todas las publicadas/completadas ────────
do $$
declare r record;
begin
  for r in select id, estado_produccion::text as est from public.encuestas
           where estado_produccion in ('publicada','completada')
  loop
    perform public.capturar_snapshot_encuesta(r.id, 'backfill', true);
  end loop;
end $$;
