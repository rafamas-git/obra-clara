import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ROL_LABEL = {
  admin:       'Director',
  constructor: 'Constructor',
  colaborador: 'Colaborador',
  observador:  'Observador',
}

const ROL_COLOR = {
  admin:       'bg-primary-100 text-primary-700',
  constructor: 'bg-orange-100 text-orange-700',
  colaborador: 'bg-green-100 text-green-700',
  observador:  'bg-gray-100 text-gray-600',
}

export default function Header({ title }) {
  const { profile, nombreObra, rolEnObra, misObras } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="min-w-0 flex items-center gap-2">
        {/* Nombre de la obra — clickeable si tiene más de una */}
        {misObras.length > 1 ? (
          <button
            onClick={() => navigate('/seleccionar-obra')}
            className="font-bold text-gray-900 text-base truncate hover:text-primary-600 transition-colors flex items-center gap-1"
          >
            {nombreObra || 'Mi Obra'}
            <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        ) : (
          <span className="font-bold text-gray-900 text-base truncate block">
            {nombreObra || 'Mi Obra'}
          </span>
        )}

        {title && (
          <span className="text-xs text-gray-400 leading-none md:hidden">· {title}</span>
        )}
      </div>

      {profile && (
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-gray-700 leading-none hidden xs:block">
            {profile.nombre}
          </p>
          {rolEnObra && (
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${ROL_COLOR[rolEnObra] ?? 'bg-gray-100 text-gray-600'}`}>
              {ROL_LABEL[rolEnObra] ?? rolEnObra}
            </span>
          )}
        </div>
      )}
    </header>
  )
}
