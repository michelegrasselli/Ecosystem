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

/**
 * Parametri del campo di continentalità. Valori pensati per ottenere qualche
 * massa continentale grande (non un supercontinente, non un arcipelago).
 * Tenuti qui perché li usa anche tools/continents.mjs per la taratura.
 */
export const CONTINENT_TUNING = {
  bigScale: 0.6,
  medScale: 1.9,
  fineScale: 4.5,
  bigWeight: 0.35,
  medWeight: 0.65,
  fineWeight: 0.2
}

export class Planet {
  constructor(seed = 1, options = {}) {
    this.seed = seed | 0
    this.noise = new Noise3D(this.seed)
    this.noiseDetail = new Noise3D((this.seed ^ 0x9e3779b9) >>> 0)
    this.continentThreshold =
      options.continentThreshold ?? CONTINENT_THRESHOLD
    this._out = createSample()
  }

  /** Crea un oggetto riutilizzabile per il campionamento. */
  static createSample() {
    return createSample()
  }

  /**
   * Campiona il pianeta in una direzione unitaria.
   * Il risultato NON dipende dal livello LOD: geometria e colore devono essere
   * identici ovunque, altrimenti il confine tra tile di livello diverso si vede
   * come un quadrato di colore diverso (aliasando i fiumi sulle maglie grosse).
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
    let px = x + 0.17 * w1
    let py = y + 0.17 * w2
    let pz = z + 0.17 * w3
    const pl = 1 / Math.sqrt(px * px + py * py + pz * pz)
    px *= pl
    py *= pl
    pz *= pl

    // ---------- 2. Continentalità ----------
    // Tre scale con pesi molto diversi: le "placche" grandi decidono DOVE sta la
    // terraferma, le scale minori incidono solo la costa. Con pesi più simili tra
    // le ottave il pianeta diventava un arcipelago di macchie.
    const ct = CONTINENT_TUNING
    const big = fbm(n, px * ct.bigScale, py * ct.bigScale, pz * ct.bigScale, 2)
    const med = fbm(
      n,
      px * ct.medScale + 31.7,
      py * ct.medScale - 12.3,
      pz * ct.medScale + 5.9,
      3
    )
    const fine = fbm(
      n,
      px * ct.fineScale - 8.1,
      py * ct.fineScale + 4.4,
      pz * ct.fineScale - 2.7,
      3
    )
    let cont = big * ct.bigWeight + med * ct.medWeight + fine * ct.fineWeight

    // ---------- 3. Latitudine ----------
    const absLat = Math.abs(radToDeg(Math.asin(clamp(y, -1, 1))))

    // Continente polare australe (tipo Antartide): il polo nord ha già terre
    // ghiacciate, quello sud era solo oceano. Il bordo è inciso dal rumore.
    if (y < 0) {
      const polar = smoothstep(64, 80, absLat + fine * 9)
      cont = Math.max(cont, lerp(cont, 0.32, polar))
    }

    const threshold = this.continentThreshold
    let height
    // quota "di fondo" del continente, che varia su migliaia di km: è il pelo
    // dell'acqua dei laghi (quasi piatto sulla scala di un lago)
    let baseLevel = 0
    let isSea = cont <= threshold

    if (isSea) {
      const t = clamp((threshold - cont) / (1 + threshold), 0, 1)
      height = -Math.pow(t, 0.82) * MAX_OCEAN_DEPTH
      // piattaforme continentali: acque basse vicino alle coste
      height *= lerp(0.55, 1, smoothstep(0.0, 0.16, t))
    } else {
      const l = clamp((cont - threshold) / (1 - threshold), 0, 1)
      height = Math.pow(l, 1.3) * MAX_LAND_RISE
      baseLevel = height

      // ---------- 4. Catene montuose ----------
      // Fasce orogenetiche più estese di prima (più catene, anche vicino alle
      // coste, come Ande o Alpi scandinave) e un secondo sistema di sierre
      // minori a scala più piccola: più dislivelli e più cime sopra le nevi.
      const orogeny = smoothstep(-0.14, 0.36, fbm(n, px * 2.7 - 13.1, py * 2.7 + 5.3, pz * 2.7 - 9.7, 3))
      const ridge = ridged(n, px * 3.6 + 2.4, py * 3.6 - 8.8, pz * 3.6 + 4.2, 5)
      const inland = smoothstep(0.01, 0.16, l)
      height += ridge * orogeny * inland * MAX_MOUNTAIN_HEIGHT
      const sierraBelt = smoothstep(0.05, 0.4, fbm(n, px * 5.2 + 7.7, py * 5.2 - 1.9, pz * 5.2 + 3.3, 2))
      const sierra = ridged(n, px * 9.0 - 4.4, py * 9.0 + 6.1, pz * 9.0 - 2.8, 4)
      height += sierra * sierra * sierraBelt * inland * 3400
      // quota a grande scala (continente + catene): varia su centinaia di km
      baseLevel = height

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

      // rilievo di media scala (colline di 10-30 km): è quello che dà
      // "corpo" al terreno quando si scende da 900 km a poche decine di km.
      if (q > 0.5) {
        const hills =
          nd.noise(px * 235 + 4.7, py * 235 - 2.3, pz * 235 + 9.1) * 0.72 +
          nd.noise(px * 690 - 8.2, py * 690 + 5.5, pz * 690 - 1.4) * 0.28
        height += hills * 170 * inland
      }

      // ---------- 5b. Dettaglio locale ----------
      // Serve quando si scende a poche centinaia di metri dal suolo: senza,
      // il terreno da vicino è una superficie liscia. Creste secondarie sulle
      // montagne (~30-8 km), ondulazioni di ~2 km, dossi di ~400 m e ~80 m.
      // Come tutto il resto non dipende dal LOD.
      if (q > 0.5) {
        // Valli e crinali: senza, le catene sono altipiani lisci con pendenze
        // di pochi gradi e il rilievo non si legge. Ampiezza di ~2.5 km come
        // il dislivello tipico tra fondovalle e cresta.
        const mtn = ridge * orogeny * inland
        const mtnMask = smoothstep(0.03, 0.32, mtn)
        if (mtnMask > 0.001) {
          // coordinate deformate: crinali lunghi e sinuosi invece di bozze
          // tutte uguali a "cartone delle uova"
          const wx = nd.noise(px * 38 + 1.1, py * 38 - 2.7, pz * 38 + 4.4) * 0.007
          const wy = nd.noise(px * 38 - 5.3, py * 38 + 3.9, pz * 38 - 0.6) * 0.007
          const wz = nd.noise(px * 38 + 7.6, py * 38 + 0.2, pz * 38 - 8.1) * 0.007
          const crest = ridged(
            nd,
            (px + wx) * 105 + 3.3,
            (py + wy) * 105 - 7.1,
            (pz + wz) * 105 + 1.9,
            4
          )
          height += (crest - 0.4) * 2400 * mtnMask
        }
        // sulla costa il rilievo si spegne: niente pozze sotto il livello del mare
        const rough = (0.3 + 0.7 * inland + mtn * 5) * smoothstep(0.0, 0.04, l)
        // colline dolci (~6 km e ~2 km): il paesaggio visto da 1-5 km di quota
        height += nd.noise(px * 1050 - 2.4, py * 1050 + 6.6, pz * 1050 - 9.2) * 75 * rough
        height += nd.noise(px * 3200 + 1.3, py * 3200 - 4.1, pz * 3200 + 7.7) * 34 * rough
        height += nd.noise(px * 16000 - 6.2, py * 16000 + 2.8, pz * 16000 - 3.5) * 5.5 * rough
        height += nd.noise(px * 80000 + 9.4, py * 80000 - 1.6, pz * 80000 + 5.2) * 1.3 * rough
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
      // banchisa: il mare gelato diventa una lastra di ghiaccio piatta
      ice = smoothstep(-6, -16, temp + fine * 4)
    }
    let seaIce = false
    if (isSea && ice > 0.55) {
      seaIce = true
      height = 6
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
        // Il lago è al livello del bacino, non scavato fino al livello del
        // mare: con l'esagerazione del rilievo diventava un cratere
        const lakeLevel = Math.max(baseLevel - 200, 0)
        height = lerp(height, lakeLevel - 14 - 130 * bowl, bowl)
        if (height <= lakeLevel) {
          height = lakeLevel
          water = 1
          isLake = true
          biome = BIOME.LAKE
        }
      }
    }

    // ---------- 9. Fiumi ----------
    let valley = 0
    let riverAmount = 0
    if (!isSea && !isLake && q > 0.42 && height > 4 && height < 3800) {
      // Due reticoli fluviali sovrapposti: fiumi maggiori (letto ~3.2 km) e
      // affluenti più fitti (letto ~2 km). Per ciascuno conta la distanza
      // dall'isolinea in unità di larghezza del letto; vince la più vicina.
      // La larghezza NON dipende dal LOD.
      const f1 = Math.abs(fbm(nd, px * 13.0 + 41.5, py * 13.0 - 3.2, pz * 13.0 + 19.7, 2))
      const f2 = Math.abs(fbm(nd, px * 24.0 - 17.3, py * 24.0 + 28.6, pz * 24.0 - 6.4, 2))
      const t1 = f1 / ((3200 / PLANET_RADIUS) * 13.0)
      const t2 = f2 / ((2000 / PLANET_RADIUS) * 24.0)
      const minor = t2 < t1
      const t = minor ? t2 : t1
      // gli affluenti nascono più in alto e solo dove c'è abbastanza pioggia
      const corridor =
        smoothstep(0.0, 0.2, moist + (minor ? 0.2 : 0.35)) *
        smoothstep(3800, 2200, height)

      // fascia del letto (x2.2) per il colore, incisione alla larghezza vera
      riverAmount = (1 - smoothstep(0, 2.2, t)) * corridor
      const carve = (1 - smoothstep(0, 1, t)) * corridor
      if (carve > 0.02) {
        // in montagna il fiume scava una valle più profonda
        const depth = 26 + Math.max(height - 400, 0) * 0.05
        height = lerp(height, Math.max(height - depth, 1.5), carve)
      }
      if (riverAmount > 0.18) {
        water = Math.max(water, riverAmount)
        isRiver = true
      }

      // Fascia valliva: accompagna il corso del fiume anche dove l'acqua è
      // più sottile di una maglia.
      valley = (1 - smoothstep(2.2, 5.5, t)) * corridor
      if (!isRiver && valley > 0.05) {
        height = lerp(height, Math.max(height - 7, 1.5), valley)
      }
    }

    // ---------- 10. Bioma ----------
    out.mixCount = 1
    if (seaIce) {
      biome = BIOME.ICE
    } else if (isSea) {
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
        // rumore di "varietà" regionale: decide dove compaiono biomi più rari
        // (paludi, calanchi, saline) dentro le grandi fasce climatiche
        const variety = fbm(nd, px * 7.5 + 13.7, py * 7.5 - 4.2, pz * 7.5 + 8.8, 2)
        biome = classifyLandBiome(height, temp, moist, absLat, variety)
        // Transizioni morbide: si riclassifica il punto con il clima
        // leggermente spostato (±2.5 °C, ±0.05 di umidità, ±0.14 di varietà)
        // e si fa la media. Il confine netto tra due biomi diventa una fascia
        // sfumata larga qualche centinaio di km, come in natura.
        out.mix[0] = biome
        for (let k = 0; k < SOFT_OFFSETS.length; k++) {
          const o = SOFT_OFFSETS[k]
          out.mix[k + 1] = classifyLandBiome(
            height,
            temp + o[0],
            clamp(moist + o[1], 0, 1),
            absLat,
            variety + o[2]
          )
        }
        out.mixCount = SOFT_OFFSETS.length + 1
      }
    }
    out.mix[0] = biome

    // ---------- 11. Colore ----------
    // Roccia e neve d'alta quota le disegna lo shader seguendo la quota del
    // terreno: qui il colore di base resta quello del prato alpino, altrimenti
    // il bianco per vertice comparirebbe a scalini di maglia.
    let col = rgbFor(colorBiome(biome))
    if (out.mixCount > 1) {
      let mr = 0
      let mg = 0
      let mb = 0
      for (let k = 0; k < out.mixCount; k++) {
        const c = rgbFor(colorBiome(out.mix[k]))
        mr += c[0]
        mg += c[1]
        mb += c[2]
      }
      const inv = 1 / out.mixCount
      col = _mixCol
      col[0] = mr * inv
      col[1] = mg * inv
      col[2] = mb * inv
    }
    let r = col[0]
    let g = col[1]
    let b = col[2]

    // variazione di albedo: senza, il terreno sembra un tappeto di colore piatto.
    // Frequenza bassa (periodo ~600 km) di proposito: le maglie grosse (L2-L3,
    // 89-178 km) non devono aliasarla, altrimenti il confine tra livelli LOD
    // diventa un quadrato di colore diverso.
    const mottle = fbm(nd, px * 62 + 17.3, py * 62 - 9.8, pz * 62 + 3.6, 1)
    const v = 1 + 0.05 * moistNoise + 0.07 * mottle
    if (biome === BIOME.OCEAN_DEEP) {
      r = lerp(col[0], 0.05, smoothstep(0, 1, clamp((-height - 2600) / 6000, 0, 1)))
      g = lerp(col[1], 0.11, smoothstep(0, 1, clamp((-height - 2600) / 6000, 0, 1)))
      b = lerp(col[2], 0.19, smoothstep(0, 1, clamp((-height - 2600) / 6000, 0, 1)))
    } else if (!isSea && water === 0 && biome !== BIOME.LAKE && biome !== BIOME.BEACH) {
      // gradienti continui dentro il bioma: più verde dove è umido, più
      // giallo-bruno dove è secco, più spento dove è freddo
      const wet = clamp(moist - 0.45, -0.45, 0.45)
      const cold = smoothstep(8, -10, temp)
      r *= 1 - 0.18 * wet - 0.06 * cold
      g *= 1 + 0.06 * wet - 0.03 * cold
      b *= 1 - 0.10 * wet + 0.05 * cold
      r *= v
      g *= v
      b *= v
      const tint = smoothstep(35, 88, absLat)
      r *= 1 - 0.1 * tint
      g *= 1 - 0.1 * tint
      b *= 1 + 0.09 * tint
    }

    // la valle del fiume resta leggibile anche quando l'acqua è più sottile
    // di una maglia della griglia
    if (!isSea && valley > 0.02) {
      const k = Math.min(valley, 1)
      r = lerp(r, 0.30, 0.30 * k)
      g = lerp(g, 0.40, 0.28 * k)
      b = lerp(b, 0.46, 0.26 * k)
    }

    // l'acqua del fiume entra in modo continuo, senza scalini di bioma
    if (!isSea && riverAmount > 0.02) {
      const rc = RIVER_RGB
      const k = Math.min(riverAmount * 1.25, 1)
      const blend = 0.85
      r = lerp(r, rc[0], blend * k)
      g = lerp(g, rc[1], blend * k)
      b = lerp(b, rc[2], blend * k)
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

/** Colore dell'acqua dei fiumi (condiviso con la palette dei biomi). */
const RIVER_RGB = rgbFor(BIOME.RIVER)

/** Le spiagge non devono ricoprire tutta la costa: le rendiamo a chiazze. */
function moistureSandy(noiseValue, absLat) {
  const tropic = smoothstep(58, 30, absLat)
  return noiseValue > -0.05 + (1 - tropic) * 0.45
}

/** Spostamenti del clima per la classificazione morbida: [°C, umidità, varietà]. */
const SOFT_OFFSETS = [
  [2.5, 0, 0],
  [-2.5, 0, 0],
  [0, 0.05, 0],
  [0, -0.05, 0],
  [1.8, 0.035, 0.14],
  [-1.8, -0.035, -0.14]
]
const _mixCol = [0, 0, 0]

/** Roccia e neve d'alta quota le disegna lo shader: il colore di base è il prato alpino. */
function colorBiome(b) {
  return b === BIOME.ROCK || b === BIOME.SNOW ? BIOME.TUNDRA : b
}

function createSample() {
  return {
    mix: new Int32Array(8),
    mixCount: 1,
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
