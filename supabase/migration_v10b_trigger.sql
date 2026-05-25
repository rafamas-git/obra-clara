-- Trigger temporal: auto-asigna obra_id en inserts mientras el frontend no lo envía.
-- Se elimina en Fase 4 cuando el frontend incluya obra_id explícitamente.

CREATE OR REPLACE FUNCTION public.set_obra_id_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.obra_id IS NULL THEN
    SELECT ou.obra_id INTO NEW.obra_id
    FROM   public.obra_usuarios ou
    WHERE  ou.usuario_id = auth.uid()
      AND  ou.activo = true
    ORDER  BY ou.created_at
    LIMIT  1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS gastos_set_obra_id    ON public.gastos;
DROP TRIGGER IF EXISTS partidas_set_obra_id  ON public.partidas;
DROP TRIGGER IF EXISTS anticipos_set_obra_id ON public.anticipos;

CREATE TRIGGER gastos_set_obra_id
  BEFORE INSERT ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.set_obra_id_default();

CREATE TRIGGER partidas_set_obra_id
  BEFORE INSERT ON public.partidas
  FOR EACH ROW EXECUTE FUNCTION public.set_obra_id_default();

CREATE TRIGGER anticipos_set_obra_id
  BEFORE INSERT ON public.anticipos
  FOR EACH ROW EXECUTE FUNCTION public.set_obra_id_default();
