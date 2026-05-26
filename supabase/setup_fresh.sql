-- ============================================================
-- ObraClara — Setup completo para instalación nueva (DEV)
-- Reemplaza ejecutar schema.sql + migrations v2 a v13 por separado
-- ============================================================

-- ── 1. profiles ───────────────────────────────────────────────
CREATE TABLE public.profiles (
  id         UUID         REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email      TEXT         NOT NULL,
  nombre     TEXT         NOT NULL,
  rol        TEXT         NOT NULL CHECK (rol IN ('superadmin','director','constructor','colaborador','observador')),
  activo     BOOLEAN      DEFAULT true,
  created_at TIMESTAMPTZ  DEFAULT now()
);

-- ── 2. configuracion ──────────────────────────────────────────
CREATE TABLE public.configuracion (
  id                 INTEGER PRIMARY KEY DEFAULT 1,
  nombre_obra        TEXT    NOT NULL DEFAULT 'Mi Obra',
  dash_constructor   BOOLEAN NOT NULL DEFAULT true,
  dash_colaborador   BOOLEAN NOT NULL DEFAULT true,
  dash_observador    BOOLEAN NOT NULL DEFAULT true,
  presup_constructor BOOLEAN NOT NULL DEFAULT false,
  presup_colaborador BOOLEAN NOT NULL DEFAULT true,
  presup_observador  BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT una_sola_fila CHECK (id = 1)
);

INSERT INTO public.configuracion (id, nombre_obra) VALUES (1, 'Mi Obra') ON CONFLICT (id) DO NOTHING;

-- ── 3. obras ──────────────────────────────────────────────────
CREATE TABLE public.obras (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre           TEXT        NOT NULL,
  descripcion      TEXT,
  activo           BOOLEAN     DEFAULT true,
  dash_constructor BOOLEAN     DEFAULT true,
  dash_colaborador BOOLEAN     DEFAULT true,
  dash_observador  BOOLEAN     DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── 4. obra_usuarios ──────────────────────────────────────────
CREATE TABLE public.obra_usuarios (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  obra_id    UUID        NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  usuario_id UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rol        TEXT        NOT NULL CHECK (rol IN ('admin','constructor','colaborador','observador')),
  activo     BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(obra_id, usuario_id)
);

-- ── 5. partidas ───────────────────────────────────────────────
CREATE TABLE public.partidas (
  id                   UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre               TEXT         NOT NULL,
  presupuesto_estimado NUMERIC(12,2) NOT NULL DEFAULT 0,
  orden                INTEGER      DEFAULT 0,
  activo               BOOLEAN      DEFAULT true,
  created_at           TIMESTAMPTZ  DEFAULT now(),
  obra_id              UUID         NOT NULL REFERENCES public.obras(id)
);

-- ── 6. items_partida ──────────────────────────────────────────
CREATE TABLE public.items_partida (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  partida_id      UUID    NOT NULL REFERENCES public.partidas(id) ON DELETE CASCADE,
  descripcion     TEXT    NOT NULL,
  unidad          TEXT,
  cantidad        NUMERIC,
  precio_unitario NUMERIC,
  total           NUMERIC,
  orden           INTEGER NOT NULL DEFAULT 0
);

-- ── 7. gastos ─────────────────────────────────────────────────
CREATE TABLE public.gastos (
  id                 UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  partida_id         UUID         REFERENCES public.partidas(id),
  usuario_id         UUID         REFERENCES public.profiles(id),
  descripcion        TEXT         NOT NULL,
  monto              NUMERIC(12,2) NOT NULL,
  foto_url           TEXT,
  foto_path          TEXT,
  estado             TEXT         DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado','anulado')),
  comentario_rechazo TEXT,
  aprobado_por       UUID         REFERENCES public.profiles(id),
  aprobado_en        TIMESTAMPTZ,
  fecha_gasto        DATE         DEFAULT current_date,
  created_at         TIMESTAMPTZ  DEFAULT now(),
  cantidad           NUMERIC,
  unidad_medida      TEXT,
  precio_unitario    NUMERIC,
  obra_id            UUID         NOT NULL REFERENCES public.obras(id)
);

-- ── 8. anticipos ──────────────────────────────────────────────
CREATE TABLE public.anticipos (
  id             UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  constructor_id UUID         REFERENCES public.profiles(id) NOT NULL,
  director_id    UUID         REFERENCES public.profiles(id) NOT NULL,
  monto          NUMERIC(12,2) NOT NULL,
  descripcion    TEXT,
  fecha          DATE         DEFAULT current_date,
  created_at     TIMESTAMPTZ  DEFAULT now(),
  obra_id        UUID         NOT NULL REFERENCES public.obras(id)
);

-- ── 9. unidades_medida ────────────────────────────────────────
CREATE TABLE public.unidades_medida (
  codigo     TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.unidades_medida (codigo) VALUES
  ('m²'), ('ml'), ('m³'), ('kg'), ('ton'), ('un'), ('gl'), ('hr'), ('lt'), ('bolsa'), ('saco'), ('plg')
ON CONFLICT DO NOTHING;

-- ============================================================
-- Row Level Security — habilitar
-- ============================================================

ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.configuracion   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obra_usuarios   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partidas        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items_partida   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anticipos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unidades_medida ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Funciones SECURITY DEFINER (evitan recursión en RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol = 'superadmin');
$$;

CREATE OR REPLACE FUNCTION public.is_obra_member(p_obra_id uuid)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.obra_usuarios
    WHERE obra_id = p_obra_id AND usuario_id = auth.uid() AND activo = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_obra_admin(p_obra_id uuid)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.obra_usuarios
    WHERE obra_id = p_obra_id AND usuario_id = auth.uid() AND rol = 'admin' AND activo = true
  );
$$;

-- ============================================================
-- Políticas RLS — estado final (equivalente a post-v13)
-- ============================================================

-- ── profiles ──────────────────────────────────────────────────
CREATE POLICY "Todos pueden ver perfiles"
  ON public.profiles FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Usuarios actualizan su propio perfil"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- ── configuracion ─────────────────────────────────────────────
CREATE POLICY "Autenticados leen configuracion"
  ON public.configuracion FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admin actualiza configuracion"
  ON public.configuracion FOR UPDATE
  USING ((SELECT rol FROM public.profiles WHERE id = auth.uid()) IN ('director','superadmin'));

-- ── obras ─────────────────────────────────────────────────────
CREATE POLICY "Miembros ven su obra"
  ON public.obras FOR SELECT
  USING (public.is_superadmin() OR public.is_obra_member(obras.id));

CREATE POLICY "Superadmin gestiona obras"
  ON public.obras FOR ALL
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ── obra_usuarios ─────────────────────────────────────────────
CREATE POLICY "Ver miembros de su obra"
  ON public.obra_usuarios FOR SELECT
  USING (public.is_superadmin() OR public.is_obra_member(obra_usuarios.obra_id));

CREATE POLICY "Admin gestiona miembros de su obra"
  ON public.obra_usuarios FOR ALL
  USING (public.is_superadmin() OR public.is_obra_admin(obra_usuarios.obra_id))
  WITH CHECK (public.is_superadmin() OR public.is_obra_admin(obra_usuarios.obra_id));

-- ── partidas ──────────────────────────────────────────────────
CREATE POLICY "Miembros ven partidas de su obra"
  ON public.partidas FOR SELECT
  USING (public.is_superadmin() OR public.is_obra_member(partidas.obra_id));

CREATE POLICY "Admin gestiona partidas de su obra"
  ON public.partidas FOR ALL
  USING (public.is_superadmin() OR public.is_obra_admin(partidas.obra_id))
  WITH CHECK (public.is_superadmin() OR public.is_obra_admin(partidas.obra_id));

-- ── items_partida ─────────────────────────────────────────────
CREATE POLICY "Miembros ven items de su obra"
  ON public.items_partida FOR SELECT
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.partidas p
      WHERE p.id = items_partida.partida_id AND public.is_obra_member(p.obra_id)
    )
  );

CREATE POLICY "Admin gestiona items de su obra"
  ON public.items_partida FOR ALL
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.partidas p
      WHERE p.id = items_partida.partida_id AND public.is_obra_admin(p.obra_id)
    )
  )
  WITH CHECK (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.partidas p
      WHERE p.id = items_partida.partida_id AND public.is_obra_admin(p.obra_id)
    )
  );

-- ── gastos ────────────────────────────────────────────────────
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

CREATE POLICY "Ingresar gastos en su obra"
  ON public.gastos FOR INSERT
  WITH CHECK (
    auth.uid() = usuario_id
    AND EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = gastos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.rol IN ('constructor','colaborador')
        AND ou.activo = true
    )
  );

CREATE POLICY "Admin edita gastos de su obra"
  ON public.gastos FOR UPDATE
  USING (public.is_superadmin() OR public.is_obra_admin(gastos.obra_id))
  WITH CHECK (TRUE);

-- ── anticipos ─────────────────────────────────────────────────
CREATE POLICY "Ver anticipos de su obra"
  ON public.anticipos FOR SELECT
  USING (
    public.is_superadmin()
    OR EXISTS (
      SELECT 1 FROM public.obra_usuarios ou
      WHERE ou.obra_id = anticipos.obra_id
        AND ou.usuario_id = auth.uid()
        AND ou.activo = true
        AND (ou.rol NOT IN ('constructor','colaborador') OR anticipos.constructor_id = auth.uid())
    )
  );

CREATE POLICY "Admin gestiona anticipos de su obra"
  ON public.anticipos FOR ALL
  USING (public.is_superadmin() OR public.is_obra_admin(anticipos.obra_id))
  WITH CHECK (public.is_superadmin() OR public.is_obra_admin(anticipos.obra_id));

-- ── unidades_medida ───────────────────────────────────────────
CREATE POLICY "Ver unidades"
  ON public.unidades_medida FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Agregar unidades"
  ON public.unidades_medida FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================
-- Storage bucket para recibos
-- ============================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('recibos', 'recibos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Autenticados suben recibos"      ON storage.objects;
DROP POLICY IF EXISTS "Autenticados ven recibos"        ON storage.objects;
DROP POLICY IF EXISTS "Autenticados eliminan sus recibos" ON storage.objects;

CREATE POLICY "Autenticados suben recibos"
  ON storage.objects FOR INSERT
  WITH CHECK (auth.role() = 'authenticated' AND bucket_id = 'recibos');

CREATE POLICY "Autenticados ven recibos"
  ON storage.objects FOR SELECT
  USING (auth.role() = 'authenticated' AND bucket_id = 'recibos');

CREATE POLICY "Autenticados eliminan sus recibos"
  ON storage.objects FOR DELETE
  USING (auth.uid()::text = (storage.foldername(name))[1] AND bucket_id = 'recibos');

-- ============================================================
-- Trigger: auto-asigna obra_id en inserts
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_obra_id_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.obra_id IS NULL THEN
    SELECT ou.obra_id INTO NEW.obra_id
    FROM public.obra_usuarios ou
    WHERE ou.usuario_id = auth.uid() AND ou.activo = true
    ORDER BY ou.created_at LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER gastos_set_obra_id
  BEFORE INSERT ON public.gastos
  FOR EACH ROW EXECUTE FUNCTION public.set_obra_id_default();

CREATE TRIGGER partidas_set_obra_id
  BEFORE INSERT ON public.partidas
  FOR EACH ROW EXECUTE FUNCTION public.set_obra_id_default();

CREATE TRIGGER anticipos_set_obra_id
  BEFORE INSERT ON public.anticipos
  FOR EACH ROW EXECUTE FUNCTION public.set_obra_id_default();

-- ============================================================
-- PASO FINAL: crear superadmin
-- En Supabase Authentication → Add user: admin@tuempresa.com
-- Luego ejecutar:
--
-- INSERT INTO public.profiles (id, email, nombre, rol, activo)
-- SELECT id, email, 'Superadmin', 'superadmin', true
-- FROM auth.users WHERE email = 'admin@tuempresa.com';
-- ============================================================
