// Elementi puntuali del pianeta: isole degli arcipelaghi (i vulcani sono una
// lista fissa, vedi pickVolcanoes in planet.js).
//
// Il resto del pianeta è rumore continuo; le isole sono invece "oggetti"
// con un centro e un raggio. Per trovarli senza scorrere una lista, lo spazio
// 3D è diviso in celle cubiche: ogni cella può ospitare un elemento (deciso da
// un hash intero del seed e delle coordinate della cella), con il centro
// spostato a caso fra 0.25 e 0.75 della cella e poi proiettato sulla sfera.
//
// Basta guardare 2×2×2 celle (le più vicine per asse) se il raggio di ogni
// elemento è ≤ 0.25 della cella: un centro in una cella più lontana dista
// almeno 0.75 celle, e la proiezione sulla sfera lo sposta al massimo di mezza
// cella. Si accettano solo centri entro mezza cella dalla superficie: così una
// colonna di celle in direzione radiale produce un solo elemento.
//
// Deterministico e indipendente dal LOD come tutto il pianeta.

/** Hash intero di una cella (4 valori in [0,1)). */
function cellHash(ix, iy, iz, seed, out) {
  let h = Math.imul(ix, 0x9e3779b1) ^ Math.imul(iy, 0x85ebca77) ^ Math.imul(iz, 0xc2b2ae3d) ^ seed
  for (let k = 0; k < 4; k++) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d)
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39)
    h ^= h >>> 15
    out[k] = (h >>> 8) / 16777216
    h = (h + 0x6d2b79f5) | 0
  }
  return out
}

const _h = new Float64Array(4)

/**
 * Elemento più vicino (in unità del proprio raggio) attorno alla direzione p.
 * @param {number} cell lato della cella (unità della sfera unitaria)
 * @param {number} prob probabilità che una cella ospiti un elemento
 * @param {number} rMin raggio minimo (≤ 0.25 cell)
 * @param {number} rMax raggio massimo (≤ 0.25 cell)
 * @param {object} out { s: distanza/raggio (Infinity se nessuno), r, id, cx, cy, cz }
 */
export function nearestFeature(px, py, pz, cell, seed, prob, rMin, rMax, out) {
  out.s = Infinity
  if (prob <= 0) return out
  const inv = 1 / cell
  const x = px * inv
  const y = py * inv
  const z = pz * inv
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const iz = Math.floor(z)
  const bx = ix + (x - ix < 0.5 ? -1 : 0)
  const by = iy + (y - iy < 0.5 ? -1 : 0)
  const bz = iz + (z - iz < 0.5 ? -1 : 0)
  for (let dz = 0; dz <= 1; dz++) {
    for (let dy = 0; dy <= 1; dy++) {
      for (let dx = 0; dx <= 1; dx++) {
        const cx = bx + dx
        const cy = by + dy
        const cz = bz + dz
        const h = cellHash(cx, cy, cz, seed, _h)
        if (h[0] >= prob) continue
        let fx = (cx + 0.25 + 0.5 * h[1]) * cell
        let fy = (cy + 0.25 + 0.5 * h[2]) * cell
        let fz = (cz + 0.25 + 0.5 * h[3]) * cell
        const fl = Math.sqrt(fx * fx + fy * fy + fz * fz)
        if (Math.abs(fl - 1) > cell * 0.5) continue
        fx /= fl
        fy /= fl
        fz /= fl
        const ex = px - fx
        const ey = py - fy
        const ez = pz - fz
        const d = Math.sqrt(ex * ex + ey * ey + ez * ez)
        // raggio e identità dal primo valore (già < prob): niente hash in più
        const u = h[0] / prob
        const r = rMin + (rMax - rMin) * ((u * 7.31) % 1)
        const s = d / r
        if (s < out.s) {
          out.s = s
          out.r = r
          out.id = u
        }
      }
    }
  }
  return out
}

export function createFeatureSample() {
  return { s: Infinity, r: 0, id: 0 }
}
