// Pool di Web Worker per la generazione delle tile.
// Il LOD chiede le tile in ordine di priorità; il pool ne tiene in volo al
// massimo `slots` per worker, così le richieste più urgenti non restano dietro
// a una coda lunga, e restituisce i risultati da `drain()` una volta per frame.
//
// Il worker è incorporato nel bundle (`?worker&inline`, avviato da un Blob):
// così la build funziona anche aprendo dist/index.html con doppio clic (file://),
// dove il browser rifiuta di caricare un worker da un file separato.

import TileWorker from './tileWorker.js?worker&inline'

export class TilePool {
  constructor(seed, options = {}) {
    const cores = (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4
    this.size = Math.max(1, Math.min(6, cores - 1))
    this.slots = 3
    this.workers = []
    this.load = []
    this.pending = new Map() // id -> { worker, key }
    this.done = []
    this.nextId = 1
    this.ok = true

    try {
      for (let i = 0; i < this.size; i++) {
        const w = new TileWorker()
        w.postMessage({ type: 'init', seed, options })
        w.onmessage = (e) => this._onMessage(i, e.data)
        w.onerror = (err) => {
          console.error('tile worker', err)
          this.ok = false
        }
        this.workers.push(w)
        this.load.push(0)
      }
    } catch (err) {
      console.warn('Web Worker non disponibili, generazione nel thread principale', err)
      this.ok = false
    }
  }

  get inFlight() {
    return this.pending.size
  }

  /** C'è posto per un'altra richiesta? */
  hasCapacity() {
    // conta anche i risultati non ancora trasformati in mesh: altrimenti i
    // worker producono più di quanto il thread principale consumi e la coda
    // cresce senza limite (con risultati ormai vecchi e fuori priorità)
    return this.ok && this.pending.size + this.done.length < this.size * this.slots
  }

  /** Richiede la tile; restituisce l'id della richiesta. */
  request(key, face, level, x, y) {
    let best = 0
    for (let i = 1; i < this.load.length; i++) if (this.load[i] < this.load[best]) best = i
    const id = this.nextId++
    this.load[best]++
    this.pending.set(id, { worker: best, key })
    this.workers[best].postMessage({ type: 'build', id, face, level, x, y })
    return id
  }

  _onMessage(wi, msg) {
    if (msg.type !== 'tile') return
    const p = this.pending.get(msg.id)
    this.load[wi] = Math.max(0, this.load[wi] - 1)
    if (!p) return
    this.pending.delete(msg.id)
    this.done.push({ id: msg.id, key: p.key, data: msg.data })
  }

  /** Risultati arrivati dall'ultimo frame. */
  drain() {
    const out = this.done
    this.done = []
    return out
  }

  dispose() {
    for (const w of this.workers) w.terminate()
    this.workers.length = 0
  }
}
