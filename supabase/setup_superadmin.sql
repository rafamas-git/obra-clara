INSERT INTO public.profiles (id, email, nombre, rol, activo)
SELECT id, email, 'Superadmin', 'superadmin', true
FROM auth.users
WHERE email = 'admin@admin.cl';
