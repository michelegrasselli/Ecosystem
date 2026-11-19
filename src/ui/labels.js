// Etichette delle nazioni: nomi in sovrimpressione (HTML).
//
// Ogni nazione ha alcuni PUNTI DI ANCORAGGIO fissi sul proprio territorio (il
// baricentro più una manciata di punti sparsi sulla terraferma, calcolati una
// volta sola in nations.js). Il nome si appoggia a uno di questi punti: a
// schermo è solo la sua proiezione, quindi si muove esattamente con il terreno.
//
// Ricalcolare ogni volta "il centro della parte visibile" faceva scivolare il
// nome, perché la griglia di raggi si aggiorna a scatti e il nome inseguiva
// quegli scatti. Ora il punto cambia solo quando quello scelto esce davvero
// dall'inquadratura (o un altro è molto più centrale): il nome resta fermo,
// ancorato, mentre si sposta la vista o si zooma.
//
// Se nessun punto è in vista (nazione vista di taglio, oltre l'orizzonte) si usa
// il baricentro della parte visibile, molto smorzato: meglio un nome che si
// muove piano che uno che salta.
//
// La visibilità viene da una griglia di raggi lanciata dallo schermo (spalmata
// su più frame): serve SOLO a sapere se la nazione è inquadrata.
//
// Compaiono avvicinandosi: dallo spazio sono nascoste, sotto i ~7000 km di
// quota sfumano in vista.

import * as THREE from 'three'
import { SCENE_RADIUS } from '../planet/constants.js'
import { Planet } from '../planet/planet.js'

const GRID_X = 16
const GRID_Y = 11
// righe della griglia analizzate per frame: la scansione completa dura ~3 frame
// invece di concentrare tutto in uno (uno scatto di lavoro ogni tanto si vede)
const ROWS_PER_FRAME = 4
const MIN_HITS = 3 // punti della griglia necessari per mostrare il nome

// Compressione morbida verso il centro: sotto INNER non cambia nulla, oltre si
// avvicina al centro senza mai superare OUTER (frazioni della semilarghezza).
const INNER_X = 0.5
const INNER_Y = 0.42
const OUTER_X = 0.72
const OUTER_Y = 0.6

// Il punto scelto resta anche se si avvicina al bordo (così il nome non salta di
// continuo); si cambia solo quando è uscito o quando un altro è molto più
// centrale (SWITCH_GAIN = quanto deve essere più vicino al centro).
const KEEP_RADIUS = 1.1
const SWITCH_GAIN = 0.7

const _ray = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _hit = new THREE.Vector3()
const _v = new THREE.Vector3()
const _sphere = new THREE.Sphere(new THREE.Vector3(), SCENE_RADIUS)

export function createNationLabels(nations, planet, container) {
  const root = document.createElement('div')
  root.className = 'nation-labels'
  container.appendChild(root)
  const sample = Planet.createSample()

  const items = nations.list.map((n) => {
    const el = document.createElement('div')
    el.className = 'nation-label'
    el.textContent = n.name
    root.appendChild(el)
    // nazioni più estese: nome un po' più grande
    const size = 11 + Math.min(Math.sqrt(n.share) * 22, 6)
    el.style.fontSize = size.toFixed(1) + 'px'
    // primo punto: il baricentro (l'etichetta "naturale" della nazione)
    const points = [n.anchor].concat(n.labelPoints || [])
    return {
      n,
      el,
      points,
      scr: points.map(() => ({ x: 0, y: 0 })),
      valid: new Uint8Array(points.length),
      cand: -1,
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      cx: 0, // baricentro della parte visibile (px), solo come ripiego
      cy: 0,
      haveCx: false,
      scx: 0,
      scy: 0,
      cxPlaced: false,
      alpha: 0,
      target: 0,
      placed: false,
      w: 0, // larghezza stimata dell'etichetta (px)
      h: 0,
      lastTransform: '',
      lastOpacity: ''
    }
  })

  const hits = new Int32Array(items.length)
  const accHits = new Int32Array(items.length)
  const accX = new Float64Array(items.length)
  const accY = new Float64Array(items.length)
  const placedBoxes = items.map(() => ({ x: 0, y: 0, hw: 0, hh: 0 }))
  let row = 0
  const visible = [] // etichette da mostrare, riusato ogni frame

  /**
   * Proietta un punto della sfera (unitario) e ne scrive la posizione a schermo.
   * Restituisce false se il punto è dietro la camera o oltre l'orizzonte.
   */
  function projectPoint(camera, p, camDist, horizon, width, height, out) {
    const x = p[0] * SCENE_RADIUS
    const y = p[1] * SCENE_RADIUS
    const z = p[2] * SCENE_RADIUS
    // oltre l'orizzonte è nascosto dalla curvatura anche se la proiezione
    // cadrebbe dentro lo schermo
    const facing =
      (x * camera.position.x + y * camera.position.y + z * camera.position.z) /
      (camDist * SCENE_RADIUS)
    if (facing < horizon) return false
    _v.set(x, y, z).applyMatrix4(camera.matrixWorldInverse)
    if (_v.z >= -1e-3) return false
    _v.applyMatrix4(camera.projectionMatrix)
    const px = (_v.x * 0.5 + 0.5) * width
    const py = (0.5 - _v.y * 0.5) * height
    // vicino al piano della camera la proiezione esplode: si scarta
    if (!Number.isFinite(px) || !Number.isFinite(py) || Math.abs(px) > 2e5 || Math.abs(py) > 2e5) {
      return false
    }
    out.x = px
    out.y = py
    return true
  }

  /** Alcune righe della griglia di raggi; a fine giro pubblica i risultati. */
  function scanRows(camera, width, height) {
    const rows = Math.min(ROWS_PER_FRAME, GRID_Y - row)
    for (let i = 0; i < rows; i++, row++) {
      const sy = (row + 0.5) / GRID_Y
      for (let gx = 0; gx < GRID_X; gx++) {
        const sx = (gx + 0.5) / GRID_X
        _ndc.set(sx * 2 - 1, -(sy * 2 - 1))
        _ray.setFromCamera(_ndc, camera)
        if (!_ray.ray.intersectSphere(_sphere, _hit)) continue
        _hit.normalize()
        planet.sample(_hit.x, _hit.y, _hit.z, 1, sample)
        // solo terraferma (laghi e fiumi compresi: fanno parte dello stato)
        if (sample.height < 0) continue
        const id = nations.idAt(_hit.x, _hit.y, _hit.z)
        accHits[id]++
        accX[id] += sx * width
        accY[id] += sy * height
      }
    }

    // giro completo: i conteggi diventano lo stato "ufficiale"
    if (row >= GRID_Y) {
      row = 0
      hits.set(accHits)
      for (let i = 0; i < items.length; i++) {
        const n = accHits[i]
        if (n > 0) {
          items[i].cx = accX[i] / n
          items[i].cy = accY[i] / n
          items[i].haveCx = true
        }
        accHits[i] = 0
        accX[i] = 0
        accY[i] = 0
      }
    }
  }

  /** Compressione morbida: invariata sotto `inner`, asintotica a `outer`. */
  function softLimit(v, half, inner, outer) {
    if (!(half > 0) || !Number.isFinite(v)) return 0
    const n = Math.abs(v / half)
    if (n <= inner) return v
    const mapped = inner + (outer - inner) * Math.tanh((n - inner) / (outer - inner))
    return Math.sign(v) * mapped * half
  }

  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} altitudeKm
   * @param {number} width larghezza della vista (px CSS)
   * @param {number} height altezza della vista (px CSS)
   * @param {number} dt secondi dall'ultimo frame
   */
  function update(camera, altitudeKm, width, height, dt) {
    // visibilità globale in base alla quota
    // (smoothstep di three.js vuole min < max: si inverte a mano)
    const global = 1 - THREE.MathUtils.smoothstep(altitudeKm, 3500, 7000)
    if (global > 0.01) {
      scanRows(camera, width, height)
    } else {
      row = 0
      accHits.fill(0)
      accX.fill(0)
      accY.fill(0)
    }

    const cx = width * 0.5
    const cy = height * 0.5
    const camDist = camera.position.length() || 1
    const horizon = SCENE_RADIUS / camDist - 0.002

    // 1. posizione e visibilità desiderate
    visible.length = 0
    for (const it of items) {
      if (global <= 0.01 || hits[it.n.id] < MIN_HITS) {
        it.target = 0
        it.cand = -1
      } else {
        it.target = Math.min(1, hits[it.n.id] / 10) * global

        // punto di ancoraggio visibile più centrale
        let best = -1
        let bestD = Infinity
        for (let k = 0; k < it.points.length; k++) {
          const ok = projectPoint(camera, it.points[k], camDist, horizon, width, height, it.scr[k])
          it.valid[k] = ok ? 1 : 0
          if (!ok) continue
          const s = it.scr[k]
          const d = Math.max(Math.abs((s.x - cx) / cx), Math.abs((s.y - cy) / cy))
          if (d < bestD) {
            bestD = d
            best = k
          }
        }

        // isteresi: il punto attuale resta finché non esce o non c'è di meglio
        let chosen = best
        if (it.cand >= 0 && it.valid[it.cand]) {
          const s = it.scr[it.cand]
          const dCur = Math.max(Math.abs((s.x - cx) / cx), Math.abs((s.y - cy) / cy))
          if (dCur <= KEEP_RADIUS) chosen = it.cand
          else if (bestD > dCur * SWITCH_GAIN) chosen = it.cand
        }
        it.cand = chosen

        let tx
        let ty
        let has = false
        if (chosen >= 0) {
          tx = it.scr[chosen].x
          ty = it.scr[chosen].y
          has = true
        } else if (it.haveCx) {
          // ripiego: centro della parte visibile, molto smorzato
          if (!it.cxPlaced) {
            it.scx = it.cx
            it.scy = it.cy
            it.cxPlaced = true
          } else {
            const kc = 1 - Math.exp(-dt * 2)
            it.scx += (it.cx - it.scx) * kc
            it.scy += (it.cy - it.scy) * kc
          }
          tx = it.scx
          ty = it.scy
          has = true
        }

        if (has) {
          it.tx = cx + softLimit(tx - cx, cx, INNER_X, OUTER_X)
          it.ty = cy + softLimit(ty - cy, cy, INNER_Y, OUTER_Y)
          if (!it.placed) {
            it.x = it.tx
            it.y = it.ty
            it.placed = true
          }
        }
      }
      if (it.target > 0.01) visible.push(it)
    }

    // 2. niente nomi sovrapposti: vince quello con più terra visibile (poi la
    // nazione più estesa). Gli altri sfumano, invece di accavallarsi.
    let keep = 0
    visible.sort((a, b) => b.target - a.target || b.n.share - a.n.share)
    for (const it of visible) {
      if (!it.w) {
        it.w = it.el.offsetWidth
        it.h = it.el.offsetHeight
      }
      const hw = it.w * 0.5 + 6
      const hh = it.h * 0.5 + 4
      let clash = false
      for (let k = 0; k < keep; k++) {
        const o = placedBoxes[k]
        if (Math.abs(it.tx - o.x) < hw + o.hw && Math.abs(it.ty - o.y) < hh + o.hh) {
          clash = true
          break
        }
      }
      if (clash) {
        it.target = 0
      } else {
        placedBoxes[keep].x = it.tx
        placedBoxes[keep].y = it.ty
        placedBoxes[keep].hw = hw
        placedBoxes[keep].hh = hh
        keep++
      }
    }

    // 3. movimento e opacità
    // inseguimento rapido: il nome deve sembrare incollato al terreno, non
    // arrivarci con calma (il ritardo si legge come "si sposta da solo")
    const k = 1 - Math.exp(-dt * 14)
    const maxStep = 2400 * dt
    for (const it of items) {
      it.alpha += (it.target - it.alpha) * (1 - Math.exp(-dt * 5))

      if (it.alpha < 0.012) {
        it.alpha = 0
        if (it.lastOpacity !== '0') {
          it.el.style.opacity = '0'
          it.lastOpacity = '0'
        }
        // torna fuori schermo: la prossima volta riparte dalla posizione giusta
        if (it.target === 0) it.placed = false
        continue
      }

      // avvicinamento graduale, con velocità massima: niente scatti laterali
      const dx = it.tx - it.x
      const dy = it.ty - it.y
      const dist = Math.hypot(dx, dy)
      if (dist < 0.5) {
        it.x = it.tx
        it.y = it.ty
      } else {
        const step = Math.min(k, maxStep / dist)
        it.x += dx * step
        it.y += dy * step
      }

      const tr = `translate(-50%, -50%) translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`
      if (tr !== it.lastTransform) {
        it.el.style.transform = tr
        it.lastTransform = tr
      }
      const op = it.alpha.toFixed(3)
      if (op !== it.lastOpacity) {
        it.el.style.opacity = op
        it.lastOpacity = op
      }
    }
  }

  return {
    update,
    /** Stato interno delle etichette (debug). */
    debug: () =>
      items.map((it) => ({
        t: it.n.name,
        tx: it.tx,
        ty: it.ty,
        x: it.x,
        y: it.y,
        cand: it.cand,
        nPoints: it.points.length,
        cx: it.cx,
        cy: it.cy,
        haveCx: it.haveCx,
        hits: hits[it.n.id],
        alpha: it.alpha
      }))
  }
}
