import { useState, useEffect, useRef, useMemo } from 'react'
import Chart from 'chart.js/auto'
import { supabase } from '../lib/supabase'
import { generarPDF } from '../lib/generarPDF'
import { buscarPregunta, distribucionCompleta } from '../lib/reportesAutomaticos'
import { normalizarTexto, sugerirCategoria } from '../lib/fuzzyMatch'
import { diferenciaSignificativa, margenFormateado } from '../lib/margenError'
import { bloqueEstadisticoHTML } from '../lib/estadisticaPDF'
import { ArrowLeft, Download } from 'lucide-react'
import { Select } from './ui'

// Comparación entre dos encuestas (Cambio 2) + Panel de seguimiento
// temporal (Reporte 21, atado al Cambio 2 — no vive en REPORTES_DEFS).
//
// Ojo con el nombre: esto es distinto de la tab "🔀 Cruzar datos" que ya
// existe dentro del detalle de UNA encuesta (Reportes.jsx, vistaActiva ===
// 'comparar') — esa cruza dos PREGUNTAS de la misma encuesta. Esto compara
// la MISMA pregunta entre DOS encuestas distintas, así que va como vista
// de nivel superior, separada del selector de encuesta única.
//
// Igual que el resto del módulo: Chart.js solo para el gráfico interactivo
// en pantalla — el PDF (vía Puppeteer, /api/pdf) usa SVG inline porque
// page.setContent(html, { waitUntil: 'networkidle0' }) no ejecuta scripts.

const COLOR_A = '#1a472a'
const COLOR_B = '#0369a1'

const inp = { padding: '8px 12px', borderRadius: 'var(--r)', border: '1.5px solid var(--border2)', fontSize: 13, fontFamily: 'DM Sans', background: 'var(--surface)', color: 'var(--ink)', width: '100%' }
const box = { background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: 20 }

async function cargarLado(encuestaId, orgId) {
  const [{ data: full, error: e1 }, { data: crudo, error: e2 }] = await Promise.all([
    supabase.rpc('get_encuesta_full', { p_encuesta_id: encuestaId, p_org_id: orgId }),
    supabase.rpc('get_respuestas_crudas', {
      p_encuesta_id: encuestaId, p_org_id: orgId,
      p_equipo_id: null, p_encuestador_id: null, p_fecha_desde: null, p_fecha_hasta: null,
    }),
  ])
  if (e1 || e2) throw e1 || e2
  return { preguntas: full?.preguntas || [], crudo: crudo || { columnas: [], filas: [] } }
}

// Mergea la distribución de una misma pregunta (por clave_base) entre las
// dos encuestas, opción por opción — asume mismo set de opciones (misma
// clave_base → mismo tipo de pregunta en el diseño de la encuesta).
// `significativa`: la diferencia supera la suma de los márgenes de error de
// ambas encuestas (diferenciaSignificativa, lib/margenError.js).
//
// Como las preguntas de cada encuesta pueden estar redactadas distinto, las
// OPCIONES también: se emparejan por texto normalizado y, si no hay igual,
// por matching difuso (sugerirCategoria). Las opciones de B que no
// emparejan con ninguna de A se agregan al final con 0 en A.
function mergeDistribuciones(distA, distB) {
  const usadasB = new Set()
  const opcionesB = distB.filas.map(f => f.opcion)
  const fila = (opcion, fa, fb) => ({
    opcion, nA: fa.n, pctA: fa.pct, nB: fb.n, pctB: fb.pct, diff: Math.round((fb.pct - fa.pct) * 10) / 10,
    totalA: distA.total, totalB: distB.total,
    significativa: diferenciaSignificativa(distA.total, fa.pct / 100, distB.total, fb.pct / 100),
  })
  const vacia = { n: 0, pct: 0 }
  const filas = distA.filas.map(fa => {
    const libres = opcionesB.filter(o => !usadasB.has(o))
    const igual = libres.find(o => normalizarTexto(o) === normalizarTexto(fa.opcion))
    const match = igual || sugerirCategoria(fa.opcion, libres)?.categoria
    if (!match) return fila(fa.opcion, fa, vacia)
    usadasB.add(match)
    const fb = distB.filas.find(f => f.opcion === match)
    return fila(match === fa.opcion || igual ? fa.opcion : `${fa.opcion} / ${match}`, fa, fb)
  })
  distB.filas.filter(fb => !usadasB.has(fb.opcion)).forEach(fb => filas.push(fila(fb.opcion, vacia, fb)))
  return filas
}

const TIPOS_COMPARABLES = ['si_no', 'escala', 'opcion_multiple']

function preguntasComparables(preguntas) {
  return (preguntas || []).filter(p => TIPOS_COMPARABLES.includes(p.tipo))
}

// La pregunta de participación se cuenta sobre TODAS las sesiones (si no,
// solo aparecerían los "Sí": el resto de las preguntas se cuenta solo sobre
// completadas, que por definición respondieron "Sí").
function distribucionDe(pregunta, preguntas, crudo) {
  const pParticipa = buscarPregunta(preguntas, 'participa')
  const esParticipa = pParticipa && pParticipa.id === pregunta.id
  return distribucionCompleta(pregunta, preguntas, crudo, esParticipa ? null : pParticipa)
}

// Sugerencia de pareja en B para una pregunta de A: misma clave_base si
// existe; si no, la de texto más parecido.
function sugerirPareja(pA, preguntasB) {
  if (!pA) return null
  const candidatas = preguntasComparables(preguntasB)
  if (pA.clave_base) {
    const mismaClave = candidatas.find(q => q.clave_base === pA.clave_base)
    if (mismaClave) return mismaClave
  }
  const texto = sugerirCategoria(pA.texto, candidatas.map(q => q.texto), {}, 0.3)?.categoria
  return candidatas.find(q => q.texto === texto) || null
}

function pieSignificanciaHTML(filas) {
  if (!filas.length) return ''
  const { totalA, totalB } = filas[0]
  return bloqueEstadisticoHTML(`n A = ${totalA} (${margenFormateado(totalA)}) · n B = ${totalB} (${margenFormateado(totalB)}). Una diferencia es significativa cuando supera la suma de los márgenes de error de ambas encuestas (95% de confianza).`)
}

function tablaComparacionHTML(filas, labelA, labelB) {
  const rows = filas.map((f, i) => {
    const signo = f.diff > 0 ? '+' : ''
    const color = f.diff > 0 ? '#2d8f4e' : f.diff < 0 ? '#c0392b' : '#888'
    return `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafaf8'}">
      <td>${f.opcion}</td>
      <td style="text-align:right">${f.nA} (${f.pctA}%)</td>
      <td style="text-align:right">${f.nB} (${f.pctB}%)</td>
      <td style="text-align:right;color:${f.significativa ? color : '#888'};font-weight:700">${signo}${f.diff}pp</td>
      <td style="text-align:center">${f.significativa ? '✅' : '⚠️ dentro del margen'}</td>
    </tr>`
  }).join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">
    <thead><tr style="background:#f3f4f6">
      <th style="text-align:left">Opción</th><th style="text-align:right">${labelA}</th><th style="text-align:right">${labelB}</th><th style="text-align:right">Diferencia</th><th style="text-align:center">Significativa</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>${pieSignificanciaHTML(filas)}`
}

// Barras agrupadas SVG — dos barras (A/B) por opción, escaladas al máximo
// de la serie. Reemplaza al Chart.js de pantalla para el PDF.
function barrasAgrupadasSVG(filas, labelA, labelB) {
  const w = Math.max(420, filas.length * 90), h = 220, pad = 36
  const max = Math.max(10, ...filas.map(f => Math.max(f.pctA, f.pctB)))
  const grupoW = (w - pad * 2) / filas.length
  const barW = Math.min(28, grupoW / 3)
  const bars = filas.map((f, i) => {
    const cx = pad + i * grupoW + grupoW / 2
    const hA = (f.pctA / max) * (h - pad * 2)
    const hB = (f.pctB / max) * (h - pad * 2)
    const xA = cx - barW - 2, xB = cx + 2
    const yA = h - pad - hA, yB = h - pad - hB
    return `<rect x="${xA.toFixed(1)}" y="${yA.toFixed(1)}" width="${barW}" height="${hA.toFixed(1)}" fill="${COLOR_A}" rx="2"/>
      <rect x="${xB.toFixed(1)}" y="${yB.toFixed(1)}" width="${barW}" height="${hB.toFixed(1)}" fill="${COLOR_B}" rx="2"/>
      <text x="${cx.toFixed(1)}" y="${h - pad + 14}" font-size="9" fill="#888" text-anchor="middle">${String(f.opcion).slice(0, 14)}</text>`
  }).join('')
  return `<svg width="${w}" height="${h}" style="margin-bottom:18px">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" stroke="#e5e7eb"/>
    ${bars}
    <g transform="translate(${pad},14)">
      <rect width="10" height="10" fill="${COLOR_A}"/><text x="14" y="9" font-size="10" fill="#555">${labelA}</text>
      <rect x="120" width="10" height="10" fill="${COLOR_B}"/><text x="134" y="9" font-size="10" fill="#555">${labelB}</text>
    </g>
  </svg>`
}

const CSS_PDF = `*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;color:#1a1a1a;background:#fff;padding:40px;font-size:13px}
.header{border-bottom:3px solid #52B788;padding-bottom:20px;margin-bottom:24px}
h1{font-size:20px;font-weight:800;color:#1a472a;margin:8px 0 4px}
.meta{font-size:11px;color:#888;margin-top:6px}
.sec{font-size:13px;font-weight:700;color:#1a472a;margin:20px 0 10px;padding-bottom:6px;border-bottom:2px solid #e5e7eb}
table td,table th{border:1px solid #e5e7eb;padding:6px 10px}
footer{margin-top:28px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#bbb;display:flex;justify-content:space-between}
@media print{body{padding:20px}}`

function shellPDF(titulo, subtitulo, cuerpo) {
  const fecha = new Date().toLocaleString('es-AR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title><style>${CSS_PDF}</style></head><body>
<div class="header">
  <div style="font-size:10px;font-weight:700;letter-spacing:2px;color:#52B788;text-transform:uppercase">METR1KA · Comparación entre encuestas</div>
  <h1>${titulo}</h1>
  <div style="font-size:13px;color:#555">${subtitulo}</div>
  <div class="meta">Generado el ${fecha}</div>
</div>
${cuerpo}
<footer><span>METR1KA — metr1ka.com</span><span>${fecha}</span></footer>
</body></html>`
}

function fechaCorta(iso) {
  return iso ? new Date(iso).toLocaleDateString('es-AR') : ''
}

export default function CompararEncuestas({ encuestas, perfil, onVolver }) {
  const [idA, setIdA] = useState('')
  const [idB, setIdB] = useState('')
  // `id` guarda de qué encuesta son `preguntas`/`crudo` — así se puede
  // derivar "cargando" (idX seleccionado pero la data todavía es de otra
  // encuesta o no llegó) sin guardarlo como estado aparte que un efecto
  // tendría que ir corrigiendo.
  const [ladoA, setLadoA] = useState({ id: null, preguntas: [], crudo: null, error: '' })
  const [ladoB, setLadoB] = useState({ id: null, preguntas: [], crudo: null, error: '' })
  const [pregIdA, setPregIdA] = useState('')
  const [pregIdB, setPregIdB] = useState('')
  const chartRef = useRef(null)
  const chartInst = useRef(null)

  const encA = encuestas.find(e => e.id === idA)
  const encB = encuestas.find(e => e.id === idB)

  // El reset a vacío pasa en el onChange del <select> (evento de usuario),
  // no acá — el efecto solo sincroniza con el servidor, y solo llama
  // setState dentro de los callbacks async (ver "you might not need an
  // effect": nada de setState síncrono al tope del efecto).
  useEffect(() => {
    if (!idA) return
    let cancelado = false
    cargarLado(idA, perfil.organizacion_id)
      .then(r => { if (!cancelado) setLadoA({ id: idA, ...r, error: '' }) })
      .catch(e => { console.error('CompararEncuestas, ladoA:', e); if (!cancelado) setLadoA({ id: idA, preguntas: [], crudo: null, error: 'No se pudo cargar la encuesta.' }) })
    return () => { cancelado = true }
  }, [idA, perfil.organizacion_id])

  useEffect(() => {
    if (!idB) return
    let cancelado = false
    cargarLado(idB, perfil.organizacion_id)
      .then(r => { if (!cancelado) setLadoB({ id: idB, ...r, error: '' }) })
      .catch(e => { console.error('CompararEncuestas, ladoB:', e); if (!cancelado) setLadoB({ id: idB, preguntas: [], crudo: null, error: 'No se pudo cargar la encuesta.' }) })
    return () => { cancelado = true }
  }, [idB, perfil.organizacion_id])

  function elegirA(id) {
    setIdA(id)
    if (!id) setLadoA({ id: null, preguntas: [], crudo: null, error: '' })
  }
  function elegirB(id) {
    setIdB(id)
    if (!id) setLadoB({ id: null, preguntas: [], crudo: null, error: '' })
  }

  const cargandoA = !!idA && ladoA.id !== idA && !ladoA.error
  const cargandoB = !!idB && ladoB.id !== idB && !ladoB.error
  const ambasCargadas = !!(idA && idB && ladoA.id === idA && ladoB.id === idB && ladoA.crudo && ladoB.crudo)

  const comparablesA = useMemo(() => (ambasCargadas ? preguntasComparables(ladoA.preguntas) : []), [ambasCargadas, ladoA.preguntas])
  const comparablesB = useMemo(() => (ambasCargadas ? preguntasComparables(ladoB.preguntas) : []), [ambasCargadas, ladoB.preguntas])

  // Pregunta de cada lado: la elegida por el usuario si sigue existiendo;
  // si no, la primera que no sea "participa" en A y la sugerida en B —
  // derivado en render, sin efecto que "corrija" el estado.
  const preguntaA = useMemo(() => {
    return comparablesA.find(p => p.id === pregIdA)
      || comparablesA.find(p => p.clave_base !== 'participa') || comparablesA[0] || null
  }, [comparablesA, pregIdA])
  const preguntaB = useMemo(() => {
    return comparablesB.find(p => p.id === pregIdB) || sugerirPareja(preguntaA, ladoB.preguntas) || comparablesB[0] || null
  }, [comparablesB, pregIdB, preguntaA, ladoB.preguntas])

  function elegirPreguntaA(id) {
    setPregIdA(id)
    // Al cambiar A se vuelve a sugerir la pareja en B (el usuario la puede cambiar).
    setPregIdB('')
  }

  const filasComparacion = useMemo(() => {
    if (!preguntaA || !preguntaB || !ladoA.crudo || !ladoB.crudo) return []
    const distA = distribucionDe(preguntaA, ladoA.preguntas, ladoA.crudo)
    const distB = distribucionDe(preguntaB, ladoB.preguntas, ladoB.crudo)
    return mergeDistribuciones(distA, distB)
  }, [preguntaA, preguntaB, ladoA, ladoB])

  useEffect(() => {
    if (!chartRef.current || !filasComparacion.length) return
    if (chartInst.current) chartInst.current.destroy()
    chartInst.current = new Chart(chartRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels: filasComparacion.map(f => f.opcion),
        datasets: [
          { label: encA?.nombre || 'Encuesta A', data: filasComparacion.map(f => f.pctA), backgroundColor: COLOR_A, borderRadius: 4 },
          { label: encB?.nombre || 'Encuesta B', data: filasComparacion.map(f => f.pctB), backgroundColor: COLOR_B, borderRadius: 4 },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10 } } },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 30 } },
          y: { beginAtZero: true, ticks: { font: { size: 10 }, callback: v => `${v}%` } },
        },
      },
    })
    return () => chartInst.current?.destroy()
  }, [filasComparacion, encA?.nombre, encB?.nombre])

  function descargarPDFPregunta() {
    if (!filasComparacion.length || !preguntaA) return
    const cuerpo = `${tablaComparacionHTML(filasComparacion, encA.nombre, encB.nombre)}${barrasAgrupadasSVG(filasComparacion, encA.nombre, encB.nombre)}`
    const titulo = preguntaA.texto === preguntaB.texto ? preguntaA.texto : `${preguntaA.texto} / ${preguntaB.texto}`
    const html = shellPDF(titulo || 'Comparación', `${encA.nombre} (${fechaCorta(encA.creado_en)}) vs ${encB.nombre} (${fechaCorta(encB.creado_en)})`, cuerpo)
    generarPDF(html, `comparacion-${(preguntaA.texto || 'pregunta').replace(/[^\w-]+/g, '_')}.pdf`)
  }

  // Reporte 21 — Panel de seguimiento: todas las preguntas comunes, con
  // página de resumen (top 5 variaciones) al principio.
  function descargarPanelSeguimiento() {
    if (!ambasCargadas) return
    // Parejas: las de misma clave_base (detectables automáticamente) + la
    // pareja elegida a mano en pantalla, si no estaba ya.
    const parejas = comparablesA
      .filter(pA => pA.clave_base)
      .map(pA => [pA, comparablesB.find(q => q.clave_base === pA.clave_base)])
      .filter(([, pB]) => pB)
    if (preguntaA && preguntaB && !parejas.some(([a, b]) => a.id === preguntaA.id && b.id === preguntaB.id)) parejas.unshift([preguntaA, preguntaB])
    if (!parejas.length) return

    const secciones = parejas.map(([pA, pB]) => {
      const filas = mergeDistribuciones(distribucionDe(pA, ladoA.preguntas, ladoA.crudo), distribucionDe(pB, ladoB.preguntas, ladoB.crudo))
      return { titulo: pA.texto === pB.texto ? pA.texto : `${pA.texto} / ${pB.texto}`, filas }
    }).filter(s => s.filas.length)

    const variaciones = secciones.flatMap(s => s.filas.map(f => ({ pregunta: s.titulo, opcion: f.opcion, diff: f.diff })))
    const top5 = variaciones.slice().sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)).slice(0, 5)

    const resumen = `<div style="page-break-after:always">
      <div class="sec">Resumen — variaciones más significativas</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:#f3f4f6"><th style="text-align:left">Pregunta</th><th style="text-align:left">Opción</th><th style="text-align:right">Variación</th></tr></thead>
        <tbody>${top5.map((v, i) => {
          const signo = v.diff > 0 ? '+' : ''
          const color = v.diff > 0 ? '#2d8f4e' : v.diff < 0 ? '#c0392b' : '#888'
          return `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafaf8'}"><td>${v.pregunta}</td><td>${v.opcion}</td><td style="text-align:right;color:${color};font-weight:700">${signo}${v.diff}pp</td></tr>`
        }).join('')}</tbody>
      </table>
    </div>`

    const cuerpoSecciones = secciones.map(s =>
      `<div class="sec">${s.titulo}</div>${tablaComparacionHTML(s.filas, encA.nombre, encB.nombre)}${barrasAgrupadasSVG(s.filas, encA.nombre, encB.nombre)}`
    ).join('')

    const html = shellPDF('Panel de seguimiento temporal', `${encA.nombre} (${fechaCorta(encA.creado_en)}) vs ${encB.nombre} (${fechaCorta(encB.creado_en)})`, resumen + cuerpoSecciones)
    generarPDF(html, `panel-seguimiento-${(encA.nombre + '_' + encB.nombre).replace(/[^\w-]+/g, '_')}.pdf`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={onVolver} style={{ background: 'none', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', padding: '5px 12px', fontSize: 12, cursor: 'pointer', color: 'var(--ink3)', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
          <ArrowLeft size={13} /> Volver
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>⚖️ Comparar encuestas</span>
      </div>

      <div style={{ ...box, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>Encuesta A</label>
          <Select value={idA} onChange={e => elegirA(e.target.value)} style={inp}>
            <option value="">Elegir encuesta…</option>
            {encuestas.map(enc => <option key={enc.id} value={enc.id} disabled={enc.id === idB}>{enc.nombre}</option>)}
          </Select>
          {cargandoA && <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 6 }}>Cargando…</div>}
          {ladoA.error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{ladoA.error}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>Encuesta B</label>
          <Select value={idB} onChange={e => elegirB(e.target.value)} style={inp}>
            <option value="">Elegir encuesta…</option>
            {encuestas.map(enc => <option key={enc.id} value={enc.id} disabled={enc.id === idA}>{enc.nombre}</option>)}
          </Select>
          {cargandoB && <div style={{ fontSize: 12, color: 'var(--ink3)', marginTop: 6 }}>Cargando…</div>}
          {ladoB.error && <div style={{ fontSize: 12, color: 'var(--danger)', marginTop: 6 }}>{ladoB.error}</div>}
        </div>
      </div>

      {ambasCargadas && (!comparablesA.length || !comparablesB.length) && (
        <div style={{ ...box, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
          Alguna de las dos encuestas no tiene preguntas de opciones (sí/no, escala u opción múltiple) — no hay nada para comparar.
        </div>
      )}

      {ambasCargadas && comparablesA.length > 0 && comparablesB.length > 0 && (
        <>
          <div style={{ ...box, display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>Pregunta de {encA?.nombre || 'A'}</label>
              <Select value={preguntaA?.id || ''} onChange={e => elegirPreguntaA(e.target.value)} style={inp}>
                {comparablesA.map(p => <option key={p.id} value={p.id}>{p.texto}</option>)}
              </Select>
            </div>
            <div style={{ flex: 1, minWidth: 240 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink3)', display: 'block', marginBottom: 4 }}>Pregunta de {encB?.nombre || 'B'}</label>
              <Select value={preguntaB?.id || ''} onChange={e => setPregIdB(e.target.value)} style={inp}>
                {comparablesB.map(p => <option key={p.id} value={p.id}>{p.texto}</option>)}
              </Select>
            </div>
            <button onClick={descargarPDFPregunta} disabled={!filasComparacion.length}
              style={{ padding: '8px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 700, cursor: filasComparacion.length ? 'pointer' : 'not-allowed', opacity: filasComparacion.length ? 1 : 0.5, fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} /> Descargar PDF
            </button>
            <button onClick={descargarPanelSeguimiento}
              style={{ padding: '8px 14px', background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink2)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Download size={13} /> Exportar panel de seguimiento
            </button>
            <div style={{ width: '100%', fontSize: 11, color: 'var(--ink3)' }}>
              Elegí una pregunta de cada encuesta (pueden estar redactadas distinto). En B se sugiere automáticamente la más parecida; las opciones se emparejan por texto.
              El panel de seguimiento incluye esta pareja más las preguntas con la misma clasificación en ambas encuestas.
            </div>
          </div>

          {filasComparacion.length === 0 ? (
            <div style={{ ...box, textAlign: 'center', color: 'var(--ink3)', fontSize: 13 }}>
              Ninguna de las dos encuestas tiene respuestas completadas para esta pregunta todavía.
            </div>
          ) : (
            <div style={box}>
              <div style={{ height: 260, marginBottom: 20 }}><canvas ref={chartRef} /></div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--ink3)', fontSize: 11, textTransform: 'uppercase' }}>Opción</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ink3)', fontSize: 11, textTransform: 'uppercase' }}>{encA.nombre}</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ink3)', fontSize: 11, textTransform: 'uppercase' }}>{encB.nombre}</th>
                    <th style={{ textAlign: 'right', padding: '6px 8px', color: 'var(--ink3)', fontSize: 11, textTransform: 'uppercase' }}>Diferencia</th>
                    <th style={{ textAlign: 'center', padding: '6px 8px', color: 'var(--ink3)', fontSize: 11, textTransform: 'uppercase' }}>Significativa</th>
                  </tr>
                </thead>
                <tbody>
                  {filasComparacion.map(f => (
                    <tr key={f.opcion} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px' }}>{f.opcion}</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.nA} ({f.pctA}%)</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{f.nB} ({f.pctB}%)</td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: !f.significativa ? 'var(--ink3)' : f.diff > 0 ? 'var(--accent2)' : 'var(--danger)' }}>
                        {!f.significativa ? '→' : f.diff > 0 ? '↑' : '↓'} {f.diff > 0 ? '+' : ''}{f.diff}pp
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', fontSize: 12, color: f.significativa ? 'inherit' : 'var(--ink3)' }}>
                        {f.significativa ? '✅' : '⚠️ dentro del margen'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 11.5, color: 'var(--ink2)', marginTop: 10 }}>
                n A = {filasComparacion[0].totalA} ({margenFormateado(filasComparacion[0].totalA)}) · n B = {filasComparacion[0].totalB} ({margenFormateado(filasComparacion[0].totalB)}).
                Significativa = la diferencia supera la suma de los márgenes de error de ambas encuestas.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
