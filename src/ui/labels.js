// Etichette delle nazioni: nomi in sovrimpressione (HTML), in stile mappa
// antica (Cinzel spaziato, inchiostro chiaro con alone scuro).
//
// Il nome è sempre APPOGGIATO A UN PUNTO FISSO DEL TERRENO (la sua "ancora"):
// la posizione a schermo è la proiezione esatta di quel punto a ogni frame,
// quindi durante pan, zoom e rotazione il nome si muove rigidamente con la
// mappa, come un nome stampato sulla carta. Niente inseguimento di centroidi
// che cambiano a ogni frame (era la causa degli scatti).
//
// Quale ancora:
//  1. il "centro visivo" della nazione (Nations.center, polo di
//     inaccessibilità: il punto più lontano da confini e coste), finché è ben
//     dentro l'inquadratura;
//  2. altrimenti (zoom su una parte della nazione) il punto più interno della
//     parte VISIBILE: su una griglia di raggi lanciati dallo schermo si calcola
//     per ogni cella la distanza dal bordo della regione visibile (confini,
//     coste e bordi dello schermo) e si prende la cella più lontana. Zoomando
//     su un confine si vedono così entrambi i nomi, ognuno al centro del
//     proprio lato.
//
// L'ancora cambia solo quando serve (esce dall'inquadratura, o ce n'è una
// molto migliore: isteresi). Il nome raggiunge la nuova ancora lentamente, con
// una molla smorzata: posizione e velocità restano continue, niente scatti.
//
// I nomi compaiono sotto i ~7000 km di quota e scompaiono vicino al suolo
// (sotto ~40 km), dove la nazione riempie tutto lo schermo.

import * as THREE from 'three'
import { SCENE_RADIUS } from '../planet/constants.js'
import { Planet } from '../planet/planet.js'

// lato delle celle della griglia di raggi rispetto al lato lungo dello schermo
const GRID_CELLS_LONG = 24
const MAX_CELLS = 40 * 40
// giro completo della griglia in ~3 frame
const SCAN_FRAMES = 3
const MIN_CELLS = 3 // celle necessarie per far comparire il nome
const KEEP_CELLS = 1 // celle sufficienti per non farlo sparire (isteresi)
// il centro della nazione si usa finché sta in questa frazione dello schermo (NDC)
const CENTER_INSIDE = 0.8
// un'ancora della parte visibile resta finché è dentro questa frazione
const ANCHOR_INSIDE = 0.9
// cambio d'ancora: la nuova deve essere migliore di così (in celle)
const SWITCH_RATIO = 1.25
const SWITCH_MARGIN = 0.5
// pulsazione della molla che porta il nome verso la nuova ancora (rad/s):
// ~2 s per arrivare, con partenza e arrivo dolci
const SPRING = 2.0
// margine dai bordi dello schermo per il nome (px)
const MARGIN = 10

const _ray = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _hit = new THREE.Vector3()
const _sphere = new THREE.Sphere(new THREE.Vector3(), SCENE_RADIUS)

export function createNationLabels(nations, planet, container) {
  const root = document.createElement('div')
  root.className = 'nation-labels'
  container.appendChild(root)
  const sample = Planet.createSample()
  const N = nations.list.length

  const items = nations.list.map((n) => {
    const el = document.createElement('div')
    el.className = 'nation-label'
    el.textContent = n.name
    root.appendChild(el)
    // nazioni più estese: nome un po' più grande
    const size = 9 + Math.min(Math.sqrt(n.share) * 14, 4)
    el.style.fontSize = size.toFixed(1) + 'px'
    const c = n.center || n.anchor
    return {
      n,
      el,
      size,
      center: [c[0], c[1], c[2]],
      // ancora attuale del nome (versore), bersaglio e tipo
      p: [c[0], c[1], c[2]],
      t: [c[0], c[1], c[2]],
      tIsCenter: true,
      isCenter: true,
      v: [0, 0, 0], // velocità della molla
      swapping: false, // ancora finita fuori schermo: salto quando il nome è sparito
      cells: 0,
      seen: false,
      x: 0,
      y: 0,
      alpha: 0,
      target: 0,
      w: 0,
      h: 0,
      lastTransform: '',
      lastOpacity: ''
    }
  })

  // le misure dei nomi cambiano quando arriva il carattere Cinzel
  document.fonts?.ready.then(() => {
    for (const it of items) it.w = 0
  })

  // ----------------------------------------------------- griglia di raggi
  // id della nazione per cella (-1: mare o spazio) e punto colpito
  const cellId = new Int16Array(MAX_CELLS)
  const cellXYZ = new Float64Array(MAX_CELLS * 3)
  const cellDist = new Float32Array(MAX_CELLS) // distanza dal bordo (celle)
  const edgeX = new Int16Array(MAX_CELLS)
  const edgeY = new Int16Array(MAX_CELLS)
  // risultati dell'ultimo giro completo
  let cols = 0
  let rows = 0
  let row = 0
  let scanCols = 0
  let scanRows = 0
  let scanned = false // c'è almeno un giro completo valido
  const cellCount = new Int32Array(N)
  const bestCell = new Int32Array(N)
  const bestDist = new Float32Array(N)
  const bestXYZ = new Float64Array(N * 3)
  const pubId = new Int16Array(MAX_CELLS) // copia pubblicata (per valutare l'ancora attuale)
  const pubDist = new Float32Array(MAX_CELLS)
  let pubCols = 0
  let pubRows = 0
  let generation = 0 // cresce a ogni giro completo

  function startScan(width, height) {
    const cs = Math.max(width, height) / GRID_CELLS_LONG
    scanCols = Math.max(4, Math.min(40, Math.round(width / cs)))
    scanRows = Math.max(4, Math.min(40, Math.round(height / cs)))
    row = 0
  }

  function scanStep(camera, width, height) {
    if (row === 0) startScan(width, height)
    const per = Math.ceil(scanRows / SCAN_FRAMES)
    const end = Math.min(scanRows, row + per)
    for (; row < end; row++) {
      const sy = (row + 0.5) / scanRows
      for (let gx = 0; gx < scanCols; gx++) {
        const c = row * scanCols + gx
        cellId[c] = -1
        const sx = (gx + 0.5) / scanCols
        _ndc.set(sx * 2 - 1, -(sy * 2 - 1))
        _ray.setFromCamera(_ndc, camera)
        if (!_ray.ray.intersectSphere(_sphere, _hit)) continue
        _hit.normalize()
        planet.sample(_hit.x, _hit.y, _hit.z, 1, sample)
        // solo terraferma (laghi e fiumi compresi: fanno parte dello stato)
        if (sample.height < 0) continue
        cellId[c] = nations.idAt(_hit.x, _hit.y, _hit.z)
        cellXYZ[c * 3] = _hit.x
        cellXYZ[c * 3 + 1] = _hit.y
        cellXYZ[c * 3 + 2] = _hit.z
      }
    }
    if (row >= scanRows) {
      finishScan()
      row = 0
    }
  }

  /** Distanza di ogni cella dal bordo della sua regione e cella migliore per nazione. */
  function finishScan() {
    cols = scanCols
    rows = scanRows
    const n = cols * rows
    // celle di bordo: hanno un vicino (4-connesso) di un'altra regione
    let ne = 0
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const id = cellId[y * cols + x]
        if (
          (x > 0 && cellId[y * cols + x - 1] !== id) ||
          (x < cols - 1 && cellId[y * cols + x + 1] !== id) ||
          (y > 0 && cellId[(y - 1) * cols + x] !== id) ||
          (y < rows - 1 && cellId[(y + 1) * cols + x] !== id)
        ) {
          edgeX[ne] = x
          edgeY[ne] = y
          ne++
        }
      }
    }
    cellCount.fill(0)
    bestDist.fill(-1)
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const c = y * cols + x
        const id = cellId[c]
        if (id < 0) {
          cellDist[c] = 0
          continue
        }
        cellCount[id]++
        // distanza dai bordi dello schermo (il nome deve restare inquadrato)
        let d2 = Math.min(x + 0.5, cols - x - 0.5, y + 0.5, rows - y - 0.5) ** 2
        for (let e = 0; e < ne; e++) {
          const dx = edgeX[e] - x
          const dy = edgeY[e] - y
          const q = dx * dx + dy * dy
          if (q < d2) d2 = q
        }
        // il confine passa a metà fra due celle
        const d = Math.max(Math.sqrt(d2) + 0.5, 0.5)
        cellDist[c] = d
      }
    }
    // per ogni nazione: la cella più interna; a pari merito (entro mezza
    // cella) la più vicina al baricentro delle sue celle visibili
    const sx = new Float64Array(N)
    const sy = new Float64Array(N)
    for (let c = 0; c < n; c++) {
      const id = cellId[c]
      if (id < 0) continue
      sx[id] += c % cols
      sy[id] += Math.floor(c / cols)
    }
    const bestScore = new Float64Array(N).fill(-Infinity)
    for (let c = 0; c < n; c++) {
      const id = cellId[c]
      if (id < 0) continue
      const mx = sx[id] / cellCount[id]
      const my = sy[id] / cellCount[id]
      const score = cellDist[c] - 0.15 * Math.hypot((c % cols) - mx, Math.floor(c / cols) - my)
      if (score > bestScore[id]) {
        bestScore[id] = score
        bestCell[id] = c
        bestDist[id] = cellDist[c]
      }
    }
    // punto dell'ancora: media dei punti delle celle "quasi migliori" vicine
    // alla migliore (centra il nome lungo le creste della distanza)
    for (let id = 0; id < N; id++) {
      if (!cellCount[id]) continue
      const b = bestCell[id]
      const bx = b % cols
      const by = Math.floor(b / cols)
      let ax = 0
      let ay = 0
      let az = 0
      for (let y = Math.max(0, by - 1); y <= Math.min(rows - 1, by + 1); y++) {
        for (let x = Math.max(0, bx - 1); x <= Math.min(cols - 1, bx + 1); x++) {
          const c = y * cols + x
          if (cellId[c] !== id || cellDist[c] < bestDist[id] - 0.6) continue
          const w = c === b ? 2 : 1
          ax += cellXYZ[c * 3] * w
          ay += cellXYZ[c * 3 + 1] * w
          az += cellXYZ[c * 3 + 2] * w
        }
      }
      const l = Math.hypot(ax, ay, az) || 1
      bestXYZ[id * 3] = ax / l
      bestXYZ[id * 3 + 1] = ay / l
      bestXYZ[id * 3 + 2] = az / l
    }
    pubId.set(cellId.subarray(0, n))
    pubDist.set(cellDist.subarray(0, n))
    pubCols = cols
    pubRows = rows
    scanned = true
    generation++
  }

  /** Distanza dal bordo (celle) della parte visibile in un punto dello schermo, per la nazione id. */
  function distAt(nx, ny, id) {
    if (!pubCols) return 0
    const x = Math.floor((nx * 0.5 + 0.5) * pubCols)
    const y = Math.floor((0.5 - ny * 0.5) * pubRows)
    if (x < 0 || y < 0 || x >= pubCols || y >= pubRows) return 0
    const c = y * pubCols + x
    return pubId[c] === id ? pubDist[c] : 0
  }

  // proiezione di un versore del terreno; null se nascosto o dietro la camera
  const proj = { x: 0, y: 0, nx: 0, ny: 0 }
  function project(v, camera, width, height, horizonDot, camDist) {
    const R = SCENE_RADIUS
    const wx = v[0] * R
    const wy = v[1] * R
    const wz = v[2] * R
    const cp = camera.position
    // oltre l'orizzonte: nascosto dalla curvatura
    if ((wx * cp.x + wy * cp.y + wz * cp.z) / (R * camDist) < horizonDot) return null
    const e = camera.matrixWorldInverse.elements
    const pr = camera.projectionMatrix.elements
    const vx = e[0] * wx + e[4] * wy + e[8] * wz + e[12]
    const vy = e[1] * wx + e[5] * wy + e[9] * wz + e[13]
    const vz = e[2] * wx + e[6] * wy + e[10] * wz + e[14]
    if (vz >= -1e-3) return null
    const pz = -vz
    proj.nx = (pr[0] * vx + pr[8] * vz) / pz
    proj.ny = (pr[5] * vy + pr[9] * vz) / pz
    proj.x = (proj.nx * 0.5 + 0.5) * width
    proj.y = (0.5 - proj.ny * 0.5) * height
    return proj
  }

  /**
   * Sceglie l'ancora del nome dopo un giro completo della griglia.
   * Imposta it.t (bersaglio) e avvia scivolamento o dissolvenza se cambia.
   */
  function chooseAnchor(it, camera, width, height, horizonDot, camDist) {
    const id = it.n.id
    const inside = (q, f) => q && Math.abs(q.nx) < f && Math.abs(q.ny) < f

    // 1. centro della nazione, se ben inquadrato e sulla sua terra visibile
    const pc = project(it.center, camera, width, height, horizonDot, camDist)
    let want = null
    let wantIsCenter = false
    if (inside(pc, CENTER_INSIDE) && distAt(pc.nx, pc.ny, id) > 0) {
      want = it.center
      wantIsCenter = true
    } else if (bestDist[id] > 0) {
      // 2. punto più interno della parte visibile
      want = [bestXYZ[id * 3], bestXYZ[id * 3 + 1], bestXYZ[id * 3 + 2]]
    }
    if (!want) return

    // l'ancora attuale va ancora bene? (isteresi: niente cambi per poco)
    const pa = project(it.t, camera, width, height, horizonDot, camDist)
    if (it.tIsCenter && wantIsCenter) return
    if (!it.tIsCenter && !wantIsCenter && inside(pa, ANCHOR_INSIDE)) {
      const cur = distAt(pa.nx, pa.ny, id)
      if (cur > 0 && bestDist[id] < cur * SWITCH_RATIO + SWITCH_MARGIN) return
    }

    // cambio d'ancora: nuovo bersaglio; il nome ci arriva con la molla
    it.t = want.slice()
    it.tIsCenter = wantIsCenter
    it.isCenter = wantIsCenter
    if (it.alpha < 0.03) {
      // invisibile: si salta subito
      it.p = want.slice()
      it.v[0] = it.v[1] = it.v[2] = 0
      it.swapping = false
    }
  }

  /**
   * Molla smorzata criticamente (sulla sfera) dal punto del nome al bersaglio:
   * posizione E velocità continue, quindi niente scatti anche quando il
   * bersaglio cambia di colpo. Passi brevi per stabilità.
   */
  function springStep(it, dt) {
    const w = SPRING
    let rest = Math.min(dt, 0.25)
    while (rest > 1e-6) {
      const h = Math.min(rest, 1 / 60)
      rest -= h
      for (let k = 0; k < 3; k++) {
        const a = w * w * (it.t[k] - it.p[k]) - 2 * w * it.v[k]
        it.v[k] += a * h
        it.p[k] += it.v[k] * h
      }
      const l = Math.hypot(it.p[0], it.p[1], it.p[2]) || 1
      it.p[0] /= l
      it.p[1] /= l
      it.p[2] /= l
      // velocità tangente alla sfera
      const vr = it.v[0] * it.p[0] + it.v[1] * it.p[1] + it.v[2] * it.p[2]
      it.v[0] -= vr * it.p[0]
      it.v[1] -= vr * it.p[1]
      it.v[2] -= vr * it.p[2]
    }
  }

  const placedBoxes = items.map(() => ({ x: 0, y: 0, hw: 0, hh: 0 }))
  const visible = []
  let lastGeneration = -1

  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} altitudeKm
   * @param {number} width larghezza della vista (px CSS)
   * @param {number} height altezza della vista (px CSS)
   * @param {number} dt secondi dall'ultimo frame
   */
  function update(camera, altitudeKm, width, height, dt) {
    if (!(width > 0) || !(height > 0)) return
    // compaiono sotto i ~7000 km, scompaiono vicino al suolo
    // (smoothstep di three.js vuole min < max: si inverte a mano)
    const far = 1 - THREE.MathUtils.smoothstep(altitudeKm, 3500, 7000)
    const near = THREE.MathUtils.smoothstep(altitudeKm, 25, 70)
    const global = far * near
    if (global > 0.01) {
      scanStep(camera, width, height)
    } else {
      row = 0
      scanned = false
      pubCols = 0
      cellCount.fill(0)
    }

    const camDist = camera.position.length() || 1
    const horizonDot = SCENE_RADIUS / camDist - 0.002
    const freshScan = generation !== lastGeneration
    lastGeneration = generation

    visible.length = 0
    for (const it of items) {
      const id = it.n.id
      const cells = scanned ? cellCount[id] : 0
      it.cells = cells
      it.seen = global > 0.01 && cells >= (it.seen ? KEEP_CELLS : MIN_CELLS)
      if (!it.seen) {
        it.target = 0
        continue
      }
      if (freshScan) chooseAnchor(it, camera, width, height, horizonDot, camDist)

      // ancora: segue il bersaglio con la molla; se era finita fuori
      // dall'inquadratura (movimento rapido) salta quando il nome è sparito
      if (it.swapping && it.alpha < 0.03) {
        it.p = it.t.slice()
        it.v[0] = it.v[1] = it.v[2] = 0
        it.swapping = false
      } else {
        springStep(it, dt)
      }

      // posizione a schermo: proiezione esatta dell'ancora
      const pp = project(it.p, camera, width, height, horizonDot, camDist)
      if (!pp || pp.x < -20 || pp.x > width + 20 || pp.y < -20 || pp.y > height + 20) {
        // ancora fuori dall'inquadratura (movimento rapido): si nasconde e si
        // salta al bersaglio appena il nome è sparito
        it.target = 0
        it.swapping = true
        continue
      }
      if (!it.w) {
        it.w = it.el.offsetWidth
        it.h = it.el.offsetHeight
      }
      const hw = it.w * 0.5 + MARGIN
      const hh = it.h * 0.5 + MARGIN
      it.x = Math.min(Math.max(pp.x, hw), width - hw)
      it.y = Math.min(Math.max(pp.y, hh), height - hh)

      it.target = it.swapping ? 0 : Math.min(1, cells / 6) * global
      if (it.target > 0.01) visible.push(it)
    }

    // niente nomi sovrapposti: vince quello con più terra visibile (poi la
    // nazione più estesa); un nome già visibile ha la precedenza, così due
    // nomi vicini non lampeggiano scambiandosi il posto
    let keep = 0
    const prio = (it) => it.cells * (it.alpha > 0.5 ? 1.6 : 1)
    visible.sort((a, b) => prio(b) - prio(a) || b.n.share - a.n.share)
    for (const it of visible) {
      const hw = it.w * 0.5 + 6
      const hh = it.h * 0.5 + 4
      let clash = false
      for (let k = 0; k < keep; k++) {
        const o = placedBoxes[k]
        if (Math.abs(it.x - o.x) < hw + o.hw && Math.abs(it.y - o.y) < hh + o.hh) {
          clash = true
          break
        }
      }
      if (clash) {
        it.target = 0
      } else {
        const b = placedBoxes[keep++]
        b.x = it.x
        b.y = it.y
        b.hw = hw
        b.hh = hh
      }
    }

    // opacità e scrittura nel DOM (solo se qualcosa è cambiato)
    const kIn = 1 - Math.exp(-dt * 5)
    const kOut = 1 - Math.exp(-dt * 12)
    for (const it of items) {
      const k = it.target > it.alpha ? kIn : kOut
      it.alpha += (it.target - it.alpha) * k
      if (it.target === 0 && it.alpha < 0.012) it.alpha = 0
      if (it.alpha < 0.012) {
        if (it.lastOpacity !== '0') {
          it.el.style.opacity = '0'
          it.lastOpacity = '0'
        }
        continue
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
        id: it.n.id,
        x: it.x,
        y: it.y,
        p: it.p.slice(),
        center: it.center.slice(),
        isCenter: it.isCenter,
        cells: it.cells,
        target: it.target,
        alpha: it.alpha,
        size: it.size
      }))
  }
}
