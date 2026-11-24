// Effetti delle eruzioni, disegnati sopra l'immagine 3D (prima della
// post-produzione di fx.js, così prendono bagliore e sfocatura):
//  - volcanoGlow: ogni vulcano del pianeta si accende come un punto di fuoco
//    (visibile anche dallo spazio), uno dopo l'altro in una cascata rapida
//    mentre il parametro sale da 0 a 1;
//  - plume: colonna di fumo e cenere sul vulcano indicato da fx.plumeAt
//    ([lat, lon], o il più vicino al centro dell'inquadratura), con la base
//    accesa dalla lava e una fontana di lapilli incandescenti;
//  - ash: cenere che cade lenta e obliqua su tutta l'inquadratura.
// Le posizioni vengono proiettate con la camera della scena: gli effetti
// restano appoggiati ai vulcani mentre la camera si muove.

import * as THREE from 'three'
import { SCENE_RADIUS } from '../planet/constants.js'

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sprite(stops) {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  for (const [o, col] of stops) gr.addColorStop(o, col)
  g.fillStyle = gr
  g.fillRect(0, 0, 128, 128)
  return c
}

const smooth = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}
const frac = (x) => x - Math.floor(x)
const DEG = Math.PI / 180

export function createEruption(planet) {
  const r = rng(4242)
  const fire = sprite([
    [0, 'rgba(255,250,220,1)'],
    [0.15, 'rgba(255,200,90,0.9)'],
    [0.4, 'rgba(255,90,20,0.35)'],
    [1, 'rgba(120,20,0,0)']
  ])
  const smoke = sprite([
    [0, 'rgba(46,40,38,0.95)'],
    [0.55, 'rgba(40,35,34,0.55)'],
    [1, 'rgba(30,26,25,0)']
  ])
  const litSmoke = sprite([
    [0, 'rgba(255,120,40,0.8)'],
    [0.5, 'rgba(200,60,20,0.3)'],
    [1, 'rgba(120,20,0,0)']
  ])
  const spark = sprite([
    [0, 'rgba(255,240,200,1)'],
    [0.3, 'rgba(255,140,40,0.7)'],
    [1, 'rgba(255,60,0,0)']
  ])
  const ashFlake = sprite([
    [0, 'rgba(190,182,176,0.9)'],
    [0.5, 'rgba(150,142,136,0.45)'],
    [1, 'rgba(120,112,106,0)']
  ])

  // ritardo di accensione di ogni vulcano (cascata) e sfarfallio
  const volc = planet.volcanoes.map((v) => ({ v, th: r() * 0.55, ph: r() * 6.28, fl: 2 + r() * 4 }))
  const puffs = Array.from({ length: 90 }, (_, i) => ({ o: i / 90 + r() * 0.01, side: r() * 2 - 1, s: 0.6 + r() * 0.8, rot: r() }))
  const sparks = Array.from({ length: 110 }, () => ({ o: r(), vx: (r() * 2 - 1) * 0.35, vy: 0.55 + r() * 0.6, s: 0.5 + r() }))
  const ash = Array.from({ length: 260 }, () => ({ x: r(), y: r(), z: r(), ph: r() * 6.28, sp: 0.5 + r() }))

  const _p = new THREE.Vector3()
  const _v = new THREE.Vector3()

  /** Proiezione di un punto del mondo: { x, y } in px, null se dietro la camera. */
  function project(camera, W, H, x, y, z) {
    _p.set(x, y, z)
    _v.copy(_p).applyMatrix4(camera.matrixWorldInverse)
    if (_v.z > -1e-3) return null
    _p.project(camera)
    return { x: (_p.x * 0.5 + 0.5) * W, y: (0.5 - _p.y * 0.5) * H, dist: -_v.z }
  }

  /** Pixel per km a una certa distanza dalla camera. */
  function pxPerKm(camera, H, dist) {
    return H / (2 * Math.tan((camera.fov * DEG) / 2) * dist)
  }

  function nearestVolcano(lat, lon) {
    const c = Math.cos(lat * DEG)
    const x = c * Math.cos(lon * DEG)
    const y = Math.sin(lat * DEG)
    const z = -c * Math.sin(lon * DEG)
    let best = null
    let bd = -2
    for (const v of planet.volcanoes) {
      const d = v.x * x + v.y * y + v.z * z
      if (d > bd) {
        bd = d
        best = v
      }
    }
    return best
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} t secondi
   * @param {object} p parametri da evalFx (volcanoGlow, plume, ash, plumeAt)
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} exag esagerazione del rilievo attuale
   */
  function draw(ctx, t, p, camera, exag) {
    const W = ctx.canvas.width
    const H = ctx.canvas.height
    const unit = H / 1920
    const cam = camera.position
    const R = SCENE_RADIUS
    ctx.save()

    // ------------------------------------------- vulcani che si accendono
    if (p.volcanoGlow > 0.005) {
      ctx.globalCompositeOperation = 'lighter'
      for (const it of volc) {
        const v = it.v
        const k = smooth(it.th, it.th + 0.25, p.volcanoGlow)
        if (k < 0.005) continue
        const top = R + (v.H / 1000) * exag
        // visibile solo sull'emisfero rivolto alla camera
        if (v.x * cam.x + v.y * cam.y + v.z * cam.z < R * 1.0005) continue
        const q = project(camera, W, H, v.x * top, v.y * top, v.z * top)
        if (!q) continue
        const ppk = pxPerKm(camera, H, q.dist)
        const flick = 0.8 + 0.2 * Math.sin(t * it.fl + it.ph)
        const size = Math.min(Math.max(v.r * R * 5 * ppk, 34 * unit), 320 * unit) * (0.7 + 0.5 * k) * flick
        ctx.globalAlpha = Math.min(1, k * (v.lava ? 1 : 0.75))
        ctx.drawImage(fire, q.x - size / 2, q.y - size / 2, size, size)
        // alone largo
        ctx.globalAlpha = Math.min(1, k * 0.45)
        const s2 = size * 3.4
        ctx.drawImage(fire, q.x - s2 / 2, q.y - s2 / 2, s2, s2)
      }
    }

    // -------------------------------------------- pennacchio di un vulcano
    if (p.plume > 0.005) {
      const at = p.plumeAt || [0, 0]
      const v = nearestVolcano(at[0], at[1])
      if (v) {
        const top = R + (v.H / 1000) * exag
        const base = project(camera, W, H, v.x * top, v.y * top, v.z * top)
        // altezza del pennacchio: ~45 km "esagerati" sopra il cratere
        const hk = top + 45 * Math.max(exag, 1) * 0.6
        const tip = project(camera, W, H, v.x * hk, v.y * hk, v.z * hk)
        if (base && tip) {
          const ax = tip.x - base.x
          const ay = tip.y - base.y
          const len = Math.hypot(ax, ay) * p.plume
          const ux = ax / (Math.hypot(ax, ay) || 1)
          const uy = ay / (Math.hypot(ax, ay) || 1)
          const nx = -uy
          const ny = ux
          const width = Math.max(len * 0.32, 24 * unit)
          // fumo: sbuffi che salgono, si allargano e si spostano col vento
          ctx.globalCompositeOperation = 'source-over'
          for (const pf of puffs) {
            const ph = frac(t * 0.09 + pf.o)
            const s = Math.pow(ph, 0.75)
            const spread = width * (0.35 + 1.6 * s) * pf.s
            const drift = len * 0.35 * s * s
            const px = base.x + ux * len * s + nx * (pf.side * spread * 0.45 + drift)
            const py = base.y + uy * len * s + ny * (pf.side * spread * 0.45 + drift)
            const size = spread * (0.9 + 0.4 * pf.s)
            const a = smooth(0, 0.08, ph) * (1 - smooth(0.7, 1, ph)) * 0.75 * Math.min(1, p.plume * 1.4)
            if (a < 0.01) continue
            ctx.globalAlpha = a
            ctx.drawImage(smoke, px - size / 2, py - size / 2, size, size)
          }
          // base del pennacchio accesa dalla lava
          ctx.globalCompositeOperation = 'lighter'
          for (const pf of puffs) {
            const ph = frac(t * 0.09 + pf.o)
            if (ph > 0.35) continue
            const s = Math.pow(ph, 0.75)
            const spread = width * (0.35 + 1.6 * s) * pf.s
            const px = base.x + ux * len * s + nx * pf.side * spread * 0.45
            const py = base.y + uy * len * s + ny * pf.side * spread * 0.45
            const size = spread * 1.1
            ctx.globalAlpha = (1 - ph / 0.35) * 0.45 * Math.min(1, p.plume * 1.4)
            ctx.drawImage(litSmoke, px - size / 2, py - size / 2, size, size)
          }
          // fontana di lapilli: traiettorie paraboliche dal cratere
          for (const sp of sparks) {
            const ph = frac(t * 0.55 + sp.o)
            const tt = ph * 1.6
            const sx = sp.vx * tt
            const sy = sp.vy * tt - 0.5 * 0.9 * tt * tt
            if (sy < -0.05) continue
            const px = base.x + (ux * sy + nx * sx) * len * 0.45
            const py = base.y + (uy * sy + ny * sx) * len * 0.45
            const size = (6 + 10 * sp.s) * unit * Math.max(0.5, Math.min(2.5, len / (600 * unit)))
            ctx.globalAlpha = (1 - ph) * Math.min(1, p.plume * 1.4)
            ctx.drawImage(spark, px - size / 2, py - size / 2, size, size)
          }
          // bagliore del cratere
          const g = width * 2.2
          ctx.globalAlpha = 0.6 * Math.min(1, p.plume * 1.4)
          ctx.drawImage(fire, base.x - g / 2, base.y - g / 2, g, g)
        }
      }
    }

    // ------------------------------------------------------ cenere che cade
    if (p.ash > 0.005) {
      ctx.globalCompositeOperation = 'source-over'
      for (const a of ash) {
        const y = frac(a.y + t * 0.025 * a.sp * (0.4 + a.z))
        const x = frac(a.x + t * 0.012 * (0.4 + a.z) + Math.sin(t * 0.7 * a.sp + a.ph) * 0.01)
        const near = a.z > 0.8
        const size = (near ? 24 + 40 * a.z : 5 + 13 * a.z) * unit
        ctx.globalAlpha = Math.min(1, p.ash * (near ? 0.25 : 0.35 + 0.45 * a.z))
        ctx.drawImage(ashFlake, x * W - size / 2, y * H - size / 2, size, size)
      }
    }
    ctx.restore()
  }

  return { draw }
}
