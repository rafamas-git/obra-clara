import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/layout/Layout'
import PhotoCapture from '../components/expenses/PhotoCapture'
import Button from '../components/ui/Button'
import { Input, Textarea, Select } from '../components/ui/Input'
import UMCombobox from '../components/ui/UMCombobox'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { useToast } from '../components/ui/Toast'

const fmtNum = (n) => Number(n ?? 0).toLocaleString('es-CL')

export default function NewExpense() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const [partidas, setPartidas]   = useState([])
  const [unidades, setUnidades]   = useState([])
  const [form, setForm] = useState({
    descripcion:    '',
    cantidad:       '',
    unidad_medida:  '',
    precio_unitario: '',
    monto:          '',
    partida_id:     '',
    fecha_gasto:    new Date().toISOString().split('T')[0],
  })
  const [photo, setPhoto]   = useState(null)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('partidas').select('*').eq('activo', true).order('orden'),
      supabase.from('unidades_medida').select('codigo').order('codigo'),
    ]).then(([{ data: p }, { data: u }]) => {
      setPartidas(p ?? [])
      setUnidades((u ?? []).map((x) => x.codigo))
    })
  }, [])

  const isGL = form.unidad_medida?.toLowerCase() === 'gl'

  function setField(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }

      // Auto-calcular total al cambiar cantidad o precio_unitario
      if (field === 'cantidad' || field === 'precio_unitario') {
        const c  = Number(field === 'cantidad' ? value : prev.cantidad)
        const pu = Number(field === 'precio_unitario' ? value : prev.precio_unitario)
        const um = prev.unidad_medida?.toLowerCase()
        if (c > 0 && pu > 0 && um !== 'gl') {
          next.monto = String(Math.round(c * pu))
        }
      }

      // Si cambia a GL, limpiar cantidad y precio
      if (field === 'unidad_medida' && value?.toLowerCase() === 'gl') {
        next.cantidad = ''
        next.precio_unitario = ''
      }

      return next
    })
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  function isConsistente() {
    if (isGL) return true
    const c  = Number(form.cantidad)
    const pu = Number(form.precio_unitario)
    const total = Number(form.monto)
    if (!c || !pu || !total) return true
    return Math.abs(c * pu - total) <= 1
  }

  async function addUnidad(codigo) {
    await supabase.from('unidades_medida').insert({ codigo }).select()
    setUnidades((prev) => [...prev, codigo].sort())
  }

  function validate() {
    const e = {}
    if (!form.descripcion.trim())                              e.descripcion = 'La descripción es requerida'
    if (!form.unidad_medida.trim())                            e.unidad_medida = 'Selecciona o ingresa una unidad'
    if (!isGL && (!form.cantidad || Number(form.cantidad) <= 0))
      e.cantidad = 'Ingresa la cantidad'
    if (!isGL && (!form.precio_unitario || Number(form.precio_unitario) <= 0))
      e.precio_unitario = 'Ingresa el precio unitario'
    if (!form.monto || isNaN(Number(form.monto)) || Number(form.monto) <= 0)
      e.monto = 'Ingresa un total válido mayor a 0'
    if (!form.partida_id) e.partida_id = 'Selecciona una partida'
    if (!form.fecha_gasto) e.fecha_gasto = 'La fecha es requerida'
    return e
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setLoading(true)
    try {
      let foto_path = null

      if (photo?.file) {
        const ext = photo.file.name?.split('.').pop() ?? 'jpg'
        const path = `${profile.id}/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('recibos')
          .upload(path, photo.file, { contentType: photo.file.type })
        if (uploadError) throw uploadError
        foto_path = path
      }

      const { error } = await supabase.from('gastos').insert({
        descripcion:     form.descripcion.trim(),
        monto:           Number(form.monto),
        cantidad:        form.cantidad ? Number(form.cantidad) : null,
        unidad_medida:   form.unidad_medida.trim() || null,
        precio_unitario: form.precio_unitario ? Number(form.precio_unitario) : null,
        partida_id:      form.partida_id,
        fecha_gasto:     form.fecha_gasto,
        usuario_id:      profile.id,
        foto_path,
        estado:          'pendiente',
      })

      if (error) throw error

      toast('Gasto ingresado correctamente. Quedará pendiente de aprobación.', 'success')
      navigate(profile.rol === 'director' ? '/gastos' : '/mis-gastos')
    } catch (err) {
      toast(`Error al guardar: ${err.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const mismatch = !isConsistente()

  return (
    <Layout title="Nuevo Gasto">
      <div className="max-w-lg mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Ingresar gasto</h1>
          <p className="text-gray-500 text-sm mt-0.5">El gasto quedará pendiente de aprobación</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">

          <Textarea
            label="Descripción del gasto"
            placeholder="Ej: Cemento gris para muros"
            value={form.descripcion}
            onChange={(e) => setField('descripcion', e.target.value)}
            error={errors.descripcion}
          />

          {/* UM */}
          <UMCombobox
            label="Unidad de medida"
            value={form.unidad_medida}
            options={unidades}
            onChange={(v) => setField('unidad_medida', v)}
            onAdd={addUnidad}
            error={errors.unidad_medida}
          />

          {/* Cantidad + Precio Unitario — ocultos si GL */}
          {!isGL && (
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Cantidad"
                type="number"
                min="0"
                step="any"
                placeholder="0"
                value={form.cantidad}
                onChange={(e) => setField('cantidad', e.target.value)}
                error={errors.cantidad}
              />
              <Input
                label="Precio unitario ($)"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={form.precio_unitario}
                onChange={(e) => setField('precio_unitario', e.target.value)}
                error={errors.precio_unitario}
              />
            </div>
          )}

          {/* Total + Fecha */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Total con IVA ($)"
              type="number"
              min="1"
              step="1"
              placeholder="0"
              value={form.monto}
              onChange={(e) => setField('monto', e.target.value)}
              error={errors.monto}
            />
            <Input
              label="Fecha del gasto"
              type="date"
              value={form.fecha_gasto}
              onChange={(e) => setField('fecha_gasto', e.target.value)}
              error={errors.fecha_gasto}
            />
          </div>

          {/* Aviso de descuadre */}
          {mismatch && (
            <div className="bg-amber-50 rounded-xl px-4 py-3 flex items-start gap-2">
              <svg className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-semibold text-amber-800">Los valores no cuadran</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {form.cantidad} × ${fmtNum(form.precio_unitario)} = ${fmtNum(Math.round(Number(form.cantidad) * Number(form.precio_unitario)))},
                  {' '}pero el total ingresado es ${fmtNum(form.monto)}.
                </p>
                <p className="text-xs text-amber-600 mt-1">Puedes continuar de todas formas.</p>
              </div>
            </div>
          )}

          {/* Partida */}
          <Select
            label="Partida"
            value={form.partida_id}
            onChange={(e) => setField('partida_id', e.target.value)}
            error={errors.partida_id}
          >
            <option value="">— Selecciona una partida —</option>
            {partidas.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>

          {partidas.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded-xl px-3 py-2">
              No hay partidas cargadas. El Director debe subir el presupuesto primero.
            </p>
          )}

          <PhotoCapture onPhoto={setPhoto} />

          <div className="pt-2">
            <Button type="submit" size="lg" loading={loading} className="w-full">
              Enviar gasto para aprobación
            </Button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
