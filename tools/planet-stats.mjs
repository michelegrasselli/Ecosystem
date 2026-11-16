// Strumento di verifica: campiona il pianeta su una griglia e stampa statistiche
// (frazione di terre emerse, distribuzione delle quote, biomi dominanti per fascia latitudinale).
//
// Uso: node tools/planet-stats.mjs [seed]

import { Planet } from '../src/planet/planet.js'
import { BIOME_NAME } from '../src/planet/biomes.js'

const seed = Number(process.argv[2] ?? 20261116)
const planet = new Planet(seed)
const out = Planet.createSample()

const STEP = 1.5 // gradi
const latBands = new Map()
let land = 0
let total = 0
let maxH = -Infinity
let minH = Infinity
let rivers = 0
let lakes = 0
const biomeCount = new Map()

for (let lat = -89; lat <= 89; lat += STEP) {
  const band = Math.round(lat / 10) * 10
  if (!latBands.has(band)) latBands.set(band, new Map())
  const bm = latBands.get(band)

  const cosLat = Math.cos((lat * Math.PI) / 180)
  const steps = Math.max(1, Math.round((360 / STEP) * cosLat))
  for (let i = 0; i < steps; i++) {
    const lon = (i / steps) * 360 - 180
    planet.sampleLatLon(lat, lon, 1, out)
    total++
    if (out.water === 0 && out.biome !== 1 && out.biome !== 0 && out.biome !== 2) land++
    if (out.height > maxH) maxH = out.height
    if (out.height < minH) minH = out.height
    if (out.biome === 4) rivers++
    if (out.biome === 3) lakes++

    const name = BIOME_NAME[out.biome] ?? '?'
    biomeCount.set(name, (biomeCount.get(name) ?? 0) + 1)
    bm.set(name, (bm.get(name) ?? 0) + 1)
  }
}

const pct = (v) => ((v / total) * 100).toFixed(1) + '%'

console.log(`Seed: ${seed}`)
console.log(`Campioni: ${total}`)
console.log(`Terre emerse: ${pct(land)}`)
console.log(`Quota max: ${maxH.toFixed(0)} m   minima: ${minH.toFixed(0)} m`)
console.log(`Fiumi: ${pct(rivers)}   Laghi: ${pct(lakes)}`)
console.log('\nBiomi globali:')
;[...biomeCount.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([k, v]) => console.log(`  ${k.padEnd(22)} ${pct(v)}`))

console.log('\nBioma dominante per fascia di latitudine:')
;[...latBands.entries()]
  .sort((a, b) => b[0] - a[0])
  .forEach(([band, map]) => {
    const top = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    console.log(
      `  ${String(band).padStart(4)}°  ` + top.map(([k, v]) => `${k} (${pct(v)})`).join(', ')
    )
  })
