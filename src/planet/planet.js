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
import { BIOME, classifyLandBiome, classifySeaBiome, rgbFor, SNOW_LINE_BASE, SNOW_LINE_LAT } from './biomes.js'
import { nearestFeature, createFeatureSample } from './features.js'

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
    this._vf = createFeatureSample()
    // vulcani: lista fissa, scelta dopo che il resto del pianeta esiste
    this.volcanoes = []
    this.volcanoes = pickVolcanoes(this)
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

      // Rilievo del fondale: senza, l'oceano era una conca liscia e da sopra
      // non si capiva dove fosse profondo. Lontano dalle coste: dorsali
      // oceaniche (creste lunghe che salgono di ~2 km), fosse più profonde ai
      // piedi delle scarpate e colline abissali. Il fondale non emerge mai.
      if (q > 0.2) {
        const open = smoothstep(0.04, 0.3, t)
        const mor = ridged(n, px * 1.7 + 13.3, py * 1.7 - 5.1, pz * 1.7 + 27.9, 4)
        height += (mor - 0.42) * 2800 * open
        // fossa: stretta fascia profonda dove la scarpata incontra l'abisso
        const trench = Math.exp(-Math.pow((t - 0.17) / 0.035, 2))
        const trenchMask = smoothstep(0.1, 0.4, fbm(n, px * 2.3 - 8.8, py * 2.3 + 3.1, pz * 2.3 - 6.6, 2))
        height -= trench * trenchMask * 2600
        height += fbm(nd, px * 16 + 2.2, py * 16 - 7.5, pz * 16 + 1.1, 2) * 420 * open
        if (open > 0) height = Math.min(height, -60)
      }
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
          // Una vera catena: pochi massicci larghi (~130 km) che si dividono in
          // creste via via più strette fino a ~4 km, con valli ampie e lisce in
          // mezzo (multifrattale "ridged": i dettagli fini nascono solo sulle
          // creste, non sui fondovalle). Prima le creste partivano da ~60 km e
          // sopra c'era rumore isotropo: un tappeto di bozze tutte uguali.
          const wx = nd.noise(px * 22 + 1.1, py * 22 - 2.7, pz * 22 + 4.4) * 0.012
          const wy = nd.noise(px * 22 - 5.3, py * 22 + 3.9, pz * 22 - 0.6) * 0.012
          const wz = nd.noise(px * 22 + 7.6, py * 22 + 0.2, pz * 22 - 8.1) * 0.012
          const crest = ridged(
            nd,
            (px + wx) * 48 + 3.3,
            (py + wy) * 48 - 7.1,
            (pz + wz) * 48 + 1.9,
            6
          )
          height += (crest - 0.36) * 3400 * mtnMask
        }
        // sulla costa il rilievo si spegne: niente pozze sotto il livello del mare
        // in montagna il rumore fine si spegne quasi del tutto: il dettaglio
        // lo danno le creste (sopra); colline e dossi restano in pianura
        const rough = ((0.3 + 0.7 * inland) * (1 - 0.75 * mtnMask) + 0.25 * mtnMask) * smoothstep(0.0, 0.04, l)
        // colline dolci (~6 km e ~2 km): il paesaggio visto da 1-5 km di quota
        height += nd.noise(px * 1050 - 2.4, py * 1050 + 6.6, pz * 1050 - 9.2) * 75 * rough
        height += nd.noise(px * 3200 + 1.3, py * 3200 - 4.1, pz * 3200 + 7.7) * 34 * rough
        height += nd.noise(px * 16000 - 6.2, py * 16000 + 2.8, pz * 16000 - 3.5) * 5.5 * rough
        height += nd.noise(px * 80000 + 9.4, py * 80000 - 1.6, pz * 80000 + 5.2) * 1.3 * rough
      }
    }

    // ---------- 5c. Vulcani ----------
    // Vulcani sparsi per il mondo (lista fissa scelta dal seed, vedi
    // pickVolcanoes): coni di 38-140 km di raggio e isole vulcaniche. Fianchi
    // concavi con costole radiali, cratere largo con orlo rialzato e fondo
    // piatto. Attorno: campi di colate (lobi irregolari) e, per alcuni, una
    // zona di terra bruciata. Gli attivi hanno un lago di lava nel cratere e
    // colate incandescenti sui fianchi: out.lava (0..1) le segnala allo shader,
    // che le disegna luminose e animate; out.burn la terra bruciata.
    // Centri e distanze sulla direzione NON deformata (x, y, z): coni rotondi.
    let volc = 0
    let lava = false
    let lavaField = 0
    let fieldHot = false
    let molten = 0
    let burn = 0
    // distanza dal vulcano più vicino (in raggi del cono) e se è attivo:
    // servono ai fiumi di lava (sezione 9)
    let volcDist = Infinity
    let volcHot = false
    {
      let best = Infinity
      let bv = null
      const vs = this.volcanoes
      for (let i = 0; i < vs.length; i++) {
        const v = vs[i]
        const dx = x - v.x
        const dy = y - v.y
        const dz = z - v.z
        const d2 = dx * dx + dy * dy + dz * dz
        // colate e terra bruciata arrivano più lontano del cono
        const lim = v.r * Math.max(1.3 + 2.5 * v.field, 1.3 + 2.0 * v.burn)
        if (d2 < lim * lim) {
          const sv = Math.sqrt(d2) / v.r
          if (sv < best) {
            best = sv
            bv = v
          }
        }
      }
      if (bv) {
        volcDist = best
        volcHot = bv.lava
        // contorno non perfettamente circolare
        const sp = best * (1 + 0.12 * nd.noise(px * 260 + 3.1, py * 260 - 7.4, pz * 260 + 1.6))
        const H = bv.H
        const peak = (isSea ? 0 : baseLevel) + H
        // angolo attorno al centro (canaloni, lobi delle colate)
        const ddx = x - bv.x
        const ddy = y - bv.y
        const ddz = z - bv.z
        const ang = Math.atan2(
          ddx * bv.e2[0] + ddy * bv.e2[1] + ddz * bv.e2[2],
          ddx * bv.e1[0] + ddy * bv.e1[1] + ddz * bv.e1[2]
        )
        // rumore lungo l'angolo (periodico sul giro) che cambia con la
        // distanza: lobi irregolari che serpeggiano, mai una stella regolare
        const ca = Math.cos(ang) * 1.3
        const sa = Math.sin(ang) * 1.3
        const lobeN =
          nd.noise(ca + bv.x * 40, sa + bv.y * 40, best * 0.55 + bv.z * 40) * 0.75 +
          nd.noise(ca * 2.6 - bv.y * 30, sa * 2.6 + bv.z * 30, best * 1.4 - bv.x * 30) * 0.35
        const lobe = smoothstep(-0.35, 0.65, lobeN)

        // terra bruciata: un alone largo e frastagliato attorno al cono
        if (bv.burn > 0 && !isSea) {
          const reachB = 1.5 + 1.8 * bv.burn * (0.45 + 0.55 * (1 - lobe))
          const eB = 1 + 0.2 * nd.noise(px * 500 + 6.6, py * 500 - 4.4, pz * 500 + 1.2)
          burn = bv.burn * (1 - smoothstep(reachB * 0.55, reachB, best * eB))
        }

        // campi di colate: fino a ~3.3 raggi
        if (bv.field > 0 && !isSea) {
          const reach = 0.8 + 2.5 * bv.field * lobe
          const edge = 1 + 0.16 * nd.noise(px * 900 - 3.3, py * 900 + 2.2, pz * 900 - 7.7)
          lavaField =
            (1 - smoothstep(reach - 0.35, reach + 0.05, best * edge)) * smoothstep(0.1, 0.3, best)
          if (lavaField > 0) {
            // colate fresche: un po' in rilievo, a lingue
            height += 35 * lavaField + nd.noise(px * 6000 + 1.4, py * 6000 - 3.6, pz * 6000 + 2.5) * 12 * lavaField
            fieldHot = bv.lava
            // crepe ancora incandescenti nelle colate degli attivi
            if (fieldHot) {
              const crack = 1 - Math.abs(nd.noise(px * 9000 - 2.1, py * 9000 + 6.7, pz * 9000 - 4.3))
              // rade e solo vicino al cono: le colate lontane si sono già spente
              const nearCone = 1 - smoothstep(0.7, 1.25, best)
              molten = Math.max(molten, smoothstep(0.975, 0.992, crack) * lavaField * nearCone * 0.5)
            }
          }
        }

        if (sp < 1) {
          // in mare il profilo è più pieno: l'isola emersa è larga
          const w = Math.pow(1 - sp, isSea ? 1.45 : 2.3)
          height = lerp(height, peak, w)
          // canaloni radiali sui fianchi
          const wob = nd.noise(px * 140 + 2.7, py * 140 - 6.1, pz * 140 + 4.4) * 1.8
          const rib = Math.abs(Math.sin(ang * bv.ribs + wob))
          height += (rib - 0.6) * H * 0.07 * w * smoothstep(0.08, 0.3, sp)
          // colate e calanchi
          height += nd.noise(px * 1800 + 5.5, py * 1800 - 2.2, pz * 1800 + 8.1) * 90 * w

          // colate incandescenti degli attivi: 4 canali che scendono dal
          // cratere, sempre più stretti e spenti verso valle
          if (bv.lava) {
            const ch = Math.abs(Math.sin(ang * 2 + bv.phase + wob * 0.35))
            const wch = 0.07 * (1 - smoothstep(0.15, bv.flowLen, sp)) + 0.012
            const flow =
              (1 - smoothstep(wch * 0.5, wch, ch)) *
              smoothstep(VOLC_CRATER * 0.9, VOLC_CRATER * 1.3, sp) *
              (1 - smoothstep(bv.flowLen - 0.12, bv.flowLen, sp))
            if (flow > 0) {
              molten = Math.max(molten, flow * 0.95)
              height -= 25 * flow // il canale scava appena il fianco
            }
          }
          if (isSea && height > 0) baseLevel = 0
        }

        // Cratere: largo (~15% del raggio), fondo piatto, pareti ripide e
        // orlo rialzato; negli attivi il fondo è un lago di lava.
        if (sp < VOLC_CRATER * 1.5) {
          const c = sp / VOLC_CRATER
          height += H * 0.035 * Math.exp(-Math.pow((c - 1) / 0.22, 2))
          height -= H * 0.13 * (1 - smoothstep(0.62, 1.0, c))
          if (bv.lava) {
            const lake = 1 - smoothstep(0.62, 0.78, c)
            if (lake > 0) molten = Math.max(molten, lake)
            lava = lake > 0.5
          }
        }

        // roccia scura solo sul cono alto
        volc = 1 - smoothstep(0.22, 0.55, sp)
      }
    }

    // ---------- 5d. Arcipelaghi ----------
    const vf = this._vf
    // Solo in mare, in fasce dedicate: isole di 6-16 km circondate da una
    // piattaforma di acqua bassa, più una manciata di isolotti di 2-4 km.
    let islandLand = 0
    if (isSea) {
      const aProv = smoothstep(0.08, 0.26, fbm(n, px * 2.7 - 47.1, py * 2.7 + 8.2, pz * 2.7 + 61.5, 2))
      if (aProv > 0) {
        const edge = 1 + 0.3 * nd.noise(px * 900 - 1.7, py * 900 + 6.3, pz * 900 - 4.9)
        const layers = ISLAND_LAYERS
        for (let k = 0; k < layers.length; k++) {
          const L = layers[k]
          nearestFeature(x, y, z, L.cell, this.seed ^ L.salt, L.prob * aProv, L.rMin, L.rMax, vf)
          if (vf.s >= 2) continue
          const sp = vf.s * edge
          // piattaforma: acqua bassa attorno all'isola
          const shelf = 1 - smoothstep(0.9, 2.0, sp)
          height = lerp(height, Math.max(height, -70), shelf)
          if (sp < 1) {
            const land = smoothstep(1.0, 0.8, sp)
            const top = 12 + (L.hMin + L.hRange * ((vf.id * 5.1) % 1)) * Math.pow(1 - sp, 1.4)
            height = Math.max(height, lerp(-40, top, land))
            islandLand = Math.max(islandLand, land)
          }
        }
      }
    }

    // un vulcano o un'isola possono aver fatto emergere il fondale
    if (isSea && height > 0) {
      isSea = false
      baseLevel = 0
      // colline sulle isole (la terraferma le ha dai passi 5 e 5b)
      if (q > 0.5) {
        const k = Math.max(islandLand, volc)
        height += nd.noise(px * 1050 - 2.4, py * 1050 + 6.6, pz * 1050 - 9.2) * 40 * k
        height += nd.noise(px * 3200 + 1.3, py * 3200 - 4.1, pz * 3200 + 7.7) * 18 * k
        height = Math.max(height, 1)
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

    if (!isSea && q > 0.3 && Math.max(volc, lavaField, burn) < 0.3) {
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
    let lavaChannel = 0
    let riverAmount = 0
    // Nelle aree vulcaniche (cono, campi di colate, terra bruciata) l'acqua
    // non scorre: i fiumi che arrivano da fuori si esauriscono al bordo. Sui
    // campi degli attivi lo stesso reticolo diventa di FIUMI DI LAVA, che si
    // spengono allontanandosi dal cono (o arrivano al mare se è vicino).
    const volcArea = Math.max(volc, lavaField, burn)
    const waterK = 1 - smoothstep(0.08, 0.45, volcArea)
    if (!isSea && !isLake && volc < 0.3 && q > 0.42 && height > 4 && height < 3800) {
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
        smoothstep(3800, 2200, height) *
        waterK

      // fiumi di lava: solo attorno ai vulcani attivi, dentro l'area
      // vulcanica, sempre più sottili e spenti verso valle
      if (volcHot && volcArea > 0.05) {
        const heat = (1 - smoothstep(0.4, 2.4, volcDist)) * smoothstep(0.05, 0.4, volcArea)
        // solo il reticolo maggiore, con un letto largo (~7 km): più stretto
        // della maglia del terreno appariva come una fila di puntini
        const lavaRiver = (1 - smoothstep(0.9, 2.2, t1)) * heat * smoothstep(3800, 2600, height)
        if (lavaRiver > 0.02) {
          molten = Math.max(molten, lavaRiver * 0.85)
          height = lerp(height, Math.max(height - 18, 1.5), lavaRiver)
          lavaChannel = Math.max(lavaChannel, lavaRiver)
        }
      }

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
      // vulcani: lava nel cratere degli attivi, fianchi di roccia scura
      // (sopra la linea delle nevi resta la neve, la disegna lo shader)
      if (ice <= 0.5) {
        const snowLine = SNOW_LINE_BASE - absLat * SNOW_LINE_LAT
        if (lava) {
          biome = BIOME.LAVA
          out.mixCount = 1
        } else if (volc > 0.5 && height < snowLine) {
          biome = BIOME.VOLCANIC
          out.mixCount = 1
        } else if (lavaField > 0.5 && height < snowLine && biome !== BIOME.RIVER) {
          biome = BIOME.LAVA_FIELD
          out.mixCount = 1
        } else if (burn > 0.5 && biome !== BIOME.RIVER) {
          biome = BIOME.SCORCHED
          out.mixCount = 1
        }
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
    // i fianchi del vulcano sfumano nel paesaggio attorno
    if (!isSea && volc > 0 && biome !== BIOME.LAVA && biome !== BIOME.LAKE && biome !== BIOME.RIVER) {
      const k = volc * volc * (3 - 2 * volc) * 0.85
      r = lerp(r, VOLCANIC_RGB[0], k)
      g = lerp(g, VOLCANIC_RGB[1], k)
      b = lerp(b, VOLCANIC_RGB[2], k)
    }
    // terra bruciata: suolo carbonizzato grigio-bruno, cenere a chiazze
    if (!isSea && burn > 0 && biome !== BIOME.LAKE && biome !== BIOME.RIVER) {
      const k = burn * burn * (3 - 2 * burn) * 0.85
      const ash = 0.8 + 0.4 * smoothstep(-0.3, 0.6, nd.noise(px * 700 + 3.9, py * 700 - 2.6, pz * 700 + 8.8))
      r = lerp(r, SCORCHED_RGB[0] * ash, k)
      g = lerp(g, SCORCHED_RGB[1] * ash, k)
      b = lerp(b, SCORCHED_RGB[2] * ash, k)
    }
    // campi di lava: basalto quasi nero; sui vulcani attivi crepe arancioni
    if (!isSea && lavaField > 0 && biome !== BIOME.LAKE && biome !== BIOME.RIVER) {
      // colate recenti quasi nere; quelle vecchie (vulcani dormienti) più
      // chiare, grigio-brune, con chiazze di vegetazione che le ricolonizza
      const old = fieldHot ? 0 : 1
      const regrow = old * smoothstep(0.1, 0.6, nd.noise(px * 1400 + 4.4, py * 1400 - 8.1, pz * 1400 + 2.9))
      const k = lavaField * lavaField * (3 - 2 * lavaField) * (fieldHot ? 0.92 : 0.72) * (1 - 0.6 * regrow)
      const tone = 1 + 0.18 * nd.noise(px * 400 - 1.7, py * 400 + 5.2, pz * 400 - 9.3) + 0.35 * old
      r = lerp(r, LAVA_FIELD_RGB[0] * tone * 1.08, k)
      g = lerp(g, LAVA_FIELD_RGB[1] * tone, k)
      b = lerp(b, LAVA_FIELD_RGB[2] * tone * 0.95, k)
      // (le crepe incandescenti le disegna lo shader da out.lava)
    }

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
    } else if (!isSea && water === 0 && biome !== BIOME.LAKE && biome !== BIOME.BEACH && biome !== BIOME.LAVA) {
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

    // letto dei fiumi di lava: basalto scuro (il bagliore lo aggiunge lo shader da out.lava)
    if (!isSea && lavaChannel > 0.02) {
      const k = Math.min(lavaChannel * 1.2, 1) * 0.9
      r = lerp(r, 0.13, k)
      g = lerp(g, 0.085, k)
      b = lerp(b, 0.07, k)
    }

    out.height = height
    out.water = water
    out.ice = ice
    out.lava = molten
    out.burn = Math.max(burn, isSea ? 0 : lavaField * 0.6)
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

/** Vulcani: quanti, raggio del cono (sfera unitaria: 0.01 = 64 km, quindi 40-95 km), cratere. */
const VOLC_LAND = 30
const VOLC_SEA = 16
const VOLC_R_MIN = 0.006
const VOLC_R_MAX = 0.022
const VOLC_CRATER = 0.15
/** Distanza minima tra due vulcani (radianti, ~950 km): sparsi, mai a grappolo. */
const VOLC_SEPARATION = 0.15

/**
 * Sceglie i vulcani del pianeta: qualche cono sulla terraferma e qualche isola
 * vulcanica in mare aperto, ben distanziati, lontani dai poli. Deterministico
 * dal seed. Va chiamata con planet.volcanoes vuoto (serve sapere dov'è il mare
 * senza vulcani).
 */
function pickVolcanoes(planet) {
  let a = (planet.seed ^ 0x2f6b1e93) >>> 0
  const rand = () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const smp = createSample()
  const out = []
  let land = 0
  let sea = 0
  const minDot = Math.cos(VOLC_SEPARATION)
  for (let tries = 0; tries < 4000 && (land < VOLC_LAND || sea < VOLC_SEA); tries++) {
    const yy = (rand() * 2 - 1) * 0.86 // niente vulcani oltre ~60° di latitudine
    const th = rand() * Math.PI * 2
    const rr = Math.sqrt(1 - yy * yy)
    const vx = Math.cos(th) * rr
    const vz = Math.sin(th) * rr
    if (out.some((v) => v.x * vx + v.y * yy + v.z * vz > minDot)) continue
    planet.sample(vx, yy, vz, 1, smp)
    const isSea = smp.height < 0
    // in mare: abbastanza profondo da essere un'isola isolata, non un pezzo di costa
    if (isSea && (sea >= VOLC_SEA || smp.height > -1500)) continue
    if (!isSea && (land >= VOLC_LAND || smp.height > 2500 || smp.water > 0.5)) continue
    const u = rand()
    // base tangente attorno al centro, per l'angolo dei canaloni radiali
    let e1x = -vz
    let e1z = vx
    const e1l = Math.hypot(e1x, e1z) || 1
    e1x /= e1l
    e1z /= e1l
    const e1 = [e1x, 0, e1z]
    const e2 = [yy * e1z, vz * e1x - vx * e1z, -yy * e1x]
    out.push({
      x: vx,
      y: yy,
      z: vz,
      e1,
      e2,
      ribs: 16 + Math.floor(rand() * 10),
      // campo di colate: pieno attorno agli attivi (deciso sotto), due
      // dormienti su tre ne hanno uno più vecchio e corto
      field: rand() < 0.65 ? 0.55 + 0.35 * rand() : 0,
      // terra bruciata attorno: quasi tutti gli attivi, qualche dormiente
      burn: 0,
      // colate incandescenti: orientamento e lunghezza (in raggi)
      phase: rand() * 6.283,
      flowLen: 0.55 + 0.35 * rand(),
      r: VOLC_R_MIN + (VOLC_R_MAX - VOLC_R_MIN) * u,
      // i coni più larghi sono anche più alti; le isole partono dal fondale
      H: isSea ? 2600 + 2400 * u : 3200 + 2800 * u,
      // lago di lava solo se la cima resta sotto la linea delle nevi: i
      // giganti innevati sono dormienti (la neve coprirebbe il cratere)
      // attivo con lago di lava: circa uno su due. Lo shader non disegna neve
      // sulla lava, quindi anche un gigante innevato può avere il cratere acceso
      lava: rand() < 0.5,
      sea: isSea
    })
    const last = out[out.length - 1]
    if (last.lava) last.field = 1
    const rb = rand()
    last.burn = last.lava ? (rb < 0.75 ? 0.8 + 0.2 * rand() : 0) : rb < 0.2 ? 0.6 : 0
    if (isSea) sea++
    else land++
  }
  return out
}
const VOLCANIC_RGB = rgbFor(BIOME.VOLCANIC)
const LAVA_FIELD_RGB = rgbFor(BIOME.LAVA_FIELD)
const SCORCHED_RGB = rgbFor(BIOME.SCORCHED)

/**
 * Strati di isole degli arcipelaghi: celle, probabilità, raggi (sfera unitaria:
 * 0.001 = 6.4 km) e altezza della cima. Il raggio massimo resta sotto 1/8
 * della cella, perché anche la piattaforma (2 raggi) stia nella finestra 2×2×2.
 */
const ISLAND_LAYERS = [
  { cell: 0.02, salt: 0x27d4eb2f, prob: 0.8, rMin: 0.0009, rMax: 0.0025, hMin: 120, hRange: 900 },
  { cell: 0.006, salt: 0x165667b1, prob: 0.5, rMin: 0.00025, rMax: 0.0007, hMin: 30, hRange: 220 }
]

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
    lava: 0,
    burn: 0,
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
