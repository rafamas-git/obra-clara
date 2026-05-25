import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { data: { user: caller } } = await supabaseClient.auth.getUser()
    if (!caller) throw new Error('No autorizado')

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('rol')
      .eq('id', caller.id)
      .single()

    const isSuperadmin = callerProfile?.rol === 'superadmin'

    const { userId, activo, obra_id } = await req.json()
    if (!userId) throw new Error('userId requerido')

    // Autorización
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
        throw new Error('Solo el administrador de la obra puede gestionar usuarios')
      }
    }

    // Actualizar obra_usuarios.activo si se proporcionó obra_id
    if (obra_id) {
      const { error: ouError } = await supabaseAdmin
        .from('obra_usuarios')
        .update({ activo })
        .eq('obra_id', obra_id)
        .eq('usuario_id', userId)

      if (ouError) throw ouError
    }

    // Actualizar profiles.activo (estado global del usuario en la plataforma)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ activo })
      .eq('id', userId)

    if (profileError) throw profileError

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
