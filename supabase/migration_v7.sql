-- Nuevos campos en gastos
alter table public.gastos
  add column if not exists cantidad numeric,
  add column if not exists unidad_medida text,
  add column if not exists precio_unitario numeric;

-- Tabla de unidades de medida
create table if not exists public.unidades_medida (
  codigo text primary key,
  created_at timestamptz default now()
);

-- Unidades base
insert into public.unidades_medida (codigo) values
  ('m²'), ('ml'), ('m³'), ('kg'), ('ton'), ('un'), ('gl'), ('hr'), ('lt'), ('bolsa'), ('saco'), ('plg')
on conflict do nothing;

-- RLS
alter table public.unidades_medida enable row level security;

do $$ begin
  create policy "Ver unidades" on public.unidades_medida
    for select using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "Agregar unidades" on public.unidades_medida
    for insert with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;
