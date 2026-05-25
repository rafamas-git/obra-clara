import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import ExpenseCard from '../components/expenses/ExpenseCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Select } from '../components/ui/Input'
import { supabase } from '../lib/supabase'

const ESTADOS = [
  { value: 'pendiente',  label: 'Pendiente',  base: 'bg-amber-50 text-amber-700 border-amber-200',  on: 'bg-amber-100 text-amber-800 border-amber-400 ring-1 ring-amber-300' },
  { value: 'aprobado',   label: 'Aprobado',   base: 'bg-green-50 text-green-700 border-green-200',   on: 'bg-green-100 text-green-800 border-green-400 ring-1 ring-green-300' },
  { value: 'rechazado',  label: 'Rechazado',  base: 'bg-red-50 text-red-700 border-red-200',         on: 'bg-red-100 text-red-800 border-red-400 ring-1 ring-red-300' },
  { value: 'anulado',    label: 'Anulado',    base: 'bg-gray-50 text-gray-500 border-gray-200',      on: 'bg-gray-100 text-gray-700 border-gray-400 ring-1 ring-gray-300' },
]

function CheckPill({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all select-none ${active ? color.on : color.base}`}
    >
      <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
        active ? 'bg-current border-current' : 'border-gray-300 bg-white'
      }`}>
        {active && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {label}
    </button>
  )
}

export default function AllExpenses() {
  const [gastos, setGastos]       = useState([])
  const [partidas, setPartidas]   = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterEstados, setFE]    = useState([])
  const [filterPartida, setFP]    = useState('all')
  const [filterUsuario, setFU]    = useState('all')

  useEffect(() => {
    async function load() {
      const [{ data: g }, { data: p }, { data: u }] = await Promise.all([
        supabase.from('gastos').select('*').order('created_at', { ascending: false }),
        supabase.from('partidas').select('*').eq('activo', true),
        supabase.from('profiles').select('id, nombre, rol'),
      ])
      setGastos(g ?? [])
      setPartidas(p ?? [])
      setUsuarios(u ?? [])
      setLoading(false)
    }
    load()
  }, [])

  function toggleEstado(value) {
    setFE((prev) => prev.includes(value) ? prev.filter((e) => e !== value) : [...prev, value])
  }

  let filtered = gastos
  if (filterEstados.length > 0) filtered = filtered.filter((g) => filterEstados.includes(g.estado))
  if (filterPartida !== 'all')  filtered = filtered.filter((g) => g.partida_id === filterPartida)
  if (filterUsuario !== 'all')  filtered = filtered.filter((g) => g.usuario_id === filterUsuario)

  const hasFilters = filterEstados.length > 0 || filterPartida !== 'all' || filterUsuario !== 'all'

  return (
    <Layout title="Todos los Gastos">
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Todos los Gastos</h1>
            <p className="text-gray-500 text-sm">{filtered.length} gastos</p>
          </div>
          {hasFilters && (
            <button
              onClick={() => { setFE([]); setFP('all'); setFU('all') }}
              className="text-xs text-primary-600 hover:text-primary-800 font-medium transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-4">
          {/* Estado: pills multi-select */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Estado</p>
            <div className="flex flex-wrap gap-2">
              {ESTADOS.map((e) => (
                <CheckPill
                  key={e.value}
                  label={e.label}
                  active={filterEstados.includes(e.value)}
                  color={e}
                  onClick={() => toggleEstado(e.value)}
                />
              ))}
            </div>
          </div>

          {/* Partida + Usuario */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-gray-50">
            <Select value={filterPartida} onChange={(e) => setFP(e.target.value)} label="Partida">
              <option value="all">Todas las partidas</option>
              {partidas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
            <Select value={filterUsuario} onChange={(e) => setFU(e.target.value)} label="Usuario">
              <option value="all">Todos los usuarios</option>
              {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Select>
          </div>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <p className="text-gray-400 font-medium">Sin gastos con esos filtros</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((g) => (
              <ExpenseCard
                key={g.id}
                gasto={g}
                partida={partidas.find((p) => p.id === g.partida_id)}
                usuario={usuarios.find((u) => u.id === g.usuario_id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
