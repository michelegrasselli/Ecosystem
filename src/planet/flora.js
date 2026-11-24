// Flora di Elyra: catalogo delle specie e posizionamento delle piante.
//
// Modulo puro (senza three.js): gira nei Web Worker insieme al calcolo delle
// tile (tileData.js). Le geometrie delle specie sono in render/plantModels.js.
//
// Posizionamento
// --------------
// Le piante nascono da una GRIGLIA GLOBALE di candidati su ogni faccia del
// cubo-sfera (passo ~45 m), con uno spostamento casuale dentro la cella. Ogni
// candidato ha valori pseudo-casuali fissi (hash delle sue coordinate intere):
// una tile e le sue figlie vedono quindi le stesse piante, e una pianta non
// cambia posto quando il LOD si raffina.
// Un candidato diventa pianta se:
//  - il bioma (letto dai campioni della tile) la prevede, con la sua densità;
//  - la "macchia" lo permette: un rumore a ~2 km e ~0.5 km raggruppa le piante
//    in boschi, boschetti e radure (resta spazio libero per altro);
//  - il suo rango è sotto la quota del livello: le tile grosse (lontane)
//    tengono solo una parte delle piante, le fini tutte. Da lontano il bosco
//    fitto lo disegna lo shader del terreno (chiome procedurali).
//
// Dimensioni: alberi comuni 50-100 m, giganti fino a ~350 m (un po' più grandi
// del vero: devono leggersi con uno zoom "da regione" di qualche km, senza
// diventare montagne).

import { BIOME, SNOW_LINE_BASE, SNOW_LINE_LAT } from './biomes.js'
import { SCENE_RADIUS } from './constants.js'

// ------------------------------------------------------------- specie
// h: altezza tipica (km); var: variazione relativa dell'altezza
export const SPECIES = [
  { id: 0, key: 'elderoak', name: 'Elderoak', h: 0.075, var: 0.3 }, // latifoglia a chioma tonda
  { id: 1, key: 'spirepine', name: 'Spirepine', h: 0.09, var: 0.3 }, // conifera a guglia
  { id: 2, key: 'canopyTitan', name: 'Canopy Titan', h: 0.2, var: 0.25 }, // gigante a ombrello, tronco intrecciato
  { id: 3, key: 'fernpalm', name: 'Fernpalm', h: 0.06, var: 0.3 }, // palma-felce con fronde ricadenti
  { id: 4, key: 'glowcap', name: 'Glowcap', h: 0.05, var: 0.35 }, // fungo-albero luminoso (arancio/viola)
  { id: 5, key: 'lanternpod', name: 'Lanternpod', h: 0.028, var: 0.3 }, // steli con baccelli turchesi maculati
  { id: 6, key: 'bramble', name: 'Bramblebush', h: 0.018, var: 0.4 }, // cespuglio
  { id: 7, key: 'sunshade', name: 'Sunshade', h: 0.05, var: 0.3 }, // albero a ombrello piatto (savana)
  { id: 8, key: 'mistweeper', name: 'Mistweeper', h: 0.055, var: 0.3 }, // salice con fili luminosi (paludi)
  { id: 9, key: 'prismbloom', name: 'Prismbloom', h: 0.06, var: 0.4 }, // fiore di cristallo viola-azzurro
  { id: 10, key: 'thornpillar', name: 'Thornpillar', h: 0.065, var: 0.35 }, // cactus a colonna con braccia
  { id: 11, key: 'sunspike', name: 'Sunspike', h: 0.045, var: 0.35 }, // ciuffo di spine dorate
  { id: 12, key: 'ashwraith', name: 'Ashwraith', h: 0.08, var: 0.35 }, // albero carbonizzato, rami spogli
  { id: 13, key: 'cindercoral', name: 'Cinder Coral', h: 0.055, var: 0.35 }, // corallo cremisi con punte di brace
  { id: 14, key: 'snowpuff', name: 'Snowpuff', h: 0.04, var: 0.4 }, // batuffoli bianchi
  { id: 15, key: 'rimeglass', name: 'Rimeglass', h: 0.095, var: 0.3 }, // albero di cristallo di ghiaccio
  { id: 16, key: 'tidecrown', name: 'Tidecrown', h: 0.16, var: 0.25 }, // dal fondo del mare: campana e tentacoli luminosi
  { id: 17, key: 'kelpspire', name: 'Kelp Spire', h: 0.05, var: 0.35 }, // guglie d'alga con foglie a ventaglio
  { id: 18, key: 'duskbloom', name: 'Duskbloom', h: 0.022, var: 0.4 }, // fiore-calice rosa-magenta luminoso
  { id: 19, key: 'veilwood', name: 'Veilwood', h: 0.11, var: 0.3 } // albero alto e sottile, chioma violacea
]
export const SPECIES_COUNT = SPECIES.length

// ------------------------------------------------- piante per bioma
// d: densità (probabilità per candidato dentro la macchia)
// cover: frazione del bioma coperta dalla macchia (il resto è radura)
// mix: specie e pesi
const S = Object.fromEntries(SPECIES.map((s) => [s.key, s.id]))
const FLORA = {}
const set = (b, d, cover, mix) => (FLORA[b] = { d, cover, mix: Object.entries(mix).map(([k, w]) => [S[k], w]) })
set(BIOME.RAINFOREST, 0.62, 0.7, { elderoak: 0.2, fernpalm: 0.22, glowcap: 0.12, canopyTitan: 0.012, lanternpod: 0.1, bramble: 0.198, veilwood: 0.07, duskbloom: 0.08 })
set(BIOME.TEMPERATE_FOREST, 0.55, 0.6, { elderoak: 0.46, spirepine: 0.14, canopyTitan: 0.01, bramble: 0.2, veilwood: 0.06, lanternpod: 0.07, glowcap: 0.03, duskbloom: 0.03 })
set(BIOME.BOREAL_FOREST, 0.5, 0.62, { spirepine: 0.74, elderoak: 0.06, bramble: 0.1, snowpuff: 0.07, veilwood: 0.03 })
set(BIOME.GRASSLAND, 0.2, 0.42, { elderoak: 0.22, bramble: 0.24, lanternpod: 0.22, sunshade: 0.08, duskbloom: 0.12, veilwood: 0.07, prismbloom: 0.04, canopyTitan: 0.01 })
set(BIOME.SAVANNA, 0.12, 0.6, { sunshade: 0.48, bramble: 0.26, fernpalm: 0.08, lanternpod: 0.1, thornpillar: 0.08 })
set(BIOME.SHRUBLAND, 0.22, 0.55, { bramble: 0.55, sunshade: 0.08, thornpillar: 0.1, lanternpod: 0.12, duskbloom: 0.15 })
set(BIOME.WETLAND, 0.36, 0.6, { mistweeper: 0.42, glowcap: 0.24, bramble: 0.12, lanternpod: 0.1, duskbloom: 0.12 })
set(BIOME.DESERT, 0.16, 0.6, { thornpillar: 0.55, sunspike: 0.45 })
set(BIOME.SEMI_DESERT, 0.2, 0.62, { thornpillar: 0.35, sunspike: 0.25, bramble: 0.4 })
set(BIOME.BADLANDS, 0.15, 0.6, { thornpillar: 0.45, sunspike: 0.3, ashwraith: 0.25 })
set(BIOME.SALT_FLAT, 0.06, 0.5, { prismbloom: 0.55, sunspike: 0.45 })
set(BIOME.BEACH, 0.06, 0.5, { fernpalm: 0.85, bramble: 0.15 })
set(BIOME.ALPINE_MEADOW, 0.13, 0.55, { prismbloom: 0.34, bramble: 0.24, spirepine: 0.24, duskbloom: 0.18 })
set(BIOME.TUNDRA, 0.22, 0.62, { snowpuff: 0.5, rimeglass: 0.18, bramble: 0.32 })
set(BIOME.ICE, 0.12, 0.55, { rimeglass: 0.5, snowpuff: 0.5 })
set(BIOME.SNOW, 0.12, 0.55, { rimeglass: 0.5, snowpuff: 0.5 })
set(BIOME.ROCK, 0.1, 0.55, { prismbloom: 0.6, ashwraith: 0.4 })
set(BIOME.VOLCANIC, 0.16, 0.62, { ashwraith: 0.6, cindercoral: 0.4 })
set(BIOME.LAVA_FIELD, 0.2, 0.7, { cindercoral: 0.62, ashwraith: 0.38 })
set(BIOME.SCORCHED, 0.28, 0.7, { ashwraith: 0.62, cindercoral: 0.38 })
set(BIOME.OCEAN_SHELF, 0.06, 0.4, { kelpspire: 0.62, tidecrown: 0.38 })
set(BIOME.OCEAN, 0.018, 0.35, { tidecrown: 1 })
// sopra la linea delle nevi (la neve la disegna lo shader per quota)
const ABOVE_SNOW = { d: 0.12, cover: 0.55, mix: [[S.rimeglass, 0.5], [S.snowpuff, 0.5]] }
const NEAR_SNOW = { d: 0.08, cover: 0.5, mix: [[S.prismbloom, 0.35], [S.snowpuff, 0.35], [S.spirepine, 0.3]] }

// ------------------------------------------------------- griglia e LOD
/** Quota di piante tenute a un livello (le tile grosse sono lontane). */
export function vegKeep(level) {
  return keepFor(level)
}

export const VEG_MIN_LEVEL = 10 // tile di ~9.8 km: da qui in giù le piante 3D
const FACE_KM = (Math.PI * 0.5 * SCENE_RADIUS) // lato di una faccia del cubo (km, all'equatore)
const SPACING_KM = 0.045
const CELL_UV = (SPACING_KM / FACE_KM) * 2
// quota di piante tenute per livello: le tile grosse sono lontane
const KEEP = { 10: 0.08, 11: 0.2, 12: 0.4, 13: 0.7, 14: 0.9 }
const keepFor = (level) => (level >= 15 ? 1 : KEEP[level] ?? 0)

// ------------------------------------------------------- hash e rumore
function hash4(a, b, c, d) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35)
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) ^ Math.imul(c + 0x7f4a7c15, 0x297a2d39)
  h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) ^ Math.imul(d + 0x1b873593, 0xcc9e2d51)
  h ^= h >>> 16
  h = Math.imul(h, 0x7feb352d)
  h ^= h >>> 15
  return (h >>> 0) / 4294967296
}

function vnoise(face, x, y, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = hash4(face, xi, yi, seed)
  const b = hash4(face, xi + 1, yi, seed)
  const c = hash4(face, xi, yi + 1, seed)
  const d = hash4(face, xi + 1, yi + 1, seed)
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy
}

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/**
 * Piante di una tile.
 * @param {object} t dati della tile: face, level, ix, iy, res, cubeFaceDir,
 *   grid: { biome Uint8Array, height Float32Array (m, negativa sul mare),
 *           water, lava, burn } su (res+1)^2 vertici
 * @returns {{ count, species: Uint8Array, pos: Float64Array, attr: Float32Array }|null}
 *   pos: punto sulla sfera a livello del mare (km); attr: quota del suolo (km,
 *   >= 0), altezza della pianta (km), rotazione (rad), variazione (0..1), rango
 *   (0..1: le piante con rango basso esistono già nelle tile più grosse)
 */
export function placeVegetation(t) {
  const { face, level, ix, iy, res, grid, cubeFaceDir, seed = 1 } = t
  const keep = keepFor(level)
  if (keep <= 0) return null
  const div = 1 << level
  const u0 = (ix / div) * 2 - 1
  const v0 = (iy / div) * 2 - 1
  const span = 2 / div
  const ci0 = Math.floor((u0 + 1) / CELL_UV)
  const cj0 = Math.floor((v0 + 1) / CELL_UV)
  const ci1 = Math.floor((u0 + span + 1) / CELL_UV)
  const cj1 = Math.floor((v0 + span + 1) / CELL_UV)
  const row = res + 1

  // capienza: al più un candidato per cella
  const maxN = Math.max(16, Math.ceil((ci1 - ci0 + 1) * (cj1 - cj0 + 1) * 0.7 * keep) + 16)
  let species = new Uint8Array(maxN)
  let pos = new Float64Array(maxN * 3)
  let attr = new Float32Array(maxN * 5)
  let n = 0
  const dir = { x: 0, y: 0, z: 0 }
  // scale del rumore delle macchie, in celle della griglia globale
  const big = 2.0 / SPACING_KM // ~2 km
  const small = 0.5 / SPACING_KM // ~0.5 km

  for (let cj = cj0; cj <= cj1; cj++) {
    for (let ci = ci0; ci <= ci1; ci++) {
      const rank = hash4(face, ci, cj, seed)
      if (rank >= keep) continue
      const jx = hash4(face, ci, cj, seed + 11)
      const jy = hash4(face, ci, cj, seed + 23)
      const u = (ci + 0.15 + 0.7 * jx) * CELL_UV - 1
      const v = (cj + 0.15 + 0.7 * jy) * CELL_UV - 1
      // dentro la tile (le celle di bordo appartengono a una sola tile)
      if (u < u0 || u >= u0 + span || v < v0 || v >= v0 + span) continue

      // campioni della tile: vertice più vicino per bioma, bilineare per quota
      const gxF = ((u - u0) / span) * res
      const gyF = ((v - v0) / span) * res
      const gx = Math.min(res - 1, Math.max(0, Math.floor(gxF)))
      const gy = Math.min(res - 1, Math.max(0, Math.floor(gyF)))
      const fx = gxF - gx
      const fy = gyF - gy
      const i00 = gy * row + gx
      const i10 = i00 + 1
      const i01 = i00 + row
      const i11 = i01 + 1
      const near = (fx < 0.5 ? (fy < 0.5 ? i00 : i01) : fy < 0.5 ? i10 : i11)
      const g = grid
      // quota sullo STESSO triangolo che disegna il terreno (indici a,b,c e
      // b,d,c in tileData.js): con un'interpolazione bilineare, sulle maglie
      // larghe delle tile lontane le piante finivano sotto il terreno
      const hRaw =
        (g.height[i00] * (1 - fx) + g.height[i10] * fx) * (1 - fy) +
        (g.height[i01] * (1 - fx) + g.height[i11] * fx) * fy
      const ha = Math.max(g.height[i00], 0)
      const hb = Math.max(g.height[i10], 0)
      const hc = Math.max(g.height[i01], 0)
      const hd = Math.max(g.height[i11], 0)
      const hTri = fx + fy <= 1 ? ha + (hb - ha) * fx + (hc - ha) * fy : hd + (hc - hd) * (1 - fx) + (hb - hd) * (1 - fy)
      const h = hRaw < 0 ? hRaw : hTri
      const lava = Math.max(g.lava[i00], g.lava[i10], g.lava[i01], g.lava[i11])
      if (lava > 0.08) continue
      const sea = h < 0
      let b = g.biome[near]
      // fiumi e laghi; nelle paludi l'acqua 'latente' (0.41, vedi tileData.js) non conta
      if (!sea && g.water[near] > (b === BIOME.WETLAND ? 0.5 : 0.3)) continue
      let rule = FLORA[b]
      if (sea) {
        if (h > -15 || h < -1800) continue
        rule = h > -300 ? FLORA[BIOME.OCEAN_SHELF] : FLORA[BIOME.OCEAN]
      } else {
        cubeFaceDir(face, u, v, dir)
        const absLat = Math.abs(Math.asin(Math.max(-1, Math.min(1, dir.y))) * 57.29578)
        const snowLine = SNOW_LINE_BASE - absLat * SNOW_LINE_LAT
        if (h > snowLine + 150) rule = ABOVE_SNOW
        else if (h > snowLine - 450 && rule && rule.d > 0.1) rule = NEAR_SNOW
      }
      if (!rule) continue

      // macchia: boschi e radure
      const m =
        vnoise(face, ci / big, cj / big, seed + 101) * 0.65 + vnoise(face, ci / small, cj / small, seed + 202) * 0.35
      const cover = smooth(1 - rule.cover - 0.06, 1 - rule.cover + 0.06, m)
      // ai bordi del bosco la densità cala con continuità
      const p = rule.d * cover
      if (hash4(face, ci, cj, seed + 37) >= p) continue

      // specie
      let pick = hash4(face, ci, cj, seed + 53)
      let sp = rule.mix[0][0]
      for (const [id, w] of rule.mix) {
        if (pick < w) {
          sp = id
          break
        }
        pick -= w
      }
      // i giganti stanno al centro dei boschi, non ai margini
      if (sp === S.canopyTitan && cover < 0.85) sp = S.elderoak

      if (!sea) {
        // già calcolata sopra per la neve
      } else {
        cubeFaceDir(face, u, v, dir)
      }
      if (n >= maxN) {
        // non dovrebbe succedere: si raddoppia
        const s2 = new Uint8Array(maxN * 2)
        s2.set(species)
        species = s2
        const p2 = new Float64Array(maxN * 6)
        p2.set(pos)
        pos = p2
        const a2 = new Float32Array(maxN * 10)
        a2.set(attr)
        attr = a2
      }
      const spec = SPECIES[sp]
      const hv = hash4(face, ci, cj, seed + 71)
      species[n] = sp
      pos[n * 3] = dir.x * SCENE_RADIUS
      pos[n * 3 + 1] = dir.y * SCENE_RADIUS
      pos[n * 3 + 2] = dir.z * SCENE_RADIUS
      attr[n * 5] = sea ? 0 : Math.max(h, 0) * 0.001
      attr[n * 5 + 1] = spec.h * (1 - spec.var + 2 * spec.var * hv) * (sea ? 1 : 0.85 + 0.3 * cover)
      attr[n * 5 + 2] = hash4(face, ci, cj, seed + 89) * Math.PI * 2
      attr[n * 5 + 3] = hash4(face, ci, cj, seed + 97)
      attr[n * 5 + 4] = rank
      n++
    }
  }
  if (n === 0) return null
  return { count: n, species: species.slice(0, n), pos: pos.slice(0, n * 3), attr: attr.slice(0, n * 5) }
}
