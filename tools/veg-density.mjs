// Densità della vegetazione per bioma su tile casuali: piante per km² e
// frazione di tile quasi spoglie (radure). Uso: node tools/veg-density.mjs [livello] [n]
import { Planet } from '../src/planet/planet.js'
import { computeTileData, cubeFaceDir } from '../src/render/tileData.js'
import { BIOME_NAME } from '../src/planet/biomes.js'
import { DEFAULT_SEED, SCENE_RADIUS } from '../src/planet/constants.js'

const planet = new Planet(DEFAULT_SEED)
const L = +(process.argv[2] || 12)
const N = +(process.argv[3] || 600)
const div = 1 << L
const tileKm = (Math.PI * 0.5 * SCENE_RADIUS) / div
let sr = 11
const rnd = () => (sr = (sr * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
const st = {}
const smp = Planet.createSample()
const dir = { x: 0, y: 0, z: 0 }
let ms = 0
let maxN = 0
for (let k = 0; k < N; k++) {
  const face = Math.floor(rnd() * 6)
  const ix = Math.floor(rnd() * div)
  const iy = Math.floor(rnd() * div)
  cubeFaceDir(face, ((ix + 0.5) / div) * 2 - 1, ((iy + 0.5) / div) * 2 - 1, dir)
  const l = Math.hypot(dir.x, dir.y, dir.z)
  planet.sample(dir.x / l, dir.y / l, dir.z / l, 1, smp)
  const name = BIOME_NAME[smp.biome] || smp.biome
  const t0 = performance.now()
  const d = computeTileData(planet, face, L, ix, iy)
  ms += performance.now() - t0
  const n = d.veg ? d.veg.count : 0
  maxN = Math.max(maxN, n)
  const s = (st[name] ||= { tiles: 0, plants: 0, bare: 0, dense: 0 })
  s.tiles++
  s.plants += n
  const dens = n / (tileKm * tileKm)
  if (dens < 0.3) s.bare++
  if (dens > 3) s.dense++
}
console.log(`L${L} tile ${tileKm.toFixed(1)} km, ${(ms / N).toFixed(1)} ms/tile, max ${maxN} piante/tile`)
for (const [k, s] of Object.entries(st).sort((a, b) => b[1].tiles - a[1].tiles)) {
  console.log(k.padEnd(18), String(s.tiles).padStart(4), 'tile', (s.plants / s.tiles / tileKm / tileKm).toFixed(2).padStart(6), '/km²', ' spoglie', (s.bare / s.tiles * 100).toFixed(0).padStart(3) + '%', ' fitte', (s.dense / s.tiles * 100).toFixed(0).padStart(3) + '%')
}
