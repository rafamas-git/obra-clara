import { useState } from 'react'
import Layout from '../components/layout/Layout'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import Badge from '../components/ui/Badge'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'

export default function Profile() {
  const { profile, signOut, nombreObra, updateNombreObra, isRole } = useAuth()
  const toast = useToast()
  const isDirector = isRole('director')

  const [nombre, setNombre]         = useState(profile?.nombre ?? '')
  const [saving, setSaving]         = useState(false)
  const [obraName, setObraName]     = useState(nombreObra ?? '')
  const [savingObra, setSavingObra] = useState(false)

  const [passForm, setPassForm] = useState({ next: '', confirm: '' })
  const [passErr, setPassErr]   = useState('')
  const [changingPass, setCP]   = useState(false)

  async function saveName() {
    if (!nombre.trim()) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ nombre: nombre.trim() }).eq('id', profile.id)
    setSaving(false)
    if (error) { toast('Error al guardar', 'error'); return }
    toast('Nombre actualizado', 'success')
  }

  async function saveObraName() {
    if (!obraName.trim()) return
    setSavingObra(true)
    try {
      await updateNombreObra(obraName.trim())
      toast('Nombre de la obra actualizado', 'success')
    } catch {
      toast('Error al guardar', 'error')
    } finally {
      setSavingObra(false)
    }
  }

  async function changePassword() {
    setPassErr('')
    if (passForm.next.length < 6) { setPassErr('La contraseña debe tener al menos 6 caracteres'); return }
    if (passForm.next !== passForm.confirm) { setPassErr('Las contraseñas no coinciden'); return }
    setCP(true)
    const { error } = await supabase.auth.updateUser({ password: passForm.next })
    setCP(false)
    if (error) { setPassErr(error.message); return }
    toast('Contraseña cambiada exitosamente', 'success')
    setPassForm({ next: '', confirm: '' })
  }

  return (
    <Layout title="Mi Perfil">
      <div className="max-w-lg mx-auto space-y-5">
        <h1 className="text-xl font-bold text-gray-900">Mi Perfil</h1>

        {/* Info personal */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <span className="text-primary-700 font-bold text-2xl">
                {profile?.nombre?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{profile?.nombre}</p>
              <p className="text-sm text-gray-500">{profile?.email}</p>
              <Badge value={profile?.rol} className="mt-1" />
            </div>
          </div>

          <Input
            label="Nombre completo"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />

          <Button loading={saving} onClick={saveName} disabled={nombre.trim() === profile?.nombre}>
            Guardar nombre
          </Button>
        </div>

        {/* Nombre de la obra — solo Director */}
        {isDirector && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-gray-900">Nombre de la obra</h2>
              <p className="text-xs text-gray-400 mt-0.5">Se muestra en el menú lateral para todos los usuarios</p>
            </div>
            <Input
              label="Nombre de la obra"
              value={obraName}
              onChange={(e) => setObraName(e.target.value)}
              placeholder="Ej: Casa Los Fuentes"
            />
            <Button
              loading={savingObra}
              onClick={saveObraName}
              disabled={obraName.trim() === nombreObra || !obraName.trim()}
            >
              Guardar nombre de la obra
            </Button>
          </div>
        )}

        {/* Cambiar contraseña */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <h2 className="font-semibold text-gray-900">Cambiar contraseña</h2>

          <Input
            label="Nueva contraseña"
            type="password"
            value={passForm.next}
            onChange={(e) => setPassForm((f) => ({ ...f, next: e.target.value }))}
            placeholder="Mínimo 6 caracteres"
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={passForm.confirm}
            onChange={(e) => setPassForm((f) => ({ ...f, confirm: e.target.value }))}
            placeholder="Repite la nueva contraseña"
          />

          {passErr && (
            <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{passErr}</p>
          )}

          <Button
            variant="secondary"
            loading={changingPass}
            disabled={!passForm.next || !passForm.confirm}
            onClick={changePassword}
          >
            Cambiar contraseña
          </Button>
        </div>

        {/* Cerrar sesión */}
        <Button variant="danger" className="w-full" onClick={signOut}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Cerrar sesión
        </Button>
      </div>
    </Layout>
  )
}
