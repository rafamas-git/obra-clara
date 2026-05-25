import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import ExpenseCard from '../components/expenses/ExpenseCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const FILTER_LABELS = { all: 'Todos', pendiente: 'Pendientes', aprobado: 'Aprobados', rechazado: 'Rechazados' }

export default function MyExpenses() {
  const { profile } = useAuth()
  const [gastos, setGastos]     = useState([])
  const [partidas, setPartidas] = useState([])
  const [filter, setFilter]     = useState('all')
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: g }, { data: p }] = await Promise.all([
        supabase
          .from('gastos')
          .select('*')
          .eq('usuario_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase.from('partidas').select('*'),
      ])
      setGastos(g ?? [])
      setPartidas(p ?? [])
      setLoading(false)
    }
    load()
  }, [profile.id])

  const filtered = filter === 'all' ? gastos : gastos.filter((g) => g.estado === filter)

  return (
    <Layout title="Mis Gastos">
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mis Gastos</h1>
          <p className="text-gray-500 text-sm">{gastos.length} gastos registrados</p>
        </div>

        {/* Filtros */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {Object.entries(FILTER_LABELS).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${filter === key ? 'bg-primary-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-primary-300'}`}
            >
              {label}
              {key !== 'all' && (
                <span className="ml-1.5 text-xs opacity-70">
                  ({gastos.filter((g) => g.estado === key).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <svg className="w-12 h-12 text-gray-200 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-400 font-medium">Sin gastos {filter !== 'all' ? `"${FILTER_LABELS[filter].toLowerCase()}"` : ''}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((g) => (
              <ExpenseCard
                key={g.id}
                gasto={g}
                partida={partidas.find((p) => p.id === g.partida_id)}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  )
}
