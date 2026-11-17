// Cielo: cupola con gradiente orizzonte/zenit che segue la camera, più campo stellare.

import * as THREE from 'three'
import { SCENE_RADIUS } from '../planet/constants.js'

export function createSky() {
  const group = new THREE.Group()

  const skyMat = new THREE.ShaderMaterial({
    uniforms: {
      uUp: { value: new THREE.Vector3(0, 1, 0) },
      uZenith: { value: new THREE.Color(0.04, 0.06, 0.11) },
      uHorizon: { value: new THREE.Color(0.55, 0.68, 0.8) },
      uAltitudeBlend: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uUp;
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform float uAltitudeBlend;
      varying vec3 vDir;

      void main() {
        float h = dot(normalize(vDir), normalize(uUp));
        float t = smoothstep(-0.08, 0.62, h);
        vec3 col = mix(uHorizon, uZenith, t);

        // dallo spazio il cielo è quasi nero, ma con un alone azzurro verso il pianeta
        vec3 space = vec3(0.021, 0.031, 0.052);
        col = mix(col, space, uAltitudeBlend);

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false
  })

  const sky = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skyMat)
  sky.renderOrder = -1000
  sky.frustumCulled = false
  group.add(sky)

  // Campo stellare
  const starCount = 2600
  const pos = new Float32Array(starCount * 3)
  const col = new Float32Array(starCount * 3)
  const rand = mulberry32(918273)
  for (let i = 0; i < starCount; i++) {
    const u = rand() * 2 - 1
    const theta = rand() * Math.PI * 2
    const s = Math.sqrt(1 - u * u)
    pos[i * 3] = Math.cos(theta) * s
    pos[i * 3 + 1] = u
    pos[i * 3 + 2] = Math.sin(theta) * s
    const b = 0.45 + rand() * 0.55
    col[i * 3] = b
    col[i * 3 + 1] = b * (0.92 + rand() * 0.08)
    col[i * 3 + 2] = b
  }
  const starGeo = new THREE.BufferGeometry()
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  starGeo.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({
      size: 1.6,
      sizeAttenuation: false,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      // le stelle disegnano dopo il terreno (passata trasparente): senza test
      // di profondità comparivano come puntini bianchi sopra il pianeta
      depthTest: true,
      opacity: 1
    })
  )
  stars.renderOrder = -999
  stars.frustumCulled = false
  group.add(stars)

  return {
    group,
    sky,
    stars,
    /** Aggiorna cielo e stelle in base alla posizione della camera. */
    update(camera, altitude, maxAltitude) {
      const camDir = camera.position.clone().normalize()
      skyMat.uniforms.uUp.value.copy(camDir)

      // 0 = a terra, 1 = spazio profondo
      const t = THREE.MathUtils.clamp(
        Math.log10(Math.max(altitude, 1) / 6) / Math.log10(400 / 6),
        0,
        1
      )
      skyMat.uniforms.uAltitudeBlend.value = t

      // la cupola deve stare davanti alla camera e contenere tutto il visibile
      sky.position.copy(camera.position)
      const s = Math.max(maxAltitude * 2, 2 * SCENE_RADIUS)
      sky.scale.setScalar(s)

      stars.position.copy(camera.position)
      stars.scale.setScalar(Math.max(maxAltitude * 3, 1 * SCENE_RADIUS) * 2)
      stars.material.opacity = THREE.MathUtils.clamp((t - 0.25) / 0.6, 0, 1)
      stars.visible = stars.material.opacity > 0.01
    }
  }
}

function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), 1 | t)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
