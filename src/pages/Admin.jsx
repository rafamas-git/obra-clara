import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import { Input, Select } from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'

const ROLES = ['constructor', 'colaborador', 'observador', 'director']

export default function Admin() {
  const { profile: myProfile } = useAuth()
  const toast = useToast()

  const [users, setUsers]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [addModal, setAddModal] = useState(false)
  const [saving, setSaving]     = useState(false)

  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'constructor' })
  const [errors, setErrors] = useState({})

  async function load() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function set(field) {
    return (e) => {
      setForm((f) => ({ ...f, [field]: e.target.value }))
      setErrors((e) => ({ ...e, [field]: '' }))
    }
  }

  function validate() {
    const e = {}
    if (!form.nombre.trim()) e.nombre = 'Nombre requerido'
    if (!form.email.trim() || !form.email.includes('@')) e.email = 'Email válido requerido'
    if (form.password.length < 6) e.password = 'Mínimo 6 caracteres'
    if (!form.rol) e.rol = 'Rol requerido'
    return e
  }

  async function createUser() {
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(form),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al crear usuario')
      toast('Usuario creado exitosamente', 'success')
      setAddModal(false)
      setForm({ nombre: '', email: '', password: '', rol: 'constructor' })
      await load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleUser(user) {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/toggle-user`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userId: user.id, activo: !user.activo }),
      }
    )
    const json = await res.json()
    if (!res.ok) { toast(json.error ?? 'Error', 'error'); return }
    toast(user.activo ? 'Usuario desactivado' : 'Usuario activado', 'info')
    await load()
  }

  return (
    <Layout title="Usuarios">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Gestión de Usuarios</h1>
            <p className="text-gray-500 text-sm">{users.length} usuarios registrados</p>
          </div>
          <Button size="sm" onClick={() => setAddModal(true)}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Nuevo usuario
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm divide-y divide-gray-50">
            {users.map((u) => (
              <div key={u.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-700 font-bold text-sm">
                      {u.nombre.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900 truncate">{u.nombre}</p>
                      {u.id === myProfile.id && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full">Tú</span>
                      )}
                      {!u.activo && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Inactivo</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                  <Badge value={u.rol} />
                  {u.id !== myProfile.id && (
                    <button
                      onClick={() => toggleUser(u)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors
                        ${u.activo
                          ? 'bg-red-50 text-red-700 hover:bg-red-100'
                          : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                    >
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal crear usuario */}
      <Modal open={addModal} onClose={() => { setAddModal(false); setErrors({}) }} title="Crear nuevo usuario">
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl px-4 py-3 flex gap-2 items-start">
            <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs text-blue-800">
              El usuario podrá cambiar su contraseña desde su perfil después de ingresar.
            </p>
          </div>

          <Input
            label="Nombre completo"
            placeholder="Nombre Apellido"
            value={form.nombre}
            onChange={set('nombre')}
            error={errors.nombre}
          />
          <Input
            label="Email"
            type="email"
            placeholder="usuario@email.com"
            value={form.email}
            onChange={set('email')}
            error={errors.email}
          />
          <Input
            label="Contraseña temporal"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
          />
          <Select
            label="Rol"
            value={form.rol}
            onChange={set('rol')}
            error={errors.rol}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r.charAt(0).toUpperCase() + r.slice(1)}
              </option>
            ))}
          </Select>

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setAddModal(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" loading={saving} onClick={createUser}>
              Crear usuario
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
