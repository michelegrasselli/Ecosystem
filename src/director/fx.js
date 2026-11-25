// Effetti cinematografici dei video (post-produzione in WebGL2).
//
// Il fotogramma (immagine 3D + particelle) entra come texture e ne esce con:
//  - bagliore (bloom) su due livelli di sfocatura, per luci e lava;
//  - messa a fuoco: l'immagine può partire sfocata e "andare a fuoco";
//  - aberrazione cromatica ai bordi, leggero "respiro" dell'inquadratura;
//  - nebbia mistica animata (rumore frattale) e luci calde da obiettivo
//    ("light leak") che si muovono lente negli angoli;
//  - color grading: ombre fredde (blu-viola), luci calde (oro), saturazione,
//    contrasto a S, una tinta per scena (es. rosso nelle scene di fuoco);
//  - vignettatura e grana della pellicola;
//  - tremore della camera (shakes) e onde d'urto (shocks) che deformano
//    l'immagine con un anello di luce che si allarga.
//
// Tutto dipende solo dal tempo del video: rigirando si ottiene lo stesso
// risultato. I parametri vengono da script.fx (vedi evalFx).

const VERT = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`

// riduzione 4x4 -> 1 (4 campioni bilineari)
const DOWN = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb
         + texture(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb
         + texture(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb
         + texture(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  o = vec4(c * 0.25, 1.0);
}`

// sfocatura gaussiana separabile, 9 campioni
const BLUR = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uStep;
in vec2 vUv;
out vec4 o;
void main() {
  vec3 c = texture(uTex, vUv).rgb * 0.2270270270;
  c += texture(uTex, vUv + uStep * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUv - uStep * 1.3846153846).rgb * 0.3162162162;
  c += texture(uTex, vUv + uStep * 3.2307692308).rgb * 0.0702702703;
  c += texture(uTex, vUv - uStep * 3.2307692308).rgb * 0.0702702703;
  o = vec4(c, 1.0);
}`

const FINAL = `#version 300 es
precision highp float;
uniform sampler2D uSrc;
uniform sampler2D uQ;
uniform sampler2D uQ2;
uniform vec2 uRes;
uniform float uTime;
uniform float uFrame;
uniform float uExposure;
uniform float uFocus;
uniform float uBloom;
uniform float uThreshold;
uniform float uCA;
uniform float uGrain;
uniform float uFog;
uniform float uLeak;
uniform float uSat;
uniform float uContrast;
uniform float uVignette;
uniform float uBreath;
uniform float uTintAmt;
uniform vec3 uTint;
uniform vec3 uFogColor;
uniform vec3 uShadow;
uniform vec3 uHigh;
uniform vec2 uShake;
uniform vec4 uShock; // centro (x, y in 0..1), raggio (in altezze dello schermo), intensità
in vec2 vUv;
out vec4 o;

float hash(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}

void main() {
  float aspect = uRes.x / uRes.y;
  // "respiro" lentissimo dell'inquadratura
  vec2 uv = (vUv - 0.5) / (1.0 + uBreath * (0.5 + 0.5 * sin(uTime * 0.21))) + 0.5;
  // tremore: spostamento casuale (con un leggero ingrandimento per non
  // scoprire i bordi)
  uv = (uv - 0.5) / (1.0 + length(uShake) * 2.0) + 0.5 + uShake;
  // onda d'urto: l'anello spinge l'immagine verso l'esterno
  float ring = 0.0;
  if (uShock.w > 0.001) {
    vec2 sd = (uv - uShock.xy) * vec2(aspect, 1.0);
    float sl = length(sd);
    float rd = sl - uShock.z;
    ring = exp(-rd * rd / 0.0025) * uShock.w;
    uv -= (sl > 1e-4 ? sd / sl : vec2(0.0)) / vec2(aspect, 1.0) * ring * 0.035;
  }
  vec2 d = uv - 0.5;
  vec2 da = d * vec2(aspect, 1.0);
  float r2 = dot(da, da);

  // aberrazione cromatica, più forte verso i bordi
  vec2 ca = d * uCA * (0.25 + r2 * 2.5);
  vec3 c;
  c.r = texture(uSrc, uv + ca).r;
  c.g = texture(uSrc, uv).g;
  c.b = texture(uSrc, uv - ca).b;

  vec3 q1 = texture(uQ, uv).rgb;
  vec3 q2 = texture(uQ2, uv).rgb;

  // messa a fuoco (sfocatura che si apre dal centro)
  float foc = clamp(uFocus * (1.0 + r2 * 1.5), 0.0, 1.0);
  vec3 soft = mix(q1, q2, smoothstep(0.4, 1.0, foc));
  c = mix(c, soft, smoothstep(0.0, 0.7, foc));

  // bagliore
  vec3 b1 = max(q1 - uThreshold, 0.0);
  vec3 b2 = max(q2 - uThreshold * 0.75, 0.0);
  c += (b1 * 0.7 + b2 * 1.3) * uBloom;

  c *= uExposure;
  // anello luminoso dell'onda d'urto
  c += vec3(1.0, 0.78, 0.5) * ring * 0.55;

  // nebbia mistica: due strati di rumore che scorrono in direzioni diverse
  vec2 fp = vec2(uv.x * aspect, uv.y) * 2.4;
  float w = fbm(fp + vec2(uTime * 0.035, -uTime * 0.05));
  float f = fbm(fp * 1.35 + w * 1.8 + vec2(-uTime * 0.022, uTime * 0.017));
  float fogM = smoothstep(0.42, 0.95, f) * uFog * (0.45 + 0.55 * smoothstep(0.0, 0.35, r2));
  c += uFogColor * fogM;

  // light leak: macchie calde e fredde che vagano negli angoli
  vec2 l1 = vec2(0.92 + 0.06 * sin(uTime * 0.13), 0.86 + 0.07 * cos(uTime * 0.11));
  vec2 l2 = vec2(0.06 + 0.05 * cos(uTime * 0.09), 0.12 + 0.06 * sin(uTime * 0.15));
  float k1 = exp(-length((uv - l1) * vec2(aspect, 1.0)) * 3.2);
  float k2 = exp(-length((uv - l2) * vec2(aspect, 1.0)) * 3.6);
  c += (vec3(1.0, 0.6, 0.28) * k1 + vec3(0.45, 0.32, 1.0) * k2 * 0.7) * uLeak;

  // color grading
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, uSat);
  c = mix(c, c * uTint, uTintAmt);
  c += uShadow * (1.0 - smoothstep(0.0, 0.5, l));
  c *= mix(vec3(1.0), uHigh, smoothstep(0.35, 1.0, l));
  c = clamp(c, 0.0, 1.0);
  c = mix(c, c * c * (3.0 - 2.0 * c), uContrast);

  // vignettatura
  c *= 1.0 - uVignette * smoothstep(0.08, 0.6, r2);

  // grana della pellicola (più visibile nelle ombre)
  float g = hash(vUv * uRes + fract(uFrame * 0.6180339) * 917.0) - 0.5;
  c += g * uGrain * (1.15 - l);

  o = vec4(clamp(c, 0.0, 1.0), 1.0);
}`

export const FX_DEFAULTS = {
  exposure: 1,
  focus: 0,
  bloom: 0.45,
  threshold: 0.72,
  ca: 0.0025,
  grain: 0.06,
  fog: 0.18,
  fogColor: [0.32, 0.3, 0.55],
  leak: 0.12,
  sat: 1.05,
  contrast: 0.35,
  vignette: 0.55,
  breath: 0.012,
  tint: [1, 1, 1],
  tintAmt: 0,
  shadow: [0.0, 0.012, 0.035],
  high: [1.04, 0.99, 0.9],
  // lava dello shader del terreno più accesa (eruzioni)
  lavaBoost: 0,
  // fronte di crescita della flora (km da fx.growAt / fx.grows; -1 = spento)
  growFront: -1,
  growSoft: 300,
  // vulcani accesi visti da lontano e pennacchi delle eruzioni (eruption.js)
  volcanoGlow: 0,
  plume: 0,
  ash: 0,
  // particelle (particles.js): pulviscolo dorato e braci che salgono
  dust: 0.5,
  embers: 0,
  plankton: 0
}

const smooth = (x) => x * x * (3 - 2 * x)

function lerpVal(a, b, k) {
  if (Array.isArray(a)) return a.map((v, i) => v + (b[i] - v) * k)
  return a + (b - a) * k
}

/** Inviluppo di un lampo: sale in `rise` s, picco ad `at`, scende in `decay` s. */
function flashEnv(t, f) {
  const rise = f.rise ?? 0.25
  const decay = f.decay ?? 1.2
  if (t < f.at - rise || t > f.at + decay) return 0
  if (t <= f.at) return smooth((t - (f.at - rise)) / rise)
  const x = (t - f.at) / decay
  return Math.exp(-x * 4) * (1 - x)
}

/** Inviluppo di una "discesa al buio" centrata in `at` (durata totale `dur`). */
function dipEnv(t, d) {
  const h = (d.dur ?? 0.8) / 2
  const x = Math.abs(t - d.at) / h
  return x >= 1 ? 0 : smooth(1 - x)
}

/**
 * Parametri degli effetti al tempo t.
 * script.fx = { ...valori base, keys: [{ at, ...valori }], flashes: [{ at, power, rise, decay }],
 *              dips: [{ at, dur }] }
 * Fra due chiavi che fissano lo stesso parametro il valore passa con una curva morbida.
 */
export function evalFx(fx, t) {
  const base = { ...FX_DEFAULTS }
  for (const k of Object.keys(FX_DEFAULTS)) if (fx[k] !== undefined) base[k] = fx[k]
  const out = { ...base }
  const keys = (fx.keys || []).slice().sort((a, b) => a.at - b.at)
  for (const name of Object.keys(FX_DEFAULTS)) {
    const ks = keys.filter((k) => k[name] !== undefined)
    if (!ks.length) continue
    if (t <= ks[0].at) {
      out[name] = ks[0][name]
      continue
    }
    const last = ks[ks.length - 1]
    if (t >= last.at) {
      out[name] = last[name]
      continue
    }
    for (let i = 0; i < ks.length - 1; i++) {
      const a = ks[i]
      const b = ks[i + 1]
      if (t >= a.at && t <= b.at) {
        out[name] = lerpVal(a[name], b[name], smooth((t - a.at) / (b.at - a.at)))
        break
      }
    }
  }
  let flash = 0
  for (const f of fx.flashes || []) flash = Math.max(flash, flashEnv(t, f) * (f.power ?? 1))
  let dip = 0
  for (const d of fx.dips || []) dip = Math.max(dip, dipEnv(t, d))
  out.exposure = out.exposure * (1 + flash * 0.9) * (1 - dip)
  out.bloom += flash * 1.4
  out.threshold = Math.max(0.2, out.threshold - flash * 0.35)
  out.focus = Math.min(1, out.focus + dip * 0.8 + flash * 0.25)
  out.ca += flash * 0.006
  out.flash = flash

  // tremore: decresce dopo ogni colpo; direzione pseudo-casuale per fotogramma
  let shake = 0
  for (const s of fx.shakes || []) {
    const dur = s.dur ?? 1.5
    if (t >= s.at && t <= s.at + dur) shake = Math.max(shake, (s.power ?? 1) * Math.pow(1 - (t - s.at) / dur, 2))
  }
  const fr = Math.floor(t * 30)
  const h1 = Math.sin(fr * 12.9898) * 43758.5453
  const h2 = Math.sin(fr * 78.233) * 12345.678
  out.shake = [(h1 - Math.floor(h1) - 0.5) * shake * 0.012, (h2 - Math.floor(h2) - 0.5) * shake * 0.012]

  // onda d'urto: raggio che cresce, intensità che si spegne
  out.shock = [0.5, 0.5, 0, 0]
  for (const k of fx.shocks || []) {
    const dur = k.dur ?? 1.6
    if (t < k.at || t > k.at + dur) continue
    const x = (t - k.at) / dur
    out.shock = [k.x ?? 0.5, k.y ?? 0.5, (k.radius ?? 1.1) * (1 - Math.pow(1 - x, 2.2)), (k.power ?? 1) * (1 - x) * (1 - x)]
  }
  out.lavaBoost = out.lavaBoost ?? 0
  return out
}

function compile(gl, type, src) {
  const s = gl.createShader(type)
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('fx shader: ' + gl.getShaderInfoLog(s))
  return s
}

function program(gl, frag) {
  const p = gl.createProgram()
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag))
  gl.linkProgram(p)
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('fx link: ' + gl.getProgramInfoLog(p))
  const u = {}
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i)
    u[info.name] = gl.getUniformLocation(p, info.name)
  }
  return { p, u }
}

function texture(gl) {
  const t = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  return t
}

function target(gl, w, h) {
  const tex = texture(gl)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  const fb = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
  return { tex, fb, w, h }
}

/** Crea il motore degli effetti (un canvas WebGL2 separato da quello della scena). */
export function createFx() {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: true
  })
  if (!gl) return null
  const down = program(gl, DOWN)
  const blur = program(gl, BLUR)
  const fin = program(gl, FINAL)
  const vao = gl.createVertexArray()
  const src = texture(gl)
  let W = 0
  let H = 0
  let q1 = null
  let q1b = null
  let q2 = null
  let q2b = null

  function resize(w, h) {
    if (w === W && h === H) return
    W = canvas.width = w
    H = canvas.height = h
    for (const r of [q1, q1b, q2, q2b]) {
      if (!r) continue
      gl.deleteTexture(r.tex)
      gl.deleteFramebuffer(r.fb)
    }
    const w4 = Math.max(1, Math.round(w / 4))
    const h4 = Math.max(1, Math.round(h / 4))
    const w16 = Math.max(1, Math.round(w / 16))
    const h16 = Math.max(1, Math.round(h / 16))
    q1 = target(gl, w4, h4)
    q1b = target(gl, w4, h4)
    q2 = target(gl, w16, h16)
    q2b = target(gl, w16, h16)
  }

  function pass(prog, out, tex, setup) {
    gl.useProgram(prog.p)
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fb : null)
    gl.viewport(0, 0, out ? out.w : W, out ? out.h : H)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    if (prog.u.uTex) gl.uniform1i(prog.u.uTex, 0)
    setup?.(prog.u)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
  }

  function blurInto(a, b, radius) {
    pass(blur, b, a.tex, (u) => gl.uniform2f(u.uStep, radius / a.w, 0))
    pass(blur, a, b.tex, (u) => gl.uniform2f(u.uStep, 0, radius / a.h))
  }

  /**
   * Applica gli effetti a un'immagine.
   * @param {HTMLCanvasElement} source fotogramma (dimensioni = uscita)
   * @param {object} p parametri da evalFx
   * @param {number} t secondi
   * @param {number} frame indice del fotogramma (per la grana)
   * @returns {HTMLCanvasElement}
   */
  function apply(source, p, t, frame) {
    resize(source.width, source.height)
    gl.bindVertexArray(vao)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)

    // 1/4 e 1/16 della risoluzione, sfocate (per bagliore e messa a fuoco)
    pass(down, q1, src, (u) => gl.uniform2f(u.uTexel, 1 / W, 1 / H))
    blurInto(q1, q1b, 1.4)
    blurInto(q1, q1b, 2.2)
    pass(down, q2, q1.tex, (u) => gl.uniform2f(u.uTexel, 1 / q1.w, 1 / q1.h))
    blurInto(q2, q2b, 1.4)
    blurInto(q2, q2b, 2.4)

    gl.useProgram(fin.p)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, W, H)
    const u = fin.u
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, src)
    gl.uniform1i(u.uSrc, 0)
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, q1.tex)
    gl.uniform1i(u.uQ, 1)
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, q2.tex)
    gl.uniform1i(u.uQ2, 2)
    gl.uniform2f(u.uRes, W, H)
    gl.uniform1f(u.uTime, t)
    gl.uniform1f(u.uFrame, frame)
    gl.uniform1f(u.uExposure, p.exposure)
    gl.uniform1f(u.uFocus, p.focus)
    gl.uniform1f(u.uBloom, p.bloom)
    gl.uniform1f(u.uThreshold, p.threshold)
    gl.uniform1f(u.uCA, p.ca)
    gl.uniform1f(u.uGrain, p.grain)
    gl.uniform1f(u.uFog, p.fog)
    gl.uniform1f(u.uLeak, p.leak)
    gl.uniform1f(u.uSat, p.sat)
    gl.uniform1f(u.uContrast, p.contrast)
    gl.uniform1f(u.uVignette, p.vignette)
    gl.uniform1f(u.uBreath, p.breath)
    gl.uniform1f(u.uTintAmt, p.tintAmt)
    gl.uniform3fv(u.uTint, p.tint)
    gl.uniform3fv(u.uFogColor, p.fogColor)
    gl.uniform3fv(u.uShadow, p.shadow)
    gl.uniform3fv(u.uHigh, p.high)
    gl.uniform2fv(u.uShake, p.shake || [0, 0])
    gl.uniform4fv(u.uShock, p.shock || [0.5, 0.5, 0, 0])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    return canvas
  }

  return { apply, canvas }
}
