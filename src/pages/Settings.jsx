import { useState } from 'react'
import Layout from '../components/layout/Layout'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'

// ── Toggle switch ────────────────────────────────────────────
function Toggle({ checked, onChange, disabled = false }) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none
        ${checked ? 'bg-primary-600' : 'bg-gray-200'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
        ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  )
}

// ── Modal de confirmación destructiva ───────────────────────
function DangerModal({ open, onClose, title, description, confirmText = 'CONFIRMAR', onConfirm, loading }) {
  const [input, setInput] = useState('')
  const match = input === confirmText

  return (
    <Modal open={open} onClose={() => { onClose(); setInput('') }} title={title}>
      <div className="space-y-4">
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-sm text-red-800">{description}</p>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1.5">
            Escribe <strong>{confirmText}</strong> para confirmar
          </label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent text-sm font-mono"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={confirmText}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => { onClose(); setInput('') }}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" disabled={!match} loading={loading} onClick={onConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Fila de permiso ──────────────────────────────────────────
const ROL_LABELS = {
  constructor: 'Constructor',
  colaborador: 'Colaborador',
  observador:  'Observador',
}

function PermisoRow({ seccion, rol, permisos, onToggle, saving }) {
  const checked = permisos[seccion]?.[rol] ?? false
  return (
    <div className="flex items-center justify-between py-2.5">
      <div>
        <p className="text-sm font-medium text-gray-800">{ROL_LABELS[rol]}</p>
      </div>
      <Toggle
        checked={checked}
        onChange={(val) => onToggle(seccion, rol, val)}
        disabled={saving}
      />
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────
export default function Settings() {
  const { permisos, updatePermisos } = useAuth()
  const toast = useToast()

  const [savingPerm, setSavingPerm] = useState(false)
  const [resetType, setResetType]   = useState(null)
  const [resetting, setResetting]   = useState(false)

  async function handleToggle(seccion, rol, value) {
    setSavingPerm(true)
    try {
      await updatePermisos(seccion, rol, value)
    } catch {
      toast('Error al guardar permiso', 'error')
    } finally {
      setSavingPerm(false)
    }
  }

  async function doReset() {
    setResetting(true)
    try {
      const { error: e1 } = await supabase.from('gastos').delete().not('id', 'is', null)
      if (e1) throw e1
      const { error: e2 } = await supabase.from('anticipos').delete().not('id', 'is', null)
      if (e2) throw e2
      if (resetType === 'proyecto') {
        const { error: e3 } = await supabase.from('partidas').delete().not('id', 'is', null)
        if (e3) throw e3
      }
      toast(
        resetType === 'consumos'
          ? 'Consumos reseteados. Las partidas se mantienen.'
          : 'Proyecto reiniciado completamente.',
        'success'
      )
      setResetType(null)
    } catch (err) {
      toast(`Error: ${err.message}`, 'error')
    } finally {
      setResetting(false)
    }
  }

  const roles = ['constructor', 'colaborador', 'observador']

  return (
    <Layout title="Configuración">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>

        {/* ── Permisos de acceso ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <div>
            <h2 className="font-semibold text-gray-900">Permisos de acceso</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              El Director siempre tiene acceso completo. Define qué pueden ver los demás roles.
            </p>
          </div>

          {/* Dashboard */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <p className="text-sm font-semibold text-gray-700">Dashboard</p>
            </div>
            <div className="divide-y divide-gray-100 pl-1">
              {roles.map((rol) => (
                <PermisoRow
                  key={rol}
                  seccion="dashboard"
                  rol={rol}
                  permisos={permisos}
                  onToggle={handleToggle}
                  saving={savingPerm}
                />
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* Presupuesto */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm font-semibold text-gray-700">Panel de Presupuesto</p>
            </div>
            <div className="divide-y divide-gray-100 pl-1">
              {roles.map((rol) => (
                <PermisoRow
                  key={rol}
                  seccion="presupuesto"
                  rol={rol}
                  permisos={permisos}
                  onToggle={handleToggle}
                  saving={savingPerm}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Zona de reinicio ── */}
        <div className="border border-red-100 rounded-2xl p-5 bg-red-50/30 space-y-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h2 className="text-sm font-semibold text-red-700">Zona de reinicio</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl border border-amber-100 p-4">
              <p className="text-sm font-semibold text-gray-800">Resetear consumos</p>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Borra todos los gastos y anticipos. Las partidas del presupuesto se mantienen.
              </p>
              <button
                onClick={() => setResetType('consumos')}
                className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-50 transition-colors"
              >
                Resetear consumos
              </button>
            </div>

            <div className="bg-white rounded-xl border border-red-100 p-4">
              <p className="text-sm font-semibold text-gray-800">Reiniciar proyecto</p>
              <p className="text-xs text-gray-500 mt-1 mb-3">
                Borra todo: gastos, anticipos y partidas. Deja la app como nueva.
              </p>
              <button
                onClick={() => setResetType('proyecto')}
                className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
              >
                Reiniciar todo
              </button>
            </div>
          </div>
        </div>
      </div>

      <DangerModal
        open={resetType === 'consumos'}
        onClose={() => setResetType(null)}
        title="Resetear consumos"
        description="Se eliminarán TODOS los gastos y anticipos registrados. Las partidas del presupuesto se mantienen. Esta acción no se puede deshacer."
        onConfirm={doReset}
        loading={resetting}
      />
      <DangerModal
        open={resetType === 'proyecto'}
        onClose={() => setResetType(null)}
        title="Reiniciar proyecto completo"
        description="Se eliminarán TODOS los gastos, anticipos Y partidas. La app quedará como nueva. Esta acción no se puede deshacer."
        onConfirm={doReset}
        loading={resetting}
      />
    </Layout>
  )
}
