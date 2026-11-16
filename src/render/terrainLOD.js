// Terreno a LOD: quadtree su cubo-sfera.
// Una sola mesh per tile, ricostruita solo quando serve. I figli sostituiscono
// il padre solo quando tutti e quattro sono pronti: nessun buco.

import * as THREE from 'three'
import { SCENE_RADIUS, MAX_LOD_LEVEL } from '../planet/constants.js'
import { buildTileMesh, tileBounds, qualityForLevel } from './tileBuilder.js'

const MAX_CACHED_TILES = 4200
const SPLIT_PIXELS = 110
const MAX_TILES_PER_FRAME = 24

const _sphere = new THREE.Sphere()

export class TerrainLOD {
  constructor(planet, scene, material) {
    this.planet = planet
    this.scene = scene
    this.material = material
    this.group = new THREE.Group()
    this.group.matrixAutoUpdate = false
    scene.add(this.group)

    this.cache = new Map()
    this.frame = 0
    this.needed = []
    this.buildBudgetMs = 7
    this.stats = { tiles: 0, visible: 0, built: 0 }

    this._frustum = new THREE.Frustum()
    this._projScreen = new THREE.Matrix4()
    this._cameraRef = null
    this._screenFactor = 1000

    this.roots = []
    for (let f = 0; f < 6; f++) this.roots.push(this.getNode(f, 0, 0, 0))
  }

  key(face, level, x, y) {
    return face + '/' + level + '/' + x + '/' + y
  }

  getNode(face, level, x, y) {
    const k = this.key(face, level, x, y)
    let node = this.cache.get(k)
    if (node) {
      node.lastUsed = this.frame
      return node
    }
    const b = tileBounds(face, level, x, y)
    node = {
      face,
      level,
      x,
      y,
      center: b.center,
      surfaceCenter: b.surfaceCenter,
      radius: b.radius,
      mesh: null,
      children: null,
      lastUsed: this.frame,
      visible: false,
      seen: -1
    }
    this.cache.set(k, node)
    return node
  }

  createChildren(node) {
    const x2 = node.x * 2
    const y2 = node.y * 2
    const l = node.level + 1
    return [
      this.getNode(node.face, l, x2, y2),
      this.getNode(node.face, l, x2 + 1, y2),
      this.getNode(node.face, l, x2, y2 + 1),
      this.getNode(node.face, l, x2 + 1, y2 + 1)
    ]
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

    for (let i = 0; i < this.roots.length; i++) this.visit(this.roots[i], camera)

    this.buildNeeded()

    let visible = 0
    for (const node of this.cache.values()) {
      const v = node.seen === this.frame && !!node.mesh
      if (node.mesh) node.mesh.visible = v
      if (v) visible++
    }
    this.stats.visible = visible
    this.stats.tiles = this.cache.size
  }

  visit(node, camera) {
    if (!this._sphereInFrustum(node)) {
      return
    }

    const split = node.level < MAX_LOD_LEVEL && this.shouldSplit(node, camera)

    if (split) {
      if (!node.children) node.children = this.createChildren(node)
      let ready = true
      for (let i = 0; i < 4; i++) {
        if (!node.children[i].mesh) {
          ready = false
          this.needed.push(node.children[i])
        }
      }
      if (ready) {
        for (let i = 0; i < 4; i++) this.visit(node.children[i], camera)
        return
      }
    }

    node.seen = this.frame
    node.lastUsed = this.frame
  }

  shouldSplit(node, camera) {
    const dist = camera.position.distanceTo(node.surfaceCenter)
    if (dist <= 0.0001) return false
    const sizeKm = (Math.PI * 0.5 * SCENE_RADIUS) / (1 << node.level)
    const px = (sizeKm / dist) * this._screenFactor
    return px > SPLIT_PIXELS
  }

  _sphereInFrustum(node) {
    _sphere.center.copy(node.center)
    _sphere.radius = node.radius
    return this._frustum.intersectsSphere(_sphere)
  }

  buildNeeded() {
    if (this.needed.length === 0) {
      this.stats.built = 0
      return
    }

    // priorità: prima le tile più vicine alla camera
    const cam = this._cameraRef
    if (cam) {
      this.needed.sort(
        (a, b) =>
          cam.position.distanceToSquared(a.surfaceCenter) -
          cam.position.distanceToSquared(b.surfaceCenter)
      )
    }

    const start = performance.now()
    let built = 0
    for (let i = 0; i < this.needed.length; i++) {
      if (built >= MAX_TILES_PER_FRAME) break
      if (performance.now() - start > this.buildBudgetMs) break
      const node = this.needed[i]
      if (node.mesh) continue
      node.mesh = buildTileMesh(
        this.planet,
        node.face,
        node.level,
        node.x,
        node.y,
        this.material
      )
      node.mesh.matrixAutoUpdate = false
      node.mesh.updateMatrix()
      node.mesh.visible = false
      this.group.add(node.mesh)
      built++
    }
    this.stats.built = built

    if (this.cache.size > MAX_CACHED_TILES) this.evict()
  }

  evict() {
    const nodes = [...this.cache.values()]
    nodes.sort((a, b) => a.lastUsed - b.lastUsed)
    let removed = 0
    for (let i = 0; i < nodes.length && removed < 500; i++) {
      const n = nodes[i]
      if (n.seen === this.frame && n.mesh) continue
      if (n.mesh) {
        this.group.remove(n.mesh)
        n.mesh.geometry.dispose()
        n.mesh = null
        this.cache.delete(this.key(n.face, n.level, n.x, n.y))
        removed++
      }
    }
  }

  setCamera(camera) {
    this._cameraRef = camera
  }

  /** Quota approssimativa del terreno sotto un punto (usa il LOD più alto disponibile). */
  dispose() {
    for (const node of this.cache.values()) {
      if (node.mesh) node.mesh.geometry.dispose()
    }
    this.cache.clear()
    this.scene.remove(this.group)
  }
}
