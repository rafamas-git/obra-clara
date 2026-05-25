import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const OBRA_KEY = 'obra_clara_obra_id'

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [profile, setProfile]       = useState(null)
  const [loading, setLoading]       = useState(true)

  // Multi-obra
  const [misObras, setMisObras]     = useState([])   // [{ obra, rol }]
  const [obraActual, setObraActual] = useState(null)  // obra row de obras
  const [rolEnObra, setRolEnObra]   = useState(null)  // 'admin'|'constructor'|...

  const isSuperadmin = profile?.rol === 'superadmin'

  // Derivados para compatibilidad con código existente
  const nombreObra = obraActual?.nombre ?? ''
  const permisos = {
    dashboard: {
      constructor: obraActual?.dash_constructor ?? true,
      colaborador: obraActual?.dash_colaborador ?? true,
      observador:  obraActual?.dash_observador  ?? true,
    },
  }

  async function loadProfile(authUser) {
    if (!authUser) { setProfile(null); return null }
    const { data } = await supabase.from('profiles').select('*').eq('id', authUser.id).single()
    setProfile(data)
    return data
  }

  async function loadObras(authUser, prof) {
    if (!authUser || prof?.rol === 'superadmin') {
      setMisObras([]); setObraActual(null); setRolEnObra(null)
      return
    }

    const { data } = await supabase
      .from('obra_usuarios')
      .select('rol, activo, obra:obras(*)')
      .eq('usuario_id', authUser.id)
      .eq('activo', true)

    if (!data || data.length === 0) {
      setMisObras([]); setObraActual(null); setRolEnObra(null)
      return
    }

    const obras = data.map(d => ({ obra: d.obra, rol: d.rol }))
    setMisObras(obras)

    // Seleccionar obra: desde localStorage o la primera disponible
    const savedId = localStorage.getItem(OBRA_KEY)
    const match   = obras.find(o => o.obra.id === savedId) ?? obras[0]
    setObraActual(match.obra)
    setRolEnObra(match.rol)
  }

  async function inicializar(authUser) {
    const prof = await loadProfile(authUser)
    await loadObras(authUser, prof)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      inicializar(session?.user ?? null).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      inicializar(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  function seleccionarObra(obraId) {
    const match = misObras.find(o => o.obra.id === obraId)
    if (!match) return
    localStorage.setItem(OBRA_KEY, obraId)
    setObraActual(match.obra)
    setRolEnObra(match.rol)
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
    setMisObras([]); setObraActual(null); setRolEnObra(null)
  }

  // isRole: 'director' se mapea a 'admin' en rolEnObra para compatibilidad con código existente
  function isRole(...roles) {
    if (!profile) return false
    if (profile.rol === 'superadmin' && roles.includes('superadmin')) return true
    const mappedRoles = roles.map(r => r === 'director' ? 'admin' : r)
    return mappedRoles.includes(rolEnObra)
  }

  function canAccess(seccion) {
    if (!profile) return false
    if (isSuperadmin) return true
    if (rolEnObra === 'admin') return true
    return permisos[seccion]?.[rolEnObra] ?? false
  }

  async function updateNombreObra(nombre) {
    if (!obraActual) return
    const { error } = await supabase.from('obras').update({ nombre }).eq('id', obraActual.id)
    if (error) throw error
    setObraActual(prev => ({ ...prev, nombre }))
  }

  async function updatePermisos(seccion, rol, value) {
    if (!obraActual) return
    const col = `dash_${rol}`
    const { error } = await supabase.from('obras').update({ [col]: value }).eq('id', obraActual.id)
    if (error) throw error
    setObraActual(prev => ({ ...prev, [col]: value }))
  }

  const value = {
    user, profile, loading, isSuperadmin,
    // Multi-obra
    obraActual, rolEnObra, misObras, seleccionarObra,
    // Compatibilidad con código existente
    nombreObra, permisos,
    updateNombreObra, updatePermisos, canAccess,
    signIn, signOut, isRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
