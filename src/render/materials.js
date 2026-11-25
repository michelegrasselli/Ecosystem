// Materiale del terreno, stile "illustrato maturo": forme pulite, bande di luce
// morbide, ombre fredde, pochi toni per superficie (come Animal Crossing, ma
// con palette terrosa e contrasti più seri).
//
// Struttura:
//  - vertex: esagerazione del rilievo (relief.js) applicata lungo la verticale;
//    i vertici sono relativi al centro della tile e la posizione viene passata
//    al fragment RELATIVA ALLA CAMERA (vRel), calcolata in view space: niente
//    perdita di precisione anche a pochi metri dal suolo.
//  - fragment: dettaglio procedurale ancorato al mondo. Il rumore usa un
//    reticolo intero: coordinate locali = vRel + (camera - uOrigin), dove
//    uOrigin è un multiplo di 64 km; l'indice di cella del reticolo viene
//    riportato all'assoluto sommando uOrigin*f (intero esatto perché f è una
//    potenza di due >= 1/64). Così il pattern è identico a ogni LOD, non
//    "salta" quando l'origine si sposta e non perde precisione.
//  - ogni scala di dettaglio si spegne in base al lato di un pixel sul terreno
//    (foot) prima di poter aliasare: niente moiré.

import * as THREE from 'three'
import { MAX_NATIONS, NATION_GLSL } from '../planet/nations.js'

/** Direzione (costante, 3D) del vento che disegna le increspature. */
export const RIPPLE_DIR = new THREE.Vector3(0.62, 0.21, -0.75).normalize()
/** Numero d'onda delle increspature della sabbia (rad/km, ~60 cm). */
export const RIPPLE_K = 10471.98

/**
 * Treni di creste d'onda dell'acqua: direzione del vento (3D, proiettata sul
 * piano tangente dallo shader) e lunghezza d'onda in km (48 km, 4 km, 400 m).
 */
const WAVES = [
  { dir: new THREE.Vector3(0.48, -0.33, 0.81).normalize(), lambda: 48 },
  { dir: new THREE.Vector3(-0.7, 0.4, 0.59).normalize(), lambda: 4 },
  { dir: new THREE.Vector3(0.2, 0.9, -0.38).normalize(), lambda: 0.4 }
]
// Direzione alternativa, perpendicolare: su una sfera i fronti paralleli a una
// direzione fissa diventano cerchi concentrici attorno ai due punti in cui la
// direzione è verticale. Lì lo shader passa con continuità a questa.
for (const w of WAVES) {
  w.alt = new THREE.Vector3().crossVectors(w.dir, new THREE.Vector3(0.3, -0.5, 0.81).normalize()).normalize()
}
const WAVE_DIRS = [...WAVES.map((w) => w.dir), ...WAVES.map((w) => w.alt)]

// rotazione fissa del reticolo delle ottave fini
const ROT4 = new THREE.Matrix4().makeRotationAxis(new THREE.Vector3(1, 2, 3).normalize(), 0.93)

/**
 * Offset per frame del reticolo ruotato: (R·origine·f) mod 64 per f = 512·2^k,
 * in doppia precisione (in float32 il prodotto supera 2^24 e perde gli interi).
 */
export function updateNoiseFrame(material, origin) {
  const e = ROT4.elements
  const rx = e[0] * origin.x + e[4] * origin.y + e[8] * origin.z
  const ry = e[1] * origin.x + e[5] * origin.y + e[9] * origin.z
  const rz = e[2] * origin.x + e[6] * origin.y + e[10] * origin.z
  const offs = material.uniforms.uRotOff.value
  for (let k = 0; k < 6; k++) {
    const f = 512 * 2 ** k
    const m = (v) => ((v * f) % 64 + 64) % 64
    offs[k].set(m(rx), m(ry), m(rz))
  }
  // fase delle creste d'onda all'origine del reticolo, in doppia precisione
  const ph = material.uniforms.uWavePhase.value
  for (let i = 0; i < WAVE_DIRS.length; i++) {
    const k = (Math.PI * 2) / WAVES[i % WAVES.length].lambda
    ph[i] = (origin.dot(WAVE_DIRS[i]) * k) % (Math.PI * 2)
  }
}

/** Carica i capoluoghi delle nazioni nel materiale del terreno. */
export function setNations(material, nations) {
  const u = material.uniforms
  for (let i = 0; i < nations.count; i++) {
    const s = nations.seeds[i]
    u.uNationSeeds.value[i].set(s[0], s[1], s[2])
  }
  u.uNationCount.value = nations.count
}

export function createTerrainMaterial(sunDir) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z).normalize() },
      uCameraPos: { value: new THREE.Vector3() },
      uOrigin: { value: new THREE.Vector3() },
      uCamLocal: { value: new THREE.Vector3() },
      uHazeColor: { value: new THREE.Color(0.62, 0.74, 0.85) },
      uHazeDensity: { value: 0.00002 },
      uTime: { value: 0 },
      // eruzione (regia): 0 normale, 1 lava al massimo e bagliore largo
      uLavaBoost: { value: 0 },
      // 1 quando le piante 3D sono a schermo (vicino al suolo): le chiome
      // procedurali diventano sottobosco
      uVegNear: { value: 0 },
      uExag: { value: 1 },
      uShadeExag: { value: 1.5 },
      uMorph: { value: 1 },
      uNoiseTex: { value: createNoiseTexture() },
      // increspature di sabbia e neve: direzione del vento costante e fase
      // all'origine del reticolo calcolata in doppia precisione (main.js)
      uRippleDir: { value: RIPPLE_DIR.clone() },
      uRipplePhase: { value: 0 },
      uRipplePhase2: { value: 0 },
      // reticolo ruotato delle ottave fini (vedi lrnoise e updateNoiseFrame)
      uRot: { value: new THREE.Matrix3().setFromMatrix4(ROT4) },
      uRotOff: { value: Array.from({ length: 6 }, () => new THREE.Vector3()) },
      // confini delle nazioni (vedi planet/nations.js)
      uNationSeeds: { value: Array.from({ length: MAX_NATIONS }, () => new THREE.Vector3()) },
      uNationCount: { value: 0 },
      // nazioni candidate della tile in disegno (0 = tutte), vedi tileBuilder.js
      uNatCand: { value: new Array(24).fill(0) },
      uNatCandN: { value: 0 },
      // creste d'onda dell'acqua (vedi WAVES e updateNoiseFrame)
      uWaveDir: { value: WAVE_DIRS.map((d) => d.clone()) },
      uWaveK: { value: WAVES.map((w) => (Math.PI * 2) / w.lambda) },
      uWavePhase: { value: WAVE_DIRS.map(() => 0) },
      uBorderAlpha: { value: 0.75 }
    },
    vertexShader: /* glsl */ `
      #include <common>
      uniform float logDepthBufFC; // impostato da three.js come per i suoi materiali
      uniform float uExag;
      uniform float uMorph;
      attribute float aMorph;
      attribute vec2 aVolc;
      attribute vec2 aEco;

      attribute vec3 aColor;
      attribute float aWater;
      attribute float aHeight;
      attribute vec4 aSurf;
      attribute float aSkirt;

      varying vec3 vColor;
      varying vec3 vNormalW;
      varying vec3 vRel;
      varying float vWater;
      varying float vHeight;
      varying vec4 vSurf;
      varying float vElev;
      varying vec2 vVolc;
      varying vec2 vEco;

      void main() {
        vColor = aColor;
        vEco = aEco;
        vWater = aWater;
        vHeight = aHeight;
        vSurf = aSurf;
        vNormalW = normal;

        // verticale locale (la mesh è solo traslata: niente rotazione)
        vec3 up = normalize((modelMatrix * vec4(position, 1.0)).xyz);
        float hKm = max(aHeight, 0.0) * 0.001;
        // morph: la tile appena comparsa parte dalla forma del padre
        float morphKm = aMorph * 0.001 * (1.0 - uMorph) * uExag;
        float lift = (hKm - aSkirt) * (uExag - 1.0) + morphKm;
        vElev = hKm * uExag + morphKm;
        vVolc = aVolc;
        vec3 p = position + up * lift;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // posizione relativa alla camera in assi mondo, senza passare per
        // coordinate assolute (6371 km in float32 = ~0.5 m di errore)
        vRel = (vec4(mv.xyz, 0.0) * viewMatrix).xyz;
        gl_Position = projectionMatrix * mv;
        // Profondità logaritmica calcolata per vertice (stessa formula del
        // chunk di three.js) invece che per pixel: senza scrittura di
        // gl_FragDepth la GPU può scartare in anticipo i frammenti nascosti
        // (early-z) e lo shader non viene eseguito sul terreno coperto. Le maglie
        // vicino alla camera sono piccole, quindi l'interpolazione lineare è
        // accurata.
        #ifdef USE_LOGARITHMIC_DEPTH_BUFFER
          gl_Position.z = (log2(max(1e-6, 1.0 + gl_Position.w)) * logDepthBufFC - 1.0) * gl_Position.w;
        #endif
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      uniform vec3 uSunDir;
      uniform vec3 uCameraPos;
      uniform vec3 uOrigin;
      uniform vec3 uCamLocal;
      uniform vec3 uHazeColor;
      uniform float uHazeDensity;
      uniform float uTime;
      uniform float uLavaBoost;
      uniform float uVegNear;
      uniform float uShadeExag;
      uniform highp sampler3D uNoiseTex;
      uniform vec3 uRippleDir;
      uniform float uRipplePhase;
      uniform float uRipplePhase2;
      uniform mat3 uRot;
      uniform vec3 uRotOff[6];
      uniform vec3 uNationSeeds[${MAX_NATIONS}];
      uniform int uNationCount;
      uniform int uNatCand[24];
      uniform int uNatCandN;
      uniform vec3 uWaveDir[6];
      uniform float uWaveK[3];
      uniform float uWavePhase[6];
      uniform float uBorderAlpha;

      varying vec3 vColor;
      varying vec3 vNormalW;
      varying vec3 vRel;
      varying float vWater;
      varying float vHeight;
      varying vec4 vSurf;
      varying float vElev;
      varying vec2 vVolc;
      varying vec2 vEco;

      // ------------------------------------------------------------ rumore

      // Hash intero economico: combinazione lineare delle coordinate e un
      // mescolamento a una sola corsia (molto più leggero di pcg3d, conta
      // perché da vicino il rumore viene valutato decine di volte per pixel).
      const uint HX = 0x9E3779B1u;
      const uint HY = 0x85EBCA77u;
      const uint HZ = 0xC2B2AE3Du;

      uint mixH(uint h) {
        h ^= h >> 15u; h *= 0x2C1B3C6Du;
        h ^= h >> 12u; h *= 0x297A2D39u;
        h ^= h >> 15u;
        return h;
      }

      float hf(uint h) {
        return float(mixH(h) >> 8u) * (1.0 / 16777215.0);
      }

      uint seedOf(ivec3 c) {
        return uint(c.x) * HX + uint(c.y) * HY + uint(c.z) * HZ;
      }

      // rumore di valore 3D su reticolo intero ancorato al mondo
      // pl: coordinate locali (km) rispetto a uOrigin, f: frequenza (cicli/km)
      // Rumore di valore 3D ancorato al mondo, letto da una texture 3D 64^3
      // di valori casuali (un solo accesso con filtro hardware invece di 8
      // hash). Il reticolo è periodico ogni 64 celle, quindi basta l'offset
      // mod(uOrigin*f, 64): è un intero esatto perché uOrigin è multiplo di
      // 64 km e f una potenza di due >= 1/64. Lo smoothstep sulle coordinate
      // dentro la cella rende l'interpolazione morbida (niente spigoli a
      // rombo del filtro trilineare). Ogni frequenza ha un offset proprio,
      // così le ottave non si allineano.
      float lnoise(vec3 pl, float f) {
        // per f >= 1 uOrigin*f è un multiplo di 64: offset nullo (evita anche
        // prodotti oltre 2^24, non più interi esatti in float)
        vec3 o = f >= 1.0 ? vec3(0.0) : mod(uOrigin * f, 64.0);
        vec3 x = pl * f + o + fract(vec3(0.137, 0.271, 0.419) * f) * 64.0;
        vec3 i = floor(x);
        vec3 t = x - i;
        t = t * t * (3.0 - 2.0 * t);
        return texture(uNoiseTex, (i + t + 0.5) * (1.0 / 64.0)).r;
      }

      // Rumore su reticolo RUOTATO per le ottave fini (da ~2 m a ~6 cm): il
      // reticolo allineato agli assi, visto da vicino, dava un aspetto "a
      // blocchi". L'offset dell'origine ruotata per ogni frequenza arriva dalla
      // CPU, calcolato in doppia precisione (uRotOff[k], f = 512·2^k).
      float lrnoise(vec3 pl, int k) {
        float f = 512.0 * exp2(float(k));
        vec3 x = (uRot * pl) * f + uRotOff[k] + fract(vec3(0.311, 0.173, 0.457) * f) * 64.0;
        vec3 i = floor(x);
        vec3 t = x - i;
        t = t * t * (3.0 - 2.0 * t);
        return texture(uNoiseTex, (i + t + 0.5) * (1.0 / 64.0)).r;
      }

      // due ottave: rompe i contorni "a verme" del singolo rumore di valore
      float lfbm(vec3 pl, float f) {
        return lnoise(pl, f) * 0.65 + lnoise(pl, f * 2.0) * 0.35;
      }

      // Peso di una scala di dettaglio di lunghezza d'onda lambda (km): vale 1
      // finché un pixel copre meno di ~1/8 di periodo, 0 oltre ~1/3.
      float scaleW(float lambda, float foot) {
        return 1.0 - smoothstep(lambda * 0.12, lambda * 0.33, foot);
      }

      // Chiome degli alberi viste dall'alto: Worley 3D proiettato sul piano
      // tangente. Restituisce copertura (x), luce della chioma (y), id (z),
      // ombra portata (w).
      //
      // Basta una finestra di 2x2x2 celle: i punti hanno jitter in [0.25,0.75],
      // si accettano solo quelli entro 0.45 celle dalla superficie e le chiome
      // hanno raggio <= 0.54, quindi un punto che copre il pixel dista al
      // massimo ~0.70 < 0.75 e cade sempre nelle 2 celle più vicine per asse.
      vec4 canopy(vec3 pl, float f, vec3 R, float density, float aa, vec3 sunTan) {
        vec3 x = pl * f;
        vec3 i = floor(x);
        vec3 side = step(0.5, x - i) - 1.0; // -1 o 0 per asse
        vec3 c0 = i + side;
        uint s0 = seedOf(ivec3(c0) + ivec3(round(uOrigin * f)));
        float best = 9.0;
        vec3 bestD = vec3(0.0);
        float bestId = 0.0;
        float bestS = 9.0;
        float bestTop = -99.0;
        for (int dz = 0; dz <= 1; dz++)
        for (int dy = 0; dy <= 1; dy++)
        for (int dx = 0; dx <= 1; dx++) {
          uint hv = mixH(s0 + uint(dx) * HX + uint(dy) * HY + uint(dz) * HZ);
          vec3 jit = vec3(hv & 1023u, (hv >> 10u) & 1023u, (hv >> 20u) & 1023u) * (1.0 / 1023.0);
          if (jit.x > density) continue;
          vec3 fp = c0 + vec3(dx, dy, dz) + 0.25 + jit.yzx * 0.5;
          vec3 d = x - fp;
          float dr = dot(d, R);
          if (abs(dr) > 0.45) continue;
          d -= R * dr;
          float rad = 0.34 + 0.20 * jit.z;
          float dd = length(d) / rad;
          // vince la chioma più alta in quel punto (cupola + altezza
          // dell'albero): le chiome si sovrappongono restando tonde, invece di
          // spartirsi lo spazio con confini dritti
          float top = rad * sqrt(max(1.0 - dd * dd, 0.0)) + jit.z * 0.25 + (dd < 1.0 ? 1.0 : -dd);
          if (top > bestTop) { bestTop = top; best = dd; bestD = d / rad; bestId = jit.y; }
          // ombra portata: la chioma spostata in direzione opposta al sole
          float ds = length(d + sunTan * 0.3) / rad;
          bestS = min(bestS, ds);
        }
        float cover = 1.0 - smoothstep(1.0 - aa, 1.0 + aa, best);
        // normale della cupola: luce morbida sul lato del sole
        float z = sqrt(max(1.0 - best * best, 0.0));
        vec3 n = normalize(R * (z + 0.35) + bestD);
        float lit = dot(n, uSunDir);
        float shade = 1.0 - smoothstep(0.9 - aa, 1.0 + aa, bestS);
        return vec4(cover, lit, bestId, shade);
      }

      // Creste d'onda stilizzate (stile illustrato): fronti paralleli che
      // avanzano nella direzione del vento uWaveDir[i], ondulati dal rumore e
      // spezzati in tratti. La fase all'origine del reticolo (uWavePhase[i])
      // arriva dalla CPU in doppia precisione, come per le increspature della
      // sabbia: dot(uOrigin, W) * k in float32 perderebbe la continuità.
      // f: frequenza del rumore che ondula e spezza i fronti (potenza di due),
      // amp: quanto ondularli (per le onde da 48 km il rumore non può essere
      // più largo di 64 km, quindi l'ondulazione va ridotta).
      float crestAlong(vec3 pl, int d, float k, float warp, float f, float speed, float tw) {
        vec3 W = uWaveDir[d];
        float ph = fract((dot(pl, W) * k + uWavePhase[d]) * 0.15915494 + warp - tw * speed);
        float aw = clamp(fwidth(ph), 0.004, 0.3);
        // fronte netto e coda morbida dietro la cresta
        float crest = smoothstep(0.0, 0.025 + aw, ph) * (1.0 - smoothstep(0.04, 0.15 + aw, ph));
        // tratti: il rumore si sposta con l'onda, così i tratti non "scivolano"
        float brk = smoothstep(0.42, 0.64, lnoise(pl - W * (tw * speed / k * 6.2831853), f));
        return crest * brk;
      }

      float waveCrest(vec3 pl, vec3 R, int i, float f, float amp, float speed, float tw) {
        // ondulazione dei fronti: rumore più largo della lunghezza d'onda e
        // ampiezza sotto mezzo ciclo, altrimenti i fronti si ripiegano in
        // scarabocchi invece di restare onde parallele
        float warp = ((lnoise(pl, f) - 0.5) * 0.7 + (lnoise(pl, f * 2.0) - 0.5) * 0.25) * amp;
        float k = uWaveK[i];
        // vicino ai punti in cui il vento è verticale si passa alla direzione
        // alternativa (perpendicolare), che lì è ben orizzontale
        float t = smoothstep(0.55, 0.8, abs(dot(uWaveDir[i], R)));
        float c = 0.0;
        if (t < 1.0) c += (1.0 - t) * crestAlong(pl, i, k, warp, f, speed, tw);
        if (t > 0.0) c += t * crestAlong(pl, i + 3, k, warp, f, speed, tw);
        return c;
      }

      // Gradiente nel piano tangente di una grandezza v (unità di v per km),
      // dalle derivate a schermo. Va chiamata in flusso di controllo uniforme.
      vec3 tangentGrad(float v, vec3 R) {
        vec3 a = dFdx(vRel);
        vec3 b = dFdy(vRel);
        float dx = dFdx(v);
        float dy = dFdy(v);
        vec3 ap = cross(b, R);
        vec3 bp = cross(R, a);
        float det = dot(a, ap);
        if (abs(det) < 1e-14) return vec3(0.0);
        return (dx * ap + dy * bp) / det;
      }

      // Tratteggio a lunghezza costante sullo schermo: due periodi (potenze di
      // due in km) mescolati con continuità mentre si zooma. I trattini hanno i
      // bordi sfumati (larghi più o meno un pixel), il pieno è un po' più corto
      // del vuoto: si legge come una linea tratteggiata, non come un puntinato.
      float dashPattern(float along, float foot) {
        float lp = log2(max(foot, 1e-6) * 10.0);
        float L = floor(lp);
        float fr = lp - L;
        float p1 = exp2(L);
        float p2 = p1 * 2.0;
        float a1 = clamp(foot / p1 * 1.2, 0.04, 0.40);
        float a2 = clamp(foot / p2 * 1.2, 0.04, 0.40);
        float d1 = 1.0 - smoothstep(0.66 - a1, 0.66 + a1, fract(along / p1));
        float d2 = 1.0 - smoothstep(0.66 - a2, 0.66 + a2, fract(along / p2));
        return mix(d1, d2, fr);
      }

      ${NATION_GLSL}

      void main() {

        vec3 world = uCameraPos + vRel;
        vec3 R = normalize(world);
        float dist = length(vRel);
        vec3 V = -vRel / max(dist, 1e-6);
        vec3 pl = vRel + uCamLocal;

        // lato di un pixel sul terreno, in km
        float foot = max(length(fwidth(vRel)), 1e-6);

        // --- normale con rilievo esagerato per l'illuminazione ---
        // N1 è la normale a esagerazione 1; la componente tangente (pendenza)
        // viene moltiplicata per uShadeExag.
        vec3 N1 = normalize(vNormalW);
        float nr = max(dot(N1, R), 0.05);
        vec3 grad = R - N1 / nr;
        vec3 N = normalize(R - grad * uShadeExag);
        float slope = 1.0 - clamp(dot(N, R), 0.0, 1.0);
        float slopeTrue = clamp(length(grad), 0.0, 4.0);

        float absLat = degrees(asin(clamp(R.y, -1.0, 1.0)));
        float hKm = vHeight * 0.001;
        // direzione del sole nel piano tangente (per le ombre degli alberi)
        vec3 sunTanG = uSunDir - R * dot(uSunDir, R);
        sunTanG *= 1.0 / max(length(sunTanG), 0.35);

        // pesi di scala
        float w30  = scaleW(30.0, foot);
        float w8   = scaleW(8.0, foot);    // macchie regionali
        float w1   = scaleW(1.0, foot);    // chiazze di vegetazione
        float w03  = scaleW(0.25, foot);   // gruppi di alberi
        float w01  = scaleW(0.06, foot);   // singole chiome
        float w003 = scaleW(0.02, foot);   // cespi d'erba
        float wN1  = scaleW(0.008, foot);  // zolle (~2-8 m)
        float wN2  = scaleW(0.002, foot);  // ciuffi, increspature (~0.5 m)
        float wN3  = scaleW(0.0005, foot); // fili d'erba, granuli (~12 cm)

        // Un solo set di ottave di rumore, calcolate una volta e riusate da
        // tutti gli strati.
        float n0 = w30 > 0.0 ? lnoise(pl, 0.0625) : 0.5;  // ~16 km
        float n1 = w8 > 0.0 ? lnoise(pl, 0.25) : 0.5;     // ~4 km
        float n2 = w1 > 0.0 ? lnoise(pl, 1.0) : 0.5;      // ~1 km
        float n3 = w1 > 0.0 ? lnoise(pl, 2.0) : 0.5;      // ~500 m
        float n4 = w03 > 0.0 ? lnoise(pl, 16.0) : 0.5;    // ~60 m
        float n5 = w003 > 0.0 ? lnoise(pl, 128.0) : 0.5;  // ~8 m
        float n6 = wN1 > 0.0 ? lrnoise(pl, 0) : 0.5;      // ~2 m
        float n7 = wN2 > 0.0 ? lrnoise(pl, 2) * 0.65 + lrnoise(pl, 3) * 0.35 : 0.5;  // ~50 cm
        float n8 = wN3 > 0.0 ? lrnoise(pl, 4) : 0.5;      // ~12 cm

        float edgeN = (n0 - 0.5) * 0.8 * w30
                    + (n1 - 0.5) * 0.6 * w8
                    + (n2 * 0.4 + n3 * 0.6 - 0.5) * 0.7 * w1
                    + (n4 - 0.5) * 0.4 * w03;

        float waterF = vWater + edgeN * 0.35;
        // Paludi (vEco.y): acquitrini. Pozze e canali da un rumore a più scale
        // (da ~1 km a ~60 m) che affiorano tra la vegetazione; da lontano,
        // senza scale risolte, restano una tinta più scura e umida.
        float marsh = vEco.y;
        float pondN = 0.5;
        if (marsh > 0.01) {
          // scala di ~2 km sempre attiva: da lontano le pozze restano visibili
          float nP = lnoise(pl, 0.5);
          float fine = mix(nP, n2 * 0.5 + n3 * 0.5, w1);
          pondN = n1 * 0.25 + nP * 0.3 + fine * 0.3 + mix(0.5, n4, w03) * 0.15;
          waterF = mix(waterF, max(waterF, pondN * 2.3 - 0.66), marsh);
        }
        // Soglie più larghe di prima: i biomi sfumano su una fascia ampia
        // invece di cambiare di colpo (il colore per vertice è già una media
        // morbida della classificazione, vedi planet.js).
        float soft = 0.06 + smoothstep(4.0, 40.0, foot) * 0.14;
        // Antialiasing di costa e fiumi: fwidth misura di quanto cambia il
        // campo acqua tra un pixel e il successivo, quindi la soglia si allarga
        // ad almeno un pixel. Senza, il bordo seguiva la griglia della mesh e
        // mostrava scalini netti di 1-2 px (visibili da 1500 km in giù).
        float aaW = fwidth(waterF) * 1.4;
        float halfW = max(soft * 0.5, aaW);
        float isWater = smoothstep(0.5 - halfW, 0.5 + halfW, waterF);
        // Costa: la linea del mare segue lo zero della QUOTA interpolata, che è
        // continua tra i triangoli. Il campo vWater per vertice è 0 o 1 e
        // faceva il bordo a scalini di una cella; la quota no: tra un vertice
        // appena sotto il livello del mare e uno appena sopra, lo zero cade
        // dentro il triangolo e il contorno è continuo. Fascia di ~1 pixel.
        float shoreBand = max(2.0, fwidth(vHeight) * 1.1);
        isWater = max(isWater, 1.0 - smoothstep(-shoreBand, shoreBand, vHeight));
        // densità di alberi (savana e macchia: radi; foreste: chioma chiusa)
        float trees = clamp(vSurf.x + edgeN * 0.5, 0.0, 1.0);
        // Boschi delle piante 3D (vEco.x, stessa macchia di planet/flora.js):
        // radure dove la flora è rada, boschetti anche fuori dai biomi
        // forestali. Così da lontano le macchie si vedono dove sono le piante.
        float eco = vEco.x;
        trees = max(trees * mix(0.28, 1.0, smoothstep(0.04, 0.45, eco)), eco * 0.9);
        // Stesse soglie di prima, ma allargate di ~1 pixel a schermo: i confini
        // tra biomi (spiaggia, foresta, roccia, neve) seguivano la griglia della
        // mesh e mostravano scalini netti di una cella; così sfumano.
        float aaT = min(fwidth(trees) * 0.9, 0.30);
        float aaS = min(fwidth(vSurf.y) * 0.9, 0.30);
        float aaR = min(fwidth(vSurf.z) * 0.9, 0.30);
        float aaN = min(fwidth(vSurf.w) * 0.9, 0.30);
        float forest = smoothstep(0.40 - soft - aaT, 0.75 + soft + aaT, trees);
        float sand = smoothstep(0.25 - soft - aaS, 0.75 + soft + aaS, vSurf.y + edgeN * 0.5);
        float rock = smoothstep(0.30 - soft - aaR, 0.70 + soft + aaR, vSurf.z + edgeN * 0.4);
        float snow = smoothstep(0.30 - soft - aaN, 0.70 + soft + aaN, vSurf.w + edgeN * 0.4);

        // fasce d'alta quota dalla quota del fragment (stessa linea delle nevi
        // di classifyLandBiome): seguono valli e crinali come isoipse
        float snowLine = 4500.0 - absLat * 30.0; // = SNOW_LINE_BASE/LAT in biomes.js
        float hJit = vHeight + edgeN * 420.0;
        float alpineRock = smoothstep(snowLine - 750.0, snowLine - 200.0, hJit);
        float alpineSnow = smoothstep(snowLine + 20.0, snowLine + 260.0, hJit);
        rock = max(rock, alpineRock * (1.0 - alpineSnow));
        snow = max(snow, alpineSnow);

        // roccia sulle pareti ripide, neve che non resta sulle pareti
        float cliff = smoothstep(0.55, 1.05, slopeTrue * uShadeExag * 0.6);
        rock = max(rock, cliff * (1.0 - isWater));
        snow *= 1.0 - smoothstep(0.45, 0.85, slope);
        // vulcani: la lava scioglie la neve, la terra bruciata non ha né neve
        // né alberi
        float lavaK = vVolc.x;
        float burnK = vVolc.y;
        snow *= 1.0 - smoothstep(0.02, 0.3, lavaK + burnK * 0.8);

        // niente alberi sulla neve e sulla roccia nuda
        float noTrees = (1.0 - smoothstep(0.05, 0.35, snow)) * (1.0 - rock * 0.8) * (1.0 - smoothstep(0.1, 0.6, burnK));
        trees *= noTrees;
        forest *= noTrees;

        float grassMask = (1.0 - forest) * (1.0 - sand) * (1.0 - rock) * (1.0 - snow);
        // niente prato (né fiori) su terra bruciata e colate
        grassMask *= 1.0 - smoothstep(0.05, 0.4, burnK);

        // ------------------------------------------------ micro-rilievo
        // Quota di dettaglio (km) per l'illuminazione da vicino: zolle e fili
        // d'erba, increspature del vento sulla sabbia, solchi nella neve,
        // grana della roccia. Calcolata qui, fuori dai rami, perché serve alle
        // derivate a schermo.
        float ripple = 0.0;
        float sastr = 0.0;
        // pesi tarati sulla lunghezza d'onda vera (60 cm e 3 m): niente moiré
        float wRip = scaleW(0.0006, foot);
        float wSas = scaleW(0.003, foot);
        if (wN1 > 0.0) {
          // increspature: onde parallele a un vento costante, deformate dal
          // rumore; la fase all'origine arriva dalla CPU (doppia precisione)
          ripple = sin(dot(pl, uRippleDir) * 10471.98 + uRipplePhase + (n6 - 0.5) * 9.0 + (n5 - 0.5) * 6.0);
          sastr = sin(dot(pl, uRippleDir) * 2094.4 + uRipplePhase2 + (n6 - 0.5) * 5.0);
        }
        float bumpAmt = grassMask * 1.0 + forest * 0.6 + sand * 0.5 + rock * 0.8 + snow * 0.3;
        float hb = ((n6 - 0.5) * 0.0004 * wN1
                  + (n7 - 0.5) * 0.00008 * wN2
                  + (n8 - 0.5) * 0.00002 * wN3) * bumpAmt
                 + ripple * 0.000028 * wRip * sand
                 + sastr * 0.00012 * wSas * snow;
        hb *= 1.0 - isWater;
        vec3 gb = tangentGrad(hb, R);
        N = normalize(N - gb);

        // ------------------------------------------------ onde dell'acqua
        // Mare e laghi: tre treni d'onda che scorrono in direzioni diverse.
        // Fiumi: lo stesso rumore trasportato lungo la corrente con la tecnica
        // della "flow map" (due fasi sfalsate che si ripartono a vicenda), così
        // l'acqua scorre senza deformarsi all'infinito.
        float tw = uTime;
        vec3 gW = tangentGrad(vWater, R);           // attraverso il fiume
        float gWl = length(gW);
        vec3 across = gWl > 1e-6 ? gW / gWl : vec3(0.0);
        vec3 alongR = cross(R, across);
        // verso della corrente: in discesa lungo il letto
        float sdown = dot(-grad, alongR);
        vec3 flowDir = alongR * (sdown < 0.0 ? -1.0 : 1.0);
        float flowMask = smoothstep(0.08, 0.6, gWl) * step(-0.5, vHeight) * isWater;

        float hw = 0.0;
        // onde lunghe solo per la normale (riflessi e superficie mossa): la
        // trama dell'acqua resta visibile da qualche km di quota invece che
        // solo dalle ultime centinaia di metri
        float hwFar = 0.0;
        float waveWf = scaleW(0.25, foot);  // ~60 m
        float waveWm = scaleW(1.0, foot);   // ~250 m
        float waveW1 = scaleW(0.03, foot);
        float waveW2 = scaleW(0.008, foot);
        float waveW3 = scaleW(0.002, foot);
        if (isWater > 0.001) {
          vec3 D1 = normalize(cross(R, vec3(0.31, 0.95, 0.0)));
          vec3 D2 = normalize(cross(R, vec3(0.9, 0.1, 0.42)));
          float still = 0.0;
          if (waveW1 > 0.0) still += (lnoise(pl + D1 * tw * 0.0011, 64.0) - 0.5) * 0.0011 * waveW1;
          if (waveW2 > 0.0) still += (lnoise(pl + D2 * tw * 0.0007, 256.0) - 0.5) * 0.00022 * waveW2;
          if (waveW3 > 0.0) still += (lnoise(pl - D1 * tw * 0.0004, 1024.0) - 0.5) * 0.00005 * waveW3;
          float flowing = 0.0;
          if (flowMask > 0.01 && waveW2 > 0.0) {
            float T = 1.8;
            float ph1 = fract(tw / T);
            float ph2 = fract(tw / T + 0.5);
            vec3 o1 = flowDir * 0.0016 * ph1 * T;
            vec3 o2 = flowDir * 0.0016 * ph2 * T;
            float f1 = lnoise(pl - o1, 512.0) * 0.7 + lnoise(pl - o1, 2048.0) * 0.3;
            float f2 = lnoise(pl - o2 + 7.3, 512.0) * 0.7 + lnoise(pl - o2 + 7.3, 2048.0) * 0.3;
            float k = abs(ph1 * 2.0 - 1.0);
            flowing = (mix(f1, f2, k) - 0.5) * 0.0003 * waveW2;
          }
          hw = mix(still, flowing, flowMask);
          float calmF = mix(1.0, 0.5, step(-0.5, vHeight));
          if (waveWm > 0.0) hwFar += (lnoise(pl + D2 * tw * 0.010, 4.0) - 0.5) * 0.014 * waveWm * calmF;
          if (waveWf > 0.0) {
            if (flowMask > 0.01) {
              // fiumi: onde trasportate dalla corrente (flow map a due fasi)
              float T = 2.4;
              float p1 = fract(tw / T);
              float p2 = fract(tw / T + 0.5);
              float a1 = lnoise(pl - flowDir * 0.02 * p1 * T, 16.0);
              float a2 = lnoise(pl - flowDir * 0.02 * p2 * T + 5.1, 16.0);
              hwFar += (mix(a1, a2, abs(p1 * 2.0 - 1.0)) - 0.5) * 0.004 * waveWf * flowMask;
            }
            hwFar += (lnoise(pl + D1 * tw * 0.004, 16.0) - 0.5) * 0.0042 * waveWf * calmF * (1.0 - flowMask);
          }
        }
        vec3 Nw = normalize(R - tangentGrad(hw + hwFar, R) * 1.4);
        // pendenza del fondale marino (m per km), per ombreggiarlo sotto l'acqua
        vec3 gSea = tangentGrad(vHeight, R);

        vec3 base = vColor;

        // ============================================================ TERRA
        // variazione regionale morbida (toni larghi, non rumore fine)
        if (w8 > 0.0) {
          float reg = n1 * 0.6 + n0 * 0.4 - 0.5;
          base *= 1.0 + reg * 0.16 * w8;
        }

        // praterie: chiazze di tono, zolle, ciuffi e fili d'erba
        if (w1 > 0.0 && grassMask > 0.01) {
          float pn = n2 * 0.65 + n3 * 0.35;
          float tone = smoothstep(0.40, 0.60, pn);
          vec3 warmG = base * vec3(1.07, 1.04, 0.86);
          vec3 coolG = base * vec3(0.92, 0.98, 0.95);
          base = mix(base, mix(coolG, warmG, tone), 0.7 * w1 * grassMask);
          if (w03 > 0.0) {
            float tuft = smoothstep(0.35, 0.65, n4);
            base *= 1.0 + (tuft - 0.5) * 0.10 * w03 * grassMask;
          }
          if (w003 > 0.0) {
            // chiazze secche e chiazze più verdi e scure (trifoglio)
            float dry = smoothstep(0.62, 0.78, n5) * w003;
            float lush = smoothstep(0.38, 0.22, n5) * w003;
            base = mix(base, base * vec3(1.16, 1.08, 0.78), dry * 0.45 * grassMask);
            base = mix(base, base * vec3(0.84, 0.96, 0.82), lush * 0.4 * grassMask);
          }
          if (wN1 > 0.0) {
            // zolle: variazione di tono e ombra tra i cespi
            base *= 1.0 + (n6 - 0.5) * 0.22 * wN1 * grassMask;
            // fiori: bianchi, gialli e viola, radi
            float fl = step(0.982, lrnoise(pl, 1)) * wN1;
            vec3 flc = n6 > 0.62 ? vec3(0.93, 0.92, 0.86) : (n6 > 0.45 ? vec3(0.95, 0.82, 0.32) : vec3(0.62, 0.48, 0.78));
            base = mix(base, flc, fl * 0.85 * grassMask);
          }
          if (wN2 > 0.0) {
            // fili d'erba: punte chiare e fessure scure tra i fili
            float bl = smoothstep(0.25, 0.75, n7) * 0.6 + smoothstep(0.3, 0.7, n8) * 0.4 * wN3;
            base *= mix(1.0, mix(0.72, 1.12, bl), wN2 * grassMask);
          }
        }

        // foreste: radure e gruppi a media distanza, chiome tonde da vicino
        // chiome procedurali alla scala della flora (celle di 500 m): da
        // lontano disegnano il bosco; dove ci sono le piante 3D restano un
        // sottobosco attenuato
        float wCrown = scaleW(1.9, foot) * (1.0 - uVegNear * 0.55);
        if (trees > 0.04 && sand < 0.9) {
          vec3 leaf = mix(vec3(0.27, 0.36, 0.22), vColor, forest);
          vec3 leafDark = leaf * vec3(0.62, 0.70, 0.74);
          vec3 leafLight = leaf * vec3(1.10, 1.14, 0.95);
          vec3 fcol = mix(base, leaf, forest);
          fcol = mix(fcol, leafDark, (1.0 - forest) * trees * 0.45 * (1.0 - w01));
          if (w03 > 0.0) {
            float clump = smoothstep(0.40, 0.60, lnoise(pl, 8.0));
            fcol = mix(fcol, mix(leafDark, leafLight, clump), 0.55 * w03 * forest);
          }
          if (wCrown > 0.0) {
            float dens = mix(trees * 0.9, 1.0, forest);
            float aa = clamp(foot * 2.0 * 1.4, 0.04, 0.6);
            vec4 cp = canopy(pl - R * vElev, 2.0, R, dens, aa, sunTanG);
            vec3 tint = mix(vec3(0.94, 1.0, 0.92), vec3(1.06, 1.02, 0.88), cp.z);
            vec3 crown = leaf * tint * mix(0.62, 1.10, smoothstep(-0.25, 0.8, cp.y));
            // fogliame: grana di foglie sulle chiome viste da vicino
            crown *= 1.0 + (n6 - 0.5) * 0.25 * wN1 + (n7 - 0.5) * 0.25 * wN2;
            vec3 under = mix(base, leafDark * 0.75, forest);
            under *= 1.0 - cp.w * 0.32;
            fcol = mix(fcol, mix(under, crown, cp.x), wCrown);
          }
          base = mix(base, fcol, max(forest, step(0.001, trees)));
        }
        // suolo all'ombra delle piante 3D
        base *= 1.0 - smoothstep(0.1, 0.8, eco) * uVegNear * 0.22;

        // ------------------------------------------- texture ravvicinate
        // Scala "da regione" (da ~5 a ~50 m): appaiono scendendo sotto i
        // 30-40 km di quota, quando le piante diventano grandi a schermo.
        float wMid = scaleW(0.06, foot);
        float wMid2 = scaleW(0.02, foot);
        // erba pettinata dal vento: strisce allungate nel verso del vento,
        // chiazze di fiori selvatici
        if (wMid > 0.0 && grassMask > 0.01) {
          vec3 q = pl - uRippleDir * dot(pl, uRippleDir) * 0.82;
          float st = lnoise(q, 22.0) * 0.6 + lnoise(q, 64.0) * 0.4;
          float gk = wMid * grassMask;
          base *= mix(1.0, mix(0.84, 1.12, smoothstep(0.3, 0.7, st)), gk);
          base = mix(base, base * vec3(1.1, 1.06, 0.78), smoothstep(0.62, 0.76, st) * 0.35 * gk);
          float fz = lnoise(pl, 36.0);
          float fl2 = smoothstep(0.7, 0.8, fz) * wMid2 * grassMask * (1.0 - marsh);
          vec3 flc2 = n4 > 0.5 ? vec3(0.95, 0.85, 0.35) : vec3(0.72, 0.52, 0.88);
          base = mix(base, flc2, fl2 * 0.45);
        }

        // sabbia: dune, increspature del vento e granuli
        if (sand > 0.01) {
          vec3 sc = base;
          if (w1 > 0.0) {
            vec3 warp = vec3(n1, n2, n0) - 0.5;
            vec3 q = pl + warp * 1.4;
            float e = 0.05;
            float d0 = 1.0 - abs(lnoise(q, 2.0) * 2.0 - 1.0);
            float d1 = 1.0 - abs(lnoise(q + sunTanG * e, 2.0) * 2.0 - 1.0);
            float facing = (d1 - d0) / e;
            float tone = smoothstep(-0.9, 0.9, facing);
            float wd = scaleW(0.6, foot) * sand;
            sc *= mix(1.0, mix(0.84, 1.07, tone), wd);
            sc = mix(sc, sc * vec3(1.05, 1.03, 0.97), smoothstep(0.86, 0.98, d0) * wd * 0.6);
          }
          if (w003 > 0.0) sc *= 1.0 + (smoothstep(0.4, 0.6, n5) - 0.5) * 0.06 * w003;
          if (wMid2 > 0.0) {
            // increspature del vento a ~25 m: lato al sole chiaro, lato in ombra scuro
            float ph = dot(pl, uRippleDir) * 251.3 + (n4 - 0.5) * 8.0 + (n3 - 0.5) * 6.0;
            float rr = sin(ph);
            float face = cos(ph) * sign(dot(uRippleDir, sunTanG) + 1e-3);
            sc *= 1.0 + (rr * 0.04 + face * 0.06) * wMid2;
          }
          if (wN2 > 0.0) {
            // creste delle increspature leggermente più chiare
            sc *= 1.0 + ripple * 0.035 * wRip;
          }
          if (wN3 > 0.0) {
            // granuli: puntini chiari e scuri
            float gr = lrnoise(pl, 5);
            sc *= 1.0 + (smoothstep(0.2, 0.8, gr) - 0.5) * 0.10 * wN3;
          }
          base = mix(base, sc, sand);
        }

        // roccia: strati orizzontali, fessure, licheni e grana
        float crackGlow = 0.0;
        if (rock > 0.01) {
          float strata = sin(hKm * 52.0 + n3 * 3.0);
          vec3 rockA = vec3(0.47, 0.44, 0.40);
          vec3 rockB = vec3(0.58, 0.54, 0.48);
          vec3 rc = mix(rockA, rockB, smoothstep(-0.3, 0.3, strata) * scaleW(0.12, foot) + 0.5 * (1.0 - scaleW(0.12, foot)));
          // le rocce molto scure (basalto, colate) tengono il loro colore
          float vLum = dot(vColor, vec3(0.2126, 0.7152, 0.0722));
          rc = mix(rc, vColor, 0.25 + 0.65 * (1.0 - smoothstep(0.08, 0.25, vLum)));
          // basalto (campi di lava, fianchi dei vulcani): crosta spaccata in
          // placche, crepe scure; vicino alla lava le crepe covano ancora
          float basalt = 1.0 - smoothstep(0.1, 0.22, vLum);
          if (wMid > 0.0 && basalt > 0.01) {
            float cn = lnoise(pl, 26.0) * 0.7 + lnoise(pl, 70.0) * 0.3;
            float crk = 1.0 - smoothstep(0.0, 0.045, abs(cn - 0.5));
            rc *= 1.0 - crk * 0.45 * wMid * basalt;
            rc *= 1.0 + (smoothstep(0.3, 0.7, lnoise(pl, 9.0)) - 0.5) * 0.25 * wMid * basalt;
            crackGlow = crk * basalt * wMid * smoothstep(0.0, 0.25, lavaK + burnK * 0.15);
          }
          if (w03 > 0.0) {
            float crack = smoothstep(0.035, 0.0, abs(n4 - 0.5));
            rc *= 1.0 - crack * 0.14 * w03;
          }
          if (wN1 > 0.0) {
            float lich = smoothstep(0.66, 0.74, n6) * wN1;
            rc = mix(rc, vec3(0.55, 0.57, 0.42), lich * 0.35);
            rc *= 1.0 + (n7 - 0.5) * 0.18 * wN2 + (n8 - 0.5) * 0.12 * wN3;
          }
          base = mix(base, rc, rock);
        }

        // neve: bianca, solchi del vento e brillii controluce
        float glint = 0.0;
        if (snow > 0.01) {
          vec3 sn = vec3(0.92, 0.94, 0.97);
          if (w1 > 0.0) sn *= 1.0 - (n2 - 0.5) * 0.06 * w1;
          if (wN1 > 0.0) sn *= 1.0 + sastr * 0.015 * wSas;
          float wSd = scaleW(0.12, foot);
          if (wSd > 0.0) {
            // cumuli e lingue di neve modellati dal vento: lato in ombra azzurro
            vec3 q = pl - uRippleDir * dot(pl, uRippleDir) * 0.6;
            float e = 0.012;
            float d0 = lnoise(q, 9.0);
            float d1 = lnoise(q + sunTanG * e, 9.0);
            float tone = smoothstep(-0.6, 0.6, (d1 - d0) / e * 0.08);
            sn *= mix(1.0, mix(0.92, 1.03, tone), wSd);
            sn = mix(sn, sn * vec3(0.88, 0.94, 1.05), (1.0 - tone) * 0.3 * wSd);
          }
          float wSp = scaleW(0.03, foot);
          if (wSp > 0.0) {
            // brillii dei cristalli a scala media: cambiano con la vista
            float sp2 = lnoise(pl + V * 0.06, 90.0);
            glint = max(glint, smoothstep(0.9, 0.97, sp2) * wSp * snow * 0.7);
          }
          if (wN2 > 0.0) {
            // cristalli: il rumore cambia con la direzione di vista, quindi i
            // brillii si accendono e spengono muovendo la camera
            float sp = lnoise(pl + V * 0.0004, 4096.0);
            glint = smoothstep(0.86, 0.95, sp) * wN2 * snow;
          }
          base = mix(base, sn, snow);
        }

        // paludi: suolo fangoso e scuro, canneti sulle rive delle pozze
        if (marsh > 0.01) {
          vec3 mud = base * vec3(0.72, 0.8, 0.7);
          base = mix(base, mud, marsh * 0.45);
          float shore = smoothstep(0.32, 0.44, waterF) * (1.0 - smoothstep(0.46, 0.52, waterF));
          base = mix(base, vec3(0.3, 0.36, 0.2), shore * marsh * 0.55 * w1);
        }

        // terra bruciata attorno ai vulcani: suolo carbonizzato quasi nero a
        // chiazze, cenere grigia, ceppi scuri sparsi da vicino
        if (burnK > 0.01) {
          vec3 charCol = vec3(0.13, 0.11, 0.10);
          vec3 ashCol = vec3(0.30, 0.28, 0.26);
          float ashPatch = smoothstep(0.35, 0.65, n3 * 0.6 + n4 * 0.4);
          vec3 burnt = mix(charCol, ashCol, ashPatch * 0.45);
          if (wN1 > 0.0) burnt *= 1.0 + (n6 - 0.5) * 0.2 * wN1;
          if (w003 > 0.0) burnt = mix(burnt, charCol * 0.6, step(0.82, n5) * w003 * 0.8);
          base = mix(base, burnt, smoothstep(0.0, 0.7, burnK) * 0.85);
        }

        // tinta altimetrica: le quote alte schiariscono e raffreddano, le valli
        // restano più sature. Aiuta a leggere il rilievo anche dall'alto.
        // Pianure e coste: colore pieno, un po' più scuro e saturo. Alture: via
        // via più chiare e meno sature, verso un grigio-bruno caldo. Così la
        // quota si legge dal colore a ogni zoom, anche dove la luce è piatta.
        float hLow = 1.0 - smoothstep(0.0, 380.0, vHeight);
        float hMid = smoothstep(300.0, 2300.0, vHeight);
        float hHigh = smoothstep(1800.0, 5200.0, vHeight);
        float lumB = dot(base, vec3(0.2126, 0.7152, 0.0722));
        float noSnow = 1.0 - snow;
        base = mix(base, (base - lumB) * 1.28 + lumB * 0.9, hLow * 0.65 * noSnow);
        vec3 highTone = mix(vec3(lumB), base, 0.55) * 1.13 + vec3(0.035, 0.03, 0.02);
        base = mix(base, highTone, (hMid * 0.42 + hHigh * 0.38) * noSnow);

        // ============================================================ LUCE
        float sunUp = dot(R, uSunDir);
        // Niente notte, per ora: il sole segue la camera (main.js) e qui non
        // si scurisce nulla. Per riattivare il ciclo giorno/notte:
        // day = smoothstep(-0.30, 0.12, sunUp) con un sole fisso.
        float day = 1.0;

        // sole "basso" per il rilievo: stessa direzione del sole ma più radente
        vec3 sunT = uSunDir - R * sunUp;
        float sunTl = length(sunT);
        vec3 lowDir = sunTl > 1e-3 ? normalize(sunT / sunTl + R * 0.75) : R;

        float ndl = dot(N, uSunDir);
        float ndlLow = dot(N, lowDir);

        float lit = smoothstep(-0.12, 0.30, ndl);
        float relief = smoothstep(0.15, 0.95, ndlLow);
        float light = mix(lit, relief, 0.55);
        light += smoothstep(0.80, 0.97, ndlLow) * 0.06;

        vec3 shadowTint = vec3(0.50, 0.55, 0.70);
        vec3 lightCol = mix(shadowTint, vec3(1.04, 1.01, 0.96), light);
        lightCol *= mix(0.32, 1.0, day);
        lightCol *= mix(0.87, 1.08, smoothstep(-50.0, 4800.0, vHeight));

        float ao = 1.0 - slope * 0.22;

        vec3 color = base * lightCol * ao;
        color += vec3(1.0, 0.36, 0.06) * crackGlow * (0.6 + uLavaBoost * 0.8);

        // ============================================================ LAVA
        // Lava fusa (laghi nei crateri, colate incandescenti, crepe nei campi
        // di lava): materiale luminoso, non illuminato dal sole. Una crosta
        // scura che si rompe in placche, con crepe arancio-gialle che pulsano e
        // scorrono a valle (flow map a due fasi lungo la discesa del terreno;
        // nei crateri piatti la lava ribolle sul posto). Visibile a ogni quota:
        // le scale del disegno si accendono e spengono con lo zoom.
        if (lavaK > 0.01) {
          float tl = uTime;
          float gl = length(grad);
          vec3 down = gl > 0.004 ? -grad / gl : vec3(0.0);
          float T = 4.0;
          float p1 = fract(tl / T);
          float p2 = fract(tl / T + 0.5);
          float kf = abs(p1 * 2.0 - 1.0);
          float heat = 0.0;
          float cracks = 0.0;
          float wl0 = scaleW(2.0, foot);
          float wl1 = scaleW(0.5, foot);
          float wl2 = scaleW(0.06, foot);
          // placche di crosta a ~500 m, ~125 m, ~15 m
          if (wl0 > 0.0) {
            vec3 o1 = down * 0.25 * p1 * T;
            vec3 o2 = down * 0.25 * p2 * T;
            float a = mix(lnoise(pl - o1, 2.0), lnoise(pl - o2 + 3.3, 2.0), kf);
            heat += smoothstep(0.38, 0.72, a) * wl0;
            cracks += (1.0 - smoothstep(0.0, 0.06, abs(a - 0.5))) * wl0;
          }
          if (wl1 > 0.0) {
            vec3 o1 = down * 0.06 * p1 * T;
            vec3 o2 = down * 0.06 * p2 * T;
            float a = mix(lnoise(pl - o1, 8.0), lnoise(pl - o2 + 5.1, 8.0), kf);
            heat = mix(heat, smoothstep(0.35, 0.75, a), 0.55 * wl1);
            cracks = max(cracks, (1.0 - smoothstep(0.0, 0.05, abs(a - 0.5))) * wl1);
          }
          if (wl2 > 0.0) {
            vec3 o1 = down * 0.008 * p1 * T;
            vec3 o2 = down * 0.008 * p2 * T;
            float a = mix(lnoise(pl - o1, 64.0), lnoise(pl - o2 + 7.7, 64.0), kf);
            cracks = max(cracks, (1.0 - smoothstep(0.0, 0.07, abs(a - 0.5))) * wl2);
          }
          // da lontano, senza disegno risolto: lava calda uniforme
          heat = mix(0.75, heat, max(wl0, wl1));
          // pulsazione lenta, sfasata nello spazio
          float pulse = 0.85 + 0.15 * sin(tl * 1.7 + n1 * 9.0 + n2 * 5.0);
          vec3 crust = vec3(0.09, 0.045, 0.03) * lightCol;
          vec3 hot = mix(vec3(0.92, 0.24, 0.04), vec3(1.0, 0.62, 0.12), heat);
          vec3 white = vec3(1.0, 0.88, 0.45);
          float molten = clamp(heat * 0.85 + cracks * 0.9 + uLavaBoost * 0.45, 0.0, 1.0);
          vec3 lavaCol = mix(crust, hot * pulse * 1.25, molten);
          lavaCol = mix(lavaCol, white * 1.3, cracks * heat * 0.5);
          float lk = smoothstep(0.05, 0.55, lavaK);
          color = mix(color, lavaCol, lk);
          // bagliore attorno alla lava (il valore interpolato sfuma ai bordi)
          color += vec3(0.9, 0.32, 0.06) * (1.0 - lk) * smoothstep(0.01, 0.2, lavaK) * 0.35;
          // eruzione: la lava brucia più forte e il bagliore si allarga
          color += hot * uLavaBoost * (lk * 0.55 + (1.0 - lk) * smoothstep(0.0, 0.25, lavaK) * 0.9);
        }
        // prospettiva aerea in base alla quota: viste da lontano, pianure e
        // fondovalle restano dietro un velo d'aria, le cime ne escono nitide
        float lowHaze = (1.0 - smoothstep(0.0, 1400.0, vHeight)) * smoothstep(30.0, 900.0, dist) * 0.12;
        color = mix(color, uHazeColor * 0.92, lowHaze * (1.0 - isWater));
        color += vec3(1.0, 0.98, 0.94) * glint * 0.6 * day * lit;

        // ============================================================ ACQUA
        if (isWater > 0.001) {
          float depth = max(-vHeight, 0.0);
          // Scala di profondità: lagune turchesi, piattaforma verde-azzurra,
          // scarpata blu, abisso blu notte e fosse quasi nere. Il contrasto
          // fa leggere a colpo d'occhio dove il mare è profondo.
          vec3 c0 = vec3(0.30, 0.66, 0.66);   // 0-20 m
          vec3 c1 = vec3(0.17, 0.47, 0.57);   // piattaforma, ~150 m
          vec3 c2 = vec3(0.075, 0.27, 0.45);  // scarpata, ~1500 m
          vec3 c3 = vec3(0.035, 0.125, 0.28); // abisso, ~4000 m
          vec3 c4 = vec3(0.018, 0.06, 0.17);  // fosse, oltre 6000 m
          vec3 wc = mix(c0, c1, smoothstep(0.0, 150.0, depth));
          wc = mix(wc, c2, smoothstep(150.0, 1800.0, depth));
          wc = mix(wc, c3, smoothstep(1500.0, 4200.0, depth));
          wc = mix(wc, c4, smoothstep(4300.0, 6800.0, depth));
          float inland = step(-0.5, vHeight);
          // rilievo del fondale visto attraverso l'acqua: ombreggiatura con una
          // luce fissa da nord-ovest (come nelle carte batimetriche), dorsali
          // chiare da un lato e scure dall'altro, fosse in ombra
          {
            vec3 northT = normalize(vec3(0.0, 1.0, 0.0) - R * R.y + vec3(1e-4, 0.0, 0.0));
            vec3 eastT = normalize(cross(northT, R));
            vec3 Lsea = normalize(northT - eastT);
            float bathy = clamp(dot(gSea, Lsea) / 10.0, -1.0, 1.0);
            float deepEnough = smoothstep(60.0, 400.0, depth) * (1.0 - inland);
            wc *= 1.0 + bathy * 0.28 * deepEnough;
          }
          wc = mix(wc, vColor * 1.05, inland * 0.6);
          if (marsh > 0.01) {
            // acqua ferma e scura, lenticchie d'acqua e ninfee
            wc = mix(wc, vec3(0.17, 0.29, 0.28), smoothstep(0.0, 0.6, marsh) * 0.6);
            float weed = smoothstep(0.58, 0.7, n4) * w03 + smoothstep(0.6, 0.7, pondN) * (1.0 - w03) * 0.4;
            wc = mix(wc, vec3(0.3, 0.44, 0.16), weed * marsh * 0.7);
            float pad = smoothstep(0.8, 0.86, n5) * w003;
            wc = mix(wc, vec3(0.34, 0.56, 0.22), pad * marsh * 0.85);
          }

          // colore che segue le onde: creste più chiare, ventri più scuri
          wc *= 1.0 + clamp(hw * 900.0, -0.5, 0.5) * 0.18;
          wc *= 1.0 + clamp(hwFar * 80.0, -0.5, 0.5) * 0.14;

          // fiumi: scie di schiuma allungate nel verso della corrente
          if (flowMask > 0.01 && waveW2 > 0.0) {
            float T = 1.8;
            float ph = fract(tw / T);
            vec3 o = flowDir * 0.0016 * ph * T;
            float streak = lnoise(pl - o, 2048.0);
            wc = mix(wc, vec3(0.78, 0.86, 0.86), smoothstep(0.72, 0.9, streak) * 0.35 * flowMask * waveW2);
          }

          // --- movimento a scala regionale (stile cartoon) ---
          // Le onde vere (pochi m/s) da 100 km di quota sembrano ferme: qui
          // ogni scala si muove con una velocità proporzionale alla propria
          // lunghezza d'onda, così l'acqua "vive" allo stesso modo a ogni
          // zoom. Tre treni di creste (48 km, 4 km, 400 m) che si passano il
          // testimone: ognuno compare quando è risolto e si spegne quando è
          // così grande da diventare una fascia larga. Il più grande si vede già
          // da ~3000 km di quota. In più, chiazze di onda lunga che scorrono.
          // Velocità ~0.12-0.2 lunghezze d'onda al secondo: a 90 m/s le onde
          // da 2 km, viste da 200 km, facevano mezzo pixel al secondo.
          // Laghi e fiumi sono più calmi del mare.
          {
            vec3 E1 = normalize(cross(R, vec3(0.31, 0.95, 0.0)));
            vec3 E2 = normalize(cross(R, vec3(0.9, 0.1, 0.42)));
            float calm = mix(1.0, 0.5, inland);
            float notRiver = 1.0 - flowMask;
            vec3 crestCol = vec3(0.82, 0.91, 0.93);
            float wC0 = (1.0 - smoothstep(3.0, 7.0, foot)) * smoothstep(0.04, 0.3, foot);
            float wC1 = (1.0 - smoothstep(0.14, 0.4, foot)) * smoothstep(0.004, 0.03, foot);
            float wC2 = 1.0 - smoothstep(0.014, 0.04, foot);
            float wSw = (1.0 - smoothstep(2.0, 6.0, foot)) * smoothstep(0.01, 0.06, foot);
            float wCr = scaleW(0.25, foot); // correnti fini dei fiumi
            if (wSw > 0.0) {
              // onde lunghe: chiazze chiare e scure che scorrono
              float sw = lnoise(pl + E1 * tw * 1.2, 0.125) * 0.6
                       + lnoise(pl - E2 * tw * 0.9, 0.25) * 0.4;
              wc *= 1.0 + (sw - 0.5) * 0.2 * wSw * calm;
            }
            if (wC0 > 0.0) {
              float c = waveCrest(pl, R, 0, 0.015625, 0.35, 0.12, tw);
              wc = mix(wc, crestCol, c * 0.5 * wC0 * calm * notRiver);
            }
            if (wC1 > 0.0) {
              float c = waveCrest(pl, R, 1, 0.125, 1.0, 0.15, tw);
              wc = mix(wc, crestCol, c * 0.32 * wC1 * calm * notRiver);
            }
            if (wC2 > 0.0) {
              float c = waveCrest(pl, R, 2, 1.0, 1.0, 0.2, tw);
              wc = mix(wc, crestCol, c * 0.34 * wC2 * calm * notRiver);
            }
            float wRv = scaleW(1.2, foot);
            if (flowMask > 0.01 && wRv > 0.0) {
              // correnti dei fiumi a ~500 m, visibili da più lontano
              float T = 3.0;
              float p1 = fract(tw / T);
              float p2 = fract(tw / T + 0.5);
              float a1 = lnoise(pl - flowDir * 0.45 * p1 * T, 2.0);
              float a2 = lnoise(pl - flowDir * 0.45 * p2 * T + 3.7, 2.0);
              float st = mix(a1, a2, abs(p1 * 2.0 - 1.0));
              wc *= 1.0 + (st - 0.5) * 0.2 * flowMask * wRv;
              wc = mix(wc, vec3(0.76, 0.86, 0.88), smoothstep(0.62, 0.84, st) * 0.3 * flowMask * wRv);
            }
            if (flowMask > 0.01 && wCr > 0.0) {
              // correnti dei fiumi (~250 m): flow map a due fasi sfalsate
              float T = 3.0;
              float p1 = fract(tw / T);
              float p2 = fract(tw / T + 0.5);
              float a1 = lnoise(pl - flowDir * 0.12 * p1 * T, 4.0);
              float a2 = lnoise(pl - flowDir * 0.12 * p2 * T + 3.7, 4.0);
              float st = mix(a1, a2, abs(p1 * 2.0 - 1.0));
              wc *= 1.0 + (st - 0.5) * 0.16 * flowMask * wCr;
              wc = mix(wc, vec3(0.76, 0.86, 0.88), smoothstep(0.64, 0.86, st) * 0.3 * flowMask * wCr);
            }
          }

          // battigia: schiuma che va e viene
          float shoreBand = smoothstep(0.62, 0.45, waterF) * scaleW(0.4, foot);
          shoreBand = max(shoreBand, (1.0 - smoothstep(0.0, 6.0, depth)) * (1.0 - inland) * w1);
          float surf = 0.5 + 0.5 * sin(tw * 1.3 + n5 * 12.0 + n4 * 6.0);
          float foam = shoreBand * mix(0.45, 1.0, surf);
          if (wN1 > 0.0) foam *= mix(1.0, smoothstep(0.35, 0.65, lnoise(pl + vec3(tw * 0.0003), 1024.0)) * 1.6, wN1);
          wc = mix(wc, vec3(0.86, 0.92, 0.92), clamp(foam, 0.0, 1.0) * 0.6);

          float wl = mix(0.62, 1.0, smoothstep(-0.2, 0.5, dot(R, uSunDir)));
          vec3 wcol = wc * wl * mix(0.32, 1.0, day);

          // riflesso del sole sulle onde: bagliore largo + scintille strette
          vec3 H = normalize(uSunDir + V);
          float nh = max(dot(Nw, H), 0.0);
          float specWide = pow(max(dot(R, H), 0.0), 120.0);
          // scintille solo dove le onde sono risolte: da lontano la normale è
          // piatta e il riflesso stretto diventerebbe un disco abbagliante
          float specSharp = pow(nh, 900.0) * max(waveW1, waveWm * 0.85);
          // il bagliore largo è appena accennato: con il sole che segue la
          // camera cadrebbe sempre al centro dell'inquadratura come una macchia
          wcol += vec3(1.0, 0.96, 0.86) * (smoothstep(0.25, 0.9, specWide) * 0.06 + specSharp * 1.4) * day;
          float fres = pow(1.0 - max(dot(Nw, V), 0.0), 4.0);
          wcol = mix(wcol, uHazeColor * mix(0.35, 0.9, day), fres * 0.45);

          color = mix(color, wcol, isWater);
        }

        // ============================================================ CONFINI
        // Confini tra nazioni: una sottile linea tratteggiata grigia, solo sulla
        // terraferma. Distanza dal bisettore tra i due capoluoghi più vicini,
        // nello spazio deformato da nationWarp (la stessa funzione usata in JS).
        //
        // La linea è larga circa un pixel (antialiasata su due): netta abbastanza
        // da leggersi come confine, senza essere un tratto da pennarello. Il
        // grigio neutro si stacca sia dalla sabbia chiara sia dal bosco scuro.
        if (uNationCount > 1 && uNatCandN != 1 && isWater < 0.98) {
          vec3 q = nationWarp(R);
          float b1 = -2.0;
          float b2 = -2.0;
          int i1 = 0;
          int i2 = 0;
          if (uNatCandN > 1) {
            // solo le nazioni che possono comparire in questa tile
            for (int j = 0; j < 24; j++) {
              if (j >= uNatCandN) break;
              int i = uNatCand[j];
              float d = dot(q, uNationSeeds[i]);
              if (d > b1) { b2 = b1; i2 = i1; b1 = d; i1 = i; }
              else if (d > b2) { b2 = d; i2 = i; }
            }
          } else if (uNatCandN == 0) {
            for (int i = 0; i < ${MAX_NATIONS}; i++) {
              if (i >= uNationCount) break;
              float d = dot(q, uNationSeeds[i]);
              if (d > b1) { b2 = b1; i2 = i1; b1 = d; i1 = i; }
              else if (d > b2) { b2 = d; i2 = i; }
            }
          }
          // una sola candidata: nessun confine nella tile (b2 resta -2)
          vec3 s1 = uNationSeeds[i1];
          vec3 s2 = uNationSeeds[i2];
          vec3 sd = s1 - s2;
          float dKm = (b1 - b2) / max(length(sd), 1e-6) * 6371.0;
          // larghezza in km di un pixel (limitata: all'orizzonte fwidth esplode
          // e la fascia diventerebbe una macchia larga)
          float bw = min(foot, 25.0);
          // Linea d'inchiostro scura larga ~1.7 px su un alone chiaro continuo
          // di ~3 px: si legge sia sul bosco scuro sia sulla sabbia chiara, e
          // anche dallo spazio (la vecchia linea grigia di 1 px spariva).
          float core = 1.0 - smoothstep(bw * 0.85, bw * 1.7, dKm);
          float halo = 1.0 - smoothstep(bw * 1.7, bw * 3.2, dKm);
          if (halo > 0.0) {
            float land = 1.0 - isWater;
            vec3 alongDir = normalize(cross(sd, R));
            float dash = dashPattern(dot(pl, alongDir), foot);
            color = mix(color, vec3(0.93, 0.89, 0.80), halo * 0.38 * uBorderAlpha * land);
            float a = core * mix(0.35, 1.0, dash) * uBorderAlpha * land;
            color = mix(color, vec3(0.20, 0.17, 0.15), clamp(a, 0.0, 0.92));
          }
        }

        // ============================================================ FOSCHIA
        float fog = 1.0 - exp(-dist * uHazeDensity);
        fog = fog * fog;
        color = mix(color, uHazeColor * mix(0.3, 1.0, day), fog * 0.55);

        // correzione colore finale: un po' di contrasto e saturazione
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, 1.14);
        color = (color - 0.42) * 1.08 + 0.42;
        color = max(color, 0.0);

        // dithering: mezzo livello di rumore per pixel sui gradienti (foschia,
        // pendii in ombra). Toglie le bande e rende il passaggio di colore
        // continuo invece che a scalini.
        float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        color += (ign - 0.5) * (1.6 / 255.0);

        gl_FragColor = vec4(color, 1.0);
      }
    `
  })
  return mat
}


/** Texture 3D 64^3 di valori casuali deterministici (rumore di valore). */
function createNoiseTexture() {
  const size = 64
  const data = new Uint8Array(size * size * size)
  let a = 0x9e3779b9
  for (let i = 0; i < data.length; i++) {
    // mulberry32: stesso contenuto a ogni avvio
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    data[i] = ((t ^ (t >>> 14)) >>> 0) & 255
  }
  const tex = new THREE.Data3DTexture(data, size, size, size)
  tex.format = THREE.RedFormat
  tex.type = THREE.UnsignedByteType
  tex.minFilter = THREE.LinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.wrapS = tex.wrapT = tex.wrapR = THREE.RepeatWrapping
  tex.unpackAlignment = 1
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}
