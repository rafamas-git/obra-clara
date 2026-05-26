-- ============================================================
-- ObraClara — Migration v11
-- Fix: superadmin bypass en RLS con función SECURITY DEFINER
-- La subquery anidada en USING puede retornar NULL en contextos
-- de RLS anidados. La función SECURITY DEFINER bypasea RLS de
-- profiles al verificar el rol del usuario.
-- ============================================================

-- ── 1. Función helper ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'superadmin'
  );
$$;

-- ── 2. RLS: obras ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Miembros ven su obra"          ON public.obras;
DROP POLICY IF EXISTS "Solo superadmin gestiona obras" ON public.obras;
DROP POLICY IF EXISTS "Superadmin gestiona obras"      ON public.obras;

CREATE POLICY "Miembros ven su obra"
  ON public.obras FOR SELECT
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = obras.id
        AND ou.usuario_id = auth.uid()
        AND ou.activo = true
    )
  );

CREATE POLICY "Superadmin gestiona obras"
  ON public.obras FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- ── 3. RLS: obra_usuarios ─────────────────────────────────────
DROP POLICY IF EXISTS "Ver miembros de su obra"             ON public.obra_usuarios;
DROP POLICY IF EXISTS "Admin gestiona miembros de su obra"  ON public.obra_usuarios;

CREATE POLICY "Ver miembros de su obra"
  ON public.obra_usuarios FOR SELECT
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou2
      WHERE ou2.obra_id = obra_usuarios.obra_id
        AND ou2.usuario_id = auth.uid()
        AND ou2.activo = true
    )
  );

CREATE POLICY "Admin gestiona miembros de su obra"
  ON public.obra_usuarios FOR ALL
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou2
      WHERE ou2.obra_id = obra_usuarios.obra_id
        AND ou2.usuario_id = auth.uid()
        AND ou2.rol = 'admin'
        AND ou2.activo = true
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou2
      WHERE ou2.obra_id = obra_usuarios.obra_id
        AND ou2.usuario_id = auth.uid()
        AND ou2.rol = 'admin'
        AND ou2.activo = true
    )
  );

-- ── 4. RLS: partidas ─────────────────────────────────────────
DROP POLICY IF EXISTS "Miembros ven partidas de su obra"    ON public.partidas;
DROP POLICY IF EXISTS "Admin gestiona partidas de su obra"  ON public.partidas;

CREATE POLICY "Miembros ven partidas de su obra"
  ON public.partidas FOR SELECT
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = partidas.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.activo = true
    )
  );

CREATE POLICY "Admin gestiona partidas de su obra"
  ON public.partidas FOR ALL
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = partidas.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol = 'admin'
        AND ou.activo = true
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = partidas.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol = 'admin'
        AND ou.activo = true
    )
  );

-- ── 5. RLS: gastos ───────────────────────────────────────────
DROP POLICY IF EXISTS "Ver gastos de su obra"       ON public.gastos;
DROP POLICY IF EXISTS "Admin edita gastos de su obra" ON public.gastos;

CREATE POLICY "Ver gastos de su obra"
  ON public.gastos FOR SELECT
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = gastos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.activo = true
        AND (ou.rol != 'constructor' OR gastos.usuario_id = auth.uid())
    )
  );

CREATE POLICY "Admin edita gastos de su obra"
  ON public.gastos FOR UPDATE
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = gastos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol = 'admin'
        AND ou.activo = true
    )
  )
  WITH CHECK (TRUE);

-- ── 6. RLS: anticipos ────────────────────────────────────────
DROP POLICY IF EXISTS "Ver anticipos de su obra"            ON public.anticipos;
DROP POLICY IF EXISTS "Admin gestiona anticipos de su obra" ON public.anticipos;

CREATE POLICY "Ver anticipos de su obra"
  ON public.anticipos FOR SELECT
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = anticipos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.activo = true
        AND (ou.rol NOT IN ('constructor', 'colaborador') OR anticipos.constructor_id = auth.uid())
    )
  );

CREATE POLICY "Admin gestiona anticipos de su obra"
  ON public.anticipos FOR ALL
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = anticipos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol = 'admin'
        AND ou.activo = true
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = anticipos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol = 'admin'
        AND ou.activo = true
    )
  );

-- ── 7. RLS: items_partida ─────────────────────────────────────
DROP POLICY IF EXISTS "Miembros ven items de su obra"   ON public.items_partida;
DROP POLICY IF EXISTS "Admin gestiona items de su obra" ON public.items_partida;

CREATE POLICY "Miembros ven items de su obra"
  ON public.items_partida FOR SELECT
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM   public.partidas p
      JOIN   public.obra_usuarios ou ON ou.obra_id = p.obra_id
      WHERE  p.id = items_partida.partida_id
        AND  ou.usuario_id = auth.uid()
        AND  ou.activo = true
    )
  );

CREATE POLICY "Admin gestiona items de su obra"
  ON public.items_partida FOR ALL
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM   public.partidas p
      JOIN   public.obra_usuarios ou ON ou.obra_id = p.obra_id
      WHERE  p.id = items_partida.partida_id
        AND  ou.usuario_id = auth.uid()
        AND  ou.rol = 'admin'
        AND  ou.activo = true
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1
      FROM   public.partidas p
      JOIN   public.obra_usuarios ou ON ou.obra_id = p.obra_id
      WHERE  p.id = items_partida.partida_id
        AND  ou.usuario_id = auth.uid()
        AND  ou.rol = 'admin'
        AND  ou.activo = true
    )
  );
