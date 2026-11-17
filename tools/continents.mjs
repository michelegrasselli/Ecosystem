// Taratura del campo di continentalità: prova combinazioni di pesi/scala e
// riporta terre emerse e dimensione delle masse connesse.
//
// Uso: node tools/continents.mjs [seed] [soglie...]
// Le soglie possono anche essere una lista separata da virgole.

import { Planet, CONTINENT_TUNING } from '../src/planet/planet.js'

const seed = Number(process.argv[2] ?? 20261116)
const arg = process.argv[3]
const thresholds = arg ? arg.split(',').map(Number) : [undefined]

const STEP = 1.5 // gradi
const LON = Math.round(360 / STEP)
const LAT = Math.round(180 / STEP)

function analyse(planet) {
  const out = Planet.createSample()
  const mask = new Uint8Array(LAT * LON)
  // peso per cella: le righe polari sono molto più piccole di quelle equatoriali
  const w = new Float64Array(LAT)
  for (let iy = 0; iy < LAT; iy++) {
    const lat = (90 - (iy + 0.5) * STEP) * (Math.PI / 180)
    w[iy] = Math.cos(lat)
  }
  let land = 0
  let area = 0

  for (let iy = 0; iy < LAT; iy++) {
    const lat = 90 - (iy + 0.5) * STEP
    for (let ix = 0; ix < LON; ix++) {
      const lon = -180 + (ix + 0.5) * STEP
      planet.sampleLatLon(lat, lon, 1, out)
      area += w[iy]
      // il mare ha quota negativa; laghi e fiumi sono acqua ma su terra
      if (out.height >= 0 && out.water < 0.5) {
        mask[iy * LON + ix] = 1
        land += w[iy]
      }
    }
  }

  // componenti connesse (4-vicini, longitudine periodica), area come peso
  const label = new Int32Array(LAT * LON).fill(-1)
  const sizes = []
  const stack = []
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start] >= 0) continue
    const id = sizes.length
    let size = 0
    stack.push(start)
    label[start] = id
    while (stack.length) {
      const p = stack.pop()
      const iy = (p / LON) | 0
      const ix = p - iy * LON
      size += w[iy]
      const q = [
        iy > 0 ? p - LON : -1,
        iy < LAT - 1 ? p + LON : -1,
        iy * LON + ((ix + LON - 1) % LON),
        iy * LON + ((ix + 1) % LON)
      ]
      for (let i = 0; i < 4; i++) {
        const n = q[i]
        if (n >= 0 && mask[n] && label[n] < 0) {
          label[n] = id
          stack.push(n)
        }
      }
    }
    sizes.push(size)
  }

  sizes.sort((a, b) => b - a)
  const totalLand = land || 1
  return {
    land: (land / area) * 100,
    masses: sizes.filter((s) => s / totalLand > 0.01).length,
    largest: (sizes[0] / totalLand) * 100,
    top: sizes.slice(0, 4).map((s) => Math.round((s / totalLand) * 100))
  }
}

const fmt = (r) =>
  `terre ${r.land.toFixed(1).padStart(5)}%  masse ${String(r.masses).padStart(2)}  ` +
  `max ${String(Math.round(r.largest)).padStart(3)}%  top ${r.top.map((v) => String(v).padStart(3)).join(' ')}`

// combinazioni da provare: [bigWeight, medWeight, medScale, fineWeight, fineScale]
// (sovrascrivibili con la variabile d'ambiente VARIANTS, JSON)
const variants = process.env.VARIANTS
  ? JSON.parse(process.env.VARIANTS)
  : [[CONTINENT_TUNING.bigWeight, CONTINENT_TUNING.medWeight, CONTINENT_TUNING.medScale, CONTINENT_TUNING.fineWeight, CONTINENT_TUNING.fineScale]]

for (const [bw, mw, ms, fw = CONTINENT_TUNING.fineWeight, fs = CONTINENT_TUNING.fineScale] of variants) {
  CONTINENT_TUNING.bigWeight = bw
  CONTINENT_TUNING.medWeight = mw
  CONTINENT_TUNING.medScale = ms
  CONTINENT_TUNING.fineWeight = fw
  CONTINENT_TUNING.fineScale = fs
  for (const t of thresholds) {
    const planet = new Planet(seed, t === undefined ? {} : { continentThreshold: t })
    const r = analyse(planet)
    console.log(
      `big ${bw} med ${mw} (scala ${ms}) fine ${fw}@${fs}  ` + fmt(r) + `  soglia ${planet.continentThreshold}`
    )
  }
}
