/* The cartoon globe: the HadCM3 coastline (assets/globe_base.json) as rounded flat-colour land with a dark
   outline, toon lighting, one data layer painted in flat colour bands, and a pulsing pin on Bristol.
   Same approach as the popsci / v3 globe (unit sphere, shader turns the normal into lat/lon and samples
   painted textures), re-styled. */
import * as THREE from 'three';
import { tx, U, vegLabel } from './i18n.js';

const D2R = Math.PI / 180;
export const BRISTOL = { lat: 51.45, lon: -2.6 };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const wrap360 = x => ((x % 360) + 360) % 360;
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export function xyz(lat, lon, r = 1, out = new THREE.Vector3()) {
  const p = lat * D2R, l = lon * D2R, c = Math.cos(p);
  return out.set(r * c * Math.cos(l), r * Math.sin(p), -r * c * Math.sin(l));
}

/* ---------------------------------------------------------------- colour bands, one set per layer */
export const PALETTES = {
  temp_c: { edges: [-50, -20, -10, -5, 0, 5, 10, 15, 20, 25, 30, 45],
    colors: ['#2C3E9E', '#3F6FD8', '#6FA2F0', '#A6CCF8', '#D9ECFA', '#FFF3B0', '#FFD966', '#FFB347', '#FF8A3D', '#F25C3B', '#C9302C'],
    ticks: [-20, 0, 10, 20, 30], unit: '°C' },
  rain_mm_yr: { edges: [0, 250, 500, 750, 1000, 1500, 2000, 3000, 4000],
    colors: ['#F2DFA7', '#D9E8A8', '#A8DDB5', '#7CCBE6', '#4FA9E8', '#2F7FD8', '#2454B8', '#1C2F8A'],
    ticks: [0, 500, 1000, 2000, 4000], unit: 'mm' },
  snow_depth_cm: { edges: [0, 1, 10, 30, 100, 300],
    colors: [null, '#CFE5F5', '#E2EFF9', '#F1F7FC', '#FFFFFF'], ticks: [1, 10, 30, 100], unit: 'cm' },
  sea_level_m: { edges: [-150, -60, -20, -5, -1, 1, 5, 20, 40, 60],
    colors: ['#C9F2EE', '#A3E4EA', '#7DD3E8', '#5DBDE6', '#3FA7F5', '#2E7FE0', '#3A5FC8', '#4B3FAE', '#5A2A92'],
    ticks: [-60, -5, 5, 20, 40], unit: 'm' },
  vegetation: { cats: { tundra: '#BBC9A0', steppe: '#E8D27A', temperate_forest: '#3FAE55', mediterranean: '#A5B95A', subtropical: '#1E8F6E', desert_scrub: '#EDB574' },
    spare: ['#C27BD8', '#E07BA5', '#7BD8D0', '#8F8F8F'] },
};
export function bandColor(name, v) {
  const p = PALETTES[name];
  if (!p || v == null || v !== v) return null;
  const e = p.edges;
  let k = 0;
  while (k < e.length - 2 && v >= e[k + 1]) k++;
  return p.colors[k];
}
function catColor(cats, k) {
  const id = cats[k], p = PALETTES.vegetation;
  return p.cats[id] || p.spare[k % p.spare.length];
}

/* ---------------------------------------------------------------- shaders */
const GLOBE_V = `varying vec3 vN; varying vec3 vVN; varying vec3 vV;
void main() { vN = normalize(position); vVN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`;
const GLOBE_F = `uniform sampler2D uLand; uniform sampler2D uLayer; uniform sampler2D uPrev; uniform float uFade;
uniform float uOnLand; uniform float uOnSea; uniform float uPrevOnLand; uniform float uPrevOnSea; uniform vec3 uLight;
varying vec3 vN; varying vec3 vVN; varying vec3 vV;
const vec3 SEA = vec3(0.25, 0.65, 0.96), LAND = vec3(0.52, 0.80, 0.38), SHELF = vec3(0.86, 0.80, 0.55), ICE = vec3(0.95, 0.97, 1.0), INK = vec3(0.106, 0.165, 0.29);
vec3 paint(vec4 L, float onLand, float onSea, float m, vec3 land, vec3 sea) {
  return mix(mix(sea, L.rgb, L.a * onSea), mix(land, L.rgb, L.a * onLand), m);
}
void main() {
  vec3 n = normalize(vN);
  float lon = mod(degrees(atan(-n.z, n.x + 1e-7)) + 360.0, 360.0), lat = degrees(asin(clamp(n.y, -1.0, 1.0)));
  vec2 uv = vec2(lon / 360.0, (lat + 90.0) / 180.0);
  vec4 B = texture2D(uLand, uv);          // r: land now (with dry sea floor), g: land today, b: land ice
  float m = smoothstep(0.44, 0.56, B.r), shelf = clamp(B.r - B.g, 0.0, 1.0);
  vec3 land = mix(mix(LAND, ICE, smoothstep(0.35, 0.6, B.b)), SHELF, smoothstep(0.2, 0.6, shelf));
  vec3 a = paint(texture2D(uPrev, uv), uPrevOnLand, uPrevOnSea, m, land, SEA);
  vec3 b = paint(texture2D(uLayer, uv), uOnLand, uOnSea, m, land, SEA);
  vec3 col = mix(a, b, uFade);
  float w = fwidth(B.r);
  float coast = 1.0 - smoothstep(0.6 * w, 2.2 * w, abs(B.r - 0.5));
  col = mix(col, INK, coast * 0.9);
  float d = dot(n, uLight);
  col *= d > 0.3 ? 1.0 : d > -0.15 ? 0.88 : 0.74;            // three flat light bands
  float rim = pow(1.0 - clamp(dot(normalize(vVN), normalize(vV)), 0.0, 1.0), 2.5);
  col += vec3(0.55, 0.78, 1.0) * rim * 0.28;
  gl_FragColor = vec4(col, 1.0);
}`;

/* ---------------------------------------------------------------- textures painted on the CPU */
const LW = 720, LH = 360;          // land texture
const TW = 360, TH = 180;          // layer texture

function b64bytes(s) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
/* bilinear on a model grid (cell centres), skipping NaN corners */
function sampler(g) {
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
function blur(a, w, h, r) {
  const t = new Float32Array(a.length), n = 2 * r + 1;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let s = 0; for (let k = -r; k <= r; k++) s += a[j * w + ((i + k + w) % w)]; t[j * w + i] = s / n; }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { let s = 0; for (let k = -r; k <= r; k++) s += t[clamp(j + k, 0, h - 1) * w + i]; a[j * w + i] = s / n; }
  return a;
}
function dataTex(data, w, h, nearest) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = t.minFilter = nearest ? THREE.NearestFilter : THREE.LinearFilter;
  t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
export function labelSprite(text, px = 44, color = "#1B2A4A") {
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

export class Globe {
  constructor(base, data) {
    this.data = data;
    this.root = new THREE.Group();            // placed by main.js (desktop or XR)
    this.earth = new THREE.Group(); this.earth.rotation.order = 'XYZ'; this.root.add(this.earth);
    this.view = { lat: 34, lon: BRISTOL.lon, dLat: 0, dLon: 0, tLat: 34, tLon: BRISTOL.lon };
    this.landCache = new Map(); this.layerCache = new Map();
    this.cur = { key: null, onLand: 1, onSea: 1 };
    this.legendInfo = null;
    this.t = 0;
    this._initBase(base);
    this._build();
  }

  /* ---------------- base geography */
  _initBase(base) {
    const ko = base.kmt.grid, kmt = b64bytes(base.kmt.b64), go = ko;
    this.kmt = kmt; this.go = go; this.bottoms = base.level_bottom_m;
    const ga = base.ice.grid, ice = b64bytes(base.ice.b64), iceF = new Float32Array(ice.length);
    for (let i = 0; i < ice.length; i++) iceF[i] = ice[i] / 100;
    const sa = sampler(ga), sIce = new Float32Array(LW * LH);
    for (let j = 0; j < LH; j++) { const lat = -90 + (j + 0.5) * 180 / LH; for (let i = 0; i < LW; i++) sIce[j * LW + i] = sa(iceF, lat, (i + 0.5) * 360 / LW) || 0; }
    this.iceTex = sIce;
    let kmin = 99; for (const c of kmt) if (c > 0 && c < kmin) kmin = c;
    this.kmin = kmin;                      // HadCM3's shallowest sea columns (8 levels, about 165 m): its shelf seas
    this.landToday = this._landFrac(false);
  }
  /* Land fraction on the land texture. HadCM3 gives every shelf sea the same minimum depth, so the model grid
     cannot say which sea floor falls dry for a given drop. As a rough cartoon estimate, a sea level 100 m or
     more below today turns the model's shallowest columns (its shelf seas) into land. */
  _landFrac(shelf) {
    const g = this.go, ind = new Float32Array(this.kmt.length);
    for (let i = 0; i < ind.length; i++) { const c = this.kmt[i]; ind[i] = c === 0 || (shelf && c <= this.kmin) ? 1 : 0; }
    const s = sampler(g), out = new Float32Array(LW * LH);
    for (let j = 0; j < LH; j++) { const lat = -90 + (j + 0.5) * 180 / LH; for (let i = 0; i < LW; i++) out[j * LW + i] = s(ind, lat, (i + 0.5) * 360 / LW); }
    return blur(blur(out, LW, LH, 2), LW, LH, 2);       // two box blurs: rounded cartoon coastlines
  }
  landTex(seaLevel) {
    const k = seaLevel != null && seaLevel <= -100 ? 1 : 0;
    if (!this.landCache.has(k)) {
      const f = k ? this._landFrac(true) : this.landToday, d = new Uint8Array(LW * LH * 4);
      for (let i = 0; i < LW * LH; i++) { d[i * 4] = f[i] * 255; d[i * 4 + 1] = this.landToday[i] * 255; d[i * 4 + 2] = this.iceTex[i] * 255; d[i * 4 + 3] = 255; }
      this.landCache.set(k, dataTex(d, LW, LH));
    }
    return this.landCache.get(k);
  }

  /* ---------------- scene objects */
  _build() {
    const empty = dataTex(new Uint8Array(4), 1, 1);
    this.U = {
      uLand: { value: this.landTex(0) }, uLayer: { value: empty }, uPrev: { value: empty }, uFade: { value: 1 },
      uOnLand: { value: 1 }, uOnSea: { value: 1 }, uPrevOnLand: { value: 1 }, uPrevOnSea: { value: 1 },
      uLight: { value: new THREE.Vector3(-0.4, 0.5, 0.8).normalize() },
    };
    this.sphere = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.ShaderMaterial({ vertexShader: GLOBE_V, fragmentShader: GLOBE_F, uniforms: this.U }));
    this.earth.add(this.sphere);
    /* cartoon outline: a slightly larger back-facing shell */
    const outline = new THREE.Mesh(new THREE.SphereGeometry(1.028, 64, 48), new THREE.MeshBasicMaterial({ color: 0x1B2A4A, side: THREE.BackSide }));
    this.root.add(outline);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.16, 48, 32), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vV; void main() { float a = smoothstep(0.0, 0.7, -dot(normalize(vN), normalize(vV))); gl_FragColor = vec4(vec3(0.45, 0.75, 1.0), a * a * 0.55); }',
    }));
    this.root.add(halo);
    this._buildPin();
  }
  _buildPin() {
    const up = xyz(BRISTOL.lat, BRISTOL.lon, 1).normalize();
    const pin = new THREE.Group();
    pin.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    pin.position.copy(up);
    const red = new THREE.MeshBasicMaterial({ color: 0xFF4F5E }), ink = new THREE.MeshBasicMaterial({ color: 0x1B2A4A });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 8), ink); stick.position.y = 0.065; pin.add(stick);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 20, 14), red); head.position.y = 0.15; pin.add(head);
    const headOut = new THREE.Mesh(new THREE.SphereGeometry(0.054, 20, 14), new THREE.MeshBasicMaterial({ color: 0x1B2A4A, side: THREE.BackSide })); headOut.position.y = 0.15; pin.add(headOut);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff })); shine.position.set(-0.018, 0.17, 0.03); pin.add(shine);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 40), new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2; this.ring.position.y = 0.004; pin.add(this.ring);
    /* hit target: generous, 0.11 globe radii around the head (about 3 cm when the globe is 28 cm across in VR) */
    this.pinHit = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
    this.pinHit.position.y = 0.13; pin.add(this.pinHit);
    this.pinLabel = labelSprite(tx(U.bristol)); this.pinLabel.position.y = 0.28; pin.add(this.pinLabel);
    this.pinHead = head; this.pin = pin;
    this.earth.add(pin);
  }
  relabel() {
    const old = this.pinLabel, s = labelSprite(tx(U.bristol));
    s.position.copy(old.position); s.scale.copy(old.scale); this.pin.remove(old); old.material.map.dispose(); old.material.dispose();
    this.pin.add(s); this.pinLabel = s; this.setLabelSize(this._lblH || 0.09);
    if (this.legendInfo) this.legendInfo = this._legend(this.cur.name, this.cur.info);
  }
  setLabelSize(h) { this._lblH = h; this.pinLabel.scale.set(h * this.pinLabel.userData.aspect, h, 1); }

  /* ---------------- data layer */
  async show(name, stopId, pathwayId) {
    const key = name + '|' + stopId + '|' + pathwayId;
    this.want = key;
    const sea = this.data.value(stopId, pathwayId, 'sea_level_m');
    this.U.uLand.value = this.landTex(sea);
    const L = await this.data.layer(name, stopId, pathwayId);
    if (this.want !== key) return;
    let tex = null, info = this.data.layerInfo(name);
    if (L) {
      if (!this.layerCache.has(key)) this.layerCache.set(key, this._paint(name, L));
      tex = this.layerCache.get(key);
    } else tex = dataTex(new Uint8Array(4), 1, 1);            // no data: plain land and sea
    const where = info && info.where ? info.where : 'all';
    this.U.uPrev.value = this.U.uLayer.value; this.U.uPrevOnLand.value = this.U.uOnLand.value; this.U.uPrevOnSea.value = this.U.uOnSea.value;
    this.U.uLayer.value = tex; this.U.uOnLand.value = where === 'sea' ? 0 : 1; this.U.uOnSea.value = where === 'land' ? 0 : 1;
    this.U.uFade.value = 0;
    this.cur = { key, name, info, missing: !L };
    this.legendInfo = this._legend(name, info);
    this.legendInfo.missing = !L;
    this.legendInfo.shelf = sea != null && sea <= -100;
    if (this.onLegend) this.onLegend(this.legendInfo);
  }
  _paint(name, L) {
    const s = sampler(L.grid), d = new Uint8Array(TW * TH * 4);
    if (L.cats) {
      const cats = L.info.categories, nc = cats.length, col = cats.map((_, k) => hex(catColor(cats, k)));
      const one = Array.from({ length: nc }, (_, k) => { const a = new Float32Array(L.cats.length); for (let i = 0; i < a.length; i++) a[i] = L.cats[i] < 0 ? NaN : L.cats[i] === k ? 1 : 0; return a; });
      for (let j = 0; j < TH; j++) { const lat = -90 + (j + 0.5) * 180 / TH; for (let i = 0; i < TW; i++) {
        const lon = (i + 0.5) * 360 / TW, o = (j * TW + i) * 4; let best = -1, bw = 0;
        for (let k = 0; k < nc; k++) { const w = s(one[k], lat, lon); if (w > bw) { bw = w; best = k; } }
        if (best >= 0) { const c = col[best]; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255; }
      } }
    } else {
      const P = PALETTES[name], cache = {};
      for (let j = 0; j < TH; j++) { const lat = -90 + (j + 0.5) * 180 / TH; for (let i = 0; i < TW; i++) {
        const v = s(L.values, lat, (i + 0.5) * 360 / TW), o = (j * TW + i) * 4;
        const h = P ? bandColor(name, v) : null;
        if (!h) continue;
        const c = cache[h] || (cache[h] = hex(h)); d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = 255;
      } }
    }
    return dataTex(d, TW, TH, false);
  }
  _legend(name, info) {
    const P = PALETTES[name] || {};
    const out = { name, title: tx(U['l_' + name]), unit: tx(U['u_' + name]) };
    if (info && info.categories) out.cats = info.categories.map((id, k) => [catColor(info.categories, k), vegLabel(id)]);
    else if (P.edges) { out.bands = P.colors.map((c, k) => [c, P.edges[k], P.edges[k + 1]]); out.ticks = P.ticks; out.sym = P.unit; }
    return out;
  }

  /* ---------------- picking */
  /* lat/lon under a world-space ray, or null */
  latLonAt(ray) {
    this.earth.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(this.earth.matrixWorld).invert();
    const r = ray.clone().applyMatrix4(inv), hit = new THREE.Vector3();
    if (!r.intersectSphere(new THREE.Sphere(new THREE.Vector3(), 1), hit)) return null;
    hit.normalize();
    return { lat: Math.asin(clamp(hit.y, -1, 1)) / D2R, lon: wrap360(Math.atan2(-hit.z, hit.x) / D2R), dist: hit.applyMatrix4(this.earth.matrixWorld).distanceTo(ray.origin) };
  }
  hitPin(raycaster) { const h = raycaster.intersectObject(this.pinHit, false); return h.length ? h[0].distance : null; }

  /* ---------------- per frame */
  update(dt, camWorld) {
    this.t += dt;
    const v = this.view, k = 1 - Math.exp(-dt * 4);
    v.lat += (clamp(v.tLat + v.dLat, -80, 80) - v.lat) * k;
    const dl = ((wrap360(v.tLon + v.dLon) - v.lon + 540) % 360) - 180; v.lon = wrap360(v.lon + dl * k);
    this.earth.rotation.set(v.lat * D2R, (-90 - v.lon) * D2R, 0);
    if (this.U.uFade.value < 1) this.U.uFade.value = Math.min(1, this.U.uFade.value + dt / 0.35);
    const p = (this.t % 1.6) / 1.6;
    this.ring.scale.setScalar(0.03 + 0.07 * p); this.ring.material.opacity = 0.9 * (1 - p);
    this.pinHead.scale.setScalar(1 + 0.12 * Math.sin(this.t * 4.5));
    /* light from over the viewer's left shoulder, whatever way the globe is turned */
    if (camWorld) {
      this.earth.updateWorldMatrix(true, false);
      const q = new THREE.Quaternion(); this.earth.getWorldQuaternion(q); q.invert();
      const c = new THREE.Vector3(); this.root.getWorldPosition(c);
      const dir = camWorld.clone().sub(c).normalize().add(new THREE.Vector3(-0.5, 0.6, 0)).normalize().applyQuaternion(q);
      this.U.uLight.value.copy(dir);
    }
  }
  /* turn by a drag: moves both the shown and the target view so the grabbed point stays under the pointer */
  nudge(dLat, dLon) {
    const v = this.view;
    v.dLat = clamp(v.dLat + dLat, -114, 46); v.dLon += dLon;
    v.lat = clamp(v.lat + dLat, -80, 80); v.lon = wrap360(v.lon + dLon);
  }
  /* turn so that a lat/lon faces the viewer */
  face(lat, lon) { this.view.tLat = lat; this.view.tLon = lon; this.view.dLat = 0; this.view.dLon = 0; }
}
