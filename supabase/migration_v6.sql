-- Director puede editar y anular gastos
do $$ begin
  create policy "Director edita gastos"
    on public.gastos for update
    using ((select rol from public.profiles where id = auth.uid()) = 'director');
exception when duplicate_object then null;
end $$;

-- Director puede registrar gastos (INSERT)
do $$ begin
  create policy "Director registra gastos"
    on public.gastos for insert
    with check ((select rol from public.profiles where id = auth.uid()) = 'director');
exception when duplicate_object then null;
end $$;
