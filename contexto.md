# Contexto ObraClara

## Estado del repositorio
- Rama: `main` — sincronizada con `origin/main`
- Último commit: `b37c952` fix: parse-partidas — temperature 0 para parseo determinista, autorización admin multi-obra
- Sin commitear: `contexto.md`, `.gitignore`, migrations v11–v13 y setup_superadmin.sql (soporte, no afectan la app)

## Problema que estamos resolviendo
Refactor multi-obra completado y en producción. La sesión terminó con ajustes post-deploy: RLS, superadmin, importador de partidas. No hay tarea abierta activa.

## Dónde quedamos exactamente
- Fases 1–6 del refactor multi-obra completas y desplegadas en `obracl.vercel.app`
- RLS corregida con tres funciones SECURITY DEFINER: `is_superadmin()`, `is_obra_member()`, `is_obra_admin()` — migrations v11–v13 aplicadas en BD (no commiteadas)
- Superadmin (`admin@admin.cl` / `admin123`) funciona: ve obras, asigna usuarios existentes o crea nuevos
- `parse-partidas` actualizado: `temperature: 0` + autorización acepta admin multi-obra
- Deploy ahora usa `npx vercel --prod --yes` (el deploy hook antiguo no propagaba cambios)

## Próximo paso concreto
Commitear archivos pendientes si se quiere tenerlos en el repo:
```
git add supabase/migration_v1*.sql supabase/setup_superadmin.sql contexto.md
git commit -m "chore: migrations v11-v13 RLS fix y setup superadmin"
```

## Decisiones vigentes
- RLS usa funciones SECURITY DEFINER en vez de subqueries inline — las subqueries causaban recursión infinita en `obra_usuarios`
- `profiles.rol` mantiene valores legacy (`director`, etc.); el rol real por obra vive en `obra_usuarios.rol`
- Deploy: `npm run deploy` = `git push origin main` + `npx vercel --prod --yes` (requiere `npx vercel login` previo)
- `parse-partidas` autoriza: superadmin OR profiles.rol='director' OR obra_usuarios.rol='admin'

## Archivos que se estaban tocando
- `supabase/functions/parse-partidas/index.ts`
- `src/pages/SuperadminDashboard.jsx`
- `supabase/migration_v11_superadmin_rls.sql` (no commiteado)
- `supabase/migration_v12_fix_rls_recursion.sql` (no commiteado)
- `supabase/migration_v13_fix_rls_final.sql` (no commiteado)

## Problemas conocidos pendientes
- "Casa Ensenada" es obra de prueba creada durante el desarrollo — eliminar desde panel superadmin cuando convenga
- Cambio de rol de un usuario dentro de una obra no está implementado en la UI
