-- ============================================================
-- ObraClara — Migration v2
-- Ejecutar en SQL Editor de Supabase DESPUÉS del schema.sql
-- ============================================================

-- Política para que el Director pueda eliminar gastos
create policy "Director elimina gastos"
  on public.gastos for delete
  using (
    (select rol from public.profiles where id = auth.uid()) = 'director'
  );

-- ── RPC: Resetear solo consumos (gastos + anticipos) ──────
create or replace function public.reset_consumos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select rol from public.profiles where id = auth.uid()) != 'director' then
    raise exception 'Solo el Director puede resetear consumos';
  end if;
  delete from public.gastos;
  delete from public.anticipos;
end;
$$;

grant execute on function public.reset_consumos to authenticated;

-- ── RPC: Reiniciar proyecto completo ──────────────────────
create or replace function public.reset_proyecto()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select rol from public.profiles where id = auth.uid()) != 'director' then
    raise exception 'Solo el Director puede reiniciar el proyecto';
  end if;
  delete from public.gastos;
  delete from public.anticipos;
  delete from public.partidas;
end;
$$;

grant execute on function public.reset_proyecto to authenticated;
