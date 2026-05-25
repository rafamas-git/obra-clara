import { Fragment, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import ProgressBar from '../components/ui/ProgressBar'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
const getExportUtils = () => import('../lib/exportUtils')

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`

function StatCard({ label, value, sub, color = 'blue' }) {
  const colors = {
    blue:   'bg-blue-50 text-blue-700',
    green:  'bg-green-50 text-green-700',
    amber:  'bg-amber-50 text-amber-700',
    red:    'bg-red-50 text-red-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  )
}

function PartidaRow({ partida, gastado, items = [], gastos = [] }) {
  const [expanded, setExpanded] = useState(false)
  const presup = Number(partida.presupuesto_estimado)
  const pct = presup > 0 ? Math.min(Math.round((gastado / presup) * 100), 100) : 0
  const saldo = presup - gastado
  const colorClass =
    gastado >= presup ? 'text-red-600' :
    pct >= 80 ? 'text-amber-600' :
    'text-green-600'
  const hasDetail = items.length > 0 || gastos.length > 0

  return (
    <Fragment>
      <tr
        className={`border-b border-gray-50 transition-colors ${hasDetail ? 'cursor-pointer hover:bg-gray-50' : 'hover:bg-gray-50'}`}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <td className="py-3 px-3 text-sm text-gray-800 font-medium">
          <div className="flex items-center gap-1.5">
            {hasDetail ? (
              <svg className={`w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            ) : <span className="w-3.5 flex-shrink-0" />}
            <span>{partida.nombre}</span>
            {gastos.length > 0 && (
              <span className="text-xs text-green-600 font-normal bg-green-50 px-1.5 rounded-full">
                {gastos.length} gasto{gastos.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </td>
        <td className="py-3 px-3 text-sm text-gray-600 text-right hidden sm:table-cell">{fmt(presup)}</td>
        <td className="py-3 px-3 text-sm text-gray-900 font-medium text-right">{fmt(gastado)}</td>
        <td className="py-3 px-3 text-sm text-right hidden md:table-cell">
          <span className={colorClass}>{fmt(saldo)}</span>
        </td>
        <td className="py-3 px-3 w-40 hidden sm:table-cell">
          <ProgressBar value={gastado} max={presup} showLabel={false} size="sm" />
          <span className={`text-xs ${colorClass} font-medium`}>{pct}%</span>
        </td>
      </tr>

      {expanded && (
        <>
          {/* ── Cubicación estimada ── */}
          {items.length > 0 && (
            <>
              <tr className="bg-primary-50/40">
                <td colSpan={5} className="py-1 px-3 pl-8">
                  <span className="text-[10px] font-semibold text-primary-500 uppercase tracking-wider">Cubicación estimada</span>
                </td>
              </tr>
              {items.map((item) => (
                <tr key={item.id} className="bg-primary-50/20 border-b border-primary-50/50">
                  <td colSpan={5} className="py-1.5 px-3 pl-8">
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

          {/* ── Gastos aprobados ── */}
          <tr className="bg-green-50/60">
            <td colSpan={5} className="py-1 px-3 pl-8">
              <span className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Gastos aprobados</span>
            </td>
          </tr>
          {gastos.length === 0 ? (
            <tr className="bg-green-50/20 border-b border-green-50">
              <td colSpan={5} className="py-2 px-3 pl-8">
                <span className="text-xs text-gray-400 italic">Sin gastos aprobados en esta partida</span>
              </td>
            </tr>
          ) : (
            <>
              {gastos.map((g) => (
                <tr key={g.id} className="bg-green-50/20 border-b border-green-50/50 hover:bg-green-50/40 transition-colors">
                  <td colSpan={5} className="py-1.5 px-3 pl-8">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-400 w-16 flex-shrink-0 hidden sm:block">
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
                <td colSpan={5} className="py-2 px-3 pl-8">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-green-700">Total consumido ({gastos.length} gastos)</span>
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
}

export default function Dashboard() {
  const { profile, isRole, canAccess } = useAuth()
  const [partidas, setPartidas]     = useState([])
  const [gastos, setGastos]         = useState([])
  const [anticipos, setAnticipos]   = useState([])
  const [constructores, setConstructores] = useState([])
  const [items, setItems]           = useState([])
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: p }, { data: g }, { data: a }, { data: c }, { data: it }] = await Promise.all([
        supabase.from('partidas').select('*').eq('activo', true).order('orden'),
        supabase.from('gastos').select('*'),
        supabase.from('anticipos').select('*'),
        supabase.from('profiles').select('id').eq('rol', 'constructor'),
        supabase.from('items_partida').select('*').order('partida_id').order('orden'),
      ])
      setPartidas(p ?? [])
      setGastos(g ?? [])
      setAnticipos(a ?? [])
      setConstructores((c ?? []).map((u) => u.id))
      setItems(it ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Layout title="Dashboard"><LoadingSpinner /></Layout>

  if (!canAccess('dashboard')) return (
    <Layout title="Dashboard">
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <svg className="w-12 h-12 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-gray-500 font-medium">Sin acceso al Dashboard</p>
        <p className="text-gray-400 text-sm mt-1">El Director no ha habilitado esta sección para tu rol.</p>
      </div>
    </Layout>
  )

  const gastosAprobados = gastos.filter((g) => g.estado === 'aprobado')
  const gastosPendientes = gastos.filter((g) => g.estado === 'pendiente')

  const totalPresup = partidas.reduce((s, p) => s + Number(p.presupuesto_estimado), 0)
  const totalGastado = gastosAprobados.reduce((s, g) => s + Number(g.monto), 0)
  const totalAnticipado = anticipos.reduce((s, a) => s + Number(a.monto), 0)
  const totalRendido = gastosAprobados
    .filter((g) => constructores.includes(g.usuario_id))
    .reduce((s, g) => s + Number(g.monto), 0)
  const saldoCaja = totalAnticipado - totalRendido

  // Constructor ve solo su resumen
  if (isRole('constructor')) {
    const misGastos = gastos.filter((g) => g.usuario_id === profile.id)
    const misAprobados = misGastos.filter((g) => g.estado === 'aprobado')
    const misAnticipados = anticipos.filter((a) => a.constructor_id === profile.id)
    const miTotalAnticipado = misAnticipados.reduce((s, a) => s + Number(a.monto), 0)
    const miTotalRendido = misAprobados.reduce((s, g) => s + Number(g.monto), 0)
    const miSaldo = miTotalAnticipado - miTotalRendido

    return (
      <Layout title="Mi Panel">
        <div className="space-y-5">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Hola, {profile.nombre.split(' ')[0]}</h1>
            <p className="text-gray-500 text-sm mt-0.5">Tu resumen de caja</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Recibido" value={fmt(miTotalAnticipado)} color="blue" />
            <StatCard label="Rendido" value={fmt(miTotalRendido)} color="green" />
            <StatCard
              label="Saldo por rendir"
              value={fmt(Math.abs(miSaldo))}
              sub={miSaldo < 0 ? 'Déficit — gastaste más de lo recibido' : 'A tu favor'}
              color={miSaldo < 0 ? 'red' : 'amber'}
            />
            <StatCard label="Gastos pendientes" value={misGastos.filter((g) => g.estado === 'pendiente').length} color="purple" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <h2 className="font-semibold text-gray-800 mb-1">Mis últimos gastos</h2>
            {misGastos.slice(0, 5).length === 0 ? (
              <p className="text-gray-400 text-sm py-4 text-center">Sin gastos registrados</p>
            ) : (
              <div className="space-y-2 mt-3">
                {misGastos.slice(0, 5).map((g) => (
                  <Link key={g.id} to={`/gasto/${g.id}`} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 hover:text-primary-600 transition-colors">
                    <span className="text-sm text-gray-700 truncate flex-1">{g.descripcion}</span>
                    <span className="text-sm font-semibold ml-3">{fmt(g.monto)}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/nuevo-gasto"
            className="flex items-center justify-center gap-2 w-full py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-2xl transition-colors shadow-lg shadow-primary-100"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ingresar nuevo gasto
          </Link>
        </div>
      </Layout>
    )
  }

  // Observador
  if (isRole('observador')) {
    return (
      <Layout title="Dashboard">
        <DashboardContent
          partidas={partidas} items={items}
          gastosAprobados={gastosAprobados}
          totalPresup={totalPresup} totalGastado={totalGastado}
          totalAnticipado={totalAnticipado} totalRendido={totalRendido}
          saldoCaja={saldoCaja} gastosPendientes={[]} showExport={false}
        />
      </Layout>
    )
  }

  // Director y Colaborador
  return (
    <Layout title="Dashboard">
      <DashboardContent
        partidas={partidas} items={items}
        gastosAprobados={gastosAprobados}
        totalPresup={totalPresup} totalGastado={totalGastado}
        totalAnticipado={totalAnticipado} totalRendido={totalRendido}
        saldoCaja={saldoCaja} gastosPendientes={gastosPendientes}
        showExport={isRole('director')}
        onExportPDF={async () => { const { exportPDF } = await getExportUtils(); exportPDF({ partidas, gastos, anticipos, constructores }) }}
        onExportXLSX={async () => { const { exportExcel } = await getExportUtils(); exportExcel({ partidas, gastos, anticipos }) }}
      />
    </Layout>
  )
}

function DashboardContent({ partidas, items = [], gastosAprobados, totalPresup, totalGastado, totalAnticipado, totalRendido, saldoCaja, gastosPendientes, showExport, onExportPDF, onExportXLSX }) {
  return (
    <div className="space-y-6">
      {/* Avance global */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Avance general del proyecto</h2>
          {showExport && (
            <div className="flex gap-2">
              <button
                onClick={onExportPDF}
                className="text-xs bg-red-50 text-red-700 hover:bg-red-100 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                PDF
              </button>
              <button
                onClick={onExportXLSX}
                className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                Excel
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
          <span>Gastado: <strong className="text-gray-900">{fmt(totalGastado)}</strong></span>
          <span>Presupuesto: <strong className="text-gray-900">{fmt(totalPresup)}</strong></span>
        </div>
        <ProgressBar value={totalGastado} max={totalPresup} size="lg" />
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Presupuesto total" value={fmt(totalPresup)} color="blue" />
        <StatCard label="Gastado aprobado" value={fmt(totalGastado)} color="green" />
        <StatCard label="Saldo disponible" value={fmt(totalPresup - totalGastado)} color="amber" />
        {gastosPendientes.length > 0 && (
          <StatCard label="Pendientes aprob." value={gastosPendientes.length} color="purple" sub="Requieren revisión" />
        )}
      </div>

      {/* Tabla partidas */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Avance por Partida</h2>
        </div>
        {partidas.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-gray-400 text-sm">Sin partidas cargadas.</p>
            <Link to="/configuracion" className="text-primary-600 text-sm font-medium hover:underline mt-1 inline-block">
              Cargar partidas en Configuración →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Partida</th>
                  <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase text-right hidden sm:table-cell">Presupuesto</th>
                  <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase text-right">Gastado</th>
                  <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase text-right hidden md:table-cell">Saldo</th>
                  <th className="py-2 px-3 text-xs font-semibold text-gray-500 uppercase hidden sm:table-cell">Avance</th>
                </tr>
              </thead>
              <tbody>
                {partidas.map((p) => {
                  const myGastos = gastosAprobados.filter((g) => g.partida_id === p.id)
                  const gastado  = myGastos.reduce((s, g) => s + Number(g.monto), 0)
                  const myItems  = items.filter((it) => it.partida_id === p.id)
                  return (
                    <PartidaRow
                      key={p.id}
                      partida={p}
                      gastado={gastado}
                      items={myItems}
                      gastos={myGastos}
                    />
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Resumen caja */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-900 mb-4">Resumen de Caja</h2>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium">Total anticipado</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{fmt(totalAnticipado)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium">Rendido</p>
            <p className="text-xl font-bold text-green-700 mt-1">{fmt(totalRendido)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 font-medium">Por rendir</p>
            <p className={`text-xl font-bold mt-1 ${saldoCaja < 0 ? 'text-red-700' : 'text-amber-700'}`}>
              {fmt(Math.abs(saldoCaja))}
            </p>
            {saldoCaja < 0 && <p className="text-xs text-red-500">Déficit</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
