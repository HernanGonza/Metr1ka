// Test chi-cuadrado de independencia sobre una tabla de contingencia, sin
// librerías externas. El p-valor sale de la función gamma incompleta
// regularizada (serie para x < a+1, fracción continua para el resto —
// Numerical Recipes §6.2), que es exacta a la precisión de un double.

function lnGamma(x) {
  // Aproximación de Lanczos (g = 7, n = 9)
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lnGamma(1 - x)
  x -= 1
  let a = c[0]
  const t = x + 7.5
  for (let i = 1; i < 9; i++) a += c[i] / (x + i)
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
}

// Q(a, x) = 1 - P(a, x): cola superior de la gamma incompleta regularizada.
function gammaQ(a, x) {
  if (x <= 0) return 1
  const lnPre = -x + a * Math.log(x) - lnGamma(a)
  if (x < a + 1) {
    let sum = 1 / a, term = sum
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n)
      sum += term
      if (Math.abs(term) < Math.abs(sum) * 1e-14) break
    }
    return 1 - sum * Math.exp(lnPre)
  }
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-14) break
  }
  return Math.exp(lnPre) * h
}

// p-valor de un χ² observado con `gl` grados de libertad.
export function pValorChi2(chi2, gl) {
  if (gl <= 0) return 1
  return Math.min(1, Math.max(0, gammaQ(gl / 2, chi2 / 2)))
}

// `tabla`: matriz de conteos (filas × columnas). Filas/columnas con total 0
// se descartan antes de calcular (no aportan grados de libertad reales).
// Devuelve null si no queda al menos una tabla 2×2.
export function chiCuadrado(tabla) {
  let filas = (tabla || []).map(f => f.map(v => Number(v) || 0))
  filas = filas.filter(f => f.some(v => v > 0))
  if (!filas.length) return null
  const colsConDatos = filas[0].map((_, j) => filas.some(f => f[j] > 0))
  filas = filas.map(f => f.filter((_, j) => colsConDatos[j]))
  const r = filas.length, c = filas[0].length
  if (r < 2 || c < 2) return null

  const totFila = filas.map(f => f.reduce((a, b) => a + b, 0))
  const totCol = filas[0].map((_, j) => filas.reduce((s, f) => s + f[j], 0))
  const n = totFila.reduce((a, b) => a + b, 0)

  let chi2 = 0, minEsperado = Infinity, celdasBajas = 0
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) {
      const e = (totFila[i] * totCol[j]) / n
      chi2 += ((filas[i][j] - e) ** 2) / e
      if (e < minEsperado) minEsperado = e
      if (e < 5) celdasBajas++
    }
  }
  const gl = (r - 1) * (c - 1)
  return { chi2, gl, p: pValorChi2(chi2, gl), n, minEsperado, celdasBajas, celdas: r * c }
}

export const N_MINIMO_CHI2 = 30

export function formatearP(p) {
  if (p < 0.001) return 'p < 0.001'
  return `p = ${p.toFixed(p < 0.01 ? 3 : 2)}`
}

// Interpretación en texto simple para el lector no técnico. `estado`:
//   'insuficiente' — n total < 30, no se muestra el test
//   'ok'           — resultado válido
//   'advertencia'  — hay celdas con frecuencia esperada < 5 (el χ² pierde
//                    precisión): se muestra igual, con aviso
export function interpretarChi2(res) {
  if (!res) return null
  if (res.n < N_MINIMO_CHI2) {
    return { estado: 'insuficiente', texto: `Muestra insuficiente para el test (n = ${res.n}, se necesitan al menos ${N_MINIMO_CHI2}).` }
  }
  const significativa = res.p < 0.05
  const texto = significativa
    ? 'La diferencia entre grupos es estadísticamente significativa (p < 0.05).'
    : `La diferencia no es estadísticamente significativa (${formatearP(res.p)}) — puede ser ruido de muestreo.`
  const advertencia = res.celdasBajas > 0
    ? `Muestra insuficiente para el test en ${res.celdasBajas} de ${res.celdas} celdas (frecuencia esperada < 5): tomar el resultado con cautela.`
    : null
  return { estado: advertencia ? 'advertencia' : 'ok', significativa, texto, advertencia }
}
