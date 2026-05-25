import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROL_LABEL = {
  admin:       'Administrador',
  constructor: 'Constructor',
  colaborador: 'Colaborador',
  observador:  'Observador',
}

export default function ObraSelector() {
  const { misObras, seleccionarObra, profile } = useAuth()
  const navigate = useNavigate()

  function elegir(obraId) {
    seleccionarObra(obraId)
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold">OC</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">ObraClara</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 text-center mb-1">
          Selecciona una obra
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          Hola {profile?.nombre?.split(' ')[0]} — tienes acceso a {misObras.length} obras
        </p>

        <div className="space-y-3">
          {misObras.map(({ obra, rol }) => (
            <button
              key={obra.id}
              onClick={() => elegir(obra.id)}
              className="w-full text-left bg-white border border-gray-200 rounded-2xl p-4 hover:border-primary-400 hover:shadow-sm transition-all group"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 group-hover:text-primary-700 transition-colors">
                    {obra.nombre}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {ROL_LABEL[rol] ?? rol}
                  </p>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-primary-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
