// HUD: coordinate, quota del terreno, nazione, bioma e temperatura del punto
// sotto il cursore (o del centro della vista, se il cursore è fuori dalla
// finestra), più la quota della camera.
// Include il tasto "salva" volutamente poco visibile.

import { BIOME_NAME } from '../planet/biomes.js'
import { Planet } from '../planet/planet.js'

export function createHud({ planet, nations, onSave, onHome, onZoomIn, onZoomOut }) {
  const el = {
    lat: document.getElementById('hud-lat'),
    lon: document.getElementById('hud-lon'),
    alt: document.getElementById('hud-alt'),
    elev: document.getElementById('hud-elev'),
    biome: document.getElementById('hud-biome'),
    temp: document.getElementById('hud-temp'),
    nation: document.getElementById('hud-nation'),
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

    el.alt.textContent = formatAltitude(view.altitudeKm)
    const picked = view.pick?.()
    if (picked === null) {
      // cursore sullo spazio vuoto
      for (const k of ['lat', 'lon', 'elev', 'biome', 'temp', 'nation']) if (el[k]) el[k].textContent = '—'
      return
    }
    const lat = picked ? picked.lat : view.lat
    const lon = picked ? picked.lon : view.lon
    el.lat.textContent = formatDeg(lat, 'N', 'S')
    el.lon.textContent = formatDeg(lon, 'E', 'W')

    planet.sampleLatLon(lat, lon, 1, sample)
    if (el.elev) el.elev.textContent = formatElevation(sample.height)
    const name = BIOME_NAME[sample.biome] ?? '—'
    el.biome.textContent = name
    el.temp.textContent = sample.temp.toFixed(0) + ' °C'
    if (el.nation && nations) {
      // laghi e fiumi appartengono alla terra: "open sea" solo in mare
      const onLand = sample.height >= 0
      el.nation.textContent = onLand ? nations.atLatLon(lat, lon).title : 'open sea'
    }
  }

  return { update, toast, flashSaved, elements: el }
}

/** Quota del terreno in metri sul livello del mare (negativa: profondità). */
function formatElevation(m) {
  const v = Math.round(m / 10) * 10
  const abs = Math.abs(v).toLocaleString('en-US').replace(/,/g, '\u2009')
  if (v === 0) return '0 m'
  return (v < 0 ? '−' : '') + abs + ' m'
}

function formatDeg(value, pos, neg) {
  const hemi = value >= 0 ? pos : neg
  const v = Math.abs(value)
  const d = Math.floor(v)
  const m = Math.floor((v - d) * 60)
  return `${d}°${String(m).padStart(2, '0')}′ ${hemi}`
}
