-- Permisos de acceso por rol a secciones
alter table public.configuracion
  add column if not exists dash_constructor  boolean not null default true,
  add column if not exists dash_colaborador  boolean not null default true,
  add column if not exists dash_observador   boolean not null default true,
  add column if not exists presup_constructor boolean not null default false,
  add column if not exists presup_colaborador boolean not null default true,
  add column if not exists presup_observador  boolean not null default true;
