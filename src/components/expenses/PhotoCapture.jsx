import { useRef, useState } from 'react'
import { compressImage, fileToDataURL } from '../../lib/imageUtils'

export default function PhotoCapture({ onPhoto }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [compressing, setCompressing] = useState(false)

  async function handleFile(file) {
    if (!file) return
    setCompressing(true)
    try {
      const compressed = await compressImage(file)
      const dataUrl = await fileToDataURL(compressed)
      setPreview(dataUrl)
      onPhoto({ file: compressed, preview: dataUrl })
    } finally {
      setCompressing(false)
    }
  }

  function clear() {
    setPreview(null)
    onPhoto(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium text-gray-700">Foto del documento</label>

      {!preview ? (
        <div
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors"
        >
          {compressing ? (
            <>
              <svg className="animate-spin h-8 w-8 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p className="text-sm text-gray-500">Comprimiendo imagen...</p>
            </>
          ) : (
            <>
              <svg className="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700">Tomar foto o subir archivo</p>
                <p className="text-xs text-gray-400 mt-1">Boleta, factura o recibo (máx. 1 MB)</p>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-gray-200">
          <img
            src={preview}
            alt="Preview del documento"
            className="w-full max-h-64 object-contain bg-gray-50"
          />
          <button
            type="button"
            onClick={clear}
            className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 shadow hover:bg-red-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="absolute bottom-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Foto cargada
          </div>
        </div>
      )}

      {/* Input oculto - capture="environment" abre cámara trasera en móvil */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  )
}
