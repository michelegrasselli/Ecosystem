// Enciclopedia delle nazioni: dati misurati sul pianeta (superficie, biomi,
// clima, rilievi, vicini) e una storia inventata, deterministica dal seed
// del pianeta e dall'id della nazione, che tiene conto dei suoi biomi.

import { Planet } from '../planet/planet.js'
import { BIOME, BIOME_NAME } from '../planet/biomes.js'
import { nationWarp } from '../planet/nations.js'
import { biomeFlora, SPECIES } from '../planet/flora.js'
import { dirToLatLon } from '../core/math.js'

const R_KM = 6371
const SPHERE_KM2 = 4 * Math.PI * R_KM * R_KM

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

// ------------------------------------------------------------- nomi
const SYL_A = ['Al', 'Bel', 'Cor', 'Dun', 'El', 'Fen', 'Gal', 'Har', 'Is', 'Kel', 'Lor', 'Mor', 'Ner', 'Os', 'Pel', 'Quen', 'Ros', 'Sel', 'Tor', 'Ul', 'Var', 'Wen', 'Yr', 'Ast', 'Bran', 'Cael', 'Dra', 'Ev']
const SYL_B = ['a', 'e', 'i', 'o', 'ae', 'ia', 'u', 'ei']
const SYL_C = ['dor', 'mar', 'wyn', 'hold', 'ric', 'mund', 'wen', 'gard', 'lis', 'ran', 'thas', 'vane', 'brecht', 'mont', 'cairn', 'stead']
const FIRST = ['Aldric', 'Berengar', 'Cerys', 'Daveth', 'Elowen', 'Fenwick', 'Gwendolyn', 'Hadric', 'Isolde', 'Jorund', 'Kestra', 'Leofric', 'Maelis', 'Neris', 'Osric', 'Perrin', 'Rowena', 'Sigrun', 'Tamsin', 'Ulric', 'Vivienne', 'Wystan', 'Ysolde', 'Aurelia', 'Brannoc', 'Corentin', 'Edith', 'Godric']
const EPITHET = ['the Wise', 'the Bold', 'the Wanderer', 'the Builder', 'the Quiet', 'the Red', 'Oakheart', 'the Lame', 'the Fair', 'Ironhand', 'the Elder', 'the Peacemaker', 'Stormborn', 'the Patient', 'the Unbowed']

function placeName(r) {
  return pick(r, SYL_A) + (r() < 0.5 ? pick(r, SYL_B) : '') + pick(r, SYL_C)
}

const RULER = {
  'Empire of': ['Emperor', 'Empress'],
  'Kingdom of': ['King', 'Queen'],
  'Grand Duchy of': ['Grand Duke', 'Grand Duchess'],
  'Duchy of': ['Duke', 'Duchess'],
  'Principality of': ['Prince', 'Princess'],
  'March of': ['Margrave', 'Margravine'],
  'County of': ['Count', 'Countess'],
  'Barony of': ['Baron', 'Baroness']
}

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

const FOUNDING = {
  forest: (f) => `${f} led the clans out of the deep woods and swore the first oath of the realm beneath an ancient Mossfather`,
  north: (f) => `${f} brought the scattered hunters of the pine forests together around a single winter fire that, legend says, burned for a hundred years`,
  plains: (f) => `${f} united the herders of the open plains after the Long Drought, sharing out the last wells fairly`,
  mountain: (f) => `${f} carved the first stronghold into the mountain rock and declared the passes free to all who paid the toll`,
  ice: (f) => `${f} survived a winter that killed every other settlement, and the survivors crowned the one who had kept them alive`,
  desert: (f) => `${f} found a hidden oasis beneath a lone Dunepalm and built a city of sandstone around it`,
  marsh: (f) => `${f} raised the first stilt-town above the swamp waters, where no army could follow`,
  fire: (f) => `${f} returned to the ash slopes after the Ninety-Year Heartbeat, when everyone else had fled, and claimed the newborn land`,
  crystal: (f) => `${f} led a band of prospectors into the violet valleys during the crystal rush and refused to leave when it ended`,
  coast: (f) => `${f} landed on these shores with a fleet of reed boats and founded a harbour town that grew into a nation`
}

const MIDDLE = {
  forest: ['The Woodwardens, an order of knights sworn to protect the old trees, became the true power behind the throne.', 'A blight of grey moss killed a third of the forests in the Fading Years; the realm still plants a tree for every child born.'],
  north: ['The Long Winter of the year {Y2} froze the rivers for seven years; the realm survived on Snowpuff bread and stubbornness.', 'Fur traders from the north grew so rich that for a century the treasury was kept in pelts, not coins.'],
  plains: ['The great horse-fairs of the plains made it the crossroads of the continent.', 'A war over grazing rights with {N} lasted a generation and ended in a marriage.'],
  mountain: ['Silver found under the peaks paid for the great walls, and for the endless quarrels over who owned them.', 'Avalanches buried the old capital in the year {Y2}; the new one was built lower, in sight of the ruins.'],
  ice: ['Its people learned to read the songs of the Rimeglass trees, which warn of storms days before they arrive.', 'The ice-roads, frozen highways across the glaciers, are maintained by a guild older than the crown.'],
  desert: ['Caravans of salt and spice crossed its dunes, measured in Thornpillars rather than miles.', 'The Thousand Wells were dug under {R} {F2}, turning the dunes around the capital into gardens.'],
  marsh: ['The Drowned Roads, causeways of Bog Cypress wood, still connect its villages through the swamp.', 'A fever from the lagoons emptied whole provinces in the year {Y2}; the healers who stopped it became the realm\'s nobility.'],
  fire: ['Its smiths learned to work with lava heat itself, forging blades prized across Elyra.', 'Fire-priests carrying Emberbriar torches ruled the realm for two centuries, until the eruption of {Y2} ended their prophecies.'],
  crystal: ['The Crystal Concord set strict limits on mining the living crystals; breaking a Crystal Spire is still punished with exile.', 'Lenses ground from Geode Blooms made its astronomers the most famous of the world.'],
  coast: ['Its fleets of Kelpspire boats ruled the shallow seas for generations.', 'The harbour of the capital is guarded by a Conch Spire whose horn, they say, has sounded before every invasion.']
}
const GENERIC = [
  'A border war with {N} in the year {Y2} ended with the Treaty of the Two Rivers, which both sides still celebrate.',
  'Under {R} {F2} the realm knew a golden age of roads, libraries and festivals of light.',
  'A civil war between two branches of the House of {D} split the realm for a generation, until a marriage healed it.',
  'Plague, famine and a disastrous alliance with {N} brought the realm close to ruin in the year {Y2}.'
]
const KNOWN_FOR = {
  forest: 'its woodcarvers and its glowing forest festivals',
  north: 'its furs, its sagas and its endurance',
  plains: 'its horses, its harvest fairs and its open-handed hospitality',
  mountain: 'its stonemasons, its silver and its proud mountain guards',
  ice: 'its ice-roads and the songs of its Rimeglass forests',
  desert: 'its caravans, its spices and its starlit oasis cities',
  marsh: 'its stilt-towns, its healers and its Tide Lotus banners',
  fire: 'its lava-forged steel and its fearless smiths',
  crystal: 'its crystal lenses, its luminous valleys and its astronomers',
  coast: 'its sailors, its pearls and its harbours'
}
const COLORS = ['azure', 'gules', 'vert', 'sable', 'purpure', 'or', 'argent', 'sanguine']
const COLOR_CSS = { azure: '#3a6fb5', gules: '#b5322f', vert: '#2f7a46', sable: '#22201e', purpure: '#7a3f8f', or: '#d9b040', argent: '#d8dde2', sanguine: '#7a2a2a' }
const CHARGES = { forest: 'an oak tree', north: 'a pine and a star', plains: 'a running horse', mountain: 'three peaks', ice: 'a snowflake', desert: 'a palm and a sun', marsh: 'a lotus flower', fire: 'a flaming mountain', crystal: 'a crystal spire', coast: 'a conch shell' }

/**
 * Scheda di una nazione.
 * @returns {object} dati e testi pronti per la pagina
 */
export function nationInfo(n, nations, planet) {
  if (n._info) return n._info
  const s = Planet.createSample()
  const pts = n.labelPoints
  const cnt = pts.length / 3
  const hist = new Map()
  let tSum = 0
  let hMax = -Infinity
  let hMaxAt = null
  const nb = new Map()
  const w = { x: 0, y: 0, z: 0 }
  for (let k = 0; k < cnt; k++) {
    const x = pts[k * 3]
    const y = pts[k * 3 + 1]
    const z = pts[k * 3 + 2]
    planet.sample(x, y, z, 1, s)
    hist.set(s.biome, (hist.get(s.biome) || 0) + 1)
    tSum += s.temp
    if (s.height > hMax) {
      hMax = s.height
      hMaxAt = [x, y, z]
    }
    // vicini: punti vicini al confine guardano la seconda nazione più vicina
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
  const cap = n.capital ? dirToLatLon(n.capital[0], n.capital[1], n.capital[2]) : null
  const peak = hMaxAt ? dirToLatLon(hMaxAt[0], hMaxAt[1], hMaxAt[2]) : null

  // gruppo dominante (per la storia)
  const groups = new Map()
  for (const b of biomes) {
    const g = GROUP[b.biome] || 'plains'
    groups.set(g, (groups.get(g) || 0) + b.share)
  }
  const gs = [...groups.entries()].sort((a, b) => b[1] - a[1])
  const main = gs[0]?.[0] || 'plains'
  const second = gs[1] && gs[1][1] > 0.12 ? gs[1][0] : null

  // popolazione stimata (abitanti/km² per bioma)
  const DENS = { forest: 14, north: 3, plains: 30, mountain: 6, ice: 0.3, desert: 2, marsh: 9, fire: 2, crystal: 5, coast: 40 }
  let dens = 0
  for (const b of biomes) dens += (DENS[GROUP[b.biome] || 'plains'] || 10) * b.share
  const r = rng((planet.seed * 977 + n.id * 7919) ^ 0x5bd1e995)
  const population = Math.round((area * dens * (0.7 + 0.6 * r())) / 1000) * 1000

  // storia
  const founder = pick(r, FIRST) + ' ' + pick(r, EPITHET)
  const dynasty = placeName(r)
  const capital = placeName(r)
  const ruler = RULER[n.rank] || ['Lord', 'Lady']
  const rulerTitle = ruler[r() < 0.5 ? 0 : 1]
  const rulerName = pick(r, FIRST)
  const y1 = 120 + Math.floor(r() * 900)
  const y2 = y1 + 200 + Math.floor(r() * 700)
  const nbName = neighbors[0] ? neighbors[0].name : placeName(r)
  const fill = (t) =>
    t
      .replace('{N}', nbName)
      .replace('{Y2}', String(y2))
      .replace('{R}', pick(r, ruler))
      .replace('{F2}', pick(r, FIRST))
      .replace('{D}', dynasty)
  const history = [
    `${n.title} was founded in the year ${y1} of the Long Dawn, when ${FOUNDING[main](founder)}.`,
    fill(pick(r, MIDDLE[main])),
    second && MIDDLE[second] ? fill(pick(r, MIDDLE[second])) : fill(pick(r, GENERIC)),
    fill(pick(r, GENERIC)),
    `Today the realm is ruled by ${rulerTitle} ${rulerName} of the House of ${dynasty} from the capital, ${capital}. Its people are known for ${KNOWN_FOR[main]}${second ? ' and ' + KNOWN_FOR[second].split(' and ').pop() : ''}.`
  ]
  // stemma
  const c1 = pick(r, COLORS)
  let c2 = pick(r, COLORS)
  if (c2 === c1) c2 = c1 === 'or' ? 'argent' : 'or'
  const banner = { text: `${c1[0].toUpperCase() + c1.slice(1)}, ${CHARGES[main]} ${c2}`, c1: COLOR_CSS[c1], c2: COLOR_CSS[c2] }

  // flora tipica: specie più comuni nei suoi biomi
  const fl = new Map()
  for (const b of biomes.slice(0, 6)) for (const e of biomeFlora(b.biome)) fl.set(e.id, (fl.get(e.id) || 0) + e.w * b.share)
  const flora = [...fl.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id]) => SPECIES[id].name)

  n._info = {
    area,
    landShare: n.share,
    population,
    capital,
    capitalAt: cap,
    peak: Math.max(0, hMax),
    peakAt: peak,
    temp: tSum / Math.max(cnt, 1),
    biomes,
    neighbors,
    ruler: `${rulerTitle} ${rulerName}`,
    dynasty,
    founded: y1,
    history,
    banner,
    flora
  }
  return n._info
}
