# ObraClara — Guía de Configuración

## 1. Crear proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) → New Project
2. Copia la **URL del proyecto** y la **anon key** desde `Settings → API`
3. Crea el archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

---

## 2. Ejecutar el schema SQL

En Supabase → **SQL Editor**, copia y ejecuta el contenido de `supabase/schema.sql`.

---

## 3. Crear el Superadmin

### Paso A: Crear en Supabase Auth
En Supabase → **Authentication → Users → Add user**:
- Email: `admin@tuempresa.com`
- Password: una contraseña segura
- **No marcar** "Send invite email"

### Paso B: Crear perfil en la DB
En **SQL Editor**, reemplaza el UUID y ejecuta:

```sql
INSERT INTO public.profiles (id, email, nombre, rol, activo)
SELECT id, email, 'Superadmin', 'superadmin', true
FROM auth.users
WHERE email = 'admin@tuempresa.com';
```

### Paso C: Crear obras y admins
Inicia sesión con la cuenta superadmin → el sistema redirige a `/superadmin`.
Desde ahí se crean las obras y se asignan administradores (usuarios nuevos o existentes) a cada una.

---

## 4. Desplegar las Edge Functions

```bash
# Instalar Supabase CLI
npm install -g supabase

# Login
supabase login

# Vincular proyecto
supabase link --project-ref TU_PROJECT_REF

# Desplegar funciones
supabase functions deploy create-user
supabase functions deploy toggle-user
supabase functions deploy parse-partidas
```

Las funciones usan `SUPABASE_SERVICE_ROLE_KEY` automáticamente en el entorno de Supabase.

---

## 5. Ejecutar en desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 6. Deploy en Vercel

**Producción:** https://obracl.vercel.app

**Repositorio GitHub:** https://github.com/rafamas-git/obra-clara

**Cuenta Vercel:** rafamas-4291

### Publicar cambios

```bash
npm run deploy
```

Hace `git push` a GitHub y luego despliega directamente con el CLI de Vercel (`npx vercel --prod --yes`).

> La primera vez en un equipo nuevo hay que autenticarse antes: `npx vercel login`

### Variables de entorno (ya configuradas en Vercel)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> `vercel.json` está en el repo con rewrites SPA (`/(.*) → /index.html`), necesario para que las rutas como `/superadmin` funcionen al recargar.

---

## 7. Instalar como PWA en celular

Una vez desplegada:
- **Android (Chrome):** Menú → "Añadir a pantalla de inicio"
- **iPhone (Safari):** Compartir → "Añadir a pantalla de inicio"

---

## Estructura del Excel de cubicación

El archivo `.xlsx` debe tener al menos estas columnas en la **primera hoja**:

| Partida | Presupuesto estimado (con IVA) |
|---------|-------------------------------|
| Excavaciones | 5000000 |
| Estructura de hormigón | 15000000 |

---

## Roles y permisos

| Rol | Scope | Descripción |
|-----|-------|-------------|
| Superadmin | Global (`profiles.rol`) | Gestiona la plataforma desde `/superadmin`: crea obras, asigna admins |
| Admin | Por obra (`obra_usuarios.rol`) | Gestiona su obra: partidas, aprueba gastos, administra usuarios de la obra |
| Constructor | Por obra | Registra gastos, ve su propia caja |
| Colaborador | Por obra | Registra gastos, ve todos los gastos y caja de la obra |
| Observador | Por obra | Solo lectura del dashboard |
