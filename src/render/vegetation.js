// Vegetazione 3D: disegna le piante calcolate per le tile (planet/flora.js).
//
// - Una InstancedMesh per specie, con le istanze di TUTTE le tile disegnate in
//   questo momento (poche draw call). Quando l'insieme delle tile cambia, i
//   buffer delle istanze vengono ricomposti (al più ogni ~150 ms in tempo
//   reale, a ogni fotogramma nella ripresa del regista).
// - Precisione: la posizione di ogni pianta è divisa in parte alta e bassa
//   (float32 + resto) e lo shader sottrae la posizione della camera divisa
//   allo stesso modo: niente tremolio anche a 25 m dal suolo su un pianeta di
//   6371 km.
// - La pianta sta sul terreno esagerato come lo disegna lo shader del terreno
//   (quota * uExag lungo la verticale).
// - Vento: le parti alte oscillano, le foglie tremano; le parti luminose
//   pulsano piano.
// - Le piante più piccole di ~2 pixel spariscono con una dissolvenza (lo
//   shader del terreno disegna già le chiome a distanza); quelle nuove
//   crescono in mezzo secondo invece di comparire di colpo.

import * as THREE from 'three'
import { SPECIES, vegKeep } from '../planet/flora.js'
import { buildPlantGeometries, HUE_VARIATION } from './plantModels.js'

const STRIDE = 11 // posHi(3) posLo(3) hKm size rot var born
// Dettaglio per tile e per specie, dalla dimensione a schermo della pianta
// nel punto della tile più vicino alla camera: completo sopra HI_PX pixel,
// semplificato sopra LO_PX, "lontano" (decine di triangoli) sotto. I giganti
// passano al dettaglio pieno prima dei fiori.
const HI_PX = 44
const LO_PX = 16
// piante lontane piccole (pochi pixel): se ne disegna solo una parte
const thinFor = (px) => (px >= 9 ? 1 : 0.3 + 0.7 * Math.max(0, (px - 1.5) / 7.5))
const tierFor = (px) => (px >= HI_PX ? 0 : px >= LO_PX ? 1 : 2)
const _c = new THREE.Vector3()

const VERT = /* glsl */ `
  #include <common>
  uniform float logDepthBufFC;
  attribute vec3 aCol;
  attribute vec2 aWind;
  attribute float aGlow;
  attribute vec3 iPosHi;
  attribute vec3 iPosLo;
  attribute vec4 iAttr; // quota suolo (km), altezza (km), rotazione, variazione
  attribute float iBorn;
  uniform vec3 uCamHi;
  uniform vec3 uCamLo;
  uniform float uExag;
  uniform float uTime;
  uniform float uPxPerRad;
  uniform float uHueVar;
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vUp;
  varying float vGlow;
  varying float vDist;
  varying float vPhase;

  vec3 hueRotate(vec3 c, float a) {
    // rotazione della tinta nello spazio YIQ
    const mat3 toYIQ = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312);
    const mat3 toRGB = mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703);
    vec3 yiq = toYIQ * c;
    float h = atan(yiq.z, yiq.y) + a;
    float chroma = length(yiq.yz);
    return max(toRGB * vec3(yiq.x, chroma * cos(h), chroma * sin(h)), 0.0);
  }

  void main() {
    vec3 base = (iPosHi - uCamHi) + (iPosLo - uCamLo);
    vec3 up = normalize(iPosHi + iPosLo);
    vec3 e = abs(up.y) < 0.99 ? normalize(cross(vec3(0.0, 1.0, 0.0), up)) : normalize(cross(vec3(1.0, 0.0, 0.0), up));
    vec3 nr = cross(up, e);
    float c = cos(iAttr.z);
    float s = sin(iAttr.z);
    vec3 ax = e * c + nr * s;
    vec3 az = -e * s + nr * c;

    base += up * (iAttr.x * uExag);
    float dist = length(base);
    // dimensione a schermo: sotto ~2 px la pianta sparisce
    float px = iAttr.y * uPxPerRad / max(dist, 1e-4);
    float vis = smoothstep(1.1, 2.4, px);
    // crescita delle piante appena comparse
    vis *= smoothstep(0.0, 0.6, uTime - iBorn);
    float size = iAttr.y * vis;

    // vento: oscillazione lenta delle parti alte + tremolio delle foglie
    float ph = iAttr.w * 6.2831;
    vPhase = ph;
    vec3 p = position;
    float gust = 0.6 + 0.4 * sin(uTime * 0.23 + ph * 0.3);
    p.x += aWind.x * gust * (0.045 * sin(uTime * 1.25 + ph) + 0.015 * sin(uTime * 2.9 + ph * 1.7));
    p.z += aWind.x * gust * 0.03 * sin(uTime * 1.05 + ph * 0.6);
    p += aWind.y * 0.012 * vec3(
      sin(uTime * 7.1 + ph + position.y * 23.0),
      sin(uTime * 6.3 + ph + position.x * 21.0),
      sin(uTime * 7.9 + ph + position.z * 19.0));

    // la base affonda un poco: sui pendii il tronco non resta sospeso
    vec3 rel = base + (ax * p.x + up * (p.y - 0.06) + az * p.z) * size;
    vN = normalize(ax * normal.x + up * normal.y + az * normal.z);
    vUp = up;
    vColor = uHueVar > 0.0 ? hueRotate(aCol, (iAttr.w - 0.5) * uHueVar) : aCol;
    // leggera variazione di luminosità tra le piante
    vColor *= 0.86 + 0.28 * fract(iAttr.w * 7.31);
    vGlow = aGlow;
    vDist = length(rel);
    vec4 mv = vec4(mat3(viewMatrix) * rel, 1.0);
    gl_Position = projectionMatrix * mv;
    // profondità logaritmica per vertice, come il terreno (materials.js): senza
    // gl_FragDepth la GPU scarta in anticipo i pixel nascosti
    #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
      gl_Position.z = (log2(max(1e-6, 1.0 + gl_Position.w)) * logDepthBufFC - 1.0) * gl_Position.w;
    #endif
  }
`

const FRAG = /* glsl */ `
  #include <common>
  uniform vec3 uSunDir;
  uniform vec3 uHazeColor;
  uniform float uHazeDensity;
  uniform float uTime;
  varying vec3 vColor;
  varying vec3 vN;
  varying vec3 vUp;
  varying float vGlow;
  varying float vDist;
  varying float vPhase;

  void main() {
    vec3 n = normalize(vN);
    float ndl = dot(n, uSunDir);
    // luce "illustrata": passaggio morbido luce/ombra, cielo dall'alto
    float lit = smoothstep(-0.25, 0.55, ndl);
    float sky = 0.5 + 0.5 * dot(n, vUp);
    // i colori dei modelli sono pensati per la luce piena: le piante devono
    // stare alla pari con il verde saturo del terreno
    vec3 alb = vColor * 1.45;
    vec3 col = alb * (0.5 + 0.62 * lit) + alb * vec3(0.1, 0.13, 0.18) * sky;
    // parti luminose: pulsano piano, sfasate da pianta a pianta
    float pulse = 0.75 + 0.25 * sin(uTime * 1.6 + vPhase * 3.0);
    col = mix(col, alb * 1.25 + vec3(0.08), vGlow * pulse);
    // stessa foschia del terreno (materials.js)
    float fog = 1.0 - exp(-vDist * uHazeDensity);
    col = mix(col, uHazeColor, fog * 0.55);
    float luma = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(luma), col, 1.12);
    gl_FragColor = vec4(col, 1.0);
  }
`

function splitHi(x) {
  return Math.fround(x)
}

export class Vegetation {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.ShaderMaterial} terrainMaterial (uniform condivise: esagerazione, sole, foschia)
   */
  constructor(scene, terrainMaterial) {
    this.group = new THREE.Group()
    this.group.name = 'vegetation'
    scene.add(this.group)
    const tu = terrainMaterial.uniforms
    this.uniforms = {
      uCamHi: { value: new THREE.Vector3() },
      uCamLo: { value: new THREE.Vector3() },
      uExag: tu.uExag,
      uTime: { value: 0 },
      uPxPerRad: { value: 1000 },
      uSunDir: tu.uSunDir,
      uHazeColor: tu.uHazeColor,
      uHazeDensity: tu.uHazeDensity
    }
    const all = []
    for (const [lod, name] of [[0, 'hi'], [1, 'lo'], [2, 'far']]) {
      const geos = buildPlantGeometries(SPECIES, lod)
      SPECIES.forEach((sp, i) => all.push([sp, geos[i], name]))
    }
    // una mesh per specie e per livello di dettaglio: [0, N) completi,
    // [N, 2N) semplificati, [2N, 3N) lontani
    this.kinds = all.map(([sp, base, lod]) => {
      const geo = new THREE.InstancedBufferGeometry()
      for (const name of ['position', 'normal', 'aCol', 'aWind', 'aGlow']) geo.setAttribute(name, base.getAttribute(name))
      geo.instanceCount = 0
      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms: { ...this.uniforms, uHueVar: { value: HUE_VARIATION[sp.key] || 0.12 } }
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.frustumCulled = false
      mesh.matrixAutoUpdate = false
      // prima del terreno: le chiome coprono molto schermo e il terreno sotto
      // viene scartato dal test di profondità invece di essere ombreggiato
      mesh.renderOrder = -1
      mesh.visible = false
      mesh.name = 'plants:' + sp.key + ':' + lod
      this.group.add(mesh)
      return { sp, geo, mesh, capacity: 0, data: null, buffer: null, count: 0 }
    })
    this._tiles = new Set()
    this._tier = new Map()
    this._next = new Map()
    this._lastBuild = -1e9
    this._dirty = false
    this.stats = { tiles: 0, plants: 0 }
  }

  _ensure(kind, n) {
    if (n <= kind.capacity) return
    let cap = Math.max(256, kind.capacity)
    while (cap < n) cap *= 2
    kind.capacity = cap
    kind.data = new Float32Array(cap * STRIDE)
    const buf = new THREE.InstancedInterleavedBuffer(kind.data, STRIDE, 1)
    buf.setUsage(THREE.DynamicDrawUsage)
    kind.buffer = buf
    // geometria NUOVA a ogni crescita: three.js calcola il numero massimo di
    // istanze disegnabili una volta sola (alla prima configurazione degli
    // attributi) e con il buffer sostituito disegnava solo le prime istanze
    const old = kind.geo
    const g = new THREE.InstancedBufferGeometry()
    for (const name of ['position', 'normal', 'aCol', 'aWind', 'aGlow']) g.setAttribute(name, old.getAttribute(name))
    kind.mesh.geometry = g
    kind.geo = g
    old.dispose()
    g.setAttribute('iPosHi', new THREE.InterleavedBufferAttribute(buf, 3, 0))
    g.setAttribute('iPosLo', new THREE.InterleavedBufferAttribute(buf, 3, 3))
    g.setAttribute('iAttr', new THREE.InterleavedBufferAttribute(buf, 4, 6))
    g.setAttribute('iBorn', new THREE.InterleavedBufferAttribute(buf, 1, 10))
  }

  /**
   * Istanze di una tile già nel formato del buffer, ordinate per specie e,
   * dentro la specie, per rango (calcolate una volta sola: la ricomposizione
   * diventa una serie di copie, e diradare le piante lontane significa
   * prenderne solo i primi N, sempre gli stessi).
   */
  _pack(node, nowSec) {
    const ud = node.mesh.userData
    if (ud.vegPack) return ud.vegPack
    const v = ud.veg
    const NS = SPECIES.length
    // nascita della tile: le piante che esistevano già nella tile padre
    // (rango sotto la sua quota) non "rinascono"
    const born = nowSec
    const parentKeep = vegKeep(node.level - 1)
    const starts = new Int32Array(NS + 1)
    for (let i = 0; i < v.count; i++) starts[v.species[i] + 1]++
    for (let k = 0; k < NS; k++) starts[k + 1] += starts[k]
    const fill = starts.slice(0, NS)
    const order = new Uint32Array(v.count)
    for (let i = 0; i < v.count; i++) order[i] = i
    order.sort((a, b) => v.species[a] - v.species[b] || v.attr[a * 5 + 4] - v.attr[b * 5 + 4])
    const d = new Float32Array(v.count * STRIDE)
    for (let q = 0; q < v.count; q++) {
      const i = order[q]
      const o = fill[v.species[i]]++ * STRIDE
      const x = v.pos[i * 3]
      const y = v.pos[i * 3 + 1]
      const z = v.pos[i * 3 + 2]
      const hx = splitHi(x)
      const hy = splitHi(y)
      const hz = splitHi(z)
      d[o] = hx
      d[o + 1] = hy
      d[o + 2] = hz
      d[o + 3] = x - hx
      d[o + 4] = y - hy
      d[o + 5] = z - hz
      d[o + 6] = v.attr[i * 5]
      d[o + 7] = v.attr[i * 5 + 1]
      d[o + 8] = v.attr[i * 5 + 2]
      d[o + 9] = v.attr[i * 5 + 3]
      d[o + 10] = v.attr[i * 5 + 4] < parentKeep ? -1e6 : born
    }
    ud.vegPack = { starts, data: d }
    return ud.vegPack
  }

  /** Piante della specie k da disegnare nella tile j (le prime per rango). */
  _take(pk, j, k) {
    const n = pk.starts[k + 1] - pk.starts[k]
    const f = this._thin[j][k]
    return f >= 1 ? n : Math.ceil(n * f)
  }

  /** Ricompone i buffer delle istanze dalle tile disegnate. */
  _rebuild(nodes, nowSec) {
    const NS = SPECIES.length
    const counts = new Array(this.kinds.length).fill(0)
    const packs = nodes.map((n) => this._pack(n, nowSec))
    // indice della mesh per tile e specie, e quante piante prendere
    this._thin = nodes.map((n) => {
      const pxKm = Math.pow(2, this._tier.get(n) / 3)
      const t = new Float32Array(NS)
      for (let k = 0; k < NS; k++) t[k] = thinFor(pxKm * SPECIES[k].h)
      return t
    })
    const offs = nodes.map((n) => {
      const pxKm = Math.pow(2, this._tier.get(n) / 3)
      const o = new Int32Array(NS)
      // -1: specie troppo piccola a schermo in questa tile (sotto il pixel
      // anche con la taglia massima): non si disegna proprio
      for (let k = 0; k < NS; k++) {
        const px = pxKm * SPECIES[k].h
        o[k] = px * 2.4 < 1.1 ? -1 : tierFor(px) * NS + k
      }
      return o
    })
    packs.forEach((pk, j) => {
      for (let k = 0; k < NS; k++) if (offs[j][k] >= 0) counts[offs[j][k]] += this._take(pk, j, k)
    })
    for (let k = 0; k < this.kinds.length; k++) {
      this._ensure(this.kinds[k], counts[k])
      this.kinds[k].count = 0
    }
    let total = 0
    for (let j = 0; j < packs.length; j++) {
      const pk = packs[j]
      for (let k = 0; k < NS; k++) {
        const a = pk.starts[k]
        const b = a + this._take(pk, j, k)
        if (b === a || offs[j][k] < 0) continue
        const kind = this.kinds[offs[j][k]]
        kind.data.set(pk.data.subarray(a * STRIDE, b * STRIDE), kind.count * STRIDE)
        kind.count += b - a
      }
      for (let k = 0; k < NS; k++) if (offs[j][k] >= 0) total += this._take(pk, j, k)
    }
    for (const kind of this.kinds) {
      kind.geo.instanceCount = kind.count
      kind.mesh.visible = kind.count > 0
      if (kind.buffer && kind.count > 0) {
        kind.buffer.clearUpdateRanges()
        kind.buffer.addUpdateRange(0, kind.count * STRIDE)
        kind.buffer.needsUpdate = true
      }
    }
    this.stats.tiles = nodes.length
    this.stats.plants = total
  }

  /**
   * @param {THREE.Node[]} drawn tile disegnate dal LOD in questo frame
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} viewportPx altezza della vista in pixel
   * @param {number} nowMs orologio (reale o virtuale del regista)
   * @param {boolean} offline ripresa: ricomposizione immediata
   */
  update(drawn, camera, viewportPx, nowMs, offline = false) {
    const nowSec = nowMs / 1000
    this.uniforms.uTime.value = nowSec
    const cp = camera.position
    const hx = splitHi(cp.x)
    const hy = splitHi(cp.y)
    const hz = splitHi(cp.z)
    this.uniforms.uCamHi.value.set(hx, hy, hz)
    this.uniforms.uCamLo.value.set(cp.x - hx, cp.y - hy, cp.z - hz)
    const pxPerRad = viewportPx / (2 * Math.tan((camera.fov * Math.PI) / 360))
    this.uniforms.uPxPerRad.value = pxPerRad

    // tile disegnate con piante, e dettaglio di ciascuna
    const nodes = []
    let changed = false
    for (const n of drawn) {
      if (!n.mesh || !n.mesh.userData.veg) continue
      nodes.push(n)
      const d = Math.max(_c.copy(n.surfaceCenter).distanceTo(cp) - n.radius, 0.05)
      // pixel per km, in gradini di un terzo d'ottava (con un po' di
      // isteresi): il dettaglio cambia solo quando la tile si avvicina davvero
      const lp = Math.log2(pxPerRad / d) * 3
      const old = this._tier.get(n)
      let tier = Math.round(lp)
      if (old !== undefined && Math.abs(lp - old) < 0.75) tier = old
      if (old !== tier) changed = true
      this._next.set(n, tier)
      if (!this._tiles.has(n)) changed = true
    }
    const swap = this._tier
    this._tier = this._next
    this._next = swap
    this._next.clear()
    if (!changed && nodes.length !== this._tiles.size) changed = true
    if (changed) this._dirty = true
    if (!this._dirty) return
    // in tempo reale si ricompone al più ~7 volte al secondo
    const t = performance.now()
    if (!offline && t - this._lastBuild < 150) return
    this._lastBuild = t
    this._dirty = false
    this._tiles = new Set(nodes)
    this._rebuild(nodes, nowSec)
  }
}
