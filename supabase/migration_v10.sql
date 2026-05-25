-- ============================================================
-- ObraClara — Migration v10
-- Multi-obra: tablas obras y obra_usuarios, obra_id en datos
-- ============================================================
-- IMPORTANTE: Hacer backup en Supabase antes de ejecutar.
-- Ejecutar completo en el SQL Editor de Supabase.
-- ============================================================

BEGIN;

-- ── 1. Agregar 'superadmin' al CHECK constraint de profiles ──
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_rol_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_rol_check
  CHECK (rol IN ('superadmin', 'director', 'constructor', 'colaborador', 'observador'));
-- Nota: 'director' se mantiene por compatibilidad; la nueva equivalencia es
-- 'admin' en obra_usuarios. Los directores existentes quedan mapeados en paso 5c.

-- ── 2. Tabla obras ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.obras (
  id               UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre           TEXT         NOT NULL,
  descripcion      TEXT,
  activo           BOOLEAN      DEFAULT true,
  dash_constructor BOOLEAN      DEFAULT true,
  dash_colaborador BOOLEAN      DEFAULT true,
  dash_observador  BOOLEAN      DEFAULT true,
  created_at       TIMESTAMPTZ  DEFAULT now()
);

-- ── 3. Tabla obra_usuarios (membresías por obra) ──────────────
CREATE TABLE IF NOT EXISTS public.obra_usuarios (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id    UUID        NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  usuario_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rol        TEXT        NOT NULL CHECK (rol IN ('admin', 'constructor', 'colaborador', 'observador')),
  activo     BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(obra_id, usuario_id)
);

-- ── 4. Agregar obra_id a tablas existentes (nullable primero) ─
ALTER TABLE public.partidas  ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES public.obras(id);
ALTER TABLE public.gastos    ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES public.obras(id);
ALTER TABLE public.anticipos ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES public.obras(id);

-- ── 5. Migrar datos existentes ────────────────────────────────
DO $$
DECLARE
  v_obra_id    UUID;
  v_nombre     TEXT;
  v_dash_c     BOOLEAN;
  v_dash_col   BOOLEAN;
  v_dash_obs   BOOLEAN;
BEGIN
  -- 5a. Leer configuracion actual (o usar valores por defecto)
  SELECT nombre_obra, dash_constructor, dash_colaborador, dash_observador
  INTO   v_nombre,    v_dash_c,         v_dash_col,        v_dash_obs
  FROM   public.configuracion
  WHERE  id = 1;

  IF v_nombre IS NULL THEN
    v_nombre   := 'Obra Principal';
    v_dash_c   := true;
    v_dash_col := true;
    v_dash_obs := true;
  END IF;

  -- 5b. Crear la primera obra
  INSERT INTO public.obras (nombre, dash_constructor, dash_colaborador, dash_observador)
  VALUES (v_nombre, v_dash_c, v_dash_col, v_dash_obs)
  RETURNING id INTO v_obra_id;

  -- 5c. Vincular partidas, gastos y anticipos existentes a esa obra
  UPDATE public.partidas  SET obra_id = v_obra_id WHERE obra_id IS NULL;
  UPDATE public.gastos    SET obra_id = v_obra_id WHERE obra_id IS NULL;
  UPDATE public.anticipos SET obra_id = v_obra_id WHERE obra_id IS NULL;

  -- 5d. Crear membresías para todos los usuarios activos
  --     director → admin  |  resto mantienen su rol
  INSERT INTO public.obra_usuarios (obra_id, usuario_id, rol)
  SELECT
    v_obra_id,
    id,
    CASE WHEN rol = 'director' THEN 'admin' ELSE rol END
  FROM public.profiles
  WHERE rol != 'superadmin'
  ON CONFLICT (obra_id, usuario_id) DO NOTHING;
END $$;

-- ── 6. obra_id NOT NULL (ya todos los registros tienen valor) ─
ALTER TABLE public.partidas  ALTER COLUMN obra_id SET NOT NULL;
ALTER TABLE public.gastos    ALTER COLUMN obra_id SET NOT NULL;
ALTER TABLE public.anticipos ALTER COLUMN obra_id SET NOT NULL;

-- ── 7. Habilitar RLS en nuevas tablas ─────────────────────────
ALTER TABLE public.obras         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_usuarios ENABLE ROW LEVEL SECURITY;

-- ── 8. RLS: obras ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Miembros ven su obra"         ON public.obras;
DROP POLICY IF EXISTS "Solo superadmin gestiona obras" ON public.obras;

CREATE POLICY "Miembros ven su obra"
  ON public.obras FOR SELECT
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = obras.id
        AND ou.usuario_id = auth.uid()
        AND ou.activo = true
    )
  );

CREATE POLICY "Solo superadmin gestiona obras"
  ON public.obras FOR ALL
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
  );

-- ── 9. RLS: obra_usuarios ─────────────────────────────────────
DROP POLICY IF EXISTS "Ver miembros de su obra"        ON public.obra_usuarios;
DROP POLICY IF EXISTS "Admin gestiona miembros de su obra" ON public.obra_usuarios;

CREATE POLICY "Ver miembros de su obra"
  ON public.obra_usuarios FOR SELECT
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou2
      WHERE ou2.obra_id = obra_usuarios.obra_id
        AND ou2.usuario_id = auth.uid()
        AND ou2.activo = true
    )
  );

CREATE POLICY "Admin gestiona miembros de su obra"
  ON public.obra_usuarios FOR ALL
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou2
      WHERE ou2.obra_id = obra_usuarios.obra_id
        AND ou2.usuario_id = auth.uid()
        AND ou2.rol = 'admin'
        AND ou2.activo = true
    )
  );

-- ── 10. RLS: partidas ─────────────────────────────────────────
DROP POLICY IF EXISTS "Autenticados ven partidas"    ON public.partidas;
DROP POLICY IF EXISTS "Director gestiona partidas"   ON public.partidas;
DROP POLICY IF EXISTS "Miembros ven partidas de su obra" ON public.partidas;
DROP POLICY IF EXISTS "Admin gestiona partidas de su obra" ON public.partidas;

CREATE POLICY "Miembros ven partidas de su obra"
  ON public.partidas FOR SELECT
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = partidas.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.activo = true
    )
  );

CREATE POLICY "Admin gestiona partidas de su obra"
  ON public.partidas FOR ALL
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = partidas.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol = 'admin'
        AND ou.activo = true
    )
  );

-- ── 11. RLS: gastos ───────────────────────────────────────────
DROP POLICY IF EXISTS "Ver gastos según rol"                    ON public.gastos;
DROP POLICY IF EXISTS "Constructor y colaborador ingresan gastos" ON public.gastos;
DROP POLICY IF EXISTS "Director aprueba/rechaza gastos"         ON public.gastos;
DROP POLICY IF EXISTS "Director edita gastos"                   ON public.gastos;
DROP POLICY IF EXISTS "Ver gastos de su obra"                   ON public.gastos;
DROP POLICY IF EXISTS "Ingresar gastos en su obra"              ON public.gastos;
DROP POLICY IF EXISTS "Admin edita gastos de su obra"           ON public.gastos;

CREATE POLICY "Ver gastos de su obra"
  ON public.gastos FOR SELECT
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = gastos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.activo = true
        -- constructor solo ve sus propios gastos
        AND (ou.rol != 'constructor' OR gastos.usuario_id = auth.uid())
    )
  );

CREATE POLICY "Ingresar gastos en su obra"
  ON public.gastos FOR INSERT
  WITH CHECK (
    auth.uid() = usuario_id
    AND
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = gastos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol IN ('constructor', 'colaborador')
        AND ou.activo = true
    )
  );

CREATE POLICY "Admin edita gastos de su obra"
  ON public.gastos FOR UPDATE
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = gastos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol = 'admin'
        AND ou.activo = true
    )
  )
  WITH CHECK (TRUE);

-- ── 12. RLS: anticipos ────────────────────────────────────────
DROP POLICY IF EXISTS "Ver anticipos según rol"      ON public.anticipos;
DROP POLICY IF EXISTS "Director gestiona anticipos"  ON public.anticipos;
DROP POLICY IF EXISTS "Ver anticipos de su obra"     ON public.anticipos;
DROP POLICY IF EXISTS "Admin gestiona anticipos de su obra" ON public.anticipos;

CREATE POLICY "Ver anticipos de su obra"
  ON public.anticipos FOR SELECT
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = anticipos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.activo = true
        -- constructor/colaborador solo ven sus propios anticipos
        AND (ou.rol NOT IN ('constructor', 'colaborador') OR anticipos.constructor_id = auth.uid())
    )
  );

CREATE POLICY "Admin gestiona anticipos de su obra"
  ON public.anticipos FOR ALL
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = anticipos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol = 'admin'
        AND ou.activo = true
    )
  );

-- ── 13. RLS: items_partida (acceso vía partidas.obra_id) ──────
DROP POLICY IF EXISTS "Autenticados ven items"           ON public.items_partida;
DROP POLICY IF EXISTS "Director gestiona items"          ON public.items_partida;
DROP POLICY IF EXISTS "Miembros ven items de su obra"    ON public.items_partida;
DROP POLICY IF EXISTS "Admin gestiona items de su obra"  ON public.items_partida;

CREATE POLICY "Miembros ven items de su obra"
  ON public.items_partida FOR SELECT
  USING (
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
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
    (SELECT rol FROM public.profiles WHERE id = auth.uid()) = 'superadmin'
    OR
    EXISTS (
      SELECT 1
      FROM   public.partidas p
      JOIN   public.obra_usuarios ou ON ou.obra_id = p.obra_id
      WHERE  p.id = items_partida.partida_id
        AND  ou.usuario_id = auth.uid()
        AND  ou.rol = 'admin'
        AND  ou.activo = true
    )
  );

-- ── 14. RLS: configuracion (lectura; queda deprecada) ─────────
-- Se mantiene como está. El frontend la dejará de usar en Fase 4.

COMMIT;
