import * as turf from '@turf/turf'

// Exporta las zonas de una encuesta como KMZ (KML comprimido) para abrir en
// Google Earth / Google My Maps: un polígono por zona con su color y un pin
// con el nombre. El ZIP se arma a mano (método "store", sin compresión) para
// no sumar una dependencia: un KMZ es un ZIP con un doc.kml adentro.

// ── ZIP mínimo (un archivo, sin compresión) ──
let _crcTabla = null
function crc32(bytes) {
  if (!_crcTabla) {
    _crcTabla = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1
      _crcTabla[n] = c >>> 0
    }
  }
  let crc = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) crc = _crcTabla[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8)
  return (crc ^ 0xFFFFFFFF) >>> 0
}

export function zipUnArchivo(nombre, contenido) {
  const enc = new TextEncoder()
  const nombreB = enc.encode(nombre)
  const datos = typeof contenido === 'string' ? enc.encode(contenido) : contenido
  const crc = crc32(datos)
  const ahora = new Date()
  const dosHora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1)
  const dosFecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate()

  const local = new DataView(new ArrayBuffer(30))
  local.setUint32(0, 0x04034b50, true)
  local.setUint16(4, 20, true)
  local.setUint16(6, 0x0800, true)          // nombre en UTF-8
  local.setUint16(8, 0, true)               // store
  local.setUint16(10, dosHora, true)
  local.setUint16(12, dosFecha, true)
  local.setUint32(14, crc, true)
  local.setUint32(18, datos.length, true)
  local.setUint32(22, datos.length, true)
  local.setUint16(26, nombreB.length, true)
  local.setUint16(28, 0, true)

  const central = new DataView(new ArrayBuffer(46))
  central.setUint32(0, 0x02014b50, true)
  central.setUint16(4, 20, true)
  central.setUint16(6, 20, true)
  central.setUint16(8, 0x0800, true)
  central.setUint16(10, 0, true)
  central.setUint16(12, dosHora, true)
  central.setUint16(14, dosFecha, true)
  central.setUint32(16, crc, true)
  central.setUint32(20, datos.length, true)
  central.setUint32(24, datos.length, true)
  central.setUint16(28, nombreB.length, true)
  central.setUint32(42, 0, true)            // offset del header local

  const centralOffset = 30 + nombreB.length + datos.length
  const centralSize = 46 + nombreB.length
  const fin = new DataView(new ArrayBuffer(22))
  fin.setUint32(0, 0x06054b50, true)
  fin.setUint16(8, 1, true)
  fin.setUint16(10, 1, true)
  fin.setUint32(12, centralSize, true)
  fin.setUint32(16, centralOffset, true)

  const out = new Uint8Array(centralOffset + centralSize + 22)
  let p = 0
  for (const parte of [new Uint8Array(local.buffer), nombreB, datos, new Uint8Array(central.buffer), nombreB, new Uint8Array(fin.buffer)]) {
    out.set(parte, p); p += parte.length
  }
  return out
}

// ── KML ──
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// '#rrggbb' + opacidad 0..1 → 'aabbggrr' (formato de color de KML)
function colorKml(hex, opacidad = 1) {
  const h = String(hex || '#1a472a').replace('#', '').padStart(6, '0')
  const a = Math.round(opacidad * 255).toString(16).padStart(2, '0')
  return `${a}${h.slice(4, 6)}${h.slice(2, 4)}${h.slice(0, 2)}`
}

function anilloKml(anillo) {
  return anillo.map(([lng, lat]) => `${lng},${lat},0`).join(' ')
}

function poligonoKml(coords) {
  const [exterior, ...huecos] = coords
  return `<Polygon><tessellate>1</tessellate>` +
    `<outerBoundaryIs><LinearRing><coordinates>${anilloKml(exterior)}</coordinates></LinearRing></outerBoundaryIs>` +
    huecos.map(h => `<innerBoundaryIs><LinearRing><coordinates>${anilloKml(h)}</coordinates></LinearRing></innerBoundaryIs>`).join('') +
    `</Polygon>`
}

function geometriaKml(geom) {
  if (geom.type === 'Polygon') return poligonoKml(geom.coordinates)
  if (geom.type === 'MultiPolygon') return `<MultiGeometry>${geom.coordinates.map(poligonoKml).join('')}</MultiGeometry>`
  return ''
}

// Punto garantizado dentro del polígono (el promedio de vértices puede caer
// fuera en zonas cóncavas).
function puntoPin(feature) {
  try { return turf.pointOnFeature(feature).geometry.coordinates } catch { return null }
}

/**
 * zonas: [{ nombre, color, geojson }] — geojson es el FeatureCollection de la
 * zona (features con properties.tipo === 'zona'). Las zonas sin polígono se omiten.
 */
export function construirKml(zonas, nombreDocumento = 'Zonas') {
  const estilos = []
  const marcas = []
  let n = 0
  zonas.forEach((zona, i) => {
    const feats = (zona.geojson?.features || []).filter(f => f.properties?.tipo === 'zona' && f.geometry)
    if (!feats.length) return
    n++
    const id = `z${i}`
    estilos.push(
      `<Style id="${id}-poly"><LineStyle><color>${colorKml(zona.color, 1)}</color><width>3</width></LineStyle>` +
      `<PolyStyle><color>${colorKml(zona.color, 0.35)}</color><fill>1</fill><outline>1</outline></PolyStyle></Style>`,
      `<Style id="${id}-pin"><IconStyle><color>${colorKml(zona.color, 1)}</color><scale>1.1</scale>` +
      `<Icon><href>http://maps.google.com/mapfiles/kml/pushpin/wht-pushpin.png</href></Icon></IconStyle>` +
      `<LabelStyle><scale>1</scale></LabelStyle></Style>`,
    )
    const nombre = esc(zona.nombre)
    feats.forEach(f => {
      marcas.push(`<Placemark><name>${nombre}</name><styleUrl>#${id}-poly</styleUrl>${geometriaKml(f.geometry)}</Placemark>`)
    })
    const pin = puntoPin(feats[0])
    if (pin) {
      marcas.push(`<Placemark><name>${nombre}</name><styleUrl>#${id}-pin</styleUrl><Point><coordinates>${pin[0]},${pin[1]},0</coordinates></Point></Placemark>`)
    }
  })
  const kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(nombreDocumento)}</name>${estilos.join('')}${marcas.join('')}</Document></kml>`
  return { kml, cantidad: n }
}

export function generarKMZ(zonas, nombreDocumento) {
  const { kml, cantidad } = construirKml(zonas, nombreDocumento)
  return { cantidad, bytes: cantidad ? zipUnArchivo('doc.kml', kml) : null }
}

// Genera y descarga el .kmz. Devuelve la cantidad de zonas exportadas (0 = nada para exportar).
export function descargarKMZZonas(zonas, nombreEncuesta = 'encuesta') {
  const { cantidad, bytes } = generarKMZ(zonas, `Zonas — ${nombreEncuesta}`)
  if (!cantidad) return 0
  const blob = new Blob([bytes], { type: 'application/vnd.google-earth.kmz' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `zonas-${nombreEncuesta.replace(/[^\w-]+/g, '_')}.kmz`
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
  return cantidad
}
