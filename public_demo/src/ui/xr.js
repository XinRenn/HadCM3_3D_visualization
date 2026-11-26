/* VR controls: the WebXR session, controller rays (trigger or pinch to press or drag), world-space panels for
   the globe screen and the Bristol lectern, the labels that follow your view, and the closing card.
   The globe can be grabbed as in the v3 VR viewer: grip (or pinch off the globe) moves and turns it, both grips
   resize it, trigger-drag on it spins it, the right stick turns it (left/right) and resizes it (up/down).
   With ?xrsim=1 on a desktop the mouse stands in for the controller ray (left button = trigger, drag on empty
   space = look around), so the VR panels can be tested without a headset. */
import * as THREE from 'three';
import { Panel, COL, text, para, rr } from './panel.js';
import { drawIcon } from './icons.js';
import { U, tx, fmt, pathLabel, pathSub, sourceLabel, timeLabel, markLabel } from '../i18n.js';
import { fmtValue } from '../format.js';

const V3 = THREE.Vector3, Q = THREE.Quaternion;
const PATH_COL = ['#2BA7A0', '#2FB65A', '#8CC63F', '#E9A92C', '#F07A3A', '#D93B4B', '#7A2E8E'];
export const pathColor = (p, k = 0) => (p && p.color) || PATH_COL[k % PATH_COL.length];
export const pathIcon = (p, k = 0) => (p && p.icon) || ['leaf', 'road', 'factory', 'smoke'][Math.min(k, 3)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export class XRUI {
  constructor(app, { sim = false } = {}) {
    this.app = app; this.sim = sim;
    this.pointers = [];
    this.globePanel = new Panel({ px: [1024, 600], width: 1.25, name: 'globePanel' });
    this.globePanel.paint = (p, g) => this.paintGlobe(p, g);
    this.legendPanel = new Panel({ px: [512, 512], width: 0.4, name: 'legend' });
    this.legendPanel.paint = (p, g) => this.paintLegend(p, g);
    this.cityPanel = new Panel({ px: [1024, 440], width: 1.0, name: 'cityPanel' });
    this.cityPanel.paint = (p, g) => this.paintCity(p, g);
    this.hud = new Panel({ px: [1024, 176], width: 0.8, name: 'hud', depthTest: false });
    this.hud.paint = (p, g) => this.paintHud(p, g); this.hud.mesh.renderOrder = 950;
    this.card = new Panel({ px: [1024, 760], width: 1.0, name: 'card', depthTest: false });
    this.card.paint = (p, g) => this.paintCard(p, g); this.card.mesh.renderOrder = 940;
    for (const p of [this.globePanel, this.legendPanel, this.cityPanel]) app.content.add(p.mesh);
    app.scene.add(this.hud.mesh); app.scene.add(this.card.mesh);
    this.globePanel.mesh.position.set(0, 0.8, -0.56); this.globePanel.mesh.rotation.x = -0.78;
    this.legendPanel.mesh.position.set(0.66, 1.3, -0.7); this.legendPanel.mesh.rotation.y = -0.55;
    this.cityPanel.mesh.position.set(0, 0.95, -0.66); this.cityPanel.mesh.rotation.x = -0.8;
    this.hudPos = new V3(); this.hudReady = false;
    this.raycaster = new THREE.Raycaster();
    this.active = false; this.two = null;
    this._setupControllers();
    this.setActive(sim);
  }

  /* ---------------------------------------------------------------- session */
  async supported() {
    if (!navigator.xr || !navigator.xr.isSessionSupported) return false;
    try { return await navigator.xr.isSessionSupported('immersive-vr'); } catch (e) { return false; }
  }
  async enter() {
    const r = this.app.renderer;
    if (r.xr.isPresenting) { r.xr.getSession().end(); return; }
    const s = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'hand-tracking'] });
    r.xr.setReferenceSpaceType('local-floor');
    await r.xr.setSession(s);
  }
  setActive(on) { this.active = on; this.hudReady = false; this.syncVisibility(); this.redraw(); }
  syncVisibility() {
    const on = this.active, m = this.app.S.mode, card = this.app.S.closingOpen;
    this.globePanel.visible = on && m === 'globe';
    this.legendPanel.visible = on && m === 'globe';
    this.cityPanel.visible = on && m === 'city';
    this.hud.visible = on;
    this.card.visible = on && card;
    for (const p of this.pointers) if (p.line) p.line.visible = on && !this.sim;
    if (on && card) this._placeCard();
  }
  redraw() { if (!this.active) return; for (const p of [this.globePanel, this.legendPanel, this.cityPanel, this.hud, this.card]) if (p.visible) p.redraw(); }
  redrawTime() { if (!this.active) return; for (const p of [this.globePanel, this.legendPanel, this.cityPanel, this.hud]) if (p.visible) p.redraw(); }

  /* ---------------------------------------------------------------- controllers and pointers */
  _setupControllers() {
    const { renderer, scene } = this.app;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new V3(0, 0, 0), new V3(0, 0, -1)]);
    const dotGeo = new THREE.SphereGeometry(0.008, 12, 8);
    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i), grip = renderer.xr.getControllerGrip(i);
      const P = { c, grip, hand: i ? 'left' : 'right', down: false, start: false, end: false, ray: new THREE.Ray(), hit: null, drag: null, gp: null, grab: false, pP: new V3(), qP: new Q() };
      c.addEventListener('connected', e => { P.hand = e.data.handedness || P.hand; P.src = e.data; P.gp = e.data.gamepad || null; P.isHand = !!e.data.hand; });
      c.addEventListener('disconnected', () => { P.src = null; P.gp = null; P.grab = false; this._regrab(); });
      c.addEventListener('selectstart', () => { P.down = true; P.start = true; });
      c.addEventListener('selectend', () => { P.down = false; P.end = true; });
      c.addEventListener('squeezestart', () => { P.grab = true; this._regrab(); });
      c.addEventListener('squeezeend', () => { P.grab = false; this._regrab(); });
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xFFC93C, transparent: true, opacity: 0.9 }));
      line.scale.z = 3; c.add(line); P.line = line;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.09, 12), new THREE.MeshBasicMaterial({ color: 0x1B2A4A }));
      body.rotation.x = Math.PI / 2; body.position.z = 0.05; c.add(body);
      P.dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xFFC93C, depthTest: false })); P.dot.renderOrder = 999; P.dot.visible = false; scene.add(P.dot);
      scene.add(c); scene.add(grip);
      this.pointers.push(P);
    }
    if (this.sim) this._setupMouse();
  }
  _setupMouse() {
    const { renderer, camera } = this.app, el = renderer.domElement, ndc = new THREE.Vector2();
    const P = { hand: 'mouse', down: false, start: false, end: false, ray: new THREE.Ray(), hit: null, drag: null, mouse: true, look: null };
    const upd = e => { const r = el.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.raycaster.setFromCamera(ndc, camera); P.ray.copy(this.raycaster.ray); };
    el.addEventListener('pointermove', e => { upd(e); if (P.look) { this.app.look(e.clientX - P.look[0], e.clientY - P.look[1]); P.look = [e.clientX, e.clientY]; } });
    el.addEventListener('pointerdown', e => { upd(e); P.down = true; P.start = true; P.lookStart = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointerup', () => { P.down = false; P.end = true; P.look = null; });
    el.addEventListener('wheel', e => { if (this.app.S.mode !== 'globe') return; e.preventDefault(); const g = this.app.globe.root; g.scale.setScalar(clamp(g.scale.x * Math.exp(-e.deltaY * 0.001), 0.08, 1.2)); }, { passive: false });
    P.dot = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshBasicMaterial({ color: 0xFFC93C, depthTest: false })); P.dot.renderOrder = 999; P.dot.visible = false;
    this.app.scene.add(P.dot);
    this.pointers.push(P);
    this.mouse = P;
  }
  _panels() {
    const S = this.app.S;
    if (S.closingOpen) return [this.card];
    return S.mode === 'globe' ? [this.globePanel, this.legendPanel] : [this.cityPanel];
  }
  _haptic(P) { try { const h = P.gp && P.gp.hapticActuators && P.gp.hapticActuators[0]; if (h && h.pulse) h.pulse(0.4, 25); } catch (e) { /* none */ } }

  /* ---------------- grabbing the globe (as v3): one grip moves and turns it, two grips resize it */
  _pose(P, p, q) { const o = P.isHand ? P.c : P.grip; o.updateMatrixWorld(true); o.getWorldPosition(p); o.getWorldQuaternion(q); }
  _regrab() {
    const g = this.app.globe.root, gs = this.pointers.filter(P => P.grab && P.src && this.app.S.mode === 'globe');
    this.two = null;
    gs.forEach(P => this._pose(P, P.pP, P.qP));
    if (gs.length >= 2) {
      const [a, b] = gs;
      this.two = { a, b, d0: Math.max(a.pP.distanceTo(b.pP), 0.02), s0: g.scale.x, mid0: a.pP.clone().add(b.pP).multiplyScalar(0.5), pos0: g.position.clone(), v0: b.pP.clone().sub(a.pP).normalize(), q0: g.quaternion.clone() };
    }
  }
  _grabs() {
    const g = this.app.globe.root, gs = this.pointers.filter(P => P.grab && P.src);
    if (!gs.length || this.app.S.mode !== 'globe') return;
    const pa = GT.a, pb = GT.b, qa = GT.qa, qb = GT.qb;
    if (this.two) {
      const T = this.two; this._pose(T.a, pa, qa); this._pose(T.b, pb, qb);
      const s = clamp(T.s0 * Math.max(pa.distanceTo(pb), 0.02) / T.d0, 0.08, 1.2);
      const mid = GT.m.copy(pa).add(pb).multiplyScalar(0.5), dq = GT.dq.setFromUnitVectors(T.v0, GT.v.copy(pb).sub(pa).normalize());
      g.scale.setScalar(s); g.quaternion.copy(dq).multiply(T.q0);
      g.position.copy(T.pos0).sub(T.mid0).multiplyScalar(s / T.s0).applyQuaternion(dq).add(mid);
      return;
    }
    const P = gs[0]; this._pose(P, pa, qa);
    g.position.add(GT.v.copy(pa).sub(P.pP));
    const dq = GT.dq.copy(qa).multiply(GT.qb.copy(P.qP).invert());
    g.position.sub(pa).applyQuaternion(dq).add(pa);
    g.quaternion.premultiply(dq).normalize();
    P.pP.copy(pa); P.qP.copy(qa);
  }

  update(dt) {
    if (!this.active) return;
    const app = this.app, S = app.S, globe = app.globe, xrOn = app.renderer.xr.isPresenting;
    const hovers = new Map();
    let pinHover = false;
    this._grabs();
    for (const P of this.pointers) {
      if (!P.mouse) {
        if (!xrOn || !P.src) { P.dot.visible = false; P.start = P.end = false; continue; }
        P.c.updateMatrixWorld(true);
        P.ray.origin.setFromMatrixPosition(P.c.matrixWorld);
        P.ray.direction.set(0, 0, -1).transformDirection(P.c.matrixWorld);
      }
      /* a slider being dragged keeps the ray, even off the panel */
      if (P.slide) {
        const h = P.slide.panel.hit(P.ray, true);
        if (h) P.slide.b.onDrag(P.slide.panel.sliderP(P.slide.b, h.px), false);
        if (P.end || !P.down) { if (h) P.slide.b.onDrag(P.slide.panel.sliderP(P.slide.b, h.px), true); P.slide = null; }
        P.start = P.end = false;
        if (h) { P.dot.visible = true; P.dot.position.copy(h.point); if (P.line) P.line.scale.z = h.dist; }
        continue;
      }
      let best = null;
      for (const pan of this._panels()) { const h = pan.hit(P.ray); if (h && (!best || h.dist < best.dist)) best = { type: 'panel', ...h }; }
      if (S.mode === 'globe' && !S.closingOpen && globe.root.visible) {
        this.raycaster.set(P.ray.origin, P.ray.direction);
        const d = globe.hitPin(this.raycaster);
        if (d != null && (!best || d < best.dist)) best = { type: 'pin', dist: d };
        const ll = globe.latLonAt(P.ray);
        if (ll && (!best || ll.dist < best.dist - 0.002)) best = { type: 'globe', dist: ll.dist, ll };
      }
      P.hit = best;
      if (best && best.type === 'panel' && best.button && !best.button.disabled) { if (!hovers.has(best.panel)) hovers.set(best.panel, []); hovers.get(best.panel).push(best.button.id); }
      if (best && best.type === 'pin') pinHover = true;
      if (P.start) {
        if (best && best.type === 'panel' && best.button && best.button.slider) { P.slide = { panel: best.panel, b: best.button }; best.button.onDrag(best.panel.sliderP(best.button, best.px), false); this._haptic(P); }
        else if (best && best.type === 'panel') { if (best.button && best.panel.press(best.button)) this._haptic(P); }
        else if (best && best.type === 'pin') { this._haptic(P); app.visit(); }
        else if (best && best.type === 'globe') P.drag = { lat: best.ll.lat, lon: best.ll.lon };
        else if (P.mouse) P.look = P.lookStart;
      }
      if (P.drag && P.down && S.mode === 'globe') {
        const ll = globe.latLonAt(P.ray);
        if (ll) globe.nudge(P.drag.lat - ll.lat, ((P.drag.lon - ll.lon + 540) % 360) - 180);
      }
      if (P.end || !P.down) P.drag = null;
      P.start = P.end = false;
      if (P.line) P.line.scale.z = best ? best.dist : 3;
      P.dot.visible = !!best && (xrOn || P.mouse);
      if (best) P.dot.position.copy(P.ray.origin).addScaledVector(P.ray.direction, best.dist);
      this._sticks(P, dt);
    }
    for (const pan of [this.globePanel, this.legendPanel, this.cityPanel, this.card]) { if (pan.visible) { pan.setHover(hovers.get(pan) || []); pan.tick(dt); } }
    globe.pinHover = pinHover;
    if (this.mouse) app.renderer.domElement.style.cursor = pinHover || (this.mouse.hit && this.mouse.hit.button) ? 'pointer' : 'grab';
    this._follow(dt);
  }
  _sticks(P, dt) {
    if (!P.gp || P.gp.axes.length < 4) return;
    const ax = P.gp.axes[2], ay = P.gp.axes[3], S = this.app.S;
    if (S.mode === 'globe' && P.hand === 'right') {
      if (Math.abs(ax) > 0.15) this.app.globe.nudge(0, ax * dt * 70);
      if (Math.abs(ay) > 0.15 && !this.two) { const g = this.app.globe.root; g.scale.setScalar(clamp(g.scale.x * Math.exp(-ay * dt * 1.1), 0.08, 1.2)); }
    }
    if (S.mode === 'city') {      // snap turn, 30 degrees, no smooth rotation
      if (Math.abs(ax) > 0.75 && !P.snapped) { P.snapped = true; this.app.snapTurn(ax > 0 ? -30 : 30); }
      if (Math.abs(ax) < 0.3) P.snapped = false;
    }
  }
  /* the label strip follows your view lazily, a little above the centre */
  _follow(dt) {
    const cam = this.app.camera, { h, q, fwd, up, target } = FT;
    cam.getWorldPosition(h); cam.getWorldQuaternion(q);
    fwd.set(0, 0, -1).applyQuaternion(q); up.set(0, 1, 0).applyQuaternion(q);
    target.copy(h).addScaledVector(fwd, 1.45).addScaledVector(up, 0.62);
    if (!this.hudReady) { this.hudPos.copy(target); this.hudReady = true; }
    this.hudPos.lerp(target, 1 - Math.exp(-dt * 5));
    this.hud.mesh.position.copy(this.hudPos); this.hud.mesh.lookAt(h);
  }
  _placeCard() {
    const cam = this.app.camera, h = new V3(), q = new Q();
    cam.updateMatrixWorld(true); cam.getWorldPosition(h); cam.getWorldQuaternion(q);
    const fwd = new V3(0, 0, -1).applyQuaternion(q); fwd.y = 0; if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
    this.card.mesh.position.copy(h).addScaledVector(fwd, 1.05).add(new V3(0, -0.12, 0));
    this.card.mesh.lookAt(h.x, h.y - 0.12, h.z);
  }

  /* ---------------------------------------------------------------- painters */
  _timeRow(p, g, x0, y, w, h, withPlay) {
    const app = this.app, S = app.S, d = app.data, end = d.axis.end, t = app.shownT();
    const aw = 84, pw = withPlay ? 130 : 0;
    p.button('earlier', x0, y + 20, aw, h - 20, { label: '◀', size: 34, fill: COL.sun, disabled: S.t <= 0 }, () => app.stepTime(-1));
    p.button('later', x0 + w - aw - (pw ? pw + 10 : 0), y + 20, aw, h - 20, { label: '▶', size: 34, fill: COL.sun, disabled: S.t >= end }, () => app.stepTime(1));
    if (pw) p.button('play', x0 + w - pw, y + 20, pw, h - 20, { label: tx(S.playing ? U.pause : U.play), size: 26, pressed: S.playing, fillOn: COL.blue }, () => app.togglePlay());
    const sx = x0 + aw + 34, sw = w - 2 * aw - 68 - (pw ? pw + 10 : 0);
    text(g, timeLabel(t), sx + sw / 2, y + 8, 30, { align: 'center', weight: 900, maxW: sw });
    const marks = d.marks.map(m => [app.t2p(m.t, end), markLabel(m)]);
    p.slider('time', sx, y + 26, sw, h - 50, app.t2p(t, end), { marks, markSize: 19 }, (q, done) => {
      const nt = app.p2t(q, end);
      if (S.mode === 'city' && !done) app.previewTime(nt); else if (S.mode === 'city') app.setTime(nt); else { app.stopPlay(); app.setTime(nt); }
    });
  }
  _pathRow(p, g, x0, y, w, h) {
    const app = this.app, ps = app.data.pathways, gap = 8;
    if (!ps.length) { text(g, tx(U.noData), x0 + w / 2, y + h / 2, 30, { align: 'center' }); return; }
    const bw = (w - gap * (ps.length - 1)) / ps.length;
    ps.forEach((pw, k) => {
      p.button('path:' + pw.id, x0 + k * (bw + gap), y, bw, h, {
        label: pathLabel(pw), sub: pathSub(pw), size: 22, pressed: app.S.pathway === pw.id, fillOn: pathColor(pw, k), round: 18,
      }, () => app.setPathway(pw.id));
      rr(g, x0 + k * (bw + gap) + 10, y + 8, bw - 20, 6, 3); g.fillStyle = pathColor(pw, k); g.fill();
    });
  }
  paintGlobe(p, g) {
    const app = this.app, W = p.W, H = p.H, S = app.S;
    rr(g, 4, 4, W - 8, H - 8, 34); g.fillStyle = COL.paper; g.fill(); g.lineWidth = 7; g.strokeStyle = COL.ink; g.stroke();
    const L = app.layerNames(), lw = 160, icons = { surface: 'globe', temp: 'temp_c', rain: 'rain_mm_yr', plants: 'vegetation', sea: 'sea_level_m' };
    L.forEach((name, k) => p.button('layer:' + name, 22 + k * (lw + 8), 18, lw, 64, { label: tx(U['l_' + name]), icon: icons[name], iconSize: 36, size: 23, pressed: S.layer === name, round: 32 }, () => app.setLayer(name)));
    p.button('lang', W - 22 - 118, 18, 118, 64, { label: tx(U.lang), size: 28, round: 32 }, () => app.toggleLang());
    text(g, tx(U.choosePath), 26, 104, 23, { color: COL.ink2 });
    this._pathRow(p, g, 22, 120, W - 44, 104);
    this._timeRow(p, g, 22, 248, W - 44, 150, true);
    const v = app.vals();
    text(g, `${tx(U.bristol)}: ${fmtValue('temp_c', v.temp_c)} · ${fmt(U.seaNow, { v: fmtValue('sea_level_m', v.sea_level_m) })}`, 26, 432, 25, { maxW: W - 52 });
    p.button('visit', W - 22 - 400, 466, 400, 104, { label: tx(U.visit), icon: 'pin', iconSize: 56, size: 36, fill: COL.blue, color: '#fff' }, () => app.visit());
    p.button('reset', 22, 466, 230, 104, { label: tx(U.resetGlobe), size: 26 }, () => app.resetGlobe());
    para(g, tx(U.pinHintXR), 270, 480, 300, 21, 27, { color: COL.ink2, maxLines: 3 });
  }
  paintLegend(p, g) {
    const app = this.app, info = app.globe.legendInfo, W = p.W, H = p.H, S = app.S;
    rr(g, 4, 4, W - 8, H - 8, 28); g.fillStyle = COL.paper; g.fill(); g.lineWidth = 6; g.strokeStyle = COL.ink; g.stroke();
    if (!info) return;
    text(g, info.title, 28, 44, 32, { weight: 900, maxW: W - 56 });
    let y = para(g, info.unit, 28, 70, W - 56, 19, 24, { color: COL.ink2, maxLines: 3 }) + 10;
    if (info.missing) { text(g, tx(U.noData), 28, y + 14, 26, { color: COL.demo }); y += 40; }
    if (info.gradient) {
      const x0 = 28, w = W - 56, gr = g.createLinearGradient(x0, 0, x0 + w, 0);
      info.gradient.forEach(([q, c]) => gr.addColorStop(q, c));
      rr(g, x0, y, w, 34, 8); g.fillStyle = gr; g.fill(); g.lineWidth = 4; g.strokeStyle = COL.ink; g.stroke();
      for (const [q, l] of info.ticks) { const x = x0 + q * w; g.fillStyle = COL.ink; g.fillRect(x - 1.5, y + 34, 3, 9); text(g, l, x, y + 58, 20, { align: 'center', weight: 700 }); }
      y += 84;
    }
    if (info.cats) {
      info.cats.forEach(([c, label], k) => { rr(g, 28, y + k * 36, 28, 28, 7); g.fillStyle = c; g.fill(); g.lineWidth = 3; g.strokeStyle = COL.ink; g.stroke(); text(g, label, 66, y + k * 36 + 15, 21, { weight: 700, maxW: W - 90 }); });
      y += info.cats.length * 36 + 6;
    }
    text(g, fmt(U.seaNow, { v: fmtValue('sea_level_m', info.sea) }) + (S.seaDemo != null ? ' *' : ''), 28, y + 14, 23, { weight: 900, maxW: W - 56 });
    y += 36;
    if (info.name === 'sea') {
      text(g, tx(S.seaDemo != null ? U.seaDemoOn : U.seaDemo), 28, y + 10, 20, { color: COL.ink2, weight: 800, maxW: W - 56 });
      const q = ((S.seaDemo ?? info.sea) + 130) / 200;
      p.slider('seademo', 46, y + 24, W - 92, 50, clamp(q, 0, 1), { fill: '#5DC6E0', marks: [[0, '−130 m'], [0.65, '0'], [1, '+70 m']], markSize: 17 }, qq => app.setSeaDemo(Math.round(qq * 200 - 130)));
      if (S.seaDemo != null) p.button('seareset', 28, H - 70, W - 56, 52, { label: tx(U.seaDemoOff), size: 22 }, () => app.setSeaDemo(null));
    } else if (info.fixed && info.name !== 'surface') para(g, tx(U.fixedNote), 28, y, W - 56, 20, 26, { color: COL.demo, weight: 800, maxLines: 2 });
  }
  paintCity(p, g) {
    const app = this.app, W = p.W, S = app.S;
    rr(g, 4, 4, W - 8, p.H - 8, 30); g.fillStyle = COL.paper; g.fill(); g.lineWidth = 7; g.strokeStyle = COL.ink; g.stroke();
    this._pathRow(p, g, 18, 16, W - 36, 96);
    this._timeRow(p, g, 18, 124, W - 36, 150, false);
    const y = 318, h = 98;
    p.button('back', 18, y, 330, h, { label: tx(U.back), icon: 'globe', iconSize: 52, size: 30 }, () => app.back());
    p.button('seated', 360, y, 250, h, { label: tx(U.seated), size: 28, pressed: S.seated, fillOn: COL.sun, colorOn: COL.ink }, () => app.toggleSeated());
    p.button('compare', 622, y, 214, h, { label: tx(U.summary), size: 30, disabled: !app.canCompare() }, () => app.openClosing());
    p.button('lang', W - 18 - 150, y, 150, h, { label: tx(U.lang), size: 30 }, () => app.toggleLang());
  }
  paintHud(p, g) {
    const app = this.app, W = p.W, d = app.data, S = app.S, pw = d.pathway(S.pathway);
    const chips = [{ t: sourceLabel(d), demo: d.placeholder, src: !d.placeholder }, { t: tx(U.notPrediction) },
      { t: `${timeLabel(app.shownT())} · ${pw ? pathLabel(pw) : tx(U.noData)}`, sun: true }, { t: tx(U.average), small: true }];
    let x = 8, y = 8;
    for (const c of chips) {
      const sz = c.small || c.src ? 24 : 30;
      g.font = `900 ${sz}px Nunito, "Noto Sans SC", sans-serif`;
      const w = Math.min(W - 16, g.measureText(c.t).width + 40), h = 64;
      if (x + w > W - 8) { x = 8; y += h + 12; }
      rr(g, x, y, w, h, 32);
      if (c.demo) { g.fillStyle = COL.demo; g.fill(); } else { g.fillStyle = c.sun ? COL.sun : c.src ? '#DDEBFA' : COL.paper; g.fill(); }
      g.lineWidth = 5; g.strokeStyle = c.demo ? '#7A0F1F' : COL.ink; g.stroke();
      text(g, c.t, x + w / 2, y + h / 2 + 1, sz, { align: 'center', color: c.demo ? '#fff' : COL.ink, weight: 900, maxW: w - 24 });
      x += w + 10;
    }
  }
  paintCard(p, g) {
    const app = this.app, W = p.W, H = p.H, d = app.data, c = app.closingInfo();
    rr(g, 6, 6, W - 12, H - 12, 40); g.fillStyle = COL.paper; g.fill(); g.lineWidth = 9; g.strokeStyle = COL.ink; g.stroke();
    text(g, tx(U.c_title), 44, 64, 50, { weight: 900, maxW: W - 88 });
    if (!c) return;
    text(g, fmt(U.c_intro, { when: timeLabel(c.t) }), 44, 118, 27, { color: COL.ink2, weight: 700, maxW: W - 88 });
    const cw = (W - 88 - 24) / 2;
    [c.low, c.high].forEach((s, k) => {
      const x = 44 + k * (cw + 24), y = 150, h = 250, pi = d.pathways.indexOf(s.p);
      rr(g, x, y, cw, h, 28); g.fillStyle = COL.paper2; g.fill(); g.lineWidth = 8; g.strokeStyle = pathColor(s.p, pi); g.stroke();
      drawIcon(g, pathIcon(s.p, pi), x + 48, y + 50, 62);
      text(g, pathLabel(s.p), x + 90, y + 50, 32, { weight: 900, maxW: cw - 110 });
      text(g, tx(U.c_sea), x + 26, y + 130, 26, { color: COL.ink2, weight: 700 });
      text(g, fmtValue('sea_level_m', s.v.sea_level_m), x + cw - 26, y + 130, 40, { align: 'right', weight: 900 });
      text(g, tx(U.c_temp), x + 26, y + 200, 26, { color: COL.ink2, weight: 700 });
      text(g, fmtValue('temp_c', s.v.temp_c), x + cw - 26, y + 200, 40, { align: 'right', weight: 900 });
    });
    const yEnd = para(g, tx(U.c_hope), 44, 430, W - 88, 28, 40, { weight: 700, maxLines: 5 });
    text(g, sourceLabel(d), 44, yEnd + 22, 22, { color: d.placeholder ? COL.demo : COL.ink2, weight: 900, maxW: W - 88 });
    p.button('closeCard', W / 2 - 200, H - 112, 400, 88, { label: tx(U.c_close), size: 34, fill: COL.blue, color: '#fff' }, () => app.closeClosing());
  }
}
const FT = { h: new V3(), q: new Q(), fwd: new V3(), up: new V3(), target: new V3() };
const GT = { a: new V3(), b: new V3(), qa: new Q(), qb: new Q(), m: new V3(), v: new V3(), dq: new Q() };
