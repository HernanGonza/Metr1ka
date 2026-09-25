// Distancias GPS. `distanciaMetros` es la misma fórmula (haversine) que usa
// la app del encuestador para el geofencing (metr1ka-app,
// app/(encuestador)/encuesta/[id].tsx) — portada acá para que el panel
// mida igual que el celular.

export function distanciaMetros(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Dispersión de un conjunto de puntos {lat, lng}: "distancia típica" al
// centroide (raíz del promedio de las distancias al cuadrado — la
// desviación estándar espacial, en metros). null con menos de 3 puntos.
export function dispersionMetros(puntos) {
  const pts = (puntos || [])
    .map(p => ({ lat: Number(p.lat), lng: Number(p.lng) }))
    .filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && (p.lat !== 0 || p.lng !== 0))
  if (pts.length < 3) return null
  const cLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length
  const cLng = pts.reduce((s, p) => s + p.lng, 0) / pts.length
  const sumaCuad = pts.reduce((s, p) => s + distanciaMetros(cLat, cLng, p.lat, p.lng) ** 2, 0)
  return Math.sqrt(sumaCuad / pts.length)
}
