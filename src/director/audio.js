// Colonna sonora di un episodio: musica di sottofondo + voce narrante.
//
// Il mix viene calcolato una volta sola con un OfflineAudioContext (più veloce
// del tempo reale e identico a ogni ripresa) e poi:
//  - codificato nella traccia audio dell'MP4 (recorder.js);
//  - suonato durante l'anteprima, sincronizzato con la camera.
//
// Musica: volume basso (default 0.5), dissolvenza in entrata e in uscita, e
// "ducking": si abbassa ancora mentre parla il narratore, così la voce resta
// in primo piano e la musica dà solo epicità.
// Voce: le battute generate da tools/narrate.mjs (audio/<episodio>/), con una
// catena che la rende più profonda e "da narratore": tono leggermente più
// basso, calore sulle basse, compressione morbida e un riverbero da sala.

const SAMPLE_RATE = 48000

// volume 0.5 con duck 0.6: musica ~14 dB sotto la voce narrante, udibile ma di sfondo
export const DEFAULT_MUSIC = { volume: 0.5, offset: 0, fadeIn: 2.5, fadeOut: 3, duck: 0.6 }
export const DEFAULT_VOICE_FX = { pitch: 0.95, volume: 1.0, reverb: 0.2, warmth: 4 }

async function fetchArrayBuffer(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`cannot load ${url} (${res.status})`)
  return res.arrayBuffer()
}

function encodePath(p) {
  return p
    .split('/')
    .map((s) => encodeURIComponent(s))
    .join('/')
}

/** Manifest della narrazione (tempi e durate delle battute), se esiste. */
export async function loadNarration(script) {
  if (!script.narration) return null
  try {
    const res = await fetch(`./audio/${encodeURIComponent(script.name)}/narration.json`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

/** Risposta all'impulso sintetica: coda di rumore che decade (sala ampia). */
function makeImpulse(ctx, seconds = 2.6, decay = 2.8) {
  const len = Math.round(ctx.sampleRate * seconds)
  const buf = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c)
    let seed = 1234567 + c * 7919
    for (let i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const n = (seed / 0x7fffffff) * 2 - 1
      d[i] = n * Math.pow(1 - i / len, decay)
    }
  }
  return buf
}

/**
 * Calcola la colonna sonora dell'episodio.
 * @returns {Promise<AudioBuffer|null>} null se non c'è né musica né voce
 */
export async function buildSoundtrack(script, narration) {
  const music = script.music ? { ...DEFAULT_MUSIC, ...script.music } : null
  const fx = { ...DEFAULT_VOICE_FX, ...(script.voiceFx || {}) }
  const lines = narration ? narration.lines : []
  if (!music && lines.length === 0) return null

  const duration = script.duration
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE)
  const master = ctx.createGain()
  master.gain.value = 1
  // limitatore finale: niente picchi oltre lo 0 dB quando voce e musica si sommano
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -3
  limiter.knee.value = 2
  limiter.ratio.value = 12
  limiter.attack.value = 0.003
  limiter.release.value = 0.15
  master.connect(limiter).connect(ctx.destination)

  // ------------------------------------------------------------- voce
  const voiceBus = ctx.createGain()
  voiceBus.gain.value = fx.volume
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 55
  const warmth = ctx.createBiquadFilter()
  warmth.type = 'lowshelf'
  warmth.frequency.value = 180
  warmth.gain.value = fx.warmth
  const presence = ctx.createBiquadFilter()
  presence.type = 'peaking'
  presence.frequency.value = 3200
  presence.Q.value = 0.8
  presence.gain.value = 1.5
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -20
  comp.knee.value = 8
  comp.ratio.value = 3
  comp.attack.value = 0.01
  comp.release.value = 0.2
  voiceBus.connect(hp).connect(warmth).connect(presence).connect(comp)
  comp.connect(master)
  if (fx.reverb > 0) {
    const conv = ctx.createConvolver()
    conv.buffer = makeImpulse(ctx)
    const wet = ctx.createGain()
    wet.gain.value = fx.reverb
    comp.connect(conv).connect(wet).connect(master)
  }

  for (const l of lines) {
    const data = await fetchArrayBuffer(`./audio/${encodeURIComponent(script.name)}/${l.file}`)
    const buf = await ctx.decodeAudioData(data)
    const src = ctx.createBufferSource()
    src.buffer = buf
    // tono più basso (rallenta anche un po': voce più solenne)
    src.playbackRate.value = fx.pitch
    src.connect(voiceBus)
    src.start(Math.max(0, l.at))
  }

  // ------------------------------------------------------------ musica
  if (music && music.src) {
    const data = await fetchArrayBuffer('./' + encodePath(music.src))
    const buf = await ctx.decodeAudioData(data)
    const src = ctx.createBufferSource()
    src.buffer = buf
    const g = ctx.createGain()
    // inviluppo campionato a 50 Hz: dissolvenze e ducking moltiplicati tra
    // loro, così non entrano in conflitto quando si sovrappongono
    const smooth = (a, b, x) => {
      const t = Math.min(Math.max((x - a) / (b - a), 0), 1)
      return t * t * (3 - 2 * t)
    }
    const n = Math.max(2, Math.ceil(duration * 50))
    const curve = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * duration
      let k = music.volume
      k *= music.fadeIn > 0 ? smooth(0, music.fadeIn, t) : 1
      k *= music.fadeOut > 0 ? 1 - smooth(duration - music.fadeOut, duration, t) : 1
      let duck = 0
      for (const l of lines) {
        const a = l.at - 0.4
        const b = l.at + l.duration / fx.pitch + 0.4
        duck = Math.max(duck, smooth(a, a + 0.4, t) * (1 - smooth(b, b + 0.7, t)))
      }
      k *= 1 - (1 - music.duck) * duck
      curve[i] = k
    }
    g.gain.setValueCurveAtTime(curve, 0, duration)
    src.connect(g).connect(master)
    src.start(0, Math.max(0, music.offset))
  }

  return ctx.startRendering()
}
