/* The globe, drawn close to real life in the style of the v3 viewer:
   - land coloured by HadCM3's present-day surface types (assets/globe_base.json), with relief and hill shading
     from SRTM15+ heights at 10 arc-minutes (assets/relief_10m.png)
   - the coastline is where the height equals the sea level, so it moves with the scenario's global sea level
   - oceans shaded by depth, a sun, day and night, stars and a thin atmosphere
   - layers: temperature change from today (HadCM3 emulator, member 67), 3D plants and 3D rain or snow
     (both present-day HadCM3), sea level (flooded land, dry sea floor and today's coastline marked)
   Three.js only; the same sphere-plus-shader method as v3 and popsci. */
import * as THREE from 'three';
import { tx, U } from './i18n.js';

const D2R = Math.PI / 180;
export const BRISTOL = { lat: 51.45, lon: -2.6 };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const wrap360 = x => ((x % 360) + 360) % 360;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function xyz(lat, lon, r = 1, out = new THREE.Vector3()) {
  const p = lat * D2R, l = lon * D2R, c = Math.cos(p);
  return out.set(r * c * Math.cos(l), r * Math.sin(p), -r * c * Math.sin(l));
}
const RELIEF = 0.03;                     // globe radii per 6000 m (exaggerated, as in v3)
const relR = e => 1 + RELIEF * Math.max(e, 0) / 6000;
function L2(en, zh) { return { en, zh }; }

/* MOSES surface types: natural colours for the globe */
export const SURFACE = [
  ['#2E5E25', L2('Broadleaf trees', '阔叶林')], ['#234A2E', L2('Needleleaf trees', '针叶林')], ['#7E9C4C', L2('Grass', '草地')],
  ['#B7A35A', L2('Tropical grass', '热带草原')], ['#7A7A48', L2('Shrubs', '灌木')], ['#8D8981', L2('Towns', '城镇')],
  ['#2E5E85', L2('Lakes', '湖泊')], ['#C6A979', L2('Bare ground', '裸地')], ['#EEF3F8', L2('Land ice', '陆冰')],
];
const TAS_RAMP = [[-10, '#1E3A8A'], [-5, '#3B6FD0'], [-2, '#8DB8F0'], [0, '#F4F1E8'], [2, '#FDD58A'], [5, '#F48B3A'], [9, '#D7301F'], [14, '#7F0000']];
const TLO = TAS_RAMP[0][0], THI = TAS_RAMP[TAS_RAMP.length - 1][0];
export function tasColor(v) {
  const r = TAS_RAMP; if (!(v > r[0][0])) return hex(r[0][1]);
  for (let k = 0; k < r.length - 1; k++) if (v <= r[k + 1][0]) { const f = (v - r[k][0]) / (r[k + 1][0] - r[k][0]), a = hex(r[k][1]), b = hex(r[k + 1][1]); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)]; }
  return hex(r[r.length - 1][1]);
}
export const TAS_GRADIENT = TAS_RAMP.map(([v, c]) => [(v - TLO) / (THI - TLO), c]);

/* ---------------------------------------------------------------- shaders */
const COMMON = `
uniform sampler2D uElev; uniform float uSea; uniform float uRelief;
vec2 lonlat(vec3 p) { vec3 n = normalize(p); return vec2(degrees(atan(-n.z, n.x + 1e-7)), degrees(asin(clamp(n.y, -1.0, 1.0)))); }
vec2 uvOf(vec2 ll) { return vec2(fract((ll.x + 180.0) / 360.0), clamp((90.0 - ll.y) / 180.0, 0.0005, 0.9995)); }
float elev(vec2 uv) { return texture2D(uElev, uv).r; }
`;
const GLOBE_V = `${COMMON}
uniform vec3 uSun;
varying vec3 vN; varying vec3 vVd; varying vec3 vNv; varying vec3 vSv;
void main() {
  vec3 n = normalize(position);
  float e = elev(uvOf(lonlat(n)));
  vN = n; vNv = normalize((modelViewMatrix * vec4(n, 0.0)).xyz); vSv = normalize((modelViewMatrix * vec4(uSun, 0.0)).xyz);
  vec4 mv = modelViewMatrix * vec4(n * (1.0 + uRelief * max(e - max(uSea, 0.0), 0.0) / 6000.0 * step(uSea, e)), 1.0);
  vVd = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`;
const GLOBE_F = `${COMMON}
uniform sampler2D uLandCol; uniform sampler2D uTas; uniform float uTasOn; uniform vec3 uSun; uniform float uNight;
uniform float uSeaMode; uniform float uShowToday;
varying vec3 vN; varying vec3 vVd; varying vec3 vNv; varying vec3 vSv;
void main() {
  vec3 n0 = normalize(vN); vec2 ll = lonlat(n0); vec2 uv = uvOf(ll);
  float e = elev(uv), h = e - uSea;
  float w = max(fwidth(h) * 0.8, 1.0);
  float land = smoothstep(-w, w, h);
  vec4 lc = texture2D(uLandCol, uv);
  vec3 landC = lc.rgb;
  landC = mix(landC, vec3(0.50, 0.46, 0.40), smoothstep(1800.0, 4200.0, e) * 0.55);          /* bare high ground */
  landC = mix(landC, vec3(0.94, 0.95, 0.97), max(lc.a, smoothstep(4600.0, 5600.0, e) * 0.85)); /* ice and high snow */
  float dry = (1.0 - step(0.0, e)) * land;                                                  /* sea floor above the sea */
  landC = mix(landC, vec3(0.70, 0.64, 0.46), dry * (0.45 + 0.35 * uSeaMode));
  vec3 n = n0;
  if (h > 0.0) {                                                                            /* hill shading */
    float du = 1.0 / 2160.0, dv = 1.0 / 1080.0;
    float hx = elev(uv + vec2(du, 0.0)) - elev(uv - vec2(du, 0.0)), hy = elev(uv - vec2(0.0, dv)) - elev(uv + vec2(0.0, dv));
    float cl = max(cos(radians(ll.y)), 0.15), s = uRelief * 1.6 / 6000.0 / (2.0 * radians(1.0 / 6.0));
    float la = radians(ll.x), ph = radians(ll.y);
    vec3 east = vec3(-sin(la), 0.0, -cos(la)), north = vec3(-sin(ph) * cos(la), cos(ph), sin(ph) * sin(la));
    n = normalize(n0 - s * (hx / cl * east + hy * north));
  }
  float d = -h;                                                                             /* ocean by depth */
  vec3 seaC = mix(vec3(0.10, 0.36, 0.52), vec3(0.02, 0.10, 0.25), smoothstep(30.0, 3000.0, d));
  seaC = mix(seaC, vec3(0.16, 0.55, 0.65), (1.0 - smoothstep(0.0, 160.0, d)) * 0.45);
  float flooded = step(0.0, e) * (1.0 - land);
  seaC = mix(seaC, vec3(0.20, 0.78, 0.86), flooded * uSeaMode * 0.85);
  vec3 col = mix(seaC, landC, land);
  if (uTasOn > 0.001) col = mix(col, texture2D(uTas, uv).rgb, uTasOn * 0.82);
  float we = max(fwidth(e) * 1.1, 1.0);                                                     /* today's coastline */
  col = mix(col, vec3(1.0, 0.92, 0.45), uShowToday * (1.0 - smoothstep(0.0, we, abs(e))) * 0.9);
  float d0 = dot(n0, uSun), day = smoothstep(-0.12, 0.12, d0);
  col *= mix(uNight, 1.0, day) * (0.82 + 0.3 * clamp(dot(n, uSun), 0.0, 1.0));
  vec3 v = normalize(vVd);
  vec3 nv = normalize(vNv), sv = normalize(vSv);
  col += vec3(1.0, 0.95, 0.85) * pow(max(dot(reflect(-sv, nv), v), 0.0), 40.0) * (1.0 - land) * day * 0.35;
  col += vec3(0.85, 0.45, 0.2) * (1.0 - smoothstep(0.0, 0.06, abs(d0))) * 0.12;
  col += vec3(0.35, 0.6, 1.0) * pow(1.0 - clamp(dot(nv, v), 0.0, 1.0), 3.0) * 0.35 * mix(0.25, 1.0, day);
  gl_FragColor = vec4(col, 1.0);
}`;

/* ---------------------------------------------------------------- helpers */
function b64u8(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
export function sampler(g) {             // bilinear on a model grid (cell centres), skipping NaN corners
  return (arr, lat, lon) => {
    let x = (wrap360(lon) - g.lon0) / g.dlon; x = ((x % g.nx) + g.nx) % g.nx;
    const y = clamp((lat - g.lat0) / g.dlat, 0, g.ny - 1.0001);
    const i0 = x | 0, i1 = (i0 + 1) % g.nx, fx = x - i0, j0 = y | 0, j1 = Math.min(j0 + 1, g.ny - 1), fy = y - j0;
    let s = 0, w = 0, v, q;
    v = arr[j0 * g.nx + i0]; q = (1 - fx) * (1 - fy); if (v === v) { s += v * q; w += q; }
    v = arr[j0 * g.nx + i1]; q = fx * (1 - fy); if (v === v) { s += v * q; w += q; }
    v = arr[j1 * g.nx + i0]; q = (1 - fx) * fy; if (v === v) { s += v * q; w += q; }
    v = arr[j1 * g.nx + i1]; q = fx * fy; if (v === v) { s += v * q; w += q; }
    return w > 0 ? s / w : NaN;
  };
}
function dataTex(data, w, h, o = {}) {
  const t = new THREE.DataTexture(data, w, h, o.format || THREE.RGBAFormat, o.type || THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
function mergeGeo(list, withColor) {
  const out = new THREE.BufferGeometry();
  for (const nm of ['position', 'normal'].concat(withColor ? ['color'] : [])) {
    const n = list.reduce((s, g) => s + g.attributes[nm].array.length, 0), arr = new Float32Array(n); let o = 0;
    list.forEach(g => { arr.set(g.attributes[nm].array, o); o += g.attributes[nm].array.length; });
    out.setAttribute(nm, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}
export function labelSprite(text, px = 44, color = '#1B2A4A') {
  const c = document.createElement('canvas'), g = c.getContext('2d'), font = `900 ${px}px Nunito, "Noto Sans SC", system-ui, sans-serif`;
  g.font = font; const w = Math.ceil(g.measureText(text).width) + px, h = Math.ceil(px * 1.7);
  c.width = w; c.height = h; g.font = font; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillStyle = '#FFFDF5'; g.strokeStyle = color; g.lineWidth = px * 0.14;
  const r = h / 2 - 4; g.beginPath(); g.roundRect(3, 3, w - 6, h - 6, r); g.fill(); g.stroke();
  g.fillStyle = color; g.fillText(text, w / 2, h / 2 + 1);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.userData.aspect = w / h; s.renderOrder = 20;
  return s;
}
/* heights from the relief PNG: metres = (R * 256 + G) / 65535 * 17500 - 11000 */
export function loadRelief(url) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, img.width, img.height).data, n = img.width * img.height, z = new Float32Array(n);
      for (let i = 0; i < n; i++) z[i] = (px[i * 4] * 256 + px[i * 4 + 1]) / 65535 * 17500 - 11000;
      res({ w: img.width, h: img.height, z });
    };
    img.onerror = () => rej(new Error('relief image could not load'));
    img.src = url;
  });
}

export class Globe {
  constructor(base, relief, data) {
    this.data = data; this.relief = relief;
    this.root = new THREE.Group();            // placed and scaled by main.js (desktop or VR)
    this.earth = new THREE.Group(); this.earth.rotation.order = 'XYZ'; this.root.add(this.earth);
    this.view = { lat: 34, lon: BRISTOL.lon, dLat: 0, dLon: 0, tLat: 34, tLon: BRISTOL.lon };
    this.t = 0; this.sea = 0; this.layer = 'surface'; this.legendInfo = null; this.tasTarget = 0;
    this._base(base);
    this._build();
    this._plants();
    this._rain();
  }

  /* ---------------- heights and present-day model fields */
  elevAt(lat, lon) {
    const R = this.relief, x = (((lon + 180) / 360 * R.w - 0.5) % R.w + R.w) % R.w, y = clamp((90 - lat) / 180 * R.h - 0.5, 0, R.h - 1.001);
    const i0 = x | 0, i1 = (i0 + 1) % R.w, j0 = y | 0, j1 = j0 + 1, fx = x - i0, fy = y - j0, z = R.z;
    return (z[j0 * R.w + i0] * (1 - fx) + z[j0 * R.w + i1] * fx) * (1 - fy) + (z[j1 * R.w + i0] * (1 - fx) + z[j1 * R.w + i1] * fx) * fy;
  }
  _base(base) {
    const g = base.gridA, n = g.nx * g.ny;
    this.gA = g; this.sA = sampler(g);
    this.frac = base.frac.map(s => { const u = b64u8(s), f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = u[i] / 255; return f; });
    const p = b64u8(base.precip), t = b64u8(base.tstar);
    this.precip = new Float32Array(n); this.tstar = new Float32Array(n);
    for (let i = 0; i < n; i++) { const q = p[i] / 255; this.precip[i] = q * q * 60; this.tstar[i] = 205 + t[i] / 255 * 125; }
    /* land colour, 720 x 360, laid out like the relief; colours spread out to sea so new land has one */
    const W = 720, H = 360, rgb = new Float32Array(W * H * 3), ice = new Float32Array(W * H), has = new Uint8Array(W * H), cols = SURFACE.map(s => hex(s[0]));
    for (let j = 0; j < H; j++) {
      const lat = 90 - (j + 0.5) * 180 / H;
      for (let i = 0; i < W; i++) {
        const lon = -180 + (i + 0.5) * 360 / W, o = j * W + i;
        let r = 0, gg = 0, b = 0, ws = 0;
        for (let k = 0; k < 8; k++) { const f = this.sA(this.frac[k], lat, lon); if (f > 0.01) { r += f * cols[k][0]; gg += f * cols[k][1]; b += f * cols[k][2]; ws += f; } }
        const fi = this.sA(this.frac[8], lat, lon) || 0;
        if (ws + fi > 0.05) { has[o] = 1; ice[o] = fi / (ws + fi); if (ws > 0) { rgb[o * 3] = r / ws; rgb[o * 3 + 1] = gg / ws; rgb[o * 3 + 2] = b / ws; } else rgb.set(cols[7], o * 3); }
      }
    }
    for (let pass = 0; pass < 40; pass++) {
      const add = [];
      for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const o = j * W + i; if (has[o]) continue;
        let r = 0, gg = 0, b = 0, c = 0, ic = 0;
        for (const [dj, di] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const jj = j + dj; if (jj < 0 || jj >= H) continue; const q = jj * W + (i + di + W) % W; if (has[q]) { r += rgb[q * 3]; gg += rgb[q * 3 + 1]; b += rgb[q * 3 + 2]; ic += ice[q]; c++; } }
        if (c) add.push([o, r / c, gg / c, b / c, ic / c]);
      }
      for (const [o, r, gg, b, ic] of add) { rgb[o * 3] = r; rgb[o * 3 + 1] = gg; rgb[o * 3 + 2] = b; ice[o] = ic; has[o] = 1; }
      if (!add.length) break;
    }
    const d = new Uint8Array(W * H * 4);
    for (let o = 0; o < W * H; o++) { d[o * 4] = has[o] ? rgb[o * 3] : 120; d[o * 4 + 1] = has[o] ? rgb[o * 3 + 1] : 120; d[o * 4 + 2] = has[o] ? rgb[o * 3 + 2] : 90; d[o * 4 + 3] = clamp(ice[o] * 1.3 - 0.15, 0, 1) * 255; }
    this.landTex = dataTex(d, W, H);
    const R = this.relief, hf = new Uint16Array(R.w * R.h);
    for (let i = 0; i < hf.length; i++) hf[i] = THREE.DataUtils.toHalfFloat(R.z[i]);
    this.elevTex = dataTex(hf, R.w, R.h, { format: THREE.RedFormat, type: THREE.HalfFloatType });
    this.tasData = new Uint8Array(360 * 180 * 4); this.tasTex = dataTex(this.tasData, 360, 180);
  }

  /* ---------------- scene objects */
  _build() {
    this.U = {
      uElev: { value: this.elevTex }, uSea: { value: 0 }, uRelief: { value: RELIEF }, uLandCol: { value: this.landTex },
      uTas: { value: this.tasTex }, uTasOn: { value: 0 }, uSun: { value: new THREE.Vector3(-0.5, 0.4, 0.75).normalize() },
      uNight: { value: 0.32 }, uSeaMode: { value: 0 }, uShowToday: { value: 0 },
    };
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 288, 144), new THREE.ShaderMaterial({ vertexShader: GLOBE_V, fragmentShader: GLOBE_F, uniforms: this.U }));
    this.earth.add(this.sphere);
    this.halo = new THREE.Mesh(new THREE.SphereGeometry(1.035, 96, 48), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      uniforms: { uSunW: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; varying vec3 vW; void main() { vN = normalize(normalMatrix * normal); vW = normalize((modelMatrix * vec4(normal, 0.0)).xyz); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uSunW; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main() { float f = pow(1.0 - abs(dot(vN, vV)), 2.4); float day = smoothstep(-0.35, 0.3, dot(vW, uSunW)); gl_FragColor = vec4(vec3(0.30, 0.58, 1.0), f * (0.12 + 0.5 * day)); }',
    }));
    this.halo.renderOrder = -1; this.root.add(this.halo);
    const sc = document.createElement('canvas'); sc.width = sc.height = 256;
    const g = sc.getContext('2d'), gr = g.createRadialGradient(128, 128, 6, 128, 128, 128);
    gr.addColorStop(0, 'rgba(255,252,235,1)'); gr.addColorStop(0.12, 'rgba(255,236,170,1)'); gr.addColorStop(0.3, 'rgba(255,196,90,0.45)'); gr.addColorStop(1, 'rgba(255,160,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const st = new THREE.CanvasTexture(sc); st.colorSpace = THREE.SRGBColorSpace;
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: st, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sun.scale.setScalar(0.9); this.root.add(this.sun);
    this._pin();
  }
  _pin() {
    const up = xyz(BRISTOL.lat, BRISTOL.lon, 1).normalize();
    const pin = new THREE.Group(); pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    pin.position.copy(up).multiplyScalar(relR(this.elevAt(BRISTOL.lat, BRISTOL.lon)));
    const red = new THREE.MeshBasicMaterial({ color: 0xFF4F5E }), ink = new THREE.MeshBasicMaterial({ color: 0x1B2A4A });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.11, 8), ink); stick.position.y = 0.055; pin.add(stick);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), red); head.position.y = 0.125; pin.add(head);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(-0.012, 0.138, 0.02); pin.add(shine);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.003; pin.add(this.ring);
    this.pinHit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ visible: false })); this.pinHit.position.y = 0.11; pin.add(this.pinHit);
    this.pinLabel = labelSprite(tx(U.bristol)); this.pinLabel.position.y = 0.22; pin.add(this.pinLabel);
    this.pinHead = head; this.pin = pin; this.earth.add(pin);
  }
  relabel() {
    const old = this.pinLabel, s = labelSprite(tx(U.bristol));
    s.position.copy(old.position); this.pin.remove(old); old.material.map.dispose(); old.material.dispose();
    this.pin.add(s); this.pinLabel = s; this.setLabelSize(this._lblH || 0.08);
    this._legend();
  }
  setLabelSize(h) { this._lblH = h; this.pinLabel.scale.set(h * this.pinLabel.userData.aspect, h, 1); }

  /* ---------------- 3D plants: one small model per model land box, by its main surface type (as v3) */
  _plants() {
    const T = THREE, part = (g, hx, f) => { g = g.index ? g.toNonIndexed() : g; if (f) f(g); g.deleteAttribute('uv'); g.computeVertexNormals(); const c = new T.Color(hx), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(a, 3)); return g; };
    const trunk = '#6E4A2E', tufts = hx => [0, 1, 2, 3, 4].map(q => part(new T.ConeGeometry(0.07, 0.6, 3, 1, true), hx, g => g.translate(0, 0.3, 0).rotateZ((q - 2) * 0.22).translate((q - 2) * 0.1, 0, (q % 2) * 0.1)));
    const models = [
      [part(new T.CylinderGeometry(0.06, 0.08, 0.45, 5, 1, true), trunk, g => g.translate(0, 0.22, 0)), part(new T.IcosahedronGeometry(0.32, 0), '#2F6A27', g => g.translate(0, 0.66, 0)), part(new T.IcosahedronGeometry(0.2, 0), '#3B7A2F', g => g.translate(0.2, 0.5, 0.05))],
      [part(new T.CylinderGeometry(0.05, 0.06, 0.25, 5, 1, true), trunk, g => g.translate(0, 0.12, 0)), part(new T.ConeGeometry(0.3, 0.5, 6, 1, true), '#1F4A30', g => g.translate(0, 0.45, 0)), part(new T.ConeGeometry(0.2, 0.4, 6, 1, true), '#26573A', g => g.translate(0, 0.75, 0))],
      tufts('#7FA34B'), tufts('#C2AE5C'),
      [part(new T.IcosahedronGeometry(0.3, 0), '#6E7A3E', g => g.scale(1, 0.7, 1).translate(0, 0.25, 0)), part(new T.IcosahedronGeometry(0.22, 0), '#7E8A46', g => g.scale(1, 0.7, 1).translate(0.25, 0.2, 0.1))],
      [part(new T.BoxGeometry(0.28, 0.7, 0.28), '#A7A099', g => g.translate(-0.1, 0.35, 0)), part(new T.BoxGeometry(0.24, 0.95, 0.24), '#8F8882', g => g.translate(0.18, 0.47, 0.1))],
      [part(new T.CylinderGeometry(0.4, 0.4, 0.04, 10), '#3A78A8', g => g.translate(0, 0.02, 0))],
      [part(new T.SphereGeometry(0.42, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), '#D2B27A', g => g.scale(1.1, 0.4, 0.75)), part(new T.CylinderGeometry(0.05, 0.05, 0.5, 5), '#4E8A4C', g => g.translate(0.2, 0.25, -0.15))],
      [part(new T.ConeGeometry(0.34, 0.9, 5), '#EEF4FA', g => g.translate(0, 0.45, 0)), part(new T.ConeGeometry(0.22, 0.55, 5), '#D3E3F0', g => g.translate(0.28, 0.27, 0.1))],
    ].map(l => mergeGeo(l, true));
    const Hs = [0.045, 0.048, 0.022, 0.024, 0.024, 0.026, 0.03, 0.035, 0.034];
    const list = [], g = this.gA, hash = (a, b) => { const x = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return x - Math.floor(x); };
    for (let a = 0; a < g.nx * g.ny; a++) {
      const j = (a / g.nx) | 0, lat = g.lat0 + j * g.dlat, lon = g.lon0 + (a % g.nx) * g.dlon;
      if (hash(a, 7) > Math.cos(lat * D2R) * 1.25) continue;               // even density per area
      let best = -1, bv = 0.2; for (let p = 0; p < 9; p++) if (this.frac[p][a] > bv) { bv = this.frac[p][a]; best = p; }
      if (best < 0) continue;
      const la = lat + (hash(a, 1) - 0.5) * 1.6, lo = lon + (hash(a, 2) - 0.5) * 2.4, e = this.elevAt(la, lo);
      if (e <= 0 && best !== 8) continue;
      list.push({ p: best, lat: la, lon: lo, e, yaw: hash(a, 3) * 6.28, s: Hs[best] * (0.8 + 0.4 * hash(a, 4)) });
    }
    this.plantList = list;
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.plantMeshes = models.map((geo, p) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.filter(x => x.p === p).length)); m.frustumCulled = false; m.visible = false; this.earth.add(m); return m; });
    this._plantSea = null;
  }
  _placePlants() {
    if (this._plantSea === this.sea) return; this._plantSea = this.sea;
    const k = new Array(9).fill(0), M = new THREE.Matrix4(), P = new THREE.Vector3(), Q = new THREE.Quaternion(), Q2 = new THREE.Quaternion(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), N = new THREE.Vector3();
    for (const t of this.plantList) {
      const m = this.plantMeshes[t.p], i = k[t.p]++;
      if (t.e < this.sea) { M.makeScale(0, 0, 0); m.setMatrixAt(i, M); continue; }       // under the sea
      xyz(t.lat, t.lon, relR(t.e - Math.max(this.sea, 0)) - 0.0005, P);
      Q.setFromUnitVectors(Y, N.copy(P).normalize()).multiply(Q2.setFromAxisAngle(Y, t.yaw));
      M.compose(P, Q, S.setScalar(t.s)); m.setMatrixAt(i, M);
    }
    this.plantMeshes.forEach(m => { m.instanceMatrix.needsUpdate = true; });
  }

  /* ---------------- 3D rain and snow from the model's present-day precipitation (as v3) */
  _rain() {
    const N = 2200, pr = this.precip, g = this.gA, cdf = [], cells = [];
    let tot = 0;
    for (let a = 0; a < pr.length; a++) if (pr[a] > 0.4) { tot += pr[a] * Math.cos((g.lat0 + ((a / g.nx) | 0) * g.dlat) * D2R); cdf.push(tot); cells.push(a); }
    this.drops = [];
    for (let q = 0; q < N && cells.length; q++) {
      const x = Math.random() * tot; let lo = 0, hi = cdf.length - 1;
      while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m + 1; else hi = m; }
      const a = cells[lo], lat = g.lat0 + ((a / g.nx) | 0) * g.dlat + (Math.random() - 0.5) * 2.4, lon = g.lon0 + (a % g.nx) * g.dlon + (Math.random() - 0.5) * 3.6;
      this.drops.push({ lat, lon, e: this.elevAt(lat, lon), top: 0.03 + Math.random() * 0.05, h: Math.random(), snow: this.tstar[a] < 271.5, ax: new THREE.Vector3().randomDirection(), spin: Math.random() * 6.3 });
    }
    const cone = new THREE.ConeGeometry(0.5, 1, 6); cone.translate(0, 0.5, 0);
    this.rainI = new THREE.InstancedMesh(mergeGeo([cone.toNonIndexed(), new THREE.SphereGeometry(0.5, 6, 4).toNonIndexed()]),
      new THREE.MeshLambertMaterial({ color: 0xA8E2FF, emissive: 0x3A86B8, transparent: true, opacity: 0.95 }), N);
    this.snowI = new THREE.InstancedMesh(mergeGeo([0, 1, 2].map(d => new THREE.BoxGeometry(1, 0.1, 0.1).rotateY(d * Math.PI / 3).toNonIndexed())),
      new THREE.MeshLambertMaterial({ color: 0xFFFFFF, emissive: 0x8090A0 }), N);
    for (const o of [this.rainI, this.snowI]) { o.count = 0; o.visible = false; o.frustumCulled = false; o.renderOrder = 4; this.earth.add(o); }
  }
  _updateRain(dt) {
    let nr = 0, ns = 0; const { m: M, p: P, q: Q, q2: Q2, s: S, n: Nn } = RT;
    for (const d of this.drops) {
      d.h -= dt * (d.snow ? 0.25 : 0.75); if (d.h < 0) d.h += 1;
      if (d.e < this.sea) continue;
      xyz(d.lat, d.lon, relR(d.e - Math.max(this.sea, 0)) + d.top * d.h, P);
      Q.setFromUnitVectors(RT.y, Nn.copy(P).normalize());
      if (d.snow) { d.spin += dt * 2; Q.multiply(Q2.setFromAxisAngle(d.ax, d.spin)); M.compose(P, Q, S.setScalar(0.02)); this.snowI.setMatrixAt(ns++, M); }
      else { M.compose(P, Q, S.set(0.008, 0.02, 0.008)); this.rainI.setMatrixAt(nr++, M); }
    }
    this.rainI.count = nr; this.snowI.count = ns; this.rainI.instanceMatrix.needsUpdate = this.snowI.instanceMatrix.needsUpdate = true;
  }

  /* ---------------- state from the app */
  setLayer(name) { this.layer = name; this._apply(); }
  setTime(t, pathway, seaOverride) {
    const sea = seaOverride != null ? seaOverride : (this.data.value(t, pathway, 'sea_level_m') ?? 0);
    this.sea = sea; this.U.uSea.value = sea;
    this.tKey = t + '|' + pathway; this.tT = t; this.tP = pathway;
    if (this.layer === 'temp') this._paintTas();
    if (this.layer === 'plants') this._placePlants();
    this._legend();
  }
  _apply() {
    const L = this.layer;
    this.U.uSeaMode.value = L === 'sea' ? 1 : 0;
    this.U.uShowToday.value = L === 'sea' ? 1 : 0;
    this.tasTarget = L === 'temp' ? 1 : 0;
    if (L === 'temp') this._paintTas();
    this.plantMeshes.forEach(m => { m.visible = L === 'plants'; });
    if (L === 'plants') this._placePlants();
    this.rainI.visible = this.snowI.visible = L === 'rain';
    this._legend();
  }
  _paintTas() {
    if (this._tasKey === this.tKey) return; this._tasKey = this.tKey;
    const f = this.data.tasField(this.tT, this.tP), d = this.tasData;
    this.tasMissing = !f;
    if (f) {
      const s = sampler(this.data.tasGrid);
      for (let j = 0; j < 180; j++) { const lat = 89.5 - j; for (let i = 0; i < 360; i++) { const c = tasColor(s(f, lat, -179.5 + i)), o = (j * 360 + i) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; } }
    } else d.fill(128);
    this.tasTex.needsUpdate = true;
  }
  _legend() {
    const L = this.layer, info = { name: L, title: tx(U['g_' + L]), unit: tx(U['gu_' + L]) };
    if (L === 'temp') { info.gradient = TAS_GRADIENT; info.ticks = [-10, -5, 0, 5, 10].map(v => [(v - TLO) / (THI - TLO), (v > 0 ? '+' : '') + v]); info.sym = '°C'; info.missing = this.tasMissing; }
    if (L === 'surface' || L === 'plants') info.cats = SURFACE.filter((_, k) => k !== 6).map(([c, n]) => [c, tx(n)]);
    if (L === 'rain') info.cats = [['#9AD8F7', tx(U.g_rainDrop)], ['#FFFFFF', tx(U.g_snowFlake)]];
    if (L === 'sea') info.cats = [['#33C7DB', tx(U.g_flooded)], ['#B3A375', tx(U.g_dry)], ['#FFEB73', tx(U.g_todayCoast)]];
    info.sea = this.sea;
    info.fixed = L === 'rain' || L === 'plants' || L === 'surface';
    this.legendInfo = info;
    if (this.onLegend) this.onLegend(info);
  }

  /* ---------------- picking */
  latLonAt(ray) {
    this.earth.updateWorldMatrix(true, false);
    const inv = G.m.copy(this.earth.matrixWorld).invert();
    const r = G.ray.copy(ray).applyMatrix4(inv), hit = G.v;
    if (!r.intersectSphere(G.unit, hit)) return null;
    hit.normalize();
    return { lat: Math.asin(clamp(hit.y, -1, 1)) / D2R, lon: wrap360(Math.atan2(-hit.z, hit.x) / D2R), dist: hit.applyMatrix4(this.earth.matrixWorld).distanceTo(ray.origin) };
  }
  hitPin(raycaster) { const h = raycaster.intersectObject(this.pinHit, false); return h.length ? h[0].distance : null; }

  /* ---------------- per frame */
  update(dt, camera) {
    this.t += dt;
    const v = this.view, k = 1 - Math.exp(-dt * 4);
    v.lat += (clamp(v.tLat + v.dLat, -85, 85) - v.lat) * k;
    const dl = ((wrap360(v.tLon + v.dLon) - v.lon + 540) % 360) - 180; v.lon = wrap360(v.lon + dl * k);
    this.earth.rotation.set(v.lat * D2R, (-90 - v.lon) * D2R, 0);
    this.U.uTasOn.value += (this.tasTarget - this.U.uTasOn.value) * (1 - Math.exp(-dt * 6));
    const p = (this.t % 1.6) / 1.6;
    this.ring.scale.setScalar(0.025 + 0.06 * p); this.ring.material.opacity = 0.9 * (1 - p);
    this.pinHead.scale.setScalar((1 + 0.12 * Math.sin(this.t * 4.5)) * (this.pinHover ? 1.4 : 1));
    if (this.rainI.visible) this._updateRain(dt);
    /* the sun sits up and to the left of the globe as you see it, and lights it from there */
    if (camera) {
      this.root.updateWorldMatrix(true, false);
      const c = this.root.getWorldPosition(G.c), cam = camera.getWorldPosition(G.cam);
      const toCam = G.a.copy(cam).sub(c).normalize(), up = G.b.set(0, 1, 0), right = G.d.crossVectors(up, toCam).normalize();
      const sunW = G.e.copy(toCam).multiplyScalar(0.55).addScaledVector(right, -0.7).addScaledVector(up, 0.45).normalize();
      this.halo.material.uniforms.uSunW.value.copy(sunW);
      this.sun.position.copy(sunW).multiplyScalar(2.1).applyQuaternion(this.root.getWorldQuaternion(G.q).invert());
      this.U.uSun.value.copy(sunW).applyQuaternion(this.earth.getWorldQuaternion(G.q2).invert());
    }
  }
  nudge(dLat, dLon) {
    const v = this.view;
    v.dLat = clamp(v.dLat + dLat, -119, 51); v.dLon += dLon;
    v.lat = clamp(v.lat + dLat, -85, 85); v.lon = wrap360(v.lon + dLon);
  }
  face(lat, lon) { this.view.tLat = lat; this.view.tLon = lon; this.view.dLat = 0; this.view.dLon = 0; }
}
const RT = { m: new THREE.Matrix4(), p: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), s: new THREE.Vector3(), n: new THREE.Vector3(), y: new THREE.Vector3(0, 1, 0) };
const G = { m: new THREE.Matrix4(), ray: new THREE.Ray(), v: new THREE.Vector3(), unit: new THREE.Sphere(new THREE.Vector3(), 1), q: new THREE.Quaternion(), q2: new THREE.Quaternion(),
  c: new THREE.Vector3(), cam: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), e: new THREE.Vector3() };
