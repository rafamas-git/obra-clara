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

export default function CashControl() {
  const { profile, isRole } = useAuth()
  const toast = useToast()
  const isDirector = isRole('director')

  const [anticipos, setAnticipos]   = useState([])
  const [gastos, setGastos]         = useState([])
  const [constructores, setConstr]  = useState([])
  const [loading, setLoading]       = useState(true)
  const [addModal, setAddModal]     = useState(false)
  const [saving, setSaving]         = useState(false)
  const [filterConstr, setFC]       = useState('all')

  const [form, setForm] = useState({
    constructor_id: '',
    monto: '',
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
  })

  async function load() {
    const promises = [
      supabase.from('anticipos').select('*').order('fecha', { ascending: false }),
      supabase.from('gastos').select('monto, usuario_id, estado').eq('estado', 'aprobado'),
      supabase.from('profiles').select('*').eq('rol', 'constructor').eq('activo', true),
    ]
    const [{ data: a }, { data: g }, { data: c }] = await Promise.all(promises)
    setAnticipos(a ?? [])
    setGastos(g ?? [])
    setConstr(c ?? [])
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
    })
    setSaving(false)
    if (error) { toast(`Error: ${error.message}`, 'error'); return }
    toast('Anticipo registrado', 'success')
    setAddModal(false)
    setForm({ constructor_id: '', monto: '', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
    await load()
  }

  // Para constructor: solo sus datos
  const targetId = isDirector ? (filterConstr === 'all' ? null : filterConstr) : profile.id
  const filteredAnticipos = targetId ? anticipos.filter((a) => a.constructor_id === targetId) : anticipos
  const filteredGastos    = targetId ? gastos.filter((g) => g.usuario_id === targetId) : gastos

  const totalAnticipado = filteredAnticipos.reduce((s, a) => s + Number(a.monto), 0)
  const totalRendido    = filteredGastos.reduce((s, g) => s + Number(g.monto), 0)
  const saldo           = totalAnticipado - totalRendido

  return (
    <Layout title="Control de Caja">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Control de Caja</h1>
            <p className="text-gray-500 text-sm">
              {isDirector ? 'Gestión de anticipos al Constructor' : 'Tu estado de cuenta'}
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

        {/* Filtro por constructor (Director) */}
        {isDirector && constructores.length > 0 && (
          <div className="max-w-xs">
            <Select
              value={filterConstr}
              onChange={(e) => setFC(e.target.value)}
              label="Ver constructor"
            >
              <option value="all">Todos los constructores</option>
              {constructores.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </Select>
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : (
          <>
            {/* Cards resumen */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <CashCard label="Total anticipado" value={fmt(totalAnticipado)} color="blue" />
              <CashCard label="Rendido (aprobado)" value={fmt(totalRendido)} color="green" />
              <CashCard
                label={saldo < 0 ? 'Déficit' : 'Por rendir'}
                value={fmt(Math.abs(saldo))}
                sub={saldo < 0 ? 'Gastó más de lo recibido' : saldo === 0 ? 'Todo rendido' : 'A favor del constructor'}
                color={saldo < 0 ? 'red' : saldo === 0 ? 'green' : 'amber'}
              />
            </div>

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
                    const constr = constructores.find((c) => c.id === a.constructor_id)
                    return (
                      <div key={a.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors">
                        <div>
                          <p className="text-sm font-medium text-gray-800">
                            {a.descripcion || 'Anticipo de caja'}
                          </p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(a.fecha).toLocaleDateString('es-CL')}
                            {isDirector && constr && ` · ${constr.nombre}`}
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
            label="Constructor"
            value={form.constructor_id}
            onChange={(e) => setForm((f) => ({ ...f, constructor_id: e.target.value }))}
          >
            <option value="">— Selecciona —</option>
            {constructores.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>

          <Input
            label="Monto ($)"
            type="number"
            min="1"
            placeholder="0"
            value={form.monto}
            onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
          />

          <Input
            label="Descripción (opcional)"
            placeholder="Ej: Anticipo semana del 15 de mayo"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />

          <Input
            label="Fecha"
            type="date"
            value={form.fecha}
            onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
          />

          <div className="flex gap-3 pt-1">
            <Button variant="secondary" className="flex-1" onClick={() => setAddModal(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              loading={saving}
              disabled={!form.constructor_id || !form.monto}
              onClick={addAnticipo}
            >
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}
