// Mesh di una tile del quadtree cubo-sfera, a partire dai dati calcolati da
// tileData.js (nel thread principale o in un Web Worker).
//
// Le tile sono costruite a esagerazione verticale 1: il vertex shader sposta
// ogni vertice lungo la verticale di `aHeight * (k - 1)` (vedi relief.js).
// I vertici sono espressi rispetto al centro della tile (mesh.position):
// con coordinate assolute (~6371 km in float32) la precisione è di ~0.5 m e
// vicino al suolo i vertici "tremano".

import * as THREE from 'three'
import { PLANET_RADIUS, SCENE_RADIUS } from '../planet/constants.js'
import { cubeFaceDir, computeTileData } from './tileData.js'

export { cubeFaceDir, tileResForLevel, qualityForLevel } from './tileData.js'

/** Crea la mesh dai dati di una tile. */
export function createTileMesh(d, material) {
  const { positions, normals, colors, water, heights, surf, skirt, morph, indices, hMax } = d
  const [ox, oy, oz] = d.origin
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aWater', new THREE.BufferAttribute(water, 1))
  geo.setAttribute('aHeight', new THREE.BufferAttribute(heights, 1))
  geo.setAttribute('aSurf', new THREE.BufferAttribute(surf, 4))
  geo.setAttribute('aSkirt', new THREE.BufferAttribute(skirt, 1))
  geo.setAttribute('aMorph', new THREE.BufferAttribute(morph, 1))
  geo.setAttribute('aVolc', new THREE.BufferAttribute(d.volc, 2))
  geo.setAttribute('aEco', new THREE.BufferAttribute(d.eco, 4))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SCENE_RADIUS * 2)

  const mesh = new THREE.Mesh(geo, material)
  mesh.frustumCulled = false
  mesh.position.set(ox, oy, oz)
  mesh.matrixAutoUpdate = false
  mesh.updateMatrix()
  mesh.userData.hMax = hMax
  // piante della tile (planet/flora.js), disegnate da render/vegetation.js
  mesh.userData.veg = d.veg || null
  // avanzamento del morph (0 = forma del padre, 1 = forma propria), aggiornato
  // dal LOD; caricato nello shader solo quando cambia rispetto al draw prima
  mesh.userData.morph = 1
  mesh.onBeforeRender = onBeforeRenderTile
  return mesh
}

function onBeforeRenderTile(renderer, scene, camera, geometry, material) {
  const U = material.uniforms
  const u = U.uMorph
  const m = this.userData.morph
  if (u.value !== m) {
    u.value = m
    material.uniformsNeedUpdate = true
  }
  // nazioni candidate della tile (vedi Nations.candidatesForTile): 0 = tutte
  const nc = this.userData.natCand
  const n = nc ? nc.length : 0
  const cu = U.uNatCand.value
  let changed = U.uNatCandN.value !== n
  for (let i = 0; i < n && !changed; i++) if (cu[i] !== nc[i]) changed = true
  if (changed) {
    U.uNatCandN.value = n
    for (let i = 0; i < n; i++) cu[i] = nc[i]
    material.uniformsNeedUpdate = true
  }
}

/** Calcola e crea la mesh nel thread principale (radici, fallback senza worker). */
export function buildTileMesh(planet, face, level, ix, iy, material) {
  return createTileMesh(computeTileData(planet, face, level, ix, iy), material)
}

/** Metadati geometrici statici di una tile (centro e raggio della sfera di contenimento). */
export function tileBounds(face, level, ix, iy) {
  const div = 1 << level
  const u0 = (ix / div) * 2 - 1
  const u1 = ((ix + 1) / div) * 2 - 1
  const v0 = (iy / div) * 2 - 1
  const v1 = ((iy + 1) / div) * 2 - 1

  const corners = [
    [u0, v0], [u1, v0], [u0, v1], [u1, v1],
    [(u0 + u1) / 2, (v0 + v1) / 2]
  ]
  let cx = 0, cy = 0, cz = 0
  const pts = []
  for (const [u, v] of corners) {
    const d = cubeFaceDir(face, u, v, { x: 0, y: 0, z: 0 })
    const p = [d.x * SCENE_RADIUS, d.y * SCENE_RADIUS, d.z * SCENE_RADIUS]
    pts.push(p)
    cx += p[0]; cy += p[1]; cz += p[2]
  }
  cx /= pts.length; cy /= pts.length; cz /= pts.length

  let rad = 0
  for (const p of pts) {
    const d = Math.hypot(p[0] - cx, p[1] - cy, p[2] - cz)
    if (d > rad) rad = d
  }

  return {
    center: new THREE.Vector3(cx, cy, cz),
    // raggio geometrico a livello del mare: il margine per il rilievo
    // (che dipende dall'esagerazione corrente) lo aggiunge il LOD
    radius: rad,
    surfaceCenter: new THREE.Vector3(pts[4][0], pts[4][1], pts[4][2])
  }
}

export { PLANET_RADIUS }
