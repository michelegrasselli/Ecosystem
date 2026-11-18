// Nazioni: la terraferma è divisa in grandi stati inventati.
//
// Ogni nazione è la regione di Voronoi (sulla sfera) di un "capoluogo" scelto
// sulla terraferma. Prima del confronto le coordinate vengono deformate da una
// somma di sinusoidi 3D, così i confini sono sinuosi come quelli veri invece
// di archi di cerchio massimo. La stessa deformazione è scritta in GLSL
// (`NATION_GLSL`) perché lo shader disegni i confini al pixel: JS e GPU
// usano costanti identiche.
//
// Deterministico: stesso seed del pianeta → stesse nazioni e stessi nomi.

import { Planet } from './planet.js'

/** Numero massimo di nazioni (dimensione dell'array uniform nello shader). */
export const MAX_NATIONS = 48

/** Distanza minima tra capoluoghi (radianti): ~3200 km, nazioni grandi. */
const MIN_SEPARATION = 0.5

/**
 * Termini della deformazione: [ampiezza, kx, ky, kz, fase] per asse.
 * Due scale: anse ampie (~1000-1500 km) e dettaglio più fine (~300-400 km).
 */
const WARP = [
  [0.07, 3.1, -1.7, 2.3, 0.4],
  [0.07, -2.2, 2.9, 1.6, 1.9],
  [0.07, 1.4, 2.1, -3.3, 3.1],
  [0.022, 11.3, 7.9, -9.4, 0.7],
  [0.022, -8.6, 12.1, 6.3, 2.6],
  [0.022, 7.2, -10.5, 11.8, 4.2]
]

/** Nomi inventati: suoni mediterranei, nordici e "antichi", nessuno reale. */
const NAMES = [
  'Valdoria', 'Ostrenia', 'Kaledra', 'Mirevale', 'Sorvenna', 'Tharsis Minor',
  'Aldemark', 'Brenovia', 'Calvaro', 'Dunmere', 'Esterhal', 'Faroven',
  'Galdessa', 'Halvorn', 'Isperia', 'Jorvalia', 'Kestrova', 'Lunedra',
  'Maranthe', 'Norwenna', 'Orsalia', 'Pelvarre', 'Quessira', 'Rodomir',
  'Saltrenna', 'Teruval', 'Umbrenna', 'Vaskarra', 'Wendmoor', 'Ysolde',
  'Zaraveth', 'Ardelune', 'Belmarra', 'Corvessa', 'Drevania', 'Elmaris',
  'Fenhollow', 'Grisalda', 'Hesperon', 'Ilvarra', 'Karvossa', 'Lorendal',
  'Merovene', 'Nalvessa', 'Oberlaine', 'Pratalia', 'Riventhal', 'Selvaren'
]

/** Deformazione delle coordinate (identica a `nationWarp` in GLSL). */
export function nationWarp(x, y, z, out) {
  let wx = x
  let wy = y
  let wz = z
  for (let i = 0; i < WARP.length; i += 3) {
    const a = WARP[i]
    const b = WARP[i + 1]
    const c = WARP[i + 2]
    wx += a[0] * Math.sin(a[1] * x + a[2] * y + a[3] * z + a[4])
    wy += b[0] * Math.sin(b[1] * x + b[2] * y + b[3] * z + b[4])
    wz += c[0] * Math.sin(c[1] * x + c[2] * y + c[3] * z + c[4])
  }
  const l = 1 / Math.sqrt(wx * wx + wy * wy + wz * wz)
  out.x = wx * l
  out.y = wy * l
  out.z = wz * l
  return out
}

const f = (v) => {
  const s = String(v)
  return s.includes('.') || s.includes('e') ? s : s + '.0'
}

/** Funzione GLSL equivalente a nationWarp, generata dalle stesse costanti. */
export const NATION_GLSL = (() => {
  const lines = []
  for (let i = 0; i < WARP.length; i += 3) {
    const t = [WARP[i], WARP[i + 1], WARP[i + 2]]
    const axis = ['x', 'y', 'z']
    for (let k = 0; k < 3; k++) {
      const w = t[k]
      lines.push(
        `w.${axis[k]} += ${f(w[0])} * sin(dot(p, vec3(${f(w[1])}, ${f(w[2])}, ${f(w[3])})) + ${f(w[4])});`
      )
    }
  }
  return `vec3 nationWarp(vec3 p) {\n  vec3 w = p;\n  ${lines.join('\n  ')}\n  return normalize(w);\n}`
})()

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fibonacciSphere(n, i) {
  const y = 1 - (2 * (i + 0.5)) / n
  const r = Math.sqrt(1 - y * y)
  const th = i * 2.399963229728653
  return [Math.cos(th) * r, y, Math.sin(th) * r]
}

export class Nations {
  /** @param {Planet} planet */
  constructor(planet) {
    const rand = mulberry32((planet.seed ^ 0x51ed270b) >>> 0)
    const sample = Planet.createSample()
    const isLand = (x, y, z) => {
      planet.sample(x, y, z, 1, sample)
      return sample.height >= 0 && sample.water < 0.5
    }

    // --- capoluoghi: punti di terraferma ben distanziati ---
    const N = 6000
    const cand = []
    for (let i = 0; i < N; i++) {
      const p = fibonacciSphere(N, i)
      if (isLand(p[0], p[1], p[2])) cand.push(p)
    }
    for (let i = cand.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      const t = cand[i]
      cand[i] = cand[j]
      cand[j] = t
    }
    const minDot = Math.cos(MIN_SEPARATION)
    const seeds = []
    for (const p of cand) {
      if (seeds.length >= MAX_NATIONS) break
      let ok = true
      for (const s of seeds) {
        if (p[0] * s[0] + p[1] * s[1] + p[2] * s[2] > minDot) {
          ok = false
          break
        }
      }
      if (ok) seeds.push(p)
    }
    // i capoluoghi vengono confrontati nello spazio deformato
    this.seeds = seeds.map((p) => {
      const o = nationWarp(p[0], p[1], p[2], { x: 0, y: 0, z: 0 })
      return [o.x, o.y, o.z]
    })
    this.count = this.seeds.length

    // --- nomi (mescolati in modo deterministico) ---
    const names = NAMES.slice()
    for (let i = names.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      const t = names[i]
      names[i] = names[j]
      names[j] = t
    }

    // --- baricentro della terraferma di ogni nazione: lì va l'etichetta ---
    const acc = this.seeds.map(() => [0, 0, 0, 0])
    const M = 24000
    for (let i = 0; i < M; i++) {
      const p = fibonacciSphere(M, i)
      if (!isLand(p[0], p[1], p[2])) continue
      const id = this.idAt(p[0], p[1], p[2])
      const a = acc[id]
      a[0] += p[0]
      a[1] += p[1]
      a[2] += p[2]
      a[3]++
    }
    const totalLand = acc.reduce((s, a) => s + a[3], 0) || 1
    this.list = this.seeds.map((s, i) => {
      const a = acc[i]
      let ax = a[0]
      let ay = a[1]
      let az = a[2]
      const l = Math.hypot(ax, ay, az)
      // baricentro degenere (nazione ad anello): si usa il capoluogo
      if (l < 1e-6 || a[3] === 0) {
        ax = s[0]
        ay = s[1]
        az = s[2]
      } else {
        ax /= l
        ay /= l
        az /= l
      }
      return {
        id: i,
        name: names[i % names.length],
        anchor: [ax, ay, az],
        share: a[3] / totalLand
      }
    })

    // array per lo shader
    this.uniformSeeds = new Float32Array(MAX_NATIONS * 3)
    this.seeds.forEach((s, i) => this.uniformSeeds.set(s, i * 3))
    this._w = { x: 0, y: 0, z: 0 }
  }

  /** Indice della nazione per una direzione unitaria (anche sul mare: la più vicina). */
  idAt(x, y, z) {
    const w = nationWarp(x, y, z, this._w || (this._w = { x: 0, y: 0, z: 0 }))
    let best = 0
    let bd = -2
    for (let i = 0; i < this.seeds.length; i++) {
      const s = this.seeds[i]
      const d = w.x * s[0] + w.y * s[1] + w.z * s[2]
      if (d > bd) {
        bd = d
        best = i
      }
    }
    return best
  }

  /** Nazione a latitudine/longitudine (gradi). */
  atLatLon(lat, lon) {
    const la = (lat * Math.PI) / 180
    const lo = (lon * Math.PI) / 180
    const c = Math.cos(la)
    return this.list[this.idAt(c * Math.cos(lo), Math.sin(la), -c * Math.sin(lo))]
  }
}
