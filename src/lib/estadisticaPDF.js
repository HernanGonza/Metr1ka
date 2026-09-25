// Fragmentos HTML/SVG de los elementos estadísticos para los PDFs (ME,
// chi-cuadrado, indecisión, correlación, tendencia). Estilos inline: cada
// PDF arma su propio <style> y estos bloques tienen que verse igual en
// todos sin tocar esos CSS.
//
// Criterio visual: todo lo técnico va en un bloque gris claro al pie de su
// sección, diferenciado del contenido principal, para que el lector no
// técnico pueda salteárselo.

import { margenError, margenFormateado, nivelMuestra } from './margenError'
import { formatearP, interpretarChi2 } from './chiCuadrado'
import { ETIQUETAS_GESTION } from './correlacion'

const ESTILO_BLOQUE = 'background:#f3f4f6;border-radius:6px;padding:8px 12px;margin:4px 0 18px;font-size:10.5px;color:#555;line-height:1.55'

export function bloqueEstadisticoHTML(contenido) {
  return `<div style="${ESTILO_BLOQUE}">${contenido}</div>`
}

// Línea para el encabezado de cada reporte, debajo del título.
export function encabezadoMuestraHTML(n) {
  if (!n) return ''
  const nivel = nivelMuestra(n)
  return `<div style="font-size:12px;color:#444;margin-top:6px">
    <b>n = ${n}</b> completadas · Margen de error: <b>${margenFormateado(n)}</b> · Nivel de confianza: 95%
    <span style="display:inline-block;margin-left:6px;padding:1px 8px;border-radius:100px;font-size:10px;font-weight:700;background:${nivel.color}22;color:#333;border:1px solid ${nivel.color}">Muestra ${nivel.label.toLowerCase()}</span>
  </div>`
}

// Pie de sección: ME general sobre `n` respuestas de esa sección.
export function pieMargenHTML(n, etiqueta = 'Margen de error general') {
  if (!n) return ''
  return bloqueEstadisticoHTML(`${etiqueta}: <b>${margenFormateado(n)}</b> (n = ${n}, 95% de confianza).`)
}


// Explicación del margen de error para el lector NO técnico: sin fórmulas,
// con los números reales de esta encuesta. Va debajo del encabezado de los
// PDFs (reemplazó a la tabla técnica de umbrales que iba al pie).
const fmt = v => v.toFixed(1).replace('.', ',')

export function explicacionMargenHTML(n) {
  const me = margenError(n)
  if (me == null) return ''
  const mePct = me * 100
  const ejemplo = 40
  const referencias = [100, 400, 600, 1000]
    .map(k => `${k.toLocaleString('es-AR')} personas → ±${fmt(margenError(k) * 100)}%`)
    .join(' · ')
  return `<div style="background:#f0f9f4;border:1px solid #b7e4c7;border-radius:8px;padding:12px 16px;margin:0 0 22px;font-size:11.5px;color:#1f3d2b;line-height:1.6;page-break-inside:avoid">
    <div style="font-size:12.5px;font-weight:800;color:#1a472a;margin-bottom:4px">¿Qué significa el margen de error de ±${fmt(mePct)}%?</div>
    <div>Esta encuesta le preguntó a <b>${n.toLocaleString('es-AR')} personas</b>, no a todo el municipio. Por eso los resultados son una muy buena aproximación, pero no exacta: el margen de error indica <b>cuánto puede estar corrido</b> cada porcentaje respecto de lo que piensa la totalidad.</div>
    <div style="margin-top:6px"><b>Ejemplo:</b> si un candidato tiene <b>${ejemplo}%</b>, su apoyo real está, casi con seguridad, <b>entre ${fmt(Math.max(0, ejemplo - mePct))}% y ${fmt(ejemplo + mePct)}%</b>.
      “Casi con seguridad” quiere decir que si hiciéramos esta misma encuesta 100 veces, en 95 el valor real caería dentro de ese rango.</div>
    <div style="margin-top:6px"><b>Para comparar candidatos:</b> si dos están separados por <b>menos de ${fmt(mePct * 2)} puntos</b> (el doble del margen), no se puede asegurar quién va adelante: es un empate técnico.</div>
    <div style="margin-top:6px"><b>¿De qué depende?</b> Solamente de cuántas personas respondieron: cuantas más, más chico el margen (${referencias}).</div>
  </div>`
}

export function margenOpcion(n, pct) {
  const me = margenError(n, pct / 100)
  return me != null ? `±${(me * 100).toFixed(1)}` : '—'
}

// ── Chi-cuadrado ──
export function chiCuadradoHTML(res) {
  const interp = interpretarChi2(res)
  if (!interp) return ''
  if (interp.estado === 'insuficiente') return bloqueEstadisticoHTML(`<b>Test chi-cuadrado:</b> ${interp.texto}`)
  return bloqueEstadisticoHTML(`<b>Test chi-cuadrado:</b> χ² = ${res.chi2.toFixed(2)} · gl = ${res.gl} · ${formatearP(res.p)} (n = ${res.n}).<br>${interp.texto}${
    interp.advertencia ? `<br><span style="color:#b45309">⚠ ${interp.advertencia}</span>` : ''}`)
}

// ── Indecisión ──
export function indecisionHTML(indices) {
  if (!indices?.length) return ''
  return indices.map(ix => `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:13px">
    <div style="width:110px;font-weight:600">${ix.cargo}</div>
    <div>Voto no definido: <b style="color:${ix.nivel.color}">${ix.pct}%</b> — ${ix.nivel.label.toLowerCase()}</div>
  </div>`).join('') + bloqueEstadisticoHTML(`Índice de indecisión = suma de ${
    [...new Set(indices.flatMap(i => i.opciones))].map(o => `"${o}"`).join(', ') || 'opciones de no definición'
  }. Referencia: &lt; 15% consolidado · 15–30% abierto · &gt; 30% alta volatilidad.`)
}

// ── Correlación gestión × voto, con scatter SVG simple ──
export function scatterCorrelacionSVG(corr) {
  const w = 420, h = 200, padL = 40, padB = 34, padT = 14, padR = 16
  const puntos = corr.puntos.filter(p => p.pct != null)
  const x = nivel => padL + ((nivel - 1) / 4) * (w - padL - padR)
  const y = pct => padT + (1 - pct / 100) * (h - padT - padB)
  const maxN = Math.max(1, ...puntos.map(p => p.n))
  const guias = [0, 25, 50, 75, 100].map(v => `<line x1="${padL}" y1="${y(v)}" x2="${w - padR}" y2="${y(v)}" stroke="#eee"/>
    <text x="${padL - 6}" y="${y(v) + 3}" font-size="8" fill="#aaa" text-anchor="end">${v}%</text>`).join('')
  const ejeX = [1, 2, 3, 4, 5].map(nv => `<text x="${x(nv)}" y="${h - padB + 14}" font-size="9" fill="#888" text-anchor="middle">${ETIQUETAS_GESTION[nv]}</text>`).join('')
  const linea = puntos.length > 1 ? `<polyline points="${puntos.map(p => `${x(p.nivel)},${y(p.pct)}`).join(' ')}" fill="none" stroke="#52B788" stroke-width="1.5" stroke-dasharray="4 3"/>` : ''
  const circulos = puntos.map(p => `<circle cx="${x(p.nivel)}" cy="${y(p.pct)}" r="${(4 + 8 * Math.sqrt(p.n / maxN)).toFixed(1)}" fill="#1a472a" fill-opacity="0.75"/>
    <text x="${x(p.nivel)}" y="${y(p.pct) - 12}" font-size="9" fill="#333" text-anchor="middle">${p.pct}%</text>`).join('')
  return `<svg width="${w}" height="${h}" style="margin:6px 0 4px">${guias}${ejeX}${linea}${circulos}
    <text x="${padL}" y="${h - 4}" font-size="9" fill="#888">Evaluación de gestión → % que vota a ${corr.oficialista.candidato} (tamaño = cantidad de casos)</text>
  </svg>`
}

export function correlacionHTML(corr) {
  if (!corr) return ''
  const { oficialista } = corr
  return `<div style="font-size:13px;margin-bottom:6px">Correlación evaluación–voto (${oficialista.candidato}): <b>r = ${oficialista.r.toFixed(2)}</b> (${oficialista.fuerza})</div>
    ${scatterCorrelacionSVG(corr)}
    ${bloqueEstadisticoHTML(`Pearson sesión por sesión entre la evaluación de gestión (Muy buena = 5 … Muy mala = 1) y el voto a cada candidato (1/0), n = ${corr.n}.
      Se toma como oficialista al candidato con mayor r. Otros: ${corr.porCandidato.slice(1).map(c => `${c.candidato} r = ${c.r.toFixed(2)}`).join(' · ') || '—'}.
      Referencia: |r| &lt; 0.2 débil · 0.2–0.4 moderada · &gt; 0.4 fuerte.`)}`
}

// ── Tendencia vs encuesta anterior ──
const FLECHA = {
  sube:  { simbolo: '↑', color: '#2d8f4e' },
  baja:  { simbolo: '↓', color: '#c0392b' },
  igual: { simbolo: '→', color: '#999' },
}

export function tendenciaHTML(tendencia) {
  if (!tendencia?.secciones?.length) return ''
  const { encuestaAnterior, secciones } = tendencia
  const tablas = secciones.map(s => {
    const filas = s.filas.map((f, i) => {
      const fl = FLECHA[f.tendencia]
      return `<tr style="background:${i % 2 === 0 ? '#fff' : '#fafaf8'}">
        <td>${f.opcion}</td><td style="text-align:right">${f.pctAnterior}%</td><td style="text-align:right">${f.pctActual}%</td>
        <td style="text-align:right;color:${fl.color};font-weight:700">${fl.simbolo} ${f.diff > 0 ? '+' : ''}${f.diff}pp</td>
        <td style="text-align:center">${f.significativa ? '✅' : '⚠️ dentro del margen'}</td>
      </tr>`
    }).join('')
    return `<div style="font-size:12px;font-weight:700;color:#555;margin:12px 0 6px">${s.titulo}</div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px">
        <thead><tr style="background:#f3f4f6"><th style="text-align:left">Opción</th><th style="text-align:right">Anterior (%)</th><th style="text-align:right">Actual (%)</th><th style="text-align:right">Variación</th><th style="text-align:center">Significativa</th></tr></thead>
        <tbody>${filas}</tbody>
      </table>
      ${bloqueEstadisticoHTML(`n anterior = ${s.nAnterior} (${margenFormateado(s.nAnterior)}) · n actual = ${s.nActual} (${margenFormateado(s.nActual)}). Una variación es significativa cuando supera la suma de los márgenes de error de ambas encuestas.`)}`
  }).join('')
  const fecha = encuestaAnterior.creado_en ? ` (${new Date(encuestaAnterior.creado_en).toLocaleDateString('es-AR')})` : ''
  return `<div style="font-size:12px;color:#555;margin-bottom:6px">Comparado con: <b>${encuestaAnterior.nombre}</b>${fecha}</div>${tablas}`
}
