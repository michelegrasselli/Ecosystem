// Etichette delle nazioni: nomi in sovrimpressione (HTML).
//
// Dove va il nome:
//  1. se il "centro visivo" della nazione (il punto più interno, lontano da
//     confini e costa: Nations.center) è ben dentro l'inquadratura, il nome sta
//     lì, al centro della regione;
//  2. altrimenti (zoom su una parte della nazione) il nome va al centro della
//     parte VISIBILE della nazione, così resta nell'inquadratura e segue lo
//     zoom. Zoomando su un confine si vedono quindi entrambi i nomi, ognuno
//     dal proprio lato.
//
// Il nome è appoggiato a un punto del terreno: la posizione a schermo è la
// proiezione esatta di quel punto, ogni frame, quindi si muove con il terreno
// durante pan e zoom. Quando il punto bersaglio cambia (da centro della
// regione a centro della parte visibile, o perché la parte visibile cambia),
// il punto scivola con dolcezza sulla sfera verso quello nuovo.
//
// La parte visibile si misura con una griglia di raggi lanciata dallo schermo
// (spalmata su più frame). I nomi compaiono sotto i ~7000 km di quota e
// scompaiono quando si è molto vicini al suolo (sotto ~40 km), dove la
// nazione riempie tutto lo schermo e il nome non aiuta più.

import * as THREE from 'three'
import { SCENE_RADIUS } from '../planet/constants.js'
import { Planet } from '../planet/planet.js'

const GRID_X = 16
const GRID_Y = 12
// righe della griglia analizzate per frame: il giro completo dura ~3 frame
const ROWS_PER_FRAME = 4
const MIN_HITS = 3 // raggi necessari per far comparire il nome
const KEEP_HITS = 1 // raggi sufficienti per non farlo sparire (isteresi)
// il centro della regione si usa finché sta in questa frazione dello schermo
const CENTER_INSIDE = 0.78
// margine dai bordi dello schermo per il nome (px)
const MARGIN = 10
// velocità con cui il punto del nome scivola verso il nuovo bersaglio (1/s)
const GLIDE = 2.6

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
    const size = 11 + Math.min(Math.sqrt(n.share) * 22, 6)
    el.style.fontSize = size.toFixed(1) + 'px'
    const c = n.center || n.anchor
    return {
      n,
      el,
      center: [c[0], c[1], c[2]],
      // punto del terreno a cui è appoggiato il nome (versore) e bersaglio
      p: [c[0], c[1], c[2]],
      t: [c[0], c[1], c[2]],
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

  // griglia: conteggi e centroidi della parte visibile, per nazione
  const accHits = new Int32Array(N)
  const accSum = new Float64Array(N * 3)
  const hits = new Int32Array(N)
  const vis = new Float64Array(N * 3) // centro della parte visibile (versore)
  // singoli punti colpiti nel giro, per riportare il centroide sulla terra
  // della nazione quando cade fuori (nazioni a mezzaluna, golfi)
  const ptId = new Int32Array(GRID_X * GRID_Y)
  const ptXYZ = new Float64Array(GRID_X * GRID_Y * 3)
  let nPts = 0
  let row = 0

  function scanRows(camera) {
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
        accSum[id * 3] += _hit.x
        accSum[id * 3 + 1] += _hit.y
        accSum[id * 3 + 2] += _hit.z
        ptId[nPts] = id
        ptXYZ[nPts * 3] = _hit.x
        ptXYZ[nPts * 3 + 1] = _hit.y
        ptXYZ[nPts * 3 + 2] = _hit.z
        nPts++
      }
    }
    if (row < GRID_Y) return

    // giro completo: si pubblicano conteggi e centri della parte visibile
    row = 0
    hits.set(accHits)
    for (let id = 0; id < N; id++) {
      if (!accHits[id]) continue
      let x = accSum[id * 3]
      let y = accSum[id * 3 + 1]
      let z = accSum[id * 3 + 2]
      const l = Math.hypot(x, y, z) || 1
      x /= l
      y /= l
      z /= l
      // il centroide deve stare sulla terra della nazione: se no, si prende
      // il punto colpito più vicino al centroide
      planet.sample(x, y, z, 1, sample)
      if (sample.height < 0 || nations.idAt(x, y, z) !== id) {
        let bd = -2
        for (let k = 0; k < nPts; k++) {
          if (ptId[k] !== id) continue
          const d = ptXYZ[k * 3] * x + ptXYZ[k * 3 + 1] * y + ptXYZ[k * 3 + 2] * z
          if (d > bd) {
            bd = d
            vis[id * 3] = ptXYZ[k * 3]
            vis[id * 3 + 1] = ptXYZ[k * 3 + 1]
            vis[id * 3 + 2] = ptXYZ[k * 3 + 2]
          }
        }
      } else {
        vis[id * 3] = x
        vis[id * 3 + 1] = y
        vis[id * 3 + 2] = z
      }
    }
    accHits.fill(0)
    accSum.fill(0)
    nPts = 0
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

  const placedBoxes = items.map(() => ({ x: 0, y: 0, hw: 0, hh: 0 }))
  const visible = []

  /**
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} altitudeKm
   * @param {number} width larghezza della vista (px CSS)
   * @param {number} height altezza della vista (px CSS)
   * @param {number} dt secondi dall'ultimo frame
   */
  function update(camera, altitudeKm, width, height, dt) {
    // compaiono sotto i ~7000 km, scompaiono vicino al suolo
    // (smoothstep di three.js vuole min < max: si inverte a mano)
    const far = 1 - THREE.MathUtils.smoothstep(altitudeKm, 3500, 7000)
    const near = THREE.MathUtils.smoothstep(altitudeKm, 25, 70)
    const global = far * near
    if (global > 0.01) {
      scanRows(camera)
    } else {
      row = 0
      nPts = 0
      accHits.fill(0)
      accSum.fill(0)
    }
    if (!(width > 0) || !(height > 0)) return

    const camDist = camera.position.length() || 1
    const horizonDot = SCENE_RADIUS / camDist - 0.002
    const kGlide = 1 - Math.exp(-dt * GLIDE)

    visible.length = 0
    for (const it of items) {
      const id = it.n.id
      const h = hits[id]
      it.seen = global > 0.01 && h >= (it.seen ? KEEP_HITS : MIN_HITS)
      if (!it.seen) {
        it.target = 0
        continue
      }

      // 1. bersaglio: centro della regione se ben inquadrato, altrimenti
      //    centro della parte visibile
      const pc = project(it.center, camera, width, height, horizonDot, camDist)
      if (pc && Math.abs(pc.nx) < CENTER_INSIDE && Math.abs(pc.ny) < CENTER_INSIDE) {
        it.t[0] = it.center[0]
        it.t[1] = it.center[1]
        it.t[2] = it.center[2]
      } else {
        it.t[0] = vis[id * 3]
        it.t[1] = vis[id * 3 + 1]
        it.t[2] = vis[id * 3 + 2]
      }

      // 2. il punto del nome scivola sulla sfera verso il bersaglio (subito,
      //    se il nome era invisibile: nessuno scivolamento a vista)
      const k = it.alpha < 0.02 ? 1 : kGlide
      let px = it.p[0] + (it.t[0] - it.p[0]) * k
      let py = it.p[1] + (it.t[1] - it.p[1]) * k
      let pz = it.p[2] + (it.t[2] - it.p[2]) * k
      const l = Math.hypot(px, py, pz) || 1
      it.p[0] = px / l
      it.p[1] = py / l
      it.p[2] = pz / l

      // 3. posizione a schermo: proiezione esatta del punto, tenuta dentro
      //    l'inquadratura (durante lo scivolamento il punto può essere appena fuori)
      let pp = project(it.p, camera, width, height, horizonDot, camDist)
      const off = (q) => !q || q.x < 0 || q.x > width || q.y < 0 || q.y > height
      if (off(pp)) {
        // il punto è uscito dall'inquadratura (salto della camera, zoom
        // rapido): niente nome trascinato lungo il bordo, si salta subito
        // al bersaglio, che per costruzione è inquadrato
        it.p[0] = it.t[0]
        it.p[1] = it.t[1]
        it.p[2] = it.t[2]
        pp = project(it.p, camera, width, height, horizonDot, camDist)
      }
      if (off(pp)) {
        it.target = 0
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

      it.target = Math.min(1, h / 8) * global
      if (it.target > 0.01) visible.push(it)
    }

    // 4. niente nomi sovrapposti: vince quello con più terra visibile (poi la
    //    nazione più estesa). Gli altri sfumano, invece di accavallarsi.
    let keep = 0
    visible.sort((a, b) => b.target - a.target || b.n.share - a.n.share)
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

    // 5. opacità e scrittura nel DOM (solo se qualcosa è cambiato)
    const kIn = 1 - Math.exp(-dt * 6)
    const kOut = 1 - Math.exp(-dt * 10)
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
        hits: hits[it.n.id],
        target: it.target,
        alpha: it.alpha
      }))
  }
}
