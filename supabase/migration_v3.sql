-- ============================================================
-- ObraClara — Migration v3
-- Ejecutar en SQL Editor de Supabase
-- Agrega políticas DELETE para que el Director pueda resetear
-- ============================================================

-- Política para eliminar gastos (puede ya existir de migration_v2 — si da error, ignorar)
do $$ begin
  create policy "Director elimina gastos"
    on public.gastos for delete
    using ((select rol from public.profiles where id = auth.uid()) = 'director');
exception when duplicate_object then null;
end $$;

-- Política para eliminar anticipos
do $$ begin
  create policy "Director elimina anticipos"
    on public.anticipos for delete
    using ((select rol from public.profiles where id = auth.uid()) = 'director');
exception when duplicate_object then null;
end $$;

-- Política para eliminar partidas
do $$ begin
  create policy "Director elimina partidas"
    on public.partidas for delete
    using ((select rol from public.profiles where id = auth.uid()) = 'director');
exception when duplicate_object then null;
end $$;
