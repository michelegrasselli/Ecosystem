// Navigazione in stile Google Earth.
// Stato: posizione al suolo (lat/lon), quota, inclinazione (pitch), orientamento (heading).
// Il frame della camera è costruito esplicitamente: niente degenerazioni allo zenit.

import * as THREE from 'three'
import {
  SCENE_RADIUS,
  MIN_ALTITUDE,
  MAX_ALTITUDE
} from '../planet/constants.js'
import { clamp, smoothstep, damp, degToRad, radToDeg } from '../core/math.js'

const MIN_ALT_KM = MIN_ALTITUDE / 1000
const MAX_ALT_KM = MAX_ALTITUDE / 1000

const _dir = new THREE.Vector3()
const _east = new THREE.Vector3()
const _north = new THREE.Vector3()
const _hdir = new THREE.Vector3()
const _fwd = new THREE.Vector3()
const _right = new THREE.Vector3()
const _sup = new THREE.Vector3()
const _pos = new THREE.Vector3()
const _basis = new THREE.Matrix4()
const _sphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), SCENE_RADIUS)

export class GlobeControls {
  constructor(camera, domElement) {
    this.camera = camera
    this.dom = domElement

    // posizione al suolo
    this.lat = 18
    this.lon = 12
    this.altitude = SCENE_RADIUS * 2.6
    this.pitch = 90
    this.heading = 0

    // target smussati
    this.tLat = this.lat
    this.tLon = this.lon
    this.tAltitude = this.altitude
    this.tPitch = this.pitch
    this.tHeading = this.heading

    this.fov = 50
    // quota (esagerata) del terreno sotto la camera, in km: la quota della
    // camera è misurata dal suolo, come in Google Earth
    this.groundKm = 0
    this.autoPitch = true

    this._dragging = 0 // 1 = pan, 2 = tilt
    this._lastX = 0
    this._lastY = 0
    this._raycaster = new THREE.Raycaster()
    this._pointer = new THREE.Vector2()
    this._fly = null
    this._tweenTarget = null

    this._onWheel = this._onWheel.bind(this)
    this._onPointerDown = this._onPointerDown.bind(this)
    this._onPointerMove = this._onPointerMove.bind(this)
    this._onPointerUp = this._onPointerUp.bind(this)
    this._onDblClick = this._onDblClick.bind(this)
    this._onKeyDown = this._onKeyDown.bind(this)

    domElement.addEventListener('wheel', this._onWheel, { passive: false })
    domElement.addEventListener('pointerdown', this._onPointerDown)
    domElement.addEventListener('pointermove', this._onPointerMove)
    domElement.addEventListener('pointerup', this._onPointerUp)
    domElement.addEventListener('pointercancel', this._onPointerUp)
    domElement.addEventListener('dblclick', this._onDblClick)
    domElement.addEventListener('keydown', this._onKeyDown)
    domElement.tabIndex = 0

    this.applyImmediate()
  }

  get altitudeKm() {
    return this.altitude
  }

  /** Quota approssimativa della superficie sotto la camera, in km. */
  get groundRadius() {
    return SCENE_RADIUS
  }

  // ---------------------------------------------------------------- input

  _ndcFromEvent(e) {
    const r = this.dom.getBoundingClientRect()
    this._pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1
    this._pointer.y = -((e.clientY - r.top) / r.height) * 2 + 1
  }

  _groundHit() {
    this._raycaster.setFromCamera(this._pointer, this.camera)
    _sphere.radius = SCENE_RADIUS + this.groundKm
    const p = new THREE.Vector3()
    const hit = this._raycaster.ray.intersectSphere(_sphere, p)
    return hit ? p : null
  }

  _onWheel(e) {
    e.preventDefault()
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY
    const factor = Math.exp(clamp(delta, -400, 400) * 0.0016)

    // zoom verso il punto sotto il cursore
    this._ndcFromEvent(e)
    const hit = this._groundHit()
    if (hit && factor < 1) {
      const ll = pointToLatLon(hit)
      const blend = clamp(-Math.log(factor) * 1.6, 0, 0.5)
      this.tLat = lerpAngle(this.tLat, ll.lat, blend)
      this.tLon = this.tLon + shortestLonDelta(this.tLon, ll.lon) * blend
    }

    this.tAltitude = clamp(this.tAltitude * factor, MIN_ALT_KM, MAX_ALT_KM)
    if (this.autoPitch) this.autoPitch = true
  }

  _onPointerDown(e) {
    if (e.button === 0 && !e.shiftKey) this._dragging = 1
    else if (e.button === 2 || (e.button === 0 && e.shiftKey)) this._dragging = 2
    this._lastX = e.clientX
    this._lastY = e.clientY
    this.dom.setPointerCapture?.(e.pointerId)
    this._fly = null
    this._tweenTarget = null
  }

  _onPointerMove(e) {
    if (!this._dragging) return
    const dx = e.clientX - this._lastX
    const dy = e.clientY - this._lastY
    this._lastX = e.clientX
    this._lastY = e.clientY

    if (this._dragging === 1) {
      this._pan(dx, dy)
    } else {
      this.autoPitch = false
      this.tHeading = (this.tHeading - dx * 0.25) % 360
      this.tPitch = clamp(this.tPitch - dy * 0.22, 14, 90)
    }
  }

  _onPointerUp(e) {
    this._dragging = 0
    this.dom.releasePointerCapture?.(e.pointerId)
  }

  _pan(dx, dy) {
    const h = this.dom.clientHeight || 1
    const worldPerPixel =
      (2 * this.altitude * Math.tan(degToRad(this.fov) / 2)) / h
    const radPerPixel = worldPerPixel / SCENE_RADIUS

    const cosLat = Math.max(Math.cos(degToRad(this.lat)), 0.12)
    this.tLat = clamp(this.tLat + radToDeg(dy * radPerPixel), -89.9, 89.9)
    this.tLon = wrapLon(this.tLon - radToDeg(dx * radPerPixel) / cosLat)

    // durante il pan la camera segue subito: niente ritardo
    this.lat = this.tLat
    this.lon = this.tLon
  }

  _onDblClick(e) {
    this._ndcFromEvent(e)
    const hit = this._groundHit()
    if (!hit) return
    const ll = pointToLatLon(hit)
    this.flyTo(ll.lat, ll.lon, clamp(this.altitude * 0.35, MIN_ALT_KM, MAX_ALT_KM))
  }

  _onKeyDown(e) {
    if (e.key === 'PageUp' || e.key === '+') this.tAltitude = clamp(this.tAltitude * 0.7, MIN_ALT_KM, MAX_ALT_KM)
    if (e.key === 'PageDown' || e.key === '-') this.tAltitude = clamp(this.tAltitude / 0.7, MIN_ALT_KM, MAX_ALT_KM)
  }

  // --------------------------------------------------------------- azioni

  flyTo(lat, lon, altitude, duration = 1.6) {
    this._fly = {
      t: 0,
      duration,
      from: { lat: this.tLat, lon: this.tLon, alt: this.tAltitude },
      to: { lat, lon: wrapLon(this.tLon + shortestLonDelta(this.tLon, lon)), alt: altitude }
    }
  }

  goHome() {
    this.autoPitch = true
    this.flyTo(18, 12, SCENE_RADIUS * 2.6, 2.0)
    this.tHeading = 0
  }

  setPitch(p) {
    this.autoPitch = false
    this.tPitch = clamp(p, 14, 90)
  }

  nudge(dLat, dLon) {
    this.tLat = clamp(this.tLat + dLat, -89.9, 89.9)
    this.tLon = wrapLon(this.tLon + dLon)
  }

  // ------------------------------------------------------------- update

  update(dt) {
    if (this._fly) {
      const f = this._fly
      f.t += dt
      const k = clamp(f.t / f.duration, 0, 1)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      this.tLat = f.from.lat + (f.to.lat - f.from.lat) * e
      this.tLon = f.from.lon + (f.to.lon - f.from.lon) * e
      // zoom "a campana": si allontana prima di scendere
      const bump = Math.sin(Math.PI * e) * 0.45
      const altLog =
        Math.log(f.from.alt) * (1 - e) + Math.log(f.to.alt) * e + bump
      this.tAltitude = clamp(Math.exp(altLog), MIN_ALT_KM, MAX_ALT_KM)
      if (k >= 1) this._fly = null
    }

    // inclinazione automatica in base alla quota
    if (this.autoPitch) {
      const close = smoothstep(900, 30, this.altitude)
      // vicino al suolo la vista diventa radente, per guardare il paesaggio
      const ground = smoothstep(6, 0.06, this.altitude)
      this.tPitch = 90 - 24 * close - 46 * ground
    }

    const lambda = this._dragging ? 22 : 9
    this.altitude = damp(this.altitude, this.tAltitude, lambda, dt)
    this.pitch = damp(this.pitch, this.tPitch, 8, dt)
    this.heading = damp(this.heading, this.tHeading, 10, dt)
    this.lat = damp(this.lat, this.tLat, 16, dt)
    this.lon = damp(this.lon, this.tLon, 16, dt)

    this.applyImmediate()
  }

  applyImmediate() {
    const latRad = degToRad(this.lat)
    const lonRad = degToRad(this.lon)
    const cl = Math.cos(latRad)
    const sl = Math.sin(latRad)
    const cosLon = Math.cos(lonRad)
    const sinLon = Math.sin(lonRad)

    // base geografica destrorsa (est, nord, alto)
    _dir.set(cl * cosLon, sl, -cl * sinLon).normalize()
    _east.set(-sinLon, 0, -cosLon).normalize()
    _north.set(-sl * cosLon, cl, sl * sinLon).normalize()

    const hRad = degToRad(this.heading)
    _hdir
      .copy(_north)
      .multiplyScalar(Math.cos(hRad))
      .addScaledVector(_east, Math.sin(hRad))
      .normalize()

    const pRad = degToRad(this.pitch)
    const cosP = Math.cos(pRad)
    const sinP = Math.sin(pRad)

    // direzione di vista
    _fwd.copy(_hdir).multiplyScalar(cosP).addScaledVector(_dir, -sinP).normalize()

    // "alto" dello schermo: perpendicolare a _fwd nel piano (alto, direzione orizzontale)
    _sup.copy(_dir).multiplyScalar(cosP).addScaledVector(_hdir, sinP).normalize()

    // destra = vista × alto  (terna destrorsa: X × Y = Z, Z = -vista)
    _right.crossVectors(_fwd, _sup).normalize()
    // ri-ortogonalizza l'alto per sicurezza
    _sup.crossVectors(_right, _fwd).normalize()

    _pos.copy(_dir).multiplyScalar(SCENE_RADIUS + this.groundKm + this.altitude)

    _basis.makeBasis(_right, _sup, _fwd.clone().negate())
    this.camera.quaternion.setFromRotationMatrix(_basis)
    this.camera.position.copy(_pos)
    this.camera.near = 0.0004
    this.camera.far = 60000
    this.camera.updateProjectionMatrix()
    this.camera.updateMatrixWorld()
  }

  /** Direzione "in alto" locale (per il cielo). */
  getUp(out) {
    return out.copy(this.camera.position).normalize()
  }

  dispose() {
    const d = this.dom
    d.removeEventListener('wheel', this._onWheel)
    d.removeEventListener('pointerdown', this._onPointerDown)
    d.removeEventListener('pointermove', this._onPointerMove)
    d.removeEventListener('pointerup', this._onPointerUp)
    d.removeEventListener('pointercancel', this._onPointerUp)
    d.removeEventListener('dblclick', this._onDblClick)
    d.removeEventListener('keydown', this._onKeyDown)
  }
}

// ------------------------------------------------------------------ util

function wrapLon(lon) {
  let l = ((lon + 180) % 360 + 360) % 360 - 180
  return l
}

function shortestLonDelta(from, to) {
  let d = wrapLon(to) - wrapLon(from)
  if (d > 180) d -= 360
  if (d < -180) d += 360
  return d
}

function lerpAngle(a, b, t) {
  return a + (b - a) * t
}

function pointToLatLon(p) {
  const len = p.length() || 1
  const y = p.y / len
  const lat = radToDeg(Math.asin(clamp(y, -1, 1)))
  const lon = radToDeg(Math.atan2(-p.z, p.x))
  return { lat, lon }
}
