// "Fotografie" delle piante per l'enciclopedia: ogni specie viene renderizzata
// una volta sola in un piccolo canvas WebGL separato, in uno scenario fantasy
// come le illustrazioni di contesto/ (cielo crepuscolare, foschia colorata,
// lucciole, parti luminose con alone), poi salvata come immagine.
//
// Lo scenario dipende dall'habitat principale della specie: foresta, palude,
// mare (con il pelo dell'acqua e la parte sommersa velata), ghiacci, vulcani,
// deserti e valli di cristalli. Accanto alla pianta crescono un paio di specie
// dello stesso bioma, in proporzione: le piccole fanno capire quanto è grande.

import * as THREE from 'three'
import { SPECIES, biomeFlora, speciesHabitats } from '../planet/flora.js'
import { BIOME } from '../planet/biomes.js'
import { buildPlantGeometries } from '../render/plantModels.js'

const W = 480
const H = 340

// sky: zenit, orizzonte; ground; fog; rim (controluce); key (luce principale)
const MOODS = {
  forest: { sky: [0x0c1f3a, 0x3f6f78], ground: 0x1f3a24, fog: 0x2d5560, rim: 0x9ff0d8, key: 0xffe2b0, motes: 0xb8ffb0 },
  jungle: { sky: [0x102a2a, 0x4c8a6a], ground: 0x1c3a1c, fog: 0x2f6650, rim: 0xc8ff9a, key: 0xfff0b8, motes: 0xfff2a0 },
  swamp: { sky: [0x0d1d24, 0x3b5f58], ground: 0x1b2e22, fog: 0x34564c, rim: 0x9fffd0, key: 0xe8ffd0, motes: 0xc0ff80, water: 0x1d3d38 },
  sea: { sky: [0x0b1f44, 0x4aa0c0], ground: 0x0d2b40, fog: 0x2f7590, rim: 0xb0f4ff, key: 0xfff0d0, motes: 0xc8f8ff, water: 0x1a6b8a },
  ice: { sky: [0x0d1838, 0x7aa4d0], ground: 0xc4d6e6, fog: 0x8fb0d0, rim: 0xe0f6ff, key: 0xfff4e8, motes: 0xffffff },
  fire: { sky: [0x1a0a10, 0x7a2a1a], ground: 0x2a1e1c, fog: 0x5a2a20, rim: 0xffa060, key: 0xffd0a0, motes: 0xffa040 },
  desert: { sky: [0x1d1838, 0xd08850], ground: 0x8a6a40, fog: 0xb07a58, rim: 0xffd890, key: 0xfff0c8, motes: 0xffe0a0 },
  crystal: { sky: [0x120c30, 0x6a4aa0], ground: 0x2a2048, fog: 0x4a3a80, rim: 0x9fd8ff, key: 0xf0e0ff, motes: 0xc0e8ff },
  meadow: { sky: [0x14244a, 0x8a9ac0], ground: 0x3a5a2a, fog: 0x6a7aa0, rim: 0xfff0c0, key: 0xfff0d8, motes: 0xfff6c0 }
}

const MOOD_OF = {
  [BIOME.RAINFOREST]: 'jungle',
  [BIOME.TEMPERATE_FOREST]: 'forest',
  [BIOME.BOREAL_FOREST]: 'forest',
  [BIOME.GRASSLAND]: 'meadow',
  [BIOME.ALPINE_MEADOW]: 'meadow',
  [BIOME.SAVANNA]: 'desert',
  [BIOME.SHRUBLAND]: 'meadow',
  [BIOME.WETLAND]: 'swamp',
  [BIOME.SWAMP]: 'swamp',
  [BIOME.DESERT]: 'desert',
  [BIOME.SEMI_DESERT]: 'desert',
  [BIOME.BADLANDS]: 'desert',
  [BIOME.SALT_FLAT]: 'ice',
  [BIOME.BEACH]: 'sea',
  [BIOME.TUNDRA]: 'ice',
  [BIOME.ICE]: 'ice',
  [BIOME.SNOW]: 'ice',
  [BIOME.ROCK]: 'crystal',
  [BIOME.VOLCANIC]: 'fire',
  [BIOME.LAVA_FIELD]: 'fire',
  [BIOME.SCORCHED]: 'fire',
  [BIOME.CRYSTAL_VALLEY]: 'crystal',
  [BIOME.OCEAN_SHELF]: 'sea',
  [BIOME.OCEAN]: 'sea'
}

const VERT = /* glsl */ `
  attribute vec3 aCol;
  attribute float aGlow;
  varying vec3 vCol;
  varying vec3 vN;
  varying float vGlow;
  varying vec3 vW;
  void main() {
    vCol = aCol;
    vGlow = aGlow;
    vec4 w = modelMatrix * vec4(position, 1.0);
    vW = w.xyz;
    vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`
const FRAG = /* glsl */ `
  uniform vec3 uKey;
  uniform vec3 uKeyDir;
  uniform vec3 uRim;
  uniform vec3 uFog;
  uniform vec3 uCam;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uWaterY;
  uniform vec3 uWater;
  uniform float uDim;
  uniform float uGlowPass;
  varying vec3 vCol;
  varying vec3 vN;
  varying float vGlow;
  varying vec3 vW;
  void main() {
    vec3 n = normalize(vN);
    vec3 V = normalize(uCam - vW);
    if (dot(n, V) < 0.0) n = -n;
    vec3 alb = vCol * 1.3;
    float key = smoothstep(-0.2, 0.8, dot(n, uKeyDir));
    float sky = 0.5 + 0.5 * n.y;
    float rim = pow(1.0 - max(dot(n, V), 0.0), 2.6);
    vec3 col = alb * uKey * (0.28 + 0.8 * key) + alb * uFog * 0.35 * sky + uRim * rim * 0.55;
    col = mix(col, alb * 1.5 + vec3(0.1), vGlow);
    // parte sommersa: velata dall'acqua
    float under = smoothstep(0.0, -0.08, vW.y - uWaterY);
    col = mix(col, mix(uWater, col * 0.6 + uWater * 0.3, 0.35 + 0.4 * vGlow), under * 0.85);
    float f = smoothstep(uFogNear, uFogFar, length(vW - uCam));
    // passata dell'alone: solo le parti luminose (poi sfocate e sommate)
    if (uGlowPass > 0.5) {
      gl_FragColor = vec4(alb * vGlow * 1.3 * (1.0 - 0.7 * f) * (1.0 - 0.6 * under) * uDim, 1.0);
      return;
    }
    col = mix(col, uFog, f * 0.85) * uDim;
    gl_FragColor = vec4(col, 1.0);
  }
`

let renderer = null
let geos = null
const cache = new Map()

function rand(seed) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sprite() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  gr.addColorStop(0, 'rgba(255,255,255,1)')
  gr.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  gr.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = gr
  g.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
let dotTex = null

/** Habitat principale (bioma) di una specie. */
export function mainHabitat(id) {
  return speciesHabitats(id)[0] ?? BIOME.GRASSLAND
}

/**
 * Immagine (data URL) della specie id, in uno scenario fantasy del suo habitat.
 * Calcolata una volta sola per specie.
 */
export function plantPortrait(id) {
  if (cache.has(id)) return cache.get(id)
  if (!renderer) {
    const canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(1)
    renderer.setSize(W, H, false)
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace
    geos = buildPlantGeometries(SPECIES, 0)
    dotTex = sprite()
  }
  const url = render(id)
  cache.set(id, url)
  return url
}

function plantMesh(id, uniforms, dim = 1) {
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: { ...uniforms, uDim: { value: dim } },
    side: THREE.DoubleSide
  })
  return new THREE.Mesh(geos[id], mat)
}

function render(id) {
  const sp = SPECIES[id]
  const habitat = mainHabitat(id)
  const moodKey = MOOD_OF[habitat] || 'forest'
  const M = MOODS[moodKey]
  const rnd = rand(id * 7919 + 13)
  const water = M.water !== undefined && (moodKey === 'sea' || ['tidelotus', 'reedmace', 'bogcypress', 'saltroot'].includes(sp.key))
  const waterY = water ? 0 : -99

  const scene = new THREE.Scene()
  const fog = new THREE.Color(M.fog)
  // cielo: gradiente dallo zenit all'orizzonte, con un bagliore dietro la pianta
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color(M.sky[0]) }, uHor: { value: new THREE.Color(M.sky[1]) }, uRim: { value: new THREE.Color(M.rim) } },
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uRim; varying vec3 vD;
      void main(){ float t = smoothstep(-0.05, 0.6, vD.y);
        vec3 c = mix(uHor, uTop, t);
        float halo = pow(max(dot(vD, normalize(vec3(-0.25, 0.25, -1.0))), 0.0), 6.0);
        c += uRim * halo * 0.35;
        gl_FragColor = vec4(c, 1.0); }`
  })
  const skyMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), skyMat)
  scene.add(skyMesh)

  const uniforms = {
    uKey: { value: new THREE.Color(M.key) },
    uKeyDir: { value: new THREE.Vector3(0.55, 0.65, 0.5).normalize() },
    uRim: { value: new THREE.Color(M.rim) },
    uFog: { value: fog },
    uCam: { value: new THREE.Vector3() },
    uFogNear: { value: 3 },
    uFogFar: { value: 18 },
    uWaterY: { value: waterY },
    uWater: { value: new THREE.Color(M.water ?? M.fog) },
    uGlowPass: { value: 0 }
  }
  // nella passata dell'alone si nascondono cielo, terreno, colline e acqua
  const backdrop = []

  // la pianta principale (alta 1 nel modello)
  const g = geos[id]
  g.computeBoundingBox()
  const bb = g.boundingBox
  const main = plantMesh(id, uniforms)
  main.rotation.y = 0.6
  scene.add(main)

  // terreno: un disco che sfuma nella foschia
  const groundMat = new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(M.ground) }, uFog: { value: fog } },
    vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uC; uniform vec3 uFog; varying vec2 vP;
      void main(){ float r = length(vP); float n = sin(vP.x*9.0)*sin(vP.y*7.0)*0.06;
        vec3 c = uC * (0.75 + n + 0.35 * smoothstep(3.0, 0.0, r));
        gl_FragColor = vec4(mix(c, uFog, smoothstep(2.0, 14.0, r)), 1.0); }`
  })
  const ground = new THREE.Mesh(new THREE.CircleGeometry(30, 48), groundMat)
  ground.rotation.x = -Math.PI / 2
  ground.position.y = water ? -0.6 : -0.02
  scene.add(ground)
  backdrop.push(skyMesh, ground)

  // colline (o isole) lontane a strati, sempre più velate dalla foschia
  const gcol = new THREE.Color(M.ground)
  for (let k = 0; k < 5; k++) {
    const far = k / 4
    const c = gcol.clone().lerp(fog, 0.35 + 0.45 * far).multiplyScalar(0.75 + 0.15 * far)
    const hill = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), new THREE.MeshBasicMaterial({ color: c }))
    const r = 5 + 4 * rnd()
    hill.scale.set(r, r * (water ? 0.12 : 0.22 + 0.18 * rnd()), r * 0.6)
    hill.position.set((rnd() - 0.5) * 22, water ? -0.1 : -0.3, -11 - 9 * far - 3 * rnd())
    scene.add(hill)
    backdrop.push(hill)
  }

  // ciuffi d'erba (o di neve, di sabbia, di cenere) intorno alla pianta
  if (!water) {
    const tg = tufts(rnd, gcol, moodKey === 'desert' || moodKey === 'fire' ? 70 : 220, 3.2)
    const tm = new THREE.Mesh(tg, new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: { ...uniforms, uDim: { value: 0.9 } }, side: THREE.DoubleSide }))
    scene.add(tm)
  }

  // compagne: specie dello stesso bioma, in scala con la pianta principale
  const flora = biomeFlora(habitat).filter((e) => e.id !== id)
  const comp = []
  for (let k = 0; k < Math.min(3, flora.length); k++) comp.push(flora[Math.floor(rnd() * Math.min(6, flora.length))].id)
  const spots = [[-1.3, -1.6], [1.4, -2.2], [-0.4, -3.4], [2.2, -0.6], [-2.4, -0.4]]
  comp.forEach((cid, k) => {
    const rel = Math.min(SPECIES[cid].h / sp.h, 1.4)
    const m = plantMesh(cid, uniforms, 0.85)
    const [x, z] = spots[k % spots.length]
    m.position.set(x * (0.6 + 0.4 * Math.min(rel, 1)), 0, z)
    m.scale.setScalar(rel)
    m.rotation.y = rnd() * 6.28
    scene.add(m)
    // un secondo esemplare più piccolo
    if (rel < 0.5) {
      const m2 = plantMesh(cid, uniforms, 0.8)
      m2.position.set(-x * 0.7 + 0.3, 0, z * 0.5 + 0.6)
      m2.scale.setScalar(rel * 0.8)
      m2.rotation.y = rnd() * 6.28
      scene.add(m2)
    }
  })
  // esemplari della stessa specie sullo sfondo
  for (let k = 0; k < 2; k++) {
    const m = plantMesh(id, uniforms, 0.7)
    m.position.set(k ? 3.4 : -3.8, 0, -6 - 2 * k)
    m.scale.setScalar(0.85 + 0.2 * k)
    m.rotation.y = rnd() * 6.28
    scene.add(m)
  }

  // acqua: superficie semitrasparente
  if (water) {
    const wm = new THREE.Mesh(
      new THREE.CircleGeometry(30, 48),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(M.water).multiplyScalar(1.15), transparent: true, opacity: 0.55, depthWrite: false })
    )
    wm.rotation.x = -Math.PI / 2
    wm.position.y = 0.001
    wm.renderOrder = 2
    scene.add(wm)
    backdrop.push(wm)
    // riflessi
    const rp = []
    for (let k = 0; k < 120; k++) rp.push((rnd() - 0.5) * 10, 0.01, -rnd() * 9 + 1.5)
    const rg = new THREE.BufferGeometry()
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3))
    scene.add(new THREE.Points(rg, new THREE.PointsMaterial({ color: M.rim, size: 0.06, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 })))
  }

  // lucciole / spore / scintille
  const mp = []
  for (let k = 0; k < 90; k++) mp.push((rnd() - 0.5) * 6, rnd() * 1.6 + 0.05, (rnd() - 0.7) * 6)
  const mg = new THREE.BufferGeometry()
  mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3))
  const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: M.motes, size: 0.06, map: dotTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }))
  motes.renderOrder = 3
  scene.add(motes)

  // inquadratura dal basso, come un ritratto
  const top = bb.max.y
  const width = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
  const fit = Math.max(top * 1.1, width * 0.78)
  const camera = new THREE.PerspectiveCamera(34, W / H, 0.01, 200)
  const dist = (fit * 0.52) / Math.tan(THREE.MathUtils.degToRad(17)) + 0.15
  camera.position.set(dist * 0.3, top * 0.22 + 0.08, dist)
  camera.lookAt(0, top * 0.5, 0)
  uniforms.uCam.value.copy(camera.position)
  uniforms.uFogNear.value = dist * 1.05
  uniforms.uFogFar.value = dist * 3.2
  // le lucciole intorno alla pianta, in scala
  motes.scale.setScalar(Math.max(fit, 0.5))

  renderer.setClearColor(fog, 1)
  renderer.render(scene, camera)
  const out = document.createElement('canvas')
  out.width = W
  out.height = H
  const c = out.getContext('2d')
  c.drawImage(renderer.domElement, 0, 0)

  // alone delle parti luminose: seconda passata con le sole parti accese,
  // sfocata e sommata (bloom), come nelle illustrazioni di riferimento
  for (const o of backdrop) o.visible = false
  uniforms.uGlowPass.value = 1
  renderer.setClearColor(0x000000, 1)
  renderer.render(scene, camera)
  c.globalCompositeOperation = 'lighter'
  c.filter = 'blur(14px)'
  c.globalAlpha = 0.75
  c.drawImage(renderer.domElement, 0, 0)
  c.filter = 'blur(4px)'
  c.globalAlpha = 0.6
  c.drawImage(renderer.domElement, 0, 0)
  c.filter = 'none'
  c.globalAlpha = 1
  c.globalCompositeOperation = 'source-over'
  const vg = c.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, W * 0.72)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(4,6,14,0.62)')
  c.fillStyle = vg
  c.fillRect(0, 0, W, H)

  // pulizia (le geometrie delle piante restano in cache)
  scene.traverse((o) => {
    if (o.material) o.material.dispose()
    if (o.geometry && !geos.includes(o.geometry)) o.geometry.dispose()
  })
  return out.toDataURL('image/jpeg', 0.9)
}

/** Ciuffi di fili sottili sparsi sul terreno attorno alla pianta. */
function tufts(rnd, color, n, radius) {
  const base = new THREE.ConeGeometry(1, 1, 4, 1).translate(0, 0.5, 0).toNonIndexed()
  const P = base.attributes.position
  const N = base.attributes.normal
  const pos = []
  const nor = []
  const col = []
  const glow = []
  const m = new THREE.Matrix4()
  const nm = new THREE.Matrix3()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  const sc = new THREE.Vector3()
  const t = new THREE.Vector3()
  const v = new THREE.Vector3()
  const nn = new THREE.Vector3()
  for (let k = 0; k < n; k++) {
    const r = radius * Math.sqrt(rnd())
    const a = rnd() * Math.PI * 2
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r - 0.6
    if (Math.hypot(x, z) < 0.2) continue
    const tint = 0.85 + 0.4 * rnd()
    for (let j = 0; j < 4; j++) {
      e.set((rnd() - 0.5) * 0.7, rnd() * 6.28, (rnd() - 0.5) * 0.7)
      q.setFromEuler(e)
      const h = 0.03 + 0.06 * rnd()
      sc.set(0.007, h, 0.007)
      t.set(x + (rnd() - 0.5) * 0.03, -0.01, z + (rnd() - 0.5) * 0.03)
      m.compose(t, q, sc)
      nm.getNormalMatrix(m)
      for (let i = 0; i < P.count; i++) {
        v.fromBufferAttribute(P, i).applyMatrix4(m)
        nn.fromBufferAttribute(N, i).applyMatrix3(nm).normalize()
        pos.push(v.x, v.y, v.z)
        nor.push(nn.x, nn.y, nn.z)
        const kk = (0.7 + 0.9 * P.getY(i)) * tint
        col.push(color.r * kk * 1.4, color.g * kk * 1.5, color.b * kk * 1.2)
        glow.push(0)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 3))
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1))
  return g
}
