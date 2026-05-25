import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import Button from '../components/ui/Button'
import { Input, Select } from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/ui/Toast'
import { supabase } from '../lib/supabase'

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`

function CashCard({ label, value, sub, color }) {
  const colors = {
    blue:  'bg-blue-50 border-blue-100 text-blue-800',
    green: 'bg-green-50 border-green-100 text-green-800',
    amber: 'bg-amber-50 border-amber-100 text-amber-800',
    red:   'bg-red-50 border-red-100 text-red-800',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}

const ROL_LABEL = { constructor: 'Constructor', colaborador: 'Colaborador' }

export default function CashControl() {
  const { profile, obraActual, rolEnObra } = useAuth()
  const toast = useToast()
  const isDirector = rolEnObra === 'admin'

  const [anticipos, setAnticipos]   = useState([])
  const [gastos, setGastos]         = useState([])
  const [receptores, setReceptores] = useState([])
  const [loading, setLoading]       = useState(true)
  const [addModal, setAddModal]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [filterReceptor, setFR]     = useState('all')

  const [form, setForm] = useState({
    constructor_id: '',
    monto: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
  })

  async function load() {
    const [{ data: a }, { data: g }, { data: r }] = await Promise.all([
      supabase.from('anticipos').select('*').eq('obra_id', obraActual.id).order('fecha', { ascending: false }),
      supabase.from('gastos').select('monto, usuario_id, estado').eq('obra_id', obraActual.id).eq('estado', 'aprobado'),
      supabase.from('obra_usuarios').select('rol, profiles:usuario_id(id, nombre, email)').eq('obra_id', obraActual.id).in('rol', ['constructor', 'colaborador']).eq('activo', true),
    ])
    setAnticipos(a ?? [])
    setGastos(g ?? [])
    setReceptores((r ?? []).map((ou) => ({ ...ou.profiles, rol: ou.rol })).filter((r) => r.id))
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function addAnticipo() {
    if (!form.constructor_id || !form.monto) return
    setSaving(true)
    const { error } = await supabase.from('anticipos').insert({
      constructor_id: form.constructor_id,
      director_id: profile.id,
      monto: Number(form.monto),
      descripcion: form.descripcion.trim() || null,
      fecha: form.fecha,
      obra_id: obraActual.id,
    })
    setSaving(false)
    if (error) { toast(`Error: ${error.message}`, 'error'); return }
    toast('Anticipo registrado', 'success')
    setAddModal(false)
    setForm({ constructor_id: '', monto: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
    await load()
  }

  const receptorIds = receptores.map((r) => r.id)

  // Rendido = solo gastos registrados por constructores/colaboradores (no director)
  const gastosReceptor = gastos.filter((g) => receptorIds.includes(g.usuario_id))

  const targetId = isDirector ? (filterReceptor === 'all' ? null : filterReceptor) : profile.id
  const filteredAnticipos = targetId
    ? anticipos.filter((a) => a.constructor_id === targetId)
    : anticipos

  const filteredGastos = targetId
    ? gastosReceptor.filter((g) => g.usuario_id === targetId)
    : gastosReceptor

  const totalAnticipado = filteredAnticipos.reduce((s, a) => s + Number(a.monto), 0)
  const totalRendido    = filteredGastos.reduce((s, g) => s + Number(g.monto), 0)
  const saldo           = totalAnticipado - totalRendido

  // Saldo por receptor (solo en vista "Todos")
  const saldosPorReceptor = receptores.map((r) => {
    const anticipado = anticipos
      .filter((a) => a.constructor_id === r.id)
      .reduce((s, a) => s + Number(a.monto), 0)
    const rendido = gastosReceptor
      .filter((g) => g.usuario_id === r.id)
      .reduce((s, g) => s + Number(g.monto), 0)
    return { ...r, anticipado, rendido, saldo: anticipado - rendido }
  }).filter((r) => r.anticipado > 0 || r.rendido > 0)

  const showSaldos = isDirector && filterReceptor === 'all' && saldosPorReceptor.length > 0

  return (
    <Layout title="Control de Caja">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Control de Caja</h1>
            <p className="text-gray-500 text-sm">
              {isDirector ? 'Gestión de anticipos a constructores y colaboradores' : 'Tu estado de cuenta'}
            </p>
          </div>
          {isDirector && (
            <Button size="sm" onClick={() => setAddModal(true)}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nuevo anticipo
            </Button>
          )}
        </div>

        {/* Filtro receptor */}
        {isDirector && receptores.length > 0 && (
          <div className="max-w-xs">
            <Select value={filterReceptor} onChange={(e) => setFR(e.target.value)} label="Ver usuario">
              <option value="all">Todos</option>
              {receptores.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre} {ROL_LABEL[r.rol] ? `(${ROL_LABEL[r.rol]})` : ''}
                </option>
              ))}
            </Select>
          </div>
        )}

        {loading ? <LoadingSpinner /> : (
          <>
            {/* Cards resumen */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <CashCard label="Total anticipado" value={fmt(totalAnticipado)} color="blue" />
              <CashCard
                label="Rendido (aprobado)"
                value={fmt(totalRendido)}
                sub="Solo gastos del receptor"
                color="green"
              />
              <CashCard
                label={saldo < 0 ? 'Director debe' : saldo === 0 ? 'Cuadrado' : 'Por rendir'}
                value={fmt(Math.abs(saldo))}
                sub={
                  saldo < 0 ? 'El receptor gastó más de lo recibido' :
                  saldo === 0 ? 'Caja cuadrada' :
                  'El receptor tiene efectivo en mano'
                }
                color={saldo < 0 ? 'red' : saldo === 0 ? 'green' : 'amber'}
              />
            </div>

            {/* Saldos por receptor */}
            {showSaldos && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50">
                  <h2 className="font-semibold text-gray-900">Saldo por usuario</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Estado de cuenta individual para cuadrar la caja</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {saldosPorReceptor.map((r) => {
                    const debe = r.saldo < 0
                    const ok   = r.saldo === 0
                    return (
                      <div key={r.id} className="px-5 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-900">{r.nombre}</p>
                              {r.rol && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase tracking-wide">
                                  {ROL_LABEL[r.rol] ?? r.rol}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                              <span>
                                Anticipado: <span className="font-semibold text-blue-700">{fmt(r.anticipado)}</span>
                              </span>
                              <span>
                                Rendido: <span className="font-semibold text-gray-700">{fmt(r.rendido)}</span>
                              </span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-lg font-bold ${debe ? 'text-red-600' : ok ? 'text-green-600' : 'text-amber-600'}`}>
                              {debe ? '-' : ''}{fmt(Math.abs(r.saldo))}
                            </p>
                            <p className={`text-xs mt-0.5 font-medium ${debe ? 'text-red-500' : ok ? 'text-green-500' : 'text-amber-500'}`}>
                              {debe ? 'Director debe reembolsar' : ok ? 'Cuadrado' : 'Por rendir'}
                            </p>
                          </div>
                        </div>
                        {/* Barra visual */}
                        <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${debe ? 'bg-red-400' : 'bg-amber-400'}`}
                            style={{ width: `${Math.min(r.anticipado > 0 ? (r.rendido / r.anticipado) * 100 : 100, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>0</span>
                          <span className="text-xs">
                            {r.anticipado > 0 ? Math.round((r.rendido / r.anticipado) * 100) : 100}% rendido
                          </span>
                          <span>{fmt(r.anticipado)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Total cuadre */}
                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Balance total de caja</span>
                  <span className={`text-base font-bold ${saldo < 0 ? 'text-red-600' : saldo === 0 ? 'text-green-600' : 'text-amber-600'}`}>
                    {saldo < 0 ? `Director debe ${fmt(Math.abs(saldo))}` : saldo === 0 ? 'Caja cuadrada' : `Por rendir ${fmt(saldo)}`}
                  </span>
                </div>
              </div>
            )}

            {/* Historial de anticipos */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Historial de anticipos</h2>
                <span className="text-xs text-gray-400">{filteredAnticipos.length} registros</span>
              </div>
              {filteredAnticipos.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-gray-400 text-sm">Sin anticipos registrados</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {filteredAnticipos.map((a) => {
                    const receptor = receptores.find((r) => r.id === a.constructor_id)
                    return (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {a.descripcion || 'Anticipo de caja'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(a.fecha).toLocaleDateString('es-CL')}
                            {isDirector && receptor && ` · ${receptor.nombre}`}
                          </p>
                        </div>
                        <span className="text-sm font-bold text-blue-700">{fmt(a.monto)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal nuevo anticipo */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Registrar anticipo">
        <div className="space-y-4">
          <Select
            label="Usuario receptor"
            value={form.constructor_id}
            onChange={(e) => setForm((f) => ({ ...f, constructor_id: e.target.value }))}
          >
            <option value="">— Selecciona —</option>
            {receptores.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre} ({ROL_LABEL[r.rol] ?? r.rol})
              </option>
            ))}
          </Select>
          <Input label="Monto ($)" type="number" min="1" placeholder="0"
            value={form.monto}
            onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
          />
          <Input label="Descripción (opcional)" placeholder="Ej: Anticipo semana del 15 de mayo"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
          <Input label="Fecha" type="date"
            value={form.fecha}
            onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
          />
          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setAddModal(false)}>Cancelar</Button>
            <Button className="flex-1" loading={saving} disabled={!form.constructor_id || !form.monto} onClick={addAnticipo}>
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
