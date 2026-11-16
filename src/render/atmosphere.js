// Alone atmosferico: sfera leggermente più grande del pianeta con glow additivo.
// Scompare quando la camera scende in basso, per non coprire il terreno.

import * as THREE from 'three'
import { SCENE_RADIUS } from '../planet/constants.js'

export function createAtmosphere() {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(0.42, 0.63, 0.9) },
      uPower: { value: 2.6 },
      uIntensity: { value: 1 },
      uSunDir: { value: new THREE.Vector3(0.6, 0.4, 0.7).normalize() }
    },
    vertexShader: /* glsl */ `
      varying vec3 vNormalV;
      varying vec3 vNormalW;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vNormalV = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      uniform vec3 uSunDir;
      varying vec3 vNormalV;
      varying vec3 vNormalW;

      void main() {
        // alone sul bordo del disco visto dalla camera
        float rim = pow(1.0 - abs(vNormalV.z), uPower);
        // più luminoso sul lato illuminato dal sole
        float sun = 0.35 + 0.65 * smoothstep(-0.35, 0.6, dot(normalize(vNormalW), uSunDir));
        gl_FragColor = vec4(uColor * rim * sun * uIntensity, rim * uIntensity);
      }
    `,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest: true
  })

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SCENE_RADIUS * 1.045, 64, 48), material)
  mesh.renderOrder = 10
  mesh.frustumCulled = false

  return {
    mesh,
    material,
    update(altitudeKm) {
      const t = THREE.MathUtils.smoothstep(altitudeKm, 60, 700)
      material.uniforms.uIntensity.value = 0.55 * t
      mesh.visible = t > 0.01
    }
  }
}
