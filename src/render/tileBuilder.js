// Costruzione della geometria di una tile del quadtree cubo-sfera.

import * as THREE from 'three'
import { Planet } from '../planet/planet.js'
import { PLANET_RADIUS, SCENE_RADIUS, SCENE_SCALE } from '../planet/constants.js'

/** Direzione unitaria sul cubo per la faccia `face` e coordinate (u,v) in [-1,1]. */
export function cubeFaceDir(face, u, v, out) {
  switch (face) {
    case 0: out.x = 1; out.y = v; out.z = -u; break
    case 1: out.x = -1; out.y = v; out.z = u; break
    case 2: out.x = u; out.y = 1; out.z = -v; break
    case 3: out.x = u; out.y = -1; out.z = v; break
    case 4: out.x = u; out.y = v; out.z = 1; break
    default: out.x = -u; out.y = v; out.z = -1; break
  }
  const len = Math.sqrt(out.x * out.x + out.y * out.y + out.z * out.z)
  const inv = 1 / len
  out.x *= inv
  out.y *= inv
  out.z *= inv
  return out
}

/** Risoluzione della griglia per livello LOD. */
export function tileResForLevel(level) {
  if (level <= 1) return 10
  if (level <= 3) return 14
  if (level <= 5) return 20
  if (level <= 7) return 28
  if (level <= 9) return 36
  return 44
}

/** Quanto dettaglio del rumore calcolare.
 *  Deve essere identico a tutti i livelli: quote diverse tra LOD adiacenti
 *  produrrebbero gradini visibili sulle giunzioni. */
export function qualityForLevel(level) {
  return 1
}

const _dir = { x: 0, y: 0, z: 0 }
const _dirSub = { x: 0, y: 0, z: 0 }
const _sample = Planet.createSample()
const _sampleSub = Planet.createSample()

/**
 * Crea la mesh di una tile.
 * @param {Planet} planet
 * @param {number} face 0..5
 * @param {number} level
 * @param {number} ix
 * @param {number} iy
 * @param {THREE.Material} material
 */
export function buildTileMesh(planet, face, level, ix, iy, material) {
  const res = tileResForLevel(level)
  const quality = qualityForLevel(level)
  const div = 1 << level

  const row = res + 1
  const gridVerts = row * row
  const skirtCount = 4 * row
  const total = gridVerts + skirtCount

  const positions = new Float32Array(total * 3)
  const normals = new Float32Array(total * 3)
  const colors = new Float32Array(total * 3)
  const water = new Float32Array(total)

  // --- griglia estesa di una cella per lato ---
  // Le normali sui bordi devono usare lo stesso stencil della tile vicina:
  // con differenze unilaterali ogni tile otteneva una normale diversa sul
  // confine, e il toon shading la trasformava in una riga scura.
  // Le coordinate usano una formula globale, così due tile adiacenti
  // calcolano vertici identici bit per bit.
  const ext = res + 3
  const extPos = new Float32Array(ext * ext * 3)
  const extCol = new Float32Array(ext * ext * 3)
  const extWater = new Float32Array(ext * ext)

  for (let gv = 0; gv < ext; gv++) {
    const v = ((iy + (gv - 1) / res) / div) * 2 - 1
    for (let gu = 0; gu < ext; gu++) {
      const u = ((ix + (gu - 1) / res) / div) * 2 - 1
      cubeFaceDir(face, u, v, _dir)
      planet.sample(_dir.x, _dir.y, _dir.z, quality, _sample)

      let h = _sample.height
      let w = _sample.water
      if (h < 0) {
        // il fondale non viene disegnato: il mare è una superficie piatta a quota 0
        h = 0
        w = 1
      }
      if (w > 0 && h < 0) h = 0

      // Colore: sui LOD grossi una sola lettura per vertice "pesca" fiumi,
      // spiagge e laghi larghi pochi km e li spalma su tutta la maglia: si
      // vedono macchie chiare in mezzo al mare e blocchi di colore diverso tra
      // livelli adiacenti. Mediando 4 sotto-campioni per cella il colore
      // diventa una media d'area (antialiasing), come una mipmap.
      let cr = _sample.r
      let cg = _sample.g
      let cb = _sample.b
      if (level <= 5) {
        // 4 punti dentro la cella: antialiasing senza sfocare le coste
        const off = (2 / (div * res)) * 0.25
        cr = 0
        cg = 0
        cb = 0
        for (let sy = -1; sy <= 1; sy += 2) {
          for (let sx = -1; sx <= 1; sx += 2) {
            cubeFaceDir(face, u + sx * off, v + sy * off, _dirSub)
            planet.sample(_dirSub.x, _dirSub.y, _dirSub.z, quality, _sampleSub)
            cr += _sampleSub.r
            cg += _sampleSub.g
            cb += _sampleSub.b
          }
        }
        cr *= 0.25
        cg *= 0.25
        cb *= 0.25
      }

      const r = SCENE_RADIUS + h * SCENE_SCALE
      const e3 = (gv * ext + gu) * 3
      extPos[e3] = _dir.x * r
      extPos[e3 + 1] = _dir.y * r
      extPos[e3 + 2] = _dir.z * r
      extCol[e3] = cr
      extCol[e3 + 1] = cg
      extCol[e3 + 2] = cb
      extWater[gv * ext + gu] = w
    }
  }

  // --- vertici e normali della griglia ---
  for (let gy = 0; gy < row; gy++) {
    const ev = gy + 1
    for (let gx = 0; gx < row; gx++) {
      const eu = gx + 1
      const src = (ev * ext + eu) * 3
      const i3 = (gy * row + gx) * 3

      positions[i3] = extPos[src]
      positions[i3 + 1] = extPos[src + 1]
      positions[i3 + 2] = extPos[src + 2]
      colors[i3] = extCol[src]
      colors[i3 + 1] = extCol[src + 1]
      colors[i3 + 2] = extCol[src + 2]
      water[gy * row + gx] = extWater[ev * ext + eu]

      // differenze centrali: stencil identico in ogni tile
      const ia = (ev * ext + eu + 1) * 3
      const ib = (ev * ext + eu - 1) * 3
      const ic = ((ev - 1) * ext + eu) * 3
      const id = ((ev + 1) * ext + eu) * 3

      const ax = extPos[ia] - extPos[ib]
      const ay = extPos[ia + 1] - extPos[ib + 1]
      const az = extPos[ia + 2] - extPos[ib + 2]
      const bx = extPos[id] - extPos[ic]
      const by = extPos[id + 1] - extPos[ic + 1]
      const bz = extPos[id + 2] - extPos[ic + 2]

      let nx = ay * bz - az * by
      let ny = az * bx - ax * bz
      let nz = ax * by - ay * bx
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
      nx /= len
      ny /= len
      nz /= len

      normals[i3] = nx
      normals[i3 + 1] = ny
      normals[i3 + 2] = nz
    }
  }

  // --- gonna (skirt) per nascondere le crepe tra livelli diversi ---
  const tileSizeKm = (Math.PI * 0.5 * SCENE_RADIUS) / div
  // la gonna deve coprire sia il rilievo sia la corda tra LOD adiacenti
  const skirtDepth = Math.min(Math.max(tileSizeKm * 0.06, 0.6), 26)
  const skirtScale = (SCENE_RADIUS - skirtDepth) / SCENE_RADIUS

  const edgeIndices = []
  for (let gx = 0; gx < row; gx++) edgeIndices.push(gx) // bordo sud (gy=0)
  for (let gx = 0; gx < row; gx++) edgeIndices.push(res * row + gx) // bordo nord
  for (let gy = 0; gy < row; gy++) edgeIndices.push(gy * row) // bordo ovest
  for (let gy = 0; gy < row; gy++) edgeIndices.push(gy * row + res) // bordo est

  for (let i = 0; i < skirtCount; i++) {
    const src = edgeIndices[i]
    const dst = gridVerts + i
    const s3 = src * 3
    const d3 = dst * 3
    positions[d3] = positions[s3] * skirtScale
    positions[d3 + 1] = positions[s3 + 1] * skirtScale
    positions[d3 + 2] = positions[s3 + 2] * skirtScale
    normals[d3] = normals[s3]
    normals[d3 + 1] = normals[s3 + 1]
    normals[d3 + 2] = normals[s3 + 2]
    colors[d3] = colors[s3]
    colors[d3 + 1] = colors[s3 + 1]
    colors[d3 + 2] = colors[s3 + 2]
    water[dst] = water[src]
  }

  // --- indici ---
  const mainTris = res * res * 2
  const skirtTris = 4 * res * 2
  const indices = new Uint32Array((mainTris + skirtTris) * 3)
  let o = 0
  for (let gy = 0; gy < res; gy++) {
    for (let gx = 0; gx < res; gx++) {
      const a = gy * row + gx
      const b = a + 1
      const c = a + row
      const d = c + 1
      indices[o++] = a; indices[o++] = b; indices[o++] = c
      indices[o++] = b; indices[o++] = d; indices[o++] = c
    }
  }

  // strips della gonna
  const borders = [
    [0, 1, false], // sud: avanza in +x
    [res * row, 1, false],
    [0, row, true],
    [res, row, true]
  ]
  for (let b = 0; b < 4; b++) {
    const [start, stride] = borders[b]
    const skirtBase = gridVerts + b * row
    for (let i = 0; i < res; i++) {
      const t0 = start + stride * i
      const t1 = start + stride * (i + 1)
      const s0 = skirtBase + i
      const s1 = skirtBase + i + 1
      indices[o++] = t0; indices[o++] = s0; indices[o++] = t1
      indices[o++] = t1; indices[o++] = s0; indices[o++] = s1
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3))
  geo.setAttribute('aWater', new THREE.BufferAttribute(water, 1))
  geo.setIndex(new THREE.BufferAttribute(indices, 1))
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), SCENE_RADIUS * 2)

  const mesh = new THREE.Mesh(geo, material)
  mesh.frustumCulled = false
  mesh.matrixAutoUpdate = false
  return mesh
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
  // margine per il rilievo (max ~9 km)
  rad += 10

  return {
    center: new THREE.Vector3(cx, cy, cz),
    radius: rad,
    surfaceCenter: new THREE.Vector3(pts[4][0], pts[4][1], pts[4][2])
  }
}

export { PLANET_RADIUS }
