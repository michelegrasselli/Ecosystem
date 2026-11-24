// Codifica dei fotogrammi (e della colonna sonora) in un file MP4 direttamente
// nel browser.
//
// WebCodecs (VideoEncoder / AudioEncoder) comprime, mp4-muxer impacchetta in
// un MP4 "fast start" (si può riprodurre mentre si scarica). Niente ffmpeg da
// installare. Video: prima scelta H.264 High (va bene ovunque: YouTube,
// TikTok, Reels, telefoni), ripiego VP9. Audio: AAC-LC, ripiego Opus.

import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

const VIDEO_CANDIDATES = [
  // H.264 High, livello 4.2 (1080x1920 fino a 60 fps)
  { codec: 'avc1.64002a', muxer: 'avc' },
  { codec: 'avc1.4d002a', muxer: 'avc' },
  { codec: 'vp09.00.41.08', muxer: 'vp9' }
]
const AUDIO_CANDIDATES = [
  { codec: 'mp4a.40.2', muxer: 'aac', bitrate: 192_000 },
  { codec: 'opus', muxer: 'opus', bitrate: 160_000 }
]

export function webCodecsAvailable() {
  return typeof window !== 'undefined' && typeof window.VideoEncoder === 'function'
}

/** Sceglie il primo codec video supportato per le dimensioni date. */
async function pickVideo(width, height, fps, bitrate) {
  for (const c of VIDEO_CANDIDATES) {
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

async function pickAudio(sampleRate, numberOfChannels) {
  if (typeof window.AudioEncoder !== 'function') return null
  for (const c of AUDIO_CANDIDATES) {
    const config = { codec: c.codec, sampleRate, numberOfChannels, bitrate: c.bitrate }
    try {
      const r = await AudioEncoder.isConfigSupported(config)
      if (r.supported) return { ...c, config }
    } catch {
      // non supportato: si prova il successivo
    }
  }
  return null
}

/** Codifica tutta la colonna sonora e la passa al muxer. */
async function encodeAudio(buffer, pick, muxer) {
  let failure = null
  const enc = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => {
      failure = e
    }
  })
  enc.configure(pick.config)
  const ch = buffer.numberOfChannels
  const rate = buffer.sampleRate
  const frames = 1024
  const planes = []
  for (let c = 0; c < ch; c++) planes.push(buffer.getChannelData(c))
  for (let start = 0; start < buffer.length; start += frames) {
    const n = Math.min(frames, buffer.length - start)
    const data = new Float32Array(n * ch)
    for (let c = 0; c < ch; c++) data.set(planes[c].subarray(start, start + n), c * n)
    const ad = new AudioData({
      format: 'f32-planar',
      sampleRate: rate,
      numberOfFrames: n,
      numberOfChannels: ch,
      timestamp: Math.round((start / rate) * 1e6),
      data
    })
    enc.encode(ad)
    ad.close()
    if (failure) throw failure
  }
  await enc.flush()
  enc.close()
  if (failure) throw failure
}

/**
 * Crea un registratore.
 * @param {{ width, height, fps, bitrate?, audio?: AudioBuffer|null }} opts
 * @returns {Promise<{ addFrame(canvas, index): Promise<void>, finish(): Promise<Blob>, codec: string, audioCodec: string|null }>}
 */
export async function createRecorder({ width, height, fps, bitrate = 16_000_000, audio = null }) {
  if (!webCodecsAvailable()) throw new Error('this browser cannot encode video (WebCodecs missing)')
  const pick = await pickVideo(width, height, fps, bitrate)
  if (!pick) throw new Error('no supported video codec for ' + width + 'x' + height)
  const aPick = audio ? await pickAudio(audio.sampleRate, audio.numberOfChannels) : null
  if (audio && !aPick) throw new Error('this browser cannot encode audio (no AAC/Opus encoder)')

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: pick.muxer, width, height, frameRate: fps },
    audio: aPick
      ? { codec: aPick.muxer, numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate }
      : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset'
  })
  // la colonna sonora è già pronta: si codifica subito tutta
  if (aPick) await encodeAudio(audio, aPick, muxer)

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
    audioCodec: aPick ? aPick.codec : null,
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
