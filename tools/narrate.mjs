// Voce narrante degli episodi: sintesi vocale locale con Kokoro (modello
// Kokoro-82M, licenza Apache 2.0, gira sul PC senza account né servizi a
// pagamento; al primo uso scarica il modello da Hugging Face, ~90 MB).
//
//   node tools/narrate.mjs episodes/ep01-the-birth-of-a-planet.json
//   npm run narrate -- episodes/ep01-the-birth-of-a-planet.json
//
// Legge `narration` dalla sceneggiatura:
//   { "voice": "bm_lewis", "speed": 0.86,
//     "lines": [ { "at": 1.0, "text": "Before time had a name..." }, ... ] }
// e scrive in audio/<nome episodio>/:
//   - una battuta per file (01.wav, 02.wav, ...)
//   - narration.json con tempi, durate e testi, letto dal regista
// Le battute già generate con lo stesso testo, voce e velocità non vengono
// rifatte. Avvisa se una battuta finisce dopo l'inizio della successiva.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const MODEL = 'onnx-community/Kokoro-82M-v1.0-ONNX'
// la voce nel video viene abbassata di tono di questo fattore (vedi
// director/audio.js): la durata reale delle battute cresce di conseguenza
const DEFAULT_PITCH = 0.95

const file = process.argv[2]
if (!file) {
  console.error('uso: node tools/narrate.mjs episodes/<episodio>.json')
  process.exit(1)
}
const script = JSON.parse(readFileSync(resolve(file), 'utf8'))
const nar = script.narration
if (!nar || !Array.isArray(nar.lines) || nar.lines.length === 0) {
  console.error('la sceneggiatura non ha "narration.lines"')
  process.exit(1)
}
const voice = nar.voice || 'bm_lewis'
const speed = nar.speed || 0.86
const pitch = (script.voiceFx && script.voiceFx.pitch) || DEFAULT_PITCH
const outDir = join(ROOT, 'audio', script.name)
mkdirSync(outDir, { recursive: true })

const manifestPath = join(outDir, 'narration.json')
const old = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : { lines: [] }

let tts = null
async function engine() {
  if (!tts) {
    const { KokoroTTS } = await import('kokoro-js')
    process.stdout.write('loading Kokoro… ')
    tts = await KokoroTTS.from_pretrained(MODEL, { dtype: 'q8', device: 'cpu' })
    console.log('ok')
  }
  return tts
}

const lines = []
for (let i = 0; i < nar.lines.length; i++) {
  const l = nar.lines[i]
  const name = String(i + 1).padStart(2, '0') + '.wav'
  const hash = createHash('sha1').update([l.text, voice, speed].join('|')).digest('hex').slice(0, 12)
  const prev = old.lines.find((o) => o.file === name && o.hash === hash)
  let duration
  if (prev && existsSync(join(outDir, name))) {
    duration = prev.duration
  } else {
    const t = await engine()
    const audio = await t.generate(l.text, { voice: l.voice || voice, speed: l.speed || speed })
    audio.save(join(outDir, name))
    duration = audio.audio.length / audio.sampling_rate
    console.log(`${name}  ${duration.toFixed(2)} s  "${l.text}"`)
  }
  lines.push({ at: l.at, file: name, duration, played: duration / pitch, text: l.text, hash })
}

// controllo delle sovrapposizioni (con la durata effettiva nel video)
for (let i = 0; i + 1 < lines.length; i++) {
  const end = lines[i].at + lines[i].played
  if (end > lines[i + 1].at - 0.2) {
    console.warn(
      `attenzione: la battuta ${i + 1} finisce a ${end.toFixed(2)} s, la ${i + 2} inizia a ${lines[i + 1].at} s`
    )
  }
}
const last = lines[lines.length - 1]
if (script.duration && last.at + last.played > script.duration - 0.5) {
  console.warn(`attenzione: l'ultima battuta finisce a ${(last.at + last.played).toFixed(2)} s, il video dura ${script.duration} s`)
}

writeFileSync(manifestPath, JSON.stringify({ episode: script.name, voice, speed, pitch, lines }, null, 2))
console.log(`narrazione pronta in ${outDir}`)
