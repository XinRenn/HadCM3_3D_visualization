/* Bristol harbourside: a cartoon placeholder. The viewer stands on a floating pontoon in the Floating Harbour
   facing a long low museum standing in for M Shed. The water is one flat plane at sea_level_m (relative to
   today), so flooding is approximate. The pontoon floats on it; when the sea is lower than today the pontoon
   stays at today's level on its guide piles and the harbour floor shows dry.
   City coordinates: metres, y = height above today's harbour water, -z from the pontoon toward M Shed. */
import * as THREE from 'three';
import { loadTerrain } from './terrain.js';
import { SU, toon, skyMaterial, waterMaterial } from './materials.js';
import * as A from './assets.js';
import { Panel, COL, text, rr } from '../ui/panel.js';
import { drawIcon } from '../ui/icons.js';
import { labelSprite } from '../globe.js';
import { U, tx, fmt, pathLabel, sourceLabel, timeLabel } from '../i18n.js';
import { fmtValue } from '../format.js';
import { BANDS } from '../data.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

export class BristolScene {
  constructor(app) {
    this.app = app;
    this.root = new THREE.Group(); this.root.name = 'bristol';
    this.deckY = 0.35; this.waterY = 0;
    this.v = {}; this.parts = [];          // parts: modules with apply(v, scene) / update(dt, t, scene) (weather, people, plants)
  }

  async init() {
    const cfg = await (await fetch('config/bristol_scene.json', { cache: 'no-cache' })).json();
    this.cfg = cfg;
    const T = this.T = await loadTerrain(cfg.city || 'bristol', cfg);
    this.root.add(T.mesh);
    this.floor = T.harbour.floor; this.quay = T.quaySouth;
    this._sky(); this._water(); this._landmarks(); this._houses(); this._furniture(); this._pontoon(); this._pole(); this._boats();
    /* weather, people and plants plug in here (milestone 5); each is optional */
    for (const m of ['./weather.js', './life.js']) {
      try { const mod = await import(m); const p = new mod.default(this); if (p.init) await p.init(); this.parts.push(p); }
      catch (e) { if (!/Failed to fetch|Importing a module script failed|error loading dynamically/i.test(String(e))) console.error(e); }
    }
  }

  /* ---------------------------------------------------------------- building */
  _sky() {
    this.skyMat = skyMaterial();
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 16), this.skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.root.add(this.sky);
  }
  _water() {
    this.waterMat = waterMaterial();
    const g = new THREE.PlaneGeometry(1600, 1600); g.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(g, this.waterMat); this.water.renderOrder = 5;
    this.root.add(this.water);
    /* when the harbour is dry, a small river still runs along the bottom (an illustration) */
    const rw = this.cfg.river_when_dry || { width_m: 7 };
    const rg = new THREE.PlaneGeometry(1600, rw.width_m); rg.rotateX(-Math.PI / 2);
    this.river = new THREE.Mesh(rg, waterMaterial()); this.river.material.uniforms.uAlpha.value = 0.95;
    this.river.position.set(0, this.floor + 0.05, (this.T.harbour.zSouth + this.T.harbour.zNorth) / 2 + 2);
    this.river.visible = false; this.root.add(this.river);
  }
  _landmarks() {
    const c = this.cfg, ms = c.mshed, y = this.T.heightAt(ms.x, ms.z);
    const m = new THREE.Mesh(A.mshed(ms.length, ms.height, ms.depth), toon({ vertexColors: true, windows: true }));
    m.position.set(ms.x, y, ms.z); this.root.add(m); this.mshed = m;
    this.mshedSign = this._sign(tx(U.mshed));
    this.mshedSign.position.set(ms.x, y + 6.3, ms.z + ms.depth / 2 + 0.08);
    this.root.add(this.mshedSign);
    const cm = toon({ vertexColors: true }), cg = A.crane();
    for (const k of c.cranes) {
      const cr = new THREE.Mesh(cg, cm); cr.position.set(k.x, this.T.heightAt(k.x, c.crane_z), c.crane_z); cr.rotation.y = k.turn || 0; this.root.add(cr);
    }
  }
  _sign(s) {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192;
    const g = cv.getContext('2d');
    rr(g, 6, 6, 1012, 180, 30); g.fillStyle = '#1B2A4A'; g.fill(); g.lineWidth = 8; g.strokeStyle = '#FFFDF5'; g.stroke();
    text(g, s, 512, 100, 120, { align: 'center', color: '#FFFDF5', weight: 900, maxW: 960 });
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    return new THREE.Mesh(new THREE.PlaneGeometry(16, 3), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  }
  _houses() {
    const T = this.T, r = rng(7), bodies = [], roofs = [], ms = this.cfg.mshed;
    const add = (x, z, w, h, d, ry, roofH, flat) => {
      const y = Math.min(T.heightAt(x, z - d / 2), T.heightAt(x, z + d / 2), T.heightAt(x - w / 2, z), T.heightAt(x + w / 2, z)) - 0.4;
      bodies.push({ x, y, z, w, h: h + 0.4, d, ry, c: A.HOUSE_COLOURS[Math.floor(r() * A.HOUSE_COLOURS.length)] });
      if (!flat) roofs.push({ x, y: y + h + 0.4, z, w: w + 0.4, h: roofH, d: d + 0.4, ry, c: A.ROOF_COLOURS[Math.floor(r() * A.ROOF_COLOURS.length)] });
    };
    /* the hill behind M Shed: rows of coloured terraces */
    for (let z = -44; z >= -170; z -= 10.5) for (let x = -230; x <= 230; x += 8.5 + r() * 2) {
      if (r() < 0.2) continue;
      add(x + r() * 1.5, z + r() * 2, 6 + r() * 2, 5.5 + r() * 4.5, 7, (r() - 0.5) * 0.08, 2 + r() * 1.2, false);
    }
    /* flats and sheds along the south quay either side of M Shed */
    for (let x = -240; x <= 240; x += 17) {
      if (Math.abs(x - ms.x) < ms.length / 2 + 10) continue;
      add(x, -26 + r() * 3, 13 + r() * 2, 10 + r() * 8, 11, 0, 0, true);
    }
    /* behind the viewer: warehouses on the north quay, then houses rising */
    for (let x = -240; x <= 240; x += 18) add(x, 42 + r() * 4, 15, 9 + r() * 7, 12, Math.PI, 0, r() < 0.6);
    for (let z = 64; z <= 160; z += 11) for (let x = -230; x <= 230; x += 9 + r() * 2) { if (r() < 0.3) continue; add(x, z, 6.5, 6 + r() * 4, 7, Math.PI, 2.2, false); }
    const bm = new THREE.InstancedMesh(A.unitBox(), toon({ windows: true }), bodies.length);
    const rm = new THREE.InstancedMesh(A.unitRoof(), toon({}), roofs.length);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), C = new THREE.Color(), Y = new THREE.Vector3(0, 1, 0);
    bodies.forEach((b, i) => { M.compose(P.set(b.x, b.y, b.z), Q.setFromAxisAngle(Y, b.ry), S.set(b.w, b.h, b.d)); bm.setMatrixAt(i, M); bm.setColorAt(i, C.set(b.c)); });
    roofs.forEach((b, i) => { M.compose(P.set(b.x, b.y, b.z), Q.setFromAxisAngle(Y, b.ry), S.set(b.w, b.h, b.d)); rm.setMatrixAt(i, M); rm.setColorAt(i, C.set(b.c)); });
    bm.computeBoundingSphere(); rm.computeBoundingSphere();
    this.root.add(bm, rm);
    this.houses = { bodies, roofs };
  }
  _furniture() {
    const T = this.T, zS = T.harbour.zSouth, zN = T.harbour.zNorth, p = [];
    const place = (geo, x, z, ry = 0) => p.push(A.part(geo, '#ffffff', { x, y: T.heightAt(x, z), z, ry }));
    const bo = A.bollard(), la = A.lamp(), be = A.bench();
    for (let x = -96; x <= 96; x += 6) { if (Math.abs(x + 2.4) < 2) continue; place(bo, x, zS - 0.5); place(bo, x + 3, zN + 0.5); }
    for (let x = -90; x <= 90; x += 18) { place(la, x, zS - 5.2); place(la, x + 9, zN + 6); }
    for (const x of [-27, -14, 0, 14, 27]) place(be, x + 4, zS - 4.4, Math.PI);
    /* merge keeps the vertex colours of each piece (the part colour is white) */
    const parts = p.map(q => { const g = q.g, n = g.attributes.position.count, c = g.attributes.color; return { g, c: null, cols: c ? c.array : new Float32Array(n * 3).fill(1) }; });
    let n = 0; for (const q of parts) n += q.g.attributes.position.count;
    const pos = new Float32Array(n * 3), cc = new Float32Array(n * 3); let o = 0;
    for (const q of parts) { pos.set(q.g.attributes.position.array, o * 3); cc.set(q.cols, o * 3); o += q.g.attributes.position.count; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(cc, 3)); g.computeBoundingSphere();
    this.root.add(new THREE.Mesh(g, toon({ vertexColors: true })));
  }
  _pontoon() {
    const c = this.cfg.pontoon;
    this.pontoon = new THREE.Group(); this.pontoon.position.set(c.x, 0, c.z);
    this.pontoon.add(new THREE.Mesh(A.pontoon(c.size_x, c.size_z), toon({ vertexColors: true })));
    this.root.add(this.pontoon);
    /* guide piles: the pontoon slides up and down them; below today's level it rests on them */
    const pg = new THREE.CylinderGeometry(0.22, 0.22, 1, 10); pg.translate(0, 0.5, 0);
    const pm = toon({ color: 0x5B4636 });
    this.piles = [-1, 1].map(s => { const m = new THREE.Mesh(pg, pm); m.position.set(c.x + s * (c.size_x / 2 + 0.3), this.floor, c.z + c.size_z / 2 - 0.4); this.root.add(m); return m; });
    /* gangway behind you, from the north quay edge down (or up) to the back of the pontoon */
    this.gangRun = this.T.harbour.zNorth - (c.z + c.size_z / 2); this.gangLen0 = this.gangRun;
    this.gang = new THREE.Mesh(A.gangway(this.gangLen0), toon({ vertexColors: true }));
    this.gang.position.set(c.x - 1.6, this.T.quayNorth, this.T.harbour.zNorth);
    this.gang.rotation.order = 'YXZ'; this.gang.rotation.y = Math.PI;
    this.root.add(this.gang);
    /* the weather board, on a stand at the front-left of the pontoon so it never floods */
    this.board = new Panel({ px: [800, 680], width: 1.05, name: 'board' });
    this.board.paint = (p, g) => this._paintBoard(p, g);
    this.board.mesh.position.set(-1.8, 1.42, -1.48); this.board.mesh.rotation.y = 0.5;
    this.pontoon.add(this.board.mesh);
  }
  _pole() {
    const c = this.cfg.tide_pole;
    this.pole = new THREE.Group(); this.pole.position.set(c.x, 0, c.z); this.root.add(this.pole);
    this.pole.add(new THREE.Mesh(A.tidePole(this.floor, c.top_m), toon({ vertexColors: true })));
    const ring = (color) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 20), new THREE.MeshBasicMaterial({ color })); this.pole.add(m); return m; };
    this.ringToday = ring(0x2D8CFF); this.ringHere = ring(0xFFC93C);
    this.band = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 1, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xFFC93C, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
    this.pole.add(this.band);
    this.lblToday = null; this.lblHere = null; this.lblRange = null;
  }
  _boats() {
    const T = this.T, specs = [[-12, T.harbour.zSouth + 3.2, 0, '#E8364F'], [10, T.harbour.zSouth + 3.0, Math.PI, '#2D8CFF'], [-9, T.harbour.zNorth - 3.2, 0.1, '#FFC93C'], [26, T.harbour.zNorth - 3.4, Math.PI - 0.1, '#2FB65A']];
    const m = toon({ vertexColors: true });
    this.boats = specs.map(([x, z, ry, c], k) => { const b = new THREE.Mesh(A.boat(c), m); b.position.set(x, 0, z); b.rotation.y = ry; b.userData.ph = k * 1.7; this.root.add(b); return b; });
  }

  /* ---------------------------------------------------------------- labels */
  _label(old, s, color) {
    if (old) { old.parent && old.parent.remove(old); old.material.map.dispose(); old.material.dispose(); }
    const l = labelSprite(s, 44, color); const h = 0.32; l.scale.set(h * l.userData.aspect, h, 1); l.renderOrder = 30; this.pole.add(l); return l;
  }
  _poleLabels() {
    const v = this.v, sl = v.sea_level_m, f = this.floor;
    this.lblToday = this._label(this.lblToday, `${tx(U.t_today)}: 0 m`.replace(' m', LANG_M()), '#2D8CFF');
    this.lblToday.position.set(0.95, 0.25, 0);
    if (sl == null) { this.lblHere = this._label(this.lblHere, `${tx(U.t_here)}: ${tx(U.noData)}`, '#1B2A4A'); this.lblHere.position.set(0.95, 1.2, 0); }
    else if (sl < f) { this.lblHere = this._label(this.lblHere, '↓ ' + fmt(U.t_below, { v: fmtNum(sl) }), '#1B2A4A'); this.lblHere.position.set(0.95, f + 0.6, 0); }
    else { this.lblHere = this._label(this.lblHere, `${tx(U.t_here)}: ${fmtValue('sea_level_m', sl)}`, '#B07A00'); this.lblHere.position.set(0.95, sl + (Math.abs(sl) < 0.6 ? 0.55 : 0.25), 0); }
    const r = v.sea_level_m_range;
    if (r && sl != null && sl >= f && Math.abs(r[1] - r[0]) > 0.15) {
      this.lblRange = this._label(this.lblRange, `${tx(U.t_range)}: ${fmtValue('sea_level_m', r[0])} … ${fmtValue('sea_level_m', r[1])}`, '#7A6A3A');
      this.lblRange.scale.multiplyScalar(0.75); this.lblRange.position.set(0.95, Math.max(r[1], sl) + 0.6, 0);
    } else if (this.lblRange) { this.lblRange.visible = false; }
  }
  _paintBoard(p, g) {
    const W = p.W, H = p.H, v = this.v, app = this.app, d = app.data, pw = d.pathway(app.S.pathway);
    rr(g, 6, 6, W - 12, H - 12, 34); g.fillStyle = COL.paper; g.fill(); g.lineWidth = 10; g.strokeStyle = COL.ink; g.stroke();
    rr(g, 6, 6, W - 12, 96, 34); g.fillStyle = COL.ink; g.fill(); g.fillRect(6, 60, W - 12, 42);
    text(g, tx(U.board), 32, 56, 40, { color: '#fff', weight: 900, maxW: W - 230 });
    if (d.placeholder) { rr(g, W - 196, 28, 170, 52, 26); g.fillStyle = COL.demo; g.fill(); text(g, sourceLabel(d), W - 111, 55, 26, { align: 'center', color: '#fff', weight: 900, maxW: 156 }); }
    const sub = `${timeLabel(this.t || 0)} · ${pw ? pathLabel(pw) : tx(U.noData)}`;
    text(g, sub, 32, 132, 30, { color: COL.ink2, weight: 800, maxW: W - 64 });
    const snowing = BANDS.snowfall(v.snow_depth_cm, v.temp_c);
    const rows = [
      ['sea_level_m', U.b_sea, fmtValue('sea_level_m', v.sea_level_m)],
      ['temp_c', U.b_temp, fmtValue('temp_c', v.temp_c)],
      ['wind', U.b_wind, fmtValue('wind_ms', v.wind_ms, { band: true })],
      ['rain_mm_yr', U.b_rain, v.rain_mm_yr == null ? tx(U.noData) : fmtValue('rain_mm_yr', v.rain_mm_yr) + (snowing ? ` (${tx(U.snowing)})` : ` (${tx(U[BANDS.rain(v.rain_mm_yr)])})`)],
      ['snow_depth_cm', U.b_snow, fmtValue('snow_depth_cm', v.snow_depth_cm)],
      ['vegetation', U.b_veg, fmtValue('vegetation', v.vegetation)],
      ['co2', U.b_co2, fmtValue('co2_ppm', v.co2_ppm)],
    ];
    rows.forEach(([ic, lab, val], k) => {
      const y = 166 + k * 62;
      if (k % 2 === 0) { g.fillStyle = COL.paper2; g.fillRect(16, y + 1, W - 32, 62); }
      if (ic === 'wind') drawWind(g, 52, y + 32, 44); else if (ic === 'co2') drawCO2(g, 52, y + 32, 44); else drawIcon(g, ic, 52, y + 32, 46);
      text(g, tx(lab), 92, y + 32, 27, { weight: 700, color: COL.ink2, maxW: 330 });
      const missing = val === tx(U.noData);
      text(g, val, W - 30, y + 32, 31, { align: 'right', weight: 900, color: missing ? COL.demo : COL.ink, maxW: W - 440 });
    });
    text(g, tx(U.baseNote), W / 2, H - 66, 19, { align: 'center', weight: 700, color: COL.ink2, maxW: W - 40 });
    text(g, tx(U.average), W / 2, H - 34, 21, { align: 'center', weight: 700, color: COL.ink2, maxW: W - 40 });
  }
  groundColor(hex) { SU.uGrass.value.set(hex); }
  relabel() {
    const old = this.mshedSign; this.mshedSign = this._sign(tx(U.mshed)); this.mshedSign.position.copy(old.position); this.root.remove(old); this.root.add(this.mshedSign);
    old.material.map.dispose();
    this._poleLabels(); this.board.redraw();
    for (const p of this.parts) if (p.relabel) p.relabel();
  }

  /* ---------------------------------------------------------------- data -> scene */
  apply(v, t) {
    this.v = v; this.t = t;
    const c = this.cfg.pontoon, f = this.floor, sl = v.sea_level_m;
    this.waterY = sl == null ? 0 : sl;
    const dry = this.waterY < f + 0.05;
    this.water.visible = !dry; this.water.position.y = this.waterY;
    this.river.visible = dry;
    /* the pontoon floats on the water; if the sea is lower than today it rests on its piles at today's level */
    const deck = Math.max(this.waterY, 0) + c.freeboard_m;
    this.deckY = deck; this.pontoon.position.y = deck;
    this.viewOrigin = new THREE.Vector3(-c.x, -deck, -c.z);          // main.js moves the city so the deck centre is where you stand
    for (const p of this.piles) { p.scale.y = deck + 1.3 - f; p.visible = true; }
    const dy = deck - this.T.quayNorth, len = Math.hypot(this.gangRun, dy);
    this.gang.visible = dy > -4 && dy < 1.6;
    this.gang.scale.z = len / this.gangLen0; this.gang.rotation.x = -Math.asin(clamp(dy / len, -1, 1));
    /* tide pole */
    this.ringToday.position.y = 0;
    this.ringHere.visible = sl != null && sl >= f; if (sl != null) this.ringHere.position.y = sl;
    const r = v.sea_level_m_range;
    this.band.visible = !!(r && sl != null && sl >= f);
    if (this.band.visible) { const lo = Math.max(r[0], f), hi = Math.max(r[1], f); this.band.position.y = (lo + hi) / 2; this.band.scale.y = Math.max(0.05, hi - lo); }
    this._poleLabels();
    SU.uWater.value = this.waterY;
    /* boats float, or sit on the mud */
    for (const b of this.boats) { b.userData.aground = dry; b.userData.y = dry ? f + 0.35 : this.waterY; }
    this._skyFor(v);
    for (const p of this.parts) if (p.apply) p.apply(v, this);
    this.board.redraw();
  }
  _skyFor(v) {
    const t = v.temp_c, band = BANDS.rain(v.rain_mm_yr), snowing = BANDS.snowfall(v.snow_depth_cm, v.temp_c);
    const tt = t == null ? 10 : t;
    const pick = (cold, cool, warm, hot) => tt < 5 ? lerpC(cold, cool, (tt + 5) / 10) : tt < 15 ? lerpC(cool, warm, (tt - 5) / 10) : lerpC(warm, hot, clamp((tt - 15) / 13, 0, 1));
    let top = pick(['#9DB4CF'], ['#58A6E8'], ['#3E9BEA'], ['#78B4DE']), hor = pick(['#DDE7EF'], ['#CDEBFF'], ['#E2F3FF'], ['#FFF0C8']);
    const grey = snowing ? 0.45 : { dry: 0, light: 0.2, steady: 0.38, heavy: 0.58 }[band] || 0;
    top = top.lerp(new THREE.Color('#8D99A8'), grey); hor = hor.lerp(new THREE.Color('#C3CBD3'), grey);
    const U2 = this.skyMat.uniforms;
    U2.uTop.value.copy(top); U2.uHor.value.copy(hor);
    U2.uSunSize.value = lerp(0.85, 1.7, clamp((tt - 0) / 30, 0, 1));
    U2.uSunVis.value = 1 - grey * 1.2 < 0.15 ? 0.15 : 1 - grey * 1.2;
    U2.uHaze.value = BANDS.haze(t) ? 1 : 0;
    U2.uSun.value.copy(SU.uLight.value);
    SU.uFogCol.value.copy(hor);
    SU.uAmbSky.value.setRGB(1, 1, 1).lerp(new THREE.Color('#C9D2DC'), grey);
    SU.uFogNear.value = lerp(110, 50, grey); SU.uFogFar.value = lerp(520, 260, grey);
    this.waterMat.uniforms.uDeep.value.set(tt < 5 ? '#3F7FA6' : '#2E8FC7'); this.waterMat.uniforms.uShallow.value.set(tt < 5 ? '#6FAFCB' : (tt > 22 ? '#5ED0D6' : '#5CC4E6'));
  }

  /* ---------------------------------------------------------------- per frame */
  update(dt, t, camera) {
    SU.uTime.value = t;
    this.root.updateWorldMatrix(true, false);
    this.root.getWorldPosition(SU.uOrigin.value);
    const cw = CW; camera.getWorldPosition(cw); this.root.worldToLocal(cw);
    this.sky.position.copy(cw);
    const chop = this.chop || 0.4;
    for (const b of this.boats) {
      const ph = b.userData.ph, y = b.userData.y ?? 0;
      if (b.userData.aground) { b.position.y = y; b.rotation.z = 0.18; b.rotation.x = 0.05; continue; }
      b.position.y = y + Math.sin(t * 1.3 + ph) * 0.05 * (0.6 + chop);
      b.rotation.z = Math.sin(t * 1.1 + ph) * 0.03 * (0.5 + 2.2 * chop);
      b.rotation.x = Math.sin(t * 0.9 + ph * 2) * 0.02 * (0.5 + 2 * chop);
    }
    for (const p of this.parts) if (p.update) p.update(dt, t, this, camera);
  }
}

const CW = new THREE.Vector3();
function lerpC(a, b, t) { return new THREE.Color(a[0]).lerp(new THREE.Color(b[0]), clamp(t, 0, 1)); }
function fmtNum(v) { return (v < 0 ? '−' : '') + Math.abs(Math.round(v)); }
function LANG_M() { return tx({ en: ' m', zh: ' 米' }); }
function drawCO2(g, cx, cy, s) {
  g.save(); g.fillStyle = '#C9CFDA'; g.strokeStyle = COL.ink; g.lineWidth = s * 0.06;
  for (const [x, y, r] of [[-0.18, 0.05, 0.26], [0.12, -0.05, 0.3], [0.3, 0.12, 0.2]]) { g.beginPath(); g.arc(cx + x * s, cy + y * s, r * s, 0, Math.PI * 2); g.fill(); g.stroke(); }
  text(g, 'CO₂', cx, cy + 2, s * 0.34, { align: 'center', weight: 900 }); g.restore();
}
function drawWind(g, cx, cy, s) {
  g.save(); g.translate(cx, cy); g.lineCap = 'round'; g.strokeStyle = COL.ink; g.lineWidth = s * 0.09;
  for (const [y, w] of [[-0.22, 0.7], [0, 0.85], [0.22, 0.55]]) {
    g.beginPath(); g.moveTo(-0.45 * s, y * s); g.lineTo((w - 0.6) * s, y * s); g.arc((w - 0.6) * s, (y - 0.09) * s, 0.09 * s, Math.PI / 2, -Math.PI * 0.9, true); g.stroke();
  }
  g.restore();
}
