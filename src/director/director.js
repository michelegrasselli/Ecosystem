// Il regista: anteprima e ripresa di un episodio.
//
// - Anteprima (preview): la sceneggiatura gira in tempo reale dentro una
//   cornice 9:16 al centro dello schermo, con i titoli in sovrimpressione. Il
//   terreno si carica mentre la camera si muove, come nella navigazione.
// - Ripresa (render): il video viene calcolato fotogramma per fotogramma, con
//   un orologio virtuale (acqua, lava e "morph" delle tile seguono il tempo del
//   video, non quello reale). Per ogni fotogramma si aspetta che tutte le tile
//   necessarie siano pronte, poi si compone l'immagine 3D con la
//   sovrimpressione e la si codifica in MP4. Il risultato non dipende dalla
//   velocità del computer: niente scatti, niente terreno ancora sfocato, e
//   rigirando la stessa sceneggiatura si ottiene lo stesso video.
//
// Il ciclo principale dell'app (main.js) cede il controllo al regista mentre è
// attivo: `host` espone il passo della scena e gli oggetti necessari.

import { normalizeScript, buildTimeline } from './timeline.js'
import { drawOverlay } from './overlay.js'
import { createRecorder, webCodecsAvailable } from './recorder.js'
import { loadNarration, buildSoundtrack, DEFAULT_VOICE_FX } from './audio.js'
import { createFx, evalFx } from './fx.js'
import { createParticles } from './particles.js'
import { createEruption } from './eruption.js'

// massimo di attesa per le tile di un singolo fotogramma (ms): oltre si va
// avanti comunque, per non bloccare la ripresa su un caso limite
const MAX_WAIT_MS = 12000

/** Cede il controllo al browser senza i ritardi dei timer (anche a pagina nascosta). */
function yieldTask() {
  return new Promise((resolve) => {
    const ch = new MessageChannel()
    ch.port1.onmessage = () => resolve()
    ch.port2.postMessage(0)
  })
}

/** Carica i caratteri dei titoli prima di disegnare (altrimenti ripiega su Georgia). */
async function loadFonts() {
  if (!document.fonts) return
  try {
    await Promise.all([
      document.fonts.load("600 60px 'Cinzel'"),
      document.fonts.load("italic 500 40px 'Cormorant Garamond'")
    ])
  } catch {
    // senza rete restano i caratteri di ripiego
  }
}

export function createDirector(host) {
  const { renderer, camera, lod, nationLabels } = host

  let mode = null // null | 'preview' | 'render'
  let script = null
  let timeline = null
  let previewStart = 0
  let abort = false
  let lastRender = null
  let narration = null
  let soundtrack = null
  let audioCtx = null
  let audioSrc = null

  // cornice dell'anteprima: maschera scura ai lati e canvas della sovrimpressione
  const frameEl = document.createElement('div')
  frameEl.className = 'director-frame'
  const overlayCanvas = document.createElement('canvas')
  overlayCanvas.className = 'director-overlay'
  frameEl.appendChild(overlayCanvas)
  document.body.appendChild(frameEl)

  // canvas di composizione per la ripresa
  const comp = document.createElement('canvas')
  // effetti (script.fx): immagine 3D + particelle su "pre", poi lo shader di fx.js
  const pre = document.createElement('canvas')
  const preCtx = pre.getContext('2d')
  const particles = createParticles()
  const eruption = host.planet ? createEruption(host.planet) : null
  let fxEngine
  function getFx() {
    if (fxEngine === undefined) {
      try {
        fxEngine = createFx()
      } catch (e) {
        console.warn('fx disabled:', e.message)
        fxEngine = null
      }
    }
    return fxEngine
  }

  /** Vulcano del pennacchio al tempo t: fx.plumes [{ from, to, at: [lat, lon] }] o fx.plumeAt. */
  function plumeAt(t) {
    const fx = script.fx
    const p = (fx.plumes || []).find((q) => t >= q.from && t <= q.to)
    return p ? p.at : fx.plumeAt
  }

  /**
   * Effetti che agiscono sulla scena 3D (vanno impostati PRIMA del render):
   * per ora la lava più accesa durante le eruzioni.
   */
  function sceneFx(t) {
    const U = host.terrainMaterial?.uniforms
    if (!U?.uLavaBoost) return
    const f = script && script.fx ? evalFx(script.fx, t) : null
    U.uLavaBoost.value = f ? f.lavaBoost || 0 : 0
    // fronte di crescita delle piante: centro da fx.grows [{ from, to, at }] o fx.growAt
    const g = f && script.fx ? (script.fx.grows || []).find((q) => t >= q.from && t <= q.to)?.at || script.fx.growAt : null
    if (f && g && f.growFront >= 0) {
      const la = (g[0] * Math.PI) / 180
      const lo = (g[1] * Math.PI) / 180
      U.uGrowCenter.value.set(Math.cos(la) * Math.cos(lo), Math.sin(la), -Math.cos(la) * Math.sin(lo))
      U.uGrowFront.value = f.growFront
      U.uGrowSoft.value = f.growSoft
    } else {
      U.uGrowFront.value = -1
    }
  }
  function resetSceneFx() {
    const U = host.terrainMaterial?.uniforms
    if (U?.uLavaBoost) U.uLavaBoost.value = 0
    if (U?.uGrowFront) U.uGrowFront.value = -1
  }

  /**
   * Compone un fotogramma: immagine 3D (letta subito dopo il render),
   * particelle ed effetti se la sceneggiatura li chiede, poi la sovrimpressione.
   */
  function compose(ctx, W, H, t, frame) {
    const fx = script.fx ? getFx() : null
    if (fx) {
      if (pre.width !== W || pre.height !== H) {
        pre.width = W
        pre.height = H
      }
      preCtx.drawImage(renderer.domElement, 0, 0, W, H)
      const params = evalFx(script.fx, t)
      params.plumeAt = plumeAt(t)
      particles.draw(preCtx, t, params)
      eruption?.draw(preCtx, t, params, camera, host.exaggeration ? host.exaggeration() : 1)
      ctx.drawImage(fx.apply(pre, params, t, frame), 0, 0, W, H)
    } else {
      ctx.drawImage(renderer.domElement, 0, 0, W, H)
    }
    drawOverlay(ctx, script, t, labelsFor(W, H))
  }

  function labelsFor(width, height) {
    if (!script.labels) return null
    return nationLabels
      .debug()
      .filter((l) => l.alpha > 0.02)
      .map((l) => ({ text: l.t, x: l.x, y: l.y, alpha: l.alpha, size: l.size }))
  }

  /** Riquadro 9:16 (o del formato della sceneggiatura) centrato nella finestra. */
  function previewBox() {
    const ww = window.innerWidth
    const wh = window.innerHeight
    const ar = script.width / script.height
    let h = wh
    let w = h * ar
    if (w > ww) {
      w = ww
      h = w / ar
    }
    return { w: Math.round(w), h: Math.round(h), x: Math.round((ww - w) / 2), y: Math.round((wh - h) / 2) }
  }

  function placeCanvas(box) {
    const c = renderer.domElement
    c.style.position = 'fixed'
    c.style.left = box.x + 'px'
    c.style.top = box.y + 'px'
    c.style.width = box.w + 'px'
    c.style.height = box.h + 'px'
  }

  function restoreCanvas() {
    const c = renderer.domElement
    c.style.position = ''
    c.style.left = ''
    c.style.top = ''
    c.style.width = ''
    c.style.height = ''
    document.body.classList.remove('director-on')
    frameEl.style.display = 'none'
    host.resize()
  }

  /**
   * Prepara la sceneggiatura: timeline della camera, narrazione e colonna
   * sonora. Le battute della voce narrante diventano anche sottotitoli
   * (narration.captions: false per non mostrarli), con i tempi reali della voce.
   */
  async function load(input) {
    script = normalizeScript(input)
    timeline = buildTimeline(script)
    camera.fov = script.fov
    camera.updateProjectionMatrix()
    narration = await loadNarration(script)
    if (script.narration && !narration) {
      console.warn('narration not generated yet: run  npm run narrate -- episodes/' + script.name + '.json')
    }
    if (narration && script.narration.captions !== false) {
      const pitch = { ...DEFAULT_VOICE_FX, ...(script.voiceFx || {}) }.pitch
      const cap = script.narration.captionSize || 0.6
      for (const l of narration.lines) {
        script.titles.push({
          from: l.at - 0.15,
          to: l.at + l.duration / pitch + 0.7,
          text: l.text,
          pos: 'bottom',
          size: cap,
          caption: true
        })
      }
    }
    soundtrack = await buildSoundtrack(script, narration)
  }

  function stopAudio() {
    try {
      audioSrc?.stop()
    } catch {
      // già fermo
    }
    audioSrc = null
  }

  // ------------------------------------------------------------ anteprima

  async function preview(input) {
    stop()
    await load(input)
    mode = 'preview'
    document.body.classList.add('director-on')
    frameEl.style.display = 'block'
    const box = previewBox()
    placeCanvas(box)
    renderer.setSize(box.w, box.h, false)
    camera.aspect = box.w / box.h
    camera.updateProjectionMatrix()
    overlayCanvas.width = box.w
    overlayCanvas.height = box.h
    overlayCanvas.style.left = box.x + 'px'
    overlayCanvas.style.top = box.y + 'px'
    overlayCanvas.style.width = box.w + 'px'
    overlayCanvas.style.height = box.h + 'px'
    loadFonts()
    previewStart = performance.now()
    // colonna sonora sincronizzata con l'inizio dell'anteprima
    if (soundtrack) {
      audioCtx = audioCtx || new AudioContext()
      await audioCtx.resume()
      audioSrc = audioCtx.createBufferSource()
      audioSrc.buffer = soundtrack
      audioSrc.connect(audioCtx.destination)
      audioSrc.start()
      previewStart = performance.now()
    }
  }

  /** Chiamata dal ciclo principale a ogni frame durante l'anteprima. */
  function tick(dt, now) {
    if (mode !== 'preview') return false
    const t = (now - previewStart) / 1000
    if (t > script.duration) {
      stop()
      return false
    }
    const cam = timeline.evalAt(t)
    const box = previewBox()
    sceneFx(t)
    host.stepScene(dt, now, { drive: cam, viewportHeight: box.h, labelW: box.w, labelH: box.h })
    const ctx = overlayCanvas.getContext('2d')
    if (script.fx) {
      // con gli effetti la sovrimpressione contiene l'intero fotogramma
      compose(ctx, overlayCanvas.width, overlayCanvas.height, t, Math.round(t * script.fps))
    } else {
      ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height)
      drawOverlay(ctx, script, t, labelsFor(box.w, box.h))
    }
    host.onPreviewTime?.(t, script.duration)
    return true
  }

  function stop() {
    abort = true
    stopAudio()
    const wasPreview = mode === 'preview'
    resetSceneFx()
    mode = null // prima di restoreCanvas: il resize dell'app è bloccato mentre il regista lavora
    if (wasPreview) restoreCanvas()
  }

  // --------------------------------------------------------------- ripresa

  /**
   * Gira il video.
   * @param {object} input sceneggiatura
   * @param {{ onProgress?(frame, total, thumbCanvas): void }} [opts]
   * @returns {Promise<{ blob: Blob, name: string, frames: number, seconds: number, codec: string }>}
   */
  async function render(input, opts = {}) {
    if (!webCodecsAvailable()) throw new Error('this browser cannot encode video (WebCodecs missing)')
    stop()
    await load(input)
    abort = false
    mode = 'render'
    const W = script.width
    const H = script.height
    const fps = script.fps
    const total = Math.max(1, Math.round(script.duration * fps))
    const t0 = performance.now()

    await loadFonts()
    const prevRatio = renderer.getPixelRatio()
    renderer.setPixelRatio(1)
    renderer.setSize(W, H, false)
    camera.aspect = W / H
    camera.updateProjectionMatrix()
    comp.width = W
    comp.height = H
    const ctx = comp.getContext('2d')
    // opts.only: solo alcuni fotogrammi (prove di inquadratura), niente video
    const only = Array.isArray(opts.only) ? opts.only.map((x) => Math.round(x)) : null
    const recorder = only ? null : await createRecorder({ width: W, height: H, fps, audio: soundtrack })
    const list = only || Array.from({ length: total }, (_, i) => i)

    const sceneOpts = { drive: null, viewportHeight: H, labelW: W, labelH: H, offline: true, clock: 0 }
    try {
      for (let n = 0; n < list.length; n++) {
        const i = list[n]
        if (abort) throw new Error('render stopped')
        const t = i / fps
        sceneOpts.drive = timeline.evalAt(t)
        sceneOpts.clock = t * 1000
        sceneFx(t)
        // primo fotogramma (o fotogrammi sparsi): qualche passo in più per
        // assestare quota del suolo ed etichette
        const warm = n === 0 || only ? 30 : 1
        for (let k = 0; k < warm; k++) host.stepScene(k === 0 ? 1 / fps : 0, t * 1000, sceneOpts)
        // si aspettano tutte le tile necessarie a questo fotogramma
        const waitStart = performance.now()
        while (
          (lod.stats.queued > 0 || lod.stats.inFlight > 0) &&
          performance.now() - waitStart < MAX_WAIT_MS
        ) {
          await yieldTask()
          host.stepScene(0, t * 1000, sceneOpts)
        }
        // le etichette hanno bisogno di qualche passo per la loro griglia di raggi
        if (script.labels) for (let k = 0; k < 3; k++) host.stepScene(0, t * 1000, sceneOpts)
        host.stepScene(0, t * 1000, sceneOpts)

        // composizione: immagine 3D (letta subito dopo il render), effetti e sovrimpressione
        compose(ctx, W, H, t, i)
        if (only) {
          await opts.onStill?.(comp, t, i)
          continue
        }
        await recorder.addFrame(comp, i)
        opts.onProgress?.(i + 1, total, comp)
        if (i % 4 === 0) await yieldTask()
      }
      if (only) return null
      const blob = await recorder.finish()
      lastRender = {
        blob,
        name: (script.name || 'episode') + '.mp4',
        frames: total,
        seconds: (performance.now() - t0) / 1000,
        codec: recorder.codec + (recorder.audioCodec ? ' + ' + recorder.audioCodec : ' (no audio)')
      }
      return lastRender
    } finally {
      mode = null
      resetSceneFx()
      renderer.setPixelRatio(prevRatio)
      restoreCanvas()
    }
  }

  /**
   * Salva un video: nella cartella videos/ del progetto se l'app gira con il
   * server di sviluppo, altrimenti come download del browser.
   */
  async function save(result = lastRender) {
    if (!result) throw new Error('nothing rendered yet')
    try {
      const res = await fetch('./__director/save?name=' + encodeURIComponent(result.name), {
        method: 'POST',
        body: result.blob
      })
      if (res.ok) return { saved: await res.text() }
    } catch {
      // niente server di sviluppo: si scarica
    }
    const a = document.createElement('a')
    a.href = URL.createObjectURL(result.blob)
    a.download = result.name
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000)
    return { downloaded: result.name }
  }

  return {
    preview,
    tick,
    stop,
    render,
    save,
    get mode() {
      return mode
    },
    get busy() {
      return mode !== null
    },
    get script() {
      return script
    }
  }
}
