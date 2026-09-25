import { useState, useEffect, useRef } from 'react'
import { cargarRespuestasCrudas, cargarEncuestaAnterior } from '../lib/tendencia'

// Respuestas crudas (get_respuestas_crudas, sin filtros) de una encuesta,
// compartidas por las vistas estadísticas del detalle. `version` es
// cualquier valor que cambie cuando entran respuestas nuevas (el total de
// completadas): al cambiar se recarga salteando el cache, así la proyección
// y la curva de saturación siguen al operativo en vivo.
export function useRespuestasCrudas(encuesta, version) {
  const [datos, setDatos] = useState({ id: null, crudo: null })
  const versionPrevia = useRef(version)

  useEffect(() => {
    if (!encuesta?.id) return
    let cancelado = false
    const sinCache = versionPrevia.current !== version
    versionPrevia.current = version
    cargarRespuestasCrudas(encuesta, { sinCache })
      .then(crudo => { if (!cancelado) setDatos({ id: encuesta.id, crudo }) })
      .catch(e => { console.error('useRespuestasCrudas:', e); if (!cancelado) setDatos({ id: encuesta.id, crudo: null }) })
    return () => { cancelado = true }
  }, [encuesta, version])

  return { crudo: datos.id === encuesta?.id ? datos.crudo : null, cargando: !!encuesta?.id && datos.id !== encuesta.id }
}

// Encuesta anterior comparable del mismo municipio (ver lib/tendencia.js).
export function useEncuestaAnterior(encuesta) {
  const [datos, setDatos] = useState({ id: null, anterior: null })
  useEffect(() => {
    if (!encuesta?.id) return
    let cancelado = false
    cargarEncuestaAnterior(encuesta)
      .then(anterior => { if (!cancelado) setDatos({ id: encuesta.id, anterior }) })
      .catch(e => { console.error('useEncuestaAnterior:', e); if (!cancelado) setDatos({ id: encuesta.id, anterior: null }) })
    return () => { cancelado = true }
  }, [encuesta])
  return datos.id === encuesta?.id ? datos.anterior : null
}
