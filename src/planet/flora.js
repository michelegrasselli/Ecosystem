// Flora di Elyra: catalogo delle specie e posizionamento delle piante.
//
// Modulo puro (senza three.js): gira nei Web Worker insieme al calcolo delle
// tile (tileData.js). Le geometrie delle specie sono in render/plantModels.js.
//
// Scala
// -----
// La flora di Elyra è gigantesca: alberi comuni di ~1 km, giganti di 2-3 km,
// fiori e cespugli di 200-500 m. Così le piante si vedono già da 250-300 km di
// quota (qualche pixel ciascuna) e diventano via via più definite scendendo.
//
// Posizionamento
// --------------
// Le piante nascono da una GRIGLIA GLOBALE di candidati su ogni faccia del
// cubo-sfera (passo ~360 m), con uno spostamento casuale dentro la cella. Ogni
// candidato ha valori pseudo-casuali fissi (hash delle sue coordinate intere):
// una tile e le sue figlie vedono quindi le stesse piante, e una pianta non
// cambia posto quando il LOD si raffina.
//
// Distribuzione a macchie (non uniforme): un campo di "macchia" somma rumori
// a ~40 km, ~9 km, ~2.5 km e ~0.8 km. Dove supera la soglia del bioma c'è il
// bosco: al margine rado, nel cuore fittissimo (chiome che si toccano, alberi
// più alti). Fuori dal bosco restano radure quasi spoglie con qualche pianta
// isolata e un sottobosco diverso (fiori, cespugli, funghi): spazio libero
// per altro. La stessa funzione (vegCover) dà allo shader del terreno la
// copertura per vertice: da lontano i boschi si vedono dove sono le piante.
//
// LOD: le tile grosse (lontane) tengono solo una parte delle piante, in base
// al rango: prima spariscono le piccole, i grandi alberi restano a lungo.

import { BIOME, SNOW_LINE_BASE, SNOW_LINE_LAT } from './biomes.js'
import { SCENE_RADIUS } from './constants.js'

// ------------------------------------------------------------- specie
// h: altezza tipica (km); var: variazione relativa dell'altezza
export const SPECIES = [
  { id: 0, key: 'elderoak', name: 'Elderoak', h: 1.0, var: 0.35 }, // latifoglia a chioma tonda
  { id: 1, key: 'spirepine', name: 'Spirepine', h: 1.25, var: 0.35 }, // conifera a guglia
  { id: 2, key: 'canopyTitan', name: 'Canopy Titan', h: 2.8, var: 0.25 }, // gigante a ombrello, tronco intrecciato
  { id: 3, key: 'fernpalm', name: 'Fernpalm', h: 0.8, var: 0.35 }, // palma-felce con fronde ricadenti
  { id: 4, key: 'glowcap', name: 'Glowcap', h: 0.7, var: 0.45 }, // fungo-albero luminoso (arancio/viola)
  { id: 5, key: 'lanternpod', name: 'Lanternpod', h: 0.4, var: 0.35 }, // steli con baccelli turchesi maculati
  { id: 6, key: 'bramble', name: 'Bramblebush', h: 0.26, var: 0.45 }, // cespuglio con bacche
  { id: 7, key: 'sunshade', name: 'Sunshade', h: 0.8, var: 0.35 }, // albero a ombrello piatto (savana)
  { id: 8, key: 'mistweeper', name: 'Mistweeper', h: 0.85, var: 0.3 }, // salice con fili luminosi
  { id: 9, key: 'prismbloom', name: 'Prismbloom', h: 0.6, var: 0.45 }, // fiore di cristallo viola-azzurro
  { id: 10, key: 'thornpillar', name: 'Thornpillar', h: 0.85, var: 0.4 }, // cactus a colonna con braccia
  { id: 11, key: 'sunspike', name: 'Sunspike', h: 0.4, var: 0.4 }, // ciuffo di spine dorate
  { id: 12, key: 'ashwraith', name: 'Ashwraith', h: 1.0, var: 0.4 }, // albero carbonizzato, braci nel tronco
  { id: 13, key: 'cindercoral', name: 'Cinder Coral', h: 0.55, var: 0.4 }, // corallo cremisi con punte di brace
  { id: 14, key: 'snowpuff', name: 'Snowpuff', h: 0.38, var: 0.45 }, // batuffoli bianchi
  { id: 15, key: 'rimeglass', name: 'Rimeglass', h: 1.2, var: 0.35 }, // albero di cristallo di ghiaccio
  { id: 16, key: 'tidecrown', name: 'Tidecrown', h: 1.7, var: 0.3 }, // dal fondo del mare: campana e tentacoli luminosi
  { id: 17, key: 'kelpspire', name: 'Kelp Spire', h: 0.7, var: 0.35 }, // guglie d'alga con foglie a ventaglio
  { id: 18, key: 'duskbloom', name: 'Duskbloom', h: 0.3, var: 0.45 }, // fiore-calice magenta luminoso
  { id: 19, key: 'veilwood', name: 'Veilwood', h: 1.3, var: 0.3 }, // albero alto e sottile, chioma violacea
  { id: 20, key: 'moonshroom', name: 'Moonshroom', h: 0.22, var: 0.4 }, // colonia di funghetti turchesi luminosi
  { id: 21, key: 'blushwood', name: 'Blushwood', h: 1.1, var: 0.35 }, // albero in fiore rosa, tronco attorcigliato
  { id: 22, key: 'emberbriar', name: 'Emberbriar', h: 0.65, var: 0.35 }, // rami contorti con fiamme e sfere azzurre
  { id: 23, key: 'featherfern', name: 'Featherfern', h: 0.4, var: 0.4 }, // fronde a piuma blu luminose
  { id: 24, key: 'jellybell', name: 'Jellybell', h: 0.75, var: 0.35 }, // campane rosa pendenti, come meduse
  { id: 25, key: 'mossfather', name: 'Mossfather', h: 2.3, var: 0.3 }, // gigante antico, muschio e radici
  { id: 26, key: 'petalcrown', name: 'Petalcrown', h: 1.4, var: 0.3 }, // albero con chioma a fiore
  { id: 27, key: 'candlewick', name: 'Candlewick', h: 0.45, var: 0.4 }, // steli con lanterne arancio
  { id: 28, key: 'starlily', name: 'Starlily', h: 0.28, var: 0.4 }, // giglio a stella
  { id: 29, key: 'broadleaf', name: 'Broadleaf', h: 0.55, var: 0.4 }, // foglie enormi (tipo banano)
  { id: 30, key: 'reedmace', name: 'Reedmace', h: 0.2, var: 0.4 }, // canneto con tife
  { id: 31, key: 'bogcypress', name: 'Bog Cypress', h: 1.2, var: 0.3 }, // cipresso di palude con muschio pendente
  { id: 32, key: 'frostlantern', name: 'Frostlantern', h: 0.3, var: 0.4 }, // sfere di ghiaccio luminose su steli
  { id: 33, key: 'dunepalm', name: 'Dunepalm', h: 0.95, var: 0.3 }, // palma dorata delle oasi
  { id: 34, key: 'obsidianbloom', name: 'Obsidian Bloom', h: 0.5, var: 0.4 } // schegge di vetro nero, cuore di magma
]
export const SPECIES_COUNT = SPECIES.length

// ------------------------------------------------- piante per bioma
// d: densità nel cuore del bosco (probabilità per candidato)
// cover: frazione del bioma coperta da boschi/macchie (il resto è radura)
// sparse: densità nelle radure (piante isolate)
// tree: quanto la macchia del bioma è "bosco" per lo shader del terreno
// mix: specie del bosco; open: specie delle radure
const S = Object.fromEntries(SPECIES.map((s) => [s.key, s.id]))
const FLORA = {}
const W = (mix) => {
  const e = Object.entries(mix)
  const tot = e.reduce((a, [, w]) => a + w, 0)
  return e.map(([k, w]) => {
    if (S[k] === undefined) throw new Error('flora: unknown species ' + k)
    return [S[k], w / tot]
  })
}
const rule = (d, cover, sparse, tree, mix, open) => ({ d, cover, sparse, tree, mix: W(mix), open: W(open || mix) })
const set = (b, ...a) => (FLORA[b] = rule(...a))

set(BIOME.RAINFOREST, 0.92, 0.62, 0.06, 1,
  { elderoak: 0.1, fernpalm: 0.13, canopyTitan: 0.008, mossfather: 0.006, petalcrown: 0.1, glowcap: 0.08, broadleaf: 0.14, featherfern: 0.1, jellybell: 0.06, veilwood: 0.03, lanternpod: 0.05, candlewick: 0.05, moonshroom: 0.05 },
  { broadleaf: 0.3, featherfern: 0.2, duskbloom: 0.15, candlewick: 0.15, starlily: 0.1, moonshroom: 0.1 })
set(BIOME.TEMPERATE_FOREST, 0.88, 0.54, 0.04, 1,
  { elderoak: 0.36, spirepine: 0.14, blushwood: 0.08, mossfather: 0.007, canopyTitan: 0.003, veilwood: 0.03, bramble: 0.1, moonshroom: 0.08, glowcap: 0.04, lanternpod: 0.04, featherfern: 0.045, starlily: 0.03 },
  { bramble: 0.3, starlily: 0.25, duskbloom: 0.15, lanternpod: 0.15, blushwood: 0.15 })
set(BIOME.BOREAL_FOREST, 0.88, 0.58, 0.04, 1,
  { spirepine: 0.72, elderoak: 0.05, veilwood: 0.02, moonshroom: 0.08, bramble: 0.06, snowpuff: 0.05 },
  { bramble: 0.4, snowpuff: 0.3, spirepine: 0.3 })
set(BIOME.GRASSLAND, 0.7, 0.3, 0.05, 0.75,
  { elderoak: 0.3, blushwood: 0.2, petalcrown: 0.05, veilwood: 0.04, bramble: 0.13, lanternpod: 0.1, canopyTitan: 0.004, sunshade: 0.1 },
  { starlily: 0.3, duskbloom: 0.25, bramble: 0.2, lanternpod: 0.15, candlewick: 0.1 })
set(BIOME.SAVANNA, 0.45, 0.34, 0.05, 0.5,
  { sunshade: 0.6, bramble: 0.18, dunepalm: 0.08, thornpillar: 0.05, canopyTitan: 0.005, elderoak: 0.07 },
  { bramble: 0.35, sunspike: 0.25, sunshade: 0.25, lanternpod: 0.15 })
set(BIOME.SHRUBLAND, 0.6, 0.45, 0.06, 0.4,
  { bramble: 0.5, sunshade: 0.1, thornpillar: 0.1, lanternpod: 0.1, duskbloom: 0.1, candlewick: 0.1 },
  { bramble: 0.5, sunspike: 0.25, duskbloom: 0.25 })
set(BIOME.WETLAND, 0.8, 0.55, 0.14, 0.45,
  { reedmace: 0.35, mistweeper: 0.2, jellybell: 0.1, glowcap: 0.08, featherfern: 0.1, moonshroom: 0.1, bogcypress: 0.07 },
  { reedmace: 0.6, featherfern: 0.15, moonshroom: 0.15, duskbloom: 0.1 })
set(BIOME.SWAMP, 0.9, 0.7, 0.12, 0.9,
  { bogcypress: 0.32, mistweeper: 0.18, jellybell: 0.1, glowcap: 0.1, reedmace: 0.12, featherfern: 0.08, moonshroom: 0.06, broadleaf: 0.04 },
  { reedmace: 0.5, jellybell: 0.15, featherfern: 0.2, moonshroom: 0.15 })
set(BIOME.DESERT, 0.4, 0.28, 0.025, 0.15,
  { thornpillar: 0.4, sunspike: 0.3, dunepalm: 0.3 },
  { sunspike: 0.55, thornpillar: 0.45 })
set(BIOME.SEMI_DESERT, 0.36, 0.32, 0.03, 0.2,
  { thornpillar: 0.3, sunspike: 0.25, bramble: 0.3, dunepalm: 0.15 },
  { sunspike: 0.5, bramble: 0.5 })
set(BIOME.BADLANDS, 0.38, 0.4, 0.03, 0.15,
  { thornpillar: 0.4, sunspike: 0.3, ashwraith: 0.2, obsidianbloom: 0.1 },
  { sunspike: 0.6, thornpillar: 0.4 })
set(BIOME.SALT_FLAT, 0.22, 0.35, 0.012, 0.05, { prismbloom: 0.6, sunspike: 0.4 })
set(BIOME.BEACH, 0.42, 0.4, 0.02, 0.3, { fernpalm: 0.5, dunepalm: 0.35, bramble: 0.15 }, { bramble: 0.5, fernpalm: 0.5 })
set(BIOME.ALPINE_MEADOW, 0.55, 0.4, 0.06, 0.4,
  { spirepine: 0.45, prismbloom: 0.12, frostlantern: 0.1, bramble: 0.13, starlily: 0.2 },
  { starlily: 0.4, prismbloom: 0.2, bramble: 0.2, frostlantern: 0.2 })
set(BIOME.TUNDRA, 0.5, 0.45, 0.06, 0.25,
  { snowpuff: 0.4, rimeglass: 0.2, frostlantern: 0.2, bramble: 0.2 },
  { snowpuff: 0.5, frostlantern: 0.3, bramble: 0.2 })
set(BIOME.ICE, 0.26, 0.3, 0.02, 0.1, { rimeglass: 0.5, snowpuff: 0.25, frostlantern: 0.25 }, { frostlantern: 0.5, snowpuff: 0.5 })
set(BIOME.SNOW, 0.26, 0.3, 0.02, 0.1, { rimeglass: 0.5, snowpuff: 0.25, frostlantern: 0.25 }, { frostlantern: 0.5, snowpuff: 0.5 })
set(BIOME.ROCK, 0.32, 0.4, 0.02, 0.1, { prismbloom: 0.5, obsidianbloom: 0.2, ashwraith: 0.3 }, { prismbloom: 0.6, obsidianbloom: 0.4 })
set(BIOME.VOLCANIC, 0.4, 0.4, 0.025, 0.25,
  { ashwraith: 0.4, emberbriar: 0.25, cindercoral: 0.2, obsidianbloom: 0.15 },
  { cindercoral: 0.4, obsidianbloom: 0.35, emberbriar: 0.25 })
set(BIOME.LAVA_FIELD, 0.28, 0.38, 0.02, 0.2,
  { cindercoral: 0.4, obsidianbloom: 0.3, emberbriar: 0.3 },
  { obsidianbloom: 0.5, cindercoral: 0.5 })
set(BIOME.SCORCHED, 0.5, 0.5, 0.04, 0.4,
  { ashwraith: 0.55, emberbriar: 0.25, cindercoral: 0.2 },
  { cindercoral: 0.5, emberbriar: 0.5 })
set(BIOME.OCEAN_SHELF, 0.16, 0.25, 0.004, 0, { kelpspire: 0.86, tidecrown: 0.14 }, { kelpspire: 1 })
set(BIOME.OCEAN, 0.05, 0.2, 0, 0, { tidecrown: 1 })
// sopra la linea delle nevi (la neve la disegna lo shader per quota)
const ABOVE_SNOW = FLORA[BIOME.SNOW]
const NEAR_SNOW = rule(0.42, 0.4, 0.03, 0.3,
  { prismbloom: 0.25, snowpuff: 0.25, spirepine: 0.3, frostlantern: 0.2 },
  { frostlantern: 0.4, snowpuff: 0.35, prismbloom: 0.25 })

// ------------------------------------------------------- griglia e LOD
export const VEG_MIN_LEVEL = 7 // tile di ~78 km: le piante 3D si vedono da ~300 km di quota
const FACE_KM = Math.PI * 0.5 * SCENE_RADIUS // lato di una faccia del cubo (km, all'equatore)
export const SPACING_KM = 0.36
const CELL_UV = (SPACING_KM / FACE_KM) * 2
// quota di piante tenute per livello (le tile grosse sono lontane); il rango
// effettivo dipende dalla taglia, vedi rankFor
const KEEP = { 7: 0.1, 8: 0.22, 9: 0.45, 10: 0.72, 11: 0.92 }
const keepFor = (level) => (level >= 12 ? 1 : KEEP[level] ?? 0)

/** Quota di piante tenute a un livello (le tile grosse sono lontane). */
export function vegKeep(level) {
  return keepFor(level)
}

// Rango effettivo: rank^p con p che cresce con la taglia. Le piante grandi
// hanno un rango basso (restano anche nelle tile lontane), le piccole alto.
const P_MAX = 2.2
const rankFor = (rank, hKm) => Math.pow(rank, Math.min(P_MAX, Math.max(0.5, hKm / 0.55)))

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

// scale della macchia, in celle della griglia globale
const SC0 = 40 / SPACING_KM
const SC1 = 9 / SPACING_KM
const SC2 = 2.5 / SPACING_KM
const SC3 = 0.8 / SPACING_KM

/** Campo di macchia (0..1, media ~0.5) in coordinate di cella continue. */
function macchia(face, x, y, seed) {
  return (
    vnoise(face, x / SC0, y / SC0, seed + 101) * 0.36 +
    vnoise(face, x / SC1, y / SC1, seed + 202) * 0.3 +
    vnoise(face, x / SC2, y / SC2, seed + 303) * 0.22 +
    vnoise(face, x / SC3, y / SC3, seed + 404) * 0.12
  )
}

// Soglia per una frazione di copertura: la somma di rumori ha deviazione
// standard ~0.1 attorno a 0.5 (relazione lineare: basta per tarare i biomi)
const threshold = (cover) => 0.5 + (0.5 - cover) * 0.3

/** Bordo (0 radura, 1 bosco) e cuore (0 margine, 1 centro fitto) della macchia. */
function woodland(m, cover) {
  const t = threshold(cover)
  return [smooth(t - 0.015, t + 0.015, m), smooth(t, t + 0.11, m)]
}

/**
 * Copertura arborea attesa in un punto (0..1), per lo shader del terreno:
 * dove ci sono boschi di piante 3D il suolo si scurisce e da lontano si
 * vedono le macchie. u, v in [-1, 1] sulla faccia.
 */
export function vegCover(face, u, v, biome, seed, hM, absLat) {
  let r = FLORA[biome]
  if (hM !== undefined && hM > 0) {
    const snowLine = SNOW_LINE_BASE - absLat * SNOW_LINE_LAT
    if (hM > snowLine + 150) r = ABOVE_SNOW
    else if (hM > snowLine - 450 && r && r.d > 0.3) r = NEAR_SNOW
  }
  if (!r || r.tree <= 0) return 0
  const m = macchia(face, (u + 1) / CELL_UV, (v + 1) / CELL_UV, seed)
  const [edge, core] = woodland(m, r.cover)
  return r.tree * edge * (0.45 + 0.55 * core)
}

/**
 * Piante di una tile.
 * @param {object} t dati della tile: face, level, ix, iy, res, cubeFaceDir,
 *   grid: { biome Uint8Array, height Float32Array (m, negativa sul mare),
 *           water, lava } su (res+1)^2 vertici
 * @returns {{ count, species: Uint8Array, pos: Float64Array, attr: Float32Array }|null}
 *   pos: punto sulla sfera a livello del mare (km); attr: quota del suolo (km,
 *   >= 0), altezza della pianta (km), rotazione (rad), variazione (0..1), rango
 *   effettivo (0..1: le piante con rango basso esistono già nelle tile più grosse)
 */
export function placeVegetation(t) {
  const { face, level, ix, iy, res, grid, cubeFaceDir, seed = 1 } = t
  const keep = keepFor(level)
  if (keep <= 0) return null
  // nessuna pianta con rango grezzo oltre questa soglia passa (p <= P_MAX)
  const rankCut = Math.pow(keep, 1 / P_MAX)
  const div = 1 << level
  const u0 = (ix / div) * 2 - 1
  const v0 = (iy / div) * 2 - 1
  const span = 2 / div
  const ci0 = Math.floor((u0 + 1) / CELL_UV)
  const cj0 = Math.floor((v0 + 1) / CELL_UV)
  const ci1 = Math.floor((u0 + span + 1) / CELL_UV)
  const cj1 = Math.floor((v0 + span + 1) / CELL_UV)
  const row = res + 1

  let cap = Math.max(64, Math.ceil((ci1 - ci0 + 1) * (cj1 - cj0 + 1) * Math.min(1, rankCut) * 0.25) + 64)
  let species = new Uint8Array(cap)
  let pos = new Float64Array(cap * 3)
  let attr = new Float32Array(cap * 5)
  let n = 0
  const dir = { x: 0, y: 0, z: 0 }

  for (let cj = cj0; cj <= cj1; cj++) {
    for (let ci = ci0; ci <= ci1; ci++) {
      const rank = hash4(face, ci, cj, seed)
      if (rank >= rankCut) continue
      const jx = hash4(face, ci, cj, seed + 11)
      const jy = hash4(face, ci, cj, seed + 23)
      const cx = ci + 0.1 + 0.8 * jx
      const cy = cj + 0.1 + 0.8 * jy
      const u = cx * CELL_UV - 1
      const v = cy * CELL_UV - 1
      // dentro la tile (le celle di bordo appartengono a una sola tile)
      if (u < u0 || u >= u0 + span || v < v0 || v >= v0 + span) continue

      // campioni della tile: vertice più vicino per bioma, triangolo per quota
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
      const near = fx < 0.5 ? (fy < 0.5 ? i00 : i01) : fy < 0.5 ? i10 : i11
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
      const b = g.biome[near]
      // fiumi e laghi; nelle paludi l'acqua 'latente' (vedi tileData.js) non conta
      const marsh = b === BIOME.WETLAND || b === BIOME.SWAMP
      if (!sea && g.water[near] > (marsh ? 0.5 : 0.3)) continue
      let r = FLORA[b]
      cubeFaceDir(face, u, v, dir)
      if (sea) {
        if (h > -15 || h < -1800) continue
        r = h > -300 ? FLORA[BIOME.OCEAN_SHELF] : FLORA[BIOME.OCEAN]
      } else {
        const absLat = Math.abs(Math.asin(Math.max(-1, Math.min(1, dir.y))) * 57.29578)
        const snowLine = SNOW_LINE_BASE - absLat * SNOW_LINE_LAT
        if (h > snowLine + 150) r = ABOVE_SNOW
        else if (h > snowLine - 450 && r && r.d > 0.3) r = NEAR_SNOW
      }
      if (!r) continue

      // macchia: bosco fitto nel cuore, rado al margine, radure quasi spoglie
      const m = macchia(face, cx, cy, seed)
      const [edge, core] = woodland(m, r.cover)
      const p = r.sparse * (1 - edge) + edge * r.d * (0.4 + 0.6 * core)
      if (hash4(face, ci, cj, seed + 37) >= p) continue

      // specie: nel bosco il mix del bosco, nelle radure quello delle radure
      const inWood = hash4(face, ci, cj, seed + 41) < edge
      const mix = inWood ? r.mix : r.open
      let pick = hash4(face, ci, cj, seed + 53)
      let sp = mix[0][0]
      for (let k = 0; k < mix.length; k++) {
        if (pick < mix[k][1]) {
          sp = mix[k][0]
          break
        }
        pick -= mix[k][1]
      }
      // i giganti stanno al centro dei boschi, non ai margini
      if ((sp === S.canopyTitan || sp === S.mossfather) && core < 0.8) sp = r === FLORA[BIOME.RAINFOREST] ? S.fernpalm : S.elderoak

      const spec = SPECIES[sp]
      const hv = hash4(face, ci, cj, seed + 71)
      // taglia: varia per specie, cresce verso il cuore del bosco; qualche
      // raro esemplare secolare molto più grande
      let size = spec.h * (1 - spec.var + 2 * spec.var * hv)
      if (!sea) size *= 0.8 + 0.35 * core
      if (hash4(face, ci, cj, seed + 83) < 0.035) size *= 1.55
      const rEff = rankFor(rank, size)
      if (rEff >= keep) continue

      if (n >= cap) {
        cap *= 2
        const s2 = new Uint8Array(cap)
        s2.set(species)
        species = s2
        const p2 = new Float64Array(cap * 3)
        p2.set(pos)
        pos = p2
        const a2 = new Float32Array(cap * 5)
        a2.set(attr)
        attr = a2
      }
      species[n] = sp
      pos[n * 3] = dir.x * SCENE_RADIUS
      pos[n * 3 + 1] = dir.y * SCENE_RADIUS
      pos[n * 3 + 2] = dir.z * SCENE_RADIUS
      attr[n * 5] = sea ? 0 : Math.max(h, 0) * 0.001
      attr[n * 5 + 1] = size
      attr[n * 5 + 2] = hash4(face, ci, cj, seed + 89) * Math.PI * 2
      attr[n * 5 + 3] = hash4(face, ci, cj, seed + 97)
      attr[n * 5 + 4] = rEff
      n++
    }
  }
  if (n === 0) return null
  return { count: n, species: species.slice(0, n), pos: pos.slice(0, n * 3), attr: attr.slice(0, n * 5) }
}
