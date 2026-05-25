import { useAuth } from '../../context/AuthContext'
import Badge from '../ui/Badge'

export default function Header({ title }) {
  const { profile, nombreObra } = useAuth()

  return (
    <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="min-w-0">
        {/* Nombre del proyecto */}
        <span className="font-bold text-gray-900 text-base truncate block">
          {nombreObra || 'Mi Obra'}
        </span>
        {/* Sección activa — solo en móvil (en desktop la muestra el sidebar) */}
        {title && (
          <span className="text-xs text-gray-400 leading-none md:hidden">{title}</span>
        )}
      </div>
      {profile && (
        <div className="flex items-center gap-2">
          <div className="text-right hidden xs:block">
            <p className="text-xs font-medium text-gray-700 leading-none">{profile.nombre}</p>
          </div>
          <Badge value={profile.rol} />
        </div>
      )}
    </header>
  )
}
