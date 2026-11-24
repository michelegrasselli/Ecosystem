// Modelli 3D delle specie di Elyra (vedi planet/flora.js).
//
// Ogni specie è una geometria low-poly in stile illustrato, alta 1 (la scala
// in km la dà l'istanza), con la base nell'origine e l'asse verticale +Y.
// Attributi per vertice:
//  - aCol: colore;
//  - aWind: (oscillazione del vento, 0 alla base e 1 in cima; tremolio delle
//    foglie 0/1);
//  - aGlow: quanto la parte è luminosa (funghi, cristalli, braci, tentacoli).
// Le forme si ispirano alle immagini di riferimento in contesto/: funghi
// giganti luminosi, baccelli turchesi maculati, alberi a ombrello con tronchi
// intrecciati, cristalli, vegetazione cremisi dei suoli vulcanici, batuffoli
// bianchi dei ghiacci.

import * as THREE from 'three'

const _m = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _s = new THREE.Vector3()
const _t = new THREE.Vector3()
const _n = new THREE.Vector3()
const _p = new THREE.Vector3()

class PlantBuilder {
  /** @param {boolean} lo versione semplificata (piante lontane) */
  constructor(lo = false) {
    this.lo = lo
    // chiome: icosaedro suddiviso da vicino, semplice da lontano
    this.B = lo ? blobLo : blob
    this.pos = []
    this.nor = []
    this.col = []
    this.wind = []
    this.glow = []
  }

  /**
   * Aggiunge una parte.
   * @param {THREE.BufferGeometry} geo primitiva
   * @param {object} o { p:[x,y,z], r:[rx,ry,rz], s:[sx,sy,sz] | number, c:[r,g,b],
   *   c2: colore in cima alla parte, glow, flutter, radial (normali sferiche) }
   */
  add(geo, o) {
    const g = geo.index ? geo.toNonIndexed() : geo
    const sc = typeof o.s === 'number' ? [o.s, o.s, o.s] : o.s || [1, 1, 1]
    // ordine YXZ: prima l'inclinazione (X/Z), poi la rotazione attorno all'asse verticale
    const rr = o.r || [0, 0, 0]
    _e.set(rr[0], rr[1], rr[2], 'YXZ')
    _q.setFromEuler(_e)
    _m.compose(_t.set(...(o.p || [0, 0, 0])), _q, _s.set(...sc))
    const nm = new THREE.Matrix3().getNormalMatrix(_m)
    const P = g.attributes.position
    const N = g.attributes.normal
    // estensione verticale della primitiva (per la sfumatura c -> c2)
    let ymin = Infinity
    let ymax = -Infinity
    for (let i = 0; i < P.count; i++) {
      ymin = Math.min(ymin, P.getY(i))
      ymax = Math.max(ymax, P.getY(i))
    }
    const c = o.c || [1, 1, 1]
    const c2 = o.c2 || c
    for (let i = 0; i < P.count; i++) {
      _p.set(P.getX(i), P.getY(i), P.getZ(i))
      if (o.radial) _n.copy(_p).normalize()
      else _n.set(N.getX(i), N.getY(i), N.getZ(i))
      const k = ymax > ymin ? (_p.y - ymin) / (ymax - ymin) : 0.5
      _p.applyMatrix4(_m)
      _n.applyMatrix3(nm).normalize()
      this.pos.push(_p.x, _p.y, _p.z)
      this.nor.push(_n.x, _n.y, _n.z)
      this.col.push(c[0] + (c2[0] - c[0]) * k, c[1] + (c2[1] - c[1]) * k, c[2] + (c2[2] - c[2]) * k)
      // vento: cresce con l'altezza (in cima oscilla, alla base è fermo)
      const sway = Math.pow(Math.max(_p.y, 0), 1.6)
      this.wind.push(o.stiff ? sway * 0.35 : sway, o.flutter ? 1 : 0)
      this.glow.push(typeof o.glow === 'function' ? o.glow(k) : o.glow || 0)
    }
  }

  build() {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3))
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3))
    g.setAttribute('aCol', new THREE.Float32BufferAttribute(this.col, 3))
    g.setAttribute('aWind', new THREE.Float32BufferAttribute(this.wind, 2))
    g.setAttribute('aGlow', new THREE.Float32BufferAttribute(this.glow, 1))
    return g
  }
}

// primitive riutilizzate (le copie le fa toNonIndexed)
const blob = new THREE.IcosahedronGeometry(1, 1) // chiome tonde (80 triangoli)
const blobLo = new THREE.IcosahedronGeometry(1, 0) // parti piccole (20 triangoli)
// nei modelli semplificati (lontani) cilindri e coni hanno meno lati
let SEG_CAP = 99
const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, Math.min(seg, SEG_CAP), 1, false).translate(0, h / 2, 0)
const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, Math.min(seg, SEG_CAP + 1), 1, false).translate(0, h / 2, 0)
const domeHi = new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2) // calotta
const domeLo = new THREE.SphereGeometry(1, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2)
let dome = domeHi
const shard = (r, h) => new THREE.ConeGeometry(r, h, 4, 1, false).translate(0, h / 2, 0)

const BARK = [0.3, 0.22, 0.16]
const BARK_DARK = [0.2, 0.15, 0.11]

/** Ramo/stelo inclinato: cilindro dalla base (x,y,z) lungo la direzione (ax, az) con inclinazione tilt. */
function stem(b, base, len, r0, r1, yaw, tilt, col, extra = {}) {
  b.add(cyl(r1, r0, 1, 5), { p: base, r: [tilt, yaw, 0], s: [1, len, 1], c: col, c2: extra.c2, glow: extra.glow, stiff: extra.stiff })
  // punta del ramo (per appenderci foglie o baccelli)
  _e.set(tilt, yaw, 0, 'YXZ')
  const d = new THREE.Vector3(0, len, 0).applyEuler(_e)
  return [base[0] + d.x, base[1] + d.y, base[2] + d.z]
}

const MODELS = {
  elderoak(b) {
    b.add(cyl(0.045, 0.075, 0.5), { c: BARK_DARK, c2: BARK, stiff: true })
    stem(b, [0, 0.38, 0], 0.2, 0.035, 0.02, 0.4, 0.7, BARK)
    stem(b, [0, 0.4, 0], 0.18, 0.03, 0.02, 2.6, 0.75, BARK)
    const G = [0.22, 0.42, 0.16]
    const G2 = [0.34, 0.55, 0.2]
    b.add(b.B, { p: [0, 0.66, 0], s: [0.36, 0.3, 0.36], c: G, c2: G2, radial: true, flutter: true })
    b.add(b.B, { p: [0.2, 0.56, 0.08], s: [0.26, 0.22, 0.26], c: G, c2: G2, radial: true, flutter: true })
    b.add(b.B, { p: [-0.17, 0.58, -0.12], s: [0.27, 0.23, 0.27], c: G, c2: G2, radial: true, flutter: true })
    b.add(b.B, { p: [0.02, 0.82, 0.05], s: [0.22, 0.18, 0.22], c: G2, c2: [0.42, 0.62, 0.24], radial: true, flutter: true })
  },
  spirepine(b) {
    b.add(cyl(0.025, 0.05, 0.35), { c: BARK_DARK, stiff: true })
    const G = [0.1, 0.26, 0.18]
    const G2 = [0.18, 0.38, 0.24]
    b.add(cone(0.3, 0.42), { p: [0, 0.16, 0], c: G, c2: G2, flutter: true })
    b.add(cone(0.24, 0.38), { p: [0, 0.36, 0], c: G, c2: G2, flutter: true })
    b.add(cone(0.17, 0.32), { p: [0, 0.54, 0], c: G, c2: G2, flutter: true })
    b.add(cone(0.1, 0.24), { p: [0, 0.76, 0], c: G2, c2: [0.26, 0.46, 0.3], flutter: true })
  },
  canopyTitan(b) {
    // tronco intrecciato: tre fusti che si avvolgono, radici svasate alla base
    const TR = [0.3, 0.36, 0.3]
    const TR2 = [0.4, 0.46, 0.36]
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2
      b.add(cyl(0.035, 0.07, 0.82, 6), { p: [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], r: [0.06 * Math.sin(a), a, 0.06 * Math.cos(a)], c: TR, c2: TR2, stiff: true })
    }
    b.add(cone(0.2, 0.18, 8), { c: [0.24, 0.3, 0.25], stiff: true })
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + 0.3
      stem(b, [Math.cos(a) * 0.03, 0.66, Math.sin(a) * 0.03], 0.32, 0.03, 0.015, -a + Math.PI / 2, 1.05, TR2)
    }
    // chioma piatta a ombrello, verde muschio, con lucine turchesi sotto
    const M = [0.3, 0.46, 0.2]
    const M2 = [0.46, 0.62, 0.28]
    b.add(b.B, { p: [0, 0.86, 0], s: [0.55, 0.13, 0.55], c: M, c2: M2, radial: true, flutter: true })
    b.add(b.B, { p: [0.12, 0.93, -0.05], s: [0.36, 0.09, 0.36], c: M2, c2: [0.52, 0.68, 0.3], radial: true, flutter: true })
    b.add(dome, { p: [0, 0.82, 0], r: [Math.PI, 0, 0], s: [0.5, 0.06, 0.5], c: [0.2, 0.3, 0.22], glow: 0.0 })
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2
      b.add(blobLo, { p: [Math.cos(a) * 0.36, 0.79, Math.sin(a) * 0.36], s: 0.025, c: [0.4, 0.95, 0.9], glow: 1 })
    }
  },
  fernpalm(b) {
    const T = [0.42, 0.33, 0.22]
    const top = stem(b, [0, 0, 0], 0.72, 0.04, 0.03, 0, 0.12, T, { stiff: true })
    const F = [0.24, 0.48, 0.18]
    const F2 = [0.42, 0.66, 0.24]
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2
      // fronda: ellissoide sottile che parte dalla cima e ricade
      b.add(b.B, { p: [top[0] + Math.cos(a) * 0.18, top[1] - 0.04, top[2] + Math.sin(a) * 0.18], r: [0, -a, -0.45], s: [0.24, 0.025, 0.07], c: F, c2: F2, flutter: true })
    }
    b.add(blobLo, { p: top, s: 0.06, c: [0.55, 0.4, 0.2] })
  },
  glowcap(b) {
    const ST = [0.86, 0.8, 0.7]
    b.add(cyl(0.045, 0.08, 0.68, 7), { c: [0.7, 0.62, 0.55], c2: ST, stiff: true })
    // cappello arancio (o viola: la tinta la varia lo shader per istanza)
    b.add(dome, { p: [0, 0.64, 0], s: [0.45, 0.3, 0.45], c: [0.95, 0.42, 0.12], c2: [1.0, 0.62, 0.25], glow: (k) => 0.25 + 0.2 * k })
    // lamelle luminose sotto il cappello
    b.add(dome, { p: [0, 0.645, 0], r: [Math.PI, 0, 0], s: [0.43, 0.05, 0.43], c: [1.0, 0.78, 0.4], glow: 1 })
    // funghetti ai piedi
    if (!b.lo) b.add(cyl(0.02, 0.03, 0.2, 5), { p: [0.18, 0, 0.06], c: ST, stiff: true })
    if (!b.lo) {
      b.add(dome, { p: [0.18, 0.19, 0.06], s: [0.11, 0.08, 0.11], c: [0.95, 0.42, 0.12], glow: 0.6 })
      b.add(cyl(0.015, 0.025, 0.13, 5), { p: [-0.14, 0, -0.1], c: ST, stiff: true })
      b.add(dome, { p: [-0.14, 0.12, -0.1], s: [0.08, 0.06, 0.08], c: [0.95, 0.42, 0.12], glow: 0.6 })
    }
  },
  lanternpod(b) {
    const S = [0.3, 0.32, 0.28]
    const P = [0.16, 0.5, 0.52]
    const P2 = [0.3, 0.72, 0.7]
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + k * 0.4
      const len = 0.55 + 0.4 * ((k * 37) % 10) / 10
      const tip = stem(b, [0, 0, 0], len, 0.022, 0.012, a, 0.18 + 0.12 * (k % 3), S)
      b.add(b.B, { p: tip, s: [0.12, 0.16, 0.12], c: P, c2: P2, radial: true, glow: 0.18, flutter: true })
      // macchie scure sui baccelli
      for (let d = 0; d < (b.lo ? 0 : 3); d++) {
        const ad = a + d * 2.1
        b.add(blobLo, { p: [tip[0] + Math.cos(ad) * 0.1, tip[1] + (d - 1) * 0.06, tip[2] + Math.sin(ad) * 0.1], s: 0.03, c: [0.06, 0.14, 0.2], flutter: true })
      }
    }
  },
  bramble(b) {
    const G = [0.26, 0.38, 0.16]
    const G2 = [0.4, 0.52, 0.2]
    b.add(b.B, { p: [0, 0.38, 0], s: [0.48, 0.38, 0.48], c: G, c2: G2, radial: true, flutter: true })
    b.add(b.B, { p: [0.32, 0.28, 0.1], s: [0.32, 0.26, 0.32], c: G, c2: G2, radial: true, flutter: true })
    b.add(b.B, { p: [-0.26, 0.3, -0.18], s: [0.34, 0.28, 0.34], c: G, c2: G2, radial: true, flutter: true })
    // bacche
    for (let k = 0; k < (b.lo ? 0 : 6); k++) {
      const a = k * 1.7
      b.add(blobLo, { p: [Math.cos(a) * 0.38, 0.45 + 0.1 * Math.sin(k), Math.sin(a) * 0.38], s: 0.05, c: [0.75, 0.18, 0.3], flutter: true })
    }
  },
  sunshade(b) {
    const top = stem(b, [0, 0, 0], 0.62, 0.05, 0.03, 0.5, 0.14, BARK, { stiff: true })
    stem(b, [0, 0.45, 0], 0.32, 0.025, 0.015, 2.4, 0.8, BARK)
    const G = [0.36, 0.44, 0.18]
    const G2 = [0.5, 0.56, 0.22]
    b.add(b.B, { p: [top[0], 0.82, top[2]], s: [0.6, 0.1, 0.6], c: G, c2: G2, radial: true, flutter: true })
    b.add(b.B, { p: [top[0] - 0.25, 0.72, top[2] + 0.1], s: [0.3, 0.07, 0.3], c: G, c2: G2, radial: true, flutter: true })
  },
  mistweeper(b) {
    b.add(cyl(0.04, 0.07, 0.6), { c: [0.3, 0.27, 0.24], stiff: true })
    const G = [0.28, 0.46, 0.4]
    const G2 = [0.4, 0.6, 0.5]
    b.add(b.B, { p: [0, 0.72, 0], s: [0.36, 0.26, 0.36], c: G, c2: G2, radial: true, flutter: true })
    // fronde ricadenti: coni rovesciati con le punte luminose
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2
      b.add(cone(0.08, 0.5, 5), { p: [Math.cos(a) * 0.28, 0.75, Math.sin(a) * 0.28], r: [Math.PI, 0, 0], c: G2, c2: G, glow: (k2) => (1 - k2) * 0.8, flutter: true })
    }
  },
  prismbloom(b) {
    const C = [0.45, 0.32, 0.9]
    const C2 = [0.72, 0.7, 1.0]
    const spikes = [[0, 0, 1, 0.12], [0.6, 1.3, 0.75, 0.1], [0.5, 3.0, 0.65, 0.09], [0.45, 4.4, 0.55, 0.08], [0.7, 5.5, 0.45, 0.07]]
    for (const [tilt, yaw, len, r] of spikes) {
      b.add(shard(r, len), { r: [tilt, yaw, 0], c: C, c2: C2, glow: (k) => 0.25 + 0.6 * k, stiff: true })
    }
  },
  thornpillar(b) {
    const G = [0.24, 0.42, 0.26]
    const G2 = [0.32, 0.52, 0.3]
    b.add(cyl(0.1, 0.12, 0.92, 8), { c: G, c2: G2, stiff: true })
    b.add(b.B, { p: [0, 0.92, 0], s: [0.1, 0.08, 0.1], c: G2, radial: true, stiff: true })
    b.add(cyl(0.065, 0.065, 0.22, 7), { p: [0.1, 0.4, 0], r: [0, 0, -Math.PI / 2], c: G, stiff: true })
    b.add(cyl(0.06, 0.065, 0.32, 7), { p: [0.3, 0.38, 0], c: G, c2: G2, stiff: true })
    b.add(cyl(0.055, 0.055, 0.18, 7), { p: [-0.08, 0.55, 0], r: [0, 0, Math.PI / 2], c: G, stiff: true })
    b.add(cyl(0.05, 0.055, 0.24, 7), { p: [-0.25, 0.54, 0], c: G, c2: G2, stiff: true })
    // fiore in cima
    b.add(blobLo, { p: [0, 1.0, 0], s: 0.06, c: [1.0, 0.45, 0.6], glow: 0.4 })
  },
  sunspike(b) {
    const C = [0.62, 0.42, 0.12]
    const C2 = [1.0, 0.82, 0.35]
    for (let k = 0; k < 9; k++) {
      const a = k * 2.399
      const tilt = 0.15 + 0.35 * ((k * 7) % 5) / 5
      b.add(shard(0.05, 0.55 + 0.45 * ((k * 3) % 4) / 4), { p: [Math.cos(a) * 0.08, 0, Math.sin(a) * 0.08], r: [tilt, a, 0], c: C, c2: C2, glow: (kk) => 0.08 + 0.25 * kk, stiff: true })
    }
  },
  ashwraith(b) {
    const A = [0.12, 0.1, 0.1]
    const A2 = [0.26, 0.22, 0.2]
    b.add(cyl(0.03, 0.065, 0.75, 6), { c: A, c2: A2, stiff: true })
    const branches = [[0.45, 0.5, 0.0, 0.3], [0.55, 0.45, 2.1, 0.25], [0.62, 0.4, 4.0, 0.22], [0.7, 0.55, 1.2, 0.18], [0.72, 0.6, 3.3, 0.16]]
    for (const [y, tilt, yaw, len] of branches) {
      const tip = stem(b, [0, y, 0], len, 0.022, 0.008, yaw, tilt + 0.4, A2, { stiff: true })
      stem(b, tip, len * 0.5, 0.01, 0.004, yaw + 0.7, tilt + 0.1, A2, { stiff: true })
    }
    // braci che covano ancora nelle crepe del tronco
    b.add(blobLo, { p: [0.03, 0.22, 0.02], s: [0.02, 0.06, 0.02], c: [1.0, 0.4, 0.1], glow: 1 })
    b.add(blobLo, { p: [-0.025, 0.42, -0.01], s: [0.015, 0.05, 0.015], c: [1.0, 0.35, 0.08], glow: 1 })
  },
  cindercoral(b) {
    const R = [0.62, 0.08, 0.1]
    const R2 = [0.95, 0.2, 0.16]
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + k * 0.3
      const tip = stem(b, [0, 0, 0], 0.55 + 0.35 * ((k * 5) % 7) / 7, 0.05, 0.025, a, 0.25 + 0.3 * (k % 3) / 2, R, { c2: R2 })
      const tip2 = stem(b, tip, 0.25, 0.022, 0.012, a + 0.9, 0.5, R2)
      b.add(blobLo, { p: tip, s: 0.045, c: [1.0, 0.55, 0.15], glow: 1 })
      b.add(blobLo, { p: tip2, s: 0.03, c: [1.0, 0.7, 0.25], glow: 1 })
    }
  },
  snowpuff(b) {
    const W = [0.86, 0.9, 0.96]
    const W2 = [1.0, 1.0, 1.0]
    b.add(cyl(0.02, 0.03, 0.4, 5), { c: [0.5, 0.52, 0.58], stiff: true })
    const puffs = [[0, 0.62, 0, 0.32], [0.26, 0.45, 0.1, 0.24], [-0.22, 0.5, -0.12, 0.26], [0.05, 0.4, -0.27, 0.22], [-0.05, 0.86, 0.05, 0.2]]
    for (const [x, y, z, r] of puffs) b.add(b.B, { p: [x, y, z], s: r, c: W, c2: W2, radial: true, glow: 0.08, flutter: true })
  },
  rimeglass(b) {
    const I = [0.55, 0.72, 0.92]
    const I2 = [0.85, 0.95, 1.0]
    b.add(shard(0.07, 0.6), { c: I, c2: I2, glow: 0.2, stiff: true })
    const shards = [[0.35, 0.6, 0.0, 0.45], [0.4, 0.5, 1.3, 0.4], [0.45, 0.55, 2.6, 0.42], [0.5, 0.45, 3.9, 0.38], [0.55, 0.5, 5.2, 0.36], [0.6, 0.15, 0.6, 0.4]]
    for (const [y, tilt, yaw, len] of shards) {
      b.add(shard(0.055, len), { p: [0, y, 0], r: [tilt, yaw, 0], c: I, c2: I2, glow: (k) => 0.15 + 0.55 * k, stiff: true })
    }
  },
  tidecrown(b) {
    // stelo che sale dal fondo del mare (la parte sott'acqua è nascosta)
    b.add(cyl(0.03, 0.05, 1.3, 6), { p: [0, -0.6, 0], c: [0.3, 0.22, 0.38], c2: [0.55, 0.4, 0.62], stiff: true })
    // campana viola-rosa, come una medusa gigante
    b.add(dome, { p: [0, 0.66, 0], s: [0.42, 0.3, 0.42], c: [0.62, 0.32, 0.78], c2: [0.9, 0.6, 0.95], glow: (k) => 0.3 + 0.3 * k, flutter: true })
    b.add(blobLo, { p: [0, 0.98, 0], s: 0.07, c: [0.7, 1.0, 0.95], glow: 1 })
    // tentacoli luminosi che ricadono fino al pelo dell'acqua
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2
      b.add(cyl(0.004, 0.012, 0.55, 4), { p: [Math.cos(a) * 0.36, 0.12, Math.sin(a) * 0.36], c: [0.3, 0.9, 0.95], glow: (kk) => 0.4 + 0.6 * (1 - kk), flutter: true })
      if (!b.lo) b.add(blobLo, { p: [Math.cos(a) * 0.36, 0.12, Math.sin(a) * 0.36], s: 0.025, c: [0.5, 1.0, 0.95], glow: 1, flutter: true })
    }
  },
  kelpspire(b) {
    const K = [0.22, 0.42, 0.32]
    const K2 = [0.38, 0.6, 0.4]
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1
      const tip = stem(b, [Math.cos(a) * 0.06, -0.3, Math.sin(a) * 0.06], 1.1 + 0.2 * k, 0.03, 0.015, a, 0.08, K, { c2: K2 })
      b.add(b.B, { p: tip, r: [0.3, a, 0], s: [0.18, 0.03, 0.12], c: K2, c2: [0.5, 0.75, 0.45], flutter: true })
      b.add(b.B, { p: [tip[0] * 0.7, tip[1] - 0.3, tip[2] * 0.7], r: [-0.3, a + 1, 0], s: [0.15, 0.025, 0.1], c: K, c2: K2, flutter: true })
    }
  },
  duskbloom(b) {
    b.add(cyl(0.025, 0.04, 0.55, 5), { c: [0.24, 0.4, 0.2], stiff: true })
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2
      b.add(b.B, { p: [Math.cos(a) * 0.16, 0.66, Math.sin(a) * 0.16], r: [0, -a, 0.75], s: [0.2, 0.04, 0.09], c: [0.78, 0.22, 0.55], c2: [1.0, 0.5, 0.8], glow: 0.35, flutter: true })
    }
    b.add(blobLo, { p: [0, 0.64, 0], s: 0.07, c: [1.0, 0.9, 0.55], glow: 1 })
    // foglie basse
    for (let k = 0; k < 4; k++) {
      const a = k * 1.6
      b.add(b.B, { p: [Math.cos(a) * 0.15, 0.12, Math.sin(a) * 0.15], r: [0, -a, 0.5], s: [0.2, 0.03, 0.07], c: [0.2, 0.42, 0.18], flutter: true })
    }
  },
  veilwood(b) {
    b.add(cyl(0.025, 0.05, 0.78, 6), { c: [0.62, 0.6, 0.68], c2: [0.8, 0.78, 0.86], stiff: true })
    const V = [0.4, 0.28, 0.55]
    const V2 = [0.62, 0.46, 0.78]
    b.add(b.B, { p: [0, 0.78, 0], s: [0.2, 0.32, 0.2], c: V, c2: V2, radial: true, flutter: true })
    b.add(b.B, { p: [0.1, 0.6, 0.05], s: [0.14, 0.2, 0.14], c: V, c2: V2, radial: true, flutter: true })
    b.add(b.B, { p: [-0.08, 0.66, -0.07], s: [0.13, 0.18, 0.13], c: V, c2: V2, radial: true, flutter: true })
    for (let k = 0; k < 5; k++) {
      const a = k * 1.3
      b.add(blobLo, { p: [Math.cos(a) * 0.17, 0.72 + 0.1 * Math.sin(k * 2), Math.sin(a) * 0.17], s: 0.02, c: [0.9, 0.8, 1.0], glow: 1, flutter: true })
    }
  }
}

/**
 * Geometrie di tutte le specie, nell'ordine di SPECIES (planet/flora.js).
 * @param {Array<{key:string}>} species
 * @param {boolean} lo versione semplificata per le piante lontane
 */
export function buildPlantGeometries(species, lo = false) {
  SEG_CAP = lo ? 3 : 99
  dome = lo ? domeLo : domeHi
  return species.map((s) => {
    const b = new PlantBuilder(lo)
    const fn = MODELS[s.key]
    if (!fn) throw new Error('missing plant model: ' + s.key)
    fn(b)
    return b.build()
  })
}

/** Quanto varia la tinta tra le istanze di una specie (radianti di tonalità). */
export const HUE_VARIATION = {
  glowcap: 2.2, // arancio <-> viola
  duskbloom: 0.9,
  prismbloom: 0.8,
  lanternpod: 0.5,
  tidecrown: 0.8,
  veilwood: 0.5,
  bramble: 0.25,
  elderoak: 0.22,
  canopyTitan: 0.15,
  cindercoral: 0.25
}
