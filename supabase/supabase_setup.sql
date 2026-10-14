-- ════════════════════════════════════════════════════════════════
-- CREAR · Columnas de Alumbrado — Base de datos compartida
-- Pegar todo en Supabase → SQL Editor → New query → Run
-- ════════════════════════════════════════════════════════════════

create table if not exists public.app_datos (
  coleccion   text        not null,          -- usuarios | clientes | colores | entradas | turnos | registros | certificados | accesos
  id          text        not null,          -- id del elemento dentro de la app
  data        jsonb,                         -- el elemento completo
  borrado     boolean     not null default false,
  actualizado timestamptz not null default now(),
  primary key (coleccion, id)
);

alter table public.app_datos enable row level security;

drop policy if exists "app_lee"       on public.app_datos;
drop policy if exists "app_inserta"   on public.app_datos;
drop policy if exists "app_actualiza" on public.app_datos;

create policy "app_lee"       on public.app_datos for select to anon using (true);
create policy "app_inserta"   on public.app_datos for insert to anon with check (true);
create policy "app_actualiza" on public.app_datos for update to anon using (true) with check (true);
-- (sin política de DELETE: desde la app nada se borra físicamente, se marca "borrado")

-- ── Fotos ─────────────────────────────────────────────────────────
-- Carpeta pública para las fotos de las cuadras (lectura pública por link).
insert into storage.buckets (id, name, public)
values ('fotos-columnas', 'fotos-columnas', true)
on conflict (id) do nothing;

drop policy if exists "fotos_sube" on storage.objects;
drop policy if exists "fotos_lee"  on storage.objects;

create policy "fotos_sube" on storage.objects for insert to anon
  with check (bucket_id = 'fotos-columnas');
create policy "fotos_lee"  on storage.objects for select to anon
  using (bucket_id = 'fotos-columnas');
