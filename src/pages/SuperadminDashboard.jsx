import { useAuth } from '../context/AuthContext'

export default function SuperadminDashboard() {
  const { profile, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header superadmin */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">OC</span>
          </div>
          <div>
            <p className="font-bold text-gray-900 leading-none">ObraClara</p>
            <p className="text-xs text-primary-600 font-medium mt-0.5">Superadmin</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 hidden sm:block">{profile?.nombre}</span>
          <button
            onClick={signOut}
            className="text-sm text-red-600 hover:text-red-700 font-medium"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Panel de administración</h1>
        <p className="text-gray-500 mb-8">Gestión global de obras y administradores</p>

        {/* Placeholder — se completa en Fase 5 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {['Obras activas', 'Administradores', 'Usuarios totales'].map(label => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-5">
              <p className="text-sm text-gray-500">{label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">—</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <p className="font-medium">Dashboard completo en construcción</p>
          <p className="text-sm mt-1">Aquí verás el resumen de todas las obras y métricas globales</p>
        </div>
      </main>
    </div>
  )
}
