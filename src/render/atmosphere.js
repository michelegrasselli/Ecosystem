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
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vNormalV;
      varying vec3 vNormalW;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vNormalV = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        #include <logdepthbuf_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor;
      uniform float uPower;
      uniform float uIntensity;
      uniform vec3 uSunDir;
      varying vec3 vNormalV;
      varying vec3 vNormalW;

      void main() {
        #include <logdepthbuf_fragment>
        // alone sul bordo del disco visto dalla camera: uno largo e morbido
        // (aria alta) e uno stretto e luminoso sul filo del pianeta
        float edge = 1.0 - abs(vNormalV.z);
        float wide = pow(edge, 1.5);
        float tight = pow(edge, 7.0);
        vec3 N = normalize(vNormalW);
        float sun = dot(N, uSunDir);
        // Niente notte, per ora (vedi main.js): alone uniforme, con appena un
        // filo di luce in più verso il sole. Con il ciclo giorno/notte:
        // lit = smoothstep(-0.55, 0.75, sun) e il tramonto al terminatore
        // (dusk = 1 - |smoothstep(-0.3, 0.4, sun) * 2 - 1|).
        float lit = 0.8 + 0.2 * smoothstep(-0.5, 0.5, sun);
        float dusk = 0.0;
        vec3 col = uColor * (wide * 0.45 + tight * 1.15) * (0.22 + 0.95 * lit);
        col += vec3(0.85, 0.55, 0.32) * tight * dusk * 0.3;
        float a = (wide * 0.28 + tight * 0.9) * (0.18 + lit);
        gl_FragColor = vec4(col * uIntensity, a * uIntensity);
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
      const t = THREE.MathUtils.smoothstep(altitudeKm, 45, 650)
      material.uniforms.uIntensity.value = 0.72 * t
      mesh.visible = t > 0.01
    }
  }
}
