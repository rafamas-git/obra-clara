import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import { Input, Textarea, Select } from '../components/ui/Input'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { supabase, getSignedUrl } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`

export default function ExpenseDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile, isRole } = useAuth()
  const { showToast } = useToast()

  const [gasto, setGasto]         = useState(null)
  const [partida, setPartida]     = useState(null)
  const [partidas, setPartidas]   = useState([])
  const [usuario, setUsuario]     = useState(null)
  const [aprobador, setAprobador] = useState(null)
  const [imgUrl, setImgUrl]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [notFound, setNotFound]   = useState(false)

  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [form, setForm]         = useState({ descripcion: '', monto: '', partida_id: '', fecha_gasto: '' })

  useEffect(() => {
    async function load() {
      const [{ data: g, error }, { data: ps }] = await Promise.all([
        supabase.from('gastos').select('*').eq('id', id).single(),
        supabase.from('partidas').select('id, nombre').eq('activo', true).order('nombre'),
      ])

      if (error || !g) { setNotFound(true); setLoading(false); return }
      setGasto(g)
      setPartidas(ps ?? [])

      const fetches = [
        g.partida_id ? supabase.from('partidas').select('*').eq('id', g.partida_id).single() : Promise.resolve({ data: null }),
        g.usuario_id ? supabase.from('profiles').select('*').eq('id', g.usuario_id).single() : Promise.resolve({ data: null }),
        g.aprobado_por ? supabase.from('profiles').select('*').eq('id', g.aprobado_por).single() : Promise.resolve({ data: null }),
      ]

      const [{ data: p }, { data: u }, { data: ap }] = await Promise.all(fetches)
      setPartida(p)
      setUsuario(u)
      setAprobador(ap)

      if (g.foto_path) {
        const url = await getSignedUrl(g.foto_path)
        setImgUrl(url)
      }
      setLoading(false)
    }
    load()
  }, [id])

  function startEdit() {
    setForm({
      descripcion: gasto.descripcion ?? '',
      monto: gasto.monto ?? '',
      partida_id: gasto.partida_id ?? '',
      fecha_gasto: gasto.fecha_gasto?.slice(0, 10) ?? '',
    })
    setEditing(true)
  }

  async function saveEdit() {
    if (!form.monto || !form.descripcion) return
    setSaving(true)
    const { error } = await supabase
      .from('gastos')
      .update({
        descripcion: form.descripcion.trim(),
        monto: Number(form.monto),
        partida_id: form.partida_id || null,
        fecha_gasto: form.fecha_gasto,
      })
      .eq('id', id)

    if (error) {
      showToast('Error al guardar cambios', 'error')
    } else {
      const updated = { ...gasto, descripcion: form.descripcion.trim(), monto: Number(form.monto), partida_id: form.partida_id || null, fecha_gasto: form.fecha_gasto }
      setGasto(updated)
      const p = partidas.find((x) => x.id === form.partida_id) ?? null
      setPartida(p)
      setEditing(false)
      showToast('Gasto actualizado', 'success')
    }
    setSaving(false)
  }

  async function confirmVoid() {
    setSaving(true)
    const { error } = await supabase
      .from('gastos')
      .update({ estado: 'anulado' })
      .eq('id', id)

    if (error) {
      showToast('Error al anular gasto', 'error')
    } else {
      setGasto({ ...gasto, estado: 'anulado' })
      setVoidOpen(false)
      showToast('Gasto anulado', 'success')
    }
    setSaving(false)
  }

  if (loading) return <Layout><LoadingSpinner /></Layout>

  if (notFound) return (
    <Layout>
      <div className="text-center py-20">
        <p className="text-gray-500 font-medium">Gasto no encontrado</p>
        <button onClick={() => navigate(-1)} className="text-primary-600 text-sm mt-2 hover:underline">
          Volver
        </button>
      </div>
    </Layout>
  )

  const canEdit = isRole('director') && gasto.estado !== 'anulado'

  return (
    <Layout title="Detalle de Gasto">
      <div className="max-w-lg mx-auto space-y-5">
        {/* Botón volver */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Volver
        </button>

        {/* Card principal */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          {/* Encabezado */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              {editing ? (
                <Input
                  label="Monto"
                  type="number"
                  min="0"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: e.target.value })}
                />
              ) : (
                <>
                  <p className="text-xl font-bold text-gray-900">{fmt(gasto.monto)}</p>
                  <p className="text-gray-600 mt-1 leading-snug">{gasto.descripcion}</p>
                </>
              )}
            </div>
            <Badge value={gasto.estado} className="mt-0.5" />
          </div>

          {/* Descripción en modo edición */}
          {editing && (
            <Textarea
              label="Descripción"
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            />
          )}

          {/* Info campos */}
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Partida"
                value={form.partida_id}
                onChange={(e) => setForm({ ...form, partida_id: e.target.value })}
              >
                <option value="">Sin partida</option>
                {partidas.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </Select>
              <Input
                label="Fecha"
                type="date"
                value={form.fecha_gasto}
                onChange={(e) => setForm({ ...form, fecha_gasto: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="Partida" value={partida?.nombre ?? '—'} />
              <InfoItem label="Fecha" value={new Date(gasto.fecha_gasto).toLocaleDateString('es-CL')} />
              <InfoItem label="Registrado por" value={usuario?.nombre ?? '—'} />
              <InfoItem label="Ingresado el" value={new Date(gasto.created_at).toLocaleDateString('es-CL')} />
              {gasto.unidad_medida && (
                <InfoItem label="Unidad" value={gasto.unidad_medida.toUpperCase()} />
              )}
              {gasto.cantidad != null && (
                <InfoItem label="Cantidad" value={Number(gasto.cantidad).toLocaleString('es-CL')} />
              )}
              {gasto.precio_unitario != null && (
                <InfoItem label="Precio unitario" value={fmt(gasto.precio_unitario)} />
              )}
            </div>
          )}

          {/* Estado de aprobación */}
          {gasto.estado === 'aprobado' && (
            <div className="bg-green-50 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-green-800">Gasto aprobado</p>
                {aprobador && (
                  <p className="text-xs text-green-700 mt-0.5">
                    Por {aprobador.nombre} el {new Date(gasto.aprobado_en).toLocaleDateString('es-CL')}
                  </p>
                )}
              </div>
            </div>
          )}

          {gasto.estado === 'rechazado' && gasto.comentario_rechazo && (
            <div className="bg-red-50 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-red-800">Motivo de rechazo</p>
                <p className="text-sm text-red-700 mt-0.5">{gasto.comentario_rechazo}</p>
              </div>
            </div>
          )}

          {gasto.estado === 'anulado' && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              <p className="text-sm text-gray-500">Este gasto fue anulado y no se contabiliza.</p>
            </div>
          )}

          {/* Foto */}
          {!editing && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Documento adjunto</p>
              {imgUrl ? (
                <a href={imgUrl} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={imgUrl}
                    alt="Documento adjunto"
                    className="w-full max-h-64 object-contain rounded-xl border border-gray-100 bg-gray-50 hover:opacity-90 transition-opacity cursor-zoom-in"
                  />
                  <p className="text-xs text-center text-gray-400 mt-1">Toca para ver en tamaño completo</p>
                </a>
              ) : (
                <div className="h-20 bg-gray-50 rounded-xl flex items-center justify-center border border-dashed border-gray-200">
                  <p className="text-xs text-gray-400">Sin foto adjunta</p>
                </div>
              )}
            </div>
          )}

          {/* Acciones de edición inline */}
          {editing && (
            <div className="flex gap-3 pt-1">
              <Button onClick={saveEdit} disabled={saving} className="flex-1">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
              <button
                onClick={() => setEditing(false)}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        {/* Acciones director */}
        {canEdit && !editing && (
          <div className="flex gap-3">
            <button
              onClick={startEdit}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Editar
            </button>
            <button
              onClick={() => setVoidOpen(true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl border border-red-200 bg-white text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
              Anular
            </button>
          </div>
        )}

        {/* Botón ir a aprobaciones */}
        {isRole('director') && gasto.estado === 'pendiente' && !editing && (
          <Link
            to="/aprobaciones"
            className="flex items-center justify-center gap-2 w-full py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors"
          >
            Ir a bandeja de aprobaciones
          </Link>
        )}
      </div>

      {/* Modal confirmación anulación */}
      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title="Anular gasto">
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            ¿Confirmas que deseas anular este gasto? Esta acción lo excluirá del cálculo de consumo pero mantendrá el registro.
          </p>
          <div className="bg-amber-50 rounded-xl px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">{fmt(gasto.monto)}</p>
            <p className="text-xs text-amber-700 mt-0.5">{gasto.descripcion}</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={confirmVoid}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {saving ? 'Anulando…' : 'Confirmar anulación'}
            </button>
            <button
              onClick={() => setVoidOpen(false)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}

function InfoItem({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2.5">
      <p className="text-xs text-gray-400 font-medium">{label}</p>
      <p className="text-sm text-gray-800 font-semibold mt-0.5">{value}</p>
    </div>
  )
}
