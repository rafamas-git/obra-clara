-- ============================================================
-- ObraClara — Migration v4
-- Tabla de configuración del proyecto (nombre de la obra)
-- ============================================================

create table if not exists public.configuracion (
  id      integer primary key default 1,
  nombre_obra text not null default 'Mi Obra',
  constraint una_sola_fila check (id = 1)
);

alter table public.configuracion enable row level security;

-- Todos los usuarios autenticados pueden leer
create policy "Autenticados leen configuracion"
  on public.configuracion for select
  using (auth.role() = 'authenticated');

-- Solo el Director puede actualizar
create policy "Director actualiza configuracion"
  on public.configuracion for update
  using ((select rol from public.profiles where id = auth.uid()) = 'director');

-- Insertar fila inicial
insert into public.configuracion (id, nombre_obra)
values (1, 'Mi Obra')
on conflict (id) do nothing;
