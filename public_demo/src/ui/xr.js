/* VR controls: the WebXR session, controller rays (trigger or pinch to press), world-space panels for the
   globe screen and the Bristol lectern, the labels that follow your view, and the closing card.
   With ?xrsim=1 on a desktop the mouse stands in for the controller ray, so the VR panels can be tested
   without a headset (left button = trigger, drag on empty space = look around). */
import * as THREE from 'three';
import { Panel, COL, text, para, rr } from './panel.js';
import { drawIcon } from './icons.js';
import { U, tx, fmt, LANG, stopLabel, pathLabel, yearNote, sourceLabel } from '../i18n.js';
import { fmtValue } from '../format.js';

const V3 = THREE.Vector3;
const PATH_COL = { ssp126: '#2FB65A', ssp245: '#E9A92C', ssp370: '#F07A3A', ssp585: '#D93B4B' };
export const pathColor = (p, k = 0) => PATH_COL[p && p.id] || ['#2FB65A', '#E9A92C', '#F07A3A', '#D93B4B', '#8E5BD8'][k % 5];
export const pathIcon = (p, k = 0) => (p && p.icon) || ['leaf', 'road', 'factory', 'smoke'][Math.min(k, 3)];

const FT = { h: new V3(), q: new THREE.Quaternion(), fwd: new V3(), up: new V3(), target: new V3() };   // reused every frame

export class XRUI {
  constructor(app, { sim = false } = {}) {
    this.app = app; this.sim = sim;
    this.pointers = [];
    this.globePanel = new Panel({ px: [1024, 576], width: 1.25, name: 'globePanel' });
    this.globePanel.paint = (p, g) => this.paintGlobe(p, g);
    this.legendPanel = new Panel({ px: [512, 420], width: 0.36, name: 'legend' });
    this.legendPanel.paint = (p, g) => this.paintLegend(p, g);
    this.cityPanel = new Panel({ px: [1024, 420], width: 1.0, name: 'cityPanel' });
    this.cityPanel.paint = (p, g) => this.paintCity(p, g);
    this.hud = new Panel({ px: [1024, 176], width: 0.8, name: 'hud', depthTest: false });
    this.hud.paint = (p, g) => this.paintHud(p, g); this.hud.mesh.renderOrder = 950;
    this.card = new Panel({ px: [1024, 760], width: 1.0, name: 'card', depthTest: false });
    this.card.paint = (p, g) => this.paintCard(p, g); this.card.mesh.renderOrder = 940;
    for (const p of [this.globePanel, this.legendPanel, this.cityPanel]) app.content.add(p.mesh);
    app.scene.add(this.hud.mesh); app.scene.add(this.card.mesh);
    this.globePanel.mesh.position.set(0, 0.8, -0.56); this.globePanel.mesh.rotation.x = -0.78;
    this.legendPanel.mesh.position.set(0.6, 1.36, -0.74); this.legendPanel.mesh.rotation.y = -0.5;
    this.cityPanel.mesh.position.set(0, 0.95, -0.66); this.cityPanel.mesh.rotation.x = -0.8;
    this.hudPos = new V3(); this.hudReady = false;
    this.raycaster = new THREE.Raycaster();
    this.active = false;
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
  setActive(on) {
    this.active = on; this.hudReady = false;
    this.syncVisibility(); this.redraw();
  }
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
  redraw() {
    if (!this.active) return;
    for (const p of [this.globePanel, this.legendPanel, this.cityPanel, this.hud, this.card]) if (p.visible) p.redraw();
  }

  /* ---------------------------------------------------------------- controllers and pointers */
  _setupControllers() {
    const { renderer, scene } = this.app;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new V3(0, 0, 0), new V3(0, 0, -1)]);
    const dotGeo = new THREE.SphereGeometry(0.008, 12, 8);
    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i);
      const P = { c, hand: i ? 'left' : 'right', down: false, start: false, end: false, ray: new THREE.Ray(), hit: null, drag: null, gp: null };
      c.addEventListener('connected', e => { P.hand = e.data.handedness || P.hand; P.src = e.data; P.gp = e.data.gamepad || null; });
      c.addEventListener('disconnected', () => { P.src = null; P.gp = null; });
      c.addEventListener('selectstart', () => { P.down = true; P.start = true; });
      c.addEventListener('selectend', () => { P.down = false; P.end = true; });
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xFFC93C, transparent: true, opacity: 0.9 }));
      line.scale.z = 3; c.add(line); P.line = line;
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.09, 12), new THREE.MeshBasicMaterial({ color: 0x1B2A4A }));
      body.rotation.x = Math.PI / 2; body.position.z = 0.05; c.add(body);
      P.dot = new THREE.Mesh(dotGeo, new THREE.MeshBasicMaterial({ color: 0xFFC93C, depthTest: false })); P.dot.renderOrder = 999; P.dot.visible = false; scene.add(P.dot);
      scene.add(c);
      this.pointers.push(P);
    }
    if (this.sim) this._setupMouse();
  }
  _setupMouse() {
    const { renderer, camera } = this.app, el = renderer.domElement, ndc = new THREE.Vector2();
    const P = { hand: 'mouse', down: false, start: false, end: false, ray: new THREE.Ray(), hit: null, drag: null, mouse: true, look: null };
    const upd = e => { const r = el.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); this.raycaster.setFromCamera(ndc, camera); P.ray.copy(this.raycaster.ray); P.px = [e.clientX, e.clientY]; };
    el.addEventListener('pointermove', e => { upd(e); if (P.look) { this.app.look(e.clientX - P.look[0], e.clientY - P.look[1]); P.look = [e.clientX, e.clientY]; } });
    el.addEventListener('pointerdown', e => { upd(e); P.down = true; P.start = true; P.lookStart = [e.clientX, e.clientY]; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointerup', () => { P.down = false; P.end = true; P.look = null; });
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

  update(dt) {
    if (!this.active) return;
    const app = this.app, S = app.S, globe = app.globe, xrOn = app.renderer.xr.isPresenting;
    const hovers = new Map();
    let pinHover = false;
    for (const P of this.pointers) {
      if (!P.mouse) {
        if (!xrOn || !P.src) { P.dot.visible = false; P.start = P.end = false; continue; }
        P.c.updateMatrixWorld(true);
        P.ray.origin.setFromMatrixPosition(P.c.matrixWorld);
        P.ray.direction.set(0, 0, -1).transformDirection(P.c.matrixWorld);
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
        if (best && best.type === 'panel') { if (best.button && best.panel.press(best.button)) this._haptic(P); }
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
      const len = best ? best.dist : 3;
      if (P.line) P.line.scale.z = len;
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
      if (Math.abs(ay) > 0.15) this.app.globe.nudge(ay * dt * 50, 0);
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
    const cam = this.app.camera, h = new V3(), q = new THREE.Quaternion();
    cam.updateMatrixWorld(true); cam.getWorldPosition(h); cam.getWorldQuaternion(q);
    const fwd = new V3(0, 0, -1).applyQuaternion(q); fwd.y = 0; if (fwd.lengthSq() < 1e-4) fwd.set(0, 0, -1); fwd.normalize();
    this.card.mesh.position.copy(h).addScaledVector(fwd, 1.05).add(new V3(0, -0.12, 0));
    this.card.mesh.lookAt(h.x, h.y - 0.12, h.z);
  }

  /* ---------------------------------------------------------------- painters */
  _stopsRow(p, g, x0, y, w, h) {
    const app = this.app, stops = app.data.stops, cur = app.stopIndex();
    const aw = 84, gap = 6;
    p.button('earlier', x0, y, aw, h, { label: '◀', sub: tx(U.earlier), size: 34, fill: COL.sun, disabled: cur <= 0 }, () => app.stepStop(-1));
    p.button('later', x0 + w - aw, y, aw, h, { label: '▶', sub: tx(U.later), size: 34, fill: COL.sun, disabled: cur >= stops.length - 1 }, () => app.stepStop(1));
    const ax = x0 + aw + 10, avail = w - 2 * aw - 20, minW = 70;
    const fit = Math.max(1, Math.floor((avail + gap) / (minW + gap))), n = Math.min(stops.length, fit);
    let first = 0;
    if (stops.length > n) first = Math.max(0, Math.min(stops.length - n, cur - Math.floor(n / 2)));
    const bw = (avail - gap * (n - 1)) / n;
    g.fillStyle = 'rgba(27,42,74,0.25)'; rr(g, ax + 10, y + h / 2 - 3, avail - 20, 6, 3); g.fill();
    for (let k = 0; k < n; k++) {
      const s = stops[first + k], on = first + k === cur, past = s.kind === 'past';
      p.button('stop:' + s.id, ax + k * (bw + gap), y, bw, h, {
        label: stopLabel(s), sub: s.kind === 'now' ? '' : yearNote(s), size: 24, pressed: on, fillOn: COL.sun, colorOn: COL.ink,
        fill: past ? '#D4EAF7' : COL.paper2, round: 18,
      }, () => app.setStop(s.id));
    }
  }
  _pathRow(p, g, x0, y, w, h) {
    const app = this.app, ps = app.data.pathways, shared = app.data.sharedStop(app.S.stop), gap = 12;
    if (!ps.length) { text(g, tx(U.noData), x0 + w / 2, y + h / 2, 30, { align: 'center' }); return; }
    const bw = (w - gap * (ps.length - 1)) / ps.length;
    ps.forEach((pw, k) => {
      p.button('path:' + pw.id, x0 + k * (bw + gap), y, bw, h, {
        label: pathLabel(pw), sub: pw.ssp, icon: pathIcon(pw, k), size: 27, pressed: app.S.pathway === pw.id, fillOn: pathColor(pw, k),
        fill: shared ? '#E4E1D6' : COL.paper2,
      }, () => app.setPathway(pw.id));
    });
    if (shared) {
      const s = tx(app.data.stop(app.S.stop)?.kind === 'now' ? U.nowAll : U.pastAll);
      g.font = `800 24px ${'Nunito, "Noto Sans SC", sans-serif'}`;
      const tw = g.measureText(s).width + 36;
      rr(g, x0 + w / 2 - tw / 2, y + h - 18, tw, 38, 19); g.fillStyle = COL.ink; g.fill();
      text(g, s, x0 + w / 2, y + h + 1, 24, { align: 'center', color: '#fff' });
    }
  }
  paintGlobe(p, g) {
    const app = this.app, W = p.W, H = p.H, S = app.S;
    rr(g, 4, 4, W - 8, H - 8, 34); g.fillStyle = COL.paper; g.fill(); g.lineWidth = 7; g.strokeStyle = COL.ink; g.stroke();
    /* layers + language */
    const L = app.layerNames(), lw = 164;
    L.forEach((name, k) => p.button('layer:' + name, 22 + k * (lw + 8), 20, lw, 66, { label: tx(U['l_' + name]), icon: name, iconSize: 38, size: 23, pressed: S.layer === name, round: 33 }, () => app.setLayer(name)));
    p.button('lang', W - 22 - 118, 20, 118, 66, { label: tx(U.lang), size: 28, round: 33 }, () => app.toggleLang());
    text(g, tx(U.choosePath), 26, 112, 24, { color: COL.ink2 });
    this._pathRow(p, g, 22, 128, W - 44, 112);
    text(g, tx(U.chooseTime), 26, 270, 24, { color: COL.ink2 });
    this._stopsRow(p, g, 22, 286, W - 44, 112);
    /* Bristol now, for the chosen layer */
    const v = app.vals(), name = S.layer;
    const line = `${tx(U.bristol)}: ${fmtValue(name, v[name])}`;
    text(g, line, 26, 440, 30, { maxW: 420 });
    p.button('visit', W - 22 - 440, 466, 440, 88, { label: tx(U.visit), icon: 'pin', iconSize: 56, size: 36, fill: COL.blue, color: '#fff' }, () => app.visit());
    para(g, tx(U.pinHintXR), 26, 470, 500, 22, 28, { color: COL.ink2, maxLines: 3 });
  }
  paintLegend(p, g) {
    const app = this.app, info = app.globe.legendInfo, W = p.W, H = p.H;
    rr(g, 4, 4, W - 8, H - 8, 28); g.fillStyle = COL.paper; g.fill(); g.lineWidth = 6; g.strokeStyle = COL.ink; g.stroke();
    if (!info) return;
    drawIcon(g, info.name, 50, 52, 54);
    text(g, info.title, 88, 44, 34, { maxW: W - 110 });
    text(g, info.unit, 88, 80, 21, { color: COL.ink2, weight: 700, maxW: W - 110 });
    let y = 116;
    if (info.missing) { text(g, tx(U.noData), 28, y + 20, 28, { color: COL.demo }); y += 50; }
    if (info.cats) {
      info.cats.forEach(([c, label], k) => { rr(g, 28, y + k * 40, 30, 30, 8); g.fillStyle = c; g.fill(); g.lineWidth = 3; g.strokeStyle = COL.ink; g.stroke(); text(g, label, 70, y + k * 40 + 16, 24, { weight: 700, maxW: W - 90 }); });
    } else if (info.bands) {
      const x0 = 28, w = W - 56, n = info.bands.length, bw = w / n;
      info.bands.forEach(([c], k) => { g.fillStyle = c || '#B9DFA8'; g.fillRect(x0 + k * bw, y, bw + 0.5, 40); });
      rr(g, x0, y, w, 40, 8); g.lineWidth = 4; g.strokeStyle = COL.ink; g.stroke();
      for (const t of info.ticks) {
        const k = info.bands.findIndex(b => b[1] === t); if (k < 0) continue;
        const x = x0 + k * bw; g.fillStyle = COL.ink; g.fillRect(x - 1.5, y + 40, 3, 10);
        text(g, String(t), x, y + 66, 21, { align: 'center', weight: 700 });
      }
      text(g, info.sym, x0 + w, y + 100, 21, { align: 'right', color: COL.ink2, weight: 700 });
    }
    if (info.shelf) para(g, tx(U.shelf), 28, H - 92, W - 56, 19, 24, { color: COL.ink2, maxLines: 3 });
  }
  paintCity(p, g) {
    const app = this.app, W = p.W, S = app.S;
    rr(g, 4, 4, W - 8, p.H - 8, 30); g.fillStyle = COL.paper; g.fill(); g.lineWidth = 7; g.strokeStyle = COL.ink; g.stroke();
    this._pathRow(p, g, 20, 18, W - 40, 104);
    this._stopsRow(p, g, 20, 148, W - 40, 112);
    const y = 296, h = 94;
    p.button('back', 20, y, 330, h, { label: tx(U.back), icon: 'globe', iconSize: 52, size: 30 }, () => app.back());
    p.button('seated', 362, y, 250, h, { label: tx(U.seated), size: 28, pressed: S.seated, fillOn: COL.sun, colorOn: COL.ink }, () => app.toggleSeated());
    const canCompare = app.canCompare();
    p.button('compare', 624, y, 210, h, { label: tx(U.summary), size: 30, disabled: !canCompare }, () => app.openClosing());
    p.button('lang', W - 20 - 150, y, 150, h, { label: tx(U.lang), size: 30 }, () => app.toggleLang());
  }
  paintHud(p, g) {
    const app = this.app, W = p.W, d = app.data, S = app.S;
    const chips = [];
    if (d.placeholder) chips.push({ t: sourceLabel(d.sourceLabel), demo: true });
    chips.push({ t: tx(U.notPrediction) });
    const st = d.stop(S.stop), pw = d.pathway(S.pathway);
    chips.push({ t: `${st ? stopLabel(st) : tx(U.noData)} · ${d.sharedStop(S.stop) ? tx(U.allPaths) : (pw ? pathLabel(pw) : tx(U.noData))}`, sun: true });
    chips.push({ t: tx(U.average), small: true });
    let x = 8, y = 8;
    for (const c of chips) {
      const sz = c.small ? 24 : 30;
      g.font = `900 ${sz}px Nunito, "Noto Sans SC", sans-serif`;
      const w = Math.min(W - 16, g.measureText(c.t).width + 40), h = 64;
      if (x + w > W - 8) { x = 8; y += h + 12; }
      rr(g, x, y, w, h, 32);
      if (c.demo) { g.fillStyle = COL.demo; g.fill(); g.save(); g.clip(); g.fillStyle = '#C9243C'; for (let k = -10; k < 40; k++) { g.beginPath(); g.moveTo(x + k * 28, y + h); g.lineTo(x + k * 28 + 14, y + h); g.lineTo(x + k * 28 + 14 + h, y); g.lineTo(x + k * 28 + h, y); g.fill(); } g.restore(); rr(g, x, y, w, h, 32); }
      else { g.fillStyle = c.sun ? COL.sun : COL.paper; g.fill(); }
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
    text(g, fmt(U.c_intro, { stop: stopLabel(c.stop) }), 44, 118, 27, { color: COL.ink2, weight: 700, maxW: W - 88 });
    const cw = (W - 88 - 24) / 2;
    [c.low, c.high].forEach((s, k) => {
      const x = 44 + k * (cw + 24), y = 150, h = 250;
      rr(g, x, y, cw, h, 28); g.fillStyle = COL.paper2; g.fill(); g.lineWidth = k ? 6 : 9; g.strokeStyle = k ? COL.ink : pathColor(s.p, 0); g.stroke();
      drawIcon(g, pathIcon(s.p, k ? 3 : 0), x + 48, y + 50, 62);
      text(g, pathLabel(s.p), x + 90, y + 50, 32, { weight: 900, maxW: cw - 110 });
      text(g, tx(U.c_sea), x + 26, y + 130, 26, { color: COL.ink2, weight: 700 });
      text(g, fmtValue('sea_level_m', s.v.sea_level_m), x + cw - 26, y + 130, 40, { align: 'right', weight: 900 });
      text(g, tx(U.c_temp), x + 26, y + 200, 26, { color: COL.ink2, weight: 700 });
      text(g, fmtValue('temp_c', s.v.temp_c), x + cw - 26, y + 200, 40, { align: 'right', weight: 900 });
    });
    const yEnd = para(g, tx(U.c_hope), 44, 430, W - 88, 28, 40, { weight: 700, maxLines: 5 });
    if (d.placeholder) text(g, tx(U.demoDataLong), 44, yEnd + 22, 22, { color: COL.demo, weight: 900, maxW: W - 88 });
    p.button('closeCard', W / 2 - 200, H - 112, 400, 88, { label: tx(U.c_close), size: 34, fill: COL.blue, color: '#fff' }, () => app.closeClosing());
  }
}
