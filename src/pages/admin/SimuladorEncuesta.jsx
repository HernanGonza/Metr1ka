import { useState, useEffect, useMemo, useCallback, memo } from 'react'
import { supabase } from '../../lib/supabase'

// ── Evalúa condicionales ──
function evaluarCondicionales(pregunta, respuesta) {
  const cond = pregunta?.condicionales
  if (!cond?.reglas?.length) return null
  const logica = cond.logica || 'OR'
  const matches = cond.reglas.map(r => r.respuesta && String(respuesta) === String(r.respuesta))
  const aplica = logica === 'AND' ? matches.every(Boolean) : matches.some(Boolean)
  if (!aplica) return null
  return cond.reglas[matches.findIndex(Boolean)] || null
}

const PreguntaScreen = memo(function PreguntaScreen({
  pregunta, total, indice, respuesta, onChange, onAnterior, onSiguiente, esPrimera, esUltima
}) {
  const opciones = useMemo(() =>
    [...(pregunta.opciones_pregunta || [])].sort((a, b) => a.orden - b.orden),
    [pregunta.opciones_pregunta]
  )
  const puedeAvanzar = !pregunta.requerida || (() => {
    if (pregunta.tipo === 'matriz') {
      // Todas las filas tienen respuesta
      const filas = pregunta.config_matriz?.filas || pregunta.filas || []
      return filas.length > 0 && filas.every((_, fi) => (respuesta || {})[fi] !== undefined)
    }
    return respuesta !== null && respuesta !== undefined && respuesta !== ''
  })()

  const btnOpcion = (activo) => ({
    display: 'block', width: '100%', padding: '14px 16px', marginBottom: 8,
    borderRadius: 12, textAlign: 'left', fontSize: 15, fontFamily: 'DM Sans',
    cursor: 'pointer',
    border: `2px solid ${activo ? 'var(--accent2)' : 'var(--border2)'}`,
    background: activo ? 'var(--accent-light)' : 'var(--surface)',
    color: activo ? 'var(--accent2)' : 'var(--ink)',
    fontWeight: activo ? 700 : 400, transition: 'all .15s',
  })

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 20px 0' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {pregunta.es_base ? '📌 Pregunta base' : `Pregunta ${indice} de ${total}`}
          {!pregunta.requerida && <span style={{ marginLeft: 8, color: '#bbb' }}>· Opcional</span>}
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4 }}>{pregunta.texto}</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
        {pregunta.tipo === 'si_no' && ['Sí', 'No'].map(op => (
          <button key={op} onClick={() => onChange(op)} style={btnOpcion(respuesta === op)}>{op}</button>
        ))}
        {pregunta.tipo === 'opcion_multiple' && opciones.map(op => (
          <button key={op.id} onClick={() => onChange(op.texto)} style={btnOpcion(respuesta === op.texto)}>{op.texto}</button>
        ))}
        {pregunta.tipo === 'escala' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => onChange(n)} style={{
                  padding: '14px 0', borderRadius: 10, fontSize: 16, fontWeight: 700,
                  fontFamily: 'DM Sans', cursor: 'pointer',
                  border: `2px solid ${respuesta === n ? 'var(--accent)' : 'var(--border2)'}`,
                  background: respuesta === n ? 'var(--accent)' : 'var(--surface)',
                  color: respuesta === n ? '#fff' : 'var(--ink)',
                }}>{n}</button>
              ))}
            </div>
            {respuesta && <div style={{ textAlign: 'center', fontSize: 13, color: '#1a472a', fontWeight: 600 }}>Seleccionaste: {respuesta}</div>}
          </div>
        )}
        {pregunta.tipo === 'texto_libre' && (
          <textarea value={respuesta || ''} onChange={e => onChange(e.target.value)}
            placeholder="Escribí tu respuesta..." rows={4}
            style={{ width: '100%', padding: '12px', border: '2px solid var(--border2)', borderRadius: 12, fontSize: 15, fontFamily: 'DM Sans', resize: 'none', boxSizing: 'border-box', outline: 'none', background: 'var(--surface)', color: 'var(--ink)' }}
          />
        )}
        {pregunta.tipo === 'matriz' && (() => {
          const filas    = (pregunta.config_matriz?.filas    || pregunta.filas    || []).map(f => typeof f === 'string' ? f : f.texto)
          const columnas = (pregunta.config_matriz?.columnas || pregunta.columnas || []).map(c => typeof c === 'string' ? c : c.texto)
          if (!filas.length || !columnas.length) return null
          const val = respuesta || {}
          const colW = Math.max(64, Math.floor(220 / columnas.length))
          return (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: filas.length > 0 ? `${colW * columnas.length + 180}px` : 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ width: 180, padding: '0 8px 10px 0', textAlign: 'left' }} />
                    {columnas.map((col, ci) => (
                      <th key={ci} style={{ width: colW, padding: '0 4px 10px', textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--ink3)', lineHeight: 1.3, borderBottom: '1.5px solid var(--border)' }}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((fila, fi) => (
                    <tr key={fi} style={{ background: fi % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                      <td style={{ padding: '10px 8px 10px 0', fontSize: 13, color: 'var(--ink)', lineHeight: 1.4, borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                        {fila}
                      </td>
                      {columnas.map((col, ci) => {
                        const activo = val[fi] === col
                        return (
                          <td key={ci} style={{ textAlign: 'center', borderBottom: '1px solid var(--border)', verticalAlign: 'middle', padding: '10px 4px' }}>
                            <button onClick={() => onChange({ ...val, [fi]: col })} style={{
                              width: 26, height: 26, borderRadius: '50%', cursor: 'pointer',
                              border: `2px solid ${activo ? '#1a472a' : 'var(--border2)'}`,
                              background: activo ? '#1a472a' : 'var(--surface)',
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              padding: 0,
                            }}>
                              {activo && <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>

      <div style={{ display: 'flex', gap: 10, padding: '16px 0 20px' }}>
        {!esPrimera && (
          <button onClick={onAnterior} style={{ flex: 1, padding: '13px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 12, fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink3)' }}>← Anterior</button>
        )}
        <button onClick={onSiguiente} disabled={!puedeAvanzar} style={{
          flex: 2, padding: '13px',
          background: puedeAvanzar ? '#1a472a' : 'var(--border2)',
          color: puedeAvanzar ? '#fff' : '#aaa',
          border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 700,
          cursor: puedeAvanzar ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans',
        }}>
          {esUltima ? '✓ Finalizar' : 'Siguiente →'}
        </button>
      </div>
    </div>
  )
})

export default function SimuladorEncuesta({ encuestaId, orgId, onClose }) {
  const [encuesta,         setEncuesta]         = useState(null)
  const [preguntas,        setPreguntas]        = useState([])
  const [razonesNR,        setRazonesNR]        = useState([])
  const [pantalla,         setPantalla]         = useState('inicio')
  const [paso,             setPaso]             = useState(0)
  const [respuestas,       setRespuestas]       = useState({})
  const [razonNR,          setRazonNR]          = useState('')
  const [noResponde,       setNoResponde]       = useState(false)
  const [loading,          setLoading]          = useState(true)
  const [preguntasOcultas, setPreguntasOcultas] = useState(new Set())

  useEffect(() => {
    let mounted = true
    async function load() {
      // get_encuesta_full — 1 sola conexión, evita timeout de RLS
      const { data } = await supabase.rpc('get_encuesta_full', {
        p_encuesta_id: encuestaId,
        p_org_id: orgId,
      })
      if (!mounted) return
      if (data && !data.error) {
        setEncuesta(data.encuesta)
        setPreguntas(data.preguntas || [])
      }

      // Cargar razones seleccionadas para esta encuesta
      if (orgId && data?.encuesta?.config_muestreo?.razones_seleccionadas?.length) {
        const ids = data.encuesta.config_muestreo.razones_seleccionadas
        const razonRes = await supabase
          .from('razones_no_respuesta')
          .select('id, label')
          .in('id', ids)
          .eq('activa', true)
        if (mounted && razonRes.data) {
          // Mantener el orden de selección
          const map = Object.fromEntries(razonRes.data.map(r => [r.id, r.label]))
          setRazonesNR(ids.map(id => map[id]).filter(Boolean))
        }
      } else if (orgId) {
        // Fallback: todas las razones de la org si no hay selección
        const razonRes = await supabase
          .from('razones_no_respuesta')
          .select('id, label')
          .or(`organizacion_id.eq.${orgId},organizacion_id.is.null`)
          .eq('activa', true)
          .order('orden')
        if (mounted && razonRes.data) setRazonesNR(razonRes.data.map(r => r.label))
      }

      if (mounted) setLoading(false)
    }
    load()
    return () => { mounted = false }
  }, [encuestaId, orgId])

  const preguntasEncuesta = useMemo(() =>
    preguntas.filter(p => p.clave_base !== 'participa'),
    [preguntas]
  )
  const preguntaParticipa = useMemo(() =>
    preguntas.find(p => p.clave_base === 'participa'),
    [preguntas]
  )
  const preguntaActual = preguntasEncuesta[paso]

  const totalNoBase = useMemo(() =>
    preguntasEncuesta.filter(p => !p.es_base).length,
    [preguntasEncuesta]
  )
  const indiceVisible = useMemo(() => {
    if (!preguntaActual) return null
    return preguntasEncuesta.findIndex(p => p.id === preguntaActual.id) + 1
  }, [preguntaActual, preguntasEncuesta])

  const handleRespuesta = useCallback((valor) => {
    setRespuestas(prev => ({ ...prev, [preguntaActual.id]: valor }))
  }, [preguntaActual])

  const handleSiguiente = useCallback(() => {
    const respuesta = respuestas[preguntaActual?.id]
    const resultado = evaluarCondicionales(preguntaActual, respuesta)

    if (resultado) {
      if (resultado.accion === 'finalizar') { setPantalla('fin'); return }
      if (resultado.accion === 'saltar' && resultado.destino_id) {
        const idx = preguntasEncuesta.findIndex(p => p.id === resultado.destino_id)
        if (idx >= 0) { setPaso(idx); return }
      }
      if (resultado.accion === 'ocultar' && resultado.destino_id) {
        setPreguntasOcultas(prev => new Set([...prev, resultado.destino_id]))
      }
    }

    let siguiente = paso + 1
    while (siguiente < preguntasEncuesta.length && preguntasOcultas.has(preguntasEncuesta[siguiente]?.id)) {
      siguiente++
    }
    if (siguiente < preguntasEncuesta.length) setPaso(siguiente)
    else setPantalla('fin')
  }, [paso, preguntasEncuesta, preguntaActual, respuestas, preguntasOcultas])

  const handleAnterior = useCallback(() => setPaso(p => Math.max(p - 1, 0)), [])

  const handleIniciar = useCallback(() => {
    preguntaParticipa ? setPantalla('participa') : setPantalla('encuesta')
  }, [preguntaParticipa])

  const progreso = preguntasEncuesta.length > 0
    ? ((paso + 1) / preguntasEncuesta.length) * 100 : 0

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', zIndex: 500, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase' }}>Vista previa · App Metr1ka</span>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.6)', borderRadius: 8, padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}>✕ Cerrar</button>
      </div>
      {/* Marco del teléfono */}
      <div style={{ width: 390, maxHeight: '90vh', background: '#111', borderRadius: 48, padding: '12px 6px 6px', boxShadow: '0 40px 100px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Notch/Dynamic Island */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 120, height: 30, background: '#000', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#222', border: '1.5px solid #333' }} />
            <div style={{ width: 50, height: 10, borderRadius: 10, background: '#1a1a1a', border: '1.5px solid #333' }} />
          </div>
        </div>
        {/* Pantalla */}
        <div style={{ background: 'var(--paper)', borderRadius: 38, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: 'calc(90vh - 60px)', border: '1px solid var(--border)' }}>

        <div style={{ background: '#1a472a', padding: '10px 20px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ color: '#d8f3dc', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>METR1KA</span>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', borderRadius: 100, padding: '3px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans', fontWeight: 600 }}>✕ Cerrar</button>
        </div>

        {pantalla === 'encuesta' && (
          <div style={{ height: 3, background: 'var(--border2)', flexShrink: 0 }}>
            <div style={{ height: '100%', background: '#1a472a', width: `${progreso}%`, transition: 'width 0.3s' }} />
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 32, height: 32, border: '3px solid #1a472a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>

          ) : pantalla === 'inicio' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '32px 24px', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#d8f3dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, marginBottom: 20 }}>📋</div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#1a472a', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>Encuesta</div>
              <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.3 }}>{encuesta?.nombre}</h2>
              {encuesta?.descripcion && <p style={{ fontSize: 13, color: 'var(--ink3)', margin: '0 0 24px', lineHeight: 1.6 }}>{encuesta.descripcion}</p>}
              <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 24 }}>
                {preguntasEncuesta.length} preguntas · ~{Math.ceil(preguntasEncuesta.length * 0.5)} min
              </div>
              <button onClick={handleIniciar} style={{ width: '100%', padding: '15px', background: '#1a472a', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans', marginBottom: 10 }}>
                Comenzar encuesta
              </button>
              <button onClick={onClose} style={{ width: '100%', padding: '13px', background: 'none', color: 'var(--ink3)', border: '1.5px solid var(--border2)', borderRadius: 14, fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                Cancelar
              </button>
            </div>

          ) : pantalla === 'participa' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '28px 20px' }}>
              <div style={{ fontSize: 11, color: 'var(--ink3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase' }}>📌 Pregunta base</div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.4, marginBottom: 24 }}>
                {preguntaParticipa?.texto}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {['Sí', 'No'].map(op => (
                  <button key={op} onClick={() => {
                    setRespuestas(r => ({ ...r, [preguntaParticipa.id]: op }))
                    if (op === 'No') {
                      // Siempre mostrar razones cuando no quiere participar
                      setPantalla('no_responde')
                    } else {
                      // Solo evaluar condicionales si respondió Sí
                      const resultado = evaluarCondicionales(preguntaParticipa, op)
                      if (resultado?.accion === 'saltar' && resultado.destino_id) {
                        const idx = preguntasEncuesta.findIndex(p => p.id === resultado.destino_id)
                        if (idx >= 0) { setPaso(idx); setPantalla('encuesta'); return }
                      }
                      setPaso(0); setPantalla('encuesta')
                    }
                  }} style={{
                    padding: '16px', borderRadius: 12, fontSize: 15, fontWeight: 600,
                    fontFamily: 'DM Sans', cursor: 'pointer',
                    border: '2px solid var(--border2)', background: 'var(--surface)', color: 'var(--ink)',
                  }}>{op}</button>
                ))}
              </div>
            </div>

          ) : pantalla === 'no_responde' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '24px 20px' }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: 'var(--ink)' }}>Razón de no respuesta</div>
              <div style={{ fontSize: 12, color: 'var(--ink3)', marginBottom: 20 }}>Seleccioná el motivo</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
                {razonesNR.map(r => (
                  <button key={r} onClick={() => setRazonNR(r)} style={{
                    padding: '13px 14px', borderRadius: 10, textAlign: 'left',
                    fontSize: 13, fontFamily: 'DM Sans', cursor: 'pointer',
                    border: `2px solid ${razonNR === r ? '#1a472a' : 'var(--border2)'}`,
                    background: razonNR === r ? '#d8f3dc' : '#fff',
                    color: razonNR === r ? '#1a472a' : '#333',
                    fontWeight: razonNR === r ? 700 : 400,
                  }}>{r}</button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingBottom: 8 }}>
                <button onClick={() => setPantalla('participa')} style={{ flex: 1, padding: '12px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 12, fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink3)' }}>Volver</button>
                <button onClick={() => { setNoResponde(true); setPantalla('fin') }} disabled={!razonNR} style={{
                  flex: 2, padding: '12px',
                  background: razonNR ? '#c0392b' : 'var(--border2)',
                  color: razonNR ? '#fff' : '#aaa',
                  border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
                  cursor: razonNR ? 'pointer' : 'not-allowed', fontFamily: 'DM Sans',
                }}>Registrar y salir</button>
              </div>
            </div>

          ) : pantalla === 'encuesta' && preguntaActual ? (
            <PreguntaScreen
              pregunta={preguntaActual}
              total={totalNoBase}
              indice={indiceVisible}
              respuesta={respuestas[preguntaActual.id]}
              onChange={handleRespuesta}
              onAnterior={handleAnterior}
              onSiguiente={handleSiguiente}
              esPrimera={paso === 0}
              esUltima={paso === preguntasEncuesta.length - 1}
            />

          ) : pantalla === 'fin' ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 24px', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: noResponde ? '#fef3c7' : '#d8f3dc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, marginBottom: 20 }}>
                {noResponde ? '📝' : '✅'}
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: '0 0 10px' }}>
                {noResponde ? 'Registrado' : '¡Gracias!'}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--ink3)', margin: '0 0 32px', lineHeight: 1.6 }}>
                {noResponde ? 'La razón de no respuesta fue registrada.' : 'La encuesta fue completada exitosamente.'}
              </p>
              <button onClick={() => { setPaso(0); setRespuestas({}); setRazonNR(''); setNoResponde(false); setPreguntasOcultas(new Set()); setPantalla('inicio') }}
                style={{ width: '100%', padding: '13px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 14, fontSize: 14, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink3)', marginBottom: 10 }}>
                🔄 Reiniciar simulación
              </button>
              <button onClick={onClose} style={{ width: '100%', padding: '14px', background: '#1a472a', color: '#fff', border: 'none', borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'DM Sans' }}>
                Cerrar simulador
              </button>
            </div>

          ) : null}
        </div>

        <div style={{ background: 'var(--paper)', padding: '8px 0', display: 'flex', justifyContent: 'center', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
          <div style={{ width: 120, height: 4, background: 'var(--border2)', borderRadius: 4 }} />
        </div>
        </div>  {/* fin pantalla */}
        {/* Botón home */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4 }}>
          <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 4 }} />
        </div>
      </div>  {/* fin marco teléfono */}
    </div>
  )
}