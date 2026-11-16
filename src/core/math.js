// Helper matematici condivisi.

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)
export const lerp = (a, b, t) => a + (b - a) * t
export const invLerp = (a, b, v) => (b - a === 0 ? 0 : (v - a) / (b - a))

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Smoothstep su un intervallo che può essere decrescente (edge0 > edge1). */
export function smoothstepSafe(edge0, edge1, x) {
  if (edge0 === edge1) return x >= edge1 ? 1 : 0
  return smoothstep(edge0, edge1, x)
}

/** Lerp esponenziale indipendente dal framerate. */
export function damp(a, b, lambda, dt) {
  return lerp(a, b, 1 - Math.exp(-lambda * dt))
}

const DEG = Math.PI / 180
const RAD = 180 / Math.PI
export const degToRad = (d) => d * DEG
export const radToDeg = (r) => r * RAD

/** Direzione unitaria da latitudine/longitudine (gradi). Longitudine 0 => +X, 90 => +Z. */
export function latLonToDir(lat, lon, out = { x: 0, y: 0, z: 0 }) {
  const la = lat * DEG
  const lo = lon * DEG
  const cl = Math.cos(la)
  out.x = cl * Math.cos(lo)
  out.y = Math.sin(la)
  out.z = cl * Math.sin(lo)
  return out
}

export function dirToLatLon(x, y, z) {
  const lat = Math.asin(clamp(y, -1, 1)) * RAD
  const lon = Math.atan2(z, x) * RAD
  return { lat, lon }
}

/** Angolo (radianti) tra due direzioni unitarie. */
export function angleBetween(ax, ay, az, bx, by, bz) {
  const dot = clamp(ax * bx + ay * by + az * bz, -1, 1)
  return Math.acos(dot)
}
