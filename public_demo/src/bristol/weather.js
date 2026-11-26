/* Weather on the harbourside, driven by the Bristol numbers through BANDS (src/data.js):
   temperature -> the big thermometer, heat haze above 28 °C (sky colour and sun size are in scene.js)
   wind        -> tree and flag sway, bunting, water chop, boats rocking: still / breezy / stormy
   rain        -> falling streaks (GPU-animated lines), wet ground, puddles: light / steady / heavy
   snow        -> white on every up-facing surface above the water, falling flakes, a depth stick, snowmen
   Particle budget: rain at most 3,800 streaks + snow at most 1,000 flakes, under the 5,000 limit. */
import * as THREE from 'three';
import { SU, toon } from './materials.js';
import * as A from './assets.js';
import { BANDS } from '../data.js';
import { labelSprite } from '../globe.js';
import { fmtValue } from '../format.js';
import { U, tx } from '../i18n.js';
import { rng } from './scene.js';

const RAIN_MAX = 3800, SNOW_MAX = 1000;
const RAIN_N = { dry: 0, light: 900, steady: 2200, heavy: RAIN_MAX };
const SWAY = { still: 0.12, breezy: 1.0, stormy: 2.6 };
const CHOP = { still: 0.08, breezy: 0.45, stormy: 1.0 };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

const TMP = { cw: new THREE.Vector3(), M: new THREE.Matrix4(), Q: new THREE.Quaternion(), E: new THREE.Euler(), S: new THREE.Vector3(1, 1, 1), V: new THREE.Vector3() };   // reused every frame

export default class Weather {
  constructor(city) { this.city = city; this.wind = 'breezy'; this.t = 0; }

  init() {
    const c = this.city;
    this._thermometer(c);
    this._flags(c);
    this._rain(c);
    this._snow(c);
    this._puddles(c);
    this._snowStuff(c);
    this._haze(c);
  }

  /* ---------------------------------------------------------------- thermometer (on the pontoon, front right) */
  _thermometer(c) {
    const g = new THREE.Group(); g.position.set(2.15, 0, -1.35); c.pontoon.add(g);
    const ink = 0x1B2A4A;
    const out = (geo, s = 1.12) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide })); m.scale.setScalar(s); return m; };
    const base = new THREE.Mesh(A.merge([A.box(0.7, 0.12, 0.7, '#5E6670'), A.box(0.12, 0.5, 0.12, '#5E6670', 0, 0.12)]), toon({ vertexColors: true }));
    g.add(base);
    const TB = 0.62, TH = 2.0;                       // tube bottom and height (m)
    this.tY0 = TB + 0.05; this.tH = TH - 0.15;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, TH, 20), toon({ color: 0xFFFFFF, snow: false })); tube.position.y = TB + TH / 2; g.add(tube);
    const to = out(new THREE.CylinderGeometry(0.11, 0.11, TH, 20), 1); to.scale.set(1.25, 1.02, 1.25); to.position.copy(tube.position); g.add(to);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), toon({ color: 0xFF5A4E, snow: false })); bulb.position.y = TB; g.add(bulb);
    const bo = out(new THREE.SphereGeometry(0.22, 20, 14), 1.13); bo.position.y = TB; g.add(bo);
    const lg = new THREE.CylinderGeometry(0.065, 0.065, 1, 14); lg.translate(0, 0.5, 0);
    this.liquid = new THREE.Mesh(lg, toon({ color: 0xFF5A4E, snow: false })); this.liquid.position.y = this.tY0; g.add(this.liquid);
    this.bulb = bulb;
    /* scale: -10 to 40 °C, a tick every 10 */
    this.tMin = -10; this.tMax = 40;
    for (let t = this.tMin; t <= this.tMax; t += 10) {
      const y = this.tY0 + (t - this.tMin) / (this.tMax - this.tMin) * this.tH;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.03), new THREE.MeshBasicMaterial({ color: ink })); tick.position.set(0, y, 0.115); g.add(tick);
      const l = labelSprite(`${t}°`, 40); const h = 0.11; l.scale.set(h * l.userData.aspect, h, 1); l.position.set(-0.26, y, 0.1); l.material.depthTest = true; g.add(l);
    }
    this.thermo = g;
    this._thermoLabel();
  }
  _thermoLabel() {
    if (this.tLabel) { this.thermo.remove(this.tLabel); this.tLabel.material.map.dispose(); }
    const v = this.city.v.temp_c;
    const l = labelSprite(v == null ? tx(U.noData) : fmtValue('temp_c', v), 56, v == null ? '#E8364F' : '#1B2A4A');
    const h = 0.24; l.scale.set(h * l.userData.aspect, h, 1); l.position.set(0, this.tY0 + this.tH + 0.42, 0); l.material.depthTest = true;
    this.thermo.add(l); this.tLabel = l;
  }
  _setThermo(t) {
    const show = t != null;
    this.liquid.visible = show;
    const f = show ? clamp((t - this.tMin) / (this.tMax - this.tMin), 0.02, 1) : 0;
    this.liquid.scale.y = Math.max(0.001, f * this.tH);
    const col = new THREE.Color(t == null ? 0xAAAAAA : t < 5 ? 0x3F7FE0 : t < 15 ? 0xFF8A3D : 0xF0453A);
    this.liquid.material.uniforms.uColor.value.copy(col); this.bulb.material.uniforms.uColor.value.copy(col);
    this._thermoLabel();
  }

  /* ---------------------------------------------------------------- flag on the pontoon, bunting on both quays */
  _flags(c) {
    const pole = new THREE.Mesh(A.merge([A.cyl(0.04, 0.05, 3.4, 8, '#E8E2D2'), A.cyl(0.08, 0.08, 0.08, 8, '#FFC93C', 0, 3.4)]), toon({ vertexColors: true }));
    pole.position.set(2.75, 0, 1.75); c.pontoon.add(pole);
    const fg = new THREE.PlaneGeometry(1.3, 0.8, 10, 4); fg.translate(0.65, 0, 0);
    this.flagBase = fg.attributes.position.array.slice();
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 160; const gx = cv.getContext('2d');
    gx.fillStyle = '#2D8CFF'; gx.fillRect(0, 0, 256, 160); gx.fillStyle = '#FFC93C'; gx.beginPath(); gx.arc(128, 80, 44, 0, Math.PI * 2); gx.fill();
    gx.fillStyle = '#2FB65A'; gx.fillRect(0, 128, 256, 32);
    const ft = new THREE.CanvasTexture(cv); ft.colorSpace = THREE.SRGBColorSpace;
    this.flag = new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ map: ft, side: THREE.DoubleSide }));
    this.flag.position.set(2.75, 2.95, 1.75); c.pontoon.add(this.flag);
    /* bunting: little triangles on strings; each swings about its top edge */
    const T = c.T, lines = [[-44, 30, T.harbour.zSouth - 3.2, 6.5], [-30, 30, T.harbour.zNorth + 2.4, 4.2]];
    const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.45, 0], 3));
    const pts = [];
    for (const [x0, x1, z, h] of lines) for (let x = x0; x <= x1; x += 0.9) { const s = (x - x0) / (x1 - x0); pts.push([x, T.heightAt(x, z) + h - Math.sin(s * Math.PI) * 0.8 * (((x1 - x0) / 40)), z]); }
    const cols = ['#E8364F', '#FFC93C', '#2D8CFF', '#2FB65A', '#F5EFE0'];
    this.bunt = new THREE.InstancedMesh(tri, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), pts.length);
    const C = new THREE.Color();
    pts.forEach((p, i) => this.bunt.setColorAt(i, C.set(cols[i % cols.length])));
    this.buntPts = pts; c.root.add(this.bunt);
    const sl = []; for (let i = 0; i < pts.length - 1; i++) if (Math.abs(pts[i + 1][2] - pts[i][2]) < 0.1) sl.push(...pts[i], ...pts[i + 1]);
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
    c.root.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0x1B2A4A })));
  }

  /* ---------------------------------------------------------------- rain: streaks animated in the vertex shader */
  _rain(c) {
    const n = RAIN_MAX, pos = new Float32Array(n * 2 * 3), seed = new Float32Array(n * 2 * 4), r = rng(11);
    for (let i = 0; i < n; i++) {
      const s = [r() * 2 - 1, r() * 2 - 1, r(), 0.8 + r() * 0.4];
      for (let k = 0; k < 2; k++) { seed.set([s[0], s[1], s[2], s[3]], (i * 2 + k) * 4); pos[(i * 2 + k) * 3 + 1] = k; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: SU.uTime, uCenter: { value: new THREE.Vector3() }, uSlant: { value: 0.1 }, uAlpha: { value: 0.6 } },
      vertexShader: `attribute vec4 aSeed; uniform float uTime; uniform vec3 uCenter; uniform float uSlant; varying float vA;
void main() {
  float H = 26.0, R = 28.0, sp = 15.0 * aSeed.w;
  float y = H - mod(aSeed.z * H + uTime * sp, H);
  vec3 p = uCenter + vec3(aSeed.x * R, y - 4.0, aSeed.y * R);
  float len = 0.55 * aSeed.w;
  p += vec3(uSlant * len, len, 0.0) * position.y;
  p.x += uSlant * (H - y) * 0.15;
  vA = position.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`,
      fragmentShader: 'uniform float uAlpha; varying float vA; void main() { gl_FragColor = vec4(0.86, 0.93, 1.0, uAlpha * (0.35 + 0.65 * vA)); }',
    });
    this.rain = new THREE.LineSegments(g, this.rainMat); this.rain.frustumCulled = false; this.rain.renderOrder = 8; this.rain.visible = false;
    c.root.add(this.rain);
  }
  _snow(c) {
    const n = SNOW_MAX, pos = new Float32Array(n * 3), seed = new Float32Array(n * 4), r = rng(12);
    for (let i = 0; i < n; i++) seed.set([r() * 2 - 1, r() * 2 - 1, r(), 0.7 + r() * 0.6], i * 4);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    this.snowMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: SU.uTime, uCenter: { value: new THREE.Vector3() }, uSlant: { value: 0.1 }, uPx: { value: 900 } },
      vertexShader: `attribute vec4 aSeed; uniform float uTime; uniform vec3 uCenter; uniform float uSlant; uniform float uPx;
void main() {
  float H = 20.0, R = 22.0, sp = 1.1 * aSeed.w, ph = aSeed.z * 40.0;
  float y = H - mod(aSeed.z * H + uTime * sp, H);
  vec3 p = uCenter + vec3(aSeed.x * R + sin(uTime * 0.7 + ph) * 0.6 + uSlant * (H - y) * 0.5, y - 3.0, aSeed.y * R + cos(uTime * 0.5 + ph) * 0.6);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = clamp(uPx * 0.05 * aSeed.w / -mv.z, 1.5, 22.0);
  gl_Position = projectionMatrix * mv;
}`,
      fragmentShader: 'void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(1.0, 1.0, 1.0, 0.95 * (1.0 - smoothstep(0.3, 0.5, d))); }',
    });
    this.snowPts = new THREE.Points(g, this.snowMat); this.snowPts.frustumCulled = false; this.snowPts.renderOrder = 8; this.snowPts.visible = false;
    c.root.add(this.snowPts);
  }
  _puddles(c) {
    const T = c.T, r = rng(13), spots = [];
    for (let i = 0; i < 16; i++) { const north = i % 3 === 0; spots.push([(r() - 0.5) * 60, north ? T.harbour.zNorth + 1.5 + r() * 9 : T.harbour.zSouth - 1.5 - r() * 5.5, 0.8 + r() * 1.4]); }
    const g = new THREE.CircleGeometry(1, 18); g.rotateX(-Math.PI / 2);
    this.pud = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ color: 0x5E86A8, transparent: true, opacity: 0.55, depthWrite: false }), spots.length);
    const M = new THREE.Matrix4();
    spots.forEach(([x, z, s], i) => { M.makeScale(s * 1.4, 1, s); M.setPosition(x, T.heightAt(x, z) + 0.03, z); this.pud.setMatrixAt(i, M); });
    this.pudSpots = spots; this.pud.visible = false; this.pud.renderOrder = 2; c.root.add(this.pud);
  }
  _snowStuff(c) {
    /* depth stick on the pontoon, in front of you: a white mound shows the depth, bands every 10 cm */
    const s = new THREE.Group(); s.position.set(-0.9, 0, -1.6); c.pontoon.add(s);
    const p = []; for (let k = 0; k < 8; k++) p.push(A.box(0.07, 0.1, 0.07, k % 2 ? '#1B2A4A' : '#E8364F', 0, k * 0.1));
    p.push(A.box(0.12, 0.05, 0.12, '#FFC93C', 0, 0.8));
    s.add(new THREE.Mesh(A.merge(p), toon({ vertexColors: true, snow: false })));
    this.mound = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 1, 14), toon({ color: 0xF6F9FF, snow: false })); this.mound.geometry.translate(0, 0.5, 0); s.add(this.mound);
    this.stick = s;
    /* snowmen, for more than 10 cm of snow */
    const sm = A.merge([A.part(new THREE.SphereGeometry(0.45, 12, 9), '#F7FAFF', { y: 0.4 }), A.part(new THREE.SphereGeometry(0.32, 12, 9), '#F7FAFF', { y: 1.05 }),
      A.part(new THREE.SphereGeometry(0.23, 12, 9), '#F7FAFF', { y: 1.52 }), A.part(new THREE.ConeGeometry(0.05, 0.28, 6), '#FF8A3D', { y: 1.52, z: 0.3, rx: Math.PI / 2 }),
      A.cyl(0.18, 0.18, 0.28, 10, '#1B2A4A', 0, 1.68), A.cyl(0.26, 0.26, 0.03, 10, '#1B2A4A', 0, 1.68), A.box(0.5, 0.08, 0.1, '#E8364F', 0, 1.3, 0.05)]);
    const T = c.T, spots = [[-6, T.harbour.zSouth - 3], [15, T.harbour.zSouth - 2.5], [-25, T.harbour.zSouth - 4], [4, T.harbour.zNorth + 3.5], [-8, T.harbour.zNorth + 4.5]];
    this.snowmen = spots.map(([x, z]) => { const m = new THREE.Mesh(sm, toon({ vertexColors: true, snow: false })); m.position.set(x, T.heightAt(x, z), z); m.rotation.y = z > 0 ? Math.PI : 0; m.visible = false; c.root.add(m); return m; });
  }
  _haze(c) {
    const g = new THREE.CylinderGeometry(30, 30, 7, 48, 1, true);
    this.hazeMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uTime: SU.uTime },
      vertexShader: 'varying vec2 vU; void main() { vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; varying vec2 vU;
void main() { float w = sin(vU.x * 260.0 + sin(vU.y * 9.0 + uTime * 2.2) * 2.5 + uTime * 0.8) * 0.5 + 0.5;
  float a = w * smoothstep(0.0, 0.2, vU.y) * (1.0 - smoothstep(0.35, 1.0, vU.y)) * 0.10; gl_FragColor = vec4(1.0, 0.9, 0.7, a); }`,
    });
    this.haze = new THREE.Mesh(g, this.hazeMat); this.haze.visible = false; this.haze.renderOrder = 9; c.root.add(this.haze);
  }

  /* ---------------------------------------------------------------- data -> weather */
  apply(v, c) {
    const T = c.T, w = BANDS.wind(v.wind_ms) || 'breezy', rb = BANDS.rain(v.rain_mm_yr), snowing = BANDS.snowfall(v.snow_depth_cm, v.temp_c), snowCm = v.snow_depth_cm || 0;
    this.wind = w;
    SU.uSway.value = SWAY[w]; c.waterMat.uniforms.uChop.value = CHOP[w]; c.chop = CHOP[w];
    const slant = { still: 0.02, breezy: 0.25, stormy: 0.9 }[w];
    this.rainMat.uniforms.uSlant.value = slant; this.snowMat.uniforms.uSlant.value = slant;
    /* rain or snow falling */
    const nRain = snowing ? 0 : (RAIN_N[rb] || 0);
    this.rain.visible = nRain > 0; this.rain.geometry.setDrawRange(0, nRain * 2);
    this.rainMat.uniforms.uAlpha.value = rb === 'heavy' ? 0.7 : rb === 'steady' ? 0.6 : 0.5;
    const nSnow = snowing ? Math.round(clamp(300 + snowCm * 18, 300, SNOW_MAX)) : 0;
    this.snowPts.visible = nSnow > 0; this.snowPts.geometry.setDrawRange(0, nSnow);
    SU.uWet.value = snowing ? 0 : { dry: 0, light: 0.35, steady: 0.7, heavy: 1 }[rb] || 0;
    /* puddles where the ground is above water */
    const wet = !snowing && (rb === 'steady' || rb === 'heavy') && (v.temp_c == null || v.temp_c > 0);
    this.pud.visible = wet;
    if (wet) { const M = new THREE.Matrix4(); this.pudSpots.forEach(([x, z, s], i) => { const y = T.heightAt(x, z); const k = y > c.waterY + 0.05 ? (rb === 'heavy' ? 1.25 : 0.9) : 0.0001; M.makeScale(s * 1.4 * k, 1, s * k); M.setPosition(x, y + 0.03, z); this.pud.setMatrixAt(i, M); }); this.pud.instanceMatrix.needsUpdate = true; }
    /* snow on the ground: 1 cm already shows, 10 cm covers */
    SU.uSnow.value = BANDS.snowCover(v.snow_depth_cm);
    this.stick.visible = snowCm >= 0.2;
    this.mound.scale.y = Math.max(0.001, Math.min(snowCm, 80) / 100);
    for (const m of this.snowmen) m.visible = BANDS.snowmen(v.snow_depth_cm) && m.position.y > c.waterY + 0.1;
    this.haze.visible = BANDS.haze(v.temp_c);
    this._setThermo(v.temp_c);
    this.stickLabel();
  }
  stickLabel() {
    if (this.sLabel) { this.stick.remove(this.sLabel); this.sLabel.material.map.dispose(); this.sLabel = null; }
    const v = this.city.v.snow_depth_cm;
    if (!v) return;
    const l = labelSprite(fmtValue('snow_depth_cm', v), 48); const h = 0.12; l.scale.set(h * l.userData.aspect, h, 1); l.position.set(0, 1.05, 0); l.material.depthTest = true;
    this.stick.add(l); this.sLabel = l;
  }
  relabel() { this._thermoLabel(); this.stickLabel(); }

  /* ---------------------------------------------------------------- per frame */
  update(dt, t, c, camera) {
    const { cw, M, Q, E, S, V } = TMP; camera.getWorldPosition(cw); c.root.worldToLocal(cw);
    this.rainMat.uniforms.uCenter.value.copy(cw); this.snowMat.uniforms.uCenter.value.copy(cw);
    this.haze.position.set(cw.x, Math.max(c.waterY, c.quay) + 0.2, cw.z);
    const w = this.wind, amp = { still: 0.02, breezy: 0.14, stormy: 0.32 }[w], sp = { still: 1.2, breezy: 4.5, stormy: 9 }[w];
    /* flag: a travelling wave; it droops when the air is still */
    const P = this.flag.geometry.attributes.position, B = this.flagBase;
    for (let i = 0; i < P.count; i++) {
      const x = B[i * 3], y = B[i * 3 + 1];
      P.array[i * 3 + 2] = Math.sin(x * 4.5 - t * sp + y) * amp * x * 1.6;
      P.array[i * 3 + 1] = y - (w === 'still' ? x * 0.55 : 0);
      P.array[i * 3] = w === 'still' ? x * 0.75 : x;
    }
    P.needsUpdate = true;
    /* bunting */
    const ba = { still: 0.04, breezy: 0.35, stormy: 0.9 }[w], bs = { still: 0.8, breezy: 3, stormy: 7 }[w];
    this.buntPts.forEach((p, i) => { E.set(Math.sin(t * bs + i * 0.7) * ba + ba * 0.6, 0, 0); Q.setFromEuler(E); M.compose(V.set(p[0], p[1], p[2]), Q, S); this.bunt.setMatrixAt(i, M); });
    this.bunt.instanceMatrix.needsUpdate = true;
  }
}
