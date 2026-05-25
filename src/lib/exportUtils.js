import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

const fmt = (n) => `$${Number(n ?? 0).toLocaleString('es-CL')}`
const pct = (gasto, presup) =>
  presup > 0 ? Math.round((gasto / presup) * 100) : 0

export function exportPDF({ partidas, gastos, anticipos, constructores }) {
  const doc = new jsPDF()

  // Encabezado
  doc.setFontSize(20)
  doc.setTextColor(37, 99, 235)
  doc.text('ObraClara', 14, 20)
  doc.setFontSize(12)
  doc.setTextColor(100)
  doc.text('Resumen General del Proyecto', 14, 28)
  doc.text(`Generado: ${new Date().toLocaleDateString('es-CL')}`, 14, 35)

  // Tabla de avance por partida
  doc.setFontSize(14)
  doc.setTextColor(30)
  doc.text('Avance por Partida', 14, 48)

  const totalPresup = partidas.reduce((s, p) => s + Number(p.presupuesto_estimado), 0)
  const gastosAprobados = gastos.filter((g) => g.estado === 'aprobado')
  const totalGasto = gastosAprobados.reduce((s, g) => s + Number(g.monto), 0)

  autoTable(doc, {
    startY: 52,
    head: [['Partida', 'Presupuesto', 'Gastado', 'Saldo', '%']],
    body: partidas.map((p) => {
      const gastado = gastosAprobados
        .filter((g) => g.partida_id === p.id)
        .reduce((s, g) => s + Number(g.monto), 0)
      const saldo = Number(p.presupuesto_estimado) - gastado
      const avance = pct(gastado, p.presupuesto_estimado)
      return [p.nombre, fmt(p.presupuesto_estimado), fmt(gastado), fmt(saldo), `${avance}%`]
    }),
    foot: [['TOTAL', fmt(totalPresup), fmt(totalGasto), fmt(totalPresup - totalGasto), `${pct(totalGasto, totalPresup)}%`]],
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
    footStyles: { fillColor: [241, 245, 249], textColor: [30, 30, 30], fontStyle: 'bold' },
  })

  // Resumen de caja
  const totalAnticipado = anticipos.reduce((s, a) => s + Number(a.monto), 0)
  const totalRendido = gastosAprobados
    .filter((g) => constructores.includes(g.usuario_id))
    .reduce((s, g) => s + Number(g.monto), 0)

  let y = doc.lastAutoTable.finalY + 12
  doc.setFontSize(14)
  doc.text('Resumen de Caja', 14, y)
  y += 6
  doc.setFontSize(10)
  doc.setTextColor(80)
  doc.text(`Total anticipado: ${fmt(totalAnticipado)}`, 14, y); y += 6
  doc.text(`Total rendido:    ${fmt(totalRendido)}`, 14, y); y += 6
  doc.text(`Saldo por rendir: ${fmt(totalAnticipado - totalRendido)}`, 14, y)

  // Listado de gastos aprobados
  y += 14
  doc.setFontSize(14)
  doc.setTextColor(30)
  doc.text('Gastos Aprobados', 14, y)

  autoTable(doc, {
    startY: y + 4,
    head: [['Fecha', 'Descripción', 'Partida', 'Monto']],
    body: gastosAprobados.map((g) => [
      new Date(g.fecha_gasto).toLocaleDateString('es-CL'),
      g.descripcion.substring(0, 40),
      partidas.find((p) => p.id === g.partida_id)?.nombre ?? '—',
      fmt(g.monto),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
  })

  doc.save('ObraClara_Resumen.pdf')
}

export function exportExcel({ partidas, gastos, anticipos }) {
  const wb = XLSX.utils.book_new()
  const gastosAprobados = gastos.filter((g) => g.estado === 'aprobado')

  // Hoja 1: Avance por partida
  const avanceData = partidas.map((p) => {
    const gastado = gastosAprobados
      .filter((g) => g.partida_id === p.id)
      .reduce((s, g) => s + Number(g.monto), 0)
    return {
      Partida: p.nombre,
      'Presupuesto Estimado': Number(p.presupuesto_estimado),
      Gastado: gastado,
      Saldo: Number(p.presupuesto_estimado) - gastado,
      '% Avance': pct(gastado, p.presupuesto_estimado),
    }
  })
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(avanceData), 'Avance')

  // Hoja 2: Gastos aprobados
  const gastosData = gastosAprobados.map((g) => ({
    Fecha: new Date(g.fecha_gasto).toLocaleDateString('es-CL'),
    Descripción: g.descripcion,
    Partida: partidas.find((p) => p.id === g.partida_id)?.nombre ?? '—',
    Monto: Number(g.monto),
    Estado: g.estado,
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(gastosData), 'Gastos')

  // Hoja 3: Anticipos
  const anticiposData = anticipos.map((a) => ({
    Fecha: new Date(a.fecha).toLocaleDateString('es-CL'),
    Descripción: a.descripcion,
    Monto: Number(a.monto),
  }))
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(anticiposData), 'Anticipos')

  XLSX.writeFile(wb, 'ObraClara_Resumen.xlsx')
}

export function readExcelRows(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false })
        resolve(rows)
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function readExcelData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        // Try with styles first; fall back silently if the file doesn't support them
        let wb
        try {
          wb = XLSX.read(e.target.result, { type: 'array', cellStyles: true })
        } catch {
          wb = XLSX.read(e.target.result, { type: 'array' })
        }

        const sheets = wb.SheetNames.slice(0, 8).map((name) => {
          const ws = wb.Sheets[name]
          if (!ws['!ref']) return { name, rows: [], boldRows: [], sectionRows: [] }

          const range = XLSX.utils.decode_range(ws['!ref'])
          const boldRowSet = new Set()

          for (let r = range.s.r; r <= Math.min(range.e.r, 249); r++) {
            for (let c = range.s.c; c <= Math.min(range.e.c, 20); c++) {
              const cell = ws[XLSX.utils.encode_cell({ r, c })]
              if (cell?.s?.font?.bold) { boldRowSet.add(r); break }
            }
          }

          // Wide merged cells often mark section/partida headers
          const sectionRows = [...new Set(
            (ws['!merges'] || [])
              .filter((m) => (m.e.c - m.s.c) >= 2)
              .map((m) => m.s.r)
          )]

          // Use same format as readExcelRows (object format) — proven to work reliably
          const rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false }).slice(0, 150)

          return { name, rows, boldRows: [...boldRowSet], sectionRows }
        })

        const nonEmpty = sheets.filter((s) => s.rows.length > 0)
        // If filtering removed everything (edge case), include all sheets anyway
        resolve({ sheets: nonEmpty.length > 0 ? nonEmpty : sheets })
      } catch (err) { reject(err) }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

export function parseExcelPartidas(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const data = XLSX.utils.sheet_to_json(ws)

        const partidas = data
          .map((row) => {
            const nombre = row['Partida'] ?? row['partida'] ?? row['PARTIDA']
            const presupuesto =
              row['Presupuesto estimado (con IVA)'] ??
              row['Presupuesto'] ??
              row['presupuesto'] ??
              row['PRESUPUESTO'] ??
              0
            if (!nombre) return null
            return { nombre: String(nombre).trim(), presupuesto_estimado: Number(presupuesto) }
          })
          .filter(Boolean)

        resolve(partidas)
      } catch (err) {
        reject(err)
      }
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
