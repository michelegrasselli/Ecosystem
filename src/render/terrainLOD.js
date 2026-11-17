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

const MAX_CACHED_TILES = 4200
const SPLIT_PIXELS = 96
const MAX_TILES_PER_FRAME = 24
// mesh create per frame dai risultati dei worker (la creazione è economica,
// il caricamento sulla GPU avviene al primo render)
const MAX_MESHES_PER_FRAME = 64

const _sphere = new THREE.Sphere()
const _v = new THREE.Vector3()

export class TerrainLOD {
  constructor(planet, scene, material, pool = null) {
    this.planet = planet
    this.pool = pool
    this.scene = scene
    this.material = material
    this.group = new THREE.Group()
    this.group.matrixAutoUpdate = false
    scene.add(this.group)

    this.cache = new Map()
    this.frame = 0
    this.needed = []
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
    node.mesh.visible = false
    this.group.add(node.mesh)
  }

  /**
   * Aggiorna il LOD.
   * @param {THREE.Camera} camera
   * @param {number} viewportHeight pixel
   */
  update(camera, viewportHeight) {
    this.frame++
    this.needed.length = 0

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

    // visibilità: solo ciò che è stato disegnato in questo frame
    for (let i = 0; i < this._prevDrawn.length; i++) {
      const m = this._prevDrawn[i].mesh
      if (m) m.visible = false
    }
    let maxLevel = 0
    for (let i = 0; i < this.drawn.length; i++) {
      const n = this.drawn[i]
      n.mesh.visible = true
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

    if (node.level < MAX_LOD_LEVEL && this.shouldSplit(node, camera)) {
      if (!node.children) node.children = this.createChildren(node)
      const ch = node.children
      let ready = true
      for (let i = 0; i < 4; i++) {
        ch[i].lastUsed = this.frame
        if (!ch[i].mesh) {
          ready = false
          this.needed.push(ch[i])
        }
      }
      if (ready) {
        for (let i = 0; i < 4; i++) this.visit(ch[i], camera)
        return
      }
    }

    this.drawn.push(node)
  }

  /** Raggio (unità di scena) del punto più alto della tile con l'esagerazione corrente. */
  _reliefKm(node) {
    return node.hMax * SCENE_SCALE * this.exaggeration
  }

  shouldSplit(node, camera) {
    // distanza dal centro della tile alla quota media del suo rilievo
    const lift = (SCENE_RADIUS + this._reliefKm(node) * 0.5) / SCENE_RADIUS
    _v.copy(node.surfaceCenter).multiplyScalar(lift)
    const dist = camera.position.distanceTo(_v)
    if (dist <= 0.0001) return true
    const sizeKm = (Math.PI * 0.5 * SCENE_RADIUS) / (1 << node.level)
    const px = (sizeKm / dist) * this._screenFactor
    return px > SPLIT_PIXELS
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
      for (let i = 0; i < results.length; i++) {
        const r = results[i]
        if (built >= MAX_MESHES_PER_FRAME) {
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

    // priorità: prima i livelli più grossi (chiudono subito lo schermo), poi
    // le tile più vicine alla camera
    const cam = this._cameraRef
    this.needed.sort((a, b) => {
      if (a.level !== b.level) return a.level - b.level
      return cam
        ? cam.position.distanceToSquared(a.surfaceCenter) -
            cam.position.distanceToSquared(b.surfaceCenter)
        : 0
    })

    // 2. nuove richieste in ordine di priorità
    if (this.pool && this.pool.ok) {
      for (let i = 0; i < this.needed.length; i++) {
        if (!this.pool.hasCapacity()) break
        const node = this.needed[i]
        if (node.mesh || node.requestId) continue
        node.requestId = this.pool.request(node.key, node.face, node.level, node.x, node.y)
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
