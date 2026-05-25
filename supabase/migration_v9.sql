-- migration_v9.sql
-- Permite 'anulado' como valor válido en el campo estado de gastos.
-- Si la tabla tiene un CHECK constraint que no incluye 'anulado', falla al intentar anular.

-- Elimina el constraint existente (si hay) y lo recrea incluyendo 'anulado'
ALTER TABLE public.gastos DROP CONSTRAINT IF EXISTS gastos_estado_check;
ALTER TABLE public.gastos
  ADD CONSTRAINT gastos_estado_check
  CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'anulado'));

-- Asegura que el director puede hacer UPDATE incluso cambiando a 'anulado'
-- (WITH CHECK TRUE evita que la política rechace la fila resultante)
DROP POLICY IF EXISTS "Director edita gastos" ON public.gastos;
CREATE POLICY "Director edita gastos" ON public.gastos
  FOR UPDATE
  USING  ((SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'director')
  WITH CHECK (TRUE);
