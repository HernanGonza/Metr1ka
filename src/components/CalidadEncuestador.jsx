import { useState, useEffect, useRef } from 'react'
import { Scatter, Bar } from 'react-chartjs-2'
import { Chart as ChartJS, LinearScale, CategoryScale, PointElement, LineElement, BarElement, Tooltip, Legend } from 'chart.js'
import {
  colorScore, desgloseTexto, histogramaHoras, COLORES_FRANJA, nivelAlertaMismoLugar, textoAlertaMismoLugar,
  MISMO_LUGAR_M, VENTANA_MIN, FRACCION_EXPRES, RECHAZO_MAX, GPS_MIN_M, GPS_OK_M, RITMO_MIN, RITMO_OK, PAUSA_MIN,
} from '../lib/calidadEncuestador'

ChartJS.register(LinearScale, CategoryScale, PointElement, LineElement, BarElement, Tooltip, Legend)

// Score de calidad (0–100) con semáforo; al pasar el mouse muestra el
// desglose de los 4 indicadores (ver lib/calidadEncuestador.js).
export function ScoreCalidad({ score }) {
  const [hover, setHover] = useState(false)
  if (!score || score.total == null) return <span style={{ color: 'var(--ink3)', fontSize: 12 }}>n/d</span>
  const color = colorScore(score.total)
  return (
    <span style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <span style={{ fontFamily: 'var(--font-num)', fontWeight: 700, fontSize: 13, color, background: `${color}18`, border: `1px solid ${color}55`, borderRadius: 100, padding: '2px 9px', cursor: 'help', whiteSpace: 'nowrap' }}>
        {score.total}/100
      </span>
      {hover && (
        <span style={{
          position: 'absolute', right: 0, top: '130%', zIndex: 20, background: 'var(--paper)', border: '1px solid var(--border)',
          borderRadius: 'var(--r)', boxShadow: '0 6px 20px rgba(0,0,0,.12)', padding: '10px 12px', width: 290, textAlign: 'left',
          fontSize: 12, fontWeight: 400, color: 'var(--ink2)', lineHeight: 1.6, whiteSpace: 'normal',
        }}>
          {desgloseTexto(score).map(t => <div key={t}>{t}</div>)}
        </span>
      )}
    </span>
  )
}

// Badge de alerta "mismo lugar en poco tiempo" para la tabla.
export function AlertaMismoLugar({ trayecto }) {
  const nivel = nivelAlertaMismoLugar(trayecto)
  if (!trayecto) return <span style={{ color: 'var(--ink3)', fontSize: 12 }}>…</span>
  if (!nivel) return <span style={{ color: 'var(--ink3)', fontSize: 12 }}>—</span>
  return (
    <span title={`Cargada rápido = duró menos de ${trayecto.umbralExpresMin} min (40% de lo normal) a menos de ${MISMO_LUGAR_M} m de otra sesión del encuestador (±${VENTANA_MIN} min). Superpuesta = empezó antes de que terminara la anterior.`}
      style={{ fontSize: 12, fontWeight: 700, color: nivel.color, background: `${nivel.color}15`, border: `1px solid ${nivel.color}55`, borderRadius: 100, padding: '2px 9px', whiteSpace: 'nowrap', cursor: 'help' }}>
      ⚠ {textoAlertaMismoLugar(trayecto)}
    </span>
  )
}

const ROJO = '#dc2626'

// Líneas de detalle de una sesión (tooltip del gráfico y del mapa).
function detallePunto(p) {
  const r = n => Math.round(n)
  return [
    `#${p.idx} · terminó ${p.hora}${p.completada ? '' : ' · no respuesta'}`,
    ...(p.duracion != null ? [`duró ${p.duracion < 1 ? `${r(p.duracion * 60)} s` : `${r(p.duracion)} min`}${p.duracionEstimada ? ' (aprox.)' : p.duracionExacta ? '' : ' (± desfase de reloj)'}`] : []),
    ...(p.desdeAnterior != null ? [`${p.desdeAnterior < 0 ? `empezó ${r(-p.desdeAnterior)} min ANTES de terminar la anterior` : `empezó ${r(p.desdeAnterior)} min después de la anterior`}`] : []),
    ...(p.distPrev != null ? [`a ${r(p.distPrev)} m de la anterior`] : []),
    ...(p.sospechosa ? ['⚠ carga rápida en el mismo lugar'] : []),
    ...(p.superpuesta ? ['⚠ superpuesta con la anterior'] : []),
  ]
}

// Mapa Leaflet con los puntos del encuestador (color por franja, rojo =
// "mismo lugar"), unidos en orden cronológico. Se usa chico dentro del
// detalle y grande en el modal de pantalla completa.
function MapaTrayecto({ puntos, alto }) {
  const divRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    let cancelado = false
    let ro = null
    ;(async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')
      if (cancelado || !divRef.current) return
      const init = () => {
        if (mapRef.current || !divRef.current) return
        const r = divRef.current.getBoundingClientRect()
        if (!r.width || !r.height) return
        const mapa = L.map(divRef.current, { zoomControl: true, preferCanvas: true })
        mapRef.current = mapa
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19 }).addTo(mapa)
        const latlngs = puntos.map(p => [p.lat, p.lng])
        if (latlngs.length > 1) L.polyline(latlngs, { color: '#374151', weight: 1.5, opacity: 0.5, dashArray: '4 4' }).addTo(mapa)
        puntos.forEach(p => {
          L.circleMarker([p.lat, p.lng], {
            radius: p.sospechosa || p.superpuesta ? 7 : 5, weight: p.sospechosa || p.superpuesta ? 2.5 : 1,
            color: p.superpuesta ? '#7c3aed' : p.sospechosa ? ROJO : '#fff',
            fillColor: p.sospechosa ? ROJO : COLORES_FRANJA[p.franja], fillOpacity: p.completada ? 0.9 : 0.35,
          }).bindTooltip(detallePunto(p).join('<br>')).addTo(mapa)
        })
        if (latlngs.length) mapa.fitBounds(L.latLngBounds(latlngs), { padding: [20, 20], maxZoom: 18 })
        ro?.disconnect()
      }
      ro = new ResizeObserver(init)
      ro.observe(divRef.current)
      init()
    })()
    return () => { cancelado = true; ro?.disconnect(); mapRef.current?.remove(); mapRef.current = null }
  }, [puntos])

  return <div ref={divRef} style={{ height: alto, width: '100%', borderRadius: 'var(--r)', overflow: 'hidden' }} />
}

function ModalPantallaCompleta({ titulo, onClose, children }) {
  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,.55)', display: 'flex', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ flex: 1, background: 'var(--paper)', borderRadius: 'var(--r2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <b style={{ fontSize: 14 }}>{titulo}</b>
          <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ink3)' }}>✕</button>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      </div>
    </div>
  )
}

function Referencias() {
  const chip = (color, label, borde) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, border: borde ? `2px solid ${borde}` : 'none', display: 'inline-block' }} />{label}
    </span>
  )
  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: 'var(--ink2)' }}>
      {chip(COLORES_FRANJA.mañana, 'Mañana')}{chip(COLORES_FRANJA.tarde, 'Tarde')}{chip(COLORES_FRANJA.noche, 'Noche')}
      {chip(ROJO, 'Carga rápida en el mismo lugar')}
      {chip('#fff', 'Superpuesta con la anterior', '#7c3aed')}
      <span style={{ color: 'var(--ink3)' }}>Transparente = no respuesta · línea punteada = recorrido en orden</span>
    </div>
  )
}

// Detalle expandible: resumen + dispersión (en metros, escala real) +
// minimapa (con pantalla completa) + histograma horario. Grid auto-fit:
// lado a lado en desktop, apilados en mobile.
export function DetalleEncuestador({ nombre, sesiones, score }) {
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const tray = score?.trayecto
  const puntos = tray?.puntos || []
  const horas = histogramaHoras(sesiones)
  const primera = horas.findIndex(n => n > 0)
  const ultima = 23 - [...horas].reverse().findIndex(n => n > 0)
  const rango = primera < 0 ? [] : Array.from({ length: ultima - primera + 1 }, (_, i) => primera + i)

  // Ejes simétricos y con el mismo rango en X e Y (escala real: 100 m
  // horizontales = 100 m verticales), con el gráfico cuadrado.
  const extension = Math.max(20, ...puntos.map(p => Math.max(Math.abs(p.x), Math.abs(p.y)))) * 1.15
  const franjas = Object.entries(COLORES_FRANJA).map(([franja, color]) => ({
    label: franja[0].toUpperCase() + franja.slice(1),
    data: puntos.filter(p => p.franja === franja && !p.sospechosa),
    backgroundColor: puntos.length ? puntos.filter(p => p.franja === franja && !p.sospechosa).map(p => `${color}${p.completada ? 'dd' : '55'}`) : color,
    pointRadius: 4, pointHoverRadius: 7, order: 1,
  })).filter(d => d.data.length)
  const scatterData = {
    datasets: [
      { label: 'Recorrido', data: puntos, showLine: true, pointRadius: 0, borderColor: '#9ca3af', borderWidth: 1, borderDash: [3, 3], order: 3 },
      ...franjas,
      ...(tray?.superpuestas ? [{ label: 'Superpuesta', data: puntos.filter(p => p.superpuesta), backgroundColor: 'rgba(0,0,0,0)', borderColor: '#7c3aed', borderWidth: 2.5, pointRadius: 9, pointHoverRadius: 10, order: -1 }] : []),
      ...(tray?.sospechosas ? [{ label: 'Mismo lugar', data: puntos.filter(p => p.sospechosa), backgroundColor: ROJO, borderColor: '#7f1d1d', borderWidth: 1.5, pointRadius: 6, pointHoverRadius: 8, order: 0 }] : []),
    ],
  }
  const eje = titulo => ({
    min: -extension, max: extension,
    title: { display: true, text: titulo, font: { size: 10 } },
    ticks: { font: { size: 9 }, maxTicksLimit: 5, callback: v => `${Math.round(v)} m` },
    grid: { color: c => (c.tick?.value === 0 ? '#d1d5db' : '#f3f4f6') },
  })
  const scatterOpts = {
    responsive: true, maintainAspectRatio: true, aspectRatio: 1, animation: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        filter: i => i.dataset.label !== 'Recorrido',
        callbacks: {
          label: c => detallePunto(c.raw),
        },
      },
    },
    scales: { x: eje('metros (−) oeste / (+) este'), y: eje('metros (−) sur / (+) norte') },
  }
  const barData = {
    labels: rango.map(h => `${h}hs`),
    datasets: [{ label: 'Sesiones', data: rango.map(h => horas[h]), backgroundColor: '#52B788', borderRadius: 4 }],
  }
  const barOpts = {
    responsive: true, maintainAspectRatio: false, animation: false,
    plugins: { legend: { display: false } },
    scales: { x: { grid: { display: false }, ticks: { font: { size: 10 } } }, y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } } },
  }
  const card = { background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', padding: 12, minWidth: 0 }
  const tit = { fontSize: 12, fontWeight: 700, color: 'var(--ink3)', marginBottom: 6 }
  const nivel = nivelAlertaMismoLugar(tray)
  const ritmo = score?.indicadores?.ritmo?.valor

  return (
    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', fontSize: 13 }}>
        <span><b style={{ fontFamily: 'var(--font-num)' }}>{puntos.length}</b> sesiones con GPS</span>
        {score?.dispersionM != null && <span>Dispersión típica: <b style={{ fontFamily: 'var(--font-num)' }}>{Math.round(score.dispersionM)} m</b></span>}
        {ritmo && <span>Ritmo: <b>{ritmo}</b></span>}
        {nivel ? (
          <span style={{ fontWeight: 700, color: nivel.color, background: `${nivel.color}15`, borderRadius: 'var(--r)', padding: '4px 10px' }}>
            ⚠ {textoAlertaMismoLugar(tray)}
          </span>
        ) : puntos.length > 0 && <span style={{ color: 'var(--accent)', fontWeight: 600 }}>✓ Sin cargas rápidas en el mismo lugar</span>}
      </div>
      {tray && (
        <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
          Se marca una encuesta cuando duró menos de {tray.umbralExpresMin} min (40% de la duración normal, {tray.referenciaMin} min) y se hizo a menos de {MISMO_LUGAR_M} m de otra sesión suya en ±{VENTANA_MIN} min.
          Moverse o entrevistar a varios miembros de una familia con duración normal no se marca.
          {!tray.hayInicio && ' Este encuestador no tiene hora de inicio registrada (versión vieja de la app): la duración se aproxima con el tiempo desde su sesión anterior.'}
        </div>
      )}
      <Referencias />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
        <div style={card}>
          <div style={tit}>Dispersión (escala real, centrado en su punto medio)</div>
          {puntos.length ? <Scatter data={scatterData} options={scatterOpts} /> : <div style={{ fontSize: 12, color: 'var(--ink3)', padding: 20 }}>Sin sesiones con GPS.</div>}
        </div>
        <div style={card}>
          <div style={{ ...tit, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Mapa</span>
            {puntos.length > 0 && (
              <button onClick={() => setPantallaCompleta(true)} style={{ padding: '3px 9px', fontSize: 11, border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', background: 'var(--paper)', cursor: 'pointer', fontFamily: 'DM Sans' }}>
                ⛶ Pantalla completa
              </button>
            )}
          </div>
          {puntos.length ? <MapaTrayecto puntos={puntos} alto={280} /> : <div style={{ fontSize: 12, color: 'var(--ink3)', padding: 20 }}>Sin sesiones con GPS.</div>}
        </div>
        <div style={card}>
          <div style={tit}>Sesiones por hora del día</div>
          <div style={{ height: 280 }}>
            {rango.length ? <Bar data={barData} options={barOpts} /> : <div style={{ fontSize: 12, color: 'var(--ink3)', padding: 20 }}>Sin sesiones.</div>}
          </div>
        </div>
      </div>
      {pantallaCompleta && (
        <ModalPantallaCompleta titulo={`Recorrido de ${nombre || 'encuestador'}`} onClose={() => setPantallaCompleta(false)}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px' }}><Referencias /></div>
            <div style={{ flex: 1, minHeight: 0, padding: '0 16px 16px' }}><MapaTrayecto puntos={puntos} alto="100%" /></div>
          </div>
        </ModalPantallaCompleta>
      )}
    </div>
  )
}

// Explicación en texto de todos los indicadores del tab Encuestadores. Se
// arma con las mismas constantes de lib/calidadEncuestador.js para que el
// texto no quede desactualizado si cambian los umbrales. Se puede ocultar;
// la preferencia queda en localStorage (solo comodidad de este navegador).
const CLAVE_EXPLICACION = 'metr1ka:explicacionCalidadOculta'

export function ExplicacionCalidad() {
  const [oculta, setOculta] = useState(() => {
    try { return localStorage.getItem(CLAVE_EXPLICACION) === '1' } catch { return false }
  })
  function alternar() {
    setOculta(v => {
      try { localStorage.setItem(CLAVE_EXPLICACION, v ? '0' : '1') } catch { /* noop */ }
      return !v
    })
  }
  const h = { fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '14px 0 4px' }
  const pr = { fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.6, margin: '0 0 6px' }
  const li = { fontSize: 12.5, color: 'var(--ink2)', lineHeight: 1.6, marginBottom: 3 }
  const pct = Math.round(FRACCION_EXPRES * 100)
  return (
    <div style={{ background: 'var(--paper)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', borderLeft: '4px solid #52B788' }}>
      <button onClick={alternar} style={{
        width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>ℹ️ Cómo leer el control de calidad de encuestadores</span>
        <span style={{ fontSize: 12, color: 'var(--ink3)' }}>{oculta ? 'Mostrar ▼' : 'Ocultar ▲'}</span>
      </button>
      {!oculta && (
        <div style={{ padding: '0 18px 16px' }}>
          <p style={pr}>
            Todo lo de esta pestaña se calcula en el momento a partir de las sesiones guardadas; no se modifica ni se descarta ninguna encuesta.
            Son <b>señales para revisar</b>, no una prueba de trampa: antes de sacar conclusiones, mirá el detalle del encuestador (botón <b>📍 Ver detalle</b> al lado de su nombre).
          </p>

          <div style={h}>Score de calidad (0 a 100)</div>
          <p style={pr}>Suma cuatro indicadores de 25 puntos cada uno:</p>
          <ul style={{ margin: '0 0 6px 18px', padding: 0 }}>
            <li style={li}><b>Tasa de rechazo:</b> 0% de rechazo da 25 puntos; {RECHAZO_MAX}% o más da 0. En el medio es proporcional.</li>
            <li style={li}><b>Variedad de respuestas:</b> mide qué tan repartidas están sus respuestas a la pregunta de candidato. Si casi todos sus encuestados “eligen” lo mismo, puntúa bajo, porque puede indicar respuestas inventadas.</li>
            <li style={li}><b>Dispersión GPS:</b> qué tanto se movió. Si todas sus sesiones están a menos de {GPS_MIN_M} m de su punto medio, da 0; desde {GPS_OK_M} m, 25.</li>
            <li style={li}><b>Ritmo:</b> minutos promedio entre una encuesta completada y la siguiente. Menos de {RITMO_MIN} min da 0; {RITMO_OK} min o más, 25. Las pausas de más de {PAUSA_MIN} min (almuerzo, cambio de día) no cuentan.</li>
          </ul>
          <p style={pr}>
            Colores: <b style={{ color: '#16a34a' }}>70 o más, verde</b> · <b style={{ color: '#ca8a04' }}>40 a 69, amarillo</b> · <b style={{ color: '#dc2626' }}>menos de 40, rojo</b>.
            Si un indicador no se puede calcular (por ejemplo, sin GPS o sin pregunta de candidato), figura como “n/d” y el total se calcula con los que sí hay.
            Pasando el mouse sobre el número ves el desglose.
          </p>

          <div style={h}>Carga rápida en el mismo lugar</div>
          <p style={pr}>
            Busca al encuestador parado en un punto cargando encuestas sin hacerlas (“dándole al dedo”). Una encuesta completada se marca cuando se cumplen las dos cosas:
          </p>
          <ul style={{ margin: '0 0 6px 18px', padding: 0 }}>
            <li style={li}>duró <b>menos del {pct}% de lo normal</b> (la duración normal es la mediana de todas las encuestas completadas de esta encuesta), y</li>
            <li style={li}>se hizo a <b>menos de {MISMO_LUGAR_M} m</b> de otra sesión del mismo encuestador, dentro de <b>±{VENTANA_MIN} minutos</b>.</li>
          </ul>
          <p style={pr}>
            <b>No se marca</b>: el encuestador que hace encuestas cercanas pero se va moviendo (gente en la calle, casas vecinas), ni el que entrevista a
            varios miembros de una familia en la misma casa si cada entrevista dura lo normal.
          </p>
          <p style={pr}>
            En la columna <b>Carga rápida</b>: <b style={{ color: '#dc2626' }}>rojo</b> si más del 10% de sus completadas (o 5 o más) están marcadas;
            <b style={{ color: '#ca8a04' }}> amarillo</b> si hay algún caso aislado; “—” si no hay ninguno.
          </p>

          <div style={h}>Encuestas superpuestas</div>
          <p style={pr}>
            Una encuesta que empieza antes de que termine la anterior del mismo encuestador. Con un solo celular eso no puede pasar,
            así que si está medido con el reloj del celular (versión actual de la app) es <b style={{ color: '#dc2626' }}>alerta roja</b>: probablemente la misma cuenta se usó en dos teléfonos.
            En sesiones guardadas con versiones anteriores de la app, el fin lo registraba el servidor, y un reloj de celular desfasado
            o una encuesta guardada sin señal y sincronizada después también la producen. Por eso en esos casos es solo un <b style={{ color: '#ca8a04' }}>aviso amarillo</b>, con 2 minutos de tolerancia.
          </p>

          <div style={h}>Sesiones sin hora de inicio</div>
          <p style={pr}>
            Las versiones viejas de la app no registraban cuándo empezaba cada encuesta. En esas sesiones la duración no se puede medir y se aproxima
            con el tiempo desde la sesión anterior del encuestador (en el detalle aparece como “aprox.”).
          </p>

          <div style={h}>El detalle del encuestador</div>
          <ul style={{ margin: '0 0 6px 18px', padding: 0 }}>
            <li style={li}><b>Resumen:</b> cantidad de sesiones con GPS, dispersión típica, ritmo y, si corresponde, la alerta de carga rápida.</li>
            <li style={li}>
              <b>Gráfico de dispersión:</b> cada punto es una sesión, ubicada en metros alrededor del punto medio del encuestador (escala real: 100 m a lo ancho equivalen a 100 m a lo alto).
              La línea punteada une las sesiones en el orden en que se hicieron. Color por momento del día:
              <span style={{ color: COLORES_FRANJA.mañana, fontWeight: 700 }}> mañana</span>,
              <span style={{ color: COLORES_FRANJA.tarde, fontWeight: 700 }}> tarde</span>,
              <span style={{ color: COLORES_FRANJA.noche, fontWeight: 700 }}> noche</span>;
              <span style={{ color: '#dc2626', fontWeight: 700 }}> rojo</span> = carga rápida en el mismo lugar;
              <span style={{ color: '#7c3aed', fontWeight: 700 }}> aro violeta</span> = superpuesta; punto transparente = no respuesta.
              Pasando el mouse sobre un punto ves la hora, cuánto duró y a cuántos metros y minutos quedó de la anterior.
              Muchos puntos rojos amontonados son la señal típica de alguien parado en el mismo lugar.
            </li>
            <li style={li}><b>Mapa:</b> los mismos puntos y el recorrido sobre el mapa real. Con <b>⛶ Pantalla completa</b> se ve grande (se cierra con Esc).</li>
            <li style={li}><b>Sesiones por hora del día:</b> permite ver si trabajó con un ritmo parejo o en ráfagas cortas.</li>
          </ul>
        </div>
      )}
    </div>
  )
}
