// Sorgente di verità del pianeta: quota, clima e bioma per ogni punto della sfera.
// Deterministico: stesso seed => stesso identico pianeta, a qualunque risoluzione.

import { Noise3D, fbm, ridged } from '../core/noise.js'
import { clamp, smoothstep, lerp, degToRad, radToDeg } from '../core/math.js'
import {
  PLANET_RADIUS,
  CONTINENT_THRESHOLD,
  MAX_OCEAN_DEPTH,
  MAX_LAND_RISE,
  MAX_MOUNTAIN_HEIGHT
} from './constants.js'
import { BIOME, classifyLandBiome, classifySeaBiome, rgbFor } from './biomes.js'

export class Planet {
  constructor(seed = 1) {
    this.seed = seed | 0
    this.noise = new Noise3D(this.seed)
    this.noiseDetail = new Noise3D((this.seed ^ 0x9e3779b9) >>> 0)
    this._out = createSample()
  }

  /** Crea un oggetto riutilizzabile per il campionamento. */
  static createSample() {
    return createSample()
  }

  /**
   * Campiona il pianeta in una direzione unitaria.
   * @param {number} x @param {number} y @param {number} z direzione unitaria
   * @param {number} quality 0..1 — quanto dettaglio calcolare (LOD)
   * @param {object} [out] oggetto di output riutilizzabile
   */
  sample(x, y, z, quality = 1, out = this._out) {
    const n = this.noise
    const nd = this.noiseDetail
    const q = quality

    // ---------- 1. Domain warping ----------
    // Deforma le coordinate per ottenere coste organiche invece che "a bolle".
    const w1 = n.noise(x * 1.15 + 11.2, y * 1.15 + 3.7, z * 1.15 - 5.1)
    const w2 = n.noise(x * 1.15 - 7.3, y * 1.15 + 9.1, z * 1.15 + 2.9)
    const w3 = n.noise(x * 1.15 + 1.7, y * 1.15 - 6.2, z * 1.15 + 8.4)
    let px = x + 0.3 * w1
    let py = y + 0.3 * w2
    let pz = z + 0.3 * w3
    const pl = 1 / Math.sqrt(px * px + py * py + pz * pz)
    px *= pl
    py *= pl
    pz *= pl

    // ---------- 2. Continentalità ----------
    const base = fbm(n, px * 1.05, py * 1.05, pz * 1.05, 4)
    const macro = fbm(n, px * 0.48 + 31.7, py * 0.48 - 12.3, pz * 0.48 + 5.9, 2)
    const cont = base * 0.55 + macro * 0.45

    // ---------- 3. Latitudine ----------
    const absLat = Math.abs(radToDeg(Math.asin(clamp(y, -1, 1))))

    let height
    let isSea = cont <= CONTINENT_THRESHOLD

    if (isSea) {
      const t = clamp((CONTINENT_THRESHOLD - cont) / (1 + CONTINENT_THRESHOLD), 0, 1)
      height = -Math.pow(t, 0.82) * MAX_OCEAN_DEPTH
      // piattaforme continentali: acque basse vicino alle coste
      height *= lerp(0.55, 1, smoothstep(0.0, 0.16, t))
    } else {
      const l = clamp((cont - CONTINENT_THRESHOLD) / (1 - CONTINENT_THRESHOLD), 0, 1)
      height = Math.pow(l, 1.3) * MAX_LAND_RISE

      // ---------- 4. Catene montuose ----------
      const orogeny = smoothstep(0.02, 0.46, fbm(n, px * 2.7 - 13.1, py * 2.7 + 5.3, pz * 2.7 - 9.7, 3))
      const ridge = ridged(n, px * 3.6 + 2.4, py * 3.6 - 8.8, pz * 3.6 + 4.2, 5)
      const inland = smoothstep(0.015, 0.24, l)
      height += ridge * orogeny * inland * MAX_MOUNTAIN_HEIGHT

      // ---------- 5. Colline e micro-rilievo ----------
      if (q > 0.22) {
        height += fbm(nd, px * 9.5, py * 9.5, pz * 9.5, 2) * 150 * inland
      }
      if (q > 0.5) {
        height += fbm(nd, px * 26.0, py * 26.0, pz * 26.0, 2) * 38 * inland
      }
      if (q > 0.8) {
        height += fbm(nd, px * 68.0, py * 68.0, pz * 68.0, 2) * 9 * inland
      }
    }

    // ---------- 6. Clima ----------
    const tempBase = 27.8 - 56.0 * Math.pow(absLat / 90, 1.5)
    let temp = tempBase - Math.max(0, height) * 0.0063
    if (q > 0.2) temp += 2.6 * fbm(nd, px * 3.1 + 21.5, py * 3.1, pz * 3.1, 2)

    const moistNoise = fbm(n, px * 2.25 - 55.5, py * 2.25 + 17.1, pz * 2.25 - 33.3, 3)
    const bandDry = Math.exp(-Math.pow((absLat - 26) / 12.5, 2))
    const bandEq = Math.exp(-Math.pow(absLat / 12, 2))
    const bandMid = Math.exp(-Math.pow((absLat - 56) / 15, 2))
    let moist =
      0.44 +
      moistNoise * 0.46 +
      bandEq * 0.11 +
      bandMid * 0.06 -
      bandDry * 0.38 +
      smoothstep(1900, 0, height) * 0.12
    moist = clamp(moist, 0, 1)

    // ---------- 7. Calotte glaciali ----------
    let ice = 0
    if (!isSea) {
      ice = smoothstep(-4, -16, temp)
      if (ice > 0) height = lerp(height, Math.max(height, 900) + 500, ice)
    } else {
      ice = smoothstep(-6, -18, temp)
    }

    // ---------- 8. Laghi ----------
    let water = 0
    let isLake = false
    let isRiver = false
    let biome = BIOME.GRASSLAND

    if (!isSea && q > 0.3) {
      const lakeNoise = fbm(nd, px * 5.6 - 71.2, py * 5.6 + 29.4, pz * 5.6 - 13.8, 2)
      const flatness = smoothstep(2400, 180, height)
      const lakeMask = smoothstep(0.36, 0.68, lakeNoise) * flatness
      if (lakeMask > 0.5) {
        const bowl = smoothstep(0.5, 0.92, lakeMask)
        height = lerp(height, -14 - 130 * bowl, bowl)
        if (height <= 0) {
          height = 0
          water = 1
          isLake = true
          biome = BIOME.LAKE
        }
      }
    }

    // ---------- 9. Fiumi ----------
    if (!isSea && !isLake && q > 0.42 && height > 4 && height < 2600) {
      const riverField = fbm(nd, px * 13.0 + 41.5, py * 13.0 - 3.2, pz * 13.0 + 19.7, 2)
      const d = Math.abs(riverField)
      // larghezza ~600 m costanti: leggibile anche a LOD basso, stile cartografico
      const width = (600 / PLANET_RADIUS) * 13.0
      const river = 1 - smoothstep(0, width, d)
      if (river > 0.01) {
        const corridor = smoothstep(0.0, 0.2, moist + 0.35) * smoothstep(2800, 1400, height)
        const r = river * corridor
        if (r > 0.06) {
          height = lerp(height, Math.max(height - 22, 1.5), r)
          water = Math.max(water, r)
          isRiver = true
        }
      }
    }

    // ---------- 10. Bioma ----------
    if (isSea) {
      biome = classifySeaBiome(-height)
    } else if (isLake) {
      biome = BIOME.LAKE
    } else if (isRiver) {
      biome = BIOME.RIVER
    } else {
      if (ice > 0.5) {
        biome = BIOME.ICE
      } else if (height < 12 && absLat < 68 && moistureSandy(moistNoise, absLat)) {
        biome = BIOME.BEACH
      } else {
        biome = classifyLandBiome(height, temp, moist, absLat)
      }
    }

    // ---------- 11. Colore ----------
    const col = rgbFor(biome)
    let r = col[0]
    let g = col[1]
    let b = col[2]

    // variazione sottile per evitare superfici piatte
    const v = 1 + 0.12 * (moistNoise * 0.5 + 0.5 - 0.5)
    if (biome === BIOME.OCEAN_DEEP) {
      r = lerp(col[0], 0.05, smoothstep(0, 1, clamp((-height - 2600) / 6000, 0, 1)))
      g = lerp(col[1], 0.11, smoothstep(0, 1, clamp((-height - 2600) / 6000, 0, 1)))
      b = lerp(col[2], 0.19, smoothstep(0, 1, clamp((-height - 2600) / 6000, 0, 1)))
    } else if (!isSea && water === 0 && biome !== BIOME.LAKE && biome !== BIOME.BEACH) {
      r *= v
      g *= v
      b *= v
      const tint = smoothstep(35, 88, absLat)
      r *= 1 - 0.1 * tint
      g *= 1 - 0.1 * tint
      b *= 1 + 0.09 * tint
    }

    out.height = height
    out.water = water
    out.ice = ice
    out.biome = biome
    out.temp = temp
    out.moist = moist
    out.lat = radToDeg(Math.asin(clamp(y, -1, 1)))
    out.r = r
    out.g = g
    out.b = b
    return out
  }

  /**
   * Quota del terreno, senza calcolare il colore. Usata per la camera.
   * Ritorna un oggetto { height, water }.
   */
  heightAt(x, y, z, quality = 1) {
    const s = this.sample(x, y, z, quality, this._out)
    return s
  }

  /** Campiona da latitudine/longitudine in gradi. */
  sampleLatLon(lat, lon, quality = 1, out = this._out) {
    const la = degToRad(lat)
    const lo = degToRad(lon)
    const cl = Math.cos(la)
    return this.sample(cl * Math.cos(lo), Math.sin(la), -cl * Math.sin(lo), quality, out)
  }
}

/** Le spiagge non devono ricoprire tutta la costa: le rendiamo a chiazze. */
function moistureSandy(noiseValue, absLat) {
  const tropic = smoothstep(58, 30, absLat)
  return noiseValue > -0.05 + (1 - tropic) * 0.45
}

function createSample() {
  return {
    height: 0,
    water: 0,
    ice: 0,
    biome: BIOME.GRASSLAND,
    temp: 15,
    moist: 0.5,
    lat: 0,
    r: 0.5,
    g: 0.5,
    b: 0.5
  }
}
