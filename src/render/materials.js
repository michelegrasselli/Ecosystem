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
      uExag: { value: 1 },
      uShadeExag: { value: 1.5 },
      uNoiseTex: { value: createNoiseTexture() }
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uExag;

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

      void main() {
        vColor = aColor;
        vWater = aWater;
        vHeight = aHeight;
        vSurf = aSurf;
        vNormalW = normal;

        // verticale locale (la mesh è solo traslata: niente rotazione)
        vec3 up = normalize((modelMatrix * vec4(position, 1.0)).xyz);
        float hKm = max(aHeight, 0.0) * 0.001;
        float lift = (hKm - aSkirt) * (uExag - 1.0);
        vElev = hKm * uExag;
        vec3 p = position + up * lift;

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        // posizione relativa alla camera in assi mondo, senza passare per
        // coordinate assolute (6371 km in float32 = ~0.5 m di errore)
        vRel = (vec4(mv.xyz, 0.0) * viewMatrix).xyz;
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uSunDir;
      uniform vec3 uCameraPos;
      uniform vec3 uOrigin;
      uniform vec3 uCamLocal;
      uniform vec3 uHazeColor;
      uniform float uHazeDensity;
      uniform float uTime;
      uniform float uShadeExag;
      uniform highp sampler3D uNoiseTex;

      varying vec3 vColor;
      varying vec3 vNormalW;
      varying vec3 vRel;
      varying float vWater;
      varying float vHeight;
      varying vec4 vSurf;
      varying float vElev;

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
        vec3 x = pl * f + mod(uOrigin * f, 64.0) + fract(vec3(0.137, 0.271, 0.419) * f) * 64.0;
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

      void main() {
        #include <logdepthbuf_fragment>

        vec3 world = uCameraPos + vRel;
        vec3 R = normalize(world);
        float dist = length(vRel);
        vec3 V = -vRel / max(dist, 1e-6);
        vec3 pl = vRel + uCamLocal;

        // lato di un pixel sul terreno, in km
        float foot = max(length(fwidth(vRel)), 1e-5);

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
        float w8   = scaleW(8.0, foot);    // macchie regionali
        float w1   = scaleW(1.0, foot);    // chiazze di vegetazione
        float w03  = scaleW(0.25, foot);   // gruppi di alberi
        float w01  = scaleW(0.06, foot);   // singole chiome
        float w003 = scaleW(0.02, foot);   // erba e ciottoli

        // --- campi continui con bordi sfrangiati dal rumore ---
        // più scale, così i confini restano irregolari a ogni quota invece di
        // seguire le maglie della griglia
        float w30 = scaleW(30.0, foot);

        // Un solo set di ottave di rumore, calcolate una volta e riusate da
        // tutti gli strati (confini, prati, dune, roccia, neve): da vicino lo
        // shader resta abbastanza leggero anche su GPU integrate.
        float n0 = w30 > 0.0 ? lnoise(pl, 0.0625) : 0.5;  // ~16 km
        float n1 = w8 > 0.0 ? lnoise(pl, 0.25) : 0.5;     // ~4 km
        float n2 = w1 > 0.0 ? lnoise(pl, 1.0) : 0.5;      // ~1 km
        float n3 = w1 > 0.0 ? lnoise(pl, 2.0) : 0.5;      // ~500 m
        float n4 = w03 > 0.0 ? lnoise(pl, 16.0) : 0.5;    // ~60 m
        float n5 = w003 > 0.0 ? lnoise(pl, 128.0) : 0.5;  // ~8 m

        float edgeN = (n0 - 0.5) * 0.8 * w30
                    + (n1 - 0.5) * 0.6 * w8
                    + (n2 * 0.4 + n3 * 0.6 - 0.5) * 0.7 * w1
                    + (n4 - 0.5) * 0.4 * w03;

        float waterF = vWater + edgeN * 0.35;
        // da lontano le soglie si allargano: una soglia netta su valori
        // interpolati tra maglie di decine di km disegna scalini lungo i triangoli
        float soft = smoothstep(4.0, 40.0, foot) * 0.18;
        float isWater = smoothstep(0.42 - soft, 0.58 + soft, waterF);
        // densità di alberi (savana e macchia: radi; foreste: chioma chiusa)
        float trees = clamp(vSurf.x + edgeN * 0.5, 0.0, 1.0);
        float forest = smoothstep(0.45 - soft, 0.70 + soft, trees);
        float sand = smoothstep(0.30 - soft, 0.70 + soft, vSurf.y + edgeN * 0.5);
        float rock = smoothstep(0.35 - soft, 0.65 + soft, vSurf.z + edgeN * 0.4);
        float snow = smoothstep(0.35 - soft, 0.65 + soft, vSurf.w + edgeN * 0.4);

        // fasce d'alta quota dalla quota del fragment (stessa linea delle nevi
        // di classifyLandBiome): seguono valli e crinali come isoipse
        float snowLine = 5400.0 - absLat * 26.0;
        float hJit = vHeight + edgeN * 420.0;
        float alpineRock = smoothstep(snowLine - 650.0, snowLine - 250.0, hJit);
        float alpineSnow = smoothstep(snowLine + 60.0, snowLine + 200.0, hJit);
        rock = max(rock, alpineRock * (1.0 - alpineSnow));
        snow = max(snow, alpineSnow);

        // roccia sulle pareti ripide, neve che non resta sulle pareti
        float cliff = smoothstep(0.55, 1.05, slopeTrue * uShadeExag * 0.6);
        rock = max(rock, cliff * (1.0 - isWater));
        snow *= 1.0 - smoothstep(0.45, 0.85, slope);

        vec3 base = vColor;

        // ============================================================ TERRA
        // variazione regionale morbida (toni larghi, non rumore fine)
        if (w8 > 0.0) {
          float reg = n1 * 0.6 + n0 * 0.4 - 0.5;
          base *= 1.0 + reg * 0.16 * w8;
        }

        // praterie: chiazze a due toni, come erba tagliata a zone
        float grassMask = (1.0 - forest) * (1.0 - sand) * (1.0 - rock) * (1.0 - snow);
        if (w1 > 0.0 && grassMask > 0.01) {
          float pn = n2 * 0.65 + n3 * 0.35;
          float tone = smoothstep(0.46, 0.54, pn);
          vec3 warmG = base * vec3(1.07, 1.04, 0.86);
          vec3 coolG = base * vec3(0.92, 0.98, 0.95);
          base = mix(base, mix(coolG, warmG, tone), 0.75 * w1 * grassMask);
          if (w03 > 0.0) {
            float tuft = smoothstep(0.42, 0.58, n4);
            base *= 1.0 + (tuft - 0.5) * 0.08 * w03 * grassMask;
          }
          if (w003 > 0.0) {
            float blade = smoothstep(0.35, 0.65, n5);
            base *= 1.0 + (blade - 0.5) * 0.05 * w003 * grassMask;
            // fiorellini radi nelle praterie umide
            float fl = step(0.985, lnoise(pl, 512.0)) * w003;
            base = mix(base, vec3(0.86, 0.80, 0.62), fl * 0.6 * grassMask);
          }
        }

        // foreste: radure e gruppi a media distanza, chiome tonde da vicino
        if (trees > 0.04 && sand < 0.9) {
          // colore delle foglie: verde del bioma per le foreste, un verde
          // oliva più scuro per gli alberi sparsi su erba e savana
          vec3 leaf = mix(vec3(0.27, 0.36, 0.22), vColor, forest);
          vec3 leafDark = leaf * vec3(0.62, 0.70, 0.74);
          vec3 leafLight = leaf * vec3(1.10, 1.14, 0.95);
          vec3 fcol = mix(base, leaf, forest);
          // da media distanza: macchie di alberi (scurisce in proporzione)
          fcol = mix(fcol, leafDark, (1.0 - forest) * trees * 0.45 * (1.0 - w01));
          if (w03 > 0.0) {
            float clump = smoothstep(0.40, 0.60, lnoise(pl, 8.0));
            fcol = mix(fcol, mix(leafDark, leafLight, clump), 0.55 * w03 * forest);
          }
          if (w01 > 0.0) {
            // da vicino: chiome tonde, illuminate come cupole
            float dens = mix(trees * 0.9, 1.0, forest);
            float aa = clamp(foot * 64.0 * 1.4, 0.04, 0.6);
            // coordinate riportate al livello del mare: la quota del terreno
            // non deve spostare gli alberi dentro/fuori dallo strato di ricerca
            vec4 cp = canopy(pl - R * vElev, 64.0, R, dens, aa, sunTanG);
            vec3 tint = mix(vec3(0.94, 1.0, 0.92), vec3(1.06, 1.02, 0.88), cp.z);
            vec3 crown = leaf * tint * mix(0.62, 1.10, smoothstep(-0.25, 0.8, cp.y));
            // sotto le chiome: sottobosco scuro nelle foreste, erba altrove
            vec3 under = mix(base, leafDark * 0.75, forest);
            under *= 1.0 - cp.w * 0.32;
            fcol = mix(fcol, mix(under, crown, cp.x), w01);
          }
          base = mix(base, fcol, max(forest, step(0.001, trees)));
        }

        // sabbia: dune a creste morbide e increspature da vicino
        if (sand > 0.01) {
          vec3 sc = base;
          if (w1 > 0.0) {
            vec3 warp = vec3(n1, n2, n0) - 0.5;
            // campo di dune a cresta (|rumore| rovesciato): la cresta è uno
            // spigolo, quindi il passaggio luce/ombra è netto come in
            // un'illustrazione. Il lato rivolto al sole è chiaro, quello
            // sottovento in ombra.
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
          if (w003 > 0.0) {
            float rip = n5;
            sc *= 1.0 + (smoothstep(0.4, 0.6, rip) - 0.5) * 0.06 * w003;
          }
          base = mix(base, sc, sand);
        }

        // roccia: strati orizzontali e fessure
        if (rock > 0.01) {
          float strata = sin(hKm * 52.0 + n3 * 3.0);
          vec3 rockA = vec3(0.47, 0.44, 0.40);
          vec3 rockB = vec3(0.58, 0.54, 0.48);
          vec3 rc = mix(rockA, rockB, smoothstep(-0.3, 0.3, strata) * scaleW(0.12, foot) + 0.5 * (1.0 - scaleW(0.12, foot)));
          rc = mix(rc, vColor, 0.25);
          if (w03 > 0.0) {
            float crack = smoothstep(0.035, 0.0, abs(n4 - 0.5));
            rc *= 1.0 - crack * 0.14 * w03;
          }
          base = mix(base, rc, rock);
        }

        // neve: bianca e pulita, ombre azzurre
        if (snow > 0.01) {
          vec3 sn = vec3(0.92, 0.94, 0.97);
          if (w1 > 0.0) sn *= 1.0 - (n2 - 0.5) * 0.06 * w1;
          base = mix(base, sn, snow);
        }

        // tinta altimetrica: le quote alte schiariscono e raffreddano, le valli
        // restano più sature. Aiuta a leggere il rilievo anche dall'alto.
        float hT = smoothstep(200.0, 4200.0, vHeight);
        base = mix(base, base * vec3(1.08, 1.06, 1.10) + 0.025, hT * 0.55 * (1.0 - snow));
        base *= mix(0.94, 1.0, smoothstep(0.0, 400.0, vHeight));

        // ============================================================ LUCE
        float sunUp = dot(R, uSunDir);
        float day = smoothstep(-0.30, 0.12, sunUp);

        // sole "basso" per il rilievo: stessa direzione del sole ma più radente,
        // così i pendii si leggono anche a mezzogiorno
        vec3 sunT = uSunDir - R * sunUp;
        float sunTl = length(sunT);
        vec3 lowDir = sunTl > 1e-3 ? normalize(sunT / sunTl + R * 0.75) : R;

        float ndl = dot(N, uSunDir);
        float ndlLow = dot(N, lowDir);

        // due bande morbide: ombra, luce, piccola luce piena
        float lit = smoothstep(-0.12, 0.30, ndl);
        float relief = smoothstep(0.15, 0.95, ndlLow);
        float light = mix(lit, relief, 0.55);
        light += smoothstep(0.80, 0.97, ndlLow) * 0.06;

        vec3 shadowTint = vec3(0.50, 0.55, 0.70);
        vec3 lightCol = mix(shadowTint, vec3(1.04, 1.01, 0.96), light);
        lightCol *= mix(0.32, 1.0, day);

        // occlusione morbida nelle valli e sulle pareti
        float ao = 1.0 - slope * 0.22;

        vec3 color = base * lightCol * ao;

        // ============================================================ ACQUA
        if (isWater > 0.001) {
          float depth = max(-vHeight, 0.0);
          vec3 deep = vec3(0.10, 0.25, 0.38);
          vec3 mid = vec3(0.17, 0.40, 0.52);
          vec3 shallow = vec3(0.30, 0.58, 0.62);
          vec3 wc = mix(shallow, mid, smoothstep(0.0, 60.0, depth));
          wc = mix(wc, deep, smoothstep(150.0, 3500.0, depth));
          // laghi e fiumi: tinta propria (il colore del bioma)
          float inland = step(-0.5, vHeight);
          wc = mix(wc, vColor * 1.05, inland * 0.7);

          // onde stilizzate da vicino (bande chiare che scorrono lente)
          vec3 plw = pl + vec3(uTime * 0.004, 0.0, uTime * 0.003);
          if (w03 > 0.0) {
            float wv = lfbm(plw, 16.0);
            wc *= 1.0 + (smoothstep(0.55, 0.62, wv) - smoothstep(0.62, 0.70, wv)) * 0.10 * w03;
          }

          // battigia: fascia chiara dove l'acqua è bassissima
          float shore = smoothstep(0.62, 0.45, waterF) * scaleW(0.4, foot);
          shore = max(shore, (1.0 - smoothstep(0.0, 6.0, depth)) * (1.0 - inland) * w1);
          wc = mix(wc, vec3(0.80, 0.88, 0.86), shore * 0.55);

          float wl = mix(0.62, 1.0, smoothstep(-0.2, 0.5, dot(R, uSunDir)));
          vec3 wcol = wc * wl * mix(0.32, 1.0, day);

          // riflesso del sole morbido e cielo radente
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(R, H), 0.0), 120.0);
          wcol += vec3(1.0, 0.96, 0.86) * smoothstep(0.25, 0.9, spec) * 0.35 * day;
          float fres = pow(1.0 - max(dot(R, V), 0.0), 4.0);
          wcol = mix(wcol, uHazeColor * mix(0.35, 0.9, day), fres * 0.45);

          color = mix(color, wcol, isWater);
        }

        // ============================================================ FOSCHIA
        // foschia leggera: solo in lontananza, verso l'orizzonte
        float fog = 1.0 - exp(-dist * uHazeDensity);
        fog = fog * fog;
        color = mix(color, uHazeColor * mix(0.3, 1.0, day), fog * 0.55);

        // correzione colore finale: un po' di contrasto e saturazione, per
        // un'immagine netta e non slavata
        float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        color = mix(vec3(luma), color, 1.14);
        color = (color - 0.42) * 1.08 + 0.42;
        color = max(color, 0.0);

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
