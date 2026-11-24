// Bootstrap dell'applicazione: scena, pianeta, LOD, navigazione, HUD, persistenza.

import * as THREE from 'three'
import './ui/styles.css'

import { Planet } from './planet/planet.js'
import { DEFAULT_SEED, SUN_DIRECTION, SCENE_RADIUS, MIN_ALTITUDE } from './planet/constants.js'
import { reliefExaggeration, shadingExaggeration } from './render/relief.js'
import { damp, dirToLatLon } from './core/math.js'
import { createTerrainMaterial, setNations, updateNoiseFrame, RIPPLE_DIR, RIPPLE_K } from './render/materials.js'
import { Nations } from './planet/nations.js'
import { createNationLabels } from './ui/labels.js'
import { TerrainLOD } from './render/terrainLOD.js'
import { TilePool } from './render/tilePool.js'
import { createSky } from './render/sky.js'
import { createAtmosphere } from './render/atmosphere.js'
import { GlobeControls } from './camera/globeControls.js'
import { createHud } from './ui/hud.js'
import { loadState, saveState, defaultState } from './state/saveSystem.js'
import { createDirector } from './director/director.js'
import { createDirectorPanel } from './director/panel.js'

THREE.ColorManagement.enabled = false

// ---------------------------------------------------------------- canvas

const canvas = document.getElementById('scene')
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  logarithmicDepthBuffer: true,
  powerPreference: 'high-performance',
  stencil: false
})
// risoluzione nativa all'avvio; se la GPU ha margine si sale fino a un
// leggero supersampling (bordi più netti), senza mai scendere sotto 1
const NATIVE_PIXEL_RATIO = Math.max(window.devicePixelRatio || 1, 1)
const MAX_PIXEL_RATIO = Math.min(NATIVE_PIXEL_RATIO * 1.75, 2)
renderer.setPixelRatio(NATIVE_PIXEL_RATIO)
renderer.outputColorSpace = THREE.LinearSRGBColorSpace
renderer.setClearColor(0x05080c, 1)

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(50, 1, 0.0004, 60000)

// ---------------------------------------------------------------- stato

const saved = loadState()
const bootState = { ...defaultState(), ...(saved || {}) }
const seed = Number.isFinite(bootState.seed) ? bootState.seed : DEFAULT_SEED

const planet = new Planet(seed)
const terrainMaterial = createTerrainMaterial(SUN_DIRECTION)

// nazioni: deterministiche dal seed, confini nello shader, nomi in sovrimpressione
const nations = new Nations(planet)
setNations(terrainMaterial, nations)
const nationLabels = createNationLabels(nations, planet, document.body)
// generazione delle tile in Web Worker (stesso seed: pianeta identico)
const tilePool = new TilePool(seed)
const lod = new TerrainLOD(planet, scene, terrainMaterial, tilePool, nations)

const sky = createSky()
scene.add(sky.group)

const atmosphere = createAtmosphere()
scene.add(atmosphere.mesh)

const controls = new GlobeControls(camera, canvas)
controls.fov = camera.fov

// ripristino della vista salvata
const view = bootState.view || {}
if (Number.isFinite(view.lat)) {
  controls.lat = controls.tLat = view.lat
  controls.lon = controls.tLon = view.lon
}
if (Number.isFinite(view.altitude) && view.altitude > 0) {
  controls.altitude = controls.tAltitude = view.altitude
}
if (Number.isFinite(view.pitch)) controls.pitch = controls.tPitch = view.pitch
if (Number.isFinite(view.heading)) controls.heading = controls.tHeading = view.heading
if (Number.isFinite(view.altitude)) controls.autoPitch = false
controls.applyImmediate()

// ------------------------------------------------------------------ HUD

const hud = createHud({
  planet,
  nations,
  onSave: doSave,
  onHome: () => controls.goHome(),
  onZoomIn: () => {
    controls.tAltitude = Math.max(controls.tAltitude * 0.62, MIN_ALTITUDE / 1000)
  },
  onZoomOut: () => {
    controls.tAltitude = Math.min(controls.tAltitude / 0.62, SCENE_RADIUS * 6)
  }
})

// ------------------------------------------------------------- salvataggio

function doSave() {
  const payload = saveState({
    seed,
    view: {
      lat: controls.tLat,
      lon: controls.tLon,
      altitude: controls.tAltitude,
      pitch: controls.tPitch,
      heading: controls.tHeading
    }
  })
  if (payload) {
    hud.toast('planet saved')
    hud.flashSaved()
  } else {
    hud.toast('saving unavailable')
  }
}

canvas.addEventListener('contextmenu', (e) => e.preventDefault())

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault()
    doSave()
  }
})

// salvataggio automatico leggero della sola vista
window.addEventListener('beforeunload', () => {
  saveState({
    seed,
    view: {
      lat: controls.tLat,
      lon: controls.tLon,
      altitude: controls.tAltitude,
      pitch: controls.tPitch,
      heading: controls.tHeading
    }
  })
})

// ----------------------------------------------------------------- resize

let directorRef = null // impostato quando il regista è creato
function resize() {
  // durante anteprima e ripresa il formato lo decide il regista: un resize
  // della finestra (es. pannello nascosto) deformava l'immagine a metà video
  if (directorRef?.busy) return
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
}
window.addEventListener('resize', resize)
resize()

// --------------------------------------------------------------- loading

const loadingEl = document.getElementById('loading')
const loadingStep = document.getElementById('loading-step')
const loadingFill = document.getElementById('loading-fill')

const steps = [
  'generating continents…',
  'carving mountain ranges…',
  'climate and latitude belts…',
  'lakes and river network…',
  'composing biomes…'
]
let stepIndex = 0
const stepTimer = setInterval(() => {
  if (stepIndex < steps.length - 1) {
    stepIndex++
    loadingStep.textContent = steps[stepIndex]
    loadingFill.style.width = Math.round(((stepIndex + 1) / steps.length) * 88) + '%'
  }
}, 420)

let ready = false
function finishLoading() {
  if (ready) return
  ready = true
  clearInterval(stepTimer)
  loadingFill.style.width = '100%'
  loadingStep.textContent = 'ready'
  setTimeout(() => {
    loadingEl.classList.add('hidden')
    setTimeout(() => (loadingEl.style.display = 'none'), 700)
  }, 180)
}

// ------------------------------------------------------------- main loop

// Sole "da cartografo": per ora niente notte. Il sole segue la camera e
// illumina sempre la parte di pianeta inquadrata, da nord-ovest e a ~55° di
// altezza (la luce classica delle carte in rilievo: i pendii si leggono senza
// che l'occhio inverta valli e creste). SUN_DIRECTION resta il sole fisso per
// quando tornerà il ciclo giorno/notte.
const sunDir = new THREE.Vector3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z).normalize()
const _up = new THREE.Vector3()
const _north = new THREE.Vector3()
const _east = new THREE.Vector3()
function updateSun() {
  _up.copy(camera.position).normalize()
  _north.set(0, 1, 0).addScaledVector(_up, -_up.y)
  // ai poli il nord non è definito: si usa un asse fisso
  if (_north.lengthSq() < 1e-6) _north.set(1, 0, 0).addScaledVector(_up, -_up.x)
  _north.normalize()
  _east.crossVectors(_north, _up)
  sunDir.copy(_up).multiplyScalar(0.82).addScaledVector(_north, 0.4).addScaledVector(_east, -0.4).normalize()
  terrainMaterial.uniforms.uSunDir.value.copy(sunDir)
  atmosphere.material.uniforms.uSunDir.value.copy(sunDir)
}

const groundSample = Planet.createSample()

// ------------------------------------------------- punto puntato dal mouse
// L'HUD descrive il punto del terreno sotto il cursore (non il centro della
// vista). Fuori dalla finestra si torna al centro della vista; sullo spazio
// vuoto l'HUD mostra trattini.
const pointer = { x: 0, y: 0, inside: false }
canvas.addEventListener('pointermove', (e) => {
  pointer.x = e.clientX
  pointer.y = e.clientY
  pointer.inside = true
})
canvas.addEventListener('pointerleave', () => {
  pointer.inside = false
})
const _pickRay = new THREE.Raycaster()
const _pickNdc = new THREE.Vector2()
const _pickSphere = new THREE.Sphere(new THREE.Vector3(), SCENE_RADIUS)
const _pickHit = new THREE.Vector3()
const pickSample = Planet.createSample()

/**
 * Lat/lon del terreno sotto il cursore. Il raggio si interseca con una sfera
 * alla quota del terreno (con la stessa esagerazione del rilievo dello
 * shader), affinata in tre passi: sui rilievi il punto non "scivola" dietro.
 * @returns {{lat:number, lon:number}|null|undefined} undefined = cursore fuori
 *   dalla finestra, null = cursore sullo spazio
 */
function pickGround() {
  if (!pointer.inside || document.body.classList.contains('director-on')) return undefined
  const r = canvas.getBoundingClientRect()
  if (!(r.width > 0)) return undefined
  _pickNdc.set(((pointer.x - r.left) / r.width) * 2 - 1, -((pointer.y - r.top) / r.height) * 2 + 1)
  _pickRay.setFromCamera(_pickNdc, camera)
  const exag = reliefExaggeration(controls.altitude)
  let h = 0
  for (let k = 0; k < 3; k++) {
    _pickSphere.radius = SCENE_RADIUS + h
    if (!_pickRay.ray.intersectSphere(_pickSphere, _pickHit)) {
      if (k === 0) return null
      break
    }
    _pickHit.normalize()
    planet.sample(_pickHit.x, _pickHit.y, _pickHit.z, 1, pickSample)
    h = Math.max(pickSample.height, 0) * 0.001 * exag
  }
  return dirToLatLon(_pickHit.x, _pickHit.y, _pickHit.z)
}
let last = performance.now()
let frameCount = 0

/**
 * Un passo della simulazione (senza richiesta del frame successivo).
 * @param {object} [opts] usato dal regista (director/director.js):
 *   drive: { lat, lon, alt, pitch, heading } camera imposta dalla sceneggiatura
 *   viewportHeight / labelW / labelH: dimensioni dell'inquadratura (px)
 *   offline: ripresa fotogramma per fotogramma (niente risoluzione adattiva)
 *   clock: orologio virtuale in ms per l'animazione delle tile
 */
function step(dt, now, opts = {}) {
  if (opts.drive) {
    // la camera la decide la sceneggiatura: stato e bersagli coincidono,
    // quindi lo smorzamento dei controlli non aggiunge ritardi
    const d = opts.drive
    controls._fly = null
    controls.autoPitch = false
    controls.lat = controls.tLat = d.lat
    controls.lon = controls.tLon = d.lon
    controls.altitude = controls.tAltitude = d.alt
    controls.pitch = controls.tPitch = d.pitch
    controls.heading = controls.tHeading = d.heading
  }
  lod.clock = opts.clock ?? null
  // quota del terreno sotto la camera (con la stessa esagerazione dello shader)
  const exag = reliefExaggeration(controls.altitude)
  const gs = planet.sampleLatLon(controls.lat, controls.lon, 1, groundSample)
  const groundTarget = Math.max(gs.height, 0) * 0.001 * exag
  // sale subito (mai dentro una collina), scende con dolcezza
  controls.groundKm =
    groundTarget > controls.groundKm ? groundTarget : damp(controls.groundKm, groundTarget, 5, dt)

  controls.update(dt)
  updateSun()

  const altitudeKm = controls.altitude
  const viewportPx = opts.viewportHeight ?? window.innerHeight

  // budget di costruzione: generoso durante il caricamento, poi contenuto
  lod.buildBudgetMs = ready ? 6.5 : 46 // usato solo senza Web Worker
  lod.exaggeration = reliefExaggeration(altitudeKm)
  lod.update(camera, viewportPx)

  // uniform del terreno
  const u = terrainMaterial.uniforms
  u.uCameraPos.value.copy(camera.position)
  // origine del reticolo del rumore: multiplo di 64 km (vedi materials.js)
  u.uOrigin.value.set(
    Math.floor(camera.position.x / 64) * 64,
    Math.floor(camera.position.y / 64) * 64,
    Math.floor(camera.position.z / 64) * 64
  )
  u.uCamLocal.value.copy(camera.position).sub(u.uOrigin.value)
  updateNoiseFrame(terrainMaterial, u.uOrigin.value)
  u.uExag.value = reliefExaggeration(altitudeKm)
  u.uShadeExag.value = shadingExaggeration(altitudeKm)
  // fase delle increspature all'origine del reticolo, in doppia precisione
  const od = u.uOrigin.value.dot(RIPPLE_DIR)
  u.uRipplePhase.value = (od * RIPPLE_K) % (Math.PI * 2)
  u.uRipplePhase2.value = (od * (RIPPLE_K / 5)) % (Math.PI * 2)
  // confini: ben visibili a scala regionale, ancora leggibili dallo spazio
  // (opacità da 0.95 a 0.60 fra 1500 e 9000 km)
  u.uBorderAlpha.value = 0.95 - 0.35 * THREE.MathUtils.smoothstep(altitudeKm, 1500, 9000)
  terrainMaterial.uniforms.uTime.value = now * 0.001
  terrainMaterial.uniforms.uHazeDensity.value = 1 / (altitudeKm * 14 + 160)

  sky.update(camera, altitudeKm, Math.max(altitudeKm, 60))
  nationLabels.update(camera, altitudeKm, opts.labelW ?? window.innerWidth, opts.labelH ?? window.innerHeight, dt)
  atmosphere.update(altitudeKm)

  hud.update(
    {
      lat: controls.lat,
      lon: controls.lon,
      altitudeKm,
      pick: pickGround
    },
    dt
  )

  // risoluzione adattiva PRIMA del render: ridimensionare il drawing buffer
  // dopo aver disegnato mostra un frame con lo sfondo (lampo nero)
  if (!opts.offline && !opts.drive) adaptResolution(dt)

  renderer.render(scene, camera)
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1)
  last = now

  // il regista, quando è attivo, guida la scena (anteprima) o la gira
  // fotogramma per fotogramma per conto suo (ripresa)
  if (director.mode === 'preview') director.tick(dt, now)
  else if (director.mode !== 'render') step(dt, now)

  frameCount++
  if (!ready && frameCount > 1 && lod.stats.queued === 0 && lod.stats.inFlight === 0 && lod.stats.visible > 0) {
    finishLoading()
  }

  requestAnimationFrame(frame)
}

// ------------------------------------------------------------- regia
// Modalità regia: sceneggiature (episodes/*.json), anteprima 9:16 e ripresa
// in MP4 fotogramma per fotogramma. Vedi director/.
const director = createDirector({
  renderer,
  camera,
  lod,
  nationLabels,
  planet,
  terrainMaterial,
  // esagerazione del rilievo alla quota attuale (per appoggiare effetti sui vulcani)
  exaggeration: () => reliefExaggeration(controls.altitude),
  resize,
  stepScene: step
})
directorRef = director
const directorPanel = createDirectorPanel(director)

requestAnimationFrame(frame)

// debug in console
// `step` avanza la scena senza requestAnimationFrame (anteprima non visibile,
// catture di immagini): le catture restano possibili anche a finestra nascosta.
window.__planet = {
  planet,
  nations,
  nationLabels,
  controls,
  lod,
  scene,
  camera,
  renderer,
  director,
  directorPanel,
  step(frames = 1, dt = 1 / 60) {
    for (let i = 0; i < frames; i++) {
      const now = performance.now()
      last = now
      step(dt, now)
    }
  }
}

// ------------------------------------------------- risoluzione adattiva
// Da vicino lo shader del terreno disegna chiome, dune e prati per pixel: su
// GPU integrate il frame può superare il budget. Si riduce la risoluzione di
// rendering finché il frame non torna fluido, e la si rialza quando c'è margine.
//
// Cambiare risoluzione ricrea il drawing buffer: se la decisione avvenisse dopo
// il render, per un frame lo schermo mostrerebbe solo il colore di fondo (un
// lampo nero). Per questo la decisione viene presa prima di disegnare, e i
// cambi sono radi (isteresi + attesa) invece di inseguire ogni variazione.

// mai sotto la risoluzione nativa del canvas: sotto l'immagine è sfocata
const MIN_PIXEL_RATIO = NATIVE_PIXEL_RATIO
let frameEma = 1 / 60
let adaptTimer = 0
let adaptCooldown = 0
let slowWindows = 0
let fastWindows = 0

function adaptResolution(dt) {
  if (!ready || document.hidden) return
  frameEma += (dt - frameEma) * 0.08
  adaptTimer += dt
  adaptCooldown = Math.max(0, adaptCooldown - dt)
  if (adaptTimer < 1) return
  adaptTimer = 0

  const pr = renderer.getPixelRatio()
  // scendere è sempre concesso (protegge la fluidità); salire solo da fermi,
  // altrimenti la risoluzione "pompa" a ogni zoom
  const idle = controls.idleSeconds
  if (frameEma > 1 / 27) {
    slowWindows++
    fastWindows = 0
  } else if (frameEma < 1 / 56) {
    fastWindows++
    slowWindows = 0
  } else {
    slowWindows = 0
    fastWindows = 0
  }

  let next = pr
  if (slowWindows >= 2) next = Math.max(MIN_PIXEL_RATIO, pr - 0.12)
  else if (fastWindows >= 3 && idle > 0.6) next = Math.min(MAX_PIXEL_RATIO, pr + 0.08)

  if (Math.abs(next - pr) > 0.001 && adaptCooldown === 0) {
    renderer.setPixelRatio(next)
    resize()
    adaptCooldown = 2.4
    slowWindows = 0
    fastWindows = 0
  }
}
