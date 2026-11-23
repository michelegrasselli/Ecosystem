// Sceneggiatura di un episodio e movimento della camera nel tempo.
//
// Una sceneggiatura (JSON, vedi episodes/) descrive:
//   - shots: punti chiave della camera nel tempo
//       { at: secondi, lat, lon, alt: km dal suolo, pitch: gradi (90 = zenit),
//         heading: gradi (0 = nord), cut: true per uno stacco netto }
//   - titles: testi in sovrimpressione { from, to, text, sub, pos, size }
//   - labels: true/false per i nomi dei regni, oppure { from, to } (secondi)
//   - fade: { in, out } dissolvenze dal/al nero, in secondi
//   - fps, width, height, duration
//
// Tra i punti chiave ogni canale (posizione sulla sfera, quota in scala
// logaritmica, inclinazione, orientamento) è interpolato con una cubica
// monotona (PCHIP): velocità continua, nessuna oscillazione oltre i punti
// chiave, partenza e arrivo da fermo. È il movimento "da drone" che rende bene
// in un video: niente scatti tra un'inquadratura e l'altra.

const DEG = Math.PI / 180

export const DEFAULT_SCRIPT = {
  name: 'untitled',
  fps: 30,
  width: 1080,
  height: 1920,
  fov: 50,
  labels: true,
  fade: { in: 1.2, out: 1.2 },
  shots: [],
  titles: []
}

/** Completa una sceneggiatura con i valori di default e la valida. */
export function normalizeScript(input) {
  const s = { ...DEFAULT_SCRIPT, ...input }
  s.fade = { ...DEFAULT_SCRIPT.fade, ...(input.fade || {}) }
  if (!Array.isArray(s.shots) || s.shots.length === 0) {
    throw new Error('the script needs at least one shot')
  }
  s.shots = s.shots
    .map((k, i) => {
      for (const f of ['at', 'lat', 'lon', 'alt']) {
        if (!Number.isFinite(k[f])) throw new Error(`shot ${i}: "${f}" is missing or not a number`)
      }
      return { pitch: 90, heading: 0, ...k }
    })
    .sort((a, b) => a.at - b.at)
  s.titles = (s.titles || []).map((t) => ({ pos: 'bottom', size: 1, ...t }))
  const lastShot = s.shots[s.shots.length - 1].at
  const lastTitle = s.titles.reduce((m, t) => Math.max(m, t.to || 0), 0)
  s.duration = Number.isFinite(input.duration) ? input.duration : Math.max(lastShot, lastTitle) + 0.5
  s.width = Math.round(s.width / 2) * 2
  s.height = Math.round(s.height / 2) * 2
  return s
}

/** Pendenze PCHIP (Fritsch-Carlson) con pendenza nulla agli estremi. */
function pchipSlopes(t, y) {
  const n = t.length
  const d = new Float64Array(n)
  if (n < 3) return d
  for (let i = 1; i < n - 1; i++) {
    const h0 = t[i] - t[i - 1]
    const h1 = t[i + 1] - t[i]
    const d0 = (y[i] - y[i - 1]) / h0
    const d1 = (y[i + 1] - y[i]) / h1
    if (d0 * d1 <= 0) {
      d[i] = 0
    } else {
      const w1 = 2 * h1 + h0
      const w2 = h1 + 2 * h0
      d[i] = (w1 + w2) / (w1 / d0 + w2 / d1)
    }
  }
  return d
}

function hermite(y0, y1, d0, d1, h, u) {
  const u2 = u * u
  const u3 = u2 * u
  return (
    (2 * u3 - 3 * u2 + 1) * y0 +
    (u3 - 2 * u2 + u) * h * d0 +
    (-2 * u3 + 3 * u2) * y1 +
    (u3 - u2) * h * d1
  )
}

/**
 * Prepara la valutazione della camera nel tempo.
 * Gli stacchi ("cut": true sul punto chiave) dividono la sceneggiatura in
 * segmenti indipendenti: niente interpolazione attraverso uno stacco.
 */
export function buildTimeline(script) {
  const keys = script.shots
  // segmenti separati dagli stacchi
  const segments = []
  let cur = []
  for (const k of keys) {
    if (k.cut && cur.length) {
      segments.push(cur)
      cur = []
    }
    cur.push(k)
  }
  segments.push(cur)

  const built = segments.map((seg) => {
    const t = seg.map((k) => k.at)
    // posizione come versore (niente problemi di salto della longitudine)
    const px = []
    const py = []
    const pz = []
    for (const k of seg) {
      const la = k.lat * DEG
      const lo = k.lon * DEG
      px.push(Math.cos(la) * Math.cos(lo))
      py.push(Math.sin(la))
      pz.push(-Math.cos(la) * Math.sin(lo))
    }
    const la = seg.map((k) => Math.log(Math.max(k.alt, 0.02)))
    const pi = seg.map((k) => k.pitch)
    // orientamento "srotolato": sempre la via più breve tra due punti chiave
    const he = []
    for (let i = 0; i < seg.length; i++) {
      let h = seg[i].heading
      if (i > 0) {
        const prev = he[i - 1]
        while (h - prev > 180) h -= 360
        while (h - prev < -180) h += 360
      }
      he.push(h)
    }
    const ch = [px, py, pz, la, pi, he]
    return { t, ch, slopes: ch.map((y) => pchipSlopes(t, y)) }
  })

  const out = { lat: 0, lon: 0, alt: 1000, pitch: 90, heading: 0 }

  /** Stato della camera al tempo t (secondi). */
  function evalAt(time) {
    // segmento attivo: l'ultimo che inizia prima di t
    let s = built[0]
    for (const b of built) if (time >= b.t[0]) s = b
    const t = s.t
    const n = t.length
    const v = [0, 0, 0, 0, 0, 0]
    if (n === 1 || time <= t[0]) {
      for (let c = 0; c < 6; c++) v[c] = s.ch[c][0]
    } else if (time >= t[n - 1]) {
      for (let c = 0; c < 6; c++) v[c] = s.ch[c][n - 1]
    } else {
      let i = 0
      while (i < n - 2 && time > t[i + 1]) i++
      const h = t[i + 1] - t[i]
      const u = h > 0 ? (time - t[i]) / h : 1
      for (let c = 0; c < 6; c++) {
        v[c] = hermite(s.ch[c][i], s.ch[c][i + 1], s.slopes[c][i], s.slopes[c][i + 1], h, u)
      }
    }
    const l = Math.hypot(v[0], v[1], v[2]) || 1
    out.lat = Math.asin(Math.max(-1, Math.min(1, v[1] / l))) / DEG
    out.lon = Math.atan2(-v[2] / l, v[0] / l) / DEG
    out.alt = Math.exp(v[3])
    out.pitch = Math.max(5, Math.min(90, v[4]))
    out.heading = ((v[5] % 360) + 360) % 360
    return out
  }

  return { evalAt, duration: script.duration }
}
