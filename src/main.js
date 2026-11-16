// Bootstrap dell'applicazione: scena, pianeta, LOD, navigazione, HUD, persistenza.

import * as THREE from 'three'
import './ui/styles.css'

import { Planet } from './planet/planet.js'
import { DEFAULT_SEED, SUN_DIRECTION, SCENE_RADIUS } from './planet/constants.js'
import { createTerrainMaterial } from './render/materials.js'
import { TerrainLOD } from './render/terrainLOD.js'
import { createSky } from './render/sky.js'
import { createAtmosphere } from './render/atmosphere.js'
import { GlobeControls } from './camera/globeControls.js'
import { createHud } from './ui/hud.js'
import { loadState, saveState, defaultState } from './state/saveSystem.js'

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
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75))
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
const lod = new TerrainLOD(planet, scene, terrainMaterial)

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
  onSave: doSave,
  onHome: () => controls.goHome(),
  onZoomIn: () => {
    controls.tAltitude = Math.max(controls.tAltitude * 0.62, 0.28)
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
    hud.toast('pianeta salvato')
    hud.flashSaved()
  } else {
    hud.toast('salvataggio non disponibile')
  }
}

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

function resize() {
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
  'generazione dei continenti…',
  'scultura delle catene montuose…',
  'clima e fasce latitudinali…',
  'laghi e reticolo fluviale…',
  'composizione dei biomi…'
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
  loadingStep.textContent = 'pronto'
  setTimeout(() => {
    loadingEl.classList.add('hidden')
    setTimeout(() => (loadingEl.style.display = 'none'), 700)
  }, 180)
}

// ------------------------------------------------------------- main loop

const sunDir = new THREE.Vector3(SUN_DIRECTION.x, SUN_DIRECTION.y, SUN_DIRECTION.z).normalize()
terrainMaterial.uniforms.uSunDir.value.copy(sunDir)
atmosphere.material.uniforms.uSunDir.value.copy(sunDir)

let last = performance.now()
let frameCount = 0

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.1)
  last = now

  controls.update(dt)

  const altitudeKm = controls.altitude
  const viewportPx = window.innerHeight

  // budget di costruzione: generoso durante il caricamento, poi contenuto
  lod.buildBudgetMs = ready ? 6.5 : 46
  lod.update(camera, viewportPx)

  // uniform del terreno
  terrainMaterial.uniforms.uCameraPos.value.copy(camera.position)
  terrainMaterial.uniforms.uTime.value = now * 0.001
  terrainMaterial.uniforms.uHazeDensity.value = 1 / (altitudeKm * 7.5 + 55)

  sky.update(camera, altitudeKm, Math.max(altitudeKm, 60))
  atmosphere.update(altitudeKm)

  hud.update(
    {
      lat: controls.lat,
      lon: controls.lon,
      altitudeKm
    },
    dt
  )

  renderer.render(scene, camera)

  frameCount++
  if (!ready && frameCount > 1 && lod.stats.built === 0 && lod.stats.visible > 0) {
    finishLoading()
  }

  requestAnimationFrame(frame)
}

requestAnimationFrame(frame)

// debug in console
window.__planet = { planet, controls, lod, scene, camera, renderer }
