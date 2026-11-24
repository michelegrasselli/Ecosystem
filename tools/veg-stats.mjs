// Statistiche della vegetazione: piante e specie in alcune tile, tempo di calcolo.
// Uso: node tools/veg-stats.mjs [lat lon livello]
import { Planet } from '../src/planet/planet.js'
import { computeTileData } from '../src/render/tileData.js'
import { SPECIES } from '../src/planet/flora.js'
import { DEFAULT_SEED } from '../src/planet/constants.js'

const planet = new Planet(DEFAULT_SEED)

/** Faccia e indici della tile che contiene (lat, lon) al livello dato. */
function tileAt(lat, lon, level) {
  const la = (lat * Math.PI) / 180
  const lo = (lon * Math.PI) / 180
  const x = Math.cos(la) * Math.cos(lo)
  const y = Math.sin(la)
  const z = -Math.cos(la) * Math.sin(lo)
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  const az = Math.abs(z)
  let face, u, v
  // inverso di cubeFaceDir (tileData.js)
  if (ax >= ay && ax >= az) {
    if (x > 0) { face = 0; u = -z / ax; v = y / ax } else { face = 1; u = z / ax; v = y / ax }
  } else if (ay >= az) {
    if (y > 0) { face = 2; u = x / ay; v = -z / ay } else { face = 3; u = x / ay; v = z / ay }
  } else {
    if (z > 0) { face = 4; u = x / az; v = y / az } else { face = 5; u = -x / az; v = y / az }
  }
  const div = 1 << level
  return { face, ix: Math.min(div - 1, Math.floor(((u + 1) / 2) * div)), iy: Math.min(div - 1, Math.floor(((v + 1) / 2) * div)) }
}

const cases = process.argv.length > 4
  ? [[+process.argv[2], +process.argv[3], +process.argv[4]]]
  : [
      [6.05, -2.4, 12], [6.05, -2.4, 14], // valle verde
      [-10, -110, 12], // foresta pluviale
      [20, 15, 12], // deserto
      [63.2, -140.3, 12], // ghiacci
      [0.69, -100.75, 12], // vulcano
      [57.6, -64.6, 12], // mare attorno all'isola vulcanica
      [-14.5, -117.5, 12] // catena montuosa
    ]
for (const [lat, lon, level] of cases) {
  const t = tileAt(lat, lon, level)
  const t0 = performance.now()
  const d = computeTileData(planet, t.face, level, t.ix, t.iy)
  const ms = performance.now() - t0
  const counts = {}
  if (d.veg) for (const s of d.veg.species) counts[SPECIES[s].name] = (counts[SPECIES[s].name] || 0) + 1
  console.log(`${lat},${lon} L${level}: ${d.veg ? d.veg.count : 0} piante, ${ms.toFixed(0)} ms`, JSON.stringify(counts))
}
