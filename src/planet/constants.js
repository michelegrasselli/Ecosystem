// Costanti fisiche e geografiche del pianeta.
// Le lunghezze sono in METRI a livello di generazione (planet/),
// e vengono convertite in unità di scena dal renderer.

export const PLANET_RADIUS = 6371000 // m
export const SCENE_SCALE = 1 / 1000 // 1 unità di scena = 1 km
export const SCENE_RADIUS = PLANET_RADIUS * SCENE_SCALE // 6371 unità

/** Quota 0 = livello del mare. Tutte le quote sono in metri sul livello del mare. */
export const SEA_LEVEL = 0

/** Soglia del campo di continentalità che separa terra e oceano. */
export const CONTINENT_THRESHOLD = 0.08

/** Massime profondità / altezze generate. */
export const MAX_OCEAN_DEPTH = 9200
export const MAX_LAND_RISE = 1450
export const MAX_MOUNTAIN_HEIGHT = 7800

/** Limiti di navigazione della camera (metri sopra la superficie). */
export const MIN_ALTITUDE = 25 // abbastanza vicino da vedere piante e animali
export const MAX_ALTITUDE = 42_000_000

/** Quota sotto la quale si attiva il terreno LOD (metri). */
export const LOD_ACTIVATE_ALTITUDE = 2_600_000

/** Livello massimo del quadtree. */
export const MAX_LOD_LEVEL = 17 // tile di ~76 m, maglie di ~1.7 m

/** Seed predefinito del pianeta. */
export const DEFAULT_SEED = 20261116

export const SUN_DIRECTION = { x: 0.62, y: 0.42, z: 0.66 }
