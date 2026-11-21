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
import { cubeFaceDir } from '../render/tileData.js'

/** Numero massimo di nazioni (dimensione dell'array uniform nello shader). */
export const MAX_NATIONS = 96

/**
 * Distanza minima tra capoluoghi (radianti): ~2000 km. Regni più fitti, come
 * su una carta medievale (prima 0.5 rad, ~3200 km: una trentina di nazioni).
 */
const MIN_SEPARATION = 0.31

/**
 * Punti di ancoraggio del nome: TUTTI i campioni di terraferma della nazione
 * (~145 km di passo). Sono tanti (qualche centinaio per nazione) perché il nome
 * deve poter esistere a ogni quota: a 300 km di quota l'inquadratura è larga
 * poche centinaia di km e con pochi punti sparsi non ce ne sarebbe nessuno
 * dentro. Non costano nulla al frame: si proiettano solo quelli nel cono di
 * vista (vedi ui/labels.js).
 */

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

/**
 * Nomi inventati di un mondo fantasy-medievale: suonano anglo-normanni,
 * germanici e celtici, come i nomi di regni e feudi su una carta antica.
 * Nessuno è un luogo reale noto, nessuno viene da opere esistenti.
 */
const NAMES = [
  'Valdremont', 'Aurenhal', 'Brecknoll', 'Caerwydd', 'Dunmarrow', 'Eskerholt',
  'Falkenreth', 'Garrowmere', 'Hollinsgard', 'Ivelmark', 'Kestrelford', 'Lorvaine',
  'Merrowdale', 'Norhaven', 'Oswaldane', 'Pellingrave', 'Quillemont', 'Rookhallow',
  'Saint Ambrel', 'Thurlowmere', 'Ulverstane', 'Varenhold', 'Wexmoor', 'Ystrandel',
  'Aldbrecht', 'Belmorrow', 'Corvennes', 'Draxholm', 'Elmsreach', 'Fennwald',
  'Glaivemark', 'Harthmoor', 'Ingleward', 'Jorvane', 'Kaldrecht', 'Lindenhoff',
  'Montclaire', 'Orlemont', 'Penmarrow', 'Ravelloc', 'Sevrenne', 'Tamberlay',
  'Umberwold', 'Vesperhal', 'Wendmere', 'Ardengrave', 'Covenhall', 'Brannoch',
  'Ashmorrow', 'Blackmarsh', 'Caldervale', 'Dornholt', 'Edrasmoor', 'Frostwick',
  'Gildenmoor', 'Hawkesmere', 'Ironmere', 'Kingsholt', 'Larkspire', 'Maldane',
  'Northwold', 'Oakenvale', 'Pembrecht', 'Redmere', 'Stonevale', 'Tyrewood',
  'Valemont', 'Westmarrow', 'Aubercy', 'Belvaine', 'Castellune', 'Dravenshire',
  'Esmerault', 'Fallowmere', 'Greycairn', 'Highmoor', 'Isenwald', 'Lachmere',
  'Morvaine', 'Nethercombe', 'Orrinsby', 'Pruvenna', 'Rosmaire', 'Saltmarrow',
  'Thornwaite', 'Uthermoor', 'Vauclère', 'Wolfreach', 'Yarnwick', 'Ambermoor'
]

/**
 * Rango del regno in base all'estensione (posizione in classifica, come
 * frazione del numero di regni): il più vasto è un impero, poi regni,
 * granducati, ducati… fino alle contee e baronie più piccole.
 */
const RANKS = [
  [0.02, 'Empire of'],
  [0.12, 'Kingdom of'],
  [0.22, 'Grand Duchy of'],
  [0.38, 'Duchy of'],
  [0.5, 'Principality of'],
  [0.65, 'March of'],
  [0.82, 'County of'],
  [Infinity, 'Barony of']
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

    // --- baricentro della terraferma di ogni nazione ---
    // Nello stesso giro si raccolgono TUTTI i campioni di terraferma: sono le
    // ancore possibili del nome. Il nome deve potersi appoggiare a un punto
    // VICINO ma comunque FISSO, invece di inseguire il centro della parte
    // visibile (che lo faceva scivolare).
    const acc = this.seeds.map(() => [0, 0, 0, 0])
    const landPts = this.seeds.map(() => [])
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
      const flat = landPts[id]
      flat.push(p[0], p[1], p[2])
    }
    const totalLand = acc.reduce((s, a) => s + a[3], 0) || 1
    // tutti i campioni di terraferma diventano ancore possibili del nome
    const labelPts = landPts.map((f) => new Float32Array(f))
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
        // ancore del nome: ogni campione di terraferma della nazione
        labelPoints: labelPts[i],
        share: a[3] / totalLand
      }
    })

    // rango (titolo) per estensione della terraferma
    const bySize = this.list.slice().sort((a, b) => b.share - a.share)
    bySize.forEach((n, i) => {
      const rank = RANKS.find(([upTo]) => i < Math.max(1, Math.round(upTo * bySize.length)))[1]
      n.rank = rank
      n.title = rank + ' ' + n.name
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

  /**
   * Nazioni che possono comparire (come prima o seconda più vicina) dentro una
   * tile del quadtree. Lo shader dei confini confronta ogni pixel solo con
   * queste invece che con tutti i capoluoghi: era il ciclo più caro del
   * fragment shader (~48 iterazioni per pixel di terraferma).
   *
   * Conservativo: su una griglia di campioni della tile si tengono tutte le
   * nazioni il cui punteggio è entro `margin` dal migliore. Il margine copre
   * la variazione tra due campioni (la deformazione ha gradiente < ~3) più la
   * fascia in cui la linea è disegnata. Restituisce null se le candidate sono
   * troppe (tile grandi, viste dallo spazio): lo shader usa il ciclo completo.
   */
  candidatesForTile(face, level, ix, iy, max = 24) {
    const G = 9
    const div = 1 << level
    const span = 2 / div
    // distanza angolare tra due campioni (radianti, ~ lato della tile / (G-1))
    const step = (Math.PI / 2 / div) / (G - 1)
    // 0.026: fascia della linea con l'alone (dKm < 80 km con |s1 - s2| <= 2)
    const margin = step * 8 + 0.026
    const d = { x: 0, y: 0, z: 0 }
    const w = { x: 0, y: 0, z: 0 }
    const found = new Set()
    const sc = new Float64Array(this.count)
    for (let j = 0; j < G; j++) {
      for (let i = 0; i < G; i++) {
        const u = (ix / div) * 2 - 1 + (i / (G - 1)) * span
        const v = (iy / div) * 2 - 1 + (j / (G - 1)) * span
        cubeFaceDir(face, u, v, d)
        nationWarp(d.x, d.y, d.z, w)
        let best = -2
        for (let k = 0; k < this.count; k++) {
          const s = this.seeds[k]
          const x = w.x * s[0] + w.y * s[1] + w.z * s[2]
          sc[k] = x
          if (x > best) best = x
        }
        for (let k = 0; k < this.count; k++) {
          if (sc[k] > best - margin) {
            found.add(k)
            if (found.size > max) return null
          }
        }
      }
    }
    return Array.from(found)
  }

  /** Nazione a latitudine/longitudine (gradi). */
  atLatLon(lat, lon) {
    const la = (lat * Math.PI) / 180
    const lo = (lon * Math.PI) / 180
    const c = Math.cos(la)
    return this.list[this.idAt(c * Math.cos(lo), Math.sin(la), -c * Math.sin(lo))]
  }
}
