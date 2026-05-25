import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const VALID_OBRA_ROLES = ['admin', 'constructor', 'colaborador', 'observador']

// profiles.rol only accepts these values (legacy constraint)
const ROL_TO_PROFILE: Record<string, string> = {
  admin:       'director',
  constructor: 'constructor',
  colaborador: 'colaborador',
  observador:  'observador',
  director:    'director',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No autorizado')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verificar identidad del caller
    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) throw new Error('No autorizado')

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('rol')
      .eq('id', caller.id)
      .single()

    const isSuperadmin = callerProfile?.rol === 'superadmin'

    const { email, password, nombre, rol, obra_id } = await req.json()

    if (!email || !password || !nombre || !rol) {
      throw new Error('Faltan campos requeridos: email, password, nombre, rol')
    }

    if (!VALID_OBRA_ROLES.includes(rol)) {
      throw new Error(`Rol inválido. Valores permitidos: ${VALID_OBRA_ROLES.join(', ')}`)
    }

    // Autorización: superadmin puede todo; admin solo puede crear en su propia obra
    if (!isSuperadmin) {
      if (!obra_id) throw new Error('obra_id requerido para administradores de obra')

      const { data: membership } = await supabaseAdmin
        .from('obra_usuarios')
        .select('rol')
        .eq('obra_id', obra_id)
        .eq('usuario_id', caller.id)
        .eq('activo', true)
        .single()

      if (membership?.rol !== 'admin') {
        throw new Error('Solo el administrador de la obra puede crear usuarios')
      }
    }

    // Crear usuario en Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (createError) throw createError

    // Insertar en profiles
    const profileRol = ROL_TO_PROFILE[rol] ?? 'constructor'
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({ id: newUser.user.id, email, nombre, rol: profileRol })

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
      throw profileError
    }

    // Insertar en obra_usuarios si se proporcionó obra_id
    if (obra_id) {
      const { error: ouError } = await supabaseAdmin
        .from('obra_usuarios')
        .insert({ obra_id, usuario_id: newUser.user.id, rol })

      if (ouError) {
        await supabaseAdmin.auth.admin.deleteUser(newUser.user.id)
        throw ouError
      }
    }

    return new Response(
      JSON.stringify({ success: true, user: { id: newUser.user.id } }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
