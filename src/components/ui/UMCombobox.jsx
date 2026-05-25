import { useState, useRef, useEffect } from 'react'

export default function UMCombobox({ value, onChange, options, onAdd, label, error }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value ?? '')
  const ref = useRef(null)

  useEffect(() => { setQuery(value ?? '') }, [value])

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(query.toLowerCase())
  )
  const exactMatch = options.some((o) => o.toLowerCase() === query.trim().toLowerCase())
  const showAdd = query.trim().length > 0 && !exactMatch

  function select(opt) {
    onChange(opt)
    setQuery(opt)
    setOpen(false)
  }

  async function handleAdd() {
    const val = query.trim()
    if (!val) return
    await onAdd(val)
    onChange(val)
    setOpen(false)
  }

  return (
    <div className="flex flex-col gap-1 relative" ref={ref}>
      {label && <label className="text-sm font-medium text-gray-700">{label}</label>}
      <input
        type="text"
        value={query}
        autoComplete="off"
        onChange={(e) => {
          setQuery(e.target.value)
          onChange(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Ej: m², kg, un…"
        className={`w-full px-3.5 py-2.5 rounded-xl border text-gray-900 placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-shadow
          ${error ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'}`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}

      {open && (filtered.length > 0 || showAdd) && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-52 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); select(opt) }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-700 transition-colors"
            >
              {opt}
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); handleAdd() }}
              className="w-full text-left px-4 py-2.5 text-sm text-primary-600 font-semibold hover:bg-primary-50 transition-colors border-t border-gray-100"
            >
              + Agregar "{query.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  )
}
