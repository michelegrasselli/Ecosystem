// Classificazione dei biomi e palette "cartoon matura": colori desaturati,
// ombre profonde, niente toni pastello infantili.

import { clamp, smoothstep } from '../core/math.js'

export const BIOME = {
  OCEAN_DEEP: 0,
  OCEAN: 1,
  OCEAN_SHELF: 2,
  LAKE: 3,
  RIVER: 4,
  BEACH: 5,
  DESERT: 6,
  SEMI_DESERT: 7,
  SAVANNA: 8,
  GRASSLAND: 9,
  SHRUBLAND: 10,
  TEMPERATE_FOREST: 11,
  RAINFOREST: 12,
  BOREAL_FOREST: 13,
  TUNDRA: 14,
  ROCK: 15,
  SNOW: 16,
  ICE: 17,
  WETLAND: 18,
  BADLANDS: 19,
  SALT_FLAT: 20,
  ALPINE_MEADOW: 21,
  VOLCANIC: 22,
  LAVA: 23
}

export const BIOME_NAME = {
  [BIOME.OCEAN_DEEP]: 'Deep ocean',
  [BIOME.OCEAN]: 'Ocean',
  [BIOME.OCEAN_SHELF]: 'Coastal shelf',
  [BIOME.LAKE]: 'Lake',
  [BIOME.RIVER]: 'River',
  [BIOME.BEACH]: 'Sandy shore',
  [BIOME.DESERT]: 'Hot desert',
  [BIOME.SEMI_DESERT]: 'Arid steppe',
  [BIOME.SAVANNA]: 'Savanna',
  [BIOME.GRASSLAND]: 'Grassland',
  [BIOME.SHRUBLAND]: 'Scrubland',
  [BIOME.TEMPERATE_FOREST]: 'Temperate forest',
  [BIOME.RAINFOREST]: 'Rainforest',
  [BIOME.BOREAL_FOREST]: 'Taiga',
  [BIOME.TUNDRA]: 'Tundra',
  [BIOME.ROCK]: 'High rock',
  [BIOME.SNOW]: 'Permanent snow',
  [BIOME.ICE]: 'Ice sheet',
  [BIOME.WETLAND]: 'Wetland',
  [BIOME.BADLANDS]: 'Badlands',
  [BIOME.SALT_FLAT]: 'Salt flat',
  [BIOME.ALPINE_MEADOW]: 'Alpine meadow',
  [BIOME.VOLCANIC]: 'Volcanic slopes',
  [BIOME.LAVA]: 'Lava lake'
}

// Colori sRGB lineari, in [0,1]
const C = (r, g, b) => [r / 255, g / 255, b / 255]

export const PALETTE = {
  [BIOME.OCEAN_DEEP]: C(23, 57, 86),
  [BIOME.OCEAN]: C(34, 85, 118),
  [BIOME.OCEAN_SHELF]: C(58, 126, 150),
  [BIOME.LAKE]: C(52, 118, 138),
  [BIOME.RIVER]: C(58, 126, 146),
  [BIOME.BEACH]: C(205, 187, 143),
  [BIOME.DESERT]: C(197, 165, 108),
  [BIOME.SEMI_DESERT]: C(176, 158, 108),
  [BIOME.SAVANNA]: C(150, 152, 92),
  [BIOME.GRASSLAND]: C(122, 143, 86),
  [BIOME.SHRUBLAND]: C(122, 128, 84),
  [BIOME.TEMPERATE_FOREST]: C(82, 117, 76),
  [BIOME.RAINFOREST]: C(53, 105, 66),
  [BIOME.BOREAL_FOREST]: C(68, 96, 80),
  [BIOME.TUNDRA]: C(138, 140, 122),
  [BIOME.ROCK]: C(122, 115, 105),
  [BIOME.SNOW]: C(233, 238, 241),
  [BIOME.ICE]: C(214, 228, 235),
  [BIOME.WETLAND]: C(84, 108, 82),
  [BIOME.BADLANDS]: C(178, 112, 76),
  [BIOME.SALT_FLAT]: C(224, 217, 200),
  [BIOME.ALPINE_MEADOW]: C(128, 142, 92),
  // basalto scuro e lava incandescente
  [BIOME.VOLCANIC]: C(74, 66, 62),
  [BIOME.LAVA]: C(236, 96, 34)
}

/**
 * Classifica il bioma di un punto di terra emersa.
 * @param {number} height quota in metri
 * @param {number} temp temperatura media annua in °C
 * @param {number} moist umidità 0..1
 * @param {number} absLat latitudine assoluta in gradi
 * @param {number} [variety] rumore regionale in [-1, 1] per i biomi più rari
 * @returns {number} id del bioma
 */
/** Linea delle nevi: quota in metri all'equatore e calo per grado di latitudine. */
export const SNOW_LINE_BASE = 4500
export const SNOW_LINE_LAT = 30

export function classifyLandBiome(height, temp, moist, absLat, variety = 0) {
  // Altitudine: sopra la linea degli alberi prevale la roccia, poi la neve
  // linea delle nevi (stessa formula dello shader: render/materials.js)
  const snowLine = SNOW_LINE_BASE - absLat * SNOW_LINE_LAT
  if (height > snowLine + 260) return BIOME.SNOW
  if (height > snowLine) return BIOME.ROCK
  // prati d'alta quota sotto la fascia rocciosa
  if (height > snowLine - 1300 && temp > -6) return BIOME.ALPINE_MEADOW

  // biomi "rari" dentro le fasce climatiche, guidati dal rumore di varietà
  if (temp > 2 && moist > 0.52 && height < 260 && variety > 0.22) return BIOME.WETLAND
  if (temp > 14 && moist < 0.32 && moist > 0.08 && height > 450 && variety > 0.18) {
    return BIOME.BADLANDS
  }
  if (temp > 12 && moist < 0.16 && height < 500 && variety < -0.3) return BIOME.SALT_FLAT

  if (temp < -12) return BIOME.ICE
  if (temp < -3) return BIOME.TUNDRA

  // Fascia boreale
  if (temp < 5) {
    return moist > 0.34 ? BIOME.BOREAL_FOREST : BIOME.TUNDRA
  }

  // Fascia temperata
  if (temp < 15) {
    if (moist > 0.56) return BIOME.TEMPERATE_FOREST
    if (moist > 0.36) return BIOME.GRASSLAND
    if (moist > 0.2) return BIOME.SHRUBLAND
    return BIOME.SEMI_DESERT
  }

  // Fascia calda
  if (moist > 0.63) return BIOME.RAINFOREST
  if (moist > 0.46) return BIOME.TEMPERATE_FOREST
  if (moist > 0.28) return BIOME.SAVANNA
  if (moist > 0.15) return BIOME.SEMI_DESERT
  return BIOME.DESERT
}

/** Bioma marino in base alla profondità (positiva, metri). */
export function classifySeaBiome(depth) {
  if (depth > 2600) return BIOME.OCEAN_DEEP
  if (depth > 180) return BIOME.OCEAN
  return BIOME.OCEAN_SHELF
}

/** Rende un colore leggermente più caldo/freddo in base alla latitudine. */
export function latitudeTint(out, absLat) {
  const t = smoothstep(35, 85, absLat)
  const cool = 1 - 0.1 * t
  out[0] *= cool
  out[1] *= cool * 0.995
  out[2] *= 1 + 0.08 * t
  return out
}

export function rgbFor(biome) {
  return PALETTE[biome] || PALETTE[BIOME.GRASSLAND]
}

export { clamp, smoothstep }
