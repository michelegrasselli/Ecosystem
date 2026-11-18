// Etichette delle nazioni: nomi in sovrimpressione (HTML).
//
// Il nome sta su un punto FISSO della nazione (il baricentro della sua
// terraferma, calcolato una volta sola): ricalcolandolo ogni volta come media
// della parte visibile, durante lo zoom si spostava di lato in continuazione.
// Ora la posizione a schermo è solo la proiezione dell'ancora geografica, quindi
// si muove insieme al terreno, in modo continuo.
//
// Quando l'ancora esce dallo schermo (zoom dentro un angolo della nazione) il
// nome si porta verso il centro della vista: lì resta fermo finché si rimane
// nella stessa nazione. Una compressione morbida verso il centro impedisce che
// finisca sul bordo.
//
// La visibilità viene da una griglia di raggi lanciata dallo schermo (spalmata
// su più frame): serve solo a sapere quanta parte della nazione si vede.
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

// L'ancora comanda finché è ben dentro lo schermo; verso il bordo il nome passa
// al centro della vista.
const ANCHOR_FADE_IN = 0.42
const ANCHOR_FADE_OUT = 0.86

// Quando l'ancora non si vede, quanto pesa il centro della vista rispetto al
// baricentro della parte visibile (0 = solo baricentro, 1 = centro fisso).
const CENTRE_PULL = 0.7

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
    return {
      n,
      el,
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      ax: 0, // ancora proiettata (px)
      ay: 0,
      anchorOk: false,
      cx: 0, // baricentro della parte visibile (px)
      cy: 0,
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

  /** Proietta l'ancora geografica di ogni nazione (economico, ogni frame). */
  function projectAnchors(camera, width, height) {
    const camDist = camera.position.length() || 1
    const horizon = SCENE_RADIUS / camDist - 0.002
    for (const it of items) {
      const a = it.n.anchor
      _v.set(a[0], a[1], a[2]).multiplyScalar(SCENE_RADIUS)
      // oltre l'orizzonte il punto è nascosto dalla curvatura anche se la
      // proiezione cadrebbe dentro lo schermo
      const facing =
        (_v.x * camera.position.x + _v.y * camera.position.y + _v.z * camera.position.z) /
        (camDist * SCENE_RADIUS)
      if (facing < horizon) {
        it.anchorOk = false
        continue
      }
      _v.applyMatrix4(camera.matrixWorldInverse)
      if (_v.z >= -1e-3) {
        it.anchorOk = false
        continue
      }
      _v.applyMatrix4(camera.projectionMatrix)
      it.ax = (_v.x * 0.5 + 0.5) * width
      it.ay = (0.5 - _v.y * 0.5) * height
      it.anchorOk = Math.abs(_v.x) < 1.3 && Math.abs(_v.y) < 1.3
    }
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
        }
        accHits[i] = 0
        accX[i] = 0
        accY[i] = 0
      }
    }
  }

  /** Compressione morbida: invariata sotto `inner`, asintotica a `outer`. */
  function softLimit(v, half, inner, outer) {
    if (!(half > 0)) return 0
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
      projectAnchors(camera, width, height)
      scanRows(camera, width, height)
    } else {
      row = 0
      accHits.fill(0)
      accX.fill(0)
      accY.fill(0)
      for (const it of items) it.anchorOk = false
    }

    const cx = width * 0.5
    const cy = height * 0.5

    // 1. posizione e visibilità desiderate
    visible.length = 0
    for (const it of items) {
      if (global <= 0.01 || hits[it.n.id] < MIN_HITS) {
        it.target = 0
      } else {
        it.target = Math.min(1, hits[it.n.id] / 10) * global
        // ancora geografica se è dentro lo schermo, altrimenti baricentro
        // della parte visibile portato verso il centro della vista
        let tx = it.cx + (cx - it.cx) * CENTRE_PULL
        let ty = it.cy + (cy - it.cy) * CENTRE_PULL
        if (it.anchorOk) {
          const nx = (it.ax / width) * 2 - 1
          const ny = (it.ay / height) * 2 - 1
          const edge = Math.max(Math.abs(nx), Math.abs(ny))
          const w = 1 - THREE.MathUtils.smoothstep(edge, ANCHOR_FADE_IN, ANCHOR_FADE_OUT)
          tx = tx + (it.ax - tx) * w
          ty = ty + (it.ay - ty) * w
        }
        it.tx = cx + softLimit(tx - cx, cx, INNER_X, OUTER_X)
        it.ty = cy + softLimit(ty - cy, cy, INNER_Y, OUTER_Y)
        if (!it.placed) {
          it.x = it.tx
          it.y = it.ty
          it.placed = true
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
    const k = 1 - Math.exp(-dt * 7)
    const maxStep = 800 * dt
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

  return { update }
}
