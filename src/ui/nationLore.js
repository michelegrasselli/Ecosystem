// Enciclopedia delle terre (le "nazioni" della carta): dati misurati sul
// pianeta (superficie, biomi, clima, rilievi, acque, vulcani, terre vicine) e
// una STORIA NATURALE inventata, deterministica dal seed del pianeta e
// dall'id della terra, che tiene conto dei suoi biomi.
//
// Elyra non è ancora abitata: niente popolazione, capitali, sovrani, stemmi
// o città. La storia segue il canone degli episodi: la terra emerge, il
// fuoco dei vulcani (Episodio IV), la cenere e la luce dei mari che risveglia
// i semi (Episodio V, "The First Seed"), la terra verde di oggi.

import { Planet } from '../planet/planet.js'
import { BIOME, BIOME_NAME } from '../planet/biomes.js'
import { nationWarp } from '../planet/nations.js'
import { biomeFlora, SPECIES } from '../planet/flora.js'
import { dirToLatLon } from '../core/math.js'

const R_KM = 6371
const SPHERE_KM2 = 4 * Math.PI * R_KM * R_KM
/** Dove nacquero le prime piante (Episodio V): costa di Esmerault. */
const FIRST_SEED = { lat: -8.75, lon: 66.65 }
/** In quante settimane l'onda verde coprì il pianeta ("in a single season"). */
const SEASON_WEEKS = 13

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const pick = (r, a) => a[Math.floor(r() * a.length)]

// ------------------------------------------------------ biomi in gruppi
const GROUP = {
  [BIOME.RAINFOREST]: 'forest',
  [BIOME.TEMPERATE_FOREST]: 'forest',
  [BIOME.BOREAL_FOREST]: 'north',
  [BIOME.GRASSLAND]: 'plains',
  [BIOME.SAVANNA]: 'plains',
  [BIOME.SHRUBLAND]: 'plains',
  [BIOME.ALPINE_MEADOW]: 'mountain',
  [BIOME.ROCK]: 'mountain',
  [BIOME.SNOW]: 'ice',
  [BIOME.ICE]: 'ice',
  [BIOME.TUNDRA]: 'north',
  [BIOME.DESERT]: 'desert',
  [BIOME.SEMI_DESERT]: 'desert',
  [BIOME.BADLANDS]: 'desert',
  [BIOME.SALT_FLAT]: 'desert',
  [BIOME.WETLAND]: 'marsh',
  [BIOME.SWAMP]: 'marsh',
  [BIOME.VOLCANIC]: 'fire',
  [BIOME.LAVA_FIELD]: 'fire',
  [BIOME.LAVA]: 'fire',
  [BIOME.SCORCHED]: 'fire',
  [BIOME.CRYSTAL_VALLEY]: 'crystal',
  [BIOME.BEACH]: 'coast',
  [BIOME.LAKE]: 'plains',
  [BIOME.RIVER]: 'plains'
}

/** Come è nata la terra (primo paragrafo). */
const ORIGIN = {
  forest: [
    'It rose from the sea as a low, warm plain, and the rains of the First Breath soaked it for ages before anything could grow.',
    'Its soil is the oldest of the continent: layer upon layer of rock worn down by rain, deep and dark and waiting.'
  ],
  north: [
    'It was born under the ice. When the great glaciers withdrew toward the pole, they left behind a land scraped smooth and scattered with boulders.',
    'For most of its history it lay frozen; only when the ice retreated did its long, cold plains see the sky.'
  ],
  plains: [
    'Rivers built it. For ages they carried sand and silt down from the mountains and spread them into wide, level plains.',
    'It is a land of slow, patient water: old rivers wandered across it for ages, leaving terraces, lakes and fertile silt.'
  ],
  mountain: [
    'It was pushed up from below. Two plates of the crust met here and folded the rock into ranges that are still rising today.',
    'Its mountains are young and sharp; the rock still creaks and shifts, and every few centuries a new peak breaks through.'
  ],
  ice: [
    'It has been buried under ice for as long as Elyra has had a sky. The ice here is older than the light that falls on it.',
    'Snow has piled up on it for countless ages, pressing itself into ice so thick that the land beneath has never seen the sun.'
  ],
  desert: [
    'It lies in the dry belt of Elyra, where the winds that reach it have already lost their rain over other lands.',
    'An ancient sea once covered it; when the water dried up, it left salt, sand and stone polished by the wind.'
  ],
  marsh: [
    'It barely rose above the sea. Low and flat, it is half land and half water, and the tides still reach deep inland.',
    'It was made by mud: countless floods spread silt over a shallow sea until the water grew shallow enough to hold roots.'
  ],
  fire: [
    'It was built by fire. Its rock poured out of the volcanoes in flow after flow, and much of it is younger than the oceans.',
    'Beneath it the crust is thin; heat rises close to the surface, and the ground is warm even on the coldest nights.'
  ],
  crystal: [
    'Deep, mineral-rich water rose through the crust here and flooded its valleys; as it cooled, it left behind living crystal.',
    'Its rock is shot through with violet veins; long ago, water heavy with minerals rose from the depths and soaked the valleys.'
  ],
  coast: [
    'Its shores were shaped by waves for ages, and much of it is still coast: dunes, cliffs, inlets and sheltered bays.',
    'It is a land made by the sea, a long fringe of beaches and shallow bays where the waves have never stopped working.'
  ]
}

/** Il fuoco: l'Episodio IV (secondo paragrafo). */
const FIRE = {
  near: 'When every volcano of Elyra woke at once, the fire was here: {V} erupted together with all the others, and lava covered whole valleys.',
  one: 'When every volcano of Elyra woke at once, the fire was here: its only volcano erupted with all the others, and lava ran down to the lowlands.',
  far: 'When every volcano of Elyra woke at once, it had no fire of its own, yet the ash still came, carried by the wind, and buried it in grey for a long time.',
  ice: 'Even here the ash of the great eruption fell, staining the ice grey; in the deepest layers that grey band can still be seen.'
}

/** Oggi (ultimo paragrafo): com'è ora. */
const TODAY = {
  forest: 'Today it is one of the green hearts of Elyra: forests stand in layers, and at night their undergrowth glows.',
  north: 'Today dark conifers and pale tundra share it, and in the short summer its plains glow with ice flowers.',
  plains: 'Today it is open country, grass and scattered groves under a wide sky, crossed by slow rivers.',
  mountain: 'Today its slopes climb from flowering meadows to bare rock and snow, and crystals grow above the tree line.',
  ice: 'Today it is still a white, silent world, where only the hardiest plants live along the edges of the ice.',
  desert: 'Today it is sand, stone and salt, broken only by oases where the roots have found water.',
  marsh: 'Today it is a maze of lagoons and wooded islands, where mist hangs over the water and the bells of the swamps glow.',
  fire: 'Today its slopes are still warm, and the fire plants that thrive on ash grow thickest where the lava cooled last.',
  crystal: 'Today its valleys glow violet and blue, and the living crystals grow a little taller every year.',
  coast: 'Today its shores are fringed with palms and mangroves, and at night the shallows glow along the whole coast.'
}

const CLOSING = [
  'No foot has ever walked here. Not yet.',
  'It waits, green and silent, for whoever will be the first to see it.',
  'Nothing here has a name of its own yet, except the land itself.',
  'Every night the sea glows along its shores, and no one is there to wonder why.'
]

/** Distanza in km lungo la superficie tra due direzioni. */
function surfaceKm(a, b) {
  const d = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  return Math.acos(d) * R_KM
}
function latLonDir(lat, lon) {
  const la = (lat * Math.PI) / 180
  const lo = (lon * Math.PI) / 180
  const c = Math.cos(la)
  return [c * Math.cos(lo), Math.sin(la), -c * Math.sin(lo)]
}

/**
 * Scheda di una terra.
 * @returns {object} dati e testi pronti per la pagina
 */
export function nationInfo(n, nations, planet) {
  if (n._info) return n._info
  const s = Planet.createSample()
  const pts = n.labelPoints
  const cnt = pts.length / 3
  const hist = new Map()
  let tSum = 0
  let tMin = Infinity
  let tMax = -Infinity
  let hMax = -Infinity
  let hMaxAt = null
  let water = 0
  let risen = 0
  let cx = 0
  let cy = 0
  let cz = 0
  const nb = new Map()
  const w = { x: 0, y: 0, z: 0 }
  const hadNew = planet.newLands
  for (let k = 0; k < cnt; k++) {
    const x = pts[k * 3]
    const y = pts[k * 3 + 1]
    const z = pts[k * 3 + 2]
    cx += x
    cy += y
    cz += z
    planet.sample(x, y, z, 1, s)
    hist.set(s.biome, (hist.get(s.biome) || 0) + 1)
    tSum += s.temp
    if (s.temp < tMin) tMin = s.temp
    if (s.temp > tMax) tMax = s.temp
    if (s.biome === BIOME.RIVER || s.biome === BIOME.LAKE) water++
    if (s.height > hMax) {
      hMax = s.height
      hMaxAt = [x, y, z]
    }
    // terre nuove: il punto era mare prima che emergessero
    if (hadNew) {
      planet.newLands = false
      planet.sample(x, y, z, 1, s)
      planet.newLands = true
      if (s.height < 0) risen++
    }
    // vicini: punti vicini al confine guardano la seconda terra più vicina
    if (nations.borderDistance(x, y, z) < 0.04) {
      nationWarp(x, y, z, w)
      let b1 = -2
      let b2 = -2
      let i1 = -1
      let i2 = -1
      for (let i = 0; i < nations.seeds.length; i++) {
        const q = nations.seeds[i]
        const d = w.x * q[0] + w.y * q[1] + w.z * q[2]
        if (d > b1) {
          b2 = b1
          i2 = i1
          b1 = d
          i1 = i
        } else if (d > b2) {
          b2 = d
          i2 = i
        }
      }
      const other = i1 === n.id ? i2 : i1
      if (other >= 0 && other !== n.id) nb.set(other, (nb.get(other) || 0) + 1)
    }
  }
  const biomes = [...hist.entries()].map(([b, c]) => ({ biome: b, name: BIOME_NAME[b] || '?', share: c / cnt })).sort((a, b) => b.share - a.share)
  const area = n.sphereShare * SPHERE_KM2
  const neighbors = [...nb.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => nations.list[id])
  const peak = hMaxAt ? dirToLatLon(hMaxAt[0], hMaxAt[1], hMaxAt[2]) : null
  const cl = Math.hypot(cx, cy, cz) || 1
  const center = [cx / cl, cy / cl, cz / cl]
  const centerAt = dirToLatLon(center[0], center[1], center[2])
  const newLand = cnt > 0 && risen / cnt > 0.5

  // vulcani della terra (la stessa lista che disegna il pianeta)
  let volcanoes = 0
  let active = 0
  for (const v of planet.volcanoes || []) {
    if (v.sea) continue
    if (nations.idAt(v.x, v.y, v.z) !== n.id) continue
    volcanoes++
    if (v.lava) active++
  }

  // gruppo dominante (per la storia)
  const groups = new Map()
  for (const b of biomes) {
    const g = GROUP[b.biome] || 'plains'
    groups.set(g, (groups.get(g) || 0) + b.share)
  }
  const gs = [...groups.entries()].sort((a, b) => b[1] - a[1])
  const main = gs[0]?.[0] || 'plains'
  const second = gs[1] && gs[1][1] > 0.12 ? gs[1][0] : null

  // l'onda verde dell'Episodio V: quando arrivò qui
  const seedKm = surfaceKm(center, latLonDir(FIRST_SEED.lat, FIRST_SEED.lon))
  const weeks = Math.max(1, Math.round((seedKm / (Math.PI * R_KM)) * SEASON_WEEKS))

  const r = rng((planet.seed * 977 + n.id * 7919) ^ 0x5bd1e995)
  // la pioniera: la specie più piccola fra le più comuni del bioma principale
  const common = biomeFlora(biomes[0]?.biome ?? BIOME.GRASSLAND).slice(0, 4)
  common.sort((a, b) => SPECIES[a.id].h - SPECIES[b.id].h)
  const pioneer = common.length ? SPECIES[common[0].id].name : 'Bramblebush'
  const aPioneer = (/^[AEIOU]/.test(pioneer) ? 'an ' : 'a ') + pioneer
  let origin, fire, seed
  if (newLand) {
    // le terre nuove non compaiono negli episodi I-V: sono emerse dopo
    origin = 'It is one of the youngest lands of Elyra. For ages there was only open sea here; it rose from the waves only after the great fire, when the rest of the planet was already turning green.'
    fire = 'It never knew the fire: when every volcano of Elyra woke at once, the sea still covered it, and its rock was born clean of ash.'
    seed = `Its plants came from elsewhere. Seeds carried by the wind and the currents reached its new shores, and the first to take root was ${aPioneer}.`
  } else {
    origin = pick(r, ORIGIN[main])
    fire = main === 'ice' ? FIRE.ice : volcanoes > 1 ? FIRE.near.replace('{V}', `its ${volcanoes} volcanoes`) : volcanoes === 1 ? FIRE.one : FIRE.far
    seed =
      seedKm < 600
        ? 'This is where it began. Here, beneath the ash, the light of the seas first reached the land, and the first seeds of Elyra split open.'
        : `Then came the light. The green wave of the First Seed reached its shores ${weeks === 1 ? 'in the first week' : `about ${weeks} weeks`} after it began, ${Math.round(seedKm).toLocaleString('en-US')} km away; the first to rise from the ash here was ${aPioneer}.`
  }
  const today = TODAY[main] + (second && second !== main ? ' ' + TODAY[second].replace(/^Today /, 'Elsewhere ') : '')
  const history = [origin, fire, seed, today, pick(r, CLOSING)]

  // flora tipica: specie più comuni nei suoi biomi
  const fl = new Map()
  for (const b of biomes.slice(0, 6)) for (const e of biomeFlora(b.biome)) fl.set(e.id, (fl.get(e.id) || 0) + e.w * b.share)
  const flora = [...fl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => SPECIES[id].name)

  n._info = {
    area,
    landShare: n.share,
    centerAt,
    peak: Math.max(0, hMax),
    peakAt: peak,
    temp: tSum / Math.max(cnt, 1),
    tempMin: tMin,
    tempMax: tMax,
    waterShare: water / Math.max(cnt, 1),
    volcanoes,
    active,
    newLand,
    seedKm,
    weeks,
    biomes,
    mainBiome: biomes[0]?.biome,
    neighbors,
    history,
    flora
  }
  return n._info
}
