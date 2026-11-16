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
  ICE: 17
}

export const BIOME_NAME = {
  [BIOME.OCEAN_DEEP]: 'Oceano profondo',
  [BIOME.OCEAN]: 'Oceano',
  [BIOME.OCEAN_SHELF]: 'Piattaforma costiera',
  [BIOME.LAKE]: 'Lago',
  [BIOME.RIVER]: 'Fiume',
  [BIOME.BEACH]: 'Costa sabbiosa',
  [BIOME.DESERT]: 'Deserto caldo',
  [BIOME.SEMI_DESERT]: 'Steppa arida',
  [BIOME.SAVANNA]: 'Savana',
  [BIOME.GRASSLAND]: 'Prateria',
  [BIOME.SHRUBLAND]: 'Macchia',
  [BIOME.TEMPERATE_FOREST]: 'Foresta temperata',
  [BIOME.RAINFOREST]: 'Foresta pluviale',
  [BIOME.BOREAL_FOREST]: 'Taiga',
  [BIOME.TUNDRA]: 'Tundra',
  [BIOME.ROCK]: 'Roccia d\u2019alta quota',
  [BIOME.SNOW]: 'Neve perenne',
  [BIOME.ICE]: 'Calotta glaciale'
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
  [BIOME.ICE]: C(214, 228, 235)
}

/**
 * Classifica il bioma di un punto di terra emersa.
 * @param {number} height quota in metri
 * @param {number} temp temperatura media annua in °C
 * @param {number} moist umidità 0..1
 * @param {number} absLat latitudine assoluta in gradi
 * @returns {number} id del bioma
 */
export function classifyLandBiome(height, temp, moist, absLat) {
  // Altitudine: sopra la linea degli alberi prevale la roccia, poi la neve
  const snowLine = 5400 - absLat * 26
  if (height > snowLine + 260) return BIOME.SNOW
  if (height > snowLine) return BIOME.ROCK

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
