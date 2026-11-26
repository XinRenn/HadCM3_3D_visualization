/* World-space panels for VR: a canvas drawn in 2D, shown on a plane, with buttons that a controller ray
   can hit. A panel is redrawn by its painter function, which places the buttons as it draws them:
     panel.paint = (p, g) => { p.button('id', x, y, w, h, { label, ... }, onPress); ... }
   Sizes are in canvas pixels; panel.ppm says how many pixels make one metre, so a 6 cm button at 1 m
   is 0.06 * ppm pixels. */
import * as THREE from 'three';
import { drawIcon, INK } from './icons.js';

export const FONT = 'Nunito, "Noto Sans SC", system-ui, -apple-system, "PingFang SC", sans-serif';
export const COL = { ink: INK, ink2: '#44557A', paper: '#FFFDF5', paper2: '#F1EEE2', sun: '#FFC93C', blue: '#2D8CFF', demo: '#E8364F' };

export function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); }
export function wrapLines(g, text, maxW) {
  const cjk = /[　-鿿＀-￯]/.test(text), parts = cjk ? Array.from(text) : String(text).split(' '), out = [];
  let line = '';
  for (const p of parts) {
    const t = line + (cjk || !line ? '' : ' ') + p;
    if (g.measureText(t).width > maxW && line) { out.push(line); line = p; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
export function text(g, s, x, y, size, o = {}) {
  g.font = `${o.weight || 800} ${size}px ${FONT}`; g.fillStyle = o.color || COL.ink; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'middle';
  if (o.maxW) { let sz = size; while (sz > 10 && g.measureText(s).width > o.maxW) { sz -= 1; g.font = `${o.weight || 800} ${sz}px ${FONT}`; } }
  g.fillText(s, x, y);
}
export function para(g, s, x, y, maxW, size, lh, o = {}) {
  g.font = `${o.weight || 700} ${size}px ${FONT}`; g.fillStyle = o.color || COL.ink; g.textAlign = o.align || 'left'; g.textBaseline = 'top';
  const ls = wrapLines(g, s, maxW).slice(0, o.maxLines || 99);
  ls.forEach((l, i) => g.fillText(l, x, y + i * lh));
  return y + ls.length * lh;
}

export class Panel {
  constructor({ px = [1024, 512], width = 1.0, name = 'panel', depthTest = true }) {
    this.name = name; this.W = px[0]; this.H = px[1]; this.width = width; this.height = width * this.H / this.W; this.ppm = this.W / width;
    this.canvas = document.createElement('canvas'); this.canvas.width = this.W; this.canvas.height = this.H;
    this.g = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas); this.tex.colorSpace = THREE.SRGBColorSpace; this.tex.anisotropy = 4;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(this.width, this.height),
      new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, depthTest, depthWrite: depthTest, toneMapped: false }));
    this.mesh.userData.panel = this; this.mesh.name = name;
    this.buttons = []; this.hover = new Set(); this.flash = null; this.flashT = 0; this.paint = null; this.sig = '';
  }
  get visible() { return this.mesh.visible; }
  set visible(v) { this.mesh.visible = v; }
  redraw() {
    if (!this.paint) return;
    this.buttons = [];
    this.g.clearRect(0, 0, this.W, this.H);
    this.paint(this, this.g);
    this.tex.needsUpdate = true;
  }
  /* a chunky cartoon button; o: { label, sub, icon, fill, color, pressed, disabled, size, round } */
  button(id, x, y, w, h, o, onPress) {
    const g = this.g, hov = this.hover.has(id) && !o.disabled, fl = this.flash === id;
    const r = o.round ?? Math.min(22, h / 3), down = o.pressed || fl;
    g.save();
    if (o.disabled) g.globalAlpha = 0.42;
    if (!down) { rr(g, x, y + 6, w, h, r); g.fillStyle = 'rgba(27,42,74,0.35)'; g.fill(); }
    const oy = down ? 4 : 0;
    rr(g, x, y + oy, w, h, r); g.fillStyle = o.pressed ? (o.fillOn || COL.ink) : (hov ? '#FFFFFF' : (o.fill || COL.paper2)); g.fill();
    g.lineWidth = hov ? 7 : 5; g.strokeStyle = hov ? COL.sun : COL.ink; g.stroke();
    if (hov) { rr(g, x + 4, y + oy + 4, w - 8, h - 8, r - 3); g.lineWidth = 2.5; g.strokeStyle = COL.ink; g.stroke(); }
    const fg = o.pressed ? (o.colorOn || '#fff') : (o.color || COL.ink), sz = o.size || 30;
    let ax = x + w / 2, aw = w - 16, align = 'center';
    if (o.icon) {
      const is = o.iconSize || Math.min(h * 0.62, 64);
      if (o.label) { drawIcon(g, o.icon, x + 12 + is / 2, y + oy + h / 2, is); ax = x + 22 + is; aw = w - (22 + is) - 8; align = 'left'; }
      else drawIcon(g, o.icon, x + w / 2, y + oy + h / 2, is);
    }
    if (o.label) this._label(o.label, o.sub, ax, aw, align, y + oy, h, sz, fg);
    g.restore();
    this.buttons.push({ id, x, y, w, h, disabled: !!o.disabled, onPress });
  }
  /* a label (up to two lines) and an optional smaller sub-label, centred in the button's height;
     long labels wrap first and only then get smaller */
  _label(label, sub, ax, aw, align, y, h, sz, color) {
    const g = this.g, set = (s, wt) => { g.font = `${wt} ${s}px ${FONT}`; };
    let s = sz, lines;
    for (;;) { set(s, 800); lines = wrapLines(g, label, aw); if ((lines.length <= 2 && lines.every(l => g.measureText(l).width <= aw)) || s <= 13) break; s -= 1; }
    lines = lines.slice(0, 2);
    let ss = Math.max(13, Math.round(Math.min(sz * 0.62, s * 0.8))), subs = [];
    if (sub) { for (;;) { set(ss, 700); subs = wrapLines(g, sub, aw); if (subs.length <= 2 || ss <= 12) break; ss -= 1; } subs = subs.slice(0, 2); }
    const lh = s * 1.06, slh = ss * 1.1, total = lines.length * lh + (subs.length ? 3 + subs.length * slh : 0);
    let yy = y + h / 2 - total / 2 + lh / 2;
    for (const l of lines) { text(g, l, ax, yy, s, { color, align, maxW: aw }); yy += lh; }
    yy += subs.length ? 3 - lh / 2 + slh / 2 : 0;
    for (const l of subs) { text(g, l, ax, yy, ss, { color, align, weight: 700, maxW: aw }); yy += slh; }
  }
  /* world-space ray -> { dist, point, button } or null */
  hit(ray) {
    if (!this.mesh.visible) return null;
    const m = this.mesh;
    let p = m;
    while (p) { if (!p.visible) return null; p = p.parent; }
    m.updateWorldMatrix(true, false);
    const inv = new THREE.Matrix4().copy(m.matrixWorld).invert(), r = ray.clone().applyMatrix4(inv);
    if (Math.abs(r.direction.z) < 1e-6) return null;
    const t = -r.origin.z / r.direction.z;
    if (t <= 0) return null;
    const lx = r.origin.x + r.direction.x * t, ly = r.origin.y + r.direction.y * t;
    if (Math.abs(lx) > this.width / 2 || Math.abs(ly) > this.height / 2) return null;
    const px = (lx / this.width + 0.5) * this.W, py = (0.5 - ly / this.height) * this.H;
    const point = new THREE.Vector3(lx, ly, 0).applyMatrix4(m.matrixWorld);
    let button = null;
    for (const b of this.buttons) if (px >= b.x && px <= b.x + b.w && py >= b.y - 4 && py <= b.y + b.h + 8) { button = b; break; }
    return { dist: point.distanceTo(ray.origin), point, button, panel: this };
  }
  setHover(ids) {
    const s = [...ids].sort().join(',');
    if (s === this._hov) return;
    this._hov = s; this.hover = new Set(ids); this.redraw();
  }
  press(b) {
    if (!b || b.disabled) return false;
    this.flash = b.id; this.flashT = 0.15; this.redraw();
    if (b.onPress) b.onPress();
    return true;
  }
  tick(dt) { if (this.flash && (this.flashT -= dt) <= 0) { this.flash = null; this.redraw(); } }
}
