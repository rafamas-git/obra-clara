-- ============================================================
-- ObraClara — Schema SQL
-- Ejecutar en el SQL Editor de Supabase
-- ============================================================

-- ── Tabla de perfiles de usuario ──────────────────────────
create table public.profiles (
  id        uuid references auth.users(id) on delete cascade primary key,
  email     text        not null,
  nombre    text        not null,
  rol       text        not null check (rol in ('director','constructor','colaborador','observador')),
  activo    boolean     default true,
  created_at timestamptz default now()
);

comment on table public.profiles is 'Perfiles de usuario con roles de la app';

-- ── Tabla de partidas (categorías de presupuesto) ─────────
create table public.partidas (
  id                   uuid    default gen_random_uuid() primary key,
  nombre               text    not null,
  presupuesto_estimado numeric(12,2) not null default 0,
  orden                integer default 0,
  activo               boolean default true,
  created_at           timestamptz default now()
);

-- ── Tabla de gastos ───────────────────────────────────────
create table public.gastos (
  id                  uuid    default gen_random_uuid() primary key,
  partida_id          uuid    references public.partidas(id),
  usuario_id          uuid    references public.profiles(id),
  descripcion         text    not null,
  monto               numeric(12,2) not null,
  foto_url            text,
  foto_path           text,
  estado              text    default 'pendiente' check (estado in ('pendiente','aprobado','rechazado')),
  comentario_rechazo  text,
  aprobado_por        uuid    references public.profiles(id),
  aprobado_en         timestamptz,
  fecha_gasto         date    default current_date,
  created_at          timestamptz default now()
);

-- ── Tabla de anticipos de caja ────────────────────────────
create table public.anticipos (
  id             uuid    default gen_random_uuid() primary key,
  constructor_id uuid    references public.profiles(id) not null,
  director_id    uuid    references public.profiles(id) not null,
  monto          numeric(12,2) not null,
  descripcion    text,
  fecha          date    default current_date,
  created_at     timestamptz default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.profiles  enable row level security;
alter table public.partidas  enable row level security;
alter table public.gastos    enable row level security;
alter table public.anticipos enable row level security;

-- ── profiles ──────────────────────────────────────────────
create policy "Todos pueden ver perfiles"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Usuarios actualizan su propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- Insert/delete vía service role (Edge Functions)

-- ── partidas ──────────────────────────────────────────────
create policy "Autenticados ven partidas"
  on public.partidas for select
  using (auth.role() = 'authenticated');

create policy "Director gestiona partidas"
  on public.partidas for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and rol = 'director')
  );

-- ── gastos ────────────────────────────────────────────────
create policy "Ver gastos según rol"
  on public.gastos for select
  using (
    case (select rol from public.profiles where id = auth.uid())
      when 'constructor' then usuario_id = auth.uid()
      else true
    end
  );

create policy "Constructor y colaborador ingresan gastos"
  on public.gastos for insert
  with check (
    auth.uid() = usuario_id and
    (select rol from public.profiles where id = auth.uid()) in ('constructor','colaborador')
  );

create policy "Director aprueba/rechaza gastos"
  on public.gastos for update
  using (
    (select rol from public.profiles where id = auth.uid()) = 'director'
  );

-- ── anticipos ─────────────────────────────────────────────
create policy "Ver anticipos según rol"
  on public.anticipos for select
  using (
    case (select rol from public.profiles where id = auth.uid())
      when 'constructor' then constructor_id = auth.uid()
      else true
    end
  );

create policy "Director gestiona anticipos"
  on public.anticipos for all
  using (
    (select rol from public.profiles where id = auth.uid()) = 'director'
  );

-- ============================================================
-- Storage bucket para recibos
-- ============================================================

insert into storage.buckets (id, name, public)
values ('recibos', 'recibos', false)
on conflict (id) do nothing;

create policy "Autenticados suben recibos"
  on storage.objects for insert
  with check (auth.role() = 'authenticated' and bucket_id = 'recibos');

create policy "Autenticados ven recibos"
  on storage.objects for select
  using (auth.role() = 'authenticated' and bucket_id = 'recibos');

create policy "Autenticados eliminan sus recibos"
  on storage.objects for delete
  using (auth.uid()::text = (storage.foldername(name))[1] and bucket_id = 'recibos');

-- ============================================================
-- Trigger: crear perfil vacío al registrar usuario (opcional)
-- El perfil real se crea vía Edge Function con todos los campos
-- ============================================================

-- ============================================================
-- SETUP INICIAL: insertar el primer Director manualmente
-- Ejecutar DESPUÉS de crear el usuario en Supabase Auth
-- ============================================================
-- insert into public.profiles (id, email, nombre, rol)
-- values ('<UUID_DEL_AUTH_USER>', 'director@tuempresa.com', 'Nombre Director', 'director');
