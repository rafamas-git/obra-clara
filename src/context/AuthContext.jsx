import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const DEFAULT_PERMISOS = {
  dashboard:   { constructor: true,  colaborador: true,  observador: true  },
  presupuesto: { constructor: false, colaborador: true,  observador: true  },
}

function parsePermisos(cfg) {
  if (!cfg) return DEFAULT_PERMISOS
  return {
    dashboard: {
      constructor: cfg.dash_constructor  ?? true,
      colaborador: cfg.dash_colaborador  ?? true,
      observador:  cfg.dash_observador   ?? true,
    },
    presupuesto: {
      constructor: cfg.presup_constructor ?? false,
      colaborador: cfg.presup_colaborador ?? true,
      observador:  cfg.presup_observador  ?? true,
    },
  }
}

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null)
  const [profile, setProfile]     = useState(null)
  const [loading, setLoading]     = useState(true)
  const [nombreObra, setNombreObra] = useState('')
  const [permisos, setPermisos]   = useState(DEFAULT_PERMISOS)

  async function loadConfig() {
    const { data } = await supabase.from('configuracion').select('*').eq('id', 1).single()
    if (data) {
      setNombreObra(data.nombre_obra)
      setPermisos(parsePermisos(data))
    }
  }

  async function loadProfile(authUser) {
    if (!authUser) { setProfile(null); return }
    const { data } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
    setProfile(data)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      Promise.all([
        loadProfile(session?.user ?? null),
        loadConfig(),
      ]).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      loadProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  function isRole(...roles) {
    return profile ? roles.includes(profile.rol) : false
  }

  async function updateNombreObra(nombre) {
    const { error } = await supabase.from('configuracion').update({ nombre_obra: nombre }).eq('id', 1)
    if (error) throw error
    setNombreObra(nombre)
  }

  async function updatePermisos(seccion, rol, value) {
    const col = seccion === 'dashboard'
      ? `dash_${rol}`
      : `presup_${rol}`
    const { error } = await supabase.from('configuracion').update({ [col]: value }).eq('id', 1)
    if (error) throw error
    setPermisos((prev) => ({
      ...prev,
      [seccion]: { ...prev[seccion], [rol]: value },
    }))
  }

  function canAccess(seccion) {
    const rol = profile?.rol
    if (!rol || rol === 'director') return true
    return permisos[seccion]?.[rol] ?? false
  }

  const value = {
    user, profile, loading,
    nombreObra, updateNombreObra,
    permisos, updatePermisos, canAccess,
    signIn, signOut, isRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
