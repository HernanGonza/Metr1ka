import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from 'chart.js'
import { margenError, margenFormateado, nivelMuestra, METAS_ME, UMBRALES_MUESTRA } from '../lib/margenError'
import { formatearP, interpretarChi2 } from '../lib/chiCuadrado'
import { indicesIndecision } from '../lib/indecision'
import { correlacionGestionVoto, ETIQUETAS_GESTION } from '../lib/correlacion'
import { compararConAnterior } from '../lib/tendencia'
import { leerOverrides } from '../lib/reportesAutomaticos'
import { curvaSaturacion, cargosCandidato } from '../lib/competitividad'
import { useEncuestaAnterior } from '../hooks/useRespuestasCrudas'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend)

// Paneles estadísticos en pantalla (margen de error, chi-cuadrado,
// indecisión, correlación gestión × voto, tendencia vs encuesta anterior).
// Las versiones para PDF de los mismos elementos están en
// src/lib/estadisticaPDF.js; los cálculos, en src/lib/{margenError,
// chiCuadrado,indecision,correlacion,tendencia}.js.

const caja = { background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: '14px 18px' }
const tituloCaja = { fontSize: 12, fontWeight: 700, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }

// Bloque gris para lo técnico — el lector no técnico puede salteárselo.
export function BloqueEstadistico({ children, style }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 11.5, color: 'var(--ink2)', lineHeight: 1.55, ...style }}>
      {children}
    </div>
  )
}

export function LeyendaUmbrales() {
  return (
    <BloqueEstadistico>
      <b>Referencia de tamaños de muestra</b> (95% de confianza)
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', columnGap: 12, rowGap: 2, marginTop: 4 }}>
        {UMBRALES_MUESTRA.map(u => (
          <FragmentoUmbral key={u.desde} u={u} />
        ))}
      </div>
    </BloqueEstadistico>
  )
}

function FragmentoUmbral({ u }) {
  return (
    <>
      <span style={{ fontFamily: 'var(--font-num)', fontVariantNumeric: 'tabular-nums' }}>n {u.desde === 0 ? '< 100' : `≥ ${u.desde}`}</span>
      <span style={{ fontFamily: 'var(--font-num)' }}>{u.rango}</span>
      <span>{u.texto}</span>
    </>
  )
}

// Panel del Resumen: n + ME general + progreso hacia ±5% / ±4% / ±3%.
export function PanelMargenError({ n }) {
  const me = margenError(n)
  const nivel = nivelMuestra(n || 0)
  const nMax = METAS_ME[METAS_ME.length - 1].n
  const avance = Math.min(100, ((n || 0) / nMax) * 100)
  const proxima = METAS_ME.find(m => (n || 0) < m.n)

  return (
    <div style={caja}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 14 }}>
        <span><b style={{ fontFamily: 'var(--font-num)' }}>n = {n || 0}</b> completadas</span>
        <span style={{ color: 'var(--ink3)' }}>·</span>
        <span>Margen de error: <b style={{ fontFamily: 'var(--font-num)' }}>{margenFormateado(n)}</b> <span style={{ color: 'var(--ink3)', fontSize: 12 }}>(95% confianza)</span></span>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 100, background: `${nivel.color}22`, border: `1px solid ${nivel.color}`, color: 'var(--ink)' }}>
          Muestra {nivel.label.toLowerCase()}
        </span>
      </div>

      <div style={{ position: 'relative', height: 10, background: 'var(--surface2)', borderRadius: 100, margin: '18px 0 26px' }}>
        <div style={{ width: `${avance}%`, height: '100%', background: nivel.color, borderRadius: 100, transition: 'width .3s' }} />
        {METAS_ME.map(m => {
          const x = (m.n / nMax) * 100
          const alcanzada = (n || 0) >= m.n
          return (
            <div key={m.me} style={{ position: 'absolute', left: `${x}%`, top: -4, transform: 'translateX(-50%)', textAlign: 'center' }}>
              <div style={{ width: 2, height: 18, background: alcanzada ? 'var(--accent)' : 'var(--ink3)', margin: '0 auto' }} />
              <div style={{ fontSize: 10, whiteSpace: 'nowrap', color: alcanzada ? 'var(--accent)' : 'var(--ink3)', fontWeight: 700, marginTop: 2 }}>
                ±{m.me * 100}% · n={m.n}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 10 }}>
        {me == null
          ? 'Todavía no hay suficientes respuestas para calcular el margen de error.'
          : proxima
            ? <>Faltan <b>{proxima.n - n}</b> completadas para llegar a ±{proxima.me * 100}%.</>
            : 'Se alcanzó la meta de alta precisión (±3%).'}
      </div>
      <LeyendaUmbrales />
    </div>
  )
}

// Resultado del test chi-cuadrado debajo de un cruce.
export function ResultadoChiCuadrado({ res }) {
  const interp = interpretarChi2(res)
  if (!interp) return null
  if (interp.estado === 'insuficiente') {
    return <BloqueEstadistico style={{ marginTop: 12 }}><b>Test chi-cuadrado:</b> {interp.texto}</BloqueEstadistico>
  }
  return (
    <BloqueEstadistico style={{ marginTop: 12 }}>
      <div><b>Test chi-cuadrado:</b> χ² = {res.chi2.toFixed(2)} · gl = {res.gl} · {formatearP(res.p)} · n = {res.n}</div>
      <div style={{ fontWeight: 600, color: interp.significativa ? 'var(--accent2)' : 'var(--ink2)' }}>{interp.texto}</div>
      {interp.advertencia && <div style={{ color: '#b45309' }}>⚠ {interp.advertencia}</div>}
    </BloqueEstadistico>
  )
}

function PanelIndecision({ indices }) {
  if (!indices.length) return null
  return (
    <div style={caja}>
      <div style={tituloCaja}>🗳️ Índice de indecisión</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
        {indices.map(ix => (
          <div key={ix.cargo} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 13 }}>
            <span style={{ width: 100, fontWeight: 600 }}>{ix.cargo}</span>
            <div style={{ flex: 1, minWidth: 120, height: 10, background: 'var(--surface2)', borderRadius: 100, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, ix.pct)}%`, height: '100%', background: ix.nivel.color }} />
            </div>
            <span>Voto no definido: <b style={{ color: ix.nivel.color, fontFamily: 'var(--font-num)' }}>{ix.pct}%</b> — {ix.nivel.label.toLowerCase()}</span>
          </div>
        ))}
      </div>
      <BloqueEstadistico>
        Suma de: {[...new Set(indices.flatMap(i => i.opciones))].join(', ') || 'opciones de no definición'}.
        Referencia: &lt; 15% consolidado · 15–30% abierto · &gt; 30% alta volatilidad.
      </BloqueEstadistico>
    </div>
  )
}

function PanelCorrelacion({ corr }) {
  if (!corr) return null
  const { oficialista, puntos } = corr
  return (
    <div style={caja}>
      <div style={tituloCaja}>📈 Evaluación de gestión × intención de voto</div>
      <div style={{ fontSize: 14, marginBottom: 12 }}>
        Correlación evaluación–voto ({oficialista.candidato}): <b style={{ fontFamily: 'var(--font-num)' }}>r = {oficialista.r.toFixed(2)}</b> ({oficialista.fuerza})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${puntos.length}, 1fr)`, gap: 8, marginBottom: 12 }}>
        {puntos.map(p => (
          <div key={p.nivel} style={{ textAlign: 'center' }}>
            <div style={{ height: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
              <div style={{ width: 22, height: `${p.pct ?? 0}%`, background: 'var(--accent)', borderRadius: '4px 4px 0 0', opacity: p.n ? 1 : 0.2 }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-num)' }}>{p.pct != null ? `${p.pct}%` : '—'}</div>
            <div style={{ fontSize: 10, color: 'var(--ink3)' }}>{ETIQUETAS_GESTION[p.nivel]} (n={p.n})</div>
          </div>
        ))}
      </div>
      <BloqueEstadistico>
        % que vota a {oficialista.candidato} según cómo evalúa la gestión. Pearson sesión por sesión (Muy buena = 5 … Muy mala = 1; voto 1/0), n = {corr.n}.
        Oficialista = candidato con mayor r. Otros: {corr.porCandidato.slice(1).map(c => `${c.candidato} r = ${c.r.toFixed(2)}`).join(' · ') || '—'}.
        Referencia: |r| &lt; 0.2 débil · 0.2–0.4 moderada · &gt; 0.4 fuerte.
      </BloqueEstadistico>
    </div>
  )
}

const FLECHAS = {
  sube:  { s: '↑', c: '#2d8f4e' },
  baja:  { s: '↓', c: 'var(--danger)' },
  igual: { s: '→', c: 'var(--ink3)' },
}

export function PanelTendencia({ tendencia }) {
  if (!tendencia?.secciones?.length) return null
  const { encuestaAnterior, secciones } = tendencia
  const th = { padding: '6px 10px', fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase' }
  const td = { padding: '7px 10px', fontSize: 13, fontVariantNumeric: 'tabular-nums' }
  return (
    <div style={caja}>
      <div style={tituloCaja}>🔁 Evolución respecto a encuesta anterior</div>
      <div style={{ fontSize: 12, color: 'var(--ink2)', marginBottom: 12 }}>
        Comparado con <b>{encuestaAnterior.nombre}</b>
        {encuestaAnterior.creado_en && ` (${new Date(encuestaAnterior.creado_en).toLocaleDateString('es-AR')})`}
      </div>
      {secciones.map(s => (
        <div key={s.claveBase} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>{s.titulo}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)' }}>
                  <th style={{ ...th, textAlign: 'left' }}>Opción</th>
                  <th style={{ ...th, textAlign: 'right' }}>Anterior (%)</th>
                  <th style={{ ...th, textAlign: 'right' }}>Actual (%)</th>
                  <th style={{ ...th, textAlign: 'right' }}>Variación</th>
                  <th style={{ ...th, textAlign: 'center' }}>Significativa</th>
                </tr>
              </thead>
              <tbody>
                {s.filas.map(f => {
                  const fl = FLECHAS[f.tendencia]
                  return (
                    <tr key={f.opcion} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={td}>{f.opcion}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{f.pctAnterior}%</td>
                      <td style={{ ...td, textAlign: 'right' }}>{f.pctActual}%</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: fl.c }}>{fl.s} {f.diff > 0 ? '+' : ''}{f.diff}pp</td>
                      <td style={{ ...td, textAlign: 'center', fontSize: 12, color: f.significativa ? 'inherit' : 'var(--ink3)' }}>{f.significativa ? '✅' : '⚠️ dentro del margen'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <BloqueEstadistico style={{ marginTop: 6 }}>
            n anterior = {s.nAnterior} ({margenFormateado(s.nAnterior)}) · n actual = {s.nActual} ({margenFormateado(s.nActual)}).
            Significativa = la variación supera la suma de los márgenes de error de ambas encuestas.
          </BloqueEstadistico>
        </div>
      ))}
    </div>
  )
}

// ── 14. Competitividad electoral ──
export function PanelCompetitividad({ comp }) {
  if (!comp) return null
  return (
    <div style={{ ...caja, display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', borderTop: `3px solid ${comp.nivel.color}` }}>
      <div>
        <div style={tituloCaja}>Competitividad electoral — {comp.cargo}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: 'var(--font-num)', fontSize: 34, fontWeight: 600, color: comp.nivel.color }}>{comp.diff}pp</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{comp.nivel.emoji} {comp.nivel.label}</span>
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--ink2)' }}>
        1° <b>{comp.primero.nombre}</b> {comp.primero.pct}% · 2° <b>{comp.segundo.nombre}</b> {comp.segundo.pct}%
        <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>Sobre {comp.totalValidos} votos válidos (sin NS/NC, blanco ni ninguno)</div>
      </div>
    </div>
  )
}

// ── 15. Proyección con intervalo ──
export function PanelProyeccion({ proy }) {
  if (!proy) return null
  return (
    <div style={caja}>
      <div style={tituloCaja}>🎯 Proyección — {proy.cargo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {proy.candidatos.map(c => (
          <div key={c.nombre}>
            <div style={{ fontSize: 14 }}>
              <b>{c.nombre}</b>: <span style={{ fontFamily: 'var(--font-num)' }}>{c.pct}%</span>
              <span style={{ color: 'var(--ink3)' }}> · intervalo probable {c.lo}%–{c.hi}%</span>
            </div>
            <div style={{ position: 'relative', height: 8, background: 'var(--surface2)', borderRadius: 100, marginTop: 4 }}>
              <div style={{ position: 'absolute', left: `${c.lo}%`, width: `${Math.max(0.5, c.hi - c.lo)}%`, top: 0, bottom: 0, background: '#52B78866', borderRadius: 100 }} />
              <div style={{ position: 'absolute', left: `${c.pct}%`, top: -3, width: 3, height: 14, background: 'var(--accent)', transform: 'translateX(-50%)', borderRadius: 2 }} />
            </div>
          </div>
        ))}
      </div>
      <BloqueEstadistico>
        n = {proy.n}. Intervalo al 95% con el margen de error específico de cada candidato.
        La proyección asume que las encuestas restantes tendrán distribución similar a las ya completadas. No incorpora sesgos de selección ni variación temporal.
      </BloqueEstadistico>
    </div>
  )
}

// ── 8. Curva de saturación ──
export function PanelCurvaSaturacion({ curva }) {
  if (!curva) return null
  const labels = curva.puntos.map(p => p.k)
  const lineaFija = (valor, label) => ({
    label, data: labels.map(() => valor), borderColor: '#9ca3af', borderDash: [5, 4], borderWidth: 1.2, pointRadius: 0, fill: false,
  })
  const data = {
    labels,
    datasets: [
      { label: `% ${curva.lider}`, data: curva.puntos.map(p => Math.round(p.pct * 10) / 10), borderColor: '#1a472a', backgroundColor: '#1a472a', borderWidth: 2, pointRadius: 0, tension: 0.15 },
      lineaFija(Math.max(0, curva.pctFinal - curva.me), `IC inferior (${Math.max(0, curva.pctFinal - curva.me).toFixed(1)}%)`),
      lineaFija(Math.min(100, curva.pctFinal + curva.me), `IC superior (${Math.min(100, curva.pctFinal + curva.me).toFixed(1)}%)`),
    ],
  }
  const opciones = {
    responsive: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom', labels: { font: { family: 'DM Sans', size: 11 }, boxWidth: 12 } },
      tooltip: { callbacks: { title: items => `${items[0].label} encuestas`, label: c => ` ${c.dataset.label}: ${c.parsed.y}%` } },
    },
    scales: {
      x: { title: { display: true, text: 'Encuestas acumuladas', font: { size: 11 } }, ticks: { maxTicksLimit: 10, font: { size: 10 } }, grid: { display: false } },
      y: { title: { display: true, text: `% ${curva.lider}`, font: { size: 11 } }, ticks: { callback: v => `${v}%`, font: { size: 10 } } },
    },
  }
  const badge = curva.estable
    ? { txt: 'Resultado estable', bg: '#d8f3dc', c: '#1a472a' }
    : { txt: 'Resultado en movimiento', bg: '#ffedd5', c: '#c2410c' }
  return (
    <div style={caja}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <div style={{ ...tituloCaja, marginBottom: 0 }}>📉 Curva de saturación — {curva.lider} ({curva.cargo})</div>
        <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 100, background: badge.bg, color: badge.c }}>{badge.txt}</span>
      </div>
      <div style={{ height: 260 }}><Line data={data} options={opciones} /></div>
      <BloqueEstadistico style={{ marginTop: 10 }}>
        % acumulado del candidato líder a medida que entraban encuestas (orden cronológico). Líneas punteadas: intervalo de confianza actual ({curva.pctFinal}% ±{curva.me}pp, n = {curva.n}).
        Variación en las últimas {curva.ventana} encuestas: {curva.variacion}pp — se considera estable por debajo de {curva.umbral}pp.
      </BloqueEstadistico>
    </div>
  )
}

// Sección estadística del tab Resumen (debajo de los gráficos). `crudo`
// viene de useRespuestasCrudas en EncuestaDetalle.
export function EstadisticasResumen({ encuesta, preguntas, crudo, cargando }) {
  const anterior = useEncuestaAnterior(encuesta)
  const estadisticas = useMemo(() => {
    if (!crudo) return null
    const ctx = { preguntas, crudo, overrides: leerOverrides(encuesta?.id) }
    const secciones = anterior ? compararConAnterior({ preguntas, crudo }, anterior) : []
    return {
      indecision: indicesIndecision(ctx),
      correlacion: correlacionGestionVoto(ctx),
      curvas: cargosCandidato(ctx).map(c => curvaSaturacion(ctx, c.clave)).filter(Boolean),
      tendencia: secciones.length ? { encuestaAnterior: anterior.encuesta, secciones } : null,
    }
  }, [crudo, anterior, preguntas, encuesta?.id])

  if (cargando && !estadisticas) {
    return <div style={{ fontSize: 12, color: 'var(--ink3)', padding: '4px 2px' }}>Calculando indicadores estadísticos…</div>
  }
  if (!estadisticas) return null
  return (
    <>
      {estadisticas.curvas.map(c => <PanelCurvaSaturacion key={c.cargo} curva={c} />)}
      <PanelIndecision indices={estadisticas.indecision} />
      <PanelCorrelacion corr={estadisticas.correlacion} />
      <PanelTendencia tendencia={estadisticas.tendencia} />
    </>
  )
}
