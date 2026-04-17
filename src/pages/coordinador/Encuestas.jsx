import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { Topbar } from '../../components/layout'
import { Spinner } from '../../components/ui'
import SimuladorEncuesta from '../admin/SimuladorEncuesta'
import styles from '../admin/Page.module.css'

const ESTADO_CFG = {
  publicada:    { label: 'Publicada',    color: '#1a472a', bg: 'var(--accent-light)' },
  en_proceso:   { label: 'En proceso',   color: '#0369a1', bg: 'var(--info-light)' },
  para_revisar: { label: 'Para revisar', color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  pendiente:    { label: 'Pendiente',    color: '#b45309', bg: 'var(--warning-light)' },
}

const TIPO_CFG = {
  domiciliaria: { label: 'Domiciliaria', color: '#0369a1', bg: 'var(--info-light)' },
  callejera:    { label: 'Callejera',    color: '#047857', bg: 'var(--accent-light)' },
  telefonica:   { label: 'Telefónica',   color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
  online:       { label: 'Online',       color: '#b45309', bg: 'var(--warning-light)' },
}

export default function EncuestasCoord() {
  const { perfil }   = useAuth()
  const [encuestas,  setEncuestas]  = useState([])
  const [loading,    setLoading]    = useState(true)
  const [simulando,  setSimulando]  = useState(null) // { encuestaId, orgId }
  const [detalle,    setDetalle]    = useState(null)  // encuesta_id expandido

  useEffect(() => {
    if (!perfil?.id) return
    async function load() {
      // Equipo del coordinador
      const { data: ec } = await supabase
        .from('equipo_coordinadores')
        .select('equipo_id')
        .eq('coordinador_id', perfil.id)
        .single()
      if (!ec) { setLoading(false); return }

      // Encuestas asignadas al equipo con info completa
      const { data: ees } = await supabase
        .from('encuestas_equipo')
        .select(`
          id,
          encuesta_id,
          asignado_en,
          encuestas(
            id, nombre, descripcion, estado_produccion,
            activo, tipo_encuesta, fecha_inicio, fecha_fin,
            organizacion_id
          )
        `)
        .eq('equipo_id', ec.equipo_id)

      // Contar preguntas y respuestas del equipo por encuesta
      const encIds = (ees || []).map(e => e.encuesta_id)
      let pregsCount = {}
      let sesMap = {}
      if (encIds.length) {
        const { data: pregs } = await supabase
          .from('preguntas')
          .select('encuesta_id')
          .in('encuesta_id', encIds)
        ;(pregs || []).forEach(p => {
          pregsCount[p.encuesta_id] = (pregsCount[p.encuesta_id] || 0) + 1
        })

        // Encuestadores del equipo
        const { data: encs } = await supabase
          .from('equipo_encuestadores')
          .select('encuestador_id')
          .eq('equipo_id', ec.equipo_id)
        const encIds_members = (encs || []).map(e => e.encuestador_id)

        if (encIds_members.length) {
          const { data: asg } = await supabase
            .from('asignaciones_encuesta')
            .select('id, encuestador_id')
            .in('encuestador_id', encIds_members)
          if (asg?.length) {
            const { data: ses } = await supabase
              .from('sesiones_respuesta')
              .select('asignacion_id, completada_en')
              .in('asignacion_id', asg.map(a => a.id))
            // necesitamos saber qué encuesta_id tiene cada asignacion
            // encuestas -> encuesta_zonas -> asignaciones_encuesta
            // o más simple: el encuestador solo puede estar en sesiones de encuestas de su equipo
            // contar sesiones completadas por encuesta
            // asignacion → encuesta_zona → encuesta_id no siempre está disponible
            // usamos sesiones completadas totales del equipo
            sesMap = { total: (ses || []).length, completadas: (ses || []).filter(s => s.completada_en).length }
          }
        }
      }

      setEncuestas((ees || []).map(ee => ({
        ...ee,
        preguntas_count: pregsCount[ee.encuesta_id] || 0,
        sesiones: sesMap,
      })))
      setLoading(false)
    }
    load()
  }, [perfil?.id])

  if (loading) return <div className={styles.page}><Spinner center size="lg" /></div>

  // Simulador abierto
  if (simulando) {
    return (
      <SimuladorEncuesta
        encuestaId={simulando.encuestaId}
        orgId={simulando.orgId}
        onClose={() => setSimulando(null)}
      />
    )
  }

  return (
    <div className={styles.page}>
      <Topbar title="Encuestas" />
      <div className={styles.content}>

        {encuestas.length === 0 && (
          <div className={styles.empty}>
            <p>No hay encuestas asignadas a tu equipo todavía.</p>
            <p style={{ fontSize: 13 }}>Cuando el administrador asigne encuestas a tu equipo, aparecerán aquí.</p>
          </div>
        )}

        {encuestas.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

            {/* Resumen rápido */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 8 }}>
              {[
                { label: 'Asignadas', value: encuestas.length, color: 'var(--accent)', bg: 'var(--accent-light)' },
                { label: 'Publicadas', value: encuestas.filter(e => e.encuestas?.estado_produccion === 'publicada').length, color: '#0369a1', bg: 'var(--info-light)' },
                { label: 'Respuestas del equipo', value: encuestas[0]?.sesiones?.completadas || 0, color: '#7c3aed', bg: 'rgba(124,58,237,0.1)' },
              ].map((k, i) => (
                <div key={i} style={{ background: k.bg, borderRadius: 'var(--r2)', padding: '14px 18px' }}>
                  <div style={{ fontFamily: 'Syne', fontSize: 26, fontWeight: 800, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: k.color, marginTop: 2 }}>{k.label}</div>
                </div>
              ))}
            </div>

            {/* Cards de encuestas */}
            {encuestas.map((ee, i) => {
              const enc = ee.encuestas
              if (!enc) return null
              const estadoCfg = ESTADO_CFG[enc.estado_produccion] || ESTADO_CFG.pendiente
              const tipoCfg   = TIPO_CFG[enc.tipo_encuesta] || TIPO_CFG.domiciliaria
              const isOpen    = detalle === ee.encuesta_id
              const publicada = enc.estado_produccion === 'publicada'

              return (
                <div key={i}
                  className={`${styles.encuestaCard} ${publicada ? styles.encuestaCardPublicada : ''}`}
                  style={{ cursor: 'default' }}
                >
                  {/* Header */}
                  <div className={styles.encuestaHeader}>
                    <h4>{enc.nombre}</h4>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <span style={{ padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: tipoCfg.bg, color: tipoCfg.color }}>
                        {tipoCfg.label}
                      </span>
                      <span style={{ padding: '3px 9px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: estadoCfg.bg, color: estadoCfg.color }}>
                        {estadoCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Descripción */}
                  {enc.descripcion && (
                    <p className={styles.encuestaDesc}>{enc.descripcion}</p>
                  )}

                  {/* Meta */}
                  <div className={styles.encuestaMeta} style={{ display: 'flex', gap: 16 }}>
                    <span>📋 {ee.preguntas_count} preguntas</span>
                    {enc.fecha_inicio && (
                      <span>📅 Desde {new Date(enc.fecha_inicio).toLocaleDateString('es-AR')}</span>
                    )}
                    {enc.fecha_fin && (
                      <span>⏳ Hasta {new Date(enc.fecha_fin).toLocaleDateString('es-AR')}</span>
                    )}
                    <span>🗓 Asignada {new Date(ee.asignado_en).toLocaleDateString('es-AR')}</span>
                  </div>

                  {/* Botón simular + detalles */}
                  <div className={styles.encuestaActions}>
                    <button
                      onClick={() => setSimulando({ encuestaId: enc.id, orgId: enc.organizacion_id })}
                      style={{ padding: '7px 16px', background: 'var(--ink)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      📱 Vista previa del cuestionario
                    </button>
                    <button
                      onClick={() => setDetalle(isOpen ? null : ee.encuesta_id)}
                      style={{ padding: '7px 14px', background: 'none', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans', color: 'var(--ink3)' }}
                    >
                      {isOpen ? 'Cerrar' : 'Ver instrucciones'}
                    </button>
                  </div>

                  {/* Panel de instrucciones expandido */}
                  {isOpen && (
                    <div style={{ marginTop: 14, padding: '16px', background: 'var(--surface)', borderRadius: 'var(--r)', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--ink3)', marginBottom: 10 }}>
                        Información del trabajo de campo
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--ink2)' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span>📋</span>
                          <span><b>Preguntas:</b> {ee.preguntas_count} preguntas en total</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span>📱</span>
                          <span><b>Modalidad:</b> {tipoCfg.label} — tus encuestadores completan el formulario en la app móvil</span>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <span>🗺</span>
                          <span><b>Zonas:</b> el administrador asignó manzanas y parcelas a tu equipo — visibles en la app</span>
                        </div>
                        {enc.fecha_inicio && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span>📅</span>
                            <span><b>Inicio:</b> {new Date(enc.fecha_inicio).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                        )}
                        {enc.fecha_fin && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <span>⏳</span>
                            <span><b>Fecha límite:</b> {new Date(enc.fecha_fin).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                          </div>
                        )}
                        <div style={{ marginTop: 6, padding: '10px 14px', background: 'var(--accent-light)', borderRadius: 'var(--r)', color: 'var(--accent2)', fontWeight: 600, fontSize: 12 }}>
                          💡 Usá el botón "Vista previa del cuestionario" para revisar todas las preguntas antes de salir al campo.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}