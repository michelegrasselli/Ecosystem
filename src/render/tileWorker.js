// Web Worker: calcola i dati delle tile fuori dal thread principale.
// Ogni worker ha la propria istanza (deterministica) del pianeta, creata dal
// messaggio di init con lo stesso seed e la stessa soglia del thread principale.

import { Planet } from '../planet/planet.js'
import { computeTileData, tileTransferables } from './tileData.js'

let planet = null

self.onmessage = (e) => {
  const msg = e.data
  if (msg.type === 'init') {
    planet = new Planet(msg.seed, msg.options || {})
    return
  }
  if (msg.type === 'build') {
    const d = computeTileData(planet, msg.face, msg.level, msg.x, msg.y)
    self.postMessage({ type: 'tile', id: msg.id, data: d }, tileTransferables(d))
  }
}
