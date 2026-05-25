import Anthropic from 'npm:@anthropic-ai/sdk@0.27.0'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No autorizado')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { data: profile } = await supabaseAdmin
      .from('profiles').select('rol').eq('id', user.id).single()

    // Acepta: superadmin, director (rol legacy) o admin en cualquier obra
    const rolGlobal = profile?.rol
    let autorizado = rolGlobal === 'superadmin' || rolGlobal === 'director'
    if (!autorizado) {
      const { data: membership } = await supabaseAdmin
        .from('obra_usuarios').select('rol').eq('usuario_id', user.id).eq('rol', 'admin').eq('activo', true).limit(1)
      autorizado = (membership?.length ?? 0) > 0
    }
    if (!autorizado) throw new Error('Solo administradores pueden usar esta función')

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY no configurada. Ve a Supabase → Settings → Edge Functions → Secrets y agrega ANTHROPIC_API_KEY')

    const body = await req.json()

    // Support both new { sheets } format and legacy { rows } format
    let sheets: any[]
    if (body.sheets?.length) {
      sheets = body.sheets
    } else if (body.rows?.length) {
      sheets = [{ name: 'Hoja1', rows: body.rows, boldRows: [], sectionRows: [] }]
    } else {
      throw new Error('El archivo no tiene datos')
    }

    if (!sheets.some((s: any) => s.rows?.length > 0)) {
      throw new Error('El archivo está vacío o no tiene datos legibles')
    }

    const anthropic = new Anthropic({ apiKey })

    const sheetsResumen = sheets.map((s: any) => ({
      hoja: s.name,
      totalFilas: s.rows?.length ?? 0,
      filasNegrita: s.boldRows ?? [],
      filasSectionHeader: s.sectionRows ?? [],
      datos: (s.rows ?? []).slice(0, 180),
    }))

    const numHojas = sheets.length

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      temperature: 0,
      messages: [{
        role: 'user',
        content: `Eres un experto en construcción chilena. Analiza esta planilla de cubicación y extrae las PARTIDAS con sus presupuestos.

CONTEXTO — ¿Qué es una partida?
Una partida agrupa trabajos o materiales relacionados del mismo tipo o área. Ejemplos reales:
- "Obras Preliminares", "Movimiento de Tierras", "Estructura de Hormigón", "Albanilería"
- "Instalaciones Sanitarias", "Instalaciones Eléctricas", "Terminaciones", "Pintura"
- "Cubierta y Techumbre", "Revestimientos Exteriores", "Paisajismo"
En una cubicación típica hay entre 5 y 40 partidas. Cada partida tiene un monto total que engloba todos sus ítems detallados.

CÓMO IDENTIFICAR PARTIDAS en un Excel de cubicación:
1. Filas en negrita (indicadas en "filasNegrita") → casi siempre son encabezados de partida
2. Celdas fusionadas anchas (indicadas en "filasSectionHeader") → típicamente son títulos de sección/partida
3. Filas con formato de subtotal o con fórmulas de suma → pueden ser el total de una partida
4. En Excel con varias hojas: cada hoja puede ser una partida completa o una agrupación
5. Números de ítem con jerarquía (1, 1.1, 1.1.1): los de primer nivel suelen ser partidas
6. Cambios visuales (celdas vacías como separadores, filas de solo texto descriptivo)

DATOS DEL ARCHIVO (${numHojas} hoja${numHojas > 1 ? 's' : ''}):
${JSON.stringify(sheetsResumen)}

INSTRUCCIONES:
1. Examina cuidadosamente la estructura: ¿hay numeración jerárquica? ¿filas en negrita? ¿varias hojas?
2. Identifica el patrón que siguen las partidas en ESTE archivo específico
3. Busca la columna de monto total con IVA (puede llamarse "Total", "Monto", "Presupuesto", "c/IVA", etc.)
4. Si hay varias interpretaciones razonables de qué son las partidas, ofrécelas como alternativas
5. Si la estructura es ambigua o inusual, exprésalo en tu interpretación con confianza baja/media

RESPONDE SOLO con este JSON exacto (sin markdown, sin texto extra):
{
  "interpretacion": "descripción concisa de cómo está organizado el archivo y cómo identificaste las partidas (2-3 oraciones)",
  "confianza": "alta",
  "partidas": [
    {
      "nombre": "Nombre limpio de la partida",
      "presupuesto_estimado": 1234567,
      "items": [
        {
          "descripcion": "Descripción del ítem",
          "unidad": "m2",
          "cantidad": 100,
          "precio_unitario": 12345,
          "total": 1234500
        }
      ]
    }
  ],
  "alternativas": [
    {
      "descripcion": "descripción de esta interpretación alternativa",
      "partidas": [{"nombre": "...", "presupuesto_estimado": 1234567, "items": []}]
    }
  ]
}

Reglas:
- "confianza": "alta" si la estructura es clara, "media" si hay algo ambiguo pero interpretable, "baja" si el formato es muy inusual
- Nombres de partidas limpios, descriptivos, sin números de ítem al inicio
- Montos enteros en pesos chilenos ("1.234.567" → 1234567, "$1,234,567" → 1234567)
- Si no hay monto claro, usa 0
- "alternativas" puede ser [] si la interpretación es clara y única
- "items": incluye los ítems detallados de cada partida (máximo 30 por partida). Si un campo no existe en el archivo, omítelo del objeto
- Los ítems son las filas de detalle bajo cada encabezado de partida (materiales, trabajos, mano de obra, etc.)`,
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

    let result: any
    try {
      result = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (!match) throw new Error('Claude no pudo analizar la estructura del archivo. Verifica que el Excel tenga datos de cubicación.')
      result = JSON.parse(match[0])
    }

    if (!Array.isArray(result.partidas) || result.partidas.length === 0) {
      throw new Error('No se encontraron partidas en el archivo. Verifica que el Excel contenga una planilla de cubicación.')
    }

    // Ensure all fields present
    result.interpretacion = result.interpretacion || 'Análisis completado'
    result.confianza = result.confianza || 'media'
    result.alternativas = Array.isArray(result.alternativas) ? result.alternativas : []

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message ?? String(error) }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
