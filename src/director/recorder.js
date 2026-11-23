// Codifica dei fotogrammi in un file MP4 direttamente nel browser.
//
// WebCodecs (VideoEncoder) comprime i fotogrammi, mp4-muxer li impacchetta in
// un MP4 "fast start" (si può riprodurre mentre si scarica). Niente ffmpeg da
// installare. Prima scelta H.264 High (va bene ovunque: YouTube, TikTok,
// Reels, telefoni); se il browser non sa codificarlo si ripiega su VP9.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

const CANDIDATES = [
  // H.264 High, livello 4.2 (1080x1920 fino a 60 fps)
  { codec: 'avc1.64002a', muxer: 'avc' },
  { codec: 'avc1.4d002a', muxer: 'avc' },
  { codec: 'vp09.00.41.08', muxer: 'vp9' }
]

export function webCodecsAvailable() {
  return typeof window !== 'undefined' && typeof window.VideoEncoder === 'function'
}

/** Sceglie il primo codec supportato per le dimensioni date. */
async function pickCodec(width, height, fps, bitrate) {
  for (const c of CANDIDATES) {
    const config = { codec: c.codec, width, height, bitrate, framerate: fps }
    if (c.muxer === 'avc') config.avc = { format: 'avc' }
    try {
      const r = await VideoEncoder.isConfigSupported(config)
      if (r.supported) return { ...c, config }
    } catch {
      // codec sconosciuto a questo browser: si prova il successivo
    }
  }
  return null
}

/**
 * Crea un registratore.
 * @returns {Promise<{ addFrame(canvas, index): Promise<void>, finish(): Promise<Blob>, codec: string }>}
 */
export async function createRecorder({ width, height, fps, bitrate = 16_000_000 }) {
  if (!webCodecsAvailable()) throw new Error('this browser cannot encode video (WebCodecs missing)')
  const pick = await pickCodec(width, height, fps, bitrate)
  if (!pick) throw new Error('no supported video codec for ' + width + 'x' + height)

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: pick.muxer, width, height, frameRate: fps },
    fastStart: 'in-memory'
  })
  let failure = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      failure = e
    }
  })
  encoder.configure(pick.config)
  const frameUs = 1e6 / fps

  return {
    codec: pick.codec,
    async addFrame(canvas, index) {
      if (failure) throw failure
      const frame = new VideoFrame(canvas, { timestamp: Math.round(index * frameUs), duration: Math.round(frameUs) })
      // un fotogramma chiave ogni 2 secondi
      encoder.encode(frame, { keyFrame: index % (fps * 2) === 0 })
      frame.close()
      // contropressione: non accumulare troppi fotogrammi in coda
      while (encoder.encodeQueueSize > 6) {
        await new Promise((r) => setTimeout(r, 2))
      }
    },
    async finish() {
      await encoder.flush()
      if (failure) throw failure
      encoder.close()
      muxer.finalize()
      return new Blob([muxer.target.buffer], { type: 'video/mp4' })
    }
  }
}
