import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`
const pct = (g, p) => p > 0 ? Math.min(Math.round((g / p) * 100), 100) : 0

const ROL_LABELS = {
  admin: 'Administrador', constructor: 'Constructor',
  colaborador: 'Colaborador', observador: 'Observador',
}
const ROL_COLORS = {
  admin: 'bg-blue-100 text-blue-700', constructor: 'bg-orange-100 text-orange-700',
  colaborador: 'bg-green-100 text-green-700', observador: 'bg-gray-100 text-gray-600',
}

function StatCard({ label, value, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 text-blue-800', green: 'bg-green-50 text-green-800',
    amber: 'bg-amber-50 text-amber-800',
  }
  return (
    <div className={`rounded-2xl border border-white/60 p-5 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}

function MiniProgress({ value, max }) {
  const p = pct(value, max)
  const color = p >= 100 ? 'bg-red-400' : p >= 80 ? 'bg-amber-400' : 'bg-green-400'
  return (
    <div className="w-full">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${p}%` }} />
      </div>
      <p className={`text-[10px] mt-0.5 font-medium ${p >= 100 ? 'text-red-500' : p >= 80 ? 'text-amber-500' : 'text-green-600'}`}>
        {p}% ejecutado
      </p>
    </div>
  )
}

export default function SuperadminDashboard() {
  const { profile, signOut } = useAuth()
  const toast = useToast()

  const [obras, setObras]           = useState([])
  const [ouData, setOuData]         = useState([])   // obra_usuarios con profiles
  const [presMap, setPresMap]       = useState({})   // obra_id → total presupuesto
  const [gastMap, setGastMap]       = useState({})   // obra_id → total gastado
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState(null)

  // ── Modals ───────────────────────────────────────────────
  const [obraModal, setObraModal]   = useState(false)
  const [userModal, setUserModal]   = useState(false)
  const [preObraId, setPreObraId]   = useState('')   // obra pre-seleccionada al crear usuario

  const [formObra, setFormObra]     = useState({ nombre: '', descripcion: '' })
  const [savingObra, setSavingObra] = useState(false)

  const [formUser, setFormUser]     = useState({ nombre: '', email: '', password: '', rol: 'admin', obra_id: '' })
  const [userErrors, setUserErrors] = useState({})
  const [savingUser, setSavingUser] = useState(false)

  // ── Load ─────────────────────────────────────────────────
  async function load() {
    const [{ data: o }, { data: ou }, { data: p }, { data: g }] = await Promise.all([
      supabase.from('obras').select('*').order('created_at', { ascending: false }),
      supabase.from('obra_usuarios').select('obra_id, rol, activo, profiles:usuario_id(id, nombre, email)'),
      supabase.from('partidas').select('obra_id, presupuesto_estimado').eq('activo', true),
      supabase.from('gastos').select('obra_id, monto').eq('estado', 'aprobado'),
    ])
    setObras(o ?? [])
    setOuData(ou ?? [])

    const pm = {}
    for (const row of (p ?? [])) pm[row.obra_id] = (pm[row.obra_id] ?? 0) + Number(row.presupuesto_estimado)
    setPresMap(pm)

    const gm = {}
    for (const row of (g ?? [])) gm[row.obra_id] = (gm[row.obra_id] ?? 0) + Number(row.monto)
    setGastMap(gm)

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // ── Derived stats ─────────────────────────────────────────
  const totalObrasActivas = obras.filter((o) => o.activo).length
  const totalUsuarios = new Set(ouData.map((ou) => ou.profiles?.id).filter(Boolean)).size
  const totalGastado = Object.values(gastMap).reduce((s, n) => s + n, 0)

  function getObraInfo(obra) {
    const membres = ouData.filter((ou) => ou.obra_id === obra.id)
    const admins  = membres.filter((ou) => ou.rol === 'admin' && ou.activo && ou.profiles)
    const activos = membres.filter((ou) => ou.activo)
    return {
      membres,
      admins,
      totalActivos: activos.length,
      presupuesto: presMap[obra.id] ?? 0,
      gastado:     gastMap[obra.id] ?? 0,
    }
  }

  // ── Crear obra ────────────────────────────────────────────
  async function createObra() {
    if (!formObra.nombre.trim()) return
    setSavingObra(true)
    const { error } = await supabase.from('obras').insert({
      nombre:      formObra.nombre.trim(),
      descripcion: formObra.descripcion.trim() || null,
    })
    setSavingObra(false)
    if (error) { toast(`Error: ${error.message}`, 'error'); return }
    toast('Obra creada correctamente', 'success')
    setObraModal(false)
    setFormObra({ nombre: '', descripcion: '' })
    await load()
  }

  // ── Crear usuario ─────────────────────────────────────────
  function openUserModal(obraId = '') {
    setFormUser({ nombre: '', email: '', password: '', rol: 'admin', obra_id: obraId })
    setUserErrors({})
    setPreObraId(obraId)
    setUserModal(true)
  }

  async function createUser() {
    const errs = {}
    if (!formUser.nombre.trim())          errs.nombre   = 'Requerido'
    if (!formUser.email.includes('@'))    errs.email    = 'Email inválido'
    if (formUser.password.length < 6)    errs.password  = 'Mínimo 6 caracteres'
    if (!formUser.obra_id)               errs.obra_id   = 'Selecciona una obra'
    if (Object.keys(errs).length > 0)   { setUserErrors(errs); return }

    setSavingUser(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(formUser),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al crear usuario')

      toast('Usuario creado y asignado a la obra', 'success')
      setUserModal(false)
      await load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSavingUser(false)
    }
  }

  // ── Toggle obra activo ────────────────────────────────────
  async function toggleObra(obra) {
    const { error } = await supabase.from('obras').update({ activo: !obra.activo }).eq('id', obra.id)
    if (error) { toast(error.message, 'error'); return }
    toast(obra.activo ? 'Obra desactivada' : 'Obra reactivada', 'info')
    await load()
  }

  // ── Toggle miembro ────────────────────────────────────────
  async function toggleMember(obraId, userId, activo) {
    const { error } = await supabase.from('obra_usuarios')
      .update({ activo: !activo })
      .eq('obra_id', obraId)
      .eq('usuario_id', userId)
    if (error) { toast(error.message, 'error'); return }
    toast(activo ? 'Usuario desactivado de esta obra' : 'Usuario activado en esta obra', 'info')
    await load()
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">OC</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-none">ObraClara</p>
            <p className="text-xs text-primary-600 font-medium mt-0.5">Superadmin</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:block">{profile?.nombre}</span>
          <button onClick={signOut} className="text-sm text-red-600 hover:text-red-700 font-medium">
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Panel de administración</h1>
          <p className="text-gray-500 text-sm mt-1">Gestión global de obras y usuarios</p>
        </div>

        {loading ? <LoadingSpinner /> : (
          <>
            {/* ── Stats ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label="Obras activas" value={totalObrasActivas} color="blue" />
              <StatCard label="Usuarios en plataforma" value={totalUsuarios} color="green" />
              <StatCard label="Total ejecutado (global)" value={fmt(totalGastado)} color="amber" />
            </div>

            {/* ── Obras ── */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Obras</h2>
                  <p className="text-sm text-gray-500">{obras.length} obras registradas</p>
                </div>
                <Button size="sm" onClick={() => setObraModal(true)}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nueva obra
                </Button>
              </div>

              <div className="space-y-3">
                {obras.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400">
                    <p className="font-medium">Sin obras registradas</p>
                    <p className="text-sm mt-1">Crea la primera obra para comenzar</p>
                  </div>
                ) : obras.map((obra) => {
                  const { membres, admins, totalActivos, presupuesto, gastado } = getObraInfo(obra)
                  const isExpanded = expandedId === obra.id

                  return (
                    <div key={obra.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${obra.activo ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
                      {/* Obra header row */}
                      <div className="px-5 py-4 flex items-center gap-4">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${obra.activo ? 'bg-primary-100' : 'bg-gray-100'}`}>
                          <svg className={`w-5 h-5 ${obra.activo ? 'text-primary-600' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 truncate">{obra.nombre}</p>
                            {!obra.activo && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">Inactiva</span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-gray-500">
                            {admins.length > 0 ? (
                              <span>Admin: <span className="font-medium text-gray-700">{admins.map((a) => a.profiles.nombre).join(', ')}</span></span>
                            ) : (
                              <span className="text-amber-600 font-medium">Sin administrador asignado</span>
                            )}
                            <span>{totalActivos} miembro{totalActivos !== 1 ? 's' : ''}</span>
                          </div>
                          {presupuesto > 0 && (
                            <div className="mt-2 max-w-xs">
                              <MiniProgress value={gastado} max={presupuesto} />
                            </div>
                          )}
                        </div>

                        {/* Budget summary */}
                        <div className="hidden md:block text-right flex-shrink-0 min-w-[120px]">
                          <p className="text-xs text-gray-400">Presupuesto</p>
                          <p className="text-sm font-bold text-gray-800">{presupuesto > 0 ? fmt(presupuesto) : '—'}</p>
                          {presupuesto > 0 && <p className="text-xs text-gray-500">Ejecutado: {fmt(gastado)}</p>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => openUserModal(obra.id)}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 font-medium transition-colors"
                            title="Agregar usuario a esta obra"
                          >
                            + Usuario
                          </button>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : obra.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                            title={isExpanded ? 'Contraer' : 'Ver miembros'}
                          >
                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => toggleObra(obra)}
                            className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${obra.activo ? 'text-red-600 hover:bg-red-50 border border-red-200' : 'text-green-700 hover:bg-green-50 border border-green-200'}`}
                          >
                            {obra.activo ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded: members list */}
                      {isExpanded && (
                        <div className="border-t border-gray-50">
                          {membres.length === 0 ? (
                            <div className="px-5 py-4 text-sm text-gray-400 text-center">Sin miembros en esta obra</div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {membres.map((ou) => {
                                if (!ou.profiles) return null
                                return (
                                  <div key={ou.profiles.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors ${!ou.activo ? 'opacity-50' : ''}`}>
                                    <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                                      <span className="text-primary-700 font-bold text-xs">{ou.profiles.nombre.charAt(0).toUpperCase()}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-gray-800 truncate">{ou.profiles.nombre}</p>
                                      <p className="text-xs text-gray-400 truncate">{ou.profiles.email}</p>
                                    </div>
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${ROL_COLORS[ou.rol] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {ROL_LABELS[ou.rol] ?? ou.rol}
                                    </span>
                                    {!ou.activo && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactivo</span>
                                    )}
                                    <button
                                      onClick={() => toggleMember(obra.id, ou.profiles.id, ou.activo)}
                                      className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors ${ou.activo ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}
                                    >
                                      {ou.activo ? 'Quitar' : 'Activar'}
                                    </button>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          </>
        )}
      </main>

      {/* ── Modal nueva obra ── */}
      <Modal open={obraModal} onClose={() => setObraModal(false)} title="Nueva obra">
        <div className="space-y-4">
          <Input
            label="Nombre de la obra"
            placeholder="Ej: Edificio Los Olivos"
            value={formObra.nombre}
            onChange={(e) => setFormObra((f) => ({ ...f, nombre: e.target.value }))}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción (opcional)</label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent resize-none text-sm"
              placeholder="Dirección, descripción breve…"
              value={formObra.descripcion}
              onChange={(e) => setFormObra((f) => ({ ...f, descripcion: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setObraModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={savingObra} disabled={!formObra.nombre.trim()} onClick={createObra}>
              Crear obra
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal nuevo usuario ── */}
      <Modal open={userModal} onClose={() => setUserModal(false)} title="Crear usuario para obra">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl px-4 py-3 text-xs text-blue-800">
            El usuario podrá cambiar su contraseña desde su perfil.
          </div>

          <Select
            label="Obra"
            value={formUser.obra_id}
            onChange={(e) => setFormUser((f) => ({ ...f, obra_id: e.target.value }))}
            error={userErrors.obra_id}
            disabled={!!preObraId}
          >
            <option value="">— Selecciona una obra —</option>
            {obras.filter((o) => o.activo).map((o) => (
              <option key={o.id} value={o.id}>{o.nombre}</option>
            ))}
          </Select>

          <Select
            label="Rol en la obra"
            value={formUser.rol}
            onChange={(e) => setFormUser((f) => ({ ...f, rol: e.target.value }))}
          >
            {Object.entries(ROL_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </Select>

          <Input
            label="Nombre completo"
            placeholder="Nombre Apellido"
            value={formUser.nombre}
            onChange={(e) => setFormUser((f) => ({ ...f, nombre: e.target.value }))}
            error={userErrors.nombre}
          />
          <Input
            label="Email"
            type="email"
            placeholder="usuario@email.com"
            value={formUser.email}
            onChange={(e) => setFormUser((f) => ({ ...f, email: e.target.value }))}
            error={userErrors.email}
          />
          <Input
            label="Contraseña temporal"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={formUser.password}
            onChange={(e) => setFormUser((f) => ({ ...f, password: e.target.value }))}
            error={userErrors.password}
          />

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setUserModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={savingUser} onClick={createUser}>
              Crear usuario
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
