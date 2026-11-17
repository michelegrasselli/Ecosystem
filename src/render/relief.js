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

export const RELIEF_NEAR = 1.5 // vicino al suolo
export const RELIEF_FAR = 4.2 // dallo spazio
export const RELIEF_MAX = RELIEF_FAR

/** Esagerazione geometrica in funzione della quota della camera (km). */
export function reliefExaggeration(altKm) {
  const t = smoothstep(Math.log(8), Math.log(2500), Math.log(clamp(altKm, 0.01, 1e6)))
  return RELIEF_NEAR + (RELIEF_FAR - RELIEF_NEAR) * t
}

/**
 * Esagerazione usata solo per le normali di illuminazione: più forte di quella
 * geometrica, così pendii e valli si leggono dall'ombreggiatura senza
 * deformare troppo le silhouette.
 */
export function shadingExaggeration(altKm) {
  const t = smoothstep(Math.log(3), Math.log(3000), Math.log(clamp(altKm, 0.01, 1e6)))
  return reliefExaggeration(altKm) * (1.25 + 0.95 * t)
}
