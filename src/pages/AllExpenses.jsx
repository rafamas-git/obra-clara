import { useEffect, useState } from 'react'
import Layout from '../components/layout/Layout'
import ExpenseCard from '../components/expenses/ExpenseCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { Select } from '../components/ui/Input'
import { supabase } from '../lib/supabase'

export default function AllExpenses() {
  const [gastos, setGastos]       = useState([])
  const [partidas, setPartidas]   = useState([])
  const [usuarios, setUsuarios]   = useState([])
  const [loading, setLoading]     = useState(true)
  const [filterEstado, setFE]     = useState('all')
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

  let filtered = gastos
  if (filterEstado !== 'all')  filtered = filtered.filter((g) => g.estado === filterEstado)
  if (filterPartida !== 'all') filtered = filtered.filter((g) => g.partida_id === filterPartida)
  if (filterUsuario !== 'all') filtered = filtered.filter((g) => g.usuario_id === filterUsuario)

  return (
    <Layout title="Todos los Gastos">
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Todos los Gastos</h1>
          <p className="text-gray-500 text-sm">{filtered.length} gastos</p>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white rounded-2xl border border-gray-100 p-4">
          <Select value={filterEstado} onChange={(e) => setFE(e.target.value)} label="Estado">
            <option value="all">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </Select>
          <Select value={filterPartida} onChange={(e) => setFP(e.target.value)} label="Partida">
            <option value="all">Todas las partidas</option>
            {partidas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </Select>
          <Select value={filterUsuario} onChange={(e) => setFU(e.target.value)} label="Usuario">
            <option value="all">Todos los usuarios</option>
            {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
          </Select>
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
