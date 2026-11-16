// Persistenza dello stato su localStorage.
// Piccolo, sincrono, nessun backend. Chiave versionata per poter migrare.

const STORAGE_KEY = 'ecosystem-planet/state'
const VERSION = 1

export function defaultState() {
  return {
    version: VERSION,
    seed: 20261116,
    view: {
      lat: 18,
      lon: 12,
      altitude: null,
      pitch: 90,
      heading: 0
    }
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    if (parsed.version !== VERSION) return null
    return parsed
  } catch (err) {
    console.warn('[save] stato non leggibile', err)
    return null
  }
}

export function saveState(state) {
  try {
    const payload = {
      version: VERSION,
      seed: state.seed,
      view: state.view,
      savedAt: new Date().toISOString()
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    return payload
  } catch (err) {
    console.warn('[save] impossibile salvare', err)
    return null
  }
}

export function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function hasState() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}
