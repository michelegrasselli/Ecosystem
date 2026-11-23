// Esagerazione verticale del rilievo.
//
// Su un pianeta di 6371 km una montagna di 7 km è lo 0.1% del raggio: dallo
// spazio e a scala regionale il rilievo non si percepisce. Come Google Earth,
// le quote vengono moltiplicate per un fattore che cresce con la quota della
// camera: vicino al suolo il terreno resta credibile, da lontano le catene
// montuose si leggono.
//
// Il fattore viene applicato nel vertex shader (le tile sono costruite a
// esagerazione 1), quindi cambia ogni frame senza ricostruire geometria.
// Chiunque debba appoggiare qualcosa sul terreno (camera, in futuro piante e
// animali) deve usare la stessa funzione.

import { clamp, smoothstep } from '../core/math.js'

export const RELIEF_NEAR = 1.7 // vicino al suolo
export const RELIEF_FAR = 6.5 // dallo spazio: catene e vulcani sporgono anche sul bordo del disco
export const RELIEF_MAX = RELIEF_FAR

/** Esagerazione geometrica in funzione della quota della camera (km). */
export function reliefExaggeration(altKm) {
  // sale prima di prima (da 4 km invece che da 8, pieno già a 1500 km): a
  // scala regionale le montagne devono già sembrare alte
  const t = smoothstep(Math.log(4), Math.log(1500), Math.log(clamp(altKm, 0.01, 1e6)))
  return RELIEF_NEAR + (RELIEF_FAR - RELIEF_NEAR) * t
}

/**
 * Esagerazione usata solo per le normali di illuminazione: più forte di quella
 * geometrica, così pendii e valli si leggono dall'ombreggiatura senza
 * deformare troppo le silhouette.
 */
export function shadingExaggeration(altKm) {
  const t = smoothstep(Math.log(3), Math.log(3000), Math.log(clamp(altKm, 0.01, 1e6)))
  return reliefExaggeration(altKm) * (1.35 + 0.85 * t)
}
