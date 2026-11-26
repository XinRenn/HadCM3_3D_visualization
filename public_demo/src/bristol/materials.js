/* One cartoon material for the whole harbourside. Flat low-poly facets (normals from screen derivatives),
   three light bands, a sky/ground ambient, fog, and the weather:
   - snow: up-facing facets above the water turn white as uSnow goes from 0 to 1
   - wet: up-facing facets darken a little in rain
   - sway (trees, flags): the top of each instance bends with uSway, phase from its position
   - windows: a window grid on the walls of unit-box buildings, sized by the instance scale
   All materials share the uniforms in SU, so the scene sets the weather once. */
import * as THREE from 'three';

export const SU = {
  uLight: { value: new THREE.Vector3(0.45, 0.75, 0.5).normalize() },
  uAmbSky: { value: new THREE.Color(1, 1, 1) },
  uAmbGround: { value: new THREE.Color(0.78, 0.8, 0.86) },
  uFogCol: { value: new THREE.Color(0xCDEBFF) },
  uFogNear: { value: 90 }, uFogFar: { value: 460 },
  uSnow: { value: 0 }, uWet: { value: 0 }, uWater: { value: 0 },
  uOrigin: { value: new THREE.Vector3() },          // world position of the city's origin (it moves with the pontoon)
  uTime: { value: 0 }, uSway: { value: 1 },
  uStone: { value: new THREE.Color(0xC9C0B0) }, uGrass: { value: new THREE.Color(0x7CC46A) }, uMud: { value: new THREE.Color(0x8C7A5E) },
};

const VERT = `
uniform float uTime; uniform float uSway; uniform float uSwayAmt;
varying vec3 vW; varying vec3 vCol;
#ifdef SURF
attribute vec3 aSurf; varying vec3 vSurf;
#endif
#ifdef WINDOWS
varying vec3 vL; varying vec3 vN0; varying float vTop;
#endif
void main() {
  vec3 p = position;
  vCol = vec3(1.0);
#ifdef USE_COLOR
  vCol *= color;
#endif
#ifdef USE_INSTANCING_COLOR
  vCol *= instanceColor;
#endif
#ifdef SURF
  vSurf = aSurf;
#endif
#ifdef USE_INSTANCING
  mat4 im = instanceMatrix;
#else
  mat4 im = mat4(1.0);
#endif
#ifdef WINDOWS
  vec3 sc = vec3(length(im[0].xyz), length(im[1].xyz), length(im[2].xyz)) * vec3(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz), length(modelMatrix[2].xyz));
  vL = p * sc; vN0 = normal; vTop = sc.y;
#endif
  vec4 wp = im * vec4(p, 1.0);
#ifdef SWAY
  float ph = im[3].x * 0.37 + im[3].z * 0.23;
  float h = max(p.y, 0.0) * length(im[1].xyz);
  float s = uSway * uSwayAmt * h * h;
  wp.x += s * (0.7 * sin(uTime * 1.7 + ph) + 0.3 * sin(uTime * 3.3 + ph * 2.0) + 0.35 * uSway);
  wp.z += s * 0.45 * sin(uTime * 1.3 + ph * 1.7);
#endif
  wp = modelMatrix * wp;
  vW = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = `
uniform vec3 uColor; uniform vec3 uLight; uniform vec3 uAmbSky; uniform vec3 uAmbGround; uniform vec3 uFogCol;
uniform float uFogNear; uniform float uFogFar; uniform float uSnow; uniform float uWet; uniform float uWater; uniform vec3 uOrigin;
uniform float uSnowOK; uniform float uOpacity;
varying vec3 vW; varying vec3 vCol;
#ifdef SURF
uniform vec3 uStone; uniform vec3 uGrass; uniform vec3 uMud; varying vec3 vSurf;
#endif
#ifdef WINDOWS
varying vec3 vL; varying vec3 vN0; varying float vTop;
#endif
void main() {
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  if (dot(n, cameraPosition - vW) < 0.0) n = -n;
  vec3 base = uColor * vCol;
#ifdef SURF
  base = (vSurf.x * uStone + vSurf.y * uGrass + vSurf.z * uMud) * vCol;
#endif
#ifdef WINDOWS
  if (abs(vN0.y) < 0.5) {
    float u = abs(vN0.x) > 0.5 ? vL.z : vL.x;
    vec2 c = vec2(u + 0.6, vL.y) / vec2(2.7, 3.1), f = fract(c);
    float win = step(0.28, f.x) * step(f.x, 0.74) * step(0.32, f.y) * step(f.y, 0.82) * step(vL.y, vTop - 1.0) * step(0.9, vL.y);
    base = mix(base, vec3(0.23, 0.33, 0.48), win * 0.85);
  }
#endif
  float d = dot(n, uLight);
  float lit = d > 0.45 ? 1.0 : d > 0.05 ? 0.86 : 0.72;
  vec3 col = base * lit * mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5);
  float y = vW.y - uOrigin.y;
  float snowF = uSnow * uSnowOK * smoothstep(0.5, 0.78, n.y) * smoothstep(uWater + 0.02, uWater + 0.15, y);
  col = mix(col, vec3(0.97, 0.98, 1.0) * (0.86 + 0.14 * lit), snowF);
  col *= 1.0 - uWet * 0.22 * smoothstep(0.6, 0.9, n.y) * (1.0 - snowF);
  col = mix(col, uFogCol, smoothstep(uFogNear, uFogFar, distance(vW, cameraPosition)));
  gl_FragColor = vec4(col, uOpacity);
  #include <colorspace_fragment>
}`;

/* toon({ color, vertexColors, surf, windows, sway, snow, transparent, opacity, side }) */
export function toon(o = {}) {
  const defines = {};
  if (o.surf) defines.SURF = '';
  if (o.windows) defines.WINDOWS = '';
  if (o.sway) defines.SWAY = '';
  const m = new THREE.ShaderMaterial({
    defines, vertexShader: VERT, fragmentShader: FRAG,
    uniforms: Object.assign({}, SU, {
      uColor: { value: new THREE.Color(o.color ?? 0xffffff) }, uSnowOK: { value: o.snow === false ? 0 : 1 },
      uSwayAmt: { value: o.sway || 0 }, uOpacity: { value: o.opacity ?? 1 },
    }),
    transparent: !!o.transparent, side: o.side ?? THREE.FrontSide, vertexColors: !!o.vertexColors,
  });
  if (o.transparent) m.depthWrite = o.depthWrite ?? false;
  return m;
}

/* sky: a big dome with a vertical gradient and a cartoon sun */
export function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTop: { value: new THREE.Color(0x4FA3E8) }, uHor: { value: new THREE.Color(0xCDEBFF) }, uSun: { value: new THREE.Vector3(0.5, 0.6, 0.6).normalize() },
      uSunSize: { value: 1 }, uSunVis: { value: 1 }, uHaze: { value: 0 }, uTime: SU.uTime },
    vertexShader: 'varying vec3 vD; void main() { vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform float uSunSize; uniform float uSunVis; uniform float uHaze; varying vec3 vD;
void main() {
  vec3 d = normalize(vD);
  float h = clamp(d.y, -0.2, 1.0);
  vec3 col = mix(uHor, uTop, pow(smoothstep(-0.02, 0.75, h), 0.8));
  float a = acos(clamp(dot(d, normalize(uSun)), -1.0, 1.0));
  float r = 0.07 * uSunSize;
  col = mix(col, vec3(1.0, 0.96, 0.75), (1.0 - smoothstep(r * 2.4, r * 4.0, a)) * 0.35 * uSunVis);
  col = mix(col, vec3(1.0, 0.86, 0.35), (1.0 - smoothstep(r - 0.004, r + 0.004, a)) * uSunVis);
  col = mix(col, vec3(1.0, 0.95, 0.6), (1.0 - smoothstep(r * 0.55, r * 0.6, a)) * uSunVis);
  col = mix(col, uHor, uHaze * (1.0 - smoothstep(0.0, 0.35, h)) * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
  });
}

/* the harbour water: flat, slightly see-through, with cartoon ripple streaks that grow with the wind */
export function waterMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: Object.assign({}, SU, { uDeep: { value: new THREE.Color(0x2E8FC7) }, uShallow: { value: new THREE.Color(0x5CC4E6) }, uChop: { value: 0.4 }, uAlpha: { value: 0.8 } }),
    vertexShader: 'varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFogCol; uniform float uFogNear; uniform float uFogFar; uniform float uTime; uniform float uChop; uniform float uAlpha; varying vec3 vW;
void main() {
  vec2 p = vW.xz;
  float w1 = sin(p.x * 0.35 + uTime * 1.1 + sin(p.y * 0.21 + uTime * 0.6) * 2.0);
  float w2 = sin(p.y * 0.42 - uTime * 0.9 + sin(p.x * 0.17 - uTime * 0.4) * 2.4);
  float s = w1 * w2;
  vec3 col = mix(uDeep, uShallow, 0.5 + 0.25 * s);
  float g = sin(p.x * 1.9 + uTime * 2.3 + sin(p.y * 1.1 + uTime) * 1.5) * sin(p.y * 2.3 - uTime * 1.9 + sin(p.x * 0.7) * 1.2);
  float streak = smoothstep(0.985 - 0.09 * uChop, 0.995 - 0.05 * uChop, g) * smoothstep(-0.2, 0.6, s + uChop);
  col = mix(col, vec3(0.93, 0.98, 1.0), streak * (0.35 + 0.65 * uChop));
  col = mix(col, uFogCol, smoothstep(uFogNear, uFogFar, distance(vW, cameraPosition)));
  gl_FragColor = vec4(col, uAlpha);
  #include <colorspace_fragment>
}`,
  });
}
