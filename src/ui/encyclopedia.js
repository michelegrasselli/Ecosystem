// Enciclopedia di Elyra: finestre che compaiono da sole, senza cliccare.
//
// - Fermando il mouse per un attimo (DWELL) su un punto del pianeta compare
//   l'elenco delle specie del bioma sotto il cursore.
// - Passando sopra a una specie dell'elenco, più a lato si apre la sua pagina:
//   "fotografia" renderizzata (ui/plantPortrait.js), tipo di pianta, altezza,
//   habitat, tossicità, caratteristiche, storia e curiosità.
// - Fermando il mouse sul nome di una nazione compare la sua pagina:
//   superficie, biomi, clima, rilievi, acque, vulcani, terre vicine e storia
//   naturale (ui/nationLore.js). Elyra non è ancora abitata: niente
//   popolazione, capitali, sovrani o città.
// Le finestre restano aperte finché il mouse ci sta sopra; si chiudono quando
// il mouse si allontana sul pianeta, a ogni clic o zoom e con Esc.

import { BIOME_NAME, PALETTE } from '../planet/biomes.js'
import { SPECIES, biomeFlora, speciesHabitats } from '../planet/flora.js'
import { Planet } from '../planet/planet.js'
import { PLANT_INFO, BIOME_INFO, TOXIC_LEVEL } from './encyclopediaData.js'
import { plantPortrait } from './plantPortrait.js'
import { nationInfo } from './nationLore.js'

const DWELL_MS = 1300
const CLOSE_PX = 40

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const css = (c) => `rgb(${Math.round(c[0] * 255)}, ${Math.round(c[1] * 255)}, ${Math.round(c[2] * 255)})`

/**
 * Altezza di una pianta. Sul pianeta le piante sono giganti (FLORA_SCALE, in
 * km di scena) perché si vedano da centinaia di km; nell'enciclopedia lo
 * stesso numero si legge in METRI, l'altezza "vera" di Elyra.
 */
function fmtHeight(h) {
  if (h >= 10) return Math.round(h) + ' m'
  return h.toFixed(1) + ' m'
}
const fmtInt = (v) => Math.round(v).toLocaleString('en-US')
function fmtLatLon(p) {
  if (!p) return ''
  const f = (v, a, b) => Math.abs(v).toFixed(1) + '°' + (v >= 0 ? a : b)
  return f(p.lat, 'N', 'S') + ' ' + f(p.lon, 'E', 'W')
}

export function createEncyclopedia({ canvas, planet, nationLabels, nations, pick }) {
  const panel = document.createElement('div')
  panel.className = 'enc-panel'
  const page = document.createElement('div')
  page.className = 'enc-panel enc-page'
  document.body.append(panel, page)

  const sample = Planet.createSample()
  let timer = 0
  let anchor = null // punto in cui il mouse si è fermato
  let open = false
  let px = 0
  let py = 0
  let current = null // { kind, key } della finestra aperta
  let pageFor = -1

  function close() {
    open = false
    current = null
    pageFor = -1
    panel.classList.remove('show')
    page.classList.remove('show')
  }

  function arm() {
    clearTimeout(timer)
    timer = setTimeout(fire, DWELL_MS)
  }

  canvas.addEventListener('pointermove', (e) => {
    px = e.clientX
    py = e.clientY
    if (e.buttons) {
      clearTimeout(timer)
      if (open) close()
      return
    }
    if (open) {
      if (Math.hypot(px - anchor.x, py - anchor.y) > CLOSE_PX) close()
      else return
    }
    arm()
  })
  canvas.addEventListener('pointerleave', () => clearTimeout(timer))
  canvas.addEventListener('pointerdown', () => {
    clearTimeout(timer)
    close()
  })
  canvas.addEventListener('wheel', () => {
    clearTimeout(timer)
    close()
  }, { passive: true })
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close()
  })

  function fire() {
    if (document.body.classList.contains('director-on') || document.body.classList.contains('director-busy')) return
    anchor = { x: px, y: py }
    const n = nationLabels.hitTest?.(px, py)
    if (n) {
      showNation(n)
      return
    }
    const p = pick()
    if (!p) return
    planet.sampleLatLon(p.lat, p.lon, 1, sample)
    showBiome(sample.biome)
  }

  /** Posiziona una finestra vicino al punto (x, y), dentro lo schermo. */
  function place(el, x, y) {
    el.style.left = '0px'
    el.style.top = '0px'
    el.classList.add('show')
    const w = el.offsetWidth
    const h = el.offsetHeight
    const vw = window.innerWidth
    const vh = window.innerHeight
    let left = x + 14
    if (left + w > vw - 10) left = Math.max(10, x - 14 - w)
    let top = y - 24
    top = Math.max(10, Math.min(top, vh - h - 10))
    el.style.left = left + 'px'
    el.style.top = top + 'px'
  }

  // ------------------------------------------------------------- bioma
  function showBiome(biome) {
    const key = 'b' + biome
    if (current === key) return
    current = key
    open = true
    pageFor = -1
    page.classList.remove('show')
    panel.classList.remove('enc-nation')
    const name = BIOME_NAME[biome] || 'Unknown'
    const flora = biomeFlora(biome)
    const col = PALETTE[biome] ? css(PALETTE[biome]) : '#888'
    let rows = ''
    for (const e of flora) {
      const sp = SPECIES[e.id]
      const info = PLANT_INFO[sp.key] || {}
      const rare = e.w < 0.02 ? '<span class="enc-rare">rare</span>' : ''
      rows += `<div class="enc-row" data-id="${e.id}">
        <span class="enc-dot" style="background:${info.tone || '#9c9'}"></span>
        <span class="enc-row-name">${esc(sp.name)}${rare}</span>
        <span class="enc-row-kind">${esc(info.kind || '')}</span>
        <span class="enc-row-h">${fmtHeight(sp.h)}</span>
      </div>`
    }
    panel.innerHTML = `
      <div class="enc-head"><span class="enc-swatch" style="background:${col}"></span>
        <div><div class="enc-kicker">Encyclopedia of Elyra · Biome</div><div class="enc-title">${esc(name)}</div></div></div>
      <div class="enc-blurb">${esc(BIOME_INFO[name] || '')}</div>
      ${flora.length ? `<div class="enc-sub">${flora.length} species · hover a plant to open its page</div><div class="enc-list">${rows}</div>` : '<div class="enc-sub">No plants grow here.</div>'}`
    place(panel, anchor.x, anchor.y)
    for (const row of panel.querySelectorAll('.enc-row')) {
      row.addEventListener('pointerenter', () => showPlant(+row.dataset.id, row))
    }
  }

  // ------------------------------------------------------------ pianta
  function showPlant(id, row) {
    for (const r of panel.querySelectorAll('.enc-row')) r.classList.toggle('active', r === row)
    if (pageFor === id) return
    pageFor = id
    const sp = SPECIES[id]
    const info = PLANT_INFO[sp.key] || {}
    const lo = sp.h * (1 - sp.var)
    const hi = sp.h * (1 + sp.var)
    const habitats = speciesHabitats(id).slice(0, 5).map((b) => BIOME_NAME[b]).join(', ')
    const tox = info.toxic || [0, '']
    page.innerHTML = `
      <div class="enc-photo"><div class="enc-photo-wait">painting…</div><img alt="${esc(sp.name)}" /></div>
      <div class="enc-kicker">Encyclopedia of Elyra · Flora</div>
      <div class="enc-title">${esc(sp.name)}</div>
      <div class="enc-kind">${esc(info.kind || '')}</div>
      <div class="enc-facts">
        <div><span>Height</span><b>${fmtHeight(lo)} – ${fmtHeight(hi)}</b></div>
        <div><span>Ancient specimens</span><b>up to ${fmtHeight(hi * 1.55)}</b></div>
        <div><span>Habitat</span><b>${esc(habitats || '—')}</b></div>
        <div><span>Toxicity</span><b class="enc-tox enc-tox${tox[0]}">${TOXIC_LEVEL[tox[0]]}</b></div>
      </div>
      <p class="enc-tox-note">${esc(tox[1])}</p>
      <h4>Features</h4><p>${esc(info.traits || '')}</p>
      <h4>History</h4><p>${esc(info.lore || '')}</p>
      <h4>Curiosity</h4><p>${esc(info.curio || '')}</p>`
    const pr = panel.getBoundingClientRect()
    page.style.left = '0px'
    page.style.top = '0px'
    page.classList.add('show')
    const w = page.offsetWidth
    const h = page.offsetHeight
    let left = pr.right + 10
    if (left + w > window.innerWidth - 10) left = Math.max(10, pr.left - 10 - w)
    const rr = row.getBoundingClientRect()
    const top = Math.max(10, Math.min(rr.top - 60, window.innerHeight - h - 10))
    page.style.left = left + 'px'
    page.style.top = top + 'px'
    // la fotografia si dipinge al frame dopo (la prima volta ~100 ms)
    const img = page.querySelector('img')
    requestAnimationFrame(() => {
      if (pageFor !== id) return
      img.src = plantPortrait(id)
      img.onload = () => img.parentElement.classList.add('ready')
    })
  }

  // ----------------------------------------------------------- nazione
  function showNation(n) {
    const key = 'n' + n.id
    if (current === key) return
    current = key
    open = true
    pageFor = -1
    page.classList.remove('show')
    const d = nationInfo(n, nations, planet)
    const bar = d.biomes
      .filter((b) => b.share > 0.01)
      .map((b) => `<span style="flex:${b.share.toFixed(3)};background:${PALETTE[b.biome] ? css(PALETTE[b.biome]) : '#777'}" title="${esc(b.name)}"></span>`)
      .join('')
    const blist = d.biomes
      .slice(0, 6)
      .map((b) => `<div class="enc-brow"><span class="enc-dot" style="background:${PALETTE[b.biome] ? css(PALETTE[b.biome]) : '#777'}"></span>${esc(b.name)}<b>${Math.round(b.share * 100)}%</b></div>`)
      .join('')
    const nb = d.neighbors.slice(0, 6).map((x) => esc(x.name)).join(', ') || 'none: an island surrounded by sea'
    const main = PALETTE[d.mainBiome] ? css(PALETTE[d.mainBiome]) : '#6a8'
    const volc = d.volcanoes ? `${d.volcanoes}${d.active ? ` · ${d.active} with a lava lake` : ''}` : 'none'
    panel.innerHTML = `
      <div class="enc-head">
        <span class="enc-swatch" style="background:${main}"></span>
        <div><div class="enc-kicker">Encyclopedia of Elyra · Land</div><div class="enc-title">${esc(n.name)}</div>
        <div class="enc-kind">${d.newLand ? 'One of the young lands' : esc(d.biomes[0]?.name || 'Land')} · uninhabited</div></div></div>
      <div class="enc-facts">
        <div><span>Area</span><b>${fmtInt(d.area)} km² · ${(d.landShare * 100).toFixed(1)}% of the land</b></div>
        <div><span>Heart of the land</span><b>${fmtLatLon(d.centerAt)}</b></div>
        <div><span>Highest point</span><b>${fmtInt(d.peak)} m <i>${fmtLatLon(d.peakAt)}</i></b></div>
        <div><span>Temperature</span><b>mean ${d.temp.toFixed(0)} °C · ${d.tempMin.toFixed(0)} to ${d.tempMax.toFixed(0)} °C</b></div>
        <div><span>Rivers and lakes</span><b>${(d.waterShare * 100).toFixed(1)}% of its surface</b></div>
        <div><span>Volcanoes</span><b>${volc}</b></div>
        <div><span>First Seed</span><b>${d.newLand ? 'seeds arrived later, on wind and sea' : d.seedKm < 600 ? 'it began here' : `reached after about ${d.weeks} week${d.weeks > 1 ? 's' : ''}`}</b></div>
        <div><span>Bordering lands</span><b>${nb}</b></div>
      </div>
      <h4>Biomes</h4>
      <div class="enc-bar">${bar}</div>
      <div class="enc-blist">${blist}</div>
      <h4>Typical flora</h4><p>${esc(d.flora.join(', '))}</p>
      <h4>Natural history</h4>${d.history.map((t) => `<p>${esc(t)}</p>`).join('')}`
    panel.classList.add('enc-nation')
    place(panel, anchor.x, anchor.y)
  }

  return { close, get open() { return open } }
}
