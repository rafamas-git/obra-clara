import { Fragment, useEffect, useRef, useState } from 'react'
import Layout from '../components/layout/Layout'
import Button from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Modal from '../components/ui/Modal'
import ProgressBar from '../components/ui/ProgressBar'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`
const getExportUtils = () => import('../lib/exportUtils')

// ── Componente de preview editable de partidas ────────────
function PartidasPreview({ partidas, onChange }) {
  function update(i, field, value) {
    const next = partidas.map((p, idx) =>
      idx === i ? { ...p, [field]: value } : p
    )
    onChange(next)
  }
  function remove(i) {
    onChange(partidas.filter((_, idx) => idx !== i))
  }
  function addRow() {
    onChange([...partidas, { nombre: '', presupuesto_estimado: 0 }])
  }

  const total = partidas.reduce((s, p) => s + Number(p.presupuesto_estimado || 0), 0)

  return (
    <div className="space-y-3">
      <div className="max-h-80 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
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
            <button onClick={() => remove(i)} className="p-1 text-gray-300 hover:text-red-400 transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1 px-3"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Agregar partida
      </button>

      <div className="bg-gray-50 rounded-xl px-4 py-2.5 flex justify-between items-center">
        <span className="text-sm text-gray-600">{partidas.length} partidas · Total presupuesto:</span>
        <span className="text-sm font-bold text-gray-900">{fmt(total)}</span>
      </div>
    </div>
  )
}

// ── Modal de confirmación peligrosa ───────────────────────
// ── Página principal ──────────────────────────────────────
export default function Budget() {
  const { isRole, canAccess } = useAuth()
  const toast = useToast()
  const isDirector = isRole('director')

  const [partidas, setPartidas]   = useState([])
  const [gastos, setGastos]       = useState([])
  const [items, setItems]         = useState([])
  const [expandedIds, setExpandedIds] = useState(new Set())
  const [loading, setLoading]     = useState(true)

  // Modales existentes
  const [editModal, setEditModal] = useState(null)
  const [addModal, setAddModal]   = useState(false)
  const [newPartida, setNewPartida] = useState({ nombre: '', presupuesto_estimado: '' })
  const [saving, setSaving]       = useState(false)

  // Import con IA
  const importFileRef = useRef(null)
  const [importStep, setImportStep]     = useState(null)   // null | 'parsing' | 'preview'
  const [importedPartidas, setImported] = useState([])
  const [importResult, setImportResult] = useState(null)   // { interpretacion, confianza, partidas, alternativas }
  const [importMode, setImportMode]     = useState('reemplazar') // 'reemplazar' | 'agregar'
  const [importError, setImportError]   = useState('')
  const [importSaving, setImportSaving] = useState(false)



  async function load() {
    const [{ data: p }, { data: g }, { data: it }] = await Promise.all([
      supabase.from('partidas').select('*').eq('activo', true).order('orden'),
      supabase.from('gastos').select('id, monto, partida_id, descripcion, fecha_gasto, unidad_medida, cantidad, precio_unitario').eq('estado', 'aprobado').order('fecha_gasto'),
      supabase.from('items_partida').select('*').order('partida_id').order('orden'),
    ])
    setPartidas(p ?? [])
    setGastos(g ?? [])
    setItems(it ?? [])
    setLoading(false)
  }

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  useEffect(() => { load() }, [])

  // ── Importar con IA ──────────────────────────────────────
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

      if (!excelData.sheets?.length) {
        throw new Error('El archivo está vacío o no tiene datos legibles')
      }

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-partidas`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            sheets: excelData.sheets,
            rows: excelData.sheets[0]?.rows ?? [],  // compatibilidad con versión anterior
          }),
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
        const { error: delErr } = await supabase
          .from('partidas')
          .delete()
          .not('id', 'is', null)
        if (delErr) throw delErr
      }

      const baseOrden = importMode === 'agregar' ? partidas.length : 0
      const { data: insertadas, error: insErr } = await supabase
        .from('partidas')
        .insert(validas.map((p, i) => ({
          nombre: p.nombre.trim(),
          presupuesto_estimado: Number(p.presupuesto_estimado) || 0,
          orden: baseOrden + i,
        })))
        .select('id')
      if (insErr) throw insErr

      // Insertar ítems de cada partida
      const todosItems = (insertadas ?? []).flatMap((inserted, i) => {
        const source = validas[i]
        return (source.items ?? []).map((item, j) => ({
          partida_id: inserted.id,
          descripcion: item.descripcion,
          unidad: item.unidad || null,
          cantidad: item.cantidad != null ? Number(item.cantidad) : null,
          precio_unitario: item.precio_unitario != null ? Number(item.precio_unitario) : null,
          total: item.total != null ? Number(item.total) : null,
          orden: j,
        }))
      })
      if (todosItems.length) {
        const { error: itemsErr } = await supabase.from('items_partida').insert(todosItems)
        if (itemsErr) throw itemsErr
      }

      const accion = importMode === 'agregar' ? 'agregadas' : 'importadas'
      toast(`${validas.length} partidas ${accion} correctamente`, 'success')
      setImportStep(null)
      await load()
    } catch (err) {
      toast(`Error al guardar: ${err.message}`, 'error')
    } finally {
      setImportSaving(false)
    }
  }

  // ── Editar partida ───────────────────────────────────────
  async function saveEdit() {
    if (!editModal.nombre.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('partidas')
      .update({ nombre: editModal.nombre.trim(), presupuesto_estimado: Number(editModal.presupuesto_estimado) })
      .eq('id', editModal.id)
    setSaving(false)
    if (error) { toast('Error al guardar', 'error'); return }
    toast('Partida actualizada', 'success')
    setEditModal(null)
    await load()
  }

  // ── Agregar partida manual ────────────────────────────────
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
    await load()
  }

  // ── Archivar partida ──────────────────────────────────────
  async function deactivate(id) {
    if (!confirm('¿Archivar esta partida?')) return
    await supabase.from('partidas').update({ activo: false }).eq('id', id)
    toast('Partida archivada', 'info')
    await load()
  }

  // ── Reset ────────────────────────────────────────────────
  const totalPresup  = partidas.reduce((s, p) => s + Number(p.presupuesto_estimado), 0)
  const totalGastado = gastos.reduce((s, g) => s + Number(g.monto), 0)

  if (!canAccess('presupuesto')) return (
    <Layout title="Presupuesto">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg className="w-12 h-12 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-gray-500 font-medium">Sin acceso al Presupuesto</p>
        <p className="text-gray-400 text-sm mt-1">El Director no ha habilitado esta sección para tu rol.</p>
      </div>
    </Layout>
  )

  return (
    <Layout title="Presupuesto">
      <div className="space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Presupuesto</h1>
            <p className="text-gray-500 text-sm">{partidas.length} partidas activas</p>
          </div>
          {isDirector && (
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="primary"
                size="sm"
                onClick={() => { setImportStep('upload'); setImportError('') }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Importar con IA
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setAddModal(true)}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nueva partida
              </Button>
            </div>
          )}
        </div>

        {/* ── Avance global ── */}
        {partidas.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Gastado aprobado: <strong className="text-gray-900">{fmt(totalGastado)}</strong></span>
              <span>Presupuesto total: <strong className="text-gray-900">{fmt(totalPresup)}</strong></span>
            </div>
            <ProgressBar value={totalGastado} max={totalPresup} size="lg" />
          </div>
        )}

        {/* ── Tabla de partidas ── */}
        {loading ? (
          <LoadingSpinner />
        ) : partidas.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-400 font-medium">Sin partidas</p>
            {isDirector && (
              <p className="text-gray-400 text-sm mt-1">
                Usa <strong>Importar con IA</strong> para cargar tu cubicación
              </p>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 text-left">
                    <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase">Partida</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase text-right">Presupuesto</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase text-right hidden sm:table-cell">Gastado</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase text-right hidden md:table-cell">Saldo</th>
                    <th className="py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Avance</th>
                    {isDirector && <th className="py-2.5 px-4 w-20" />}
                  </tr>
                </thead>
                <tbody>
                  {partidas.map((p) => {
                    const gastado = gastos
                      .filter((g) => g.partida_id === p.id)
                      .reduce((s, g) => s + Number(g.monto), 0)
                    const presup    = Number(p.presupuesto_estimado)
                    const saldo     = presup - gastado
                    const myItems   = items.filter((it) => it.partida_id === p.id)
                    const myGastos  = gastos.filter((g) => g.partida_id === p.id)
                    const hasDetail = myItems.length > 0 || myGastos.length > 0
                    const isExpanded = expandedIds.has(p.id)
                    const colSpan   = isDirector ? 6 : 5
                    return (
                      <Fragment key={p.id}>
                        <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-gray-800 font-medium">
                            <div className="flex items-center gap-1.5">
                              {hasDetail ? (
                                <button
                                  onClick={() => toggleExpand(p.id)}
                                  className="p-0.5 text-gray-400 hover:text-primary-600 transition-colors flex-shrink-0"
                                >
                                  <svg className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                                  </svg>
                                </button>
                              ) : (
                                <span className="w-4 flex-shrink-0" />
                              )}
                              <span>{p.nombre}</span>
                              {myGastos.length > 0 && (
                                <span className="text-xs text-green-600 font-normal bg-green-50 px-1.5 rounded-full">{myGastos.length} gasto{myGastos.length !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-right text-gray-700">{fmt(presup)}</td>
                          <td className="py-3 px-4 text-sm text-right font-medium text-gray-900 hidden sm:table-cell">{fmt(gastado)}</td>
                          <td className={`py-3 px-4 text-sm text-right hidden md:table-cell ${saldo < 0 ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                            {fmt(saldo)}
                          </td>
                          <td className="py-3 px-4 w-32 hidden sm:table-cell">
                            <ProgressBar value={gastado} max={presup} showLabel={false} size="sm" />
                          </td>
                          {isDirector && (
                            <td className="py-3 px-4">
                              <div className="flex gap-1">
                                <button onClick={() => setEditModal({ ...p })} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                </button>
                                <button onClick={() => deactivate(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>

                        {isExpanded && (
                          <>
                            {/* ── Cubicación estimada ── */}
                            {myItems.length > 0 && (
                              <>
                                <tr className="bg-primary-50/40">
                                  <td colSpan={colSpan} className="py-1 px-4 pl-10">
                                    <span className="text-[10px] font-semibold text-primary-500 uppercase tracking-wider">Cubicación estimada</span>
                                  </td>
                                </tr>
                                {myItems.map((item) => (
                                  <tr key={item.id} className="bg-primary-50/20 border-b border-primary-50/50">
                                    <td colSpan={colSpan} className="py-1.5 px-4 pl-10">
                                      <div className="flex items-center gap-3 text-xs text-gray-600">
                                        <span className="flex-1">{item.descripcion}</span>
                                        {item.unidad && <span className="text-gray-400 w-10 text-center hidden sm:block">{item.unidad}</span>}
                                        {item.cantidad != null && <span className="text-gray-500 w-14 text-right hidden sm:block">{item.cantidad}</span>}
                                        {item.precio_unitario != null && <span className="text-gray-500 w-24 text-right hidden md:block">{fmt(item.precio_unitario)}</span>}
                                        {item.total != null && <span className="text-gray-700 font-semibold w-24 text-right">{fmt(item.total)}</span>}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </>
                            )}

                            {/* ── Gastos reales aprobados ── */}
                            <tr className="bg-green-50/60">
                              <td colSpan={colSpan} className="py-1 px-4 pl-10">
                                <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Gastos aprobados</span>
                              </td>
                            </tr>
                            {myGastos.length === 0 ? (
                              <tr className="bg-green-50/20 border-b border-green-50">
                                <td colSpan={colSpan} className="py-2 px-4 pl-10">
                                  <span className="text-xs text-gray-400 italic">Sin gastos aprobados en esta partida</span>
                                </td>
                              </tr>
                            ) : (
                              <>
                                {myGastos.map((g) => (
                                  <tr key={g.id} className="bg-green-50/20 border-b border-green-50/50 hover:bg-green-50/40 transition-colors">
                                    <td colSpan={colSpan} className="py-1.5 px-4 pl-10">
                                      <div className="flex items-center gap-3 text-xs">
                                        <span className="text-gray-400 w-20 flex-shrink-0 hidden sm:block">
                                          {new Date(g.fecha_gasto).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
                                        </span>
                                        <span className="flex-1 text-gray-700">{g.descripcion}</span>
                                        {g.unidad_medida && g.unidad_medida.toLowerCase() !== 'gl' && g.cantidad != null && (
                                          <span className="text-gray-400 hidden md:block w-24 text-right">
                                            {Number(g.cantidad).toLocaleString('es-CL')} {g.unidad_medida.toUpperCase()}
                                          </span>
                                        )}
                                        {g.unidad_medida?.toLowerCase() === 'gl' && (
                                          <span className="text-gray-400 hidden md:block w-24 text-right">GL</span>
                                        )}
                                        <span className="font-semibold text-green-700 w-24 text-right flex-shrink-0">{fmt(g.monto)}</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                                <tr className="bg-green-100/40 border-b border-green-100">
                                  <td colSpan={colSpan} className="py-2 px-4 pl-10">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs font-semibold text-green-700">Total consumido ({myGastos.length} gastos)</span>
                                      <span className="text-sm font-bold text-green-700">{fmt(gastado)}</span>
                                    </div>
                                  </td>
                                </tr>
                              </>
                            )}
                          </>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* ── Modal importar con IA ── */}
      <Modal
        open={!!importStep}
        onClose={() => importStep !== 'parsing' && setImportStep(null)}
        title="Importar cubicación con IA"
        size="lg"
      >
        {importStep === 'upload' && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-xl p-4 flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-blue-800">Claude analizará tu Excel</p>
                <p className="text-xs text-blue-700 mt-0.5">
                  No importa cómo estén nombradas las columnas. Claude identifica automáticamente
                  las partidas y presupuestos, y te muestra una preview editable antes de guardar.
                </p>
              </div>
            </div>

            <div
              onClick={() => importFileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
            >
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Seleccionar archivo Excel</p>
                <p className="text-xs text-gray-400 mt-1">.xlsx o .xls · cualquier formato de cubicación</p>
              </div>
            </div>

            <input
              ref={importFileRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportFile}
            />

            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              ⚠️ Al confirmar, las partidas actuales serán reemplazadas por las del nuevo archivo.
            </p>
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
            <Button variant="secondary" className="w-full" onClick={() => setImportStep('upload')}>
              Intentar de nuevo
            </Button>
          </div>
        )}

        {importStep === 'preview' && (
          <div className="space-y-4">
            {/* Interpretación de Claude */}
            {importResult && (
              <div className={`rounded-xl p-3.5 border ${
                importResult.confianza === 'alta'  ? 'bg-green-50 border-green-100' :
                importResult.confianza === 'media' ? 'bg-yellow-50 border-yellow-100' :
                                                     'bg-orange-50 border-orange-100'
              }`}>
                <div className="flex items-start gap-2.5">
                  <span className="text-lg leading-none mt-0.5 flex-shrink-0">🤖</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-semibold text-gray-700">Claude interpretó</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        importResult.confianza === 'alta'  ? 'bg-green-100 text-green-700' :
                        importResult.confianza === 'media' ? 'bg-yellow-100 text-yellow-700' :
                                                             'bg-orange-100 text-orange-700'
                      }`}>
                        confianza {importResult.confianza}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 leading-relaxed">{importResult.interpretacion}</p>
                  </div>
                </div>

                {/* Alternativas de interpretación */}
                {importResult.alternativas?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-black/10 space-y-1.5">
                    <p className="text-xs font-medium text-gray-600">¿No es lo que buscabas? Prueba otra interpretación:</p>
                    {importResult.alternativas.map((alt, i) => (
                      <button
                        key={i}
                        onClick={() => setImported(alt.partidas)}
                        className="w-full text-left text-xs bg-white/80 hover:bg-white rounded-lg px-3 py-2 border border-gray-200 transition-colors"
                      >
                        <span className="text-gray-700">{alt.descripcion}</span>
                        <span className="text-gray-400 ml-1">· {alt.partidas.length} partidas</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setImported(importResult.partidas)}
                      className="text-xs text-primary-600 hover:text-primary-700 px-1"
                    >
                      ← Volver a la interpretación principal ({importResult.partidas.length} partidas)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Modo: reemplazar vs agregar */}
            {partidas.length > 0 && (
              <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm">
                <button
                  onClick={() => setImportMode('reemplazar')}
                  className={`flex-1 py-2 font-medium transition-colors ${
                    importMode === 'reemplazar'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Reemplazar partidas
                </button>
                <button
                  onClick={() => setImportMode('agregar')}
                  className={`flex-1 py-2 font-medium transition-colors border-l border-gray-200 ${
                    importMode === 'agregar'
                      ? 'bg-primary-600 text-white'
                      : 'bg-white text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  Agregar a existentes
                </button>
              </div>
            )}
            {importMode === 'reemplazar' && partidas.length > 0 && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
                ⚠️ Las {partidas.length} partidas actuales serán reemplazadas por las del nuevo archivo.
              </p>
            )}
            {importMode === 'agregar' && (
              <p className="text-xs text-blue-700 bg-blue-50 rounded-xl px-3 py-2">
                Las partidas del archivo se agregarán a las {partidas.length} existentes.
              </p>
            )}

            <PartidasPreview
              partidas={importedPartidas}
              onChange={setImported}
            />

            <div className="flex gap-3 pt-1">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setImportStep('upload')}
              >
                Subir otro archivo
              </Button>
              <Button
                className="flex-1"
                loading={importSaving}
                disabled={importedPartidas.filter((p) => p.nombre?.trim()).length === 0}
                onClick={confirmImport}
              >
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
            <Input label="Presupuesto estimado con IVA ($)" type="number" min="0"
              value={editModal.presupuesto_estimado}
              onChange={(e) => setEditModal((p) => ({ ...p, presupuesto_estimado: e.target.value }))} />
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1" onClick={() => setEditModal(null)}>Cancelar</Button>
              <Button className="flex-1" loading={saving} onClick={saveEdit}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Modal nueva partida manual ── */}
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

      {/* ── Modales de reset ── */}
    </Layout>
  )
}
