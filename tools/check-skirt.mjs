// Controllo: le facce della gonna devono guardare verso l'esterno della tile
// (altrimenti il backface culling le scarta e restano crepe nere nelle giunzioni
// tra livelli LOD diversi).
//
// Nota: le posizioni sono relative al centro della tile (mesh.position), quindi
// la direzione radiale va calcolata sulla posizione assoluta (centro + offset).
import { Planet } from '../src/planet/planet.js'
import { computeTileData, tileResForLevel } from '../src/render/tileData.js'

const planet = new Planet(1337)

let bad = 0
let checked = 0
const detail = []

for (const face of [0, 1, 2, 3, 4, 5]) {
  for (const level of [3, 6, 9]) {
    for (const [x, y] of [[0, 0], [1, 2]]) {
      if (x >= 1 << level || y >= 1 << level) continue
      const res = tileResForLevel(level)
      const row = res + 1
      const gridVerts = row * row
      const d = computeTileData(planet, face, level, x, y)
      const { positions, indices } = d
      const ox = d.origin[0], oy = d.origin[1], oz = d.origin[2]
      const total = indices.length / 3
      const first = total - 4 * res * 2
      const side = [0, 0, 0, 0]
      const sideBad = [0, 0, 0, 0]
      for (let t = first; t < total; t++) {
        const [a, b, c] = [indices[t * 3], indices[t * 3 + 1], indices[t * 3 + 2]]
        if (a < gridVerts && b < gridVerts && c < gridVerts) continue
        const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2]
        const ux = positions[b * 3] - ax, uy = positions[b * 3 + 1] - ay, uz = positions[b * 3 + 2] - az
        const vx = positions[c * 3] - ax, vy = positions[c * 3 + 1] - ay, vz = positions[c * 3 + 2] - az
        const nx = uy * vz - uz * vy
        const ny = uz * vx - ux * vz
        const nz = ux * vy - uy * vx
        // centro del triangolo rispetto al centro della tile
        const mx = (ax + positions[b * 3] + positions[c * 3]) / 3
        const my = (ay + positions[b * 3 + 1] + positions[c * 3 + 1]) / 3
        const mz = (az + positions[b * 3 + 2] + positions[c * 3 + 2]) / 3
        // direzione radiale assoluta
        const px = mx + ox, py = my + oy, pz = mz + oz
        const pl = Math.hypot(px, py, pz)
        const rx = px / pl, ry = py / pl, rz = pz / pl
        const dn = nx * rx + ny * ry + nz * rz
        const oX = nx - rx * dn, oY = ny - ry * dn, oZ = nz - rz * dn
        // "fuori dalla tile": dal centro verso il triangolo, sul piano tangente
        const td = mx * rx + my * ry + mz * rz
        const tx = mx - rx * td, ty = my - ry * td, tz = mz - rz * td
        const dot = oX * tx + oY * ty + oZ * tz
        const si = Math.floor((t - first) / (res * 2))
        side[si]++
        if (dot <= 0) {
          sideBad[si]++
          bad++
        }
        checked++
      }
      detail.push(`face ${face} L${level} (${x},${y}): sud ${sideBad[0]}/${side[0]}, nord ${sideBad[1]}/${side[1]}, ovest ${sideBad[2]}/${side[2]}, est ${sideBad[3]}/${side[3]}`)
    }
  }
}

for (const line of detail) console.log(line)
console.log(`${checked} triangoli di gonna controllati, ${bad} rivolti verso l'interno`)
process.exit(bad === 0 ? 0 : 1)
