import { Link } from 'react-router-dom'
import Badge from '../ui/Badge'

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`

export default function ExpenseCard({ gasto, partida, usuario }) {
  return (
    <Link
      to={`/gasto/${gasto.id}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-primary-100 transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate group-hover:text-primary-700 transition-colors">
            {gasto.descripcion}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
            {partida && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                {partida.nombre}
              </span>
            )}
            {usuario && (
              <span className="text-xs text-gray-400">{usuario.nombre}</span>
            )}
            <span className="text-xs text-gray-400">
              {new Date(gasto.fecha_gasto).toLocaleDateString('es-CL')}
            </span>
          </div>
          {gasto.estado === 'rechazado' && gasto.comentario_rechazo && (
            <p className="text-xs text-red-600 mt-1.5 bg-red-50 rounded-lg px-2 py-1">
              Rechazado: {gasto.comentario_rechazo}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className="text-lg font-bold text-gray-900">{fmt(gasto.monto)}</span>
          <Badge value={gasto.estado} />
        </div>
      </div>
      {gasto.foto_url && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Foto adjunta
        </div>
      )}
    </Link>
  )
}
