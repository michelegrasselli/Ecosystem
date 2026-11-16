// Materiale del terreno: shading "toon" a bande morbide, acqua con riflesso,
// foschia atmosferica in base alla distanza. Palette desaturata e matura.

import * as THREE from 'three'

export function createTerrainMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: {
      uSunDir: { value: new THREE.Vector3(sunDir.x, sunDir.y, sunDir.z).normalize() },
      uCameraPos: { value: new THREE.Vector3() },
      uHazeColor: { value: new THREE.Color(0.62, 0.74, 0.85) },
      uHazeDensity: { value: 0.00002 },
      uTime: { value: 0 },
      uWaterTint: { value: new THREE.Color(0.42, 0.62, 0.74) }
    },
    vertexShader: /* glsl */ `
      attribute vec3 aColor;
      attribute float aWater;

      varying vec3 vColor;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      varying float vWater;

      void main() {
        vColor = aColor;
        vWater = aWater;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vNormalW = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir;
      uniform vec3 uCameraPos;
      uniform vec3 uHazeColor;
      uniform vec3 uWaterTint;
      uniform float uHazeDensity;
      uniform float uTime;

      varying vec3 vColor;
      varying vec3 vNormalW;
      varying vec3 vWorld;
      varying float vWater;

      void main() {
        vec3 N = normalize(vNormalW);
        if (!gl_FrontFacing) N = -N;
        vec3 V = normalize(uCameraPos - vWorld);

        float ndl = dot(N, uSunDir);

        // --- bande morbide (toon) ---
        float lit = smoothstep(-0.18, 0.22, ndl);
        float band = mix(0.48, 1.0, lit);
        band = mix(band, 1.07, smoothstep(0.55, 0.98, ndl));

        vec3 color = vColor * band;

        // --- acqua ---
        if (vWater > 0.45) {
          vec3 H = normalize(uSunDir + V);
          float spec = pow(max(dot(N, H), 0.0), 60.0);
          color += uWaterTint * spec * 0.55 * smoothstep(0.15, 0.7, ndl);

          float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
          color = mix(color, uWaterTint, fres * 0.28);
        }

        // --- foschia atmosferica ---
        float dist = length(uCameraPos - vWorld);
        float fog = 1.0 - exp(-dist * uHazeDensity);
        color = mix(color, uHazeColor, fog * 0.72);

        gl_FragColor = vec4(color, 1.0);
      }
    `
  })
}
