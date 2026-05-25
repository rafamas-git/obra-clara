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

## 3. Crear el primer usuario Director

### Paso A: Crear en Supabase Auth
En Supabase → **Authentication → Users → Add user**:
- Email: `director@tuempresa.com`
- Password: una contraseña segura
- **No marcar** "Send invite email" si no quieres email

### Paso B: Crear perfil en la DB
En **SQL Editor**, reemplaza el UUID y ejecuta:

```sql
INSERT INTO public.profiles (id, email, nombre, rol)
VALUES (
  'UUID-COPIADO-DE-AUTH-USERS',
  'director@tuempresa.com',
  'Nombre del Director',
  'director'
);
```

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

```bash
npm run build
```

En [vercel.com](https://vercel.com) → **Add New Project** → importa el repositorio de Git.

Vercel detecta Vite automáticamente. Agrega las variables de entorno en **Settings → Environment Variables**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

> El archivo `vercel.json` no es necesario para Vite; Vercel infiere la configuración de build (`npm run build`) y el directorio de salida (`dist/`) automáticamente.

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

| Rol         | Ingresar gastos | Aprobar | Dashboard | Caja | Admin |
|-------------|:-:|:-:|:-:|:-:|:-:|
| Director    | ✗ | ✓ | ✓ | ✓ | ✓ |
| Constructor | ✓ | ✗ | Solo propio | Solo propio | ✗ |
| Colaborador | ✓ | ✗ | ✓ | ✗ | ✗ |
| Observador  | ✗ | ✗ | ✓ | ✗ | ✗ |
