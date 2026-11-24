// Particelle in sovrimpressione all'immagine 3D, prima degli effetti (così
// prendono bagliore e sfocatura come il resto della scena):
//  - pulviscolo dorato: granelli che fluttuano lenti a diverse profondità,
//    i più vicini grandi e sfocati (bokeh), con un leggero scintillio;
//  - braci: scintille arancioni che salgono tremolando (scene di fuoco).
// Posizioni funzione solo del tempo: deterministiche e ripetibili.

function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sprite(inner, outer) {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, inner)
  gr.addColorStop(0.25, outer)
  gr.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  return c
}

const frac = (x) => x - Math.floor(x)

export function createParticles(seed = 1307) {
  const r = rng(seed)
  const dust = []
  for (let i = 0; i < 150; i++) {
    const z = r() // profondità: 0 lontano, 1 vicinissimo
    dust.push({ x: r(), y: r(), z: z * z, ph: r() * 6.283, sp: 0.4 + r() * 0.8, tw: 0.5 + r() * 2 })
  }
  const embers = []
  for (let i = 0; i < 110; i++) {
    embers.push({ x: r(), y: r(), z: r(), ph: r() * 6.283, sp: 0.6 + r() * 1.0, fl: 3 + r() * 6 })
  }
  const gold = sprite('rgba(255,246,220,1)', 'rgba(255,214,140,0.45)')
  const ember = sprite('rgba(255,236,190,1)', 'rgba(255,120,40,0.55)')

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} t secondi
   * @param {{ dust: number, embers: number }} amt intensità (0..1+)
   */
  function draw(ctx, t, amt) {
    const W = ctx.canvas.width
    const H = ctx.canvas.height
    const unit = H / 1920
    ctx.save()
    ctx.globalCompositeOperation = 'lighter'
    if (amt.dust > 0.005) {
      for (const p of dust) {
        // salita lentissima, ondeggiamento laterale, parallasse con la profondità
        const y = frac(p.y - t * 0.006 * p.sp * (0.3 + p.z))
        const x = frac(p.x + Math.sin(t * 0.25 * p.sp + p.ph) * 0.015 * (0.3 + p.z) + t * 0.002 * p.z)
        const twinkle = 0.55 + 0.45 * Math.sin(t * p.tw + p.ph)
        const bokeh = p.z > 0.7
        const size = (bokeh ? 26 + 50 * p.z : 3 + 10 * p.z) * unit
        const a = amt.dust * (bokeh ? 0.07 : 0.22 + 0.5 * p.z) * twinkle
        if (a < 0.004) continue
        ctx.globalAlpha = Math.min(a, 1)
        ctx.drawImage(gold, x * W - size / 2, y * H - size / 2, size, size)
      }
    }
    if (amt.embers > 0.005) {
      for (const p of embers) {
        const y = frac(p.y - t * 0.05 * p.sp * (0.5 + p.z))
        const x = frac(p.x + Math.sin(t * 0.9 * p.sp + p.ph) * 0.03 + Math.sin(t * 0.21 + p.ph) * 0.02)
        const flick = 0.5 + 0.5 * Math.sin(t * p.fl + p.ph * 3)
        // si spengono salendo
        const life = Math.min(1, y * 1.6)
        const size = (4 + 14 * p.z) * unit
        const a = amt.embers * (0.35 + 0.65 * flick) * life
        if (a < 0.004) continue
        ctx.globalAlpha = Math.min(a, 1)
        ctx.drawImage(ember, x * W - size / 2, y * H - size / 2, size, size)
      }
    }
    ctx.restore()
  }

  return { draw }
}
