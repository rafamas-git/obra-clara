const VARIANTS = {
  pendiente:   'bg-amber-100 text-amber-800',
  aprobado:    'bg-green-100 text-green-800',
  rechazado:   'bg-red-100 text-red-800',
  anulado:     'bg-gray-100 text-gray-500 line-through',
  admin:       'bg-blue-100 text-blue-800',
  director:    'bg-blue-100 text-blue-800',
  constructor: 'bg-orange-100 text-orange-800',
  colaborador: 'bg-purple-100 text-purple-800',
  observador:  'bg-gray-100 text-gray-600',
  default:     'bg-gray-100 text-gray-700',
}

const LABELS = {
  pendiente:   'Pendiente',
  aprobado:    'Aprobado',
  rechazado:   'Rechazado',
  anulado:     'Anulado',
  admin:       'Administrador',
  director:    'Director',
  constructor: 'Constructor',
  colaborador: 'Colaborador',
  observador:  'Observador',
}

export default function Badge({ value, children, className = '' }) {
  const key = value?.toLowerCase() ?? 'default'
  const cls = VARIANTS[key] ?? VARIANTS.default
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cls} ${className}`}>
      {children ?? LABELS[key] ?? value}
    </span>
  )
}
