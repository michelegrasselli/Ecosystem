// Terreno a LOD: quadtree su cubo-sfera.
//
// Invariante che impedisce i buchi: `visit()` viene chiamata SOLO su nodi che
// hanno già una mesh. Le radici sono costruite subito; un nodo scende nei figli
// solo quando tutti e quattro hanno la mesh, altrimenti disegna se stesso e
// mette i figli in coda. Ogni nodo attraversato viene marcato come usato nel
// frame, quindi la cache non scarica mai un antenato di ciò che è a schermo:
// tornando indietro con lo zoom il padre è sempre pronto.
//
// (Prima le radici non venivano mai costruite e un nodo scaricato dalla cache
// veniva "disegnato" senza mesh e mai rimesso in coda: buchi permanenti.)

import * as THREE from 'three'
import { SCENE_RADIUS, SCENE_SCALE, MAX_LOD_LEVEL } from '../planet/constants.js'
import { buildTileMesh, createTileMesh, tileBounds } from './tileBuilder.js'

const MAX_CACHED_TILES = 6500
// soglia proporzionale alla risoluzione delle tile (64 maglie): ~1.9 px per
// maglia, con meno tile (e meno draw call) rispetto a tile più piccole
const SPLIT_PIXELS = 124
// oltre questa frazione della soglia i figli vengono già preparati, così
// durante uno zoom sono pronti quando servono. Presto (metà della soglia)
// perché con lo zoom continuo i quattro figli devono arrivare *prima* che
// servano: se arrivano dopo, per qualche frame si vede il terreno stirato.
const PREFETCH_FRACTION = 0.5
// durata del morph di una tile appena comparsa
const MORPH_MS = 560
const MAX_TILES_PER_FRAME = 24
// mesh create per frame dai risultati dei worker (la creazione è economica,
// il caricamento sulla GPU avviene al primo render): poche per volta, perché
// ogni mesh nuova carica i suoi buffer e un gruppo numeroso produce uno scatto
const MAX_MESHES_PER_FRAME = 8

const _sphere = new THREE.Sphere()
const _v = new THREE.Vector3()

export class TerrainLOD {
  constructor(planet, scene, material, pool = null, nations = null) {
    this.planet = planet
    this.nations = nations
    this.pool = pool
    this.scene = scene
    this.material = material
    this.group = new THREE.Group()
    this.group.matrixAutoUpdate = false
    scene.add(this.group)

    this.cache = new Map()
    this.frame = 0
    this.needed = []
    this.prefetch = []
    this.drawn = []
    this._prevDrawn = []
    this.buildBudgetMs = 7
    this.exaggeration = 1
    this.stats = { tiles: 0, visible: 0, built: 0, queued: 0, inFlight: 0, maxLevel: 0 }

    this._frustum = new THREE.Frustum()
    this._projScreen = new THREE.Matrix4()
    this._cameraRef = null
    this._screenFactor = 1000

    this.roots = []
    for (let f = 0; f < 6; f++) {
      const root = this.getNode(f, 0, 0, 0, null)
      this.buildNode(root)
      this.roots.push(root)
    }
  }

  key(face, level, x, y) {
    return face + '/' + level + '/' + x + '/' + y
  }

  getNode(face, level, x, y, parent) {
    const k = this.key(face, level, x, y)
    let node = this.cache.get(k)
    if (node) {
      node.lastUsed = this.frame
      node.parent = parent
      return node
    }
    const b = tileBounds(face, level, x, y)
    node = {
      key: k,
      face,
      level,
      x,
      y,
      parent,
      center: b.center,
      surfaceCenter: b.surfaceCenter,
      radius: b.radius,
      hMax: 0,
      mesh: null,
      requestId: 0,
      children: null,
      lastUsed: this.frame
    }
    this.cache.set(k, node)
    return node
  }

  createChildren(node) {
    const x2 = node.x * 2
    const y2 = node.y * 2
    const l = node.level + 1
    return [
      this.getNode(node.face, l, x2, y2, node),
      this.getNode(node.face, l, x2 + 1, y2, node),
      this.getNode(node.face, l, x2, y2 + 1, node),
      this.getNode(node.face, l, x2 + 1, y2 + 1, node)
    ]
  }

  buildNode(node) {
    this._attach(
      node,
      buildTileMesh(this.planet, node.face, node.level, node.x, node.y, this.material)
    )
  }

  _attach(node, mesh) {
    node.mesh = mesh
    node.requestId = 0
    node.hMax = node.mesh.userData.hMax
    // nazioni candidate per lo shader dei confini (null = ciclo completo)
    if (this.nations && node.level >= 1) {
      mesh.userData.natCand = this.nations.candidatesForTile(node.face, node.level, node.x, node.y)
    }
    // la mesh entra nella scena solo quando va a schermo (vedi update)
  }

  /**
   * Aggiorna il LOD.
   * @param {THREE.Camera} camera
   * @param {number} viewportHeight pixel
   */
  update(camera, viewportHeight) {
    this.frame++
    this.needed.length = 0
    this.prefetch.length = 0
    // orologio virtuale del regista (ripresa) o tempo reale
    this._now = this.clock ?? performance.now()

    this._projScreen.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this._frustum.setFromProjectionMatrix(this._projScreen)

    const fovRad = (camera.fov * Math.PI) / 180
    this._screenFactor = viewportHeight / (2 * Math.tan(fovRad / 2))
    this._cameraRef = camera

    const prev = this._prevDrawn
    this._prevDrawn = this.drawn
    this.drawn = prev
    this.drawn.length = 0

    for (let i = 0; i < this.roots.length; i++) this.visit(this.roots[i], camera)

    // Visibilità: nella scena ci sono SOLO le tile disegnate in questo frame.
    // Tenere migliaia di mesh nascoste nel grafo costava a three.js un
    // attraversamento completo a ogni frame.
    for (let i = 0; i < this.drawn.length; i++) this.drawn[i].drawnFrame = this.frame
    for (let i = 0; i < this._prevDrawn.length; i++) {
      const n = this._prevDrawn[i]
      if (n.drawnFrame !== this.frame && n.mesh && n.mesh.parent) this.group.remove(n.mesh)
    }
    let maxLevel = 0
    for (let i = 0; i < this.drawn.length; i++) {
      const n = this.drawn[i]
      if (n.mesh.parent !== this.group) this.group.add(n.mesh)
      // il morph parte la prima volta che la tile va a schermo (una tile
      // precaricata può essere pronta da tempo)
      const ud = n.mesh.userData
      if (ud.born === undefined) ud.born = n.level === 0 ? -1e9 : this._now
      // Orologio "precedente" alla nascita (la ripresa del regista riparte da
      // 0 con tile nate in tempo reale, o viceversa): tile già formata. Senza
      // questo controllo il morph andava fuori scala e i vertici schizzavano
      // via in lunghe schegge.
      const mt = this._now < ud.born ? 1 : Math.min((this._now - ud.born) / MORPH_MS, 1)
      // smootherstep: derivate prima e seconda nulle agli estremi, il passaggio
      // dalla forma del padre a quella propria non ha né partenza né arrivo netti
      ud.morph = mt * mt * mt * (mt * (mt * 6 - 15) + 10)
      if (n.level > maxLevel) maxLevel = n.level
    }

    this.buildNeeded()

    this.stats.visible = this.drawn.length
    this.stats.tiles = this.cache.size
    this.stats.queued = this.needed.length
    this.stats.maxLevel = maxLevel
  }

  visit(node, camera) {
    node.lastUsed = this.frame
    if (!this._sphereInFrustum(node)) return
    if (this._belowHorizon(node, camera)) return

    const px = node.level < MAX_LOD_LEVEL ? this._screenPx(node, camera) : 0
    if (px > SPLIT_PIXELS) {
      if (!node.children) node.children = this.createChildren(node)
      const ch = node.children
      let ready = true
      for (let i = 0; i < 4; i++) {
        ch[i].lastUsed = this.frame
        if (!ch[i].mesh) {
          ready = false
          // priorità = dimensione a schermo del padre: prima ciò che si vede
          // più grande (vicino alla camera), non un livello alla volta
          ch[i].priority = px
          this.needed.push(ch[i])
        }
      }
      if (ready) {
        for (let i = 0; i < 4; i++) this.visit(ch[i], camera)
        return
      }
    }

    // precaricamento dei figli quando la tile si avvicina alla soglia
    if (px > SPLIT_PIXELS * PREFETCH_FRACTION) {
      if (!node.children) node.children = this.createChildren(node)
      for (let i = 0; i < 4; i++) {
        const c = node.children[i]
        c.lastUsed = this.frame
        if (!c.mesh && !c.requestId) {
          c.priority = px
          this.prefetch.push(c)
        }
      }
    }

    this.drawn.push(node)
  }

  /** Raggio (unità di scena) del punto più alto della tile con l'esagerazione corrente. */
  _reliefKm(node) {
    return node.hMax * SCENE_SCALE * this.exaggeration
  }

  shouldSplit(node, camera) {
    return this._screenPx(node, camera) > SPLIT_PIXELS
  }

  /** Lato della tile in pixel a schermo. */
  _screenPx(node, camera) {
    // distanza dal centro della tile alla quota media del suo rilievo
    const lift = (SCENE_RADIUS + this._reliefKm(node) * 0.5) / SCENE_RADIUS
    _v.copy(node.surfaceCenter).multiplyScalar(lift)
    const dist = camera.position.distanceTo(_v)
    if (dist <= 0.0001) return 1e9
    const sizeKm = (Math.PI * 0.5 * SCENE_RADIUS) / (1 << node.level)
    // Scorcio: una tile vista di taglio (verso l'orizzonte) occupa pochi pixel
    // in verticale. Senza questo fattore le viste radenti chiedevano migliaia
    // di tile lontane e il dettaglio vicino arrivava in ritardo.
    // La tile più grande non viene mai penalizzata oltre 0.4.
    const cx = camera.position.x - _v.x
    const cy = camera.position.y - _v.y
    const cz = camera.position.z - _v.z
    const facing =
      (cx * node.surfaceCenter.x + cy * node.surfaceCenter.y + cz * node.surfaceCenter.z) /
      (dist * SCENE_RADIUS)
    const fore = 0.4 + 0.6 * Math.min(Math.max(facing, 0), 1)
    return (sizeKm / dist) * this._screenFactor * fore
  }

  /**
   * La tile è tutta oltre l'orizzonte? Il frustum non lo sa: vicino al suolo,
   * guardando lontano, metteva in scena tile nascoste dalla curvatura del
   * pianeta (triangoli disegnati e poi coperti). Test a coni: un punto alla
   * quota della cima della tile è visibile fino all'angolo (dal centro del
   * pianeta) acos(Ro/d) + acos(Ro/Rtop), con Ro una sfera sicuramente piena
   * (sotto il fondo marino più profondo).
   */
  _belowHorizon(node, camera) {
    const p = camera.position
    const d = p.length()
    const Ro = SCENE_RADIUS - 12
    if (d <= Ro) return false
    const rTop = SCENE_RADIUS + Math.max(this._reliefKm(node), 0) + 0.5
    const reach = Math.acos(Ro / d) + Math.acos(Math.min(Ro / rTop, 1))
    const c = node.surfaceCenter
    const cosT = (p.x * c.x + p.y * c.y + p.z * c.z) / (d * SCENE_RADIUS)
    const theta = Math.acos(Math.max(-1, Math.min(1, cosT)))
    const beta = Math.asin(Math.min(1, node.radius / SCENE_RADIUS)) * 1.1 + 1e-4
    return theta - beta > reach
  }

  _sphereInFrustum(node) {
    _sphere.center.copy(node.center)
    _sphere.radius = node.radius + this._reliefKm(node) + 0.5
    return this._frustum.intersectsSphere(_sphere)
  }

  buildNeeded() {
    // 1. risultati arrivati dai worker
    let built = 0
    if (this.pool) {
      const results = this.pool.drain()
      const t0 = performance.now()
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (built >= MAX_MESHES_PER_FRAME || (built > 0 && performance.now() - t0 > 4)) {
          this.pool.done.push(r) // al prossimo frame
          continue
        }
        const node = this.cache.get(r.key)
        // nodo scaricato o richiesta superata: si scarta
        if (!node || node.mesh || node.requestId !== r.id) continue
        this._attach(node, createTileMesh(r.data, this.material))
        built++
      }
      this.stats.inFlight = this.pool.inFlight
    }

    if (this.needed.length === 0) {
      this.stats.built = built
      return
    }

    // Raffinamento "in profondità" vicino alla camera: la tile che occupa più
    // pixel a schermo viene servita per prima. Con l'ordine per livello (tutto
    // il livello 4, poi tutto il 5…) durante un volo dallo spazio il dettaglio
    // sotto la camera arrivava secondi dopo l'atterraggio.
    this.needed.sort((a, b) => b.priority - a.priority)

    // 2. nuove richieste in ordine di priorità
    if (this.pool && this.pool.ok) {
      for (let i = 0; i < this.needed.length; i++) {
        if (!this.pool.hasCapacity()) break
        const node = this.needed[i]
        if (node.mesh || node.requestId) continue
        node.requestId = this.pool.request(node.key, node.face, node.level, node.x, node.y)
      }
      // poi i precaricamenti, se resta capacità (prima i più grossi/vicini)
      if (this.pool.hasCapacity() && this.prefetch.length) {
        this.prefetch.sort((a, b) => b.priority - a.priority)
        for (let i = 0; i < this.prefetch.length; i++) {
          if (!this.pool.hasCapacity()) break
          const node = this.prefetch[i]
          if (node.mesh || node.requestId) continue
          node.requestId = this.pool.request(node.key, node.face, node.level, node.x, node.y)
        }
      }
      this.stats.inFlight = this.pool.inFlight
    } else {
      // senza worker: generazione nel thread principale con un budget
      const start = performance.now()
      let local = 0
      for (let i = 0; i < this.needed.length; i++) {
        if (local >= MAX_TILES_PER_FRAME) break
        if (local > 0 && performance.now() - start > this.buildBudgetMs) break
        const node = this.needed[i]
        if (node.mesh) continue
        this.buildNode(node)
        local++
      }
      built += local
    }
    this.stats.built = built

    if (this.cache.size > MAX_CACHED_TILES) this.evict()
  }

  evict() {
    const nodes = [...this.cache.values()]
    nodes.sort((a, b) => a.lastUsed - b.lastUsed)
    const target = this.cache.size - MAX_CACHED_TILES + 400
    let removed = 0
    for (let i = 0; i < nodes.length && removed < target; i++) {
      const n = nodes[i]
      // mai le radici, mai ciò che è stato attraversato in questo frame
      if (n.level === 0 || n.lastUsed >= this.frame) continue
      if (n.mesh) {
        this.group.remove(n.mesh)
        n.mesh.geometry.dispose()
        n.mesh = null
      }
      this.cache.delete(n.key)
      // il padre non deve tenere riferimenti a nodi fuori cache
      if (n.parent && n.parent.children && n.parent.children.includes(n)) {
        n.parent.children = null
      }
      if (n.children) n.children = null
      removed++
    }
  }

  setCamera(camera) {
    this._cameraRef = camera
  }

  dispose() {
    for (const node of this.cache.values()) {
      if (node.mesh) node.mesh.geometry.dispose()
    }
    this.cache.clear()
    this.scene.remove(this.group)
  }
}
