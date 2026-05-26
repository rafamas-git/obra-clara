-- ============================================================
-- ObraClara — Migration v13
-- Fix definitivo: todas las referencias a obra_usuarios desde
-- sus propias políticas RLS usan SECURITY DEFINER para evitar
-- cualquier forma de recursión.
-- ============================================================

-- ── 1. Función: es admin de una obra ─────────────────────────
CREATE OR REPLACE FUNCTION public.is_obra_admin(p_obra_id uuid)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.obra_usuarios
    WHERE obra_id = p_obra_id
      AND usuario_id = auth.uid()
      AND rol = 'admin'
      AND activo = true
  );
$$;

-- ── 2. RLS: obra_usuarios (sin ninguna auto-referencia) ───────
DROP POLICY IF EXISTS "Ver miembros de su obra"            ON public.obra_usuarios;
DROP POLICY IF EXISTS "Admin gestiona miembros de su obra" ON public.obra_usuarios;

CREATE POLICY "Ver miembros de su obra"
  ON public.obra_usuarios FOR SELECT
  USING (
    public.is_superadmin()
    OR public.is_obra_member(obra_usuarios.obra_id)
  );

CREATE POLICY "Admin gestiona miembros de su obra"
  ON public.obra_usuarios FOR ALL
  USING (
    public.is_superadmin()
    OR public.is_obra_admin(obra_usuarios.obra_id)
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.is_obra_admin(obra_usuarios.obra_id)
  );

-- ── 3. RLS: partidas (usa is_obra_admin) ─────────────────────
DROP POLICY IF EXISTS "Admin gestiona partidas de su obra" ON public.partidas;

CREATE POLICY "Admin gestiona partidas de su obra"
  ON public.partidas FOR ALL
  USING (
    public.is_superadmin()
    OR public.is_obra_admin(partidas.obra_id)
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.is_obra_admin(partidas.obra_id)
  );

-- ── 4. RLS: gastos (usa is_obra_admin) ───────────────────────
DROP POLICY IF EXISTS "Admin edita gastos de su obra" ON public.gastos;

CREATE POLICY "Admin edita gastos de su obra"
  ON public.gastos FOR UPDATE
  USING (
    public.is_superadmin()
    OR public.is_obra_admin(gastos.obra_id)
  )
  WITH CHECK (TRUE);

-- ── 5. RLS: anticipos (usa is_obra_admin) ────────────────────
DROP POLICY IF EXISTS "Admin gestiona anticipos de su obra" ON public.anticipos;

CREATE POLICY "Admin gestiona anticipos de su obra"
  ON public.anticipos FOR ALL
  USING (
    public.is_superadmin()
    OR public.is_obra_admin(anticipos.obra_id)
  )
  WITH CHECK (
    public.is_superadmin()
    OR public.is_obra_admin(anticipos.obra_id)
  );

-- ── 6. RLS: items_partida (usa is_obra_admin) ────────────────
DROP POLICY IF EXISTS "Admin gestiona items de su obra" ON public.items_partida;

CREATE POLICY "Admin gestiona items de su obra"
  ON public.items_partida FOR ALL
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.partidas p
      WHERE p.id = items_partida.partida_id
        AND public.is_obra_admin(p.obra_id)
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.partidas p
      WHERE p.id = items_partida.partida_id
        AND public.is_obra_admin(p.obra_id)
    )
  );
