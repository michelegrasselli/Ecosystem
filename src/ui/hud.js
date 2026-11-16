// HUD: coordinate, quota, bioma e temperatura del punto osservato.
// Include il tasto "salva" volutamente poco visibile.

import { BIOME_NAME } from '../planet/biomes.js'
import { Planet } from '../planet/planet.js'

export function createHud({ planet, onSave, onHome, onZoomIn, onZoomOut }) {
  const el = {
    lat: document.getElementById('hud-lat'),
    lon: document.getElementById('hud-lon'),
    alt: document.getElementById('hud-alt'),
    biome: document.getElementById('hud-biome'),
    temp: document.getElementById('hud-temp'),
    save: document.getElementById('btn-save'),
    toast: document.getElementById('toast'),
    home: document.getElementById('btn-home'),
    zin: document.getElementById('btn-zoom-in'),
    zout: document.getElementById('btn-zoom-out')
  }

  const sample = Planet.createSample()
  let acc = 0
  let toastTimer = null

  el.save.addEventListener('click', () => onSave?.())
  el.home.addEventListener('click', () => onHome?.())
  el.zin.addEventListener('click', () => onZoomIn?.())
  el.zout.addEventListener('click', () => onZoomOut?.())

  function toast(msg, ms = 1900) {
    el.toast.textContent = msg
    el.toast.classList.add('show')
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms)
  }

  function flashSaved() {
    el.save.classList.add('saved')
    setTimeout(() => el.save.classList.remove('saved'), 1400)
  }

  function formatAltitude(km) {
    if (km >= 1000) return (km / 1000).toFixed(2) + ' Mm'
    if (km >= 10) return Math.round(km) + ' km'
    if (km >= 1) return km.toFixed(1) + ' km'
    return Math.round(km * 1000) + ' m'
  }

  function update(view, dt) {
    acc += dt
    if (acc < 0.16) return
    acc = 0

    el.lat.textContent = formatDeg(view.lat, 'N', 'S')
    el.lon.textContent = formatDeg(view.lon, 'E', 'W')
    el.alt.textContent = formatAltitude(view.altitudeKm)

    planet.sampleLatLon(view.lat, view.lon, 1, sample)
    const name = BIOME_NAME[sample.biome] ?? '—'
    el.biome.textContent = name
    el.temp.textContent = sample.temp.toFixed(0) + ' °C'
  }

  return { update, toast, flashSaved, elements: el }
}

function formatDeg(value, pos, neg) {
  const hemi = value >= 0 ? pos : neg
  const v = Math.abs(value)
  const d = Math.floor(v)
  const m = Math.floor((v - d) * 60)
  return `${d}°${String(m).padStart(2, '0')}′ ${hemi}`
}
