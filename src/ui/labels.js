// Etichette delle nazioni: nomi in sovrimpressione (HTML).
//
// Il nome di una nazione va al centro della sua parte VISIBILE, non del suo
// baricentro: da vicino il baricentro è quasi sempre fuori schermo. Ogni
// pochi frame si lancia una griglia di raggi dallo schermo verso il pianeta,
// si guarda a quale nazione appartiene ogni punto di terraferma colpito e si
// fa la media delle posizioni a schermo per nazione. Le etichette scivolano
// con dolcezza verso la nuova posizione.
//
// Compaiono avvicinandosi: dallo spazio sono nascoste, sotto i ~7000 km di
// quota sfumano in vista.

import * as THREE from 'three'
import { SCENE_RADIUS } from '../planet/constants.js'
import { Planet } from '../planet/planet.js'

const GRID_X = 18
const GRID_Y = 14
const UPDATE_EVERY = 6 // frame
const MIN_HITS = 3 // punti della griglia necessari per mostrare il nome

const _ray = new THREE.Raycaster()
const _ndc = new THREE.Vector2()
const _hit = new THREE.Vector3()
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
    return { n, el, x: 0, y: 0, tx: 0, ty: 0, alpha: 0, target: 0, placed: false }
  })

  const sumX = new Float64Array(items.length)
  const sumY = new Float64Array(items.length)
  const hits = new Int32Array(items.length)
  let frame = 0

  /** Campiona lo schermo e aggiorna posizione e visibilità desiderate. */
  function scan(camera, width, height) {
    sumX.fill(0)
    sumY.fill(0)
    hits.fill(0)
    for (let gy = 0; gy < GRID_Y; gy++) {
      for (let gx = 0; gx < GRID_X; gx++) {
        const sx = (gx + 0.5) / GRID_X
        const sy = (gy + 0.5) / GRID_Y
        _ndc.set(sx * 2 - 1, -(sy * 2 - 1))
        _ray.setFromCamera(_ndc, camera)
        if (!_ray.ray.intersectSphere(_sphere, _hit)) continue
        _hit.normalize()
        planet.sample(_hit.x, _hit.y, _hit.z, 1, sample)
        // solo terraferma (laghi e fiumi compresi: fanno parte dello stato)
        if (sample.height < 0) continue
        const id = nations.idAt(_hit.x, _hit.y, _hit.z)
        sumX[id] += sx * width
        sumY[id] += sy * height
        hits[id]++
      }
    }
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (hits[i] >= MIN_HITS) {
        it.tx = sumX[i] / hits[i]
        it.ty = sumY[i] / hits[i]
        // più punti visibili = nome più deciso
        it.target = Math.min(1, hits[i] / 10)
        if (!it.placed) {
          it.x = it.tx
          it.y = it.ty
          it.placed = true
        }
      } else {
        it.target = 0
      }
    }
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
    if (global > 0.01 && frame++ % UPDATE_EVERY === 0) scan(camera, width, height)

    const k = 1 - Math.exp(-dt * 6)
    for (const it of items) {
      const want = global > 0.01 ? it.target * global : 0
      it.alpha += (want - it.alpha) * k
      if (it.alpha < 0.01) {
        if (it.el.style.opacity !== '0') it.el.style.opacity = '0'
        if (want === 0) it.placed = false
        continue
      }
      it.x += (it.tx - it.x) * k
      it.y += (it.ty - it.y) * k
      it.el.style.transform = `translate(-50%, -50%) translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`
      it.el.style.opacity = it.alpha.toFixed(3)
    }
  }

  return { update }
}
