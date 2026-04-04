import { puntoInicioAleatorio } from './MapaManzanas'

// ═══════════════════════════════════════════════════
// LISTA DE MANZANAS con asignación y punto de inicio
// ═══════════════════════════════════════════════════
export default function ListaManzanas({ manzanas, encuestadores, asignaciones, onAsignar, onDistribuir }) {
  if (!manzanas.length) return (
    <div style={{ padding: '16px', background: 'var(--surface)', borderRadius: 'var(--r2)', fontSize: 13, color: 'var(--ink3)', textAlign: 'center' }}>
      Dibujá manzanas en el mapa para asignarlas a los encuestadores.
    </div>
  )

  const sinAsignar = manzanas.filter(m => !asignaciones[m.localId]?.encuestador_id).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>
            {manzanas.length} manzana{manzanas.length !== 1 ? 's' : ''}
          </span>
          {sinAsignar > 0 && (
            <span style={{ padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#b45309' }}>
              {sinAsignar} sin asignar
            </span>
          )}
        </div>
        {encuestadores.length > 0 && manzanas.length > 0 && (
          <button onClick={onDistribuir}
            style={{ padding: '7px 14px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', gap: 5 }}>
            🎲 Distribuir al azar
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {manzanas.map((m, i) => {
          const asig = asignaciones[m.localId] || {}
          const enc = encuestadores.find(e => e.id === asig.encuestador_id)
          return (
            <div key={m.localId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#fff', border: `1.5px solid ${asig.encuestador_id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--r)', transition: 'border-color .15s' }}>
              {/* Número */}
              <div style={{ width: 30, height: 30, background: asig.encuestador_id ? 'var(--accent)' : 'var(--surface2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: asig.encuestador_id ? '#fff' : 'var(--ink3)', flexShrink: 0 }}>
                {i + 1}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{m.nombre}</div>
                {asig.punto_inicio ? (
                  <div style={{ fontSize: 11, color: 'var(--accent2)', marginTop: 2 }}>
                    📍 Inicio: {asig.punto_inicio.descripcion}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 2 }}>
                    Sin punto de inicio asignado
                  </div>
                )}
              </div>

              {/* Selector de encuestador */}
              <select
                value={asig.encuestador_id || ''}
                onChange={e => onAsignar(m.localId, e.target.value || null, m.area_geojson)}
                style={{ padding: '6px 10px', border: '1.5px solid var(--border2)', borderRadius: 'var(--r)', fontSize: 12, fontFamily: 'DM Sans', color: 'var(--ink)', background: '#fff', cursor: 'pointer', minWidth: 160 }}>
                <option value="">Sin asignar</option>
                {encuestadores.map(e => (
                  <option key={e.id} value={e.id}>{e.nombre_completo}</option>
                ))}
              </select>
            </div>
          )
        })}
      </div>
    </div>
  )
}