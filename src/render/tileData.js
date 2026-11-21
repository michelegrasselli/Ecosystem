// Calcolo dei dati di una tile del quadtree cubo-sfera (array tipizzati).
// Modulo puro, senza three.js: gira sia nel thread principale sia nei Web
// Worker (tileWorker.js), che restituiscono gli array per trasferimento.
//
// Le tile sono costruite a esagerazione verticale 1: il vertex shader sposta
// ogni vertice lungo la verticale di `aHeight * (k - 1)` (vedi relief.js).
// I vertici sono espressi rispetto al centro della tile (mesh.position):
// con coordinate assolute (~6371 km in float32) la precisione è di ~0.5 m e
// vicino al suolo i vertici "tremano".

import { Planet } from '../planet/planet.js'
import { BIOME } from '../planet/biomes.js'
import { SCENE_RADIUS, SCENE_SCALE } from '../planet/constants.js'

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
  // Con la generazione nei worker ci si può permettere maglie fitte anche
  // sui livelli grossi: dallo spazio una maglia resta sotto i ~2 pixel e
  // coste e biomi non si sfocano nell'interpolazione tra vertici.
  // Tile grandi con molti vertici invece di tante tile piccole: a parità di
  // densità di maglia a schermo le draw call si dimezzano. Risoluzioni pari
  // (servono al morph verso il padre).
  // 48 e non 64: con 64 si disegnavano ~3 triangoli per pixel (fino a 4.6
  // milioni a schermo) e su GPU integrate i soli vertici costavano 10-20 ms.
  // Il dettaglio sotto la maglia lo disegna lo shader; il tempo risparmiato
  // va alla risoluzione di rendering.
  if (level <= 1) return 40
  return 48
}

/** Quanto dettaglio del rumore calcolare.
 *  Deve essere identico a tutti i livelli: quote diverse tra LOD adiacenti
 *  produrrebbero gradini visibili sulle giunzioni. */
export function qualityForLevel(level) {
  return 1
}

/**
 * Classi di superficie per lo shader (foresta, sabbia, roccia, neve).
 * Sono pesi continui: interpolati tra i vertici e "sfrangiati" dal rumore nel
 * fragment shader, danno confini di bioma organici invece che a scalini.
 */
const SURFACE = (() => {
  const s = {}
  const set = (b, f, sand, rock, snow) => (s[b] = [f, sand, rock, snow])
  for (const k of Object.values(BIOME)) set(k, 0, 0, 0, 0)
  set(BIOME.TEMPERATE_FOREST, 1, 0, 0, 0)
  set(BIOME.RAINFOREST, 1, 0, 0, 0)
  set(BIOME.BOREAL_FOREST, 0.9, 0, 0, 0)
  set(BIOME.SAVANNA, 0.22, 0.1, 0, 0)
  set(BIOME.SHRUBLAND, 0.3, 0.05, 0, 0)
  set(BIOME.DESERT, 0, 1, 0, 0)
  set(BIOME.SEMI_DESERT, 0.04, 0.55, 0.1, 0)
  set(BIOME.BEACH, 0, 1, 0, 0)
  set(BIOME.TUNDRA, 0, 0, 0.3, 0.1)
  set(BIOME.WETLAND, 0.3, 0, 0, 0)
  set(BIOME.BADLANDS, 0, 0.25, 0.75, 0)
  set(BIOME.SALT_FLAT, 0, 0.15, 0, 0)
  set(BIOME.ALPINE_MEADOW, 0.05, 0, 0.12, 0)
  // roccia d'alta quota e neve perenne le calcola lo shader dalla quota del
  // fragment (linee continue che seguono il terreno, non scalini di maglia);
  // le calotte arrivano da `sample.ice`, che è già continuo
  return s
})()

const _dir = { x: 0, y: 0, z: 0 }
const _dirSub = { x: 0, y: 0, z: 0 }
const _sample = Planet.createSample()
const _sampleSub = Planet.createSample()

/**
 * Calcola vertici, normali e attributi di una tile.
 * @returns {object} array tipizzati + origin [x,y,z] + hMax
 */
export function computeTileData(planet, face, level, ix, iy) {
  const res = tileResForLevel(level)
  const quality = qualityForLevel(level)
  const div = 1 << level

  const row = res + 1
  const gridVerts = row * row
  const skirtCount = 4 * row
  const total = gridVerts + skirtCount

  // origine locale della tile: centro sulla sfera a livello del mare
  cubeFaceDir(face, ((ix + 0.5) / div) * 2 - 1, ((iy + 0.5) / div) * 2 - 1, _dir)
  const ox = _dir.x * SCENE_RADIUS
  const oy = _dir.y * SCENE_RADIUS
  const oz = _dir.z * SCENE_RADIUS

  const positions = new Float32Array(total * 3)
  const normals = new Float32Array(total * 3)
  const colors = new Float32Array(total * 3)
  const water = new Float32Array(total)
  const heights = new Float32Array(total)
  const surf = new Float32Array(total * 4)
  const skirt = new Float32Array(total)
  const morph = new Float32Array(total)

  // --- griglia estesa di una cella per lato ---
  // Le normali sui bordi devono usare lo stesso stencil della tile vicina:
  // con differenze unilaterali ogni tile otteneva una normale diversa sul
  // confine, e il toon shading la trasformava in una riga scura.
  // Le coordinate usano una formula globale, così due tile adiacenti
  // calcolano vertici identici bit per bit. Float64: ai livelli profondi le
  // maglie sono di pochi metri e in float32 le normali diventerebbero rumore.
  const ext = res + 3
  const extPos = new Float64Array(ext * ext * 3)
  const extCol = new Float32Array(ext * ext * 3)
  const extWater = new Float32Array(ext * ext)
  const extHeight = new Float32Array(ext * ext)
  const extSurf = new Float32Array(ext * ext * 4)

  let hMax = 0

  for (let gv = 0; gv < ext; gv++) {
    const v = ((iy + (gv - 1) / res) / div) * 2 - 1
    for (let gu = 0; gu < ext; gu++) {
      const u = ((ix + (gu - 1) / res) / div) * 2 - 1
      cubeFaceDir(face, u, v, _dir)
      planet.sample(_dir.x, _dir.y, _dir.z, quality, _sample)

      const rawH = _sample.height
      let h = rawH
      let w = _sample.water
      if (h < 0) {
        // il fondale non viene disegnato: il mare è una superficie piatta a quota 0
        h = 0
        w = 1
      }

      // Colore: sui LOD grossi una sola lettura per vertice "pesca" fiumi,
      // spiagge e laghi larghi pochi km e li spalma su tutta la maglia.
      // Mediando 4 sotto-campioni per cella il colore diventa una media
      // d'area (antialiasing), come una mipmap.
      let cr = _sample.r
      let cg = _sample.g
      let cb = _sample.b
      // solo sui livelli più grossi: con maglie fitte dal livello 4 in su il
      // singolo campione basta, e la tile costa 9 ms invece di 30.
      // Eccezione: le maglie appena sopra o sotto il livello del mare (costa,
      // spiagge, laghi). Lì il colore per vertice è una classificazione netta e
      // la linea di costa veniva a scalini; mediando 4 sotto-campioni diventa
      // una copertura morbida, come una mipmap. Sono pochi vertici per tile.
      if (level <= 3 || (rawH > -250 && rawH < 250)) {
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
      const ei = gv * ext + gu
      const e3 = ei * 3
      extPos[e3] = _dir.x * r
      extPos[e3 + 1] = _dir.y * r
      extPos[e3 + 2] = _dir.z * r
      extCol[e3] = cr
      extCol[e3 + 1] = cg
      extCol[e3 + 2] = cb
      // paludi: acqua "latente" sotto la soglia; il rumore dello shader la fa
      // affiorare a chiazze, come pozze e canali tra la vegetazione
      if (_sample.biome === BIOME.WETLAND && w < 0.41) w = 0.41
      extWater[ei] = w
      // quota reale (negativa sul mare): lo shader la usa per la profondità
      // dell'acqua; lo spostamento verticale usa solo la parte positiva
      extHeight[ei] = rawH
      // pesi di superficie mediati sulla classificazione morbida del pianeta
      // (stessa media del colore): foreste, sabbia e roccia sfumano insieme
      let s0 = 0
      let s1 = 0
      let s2 = 0
      let s3 = 0
      const mc = _sample.mixCount
      for (let k = 0; k < mc; k++) {
        const sc = SURFACE[_sample.mix[k]]
        s0 += sc[0]
        s1 += sc[1]
        s2 += sc[2]
        s3 += sc[3]
      }
      const e4 = ei * 4
      extSurf[e4] = s0 / mc
      extSurf[e4 + 1] = s1 / mc
      extSurf[e4 + 2] = s2 / mc
      extSurf[e4 + 3] = Math.max(s3 / mc, _sample.ice)
      if (h > hMax) hMax = h
    }
  }

  // --- vertici e normali della griglia ---
  for (let gy = 0; gy < row; gy++) {
    const ev = gy + 1
    for (let gx = 0; gx < row; gx++) {
      const eu = gx + 1
      const ei = ev * ext + eu
      const src = ei * 3
      const vi = gy * row + gx
      const i3 = vi * 3

      positions[i3] = extPos[src] - ox
      positions[i3 + 1] = extPos[src + 1] - oy
      positions[i3 + 2] = extPos[src + 2] - oz
      colors[i3] = extCol[src]
      colors[i3 + 1] = extCol[src + 1]
      colors[i3 + 2] = extCol[src + 2]
      water[vi] = extWater[ei]
      heights[vi] = extHeight[ei]
      surf[vi * 4] = extSurf[ei * 4]
      surf[vi * 4 + 1] = extSurf[ei * 4 + 1]
      surf[vi * 4 + 2] = extSurf[ei * 4 + 2]
      surf[vi * 4 + 3] = extSurf[ei * 4 + 3]

      // differenze centrali: stencil identico in ogni tile
      const ia = (ei + 1) * 3
      const ib = (ei - 1) * 3
      const ic = (ei - ext) * 3
      const id = (ei + ext) * 3

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
      normals[i3] = nx / len
      normals[i3 + 1] = ny / len
      normals[i3 + 2] = nz / len
    }
  }

  // --- morph verso il padre ---
  // Per ogni vertice, la differenza (m) tra la quota che avrebbe la tile
  // padre in quel punto e la quota vera. Il padre ha maglie larghe il doppio:
  // sui vertici pari coincide, sui dispari è la media dei vicini pari lungo
  // il lato o lungo la diagonale del quad del padre (b-c, come negli indici).
  // Lo shader parte dalla forma del padre e si raffina in pochi decimi di
  // secondo: niente "scatto" quando una tile più fine sostituisce la grossa.
  {
    const hAt = (gx, gy) => Math.max(heights[gy * row + gx], 0)
    for (let gy = 0; gy < row; gy++) {
      for (let gx = 0; gx < row; gx++) {
        const ox2 = gx & 1
        const oy2 = gy & 1
        let hc
        if (!ox2 && !oy2) hc = hAt(gx, gy)
        else if (ox2 && !oy2) hc = 0.5 * (hAt(gx - 1, gy) + hAt(gx + 1, gy))
        else if (!ox2 && oy2) hc = 0.5 * (hAt(gx, gy - 1) + hAt(gx, gy + 1))
        else hc = 0.5 * (hAt(gx + 1, gy - 1) + hAt(gx - 1, gy + 1))
        morph[gy * row + gx] = hc - hAt(gx, gy)
      }
    }
  }

  // --- gonna (skirt) per nascondere le crepe tra livelli diversi ---
  const tileSizeKm = (Math.PI * 0.5 * SCENE_RADIUS) / div
  // La crepa tra due livelli è al massimo la differenza tra la quota vera e
  // quella interpolata sulla maglia grossa: la gonna deve coprire anche le
  // montagne, quindi la sua profondità cresce con il dislivello della tile.
  const cellKm = tileSizeKm / res
  const skirtDepth = Math.min(Math.max(cellKm * 0.6, 0.04) + hMax * SCENE_SCALE * 0.45, 60)

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
    // direzione radiale del vertice di bordo
    const px = positions[s3] + ox
    const py = positions[s3 + 1] + oy
    const pz = positions[s3 + 2] + oz
    const pl = Math.sqrt(px * px + py * py + pz * pz)
    positions[d3] = positions[s3] - (px / pl) * skirtDepth
    positions[d3 + 1] = positions[s3 + 1] - (py / pl) * skirtDepth
    positions[d3 + 2] = positions[s3 + 2] - (pz / pl) * skirtDepth
    normals[d3] = normals[s3]
    normals[d3 + 1] = normals[s3 + 1]
    normals[d3 + 2] = normals[s3 + 2]
    colors[d3] = colors[s3]
    colors[d3 + 1] = colors[s3 + 1]
    colors[d3 + 2] = colors[s3 + 2]
    water[dst] = water[src]
    heights[dst] = heights[src]
    morph[dst] = morph[src]
    for (let c = 0; c < 4; c++) surf[dst * 4 + c] = surf[src * 4 + c]
    skirt[dst] = skirtDepth
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

  // strisce della gonna
  // L'ordine dei triangoli deve lasciare la faccia esterna verso l'esterno
  // della tile: con i bordi sud/est il verso di percorrenza è già giusto, per
  // nord/ovest va invertito. Quando era sbagliato la gonna veniva scartata dal
  // backface culling e nelle giunzioni tra livelli diversi restavano crepe nere.
  const borders = [
    [0, 1, false], // bordo sud (gy=0)
    [res * row, 1, true], // bordo nord
    [0, row, true], // bordo ovest
    [res, row, false] // bordo est
  ]
  for (let b = 0; b < 4; b++) {
    const [start, stride, flip] = borders[b]
    const skirtBase = gridVerts + b * row
    for (let i = 0; i < res; i++) {
      const t0 = start + stride * i
      const t1 = start + stride * (i + 1)
      const s0 = skirtBase + i
      const s1 = skirtBase + i + 1
      if (flip) {
        indices[o++] = t0; indices[o++] = t1; indices[o++] = s0
        indices[o++] = t1; indices[o++] = s1; indices[o++] = s0
      } else {
        indices[o++] = t0; indices[o++] = s0; indices[o++] = t1
        indices[o++] = t1; indices[o++] = s0; indices[o++] = s1
      }
    }
  }

  return {
    positions, normals, colors, water, heights, surf, skirt, morph, indices,
    origin: [ox, oy, oz],
    hMax
  }
}

/** Buffer da trasferire (zero-copy) da un worker. */
export function tileTransferables(d) {
  return [d.positions.buffer, d.normals.buffer, d.colors.buffer, d.water.buffer,
    d.heights.buffer, d.surf.buffer, d.skirt.buffer, d.morph.buffer, d.indices.buffer]
}
