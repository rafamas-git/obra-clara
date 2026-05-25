-- ============================================================
-- ObraClara — Migration v5
-- Tabla de ítems detallados por partida
-- ============================================================

create table if not exists public.items_partida (
  id              uuid primary key default gen_random_uuid(),
  partida_id      uuid not null references public.partidas(id) on delete cascade,
  descripcion     text not null,
  unidad          text,
  cantidad        numeric,
  precio_unitario numeric,
  total           numeric,
  orden           integer not null default 0
);

alter table public.items_partida enable row level security;

create policy "Autenticados leen items"
  on public.items_partida for select
  using (auth.role() = 'authenticated');

create policy "Director gestiona items"
  on public.items_partida for all
  using ((select rol from public.profiles where id = auth.uid()) = 'director');
