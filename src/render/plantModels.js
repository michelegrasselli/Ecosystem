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
  /** @param {number} lod 0 completo, 1 semplificato, 2 lontano (pochi triangoli) */
  constructor(lod = 0) {
    this.lo = lod >= 1
    this.far = lod >= 2
    // chiome: icosaedro suddiviso da vicino, semplice o ottaedro da lontano
    this.B = lod >= 2 ? octa : lod >= 1 ? blob : blobHi
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
    // da lontano i dettagli minuti non luminosi non si vedono: via
    if (this.far && !o.glow && !o.keep) {
      const s0 = typeof o.s === 'number' ? o.s : o.s ? Math.max(o.s[0], o.s[2]) : 1
      if (s0 < 0.09) return
    }
    // foglie e petali (parti sottili): basta l'icosaedro semplice
    if ((geo === blobHi || geo === blob) && o.s && typeof o.s !== 'number' && Math.min(o.s[0], o.s[1], o.s[2]) < 0.06) geo = icoLo
    // parti tonde piccole: icosfera media
    if (geo === blobHi) {
      const sm = typeof o.s === 'number' ? o.s : o.s ? Math.max(o.s[0], o.s[1], o.s[2]) : 1
      if (sm < 0.2) geo = blob
    }
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
// da vicino: icosfera più fine con "grumi" di fogliame (320 triangoli)
const blobHi = (() => {
  const g = new THREE.IcosahedronGeometry(1, 2)
  const P = g.attributes.position
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i)
    const y = P.getY(i)
    const z = P.getZ(i)
    const k = 1 + 0.07 * Math.sin(x * 5.1 + y * 2.3) * Math.sin(z * 4.7 - x * 1.9) + 0.05 * Math.sin(y * 7.3 + z * 3.1)
    P.setXYZ(i, x * k, y * k, z * k)
  }
  return g
})()
const icoLo = new THREE.IcosahedronGeometry(1, 0) // parti piccole (20 triangoli)
const octa = new THREE.OctahedronGeometry(1, 0) // piante lontane (8 triangoli)
let blobLo = icoLo
// nei modelli semplificati (lontani) cilindri e coni hanno meno lati
let SEG_CAP = 99
const cyl = (rt, rb, h, seg = 6) => new THREE.CylinderGeometry(rt, rb, h, Math.min(seg, SEG_CAP), 1, SEG_CAP < 4).translate(0, h / 2, 0)
const cone = (r, h, seg = 7) => new THREE.ConeGeometry(r, h, Math.min(seg, SEG_CAP + 1), 1, false).translate(0, h / 2, 0)
const domeHi = new THREE.SphereGeometry(1, 9, 4, 0, Math.PI * 2, 0, Math.PI / 2) // calotta
const domeLo = new THREE.SphereGeometry(1, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2)
const domeFar = new THREE.SphereGeometry(1, 4, 1, 0, Math.PI * 2, 0, Math.PI / 2)
let dome = domeHi
const shard = (r, h) => new THREE.ConeGeometry(r, h, 4, 1, false).translate(0, h / 2, 0)

const BARK = [0.3, 0.22, 0.16]
const BARK_DARK = [0.2, 0.15, 0.11]

/** Ramo/stelo inclinato: cilindro dalla base (x,y,z) lungo la direzione (ax, az) con inclinazione tilt. */
function stem(b, base, len, r0, r1, yaw, tilt, col, extra = {}) {
  // da lontano i rami sottili non si vedono
  if (!(b.far && r0 < 0.03 && !extra.glow)) b.add(cyl(r1, r0, 1, 5), { p: base, r: [tilt, yaw, 0], s: [1, len, 1], c: col, c2: extra.c2, glow: extra.glow, stiff: extra.stiff })
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
    // chioma a ombrello fatta di cuscini di fogliame a quote diverse (scuri
    // sotto, chiari in cima): da sopra una cupola irregolare, non un disco
    const M = [0.16, 0.3, 0.13]
    const M2 = [0.4, 0.56, 0.24]
    const pads = [[0, 0.9, 0, 0.3, 0.16], [0.3, 0.86, 0.1, 0.26, 0.13], [-0.28, 0.87, 0.14, 0.25, 0.13], [0.06, 0.85, -0.32, 0.26, 0.13], [-0.18, 0.92, -0.2, 0.22, 0.12], [0.2, 0.93, -0.16, 0.2, 0.11], [0.1, 0.88, 0.32, 0.22, 0.12], [-0.38, 0.83, -0.08, 0.18, 0.1]]
    const np = b.far ? 4 : pads.length
    for (let k = 0; k < np; k++) {
      const [x, y, z, r, ry] = pads[k]
      b.add(b.B, { p: [x, y, z], s: [r, ry, r], c: M, c2: M2, radial: true, flutter: true })
    }
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
    // acacia: tronco inclinato che si apre in rami, chioma a ombrello fatta
    // di cuscini di fogliame sovrapposti (scuri sotto, chiari in cima)
    const top = stem(b, [0, 0, 0], 0.56, 0.05, 0.03, 0.5, 0.14, BARK, { stiff: true })
    stem(b, top, 0.22, 0.03, 0.015, 0.2, 0.9, BARK)
    stem(b, top, 0.22, 0.03, 0.015, 2.4, 0.85, BARK)
    stem(b, top, 0.2, 0.025, 0.012, 4.3, 0.8, BARK)
    const G = [0.2, 0.3, 0.11]
    const G2 = [0.44, 0.54, 0.2]
    const pads = [[0, 0.2, 0, 0.3], [0.24, 0.16, 0.1, 0.24], [-0.22, 0.17, 0.14, 0.23], [0.04, 0.15, -0.25, 0.25], [-0.16, 0.22, -0.13, 0.2], [0.15, 0.23, -0.06, 0.18], [0.3, 0.13, -0.2, 0.17], [-0.3, 0.14, -0.05, 0.17]]
    const n = b.far ? 4 : pads.length
    for (let k = 0; k < n; k++) {
      const [x, y, z, r] = pads[k]
      b.add(b.B, { p: [top[0] + x, top[1] + y, top[2] + z], s: [r, r * 0.34, r], c: G, c2: G2, radial: true, flutter: true })
    }
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
  },
  // ------------------------------------------------------------------
  // specie nuove, ispirate alle immagini di contesto/
  moonshroom(b) {
    // colonia di funghetti sottili con cappelli turchesi luminosi
    const n = b.far ? 4 : b.lo ? 6 : 10
    for (let k = 0; k < n; k++) {
      const a = k * 2.399
      const r = k === 0 ? 0 : 0.12 + 0.3 * (((k * 37) % 11) / 11)
      const h = 0.4 + 0.6 * (((k * 53) % 13) / 13)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      b.add(cyl(0.012, 0.022, h, 5), { p: [x, 0, z], r: [0.08 * Math.sin(a), 0, 0.08 * Math.cos(a)], c: [0.62, 0.82, 0.85], c2: [0.85, 0.97, 1.0], glow: 0.35, stiff: true })
      const cr = 0.08 + 0.07 * (((k * 29) % 7) / 7)
      b.add(dome, { p: [x, h, z], s: [cr, cr * 0.65, cr], c: [0.3, 0.85, 0.95], c2: [0.75, 1.0, 1.0], glow: 0.9, keep: true })
    }
  },
  blushwood(b) {
    // tronco dorato attorcigliato e nuvole di fiori rosa e lilla
    const T = [0.5, 0.34, 0.2]
    const T2 = [0.66, 0.48, 0.28]
    b.add(cyl(0.04, 0.08, 0.5, 6), { r: [0.08, 0, 0.05], c: T, c2: T2, stiff: true })
    b.add(cyl(0.03, 0.06, 0.46, 6), { p: [0.03, 0, -0.02], r: [-0.12, 1.4, 0.1], c: T, c2: T2, stiff: true })
    const tips = [stem(b, [0, 0.42, 0], 0.26, 0.035, 0.018, 0.3, 0.8, T2), stem(b, [0, 0.45, 0], 0.24, 0.03, 0.016, 2.5, 0.85, T2), stem(b, [0, 0.4, 0], 0.22, 0.03, 0.015, 4.4, 0.8, T2)]
    const P = [0.86, 0.45, 0.6]
    const P2 = [1.0, 0.72, 0.82]
    b.add(b.B, { p: [0, 0.74, 0], s: [0.3, 0.22, 0.3], c: P, c2: P2, radial: true, flutter: true, glow: 0.08 })
    for (let k = 0; k < 3; k++) b.add(b.B, { p: [tips[k][0], tips[k][1] + 0.04, tips[k][2]], s: [0.22, 0.16, 0.22], c: k === 1 ? [0.62, 0.45, 0.82] : P, c2: k === 1 ? [0.8, 0.66, 0.95] : P2, radial: true, flutter: true, glow: 0.08 })
    // fiori sparsi attorno alla chioma
    for (let k = 0; k < (b.lo ? 0 : 8); k++) {
      const a = k * 2.1
      b.add(blobLo, { p: [Math.cos(a) * 0.34, 0.6 + 0.2 * Math.sin(k * 1.7), Math.sin(a) * 0.34], s: 0.035, c: [1.0, 0.85, 0.9], flutter: true })
    }
  },
  emberbriar(b) {
    // rami sottili e contorti avvolti da fiamme, con sfere azzurre
    const D = [0.16, 0.1, 0.08]
    const D2 = [0.42, 0.24, 0.12]
    const main = stem(b, [0, 0, 0], 0.4, 0.04, 0.025, 0, 0.1, D, { c2: D2, stiff: true })
    const twigs = [[0.4, 0.7, 0.4], [2.0, 0.6, 0.45], [3.6, 0.75, 0.38], [5.0, 0.5, 0.42]]
    for (const [yaw, tilt, len] of twigs) {
      const t1 = stem(b, [main[0], main[1] - 0.06, main[2]], len, 0.02, 0.008, yaw, tilt, D2, { stiff: true })
      // fiamma: cono luminoso arancio-giallo
      b.add(cone(0.07, 0.24, 6), { p: [t1[0], t1[1] - 0.06, t1[2]], c: [1.0, 0.42, 0.06], c2: [1.0, 0.86, 0.4], glow: 1, flutter: true })
    }
    b.add(cone(0.12, 0.34, 7), { p: [main[0], main[1] - 0.1, main[2]], c: [1.0, 0.36, 0.05], c2: [1.0, 0.8, 0.35], glow: 1, flutter: true })
    b.add(blobLo, { p: [0.22, 0.48, 0.12], s: 0.045, c: [0.35, 0.9, 1.0], glow: 1, flutter: true })
    b.add(blobLo, { p: [-0.2, 0.36, -0.15], s: 0.035, c: [0.35, 0.9, 1.0], glow: 1, flutter: true })
  },
  featherfern(b) {
    // fronde a piuma blu e viola, luminose verso la punta
    const n = b.far ? 4 : 7
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.3
      const tilt = k === 0 ? 0.05 : 0.45 + 0.25 * (k % 2)
      b.add(b.B, { p: [Math.cos(a) * 0.1, 0.42, Math.sin(a) * 0.1], r: [tilt, a, 0], s: [0.08, 0.45, 0.025], c: [0.12, 0.26, 0.7], c2: [0.45, 0.72, 1.0], glow: (kk) => 0.1 + 0.5 * kk, flutter: true, keep: true })
    }
  },
  jellybell(b) {
    // steli ad arco con campane rosa che pendono, fili luminosi come meduse
    const bells = b.far ? [[0, 1, 0]] : [[0, 1, 0], [2.2, 0.7, 0.6], [4.1, 0.55, 0.5]]
    for (const [yaw, h, tilt] of bells) {
      const t1 = stem(b, [0, 0, 0], h * 0.75, 0.025, 0.016, yaw, tilt * 0.4, [0.3, 0.3, 0.36], { stiff: true })
      const t2 = stem(b, t1, h * 0.22, 0.016, 0.01, yaw, tilt * 0.4 + 1.2, [0.4, 0.38, 0.46])
      const top = [t2[0], t2[1] - 0.02, t2[2]]
      const r = 0.13 * h + 0.04
      b.add(dome, { p: top, s: [r, r * 0.8, r], c: [0.9, 0.42, 0.68], c2: [1.0, 0.72, 0.85], glow: 0.75, flutter: true, keep: true })
      for (let k = 0; k < (b.lo ? 0 : 6); k++) {
        const a = (k / 6) * Math.PI * 2
        b.add(cyl(0.004, 0.008, 0.18 * h, 3), { p: [top[0] + Math.cos(a) * r * 0.75, top[1] - 0.18 * h, top[2] + Math.sin(a) * r * 0.75], c: [1.0, 0.6, 0.85], glow: 1, flutter: true })
      }
      b.add(blobLo, { p: [top[0], top[1] + 0.005, top[2]], s: r * 0.45, c: [1.0, 0.85, 0.7], glow: 1 })
    }
  },
  mossfather(b) {
    // gigante antico: tronco enorme coperto di muschio, radici che si aprono,
    // funghi turchesi sulla corteccia e muschio che pende dalla chioma
    const MB = [0.26, 0.27, 0.15]
    const MB2 = [0.38, 0.44, 0.2]
    b.add(cyl(0.08, 0.14, 0.66, 8), { c: MB, c2: MB2, stiff: true })
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.2
      b.add(cone(0.06, 0.34, 5), { p: [Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12], r: [1.15, -a + Math.PI / 2, 0], c: MB, c2: [0.32, 0.38, 0.18], stiff: true })
    }
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.6
      stem(b, [0, 0.56, 0], 0.3, 0.05, 0.025, -a + Math.PI / 2, 0.95, MB2, { stiff: true })
    }
    const G = [0.14, 0.27, 0.13]
    const G2 = [0.27, 0.44, 0.19]
    const crown = [[0, 0.84, 0, 0.42, 0.24], [0.3, 0.74, 0.12, 0.3, 0.2], [-0.28, 0.76, -0.14, 0.32, 0.2], [0.06, 0.74, -0.3, 0.3, 0.18], [-0.08, 0.72, 0.3, 0.28, 0.18]]
    for (const [x, y, z, r, ry] of crown) b.add(b.B, { p: [x, y, z], s: [r, ry, r], c: G, c2: G2, radial: true, flutter: true })
    // funghi a mensola luminosi sul tronco
    for (let k = 0; k < (b.far ? 2 : 5); k++) {
      const a = k * 1.9
      b.add(dome, { p: [Math.cos(a) * 0.1, 0.18 + k * 0.08, Math.sin(a) * 0.1], s: [0.05, 0.02, 0.05], c: [0.3, 0.85, 0.9], glow: 1 })
    }
    // muschio pendente
    for (let k = 0; k < (b.lo ? 3 : 8); k++) {
      const a = k * 0.8
      b.add(cone(0.025, 0.2, 4), { p: [Math.cos(a) * 0.36, 0.72, Math.sin(a) * 0.36], r: [Math.PI, 0, 0], c: [0.36, 0.44, 0.24], c2: [0.3, 0.36, 0.2], flutter: true })
    }
  },
  petalcrown(b) {
    // albero-fiore: tronco attorcigliato, chioma fatta di enormi petali
    const T = [0.36, 0.26, 0.24]
    const T2 = [0.5, 0.36, 0.3]
    b.add(cyl(0.035, 0.07, 0.62, 6), { r: [0.06, 0, -0.05], c: T, c2: T2, stiff: true })
    for (let k = 0; k < 4; k++) stem(b, [0, 0.2 + k * 0.1, 0], 0.12, 0.012, 0.005, k * 1.7, 1.1, T2, { stiff: true })
    const n = b.far ? 5 : 9
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      b.add(b.B, { p: [Math.cos(a) * 0.22, 0.7, Math.sin(a) * 0.22], r: [0, -a, 0.42], s: [0.27, 0.035, 0.12], c: [0.88, 0.36, 0.4], c2: [1.0, 0.72, 0.5], glow: 0.15, flutter: true, keep: true })
    }
    // anello interno più scuro e cuore luminoso
    for (let k = 0; k < (b.lo ? 0 : 6); k++) {
      const a = (k / 6) * Math.PI * 2 + 0.3
      b.add(b.B, { p: [Math.cos(a) * 0.1, 0.7, Math.sin(a) * 0.1], r: [0, -a, 0.9], s: [0.14, 0.03, 0.07], c: [0.55, 0.15, 0.35], c2: [0.85, 0.3, 0.5], glow: 0.2, flutter: true })
    }
    b.add(b.B, { p: [0, 0.74, 0], s: [0.08, 0.06, 0.08], c: [1.0, 0.85, 0.45], glow: 1, radial: true })
  },
  candlewick(b) {
    // steli sottili con lanterne arancio accese, foglie larghe alla base
    const n = b.far ? 2 : 4
    for (let k = 0; k < n; k++) {
      const a = k * 2.3
      const len = 0.65 + (0.3 * ((k * 3) % 4)) / 3
      const tip = stem(b, [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], len, 0.016, 0.01, a, 0.12 + 0.1 * k, [0.3, 0.36, 0.2])
      b.add(cone(0.07, 0.14, 6), { p: [tip[0], tip[1] - 0.05, tip[2]], c: [1.0, 0.5, 0.1], c2: [1.0, 0.88, 0.45], glow: 1, keep: true })
      b.add(dome, { p: [tip[0], tip[1] + 0.07, tip[2]], s: [0.05, 0.03, 0.05], c: [0.5, 0.3, 0.15] })
    }
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1 + 0.5
      b.add(b.B, { p: [Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14], r: [0, -a, 0.6], s: [0.2, 0.025, 0.08], c: [0.2, 0.42, 0.18], c2: [0.4, 0.6, 0.25], flutter: true })
    }
  },
  starlily(b) {
    // foglie lunghe, stelo e grande fiore a stella con cuore dorato
    for (let k = 0; k < 4; k++) {
      const a = k * 1.6
      b.add(b.B, { p: [Math.cos(a) * 0.14, 0.14, Math.sin(a) * 0.14], r: [0, -a, 0.7], s: [0.24, 0.03, 0.06], c: [0.18, 0.4, 0.2], c2: [0.32, 0.58, 0.26], flutter: true })
    }
    b.add(cyl(0.015, 0.025, 0.75, 5), { c: [0.22, 0.42, 0.2], stiff: true })
    const n = b.far ? 4 : 6
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      b.add(b.B, { p: [Math.cos(a) * 0.17, 0.8, Math.sin(a) * 0.17], r: [0, -a, 0.28], s: [0.2, 0.025, 0.06], c: [0.62, 0.42, 0.9], c2: [0.96, 0.92, 1.0], glow: 0.25, flutter: true, keep: true })
    }
    b.add(blobLo, { p: [0, 0.82, 0], s: 0.06, c: [1.0, 0.82, 0.3], glow: 1 })
  },
  broadleaf(b) {
    // foglie enormi, larghe e lucide, che si aprono da un fusto corto
    b.add(cyl(0.035, 0.06, 0.3, 6), { c: [0.32, 0.42, 0.2], stiff: true })
    const n = b.far ? 4 : 7
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + k * 0.4
      const tilt = 0.25 + (0.5 * ((k * 5) % 3)) / 2
      b.add(b.B, { p: [Math.cos(a) * 0.3, 0.42 + (0.25 * ((k * 7) % 4)) / 3, Math.sin(a) * 0.3], r: [0, -a, tilt], s: [0.38, 0.025, 0.13], c: [0.16, 0.44, 0.18], c2: [0.36, 0.66, 0.24], flutter: true, keep: true })
    }
  },
  reedmace(b) {
    // canneto: steli fitti, foglie a lama e spighe brune di tifa
    const n = b.far ? 4 : b.lo ? 7 : 12
    for (let k = 0; k < n; k++) {
      const a = k * 2.399
      const r = 0.05 + 0.32 * (((k * 41) % 13) / 13)
      const h = 0.6 + 0.4 * (((k * 17) % 7) / 7)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const tilt = 0.05 + 0.1 * (k % 3)
      const tip = stem(b, [x, 0, z], h, 0.012, 0.008, a, tilt, [0.36, 0.48, 0.22], { c2: [0.5, 0.6, 0.3] })
      if (k % 2 === 0) b.add(cyl(0.025, 0.025, 0.14, 5), { p: [tip[0], tip[1] - 0.16, tip[2]], r: [tilt, a, 0], c: [0.36, 0.22, 0.12], keep: true })
      else b.add(shard(0.02, h * 0.9), { p: [x, 0, z], r: [tilt + 0.2, a + 1, 0], c: [0.3, 0.46, 0.2], c2: [0.55, 0.62, 0.3], flutter: true, keep: true })
    }
  },
  bogcypress(b) {
    // cipresso di palude: base svasata, "ginocchia" che spuntano dall'acqua,
    // chioma a strati e barbe di muschio grigio-verde
    const T = [0.32, 0.26, 0.22]
    b.add(cone(0.13, 0.3, 8), { c: [0.26, 0.22, 0.2], stiff: true })
    b.add(cyl(0.035, 0.06, 0.78, 6), { c: T, c2: [0.42, 0.36, 0.3], stiff: true })
    for (let k = 0; k < (b.far ? 0 : 4); k++) {
      const a = k * 1.7 + 0.4
      b.add(cone(0.025, 0.08, 5), { p: [Math.cos(a) * 0.24, 0, Math.sin(a) * 0.24], c: T, stiff: true })
    }
    const G = [0.24, 0.32, 0.15]
    const G2 = [0.36, 0.46, 0.2]
    b.add(b.B, { p: [0, 0.62, 0], s: [0.36, 0.1, 0.36], c: G, c2: G2, radial: true, flutter: true })
    b.add(b.B, { p: [0.04, 0.78, -0.02], s: [0.28, 0.09, 0.28], c: G, c2: G2, radial: true, flutter: true })
    b.add(b.B, { p: [0, 0.92, 0.02], s: [0.17, 0.08, 0.17], c: G2, c2: [0.44, 0.54, 0.24], radial: true, flutter: true })
    for (let k = 0; k < (b.lo ? 3 : 8); k++) {
      const a = k * 0.79
      b.add(cone(0.03, 0.24, 4), { p: [Math.cos(a) * 0.3, 0.6, Math.sin(a) * 0.3], r: [Math.PI, 0, 0], c: [0.6, 0.64, 0.5], c2: [0.46, 0.52, 0.38], flutter: true })
    }
    // lucciole
    for (let k = 0; k < (b.lo ? 0 : 4); k++) {
      const a = k * 1.4
      b.add(blobLo, { p: [Math.cos(a) * 0.42, 0.35 + 0.1 * k, Math.sin(a) * 0.42], s: 0.015, c: [1.0, 0.92, 0.45], glow: 1, flutter: true })
    }
  },
  frostlantern(b) {
    // steli ricurvi con sfere di ghiaccio azzurre accese dall'interno
    const n = b.far ? 3 : 5
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      const t1 = stem(b, [0, 0, 0], 0.5 + 0.12 * (k % 3), 0.018, 0.01, a, 0.3 + 0.15 * (k % 2), [0.45, 0.55, 0.66])
      const t2 = stem(b, t1, 0.2, 0.01, 0.006, a, 1.4, [0.6, 0.7, 0.8])
      b.add(b.B, { p: [t2[0], t2[1] - 0.06, t2[2]], s: 0.085, c: [0.5, 0.85, 1.0], c2: [0.85, 0.97, 1.0], glow: 0.9, radial: true, keep: true })
    }
    b.add(b.B, { p: [0, 0.05, 0], s: [0.22, 0.07, 0.22], c: [0.7, 0.82, 0.9], radial: true })
  },
  dunepalm(b) {
    // palma delle oasi: fusto curvo, fronde dorate e frutti d'ambra
    const T = [0.5, 0.4, 0.26]
    const T2 = [0.62, 0.5, 0.32]
    const m = stem(b, [0, 0, 0], 0.5, 0.045, 0.035, 0.6, 0.18, T, { c2: T2, stiff: true })
    const top = stem(b, m, 0.4, 0.035, 0.028, 0.6, 0.32, T2, { stiff: true })
    const n = b.far ? 5 : 9
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2
      b.add(b.B, { p: [top[0] + Math.cos(a) * 0.2, top[1] - 0.05, top[2] + Math.sin(a) * 0.2], r: [0, -a, -0.5], s: [0.27, 0.022, 0.06], c: [0.5, 0.5, 0.18], c2: [0.86, 0.74, 0.3], flutter: true, keep: true })
    }
    for (let k = 0; k < (b.lo ? 0 : 4); k++) {
      const a = k * 1.6
      b.add(blobLo, { p: [top[0] + Math.cos(a) * 0.05, top[1] - 0.06, top[2] + Math.sin(a) * 0.05], s: 0.035, c: [1.0, 0.6, 0.15], glow: 0.7 })
    }
  },
  obsidianbloom(b) {
    // schegge di vetro vulcanico nero, punte e cuore di magma
    const n = b.far ? 4 : 7
    for (let k = 0; k < n; k++) {
      const a = k * 2.399
      const tilt = 0.2 + 0.45 * (((k * 7) % 5) / 5)
      const len = 0.55 + 0.45 * (((k * 3) % 4) / 3)
      b.add(shard(0.08, len), { p: [Math.cos(a) * 0.06, 0, Math.sin(a) * 0.06], r: [tilt, a, 0], c: [0.07, 0.06, 0.09], c2: [0.75, 0.22, 0.08], glow: (kk) => Math.pow(kk, 4) * 0.9, stiff: true })
    }
    b.add(b.B, { p: [0, 0.08, 0], s: [0.13, 0.1, 0.13], c: [1.0, 0.42, 0.08], c2: [1.0, 0.75, 0.3], glow: 1, radial: true })
  },
  // ------------------------------------------- valle dei cristalli
  // (contesto/cristalli.png: prismi azzurri e rosa con venature luminose,
  // grappoli pendenti, granuli scintillanti sul suolo viola)
  crystalspire(b) {
    // prismi esagonali giganti, inclinati, con la punta più chiara
    const C = [0.08, 0.2, 0.62]
    const C2 = [0.4, 0.78, 1.0]
    const spires = [[0, 0, 0, 1.0, 0.13], [0.32, 0.6, 0.12, 0.72, 0.1], [0.4, 2.5, 0.14, 0.6, 0.09], [0.5, 4.1, 0.12, 0.5, 0.08], [0.62, 5.4, 0.16, 0.38, 0.07]]
    const n = b.far ? 3 : spires.length
    for (let k = 0; k < n; k++) {
      const [tilt, yaw, off, len, r] = spires[k]
      prism(b, [Math.cos(yaw) * off, 0, Math.sin(yaw) * off], len, r, tilt, yaw, C, C2, (kk) => 0.1 + 0.4 * kk * kk)
    }
    // venature luminose: lame sottili lungo il prisma centrale
    if (!b.lo) {
      for (let k = 0; k < 3; k++) b.add(cyl(0.012, 0.012, 0.7, 4), { p: [Math.cos(k * 2.1) * 0.12, 0.05, Math.sin(k * 2.1) * 0.12], r: [0.04, k * 2.1, 0], c: [0.8, 1.0, 1.0], glow: 1, stiff: true })
    }
    // roccia viola alla base
    b.add(b.B, { p: [0, 0.02, 0], s: [0.24, 0.08, 0.22], c: [0.2, 0.14, 0.32], c2: [0.32, 0.22, 0.48], radial: true, stiff: true })
  },
  rosequartz(b) {
    const C = [0.45, 0.08, 0.4]
    const C2 = [0.95, 0.5, 0.82]
    const n = b.far ? 4 : 7
    for (let k = 0; k < n; k++) {
      const a = k * 2.399
      const tilt = k === 0 ? 0.05 : 0.3 + 0.4 * (((k * 7) % 5) / 5)
      const len = k === 0 ? 1.0 : 0.45 + 0.4 * (((k * 3) % 4) / 3)
      prism(b, [Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], len, 0.09 + 0.03 * (k === 0), tilt, a, C, C2, (kk) => 0.1 + 0.4 * kk * kk)
    }
  },
  shardwillow(b) {
    // tronco di cristallo violaceo, rami luminosi, grappoli di cristalli
    // azzurri appesi (come il grappolo che pende dalla volta nell'immagine)
    const T = [0.32, 0.22, 0.55]
    const T2 = [0.55, 0.45, 0.85]
    b.add(cyl(0.04, 0.08, 0.62, 6), { c: T, c2: T2, glow: 0.15, stiff: true })
    const H = [0.1, 0.4, 0.8]
    const H2 = [0.45, 0.85, 1.0]
    const nb = b.far ? 4 : 6
    for (let k = 0; k < nb; k++) {
      const a = (k / nb) * Math.PI * 2 + 0.4
      const tip = stem(b, [0, 0.5 + 0.03 * (k % 3), 0], 0.36, 0.03, 0.015, a, 0.95 + 0.15 * (k % 2), T2, { glow: 0.3 })
      // grappolo pendente: schegge rovesciate
      const ns = b.lo ? 2 : 4
      for (let j = 0; j < ns; j++) {
        const aj = a + j * 1.7
        const len = 0.22 + 0.1 * ((j * 5) % 3)
        b.add(shard(0.04, len), { p: [tip[0] + Math.cos(aj) * 0.03, tip[1] + 0.02, tip[2] + Math.sin(aj) * 0.03], r: [Math.PI - 0.15 * j, aj, 0], c: H2, c2: H, glow: (kk) => 0.15 + 0.45 * (1 - kk), flutter: true })
      }
    }
    // punte in cima
    for (let k = 0; k < (b.far ? 2 : 4); k++) {
      const a = k * 1.9
      b.add(shard(0.06, 0.42), { p: [0, 0.6, 0], r: [0.25 + 0.15 * k, a, 0], c: T2, c2: H2, glow: (kk) => 0.1 + 0.4 * kk, stiff: true })
    }
  },
  glimmermoss(b) {
    // cuscini bassi blu-viola punteggiati di granuli luminosi
    const M = [0.12, 0.12, 0.34]
    const M2 = [0.24, 0.22, 0.55]
    b.add(dome, { s: [0.9, 0.35, 0.9], c: M, c2: M2, keep: true })
    b.add(dome, { p: [0.55, 0, 0.3], s: [0.5, 0.25, 0.5], c: M, c2: M2, keep: true })
    b.add(dome, { p: [-0.5, 0, -0.35], s: [0.55, 0.28, 0.55], c: M, c2: M2, keep: true })
    const ng = b.far ? 6 : b.lo ? 14 : 34
    for (let k = 0; k < ng; k++) {
      const a = k * 2.399
      const r = 0.95 * Math.sqrt((k + 0.5) / ng)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      const y = 0.32 * Math.sqrt(Math.max(0, 1 - r * r)) + 0.03
      const pink = k % 4 === 0
      b.add(blobLo, { p: [x, y, z], s: b.far ? 0.09 : 0.045, c: pink ? [1.0, 0.55, 0.95] : [0.45, 0.85, 1.0], glow: 1, keep: true })
    }
  },
  geodebloom(b) {
    // geode aperto: guscio di roccia scura e cuore di cristalli viola
    b.add(dome, { s: [0.55, 0.4, 0.55], c: [0.22, 0.2, 0.26], c2: [0.36, 0.33, 0.4], keep: true })
    const C = [0.42, 0.18, 0.75]
    const C2 = [0.85, 0.6, 1.0]
    const n = b.far ? 4 : 9
    for (let k = 0; k < n; k++) {
      const a = k * 2.399
      const tilt = k === 0 ? 0 : 0.25 + 0.5 * (((k * 7) % 5) / 5)
      const len = k === 0 ? 0.95 : 0.4 + 0.45 * (((k * 3) % 4) / 3)
      b.add(shard(0.07, len), { p: [Math.cos(a) * 0.12, 0.25, Math.sin(a) * 0.12], r: [tilt, a, 0], c: C, c2: C2, glow: (kk) => 0.15 + 0.45 * kk, stiff: true })
    }
  },
  // ------------------------------------------- mare basso e lagune
  // la base è al pelo dell'acqua: le parti sotto y = 0 sono sommerse
  coralfan(b) {
    // ventagli di corallo rosso-arancio: lamina sottile e nervature, punte accese
    const C = [0.6, 0.12, 0.1]
    const C2 = [1.0, 0.52, 0.26]
    const fans = [[0.3, 1.0], [2.2, 0.8], [4.2, 0.68]]
    for (const [yaw, sc] of fans) {
      const base = [Math.sin(yaw) * 0.06, -0.12, Math.cos(yaw) * 0.06]
      b.add(b.B, { p: [base[0], 0.42 * sc - 0.08, base[2]], r: [0, yaw, 0], s: [0.02, 0.42 * sc, 0.3 * sc], c: [0.42, 0.08, 0.08], c2: [0.85, 0.32, 0.18], radial: true, stiff: true, glow: (k) => 0.15 * k * k })
      const nb = b.lo ? 3 : 6
      for (let j = 0; j < nb; j++) {
        const t = -0.85 + (1.7 * j) / (nb - 1)
        const tip = stem(b, base, (0.95 - 0.25 * Math.abs(t)) * sc, 0.026, 0.01, yaw, t, [0.7, 0.2, 0.14], { c2: [1.0, 0.6, 0.35], stiff: true })
        b.add(blobLo, { p: tip, s: 0.03 * sc + 0.01, c: [1.0, 0.75, 0.45], glow: 0.9 })
      }
    }
  },
  bubblekelp(b) {
    // steli d'alga oliva con vesciche dorate in cima e galleggianti sul pelo dell'acqua
    const K = [0.28, 0.32, 0.12]
    const K2 = [0.5, 0.5, 0.2]
    for (let k = 0; k < 5; k++) {
      const a = k * 1.26
      const len = 0.62 + 0.38 * (((k * 3) % 5) / 4)
      const tip = stem(b, [Math.cos(a) * 0.1, -0.25, Math.sin(a) * 0.1], len + 0.25, 0.026, 0.012, a, 0.08 + 0.07 * (k % 3), K, { c2: K2 })
      b.add(b.B, { p: tip, s: [0.075, 0.1, 0.075], c: [0.82, 0.58, 0.16], c2: [1.0, 0.86, 0.42], radial: true, glow: 0.35, flutter: true })
      b.add(b.B, { p: [tip[0] * 1.3, tip[1] - 0.12, tip[2] * 1.3], r: [0.6, a, 0], s: [0.16, 0.022, 0.06], c: K2, c2: [0.62, 0.6, 0.24], flutter: true })
      if (!b.lo) b.add(b.B, { p: [tip[0] * 0.8, tip[1] - 0.3, tip[2] * 0.8], s: [0.05, 0.065, 0.05], c: [0.8, 0.56, 0.16], radial: true, glow: 0.25 })
    }
    const nf = b.lo ? 5 : 11
    for (let j = 0; j < nf; j++) {
      const a = j * 2.399
      const r = 0.12 + 0.38 * Math.sqrt(j / nf)
      b.add(blobLo, { p: [Math.cos(a) * r, 0.015, Math.sin(a) * r], s: [0.05 + 0.02 * (j % 3), 0.035, 0.05 + 0.02 * (j % 3)], c: [0.78, 0.56, 0.15], c2: [1.0, 0.82, 0.38], glow: 0.2, flutter: true })
    }
  },
  anemone(b) {
    // colonna rosa-viola che emerge, bocca chiara e corona di tentacoli turchesi luminosi
    const C = [0.5, 0.16, 0.42]
    const C2 = [0.88, 0.42, 0.68]
    b.add(cyl(0.15, 0.2, 0.62, 10), { p: [0, -0.2, 0], c: C, c2: C2, stiff: true })
    b.add(dome, { p: [0, 0.415, 0], s: [0.16, 0.04, 0.16], c: [0.95, 0.72, 0.5], glow: 0.6 })
    const n = b.far ? 8 : b.lo ? 14 : 24
    for (let k = 0; k < n; k++) {
      const a = k * 2.399
      const outer = k % 2
      const rr = 0.1 + 0.06 * outer
      const tilt = 0.3 + 0.55 * outer + 0.08 * ((k * 7) % 3)
      b.add(cone(0.03, 0.4 + 0.12 * ((k * 5) % 3), 5), { p: [Math.cos(a) * rr, 0.4, Math.sin(a) * rr], r: [tilt, Math.PI / 2 - a, 0], c: [0.25, 0.7, 0.78], c2: [0.75, 1.0, 0.95], glow: (kk) => 0.2 + 0.8 * kk, flutter: true })
    }
  },
  pearlmouth(b) {
    // conchiglia gigante socchiusa sul pelo dell'acqua, madreperla e perla accesa
    const S1 = [0.72, 0.6, 0.55]
    const S2 = [0.95, 0.88, 0.8]
    b.add(dome, { p: [0, 0.2, 0], r: [Math.PI, 0, 0], s: [0.55, 0.24, 0.48], c: S2, c2: S1, keep: true })
    b.add(dome, { p: [0, 0.22, -0.2], r: [-1.05, 0, 0], s: [0.55, 0.2, 0.46], c: S1, c2: S2, keep: true })
    // costolature
    if (!b.lo) {
      for (let k = 0; k < 7; k++) {
        const a = -1.2 + k * 0.4
        b.add(cyl(0.018, 0.018, 0.5, 4), { p: [Math.sin(a) * 0.05, 0.2, -0.15], r: [-1.05 + 0.15, a * 0.55, 0], c: [0.82, 0.62, 0.6] })
      }
    }
    // interno di madreperla e mantello turchese
    b.add(dome, { p: [0, 0.205, 0.02], s: [0.48, 0.03, 0.4], c: [0.6, 0.72, 0.9], c2: [0.95, 0.8, 1.0], glow: 0.35 })
    b.add(blobLo, { p: [0, 0.3, 0.02], s: 0.12, c: [1.0, 0.92, 0.98], glow: 1, keep: true })
  },
  tidelotus(b) {
    // grandi foglie galleggianti e fiori di loto bianco-azzurri su steli alti
    const P = [0.14, 0.36, 0.2]
    const P2 = [0.3, 0.56, 0.28]
    const pads = [[0, 0, 0.42], [0.55, 0.2, 0.3], [-0.45, 0.35, 0.32], [0.15, -0.55, 0.26], [-0.35, -0.4, 0.22], [0.6, -0.35, 0.18]]
    for (const [x, z, r] of b.far ? pads.slice(0, 3) : pads) b.add(dome, { p: [x, 0, z], s: [r, 0.03, r], c: P, c2: P2, keep: true })
    const flowers = [[0.06, 0.08, 1.0], [0.5, 0.25, 0.62], [-0.38, -0.3, 0.42]]
    for (const [x, z, h] of b.far ? flowers.slice(0, 1) : flowers) {
      stem(b, [x, 0, z], h - 0.1, 0.022, 0.016, 0, 0.05, [0.28, 0.48, 0.24], { stiff: true })
      const s = 0.55 + 0.45 * h
      const np = b.lo ? 6 : 10
      for (let k = 0; k < np; k++) {
        const a = (k / np) * Math.PI * 2 + (k % 2) * 0.3
        const inner = k % 2
        b.add(b.B, { p: [x + Math.cos(a) * 0.1 * s, h - 0.06 + 0.03 * inner, z + Math.sin(a) * 0.1 * s], r: [0, -a, 0.75 + 0.35 * inner], s: [0.15 * s, 0.035, 0.065 * s], c: [0.94, 0.94, 1.0], c2: [0.55, 0.72, 1.0], glow: 0.35, flutter: true })
      }
      b.add(blobLo, { p: [x, h - 0.03, z], s: 0.05 * s, c: [1.0, 0.86, 0.4], glow: 1 })
    }
  },
  conchspire(b) {
    // torre a spirale di conchiglia color crema e corallo, punta luminosa
    const C = [0.78, 0.6, 0.48]
    const C2 = [0.98, 0.86, 0.74]
    const n = b.far ? 5 : 9
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1)
      const y = -0.12 + t * 0.78
      const r = 0.3 * (1 - t) + 0.035
      const a = k * 1.3
      b.add(b.B, { p: [Math.cos(a) * 0.03 * (1 - t), y, Math.sin(a) * 0.03 * (1 - t)], s: [r, 0.075 + 0.05 * (1 - t), r], c: mixc(C, [0.86, 0.42, 0.38], t * 0.6), c2: C2, radial: true, stiff: true })
    }
    if (!b.lo) {
      for (let k = 0; k < 30; k++) {
        const t = k / 30
        const a = t * Math.PI * 7
        const r = 0.3 * (1 - t) + 0.045
        b.add(blobLo, { p: [Math.cos(a) * r, -0.04 + t * 0.76, Math.sin(a) * r], s: 0.035 * (1 - t * 0.6), c: [0.92, 0.46, 0.42], stiff: true })
      }
    }
    b.add(shard(0.05, 0.3), { p: [0, 0.68, 0], c: [0.55, 0.88, 1.0], c2: [0.9, 1.0, 1.0], glow: (k) => 0.3 + 0.7 * k, stiff: true })
    // bocca della conchiglia, rosata e accesa, al pelo dell'acqua
    b.add(dome, { p: [0.2, 0.06, 0.12], r: [0, 0.6, -1.2], s: [0.14, 0.05, 0.1], c: [0.95, 0.55, 0.6], glow: 0.5 })
  },
  saltroot(b) {
    // mangrovia: tronco sollevato su radici ad arco incrostate di sale, chioma
    // lucida e semi pendenti che cadono in acqua
    const BK = [0.32, 0.28, 0.24]
    const SALT = [0.86, 0.86, 0.8]
    for (let k = 0; k < (b.far ? 4 : 8); k++) {
      const a = (k / 8) * Math.PI * 2 + 0.2
      stem(b, [0, 0.36, 0], 0.5 + 0.06 * (k % 3), 0.03, 0.022, Math.PI / 2 - a, Math.PI - 0.62 - 0.1 * (k % 2), BK, { c2: SALT, stiff: true })
    }
    const top = stem(b, [0, 0.34, 0], 0.32, 0.055, 0.04, 0, 0.06, BK, { stiff: true })
    const G = [0.1, 0.3, 0.2]
    const G2 = [0.26, 0.52, 0.3]
    const pads = [[0, 0.16, 0, 0.32], [0.24, 0.08, 0.1, 0.24], [-0.22, 0.1, 0.12, 0.25], [0.05, 0.08, -0.25, 0.25], [-0.12, 0.24, -0.1, 0.2]]
    for (const [x, y, z, r] of b.far ? pads.slice(0, 3) : pads) b.add(b.B, { p: [top[0] + x, top[1] + y, top[2] + z], s: [r, r * 0.7, r], c: G, c2: G2, radial: true, flutter: true })
    if (!b.lo) {
      for (let k = 0; k < 9; k++) {
        const a = k * 2.399
        b.add(cone(0.012, 0.2, 4), { p: [top[0] + Math.cos(a) * 0.3, top[1] - 0.02, top[2] + Math.sin(a) * 0.3], r: [Math.PI, 0, 0], c: [0.4, 0.5, 0.25], c2: [0.75, 0.9, 0.6], glow: (kk) => 0.5 * (1 - kk), flutter: true })
      }
    }
  }
}

/** Prisma di cristallo: fusto esagonale e punta, inclinato (tilt) verso yaw. */
function prism(b, base, len, r, tilt, yaw, c, c2, glow) {
  const body = len * 0.78
  b.add(cyl(r, r * 1.05, body, 6), { p: base, r: [tilt, yaw, 0], c, c2: mixc(c, c2, 0.7), glow: (k) => glow(k * 0.78), stiff: true })
  _e.set(tilt, yaw, 0, 'YXZ')
  const d = new THREE.Vector3(0, body, 0).applyEuler(_e)
  b.add(cone(r, len - body, 6), { p: [base[0] + d.x, base[1] + d.y, base[2] + d.z], r: [tilt, yaw, 0], c: mixc(c, c2, 0.7), c2, glow: (k) => glow(0.78 + 0.22 * k), stiff: true })
}
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]

/**
 * Geometrie di tutte le specie, nell'ordine di SPECIES (planet/flora.js).
 * @param {Array<{key:string}>} species
 * @param {number} lod 0 completo, 1 semplificato, 2 lontano
 */
export function buildPlantGeometries(species, lod = 0) {
  lod = +lod
  SEG_CAP = lod >= 1 ? 3 : 99
  dome = lod >= 2 ? domeFar : lod >= 1 ? domeLo : domeHi
  blobLo = lod >= 2 ? octa : icoLo
  return species.map((s) => {
    const b = new PlantBuilder(lod)
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
  cindercoral: 0.25,
  moonshroom: 0.6,
  blushwood: 0.5,
  petalcrown: 1.3,
  jellybell: 1.0,
  starlily: 1.5,
  candlewick: 0.35,
  featherfern: 0.6,
  frostlantern: 0.4,
  obsidianbloom: 0.25,
  mossfather: 0.15,
  broadleaf: 0.25,
  bogcypress: 0.15,
  crystalspire: 0.5,
  rosequartz: 0.35,
  shardwillow: 0.4,
  glimmermoss: 0.5,
  geodebloom: 0.6,
  coralfan: 0.6,
  bubblekelp: 0.2,
  anemone: 1.0,
  pearlmouth: 0.35,
  tidelotus: 0.7,
  conchspire: 0.4,
  saltroot: 0.15,
  kelpspire: 0.3
}
