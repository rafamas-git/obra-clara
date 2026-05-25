export default function ProgressBar({ value, max, showLabel = true, size = 'md' }) {
  const pct = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0
  const over = max > 0 && value > max

  const color = over || pct >= 100
    ? 'bg-red-500'
    : pct >= 80
    ? 'bg-amber-400'
    : 'bg-green-500'

  const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-4' }

  return (
    <div className="w-full">
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${heights[size]}`}>
        <div
          className={`${color} ${heights[size]} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && (
        <p className={`text-xs mt-1 font-medium ${over ? 'text-red-600' : pct >= 80 ? 'text-amber-600' : 'text-gray-500'}`}>
          {pct}%{over ? ' — EXCEDIDO' : ''}
        </p>
      )}
    </div>
  )
}
