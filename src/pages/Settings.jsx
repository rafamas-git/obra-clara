import { useEffect, useRef, useState } from 'react'
import Layout from '../components/layout/Layout'
import Modal from '../components/ui/Modal'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`
const getExportUtils = () => import('../lib/exportUtils')

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

// ── Modal confirmación destructiva ───────────────────────────
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
          <Button variant="secondary" className="flex-1" onClick={() => { onClose(); setInput('') }}>Cancelar</Button>
          <Button variant="danger" className="flex-1" disabled={!match} loading={loading} onClick={onConfirm}>Confirmar</Button>
        </div>
      </div>
    </Modal>
  )
}

// ── Preview editable de partidas importadas ──────────────────
function PartidasPreview({ partidas, onChange }) {
  function update(i, field, value) {
    onChange(partidas.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
  }
  function remove(i) { onChange(partidas.filter((_, idx) => idx !== i)) }
  function addRow() { onChange([...partidas, { nombre: '', presupuesto_estimado: 0 }]) }
  const total = partidas.reduce((s, p) => s + Number(p.presupuesto_estimado || 0), 0)
  return (
    <div className="space-y-3">
      <div className="max-h-72 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
        {partidas.map((p, i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
            <span className="text-xs text-gray-300 w-5 flex-shrink-0">{i + 1}</span>
            <input
              className="flex-1 text-sm bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary-400 rounded px-1 py-0.5 min-w-0"
              value={p.nombre}
              onChange={(e) => update(i, 'nombre', e.target.value)}
              placeholder="Nombre de la partida"
            />
            <input
              type="number"
              className="w-28 text-sm text-right bg-transparent border-0 focus:outline-none focus:ring-1 focus:ring-primary-400 rounded px-1 py-0.5 flex-shrink-0"
              value={p.presupuesto_estimado}
              onChange={(e) => update(i, 'presupuesto_estimado', e.target.value)}
            />
            <button onClick={() => remove(i)} className="p-1 text-gray-300 hover:text-red-400 flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <button onClick={addRow} className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 px-3">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar partida
      </button>
      <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex justify-between items-center">
        <span className="text-sm text-gray-600">{partidas.length} partidas · Total:</span>
        <span className="text-sm font-bold text-gray-900">{fmt(total)}</span>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────
export default function Settings() {
  const { permisos, updatePermisos } = useAuth()
  const toast = useToast()

  // ── Partidas ─────────────────────────────────────────────
  const [partidas, setPartidas]   = useState([])
  const [loadingP, setLoadingP]   = useState(true)
  const [editModal, setEditModal] = useState(null)
  const [addModal, setAddModal]   = useState(false)
  const [newPartida, setNewPartida] = useState({ nombre: '', presupuesto_estimado: '' })
  const [saving, setSaving]       = useState(false)

  const importFileRef = useRef(null)
  const [importStep, setImportStep]     = useState(null)
  const [importedPartidas, setImported] = useState([])
  const [importResult, setImportResult] = useState(null)
  const [importMode, setImportMode]     = useState('reemplazar')
  const [importError, setImportError]   = useState('')
  const [importSaving, setImportSaving] = useState(false)

  // ── Permisos ──────────────────────────────────────────────
  const [savingPerm, setSavingPerm] = useState(false)

  // ── Reset ─────────────────────────────────────────────────
  const [resetType, setResetType] = useState(null)
  const [resetting, setResetting] = useState(false)

  async function loadPartidas() {
    const { data } = await supabase.from('partidas').select('*').eq('activo', true).order('orden')
    setPartidas(data ?? [])
    setLoadingP(false)
  }

  useEffect(() => { loadPartidas() }, [])

  // ── Import IA ────────────────────────────────────────────
  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (importFileRef.current) importFileRef.current.value = ''
    setImportError('')
    setImportResult(null)
    setImportStep('parsing')
    try {
      const { readExcelData } = await getExportUtils()
      const excelData = await readExcelData(file)
      if (!excelData.sheets?.length) throw new Error('El archivo está vacío o no tiene datos legibles')
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-partidas`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ sheets: excelData.sheets, rows: excelData.sheets[0]?.rows ?? [] }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al analizar el archivo')
      setImportResult(json)
      setImported(json.partidas)
      setImportStep('preview')
    } catch (err) {
      setImportError(err.message)
      setImportStep('error')
    }
  }

  async function confirmImport() {
    const validas = importedPartidas.filter((p) => p.nombre?.trim())
    if (!validas.length) { toast('No hay partidas válidas para guardar', 'error'); return }
    setImportSaving(true)
    try {
      if (importMode === 'reemplazar') {
        const { error: delErr } = await supabase.from('partidas').delete().not('id', 'is', null)
        if (delErr) throw delErr
      }
      const baseOrden = importMode === 'agregar' ? partidas.length : 0
      const { data: insertadas, error: insErr } = await supabase
        .from('partidas')
        .insert(validas.map((p, i) => ({ nombre: p.nombre.trim(), presupuesto_estimado: Number(p.presupuesto_estimado) || 0, orden: baseOrden + i })))
        .select('id')
      if (insErr) throw insErr
      const todosItems = (insertadas ?? []).flatMap((ins, i) =>
        (validas[i].items ?? []).map((item, j) => ({
          partida_id: ins.id, descripcion: item.descripcion, unidad: item.unidad || null,
          cantidad: item.cantidad != null ? Number(item.cantidad) : null,
          precio_unitario: item.precio_unitario != null ? Number(item.precio_unitario) : null,
          total: item.total != null ? Number(item.total) : null, orden: j,
        }))
      )
      if (todosItems.length) {
        const { error: itemsErr } = await supabase.from('items_partida').insert(todosItems)
        if (itemsErr) throw itemsErr
      }
      toast(`${validas.length} partidas ${importMode === 'agregar' ? 'agregadas' : 'importadas'} correctamente`, 'success')
      setImportStep(null)
      await loadPartidas()
    } catch (err) {
      toast(`Error al guardar: ${err.message}`, 'error')
    } finally {
      setImportSaving(false)
    }
  }

  async function saveEdit() {
    if (!editModal.nombre.trim()) return
    setSaving(true)
    const { error } = await supabase.from('partidas')
      .update({ nombre: editModal.nombre.trim(), presupuesto_estimado: Number(editModal.presupuesto_estimado) })
      .eq('id', editModal.id)
    setSaving(false)
    if (error) { toast('Error al guardar', 'error'); return }
    toast('Partida actualizada', 'success')
    setEditModal(null)
    await loadPartidas()
  }

  async function addPartida() {
    if (!newPartida.nombre.trim()) return
    setSaving(true)
    const { error } = await supabase.from('partidas').insert({
      nombre: newPartida.nombre.trim(),
      presupuesto_estimado: Number(newPartida.presupuesto_estimado) || 0,
      orden: partidas.length,
    })
    setSaving(false)
    if (error) { toast('Error al crear', 'error'); return }
    toast('Partida creada', 'success')
    setAddModal(false)
    setNewPartida({ nombre: '', presupuesto_estimado: '' })
    await loadPartidas()
  }

  async function deactivate(id) {
    if (!confirm('¿Archivar esta partida? No aparecerá más en el dashboard.')) return
    await supabase.from('partidas').update({ activo: false }).eq('id', id)
    toast('Partida archivada', 'info')
    await loadPartidas()
  }

  // ── Permisos ──────────────────────────────────────────────
  async function handleToggle(seccion, rol, value) {
    setSavingPerm(true)
    try { await updatePermisos(seccion, rol, value) }
    catch { toast('Error al guardar permiso', 'error') }
    finally { setSavingPerm(false) }
  }

  // ── Reset ─────────────────────────────────────────────────
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
      toast(resetType === 'consumos' ? 'Consumos reseteados.' : 'Proyecto reiniciado completamente.', 'success')
      setResetType(null)
      await loadPartidas()
    } catch (err) {
      toast(`Error: ${err.message}`, 'error')
    } finally {
      setResetting(false)
    }
  }

  const totalPresup = partidas.reduce((s, p) => s + Number(p.presupuesto_estimado), 0)
  const roles = ['constructor', 'colaborador', 'observador']
  const ROL_LABELS = { constructor: 'Constructor', colaborador: 'Colaborador', observador: 'Observador' }

  return (
    <Layout title="Configuración">
      <div className="max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Configuración</h1>

        {/* ── Partidas del presupuesto ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-gray-900">Partidas del presupuesto</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {loadingP ? '…' : `${partidas.length} partidas · Total: ${fmt(totalPresup)}`}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setImportStep('upload'); setImportError('') }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Importar IA
              </button>
              <button
                onClick={() => setAddModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-semibold transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva
              </button>
            </div>
          </div>

          {loadingP ? (
            <div className="p-8 text-center text-gray-400 text-sm">Cargando…</div>
          ) : partidas.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-400 text-sm">Sin partidas. Importa una cubicación con IA o agrega manualmente.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {partidas.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span className="text-xs text-gray-300 w-5 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.nombre}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(p.presupuesto_estimado)}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditModal({ ...p })}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deactivate(p.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Permisos de acceso ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <h2 className="font-semibold text-gray-900">Permisos de acceso</h2>
            <p className="text-xs text-gray-400 mt-0.5">El Director siempre tiene acceso completo.</p>
          </div>
          <div className="flex items-center gap-2 mb-1">
            <svg className="w-4 h-4 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <p className="text-sm font-semibold text-gray-700">Dashboard</p>
          </div>
          <div className="divide-y divide-gray-100 pl-1">
            {roles.map((rol) => (
              <div key={rol} className="flex items-center justify-between py-2.5">
                <p className="text-sm font-medium text-gray-800">{ROL_LABELS[rol]}</p>
                <Toggle
                  checked={permisos.dashboard?.[rol] ?? false}
                  onChange={(val) => handleToggle('dashboard', rol, val)}
                  disabled={savingPerm}
                />
              </div>
            ))}
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
              <p className="text-xs text-gray-500 mt-1 mb-3">Borra todos los gastos y anticipos. Las partidas se mantienen.</p>
              <button
                onClick={() => setResetType('consumos')}
                className="px-3 py-1.5 rounded-lg border border-amber-200 text-amber-700 text-xs font-semibold hover:bg-amber-50 transition-colors"
              >Resetear consumos</button>
            </div>
            <div className="bg-white rounded-xl border border-red-100 p-4">
              <p className="text-sm font-semibold text-gray-800">Reiniciar proyecto</p>
              <p className="text-xs text-gray-500 mt-1 mb-3">Borra todo: gastos, anticipos y partidas. Deja la app como nueva.</p>
              <button
                onClick={() => setResetType('proyecto')}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors"
              >Reiniciar todo</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modal importar con IA ── */}
      <Modal open={!!importStep} onClose={() => importStep !== 'parsing' && setImportStep(null)} title="Importar cubicación con IA" size="lg">
        {importStep === 'upload' && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-blue-800">Claude analizará tu Excel</p>
                <p className="text-xs text-blue-700 mt-0.5">Identifica automáticamente las partidas y presupuestos, y muestra una preview editable antes de guardar.</p>
              </div>
            </div>
            <div onClick={() => importFileRef.current?.click()} className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors">
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Seleccionar archivo Excel</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx o .xls · cualquier formato de cubicación</p>
              </div>
            </div>
            <input ref={importFileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImportFile} />
          </div>
        )}

        {importStep === 'parsing' && (
          <div className="py-10 flex flex-col items-center gap-4">
            <div className="relative">
              <svg className="animate-spin h-14 w-14 text-primary-200" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-lg">🤖</span>
            </div>
            <div className="text-center">
              <p className="font-semibold text-gray-800">Claude está analizando tu cubicación...</p>
              <p className="text-sm text-gray-500 mt-1">Esto puede tomar 10–20 segundos</p>
            </div>
          </div>
        )}

        {importStep === 'error' && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-800 mb-1">Error al analizar el archivo</p>
              <p className="text-sm text-red-700">{importError}</p>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => setImportStep('upload')}>Intentar de nuevo</Button>
          </div>
        )}

        {importStep === 'preview' && (
          <div className="space-y-4">
            {importResult && (
              <div className={`rounded-xl p-3.5 border ${
                importResult.confianza === 'alta'  ? 'bg-green-50 border-green-100' :
                importResult.confianza === 'media' ? 'bg-yellow-50 border-yellow-100' :
                                                     'bg-orange-50 border-orange-100'}`}>
                <div className="flex items-start gap-2.5">
                  <span className="text-lg leading-none mt-0.5 flex-shrink-0">🤖</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold text-gray-700">Claude interpretó</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        importResult.confianza === 'alta'  ? 'bg-green-100 text-green-700' :
                        importResult.confianza === 'media' ? 'bg-yellow-100 text-yellow-700' :
                                                             'bg-orange-100 text-orange-700'}`}>
                        confianza {importResult.confianza}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{importResult.interpretacion}</p>
                  </div>
                </div>
                {importResult.alternativas?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-black/10 space-y-1.5">
                    <p className="text-xs font-medium text-gray-600">¿No es lo que buscabas? Prueba otra interpretación:</p>
                    {importResult.alternativas.map((alt, i) => (
                      <button key={i} onClick={() => setImported(alt.partidas)}
                        className="w-full text-left text-xs bg-white/80 hover:bg-white rounded-lg px-3 py-2 border border-gray-200 transition-colors">
                        <span className="text-gray-700">{alt.descripcion}</span>
                        <span className="text-gray-400 ml-1">· {alt.partidas.length} partidas</span>
                      </button>
                    ))}
                    <button onClick={() => setImported(importResult.partidas)} className="text-xs text-primary-600 hover:text-primary-700 px-1">
                      ← Volver a la interpretación principal ({importResult.partidas.length} partidas)
                    </button>
                  </div>
                )}
              </div>
            )}

            {partidas.length > 0 && (
              <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
                <button onClick={() => setImportMode('reemplazar')}
                  className={`flex-1 py-2 font-medium transition-colors ${importMode === 'reemplazar' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  Reemplazar partidas
                </button>
                <button onClick={() => setImportMode('agregar')}
                  className={`flex-1 py-2 font-medium transition-colors border-l border-gray-200 ${importMode === 'agregar' ? 'bg-primary-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
                  Agregar a existentes
                </button>
              </div>
            )}
            {importMode === 'reemplazar' && partidas.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">⚠️ Las {partidas.length} partidas actuales serán reemplazadas.</p>
            )}

            <PartidasPreview partidas={importedPartidas} onChange={setImported} />

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setImportStep('upload')}>Subir otro archivo</Button>
              <Button className="flex-1" loading={importSaving}
                disabled={importedPartidas.filter((p) => p.nombre?.trim()).length === 0}
                onClick={confirmImport}>
                {importMode === 'agregar' ? 'Agregar' : 'Guardar'}{' '}
                {importedPartidas.filter((p) => p.nombre?.trim()).length} partidas
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal editar partida ── */}
      <Modal open={!!editModal} onClose={() => setEditModal(null)} title="Editar partida">
        {editModal && (
          <div className="space-y-4">
            <Input label="Nombre de la partida" value={editModal.nombre}
              onChange={(e) => setEditModal((p) => ({ ...p, nombre: e.target.value }))} />
            <Input label="Presupuesto estimado ($)" type="number" min="0"
              value={editModal.presupuesto_estimado}
              onChange={(e) => setEditModal((p) => ({ ...p, presupuesto_estimado: e.target.value }))} />
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setEditModal(null)}>Cancelar</Button>
              <Button className="flex-1" loading={saving} onClick={saveEdit}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal nueva partida ── */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Nueva partida">
        <div className="space-y-4">
          <Input label="Nombre" placeholder="Ej: Estructura de hormigón"
            value={newPartida.nombre}
            onChange={(e) => setNewPartida((p) => ({ ...p, nombre: e.target.value }))} />
          <Input label="Presupuesto estimado ($)" type="number" min="0" placeholder="0"
            value={newPartida.presupuesto_estimado}
            onChange={(e) => setNewPartida((p) => ({ ...p, presupuesto_estimado: e.target.value }))} />
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setAddModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={saving} disabled={!newPartida.nombre.trim()} onClick={addPartida}>Crear</Button>
          </div>
        </div>
      </Modal>

      <DangerModal open={resetType === 'consumos'} onClose={() => setResetType(null)}
        title="Resetear consumos"
        description="Se eliminarán TODOS los gastos y anticipos. Las partidas se mantienen. Esta acción no se puede deshacer."
        onConfirm={doReset} loading={resetting} />
      <DangerModal open={resetType === 'proyecto'} onClose={() => setResetType(null)}
        title="Reiniciar proyecto completo"
        description="Se eliminarán TODOS los gastos, anticipos Y partidas. La app quedará como nueva. Esta acción no se puede deshacer."
        onConfirm={doReset} loading={resetting} />
    </Layout>
  )
}
