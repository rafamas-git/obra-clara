import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('Faltan variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY')
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Genera una URL firmada para una foto almacenada en Storage
export async function getSignedUrl(path) {
  if (!path) return null
  const { data } = await supabase.storage
    .from('recibos')
    .createSignedUrl(path, 3600) // 1 hora de validez
  return data?.signedUrl ?? null
}
