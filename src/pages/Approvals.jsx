import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { supabase, getSignedUrl } from '../lib/supabase'

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`
const fmtNum = (n) => Number(n ?? 0).toLocaleString('es-CL')

function InfoItem({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm text-gray-800 font-semibold mt-0.5">{value}</p>
    </div>
  )
}

function ApprovalCard({ gasto, partida, usuario, onReview }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 leading-snug truncate">{gasto.descripcion}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
            <span className="font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded-full">
              {partida?.nombre ?? '—'}
            </span>
            <span>{usuario?.nombre ?? '—'}</span>
            <span>{new Date(gasto.fecha_gasto).toLocaleDateString('es-CL')}</span>
            {gasto.unidad_medida && (
              <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full font-medium">
                {gasto.cantidad != null ? `${fmtNum(gasto.cantidad)} ${gasto.unidad_medida.toUpperCase()}` : gasto.unidad_medida.toUpperCase()}
              </span>
            )}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className="text-xl font-bold text-gray-900">{fmt(gasto.monto)}</p>
        </div>
      </div>

      <button
        onClick={() => onReview(gasto)}
        className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-primary-200 bg-primary-50 text-primary-700 text-sm font-semibold hover:bg-primary-100 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Revisar comprobante
      </button>
    </div>
  )
}

export default function Approvals() {
  const { profile, obraActual } = useAuth()
  const toast = useToast()

  const [gastos, setGastos]     = useState([])
  const [partidas, setPartidas] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [loading, setLoading]   = useState(true)

  const [reviewing, setReviewing]   = useState(null)
  const [imgUrl, setImgUrl]         = useState(null)
  const [imgLoading, setImgLoading] = useState(false)
  const [rejectStep, setRejectStep] = useState(false)
  const [motivo, setMotivo]         = useState('')
  const [saving, setSaving]         = useState(false)

  async function load() {
    const [{ data: g }, { data: p }, { data: u }] = await Promise.all([
      supabase.from('gastos').select('*').eq('obra_id', obraActual.id).eq('estado', 'pendiente').order('created_at'),
      supabase.from('partidas').select('*').eq('obra_id', obraActual.id),
      supabase.from('profiles').select('id, nombre'),
    ])
    setGastos(g ?? [])
    setPartidas(p ?? [])
    setUsuarios(u ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function openReview(gasto) {
    setReviewing(gasto)
    setRejectStep(false)
    setMotivo('')
    setImgUrl(null)
    if (gasto.foto_path) {
      setImgLoading(true)
      const url = await getSignedUrl(gasto.foto_path)
      setImgUrl(url)
      setImgLoading(false)
    }
  }

  function closeReview() {
    setReviewing(null)
    setImgUrl(null)
    setRejectStep(false)
    setMotivo('')
  }

  async function approve() {
    setSaving(true)
    const { error } = await supabase
      .from('gastos')
      .update({
        estado: 'aprobado',
        aprobado_por: profile.id,
        aprobado_en: new Date().toISOString(),
      })
      .eq('id', reviewing.id)
    setSaving(false)
    if (error) { toast('Error al aprobar', 'error'); return }
    toast('Gasto aprobado', 'success')
    setGastos((prev) => prev.filter((g) => g.id !== reviewing.id))
    closeReview()
  }

  async function reject() {
    if (!motivo.trim()) return
    setSaving(true)
    const { error } = await supabase
      .from('gastos')
      .update({ estado: 'rechazado', comentario_rechazo: motivo.trim() })
      .eq('id', reviewing.id)
    setSaving(false)
    if (error) { toast('Error al rechazar', 'error'); return }
    toast('Gasto rechazado', 'info')
    setGastos((prev) => prev.filter((g) => g.id !== reviewing.id))
    closeReview()
  }

  const reviewPartida  = reviewing ? partidas.find((p) => p.id === reviewing.partida_id) : null
  const reviewUsuario  = reviewing ? usuarios.find((u) => u.id === reviewing.usuario_id) : null
  const isGL           = reviewing?.unidad_medida?.toLowerCase() === 'gl'

  return (
    <Layout title="Aprobaciones">
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gastos pendientes</h1>
          <p className="text-gray-500 text-sm">{gastos.length} pendientes de revisión</p>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : gastos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <svg className="w-14 h-14 text-green-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 font-semibold text-lg">Todo al día</p>
            <p className="text-gray-400 text-sm mt-1">No hay gastos pendientes de aprobación</p>
          </div>
        ) : (
          <div className="space-y-4">
            {gastos.map((g) => (
              <ApprovalCard
                key={g.id}
                gasto={g}
                partida={partidas.find((p) => p.id === g.partida_id)}
                usuario={usuarios.find((u) => u.id === g.usuario_id)}
                onReview={openReview}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal de revisión */}
      <Modal open={!!reviewing} onClose={closeReview} title="Revisar gasto" size="md">
        {reviewing && (
          <div className="space-y-5">

            {/* Comprobante / Foto */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Comprobante</p>
              {imgLoading ? (
                <div className="h-40 bg-gray-50 rounded-xl flex items-center justify-center">
                  <LoadingSpinner />
                </div>
              ) : imgUrl ? (
                <a href={imgUrl} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={imgUrl}
                    alt="Comprobante"
                    className="w-full max-h-64 object-contain rounded-xl border border-gray-100 bg-gray-50 hover:opacity-90 transition-opacity cursor-zoom-in"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-center">Toca para ampliar</p>
                </a>
              ) : (
                <div className="h-16 bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-200">
                  <p className="text-xs text-gray-400">Sin comprobante adjunto</p>
                </div>
              )}
            </div>

            {/* Datos del gasto */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Detalle del gasto</p>
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-xl px-3 py-2.5">
                  <p className="text-xs text-gray-400 font-medium">Descripción</p>
                  <p className="text-sm text-gray-800 font-semibold mt-0.5">{reviewing.descripcion}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <InfoItem label="Total" value={fmt(reviewing.monto)} />
                  <InfoItem label="Fecha" value={new Date(reviewing.fecha_gasto).toLocaleDateString('es-CL')} />
                  <InfoItem label="Partida" value={reviewPartida?.nombre ?? '—'} />
                  <InfoItem label="Registrado por" value={reviewUsuario?.nombre ?? '—'} />

                  {reviewing.unidad_medida && (
                    <InfoItem label="Unidad" value={reviewing.unidad_medida.toUpperCase()} />
                  )}
                  {!isGL && reviewing.cantidad != null && (
                    <InfoItem label="Cantidad" value={fmtNum(reviewing.cantidad)} />
                  )}
                  {!isGL && reviewing.precio_unitario != null && (
                    <InfoItem label="Precio unitario" value={fmt(reviewing.precio_unitario)} />
                  )}
                </div>

                {/* Alerta de descuadre */}
                {!isGL && reviewing.cantidad != null && reviewing.precio_unitario != null && (
                  (() => {
                    const esperado = Math.round(Number(reviewing.cantidad) * Number(reviewing.precio_unitario))
                    const diff = Math.abs(esperado - Number(reviewing.monto))
                    if (diff <= 1) return null
                    return (
                      <div className="bg-amber-50 rounded-xl px-3 py-2.5 flex items-start gap-2">
                        <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                          <p className="text-xs font-semibold text-amber-800">Los valores no cuadran</p>
                          <p className="text-xs text-amber-700 mt-0.5">
                            {fmtNum(reviewing.cantidad)} × {fmt(reviewing.precio_unitario)} = {fmt(esperado)},
                            {' '}pero el total declarado es {fmt(reviewing.monto)}.
                          </p>
                        </div>
                      </div>
                    )
                  })()
                )}
              </div>
            </div>

            {/* Acciones */}
            {!rejectStep ? (
              <div className="flex gap-3 pt-1">
                <button
                  onClick={approve}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {saving ? 'Aprobando…' : 'Aprobar'}
                </button>
                <button
                  onClick={() => setRejectStep(true)}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 bg-white text-red-600 hover:bg-red-50 text-sm font-semibold transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Rechazar
                </button>
              </div>
            ) : (
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1.5">
                    Motivo del rechazo <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Explica el motivo para que el Constructor pueda corregirlo…"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent resize-none text-sm"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setRejectStep(false); setMotivo('') }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Volver
                  </button>
                  <button
                    onClick={reject}
                    disabled={saving || !motivo.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                  >
                    {saving ? 'Rechazando…' : 'Confirmar rechazo'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </Layout>
  )
}
