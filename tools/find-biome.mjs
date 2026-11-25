// Cerca punti di un bioma: node tools/find-biome.mjs Swamp [n]
import { Planet } from '../src/planet/planet.js'
import { BIOME_NAME } from '../src/planet/biomes.js'
import { DEFAULT_SEED } from '../src/planet/constants.js'
const planet = new Planet(DEFAULT_SEED)
const want = process.argv[2]
const n = +(process.argv[3] || 6)
const smp = Planet.createSample()
const found = []
for (let lat = -70; lat <= 70 && found.length < n; lat += 1.7) {
  for (let lon = -180; lon < 180 && found.length < n; lon += 2.3) {
    const la = (lat * Math.PI) / 180
    const lo = (lon * Math.PI) / 180
    planet.sample(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo), 1, smp)
    if (BIOME_NAME[smp.biome] === want) found.push([+lat.toFixed(2), +lon.toFixed(2)])
  }
}
console.log(want, JSON.stringify(found))
