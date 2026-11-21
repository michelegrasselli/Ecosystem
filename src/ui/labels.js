// Etichette delle nazioni: nomi in sovrimpressione (HTML).
//
// Il nome è INCHIODATO al terreno. Ogni nazione ha un insieme fitto di ancore
// fisse sul proprio territorio (un campione ogni ~145 km, calcolati una volta
// sola in nations.js): l'etichetta si appoggia a una di queste e la sua
// posizione a schermo è SOLO la proiezione di quel punto.
//
// Regole che tengono fermo il nome (le versioni precedenti lo facevano
// "galleggiare" sul terreno):
//
//  1. Nessuna compressione verso il centro dello schermo e nessun inseguimento
//     smorzato: la posizione è esattamente quella proiettata, ogni frame. Il
//     nome si muove con il terreno, senza ritardo.
//  2. L'ancora scelta non cambia MAI mentre il nome è visibile (cambierebbe di
//     colpo posizione). Se l'ancora esce dall'inquadratura il nome sfuma — è
//     uscito il terreno su cui era appoggiato — e solo quando è del tutto
//     invisibile se ne sceglie un'altra. Così si vede sempre un nome fermo, mai
//     uno che scivola da un punto all'altro.
//  3. Isteresi sul numero di raggi che colpiscono la nazione: il nome non
//     lampeggia quando la nazione è al margine della vista.
//  4. Le ancore sono fitte, così a ogni quota (tranne il volo radente) ce n'è
//     una inquadrata: il nome non sparisce appena si scende sotto i 1000 km.
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
const MIN_HITS = 3 // raggi necessari per far comparire il nome
const KEEP_HITS = 1 // raggi sufficienti per non farlo sparire (isteresi)

// Bordo dell'inquadratura, come frazione della semilarghezza dello schermo:
// da EDGE_FADE in poi il nome sfuma, oltre EDGE_DROP l'ancora è fuori e si
// riancorerà quando il nome sarà invisibile.
const EDGE_FADE = 0.9
const EDGE_DROP = 1.02

// Cono di vista (coseno): un'ancora più larga di così è comunque fuori
// inquadratura, quindi si può scartare senza proiettarla. 48° coprono con
// margine l'angolo del rettangolo di visione (max ~40° sulla diagonale).
const CONE_COS = Math.cos((48 * Math.PI) / 180)

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
    const flat = n.labelPoints
    const count = flat.length / 3
    return {
      n,
      el,
      flat,
      count,
      scrX: new Float64Array(count),
      scrY: new Float64Array(count),
      score: new Float64Array(count),
      valid: new Uint8Array(count),
      cand: -1, // ancora in uso (-1 = nessuna)
      best: -1, // miglior ancora visibile in questo frame
      bestScore: Infinity,
      seen: false,
      x: 0,
      y: 0,
      alpha: 0,
      target: 0,
      w: 0, // dimensioni stimate dell'etichetta (px), per evitare sovrapposizioni
      h: 0,
      lastTransform: '',
      lastOpacity: ''
    }
  })

  const hits = new Int32Array(items.length)
  const accHits = new Int32Array(items.length)
  const placedBoxes = items.map(() => ({ x: 0, y: 0, hw: 0, hh: 0 }))
  let row = 0
  const visible = [] // etichette da mostrare, riusato ogni frame

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
        accHits[nations.idAt(_hit.x, _hit.y, _hit.z)]++
      }
    }

    // giro completo: i conteggi diventano lo stato "ufficiale"
    if (row >= GRID_Y) {
      row = 0
      hits.set(accHits)
      accHits.fill(0)
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
    if (global > 0.01) {
      scanRows(camera, width, height)
    } else {
      row = 0
      accHits.fill(0)
    }

    const cx = width * 0.5
    const cy = height * 0.5
    if (!(cx > 0) || !(cy > 0)) return

    // matrici e parametri della camera, letti una volta sola
    const e = camera.matrixWorldInverse.elements
    const pr = camera.projectionMatrix.elements
    const mw = camera.matrixWorld.elements
    const fx = -mw[8]
    const fy = -mw[9]
    const fz = -mw[10]
    const cpx = camera.position.x
    const cpy = camera.position.y
    const cpz = camera.position.z
    const camDist = Math.hypot(cpx, cpy, cpz) || 1
    const horizon = SCENE_RADIUS / camDist - 0.002
    const invDist = 1 / (camDist * SCENE_RADIUS)
    const R = SCENE_RADIUS
    const invCx = 1 / cx
    const invCy = 1 / cy

    // 1. ancore: proiezione esatta, scelta solo quando il nome è invisibile
    visible.length = 0
    for (const it of items) {
      const flat = it.flat
      const count = it.count
      const scrX = it.scrX
      const scrY = it.scrY
      const score = it.score
      const valid = it.valid
      let best = -1
      let bestScore = Infinity

      // prima si scarta tutto ciò che è fuori dal cono di vista (economico),
      // poi si proietta solo quello che può davvero stare a schermo
      for (let k = 0; k < count; k++) {
        const j = k * 3
        const wx = flat[j] * R
        const wy = flat[j + 1] * R
        const wz = flat[j + 2] * R
        if ((wx * cpx + wy * cpy + wz * cpz) * invDist < horizon) {
          // oltre l'orizzonte: nascosto dalla curvatura
          valid[k] = 0
          score[k] = Infinity
          continue
        }
        // cono attorno all'asse di vista, misurato DALLA camera
        const dvx = wx - cpx
        const dvy = wy - cpy
        const dvz = wz - cpz
        const d2 = dvx * dvx + dvy * dvy + dvz * dvz
        if (dvx * fx + dvy * fy + dvz * fz < CONE_COS * Math.sqrt(d2)) {
          valid[k] = 0
          score[k] = Infinity
          continue
        }
        const vx = e[0] * wx + e[4] * wy + e[8] * wz + e[12]
        const vy = e[1] * wx + e[5] * wy + e[9] * wz + e[13]
        const vz = e[2] * wx + e[6] * wy + e[10] * wz + e[14]
        if (vz >= -1e-3) {
          valid[k] = 0
          score[k] = Infinity
          continue
        }
        const pz = -vz
        const sx = ((pr[0] * vx + pr[8] * vz) / pz * 0.5 + 0.5) * width
        const sy = (0.5 - (pr[5] * vy + pr[9] * vz) / pz * 0.5) * height
        // vicino al piano della camera la proiezione esplode: si scarta
        if (!(sx > -2e5) || !(sx < 2e5) || !(sy > -2e5) || !(sy < 2e5)) {
          valid[k] = 0
          score[k] = Infinity
          continue
        }
        scrX[k] = sx
        scrY[k] = sy
        valid[k] = 1
        const sc = Math.max(Math.abs((sx - cx) * invCx), Math.abs((sy - cy) * invCy))
        score[k] = sc
        if (sc < bestScore) {
          bestScore = sc
          best = k
        }
      }
      it.best = best
      it.bestScore = bestScore

      // isteresi sui raggi: non lampeggia al margine della vista
      const h = hits[it.n.id]
      it.seen = global > 0.01 && h >= (it.seen ? KEEP_HITS : MIN_HITS)

      // l'ancora in uso esce dall'inquadratura → si potrà cambiare, ma solo
      // quando il nome sarà del tutto invisibile (vedi sotto)
      if (it.cand >= 0 && !(it.valid[it.cand] && it.score[it.cand] <= EDGE_DROP)) {
        it.cand = -1
      }

      if (!it.seen) {
        it.cand = -1
        it.target = 0
        continue
      }

      if (it.cand < 0) {
        // riancoraggio: prima si sfuma, poi si riappare nel punto nuovo
        if (it.alpha > 0.02) {
          it.target = 0
          continue
        }
        it.cand = bestScore <= EDGE_DROP ? best : -1
        if (it.cand < 0) {
          it.target = 0
          continue
        }
        // posizione impostata ora che è invisibile: nessun salto a vista
        it.x = it.scrX[it.cand]
        it.y = it.scrY[it.cand]
        it.lastTransform = ''
      }

      // ancoraggio esatto: la posizione è la proiezione dell'ancora, senza
      // smorzamenti né compressioni verso il centro
      it.x = it.scrX[it.cand]
      it.y = it.scrY[it.cand]

      // sfuma solo negli ultimi punti percentuali verso il bordo, così il nome
      // "esce" con il terreno invece di sparire di colpo
      const edge =
        1 - THREE.MathUtils.smoothstep(it.score[it.cand], EDGE_FADE, EDGE_DROP)
      it.target = Math.min(1, h / 10) * global * edge
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
        if (Math.abs(it.x - o.x) < hw + o.hw && Math.abs(it.y - o.y) < hh + o.hh) {
          clash = true
          break
        }
      }
      if (clash) {
        it.target = 0
      } else {
        placedBoxes[keep].x = it.x
        placedBoxes[keep].y = it.y
        placedBoxes[keep].hw = hw
        placedBoxes[keep].hh = hh
        keep++
      }
    }

    // 3. opacità e scrittura nel DOM (solo se qualcosa è cambiato)
    const kIn = 1 - Math.exp(-dt * 7)
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

      // posizione esatta; 0.1 px basta a evitare aggiornamenti inutili
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
      items.map((it) => {
        const c = it.cand
        return {
          t: it.n.name,
          x: it.x,
          y: it.y,
          cand: c,
          best: it.best,
          bestScore: it.bestScore,
          score: c >= 0 ? it.score[c] : Infinity,
          point: c >= 0 ? [it.flat[c * 3], it.flat[c * 3 + 1], it.flat[c * 3 + 2]] : null,
          nPoints: it.count,
          hits: hits[it.n.id],
          target: it.target,
          alpha: it.alpha
        }
      })
  }
}
