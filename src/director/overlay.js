// Sovrimpressione dei fotogrammi: titoli, nomi dei regni, vignettatura e
// dissolvenze dal/al nero. Disegnata su un canvas 2D sopra l'immagine 3D,
// identica nell'anteprima e nel video.

const TITLE_FADE = 0.9 // secondi di dissolvenza dei titoli
export const TITLE_FONT = "'Cinzel', 'Trajan Pro', Georgia, 'Times New Roman', serif"
export const SUB_FONT = "'Cormorant Garamond', Georgia, 'Times New Roman', serif"

function smooth(a, b, x) {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
  return t * t * (3 - 2 * t)
}

/** Righe di testo che stanno nella larghezza data. */
function wrap(ctx, text, maxW) {
  const words = String(text).split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

/**
 * Disegna la sovrimpressione del tempo t.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} script sceneggiatura normalizzata
 * @param {number} t secondi
 * @param {Array} labels etichette dei regni [{ text, x, y, alpha, size }] in px del canvas
 */
export function drawOverlay(ctx, script, t, labels) {
  const W = ctx.canvas.width
  const H = ctx.canvas.height
  const unit = H / 1920 // le misure sono pensate per 1080x1920

  // vignettatura leggera: inquadratura più "da cinema" (con gli effetti la
  // fa già lo shader di fx.js)
  if (!script.fx) {
    const g = ctx.createRadialGradient(W / 2, H * 0.5, H * 0.28, W / 2, H * 0.5, H * 0.78)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.38)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  // nomi dei regni: sempre (true), mai (false) o in un intervallo { from, to }
  let labelsK = script.labels ? 1 : 0
  if (script.labels && typeof script.labels === 'object') {
    const lf = script.labels
    labelsK = smooth(lf.from ?? 0, (lf.from ?? 0) + TITLE_FADE, t) * (1 - smooth((lf.to ?? 1e9) - TITLE_FADE, lf.to ?? 1e9, t))
  }
  if (labelsK > 0.001 && labels) {
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const l of labels) {
      if (l.alpha < 0.02) continue
      const size = l.size * 1.9 * unit * 1.08
      ctx.font = `600 ${size.toFixed(1)}px ${TITLE_FONT}`
      ctx.letterSpacing = `${(size * 0.22).toFixed(1)}px`
      ctx.globalAlpha = l.alpha * labelsK
      ctx.shadowColor = 'rgba(20,16,12,0.9)'
      ctx.shadowBlur = 6 * unit
      ctx.fillStyle = 'rgba(250,246,236,0.96)'
      ctx.fillText(l.text.toUpperCase(), l.x, l.y)
    }
    ctx.restore()
  }

  // titoli
  for (const tt of script.titles) {
    if (t < tt.from || t > tt.to) continue
    const a = smooth(tt.from, tt.from + TITLE_FADE, t) * (1 - smooth(tt.to - TITLE_FADE, tt.to, t))
    if (a <= 0.001) continue
    ctx.save()
    ctx.globalAlpha = a
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    const size = 62 * unit * tt.size
    const subSize = 40 * unit * tt.size
    ctx.font = `600 ${size.toFixed(1)}px ${TITLE_FONT}`
    ctx.letterSpacing = `${(size * 0.12).toFixed(1)}px`
    const lines = tt.text ? wrap(ctx, tt.text, W * 0.82) : []
    ctx.font = `italic 500 ${subSize.toFixed(1)}px ${SUB_FONT}`
    ctx.letterSpacing = `${(subSize * 0.04).toFixed(1)}px`
    const subLines = tt.sub ? wrap(ctx, tt.sub, W * 0.8) : []
    const lh = size * 1.25
    const slh = subSize * 1.3
    const blockH = lines.length * lh + (subLines.length ? subSize * 0.6 + subLines.length * slh : 0)
    const cy = tt.pos === 'top' ? H * 0.16 : tt.pos === 'center' ? H * 0.47 : H * 0.8
    let y = cy - blockH / 2 + size
    // leggero salire durante la comparsa
    y += (1 - smooth(tt.from, tt.from + TITLE_FADE * 1.4, t)) * 14 * unit

    // titoli "epici" (non i sottotitoli): emergono da una sfocatura, la
    // spaziatura si stringe lentamente e un alone dorato pulsa piano
    const epic = !tt.caption && tt.epic !== false
    const reveal = epic ? smooth(tt.from, tt.from + (tt.reveal ?? 2.4), t) : 1
    const track = epic ? 0.12 + 0.16 * (1 - reveal) + 0.03 * smooth(tt.from, tt.to, t) : 0.12
    const blurPx = epic ? (1 - reveal) * 14 * unit : 0
    ctx.font = `600 ${size.toFixed(1)}px ${TITLE_FONT}`
    ctx.letterSpacing = `${(size * track).toFixed(1)}px`
    if (epic) {
      const y0 = y
      ctx.save()
      ctx.filter = `blur(${(blurPx + 10 * unit).toFixed(1)}px)`
      ctx.globalAlpha = a * (0.55 + 0.15 * Math.sin(t * 1.3))
      ctx.fillStyle = 'rgba(255,196,110,0.9)'
      for (const line of lines) {
        ctx.fillText(line, W / 2, y)
        y += lh
      }
      ctx.restore()
      y = y0
      if (blurPx > 0.2) ctx.filter = `blur(${blurPx.toFixed(1)}px)`
    }
    ctx.shadowColor = 'rgba(0,0,0,0.85)'
    ctx.shadowBlur = 18 * unit
    ctx.fillStyle = 'rgba(248,242,226,0.98)'
    for (const line of lines) {
      ctx.fillText(line, W / 2, y)
      y += lh
    }
    if (subLines.length) {
      y += subSize * 0.6 - lh + slh
      ctx.font = `italic 500 ${subSize.toFixed(1)}px ${SUB_FONT}`
      ctx.letterSpacing = `${(subSize * 0.04).toFixed(1)}px`
      ctx.fillStyle = 'rgba(232,222,198,0.95)'
      if (epic) ctx.globalAlpha = a * smooth(tt.from + 0.8, tt.from + 2.2, t)
      for (const line of subLines) {
        ctx.fillText(line, W / 2, y)
        y += slh
      }
    }
    ctx.restore()
  }

  // dissolvenze dal/al nero
  const fi = script.fade.in > 0 ? 1 - smooth(0, script.fade.in, t) : 0
  const fo = script.fade.out > 0 ? smooth(script.duration - script.fade.out, script.duration, t) : 0
  const f = Math.max(fi, fo)
  if (f > 0.001) {
    ctx.fillStyle = `rgba(0,0,0,${f.toFixed(3)})`
    ctx.fillRect(0, 0, W, H)
  }
}
