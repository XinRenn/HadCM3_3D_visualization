/* Standing in Bristol's Future: boot, app state, the two scenes (globe, Bristol), teleport fades, the
   desktop camera and the frame loop. URL options: ?lang=zh|en  ?stop=<id>  ?pathway=<id>  ?mode=city
   ?xrsim=1 (VR panels on a desktop, mouse = controller)  ?debug=1 (override values, frame time) */
import * as THREE from 'three';
import { loadData, LAYER_VARS } from './data.js';
import { U, tx, fmt, LANG, setLang, onLang } from './i18n.js';
import { Globe, BRISTOL } from './globe.js';
import { XRUI } from './ui/xr.js';
import { Overlay } from './ui/overlay.js';
import { closingStop } from './format.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const SIM = params.get('xrsim') === '1';
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const FADE_S = 0.3;            // seconds to black, and the same back
const SEATED_DROP = 0.45;      // metres the world moves down in seated mode
const EYE = 1.6;               // desktop eye height above the pontoon deck

const S = {
  mode: 'globe', stop: 'now', pathway: null, layer: 'temp_c', seated: false,
  seen: new Set(), closingShown: false, closingOpen: false, override: null,
};
const app = { S, SIM, look: () => {}, snapTurn: () => {} };
window.DEMO = app;

let renderer, scene, camera, content, globe, city = null, xr, overlay, globeEnv, fadeMesh;
const VIEW = { dist: 4.6, yaw: 0, pitch: -4, fov: 62 };
const FADE = { a: 0, dir: 0, mid: null, res: null, busy: false };

/* ---------------------------------------------------------------- state changes */
app.stopIndex = () => Math.max(0, app.data.stops.findIndex(s => s.id === S.stop));
app.layerNames = () => LAYER_VARS.slice();
app.xrActive = () => !!(renderer && renderer.xr.isPresenting) || SIM;
app.vals = () => {
  const v = app.data.values(S.stop, S.pathway);
  if (S.override) for (const [k, x] of Object.entries(S.override)) v[k] = x;
  if (S.override && 'sea_level_m' in S.override && !('sea_level_m_range' in S.override)) v.sea_level_m_range = v.sea_level_m == null ? null : [v.sea_level_m * 0.8, v.sea_level_m * 1.2].sort((a, b) => a - b);
  return v;
};
function changed() { overlay.render(); xr.syncVisibility(); xr.redraw(); app.resize(); }
function refreshGlobe() { globe.show(S.layer, S.stop, S.pathway).then(() => { overlay.renderLegend(); xr.legendPanel.redraw(); }); }
function applyCity() {
  if (!city) return;
  city.apply(app.vals(), app.data.stop(S.stop));
  city.root.position.y = -city.deckY;
  noteSeen();
}
/* in the Bristol scene a change of time or pathway moves the water and the pontoon, so it fades like a teleport */
function sceneChange(fn) {
  if (S.mode === 'city') app.fade(() => { fn(); applyCity(); changed(); });
  else { fn(); refreshGlobe(); changed(); }
}
app.setStop = id => { if (id !== S.stop && app.data.stop(id)) sceneChange(() => { S.stop = id; }); };
app.stepStop = d => { const st = app.data.stops, i = clamp(app.stopIndex() + d, 0, st.length - 1); app.setStop(st[i].id); };
app.setPathway = id => { if (id !== S.pathway && app.data.pathway(id)) sceneChange(() => { S.pathway = id; }); };
app.setLayer = name => { if (name === S.layer) return; S.layer = name; refreshGlobe(); changed(); };
app.toggleLang = () => setLang(LANG === 'zh' ? 'en' : 'zh');
app.setOverride = o => { S.override = o; if (S.mode === 'city') applyCity(); changed(); };
app.visit = () => {
  if (S.mode === 'city' || FADE.busy) return;
  if (!city) { console.warn('Bristol scene not available'); return; }
  app.fade(() => { S.mode = 'city'; setMode(); applyCity(); VIEW.yaw = 0; VIEW.pitch = -4; changed(); });
};
app.back = () => { if (S.mode !== 'globe' && !FADE.busy) app.fade(() => { S.mode = 'globe'; S.closingOpen = false; setMode(); refreshGlobe(); changed(); }); };
app.toggleSeated = () => app.fade(() => { S.seated = !S.seated; content.position.y = S.seated ? -SEATED_DROP : 0; changed(); });
app.snapTurn = deg => { if (S.mode === 'city') content.rotation.y += deg * D2R; };
app.canCompare = () => S.seen.size >= 2;
app.closingInfo = () => {
  const d = app.data, st = closingStop(d, S.stop), ps = d.pathways;
  if (!st || ps.length < 2) return null;
  const lo = ps[0], hi = ps[ps.length - 1];
  return { stop: st, low: { p: lo, v: d.values(st.id, lo.id) }, high: { p: hi, v: d.values(st.id, hi.id) } };
};
app.openClosing = () => { if (!app.closingInfo()) return; S.closingOpen = true; S.closingShown = true; changed(); };
app.closeClosing = () => { S.closingOpen = false; changed(); };
let closingTimer = null;
function noteSeen() {
  if (S.mode !== 'city' || app.data.sharedStop(S.stop) || !app.data.cell(S.stop, S.pathway)) return;
  S.seen.add(S.pathway);
  if (S.seen.size >= 2 && !S.closingShown) {
    clearTimeout(closingTimer);
    closingTimer = setTimeout(() => { if (S.mode === 'city' && !S.closingShown) app.openClosing(); }, 4500);
  }
}

/* ---------------------------------------------------------------- fade to black and back */
app.fade = mid => new Promise(res => {
  if (FADE.busy) { mid(); res(); return; }
  FADE.busy = true; FADE.dir = 1; FADE.mid = mid; FADE.res = res;
});
function fadeTick(dt) {
  if (!FADE.dir) return;
  FADE.a = clamp(FADE.a + FADE.dir * dt / FADE_S, 0, 1);
  if (FADE.dir === 1 && FADE.a >= 1) {
    FADE.dir = 0;
    Promise.resolve().then(FADE.mid).catch(e => console.error(e)).then(() => { FADE.dir = -1; });
  } else if (FADE.dir === -1 && FADE.a <= 0) { FADE.dir = 0; FADE.busy = false; const r = FADE.res; FADE.res = null; r && r(); }
  fadeMesh.material.opacity = FADE.a; fadeMesh.visible = FADE.a > 0.001;
}

/* ---------------------------------------------------------------- layout of the two scenes */
function setMode() {
  const g = S.mode === 'globe';
  globe.root.visible = g; globeEnv.visible = g;
  if (city) city.root.visible = !g;
  scene.background = g ? new THREE.Color(0x1D3A6E) : null;
  content.rotation.y = 0;
  layout();
}
function layout() {
  const xrLike = app.xrActive();
  if (xrLike) { globe.root.position.set(0, 1.38, -0.84); globe.root.scale.setScalar(0.27); globe.setLabelSize(0.1); }
  else { globe.root.position.set(0, 0, 0); globe.root.scale.setScalar(1); globe.setLabelSize(0.11); }
  globeEnv.userData.floor.visible = xrLike;
  app.resize();
}
app.resize = () => {
  if (!renderer || renderer.xr.isPresenting) return;
  const W = window.innerWidth, H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  const title = S.mode === 'globe' ? $('#title').getBoundingClientRect().bottom + 6 : 56;
  const dock = SIM ? 0 : ($('#dock')?.offsetHeight || 0) + 34, top = SIM ? 0 : Math.max(56, title);
  const avail = Math.max(120, H - dock - top), cy = top + avail / 2;
  if (S.mode === 'globe' && !SIM) {
    camera.fov = 30;
    const fit = Math.min(avail / H, (W - 40) / W * camera.aspect) * 0.98;
    VIEW.dist = clamp(1.32 / (Math.tan(camera.fov * D2R / 2) * fit), 2.2, 30) * (VIEW.zoom || 1);
  } else camera.fov = VIEW.fov;
  if (!SIM && Math.abs(H / 2 - cy) > 1) camera.setViewOffset(W, H, 0, H / 2 - cy, W, H); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
};
function placeCamera() {
  if (renderer.xr.isPresenting) return;
  if (S.mode === 'globe' && !SIM) { camera.position.set(0, 0, VIEW.dist); camera.quaternion.identity(); return; }
  camera.position.set(0, EYE, 0);
  camera.quaternion.setFromEuler(new THREE.Euler(VIEW.pitch * D2R, VIEW.yaw * D2R, 0, 'YXZ'));
}
app.look = (dx, dy) => { VIEW.yaw -= dx * 0.18; VIEW.pitch = clamp(VIEW.pitch - dy * 0.18, -70, 70); };

/* ---------------------------------------------------------------- desktop mouse (not in ?xrsim) */
function bindDesktop() {
  const el = renderer.domElement, rc = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null, moved = 0;
  const pinAt = e => {
    if (S.mode !== 'globe') return false;
    ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    rc.setFromCamera(ndc, camera);
    return globe.hitPin(rc) != null;
  };
  el.addEventListener('pointerdown', e => { if (SIM) return; down = [e.clientX, e.clientY]; moved = 0; el.setPointerCapture(e.pointerId); el.classList.add('grabbing'); });
  el.addEventListener('pointermove', e => {
    if (SIM) return;
    if (!down) { const p = pinAt(e); el.classList.toggle('pin', p); globe.pinHover = p; return; }
    const dx = e.clientX - down[0], dy = e.clientY - down[1]; down = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
    if (S.mode === 'globe') { const k = 0.25 * Math.min(1, 700 / window.innerHeight) * (VIEW.zoom || 1); globe.nudge(dy * k, -dx * k); }
    else app.look(dx, dy);
  });
  el.addEventListener('pointerup', e => { if (SIM) return; el.classList.remove('grabbing'); if (down && moved < 6 && pinAt(e)) app.visit(); down = null; });
  el.addEventListener('wheel', e => {
    if (SIM) return; e.preventDefault();
    if (S.mode === 'globe') { VIEW.zoom = clamp((VIEW.zoom || 1) * Math.exp(e.deltaY * 0.001), 0.55, 1.6); app.resize(); }
    else { VIEW.fov = clamp(VIEW.fov * Math.exp(e.deltaY * 0.001), 30, 80); app.resize(); }
  }, { passive: false });
  window.addEventListener('resize', app.resize);
}

/* ---------------------------------------------------------------- the space around the globe */
function buildGlobeEnv() {
  const g = new THREE.Group(), sp = [];
  for (let i = 0; i < 1600; i++) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, c = Math.sqrt(1 - u * u); sp.push(40 * c * Math.cos(a), 40 * u, 40 * c * Math.sin(a)); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  g.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xDCEBFF, size: 2, sizeAttenuation: false, transparent: true, opacity: 0.7 })));
  /* in VR a round floor under your feet, so the globe room has a ground */
  const fc = document.createElement('canvas'); fc.width = fc.height = 512;
  const fg = fc.getContext('2d'), grd = fg.createRadialGradient(256, 256, 20, 256, 256, 256);
  grd.addColorStop(0, 'rgba(120,170,255,0.55)'); grd.addColorStop(0.7, 'rgba(60,100,190,0.35)'); grd.addColorStop(1, 'rgba(40,70,150,0)');
  fg.fillStyle = grd; fg.fillRect(0, 0, 512, 512); fg.strokeStyle = 'rgba(255,255,255,0.35)'; fg.lineWidth = 4;
  for (const r of [60, 120, 180]) { fg.beginPath(); fg.arc(256, 256, r, 0, Math.PI * 2); fg.stroke(); }
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; g.add(floor); g.userData.floor = floor;
  return g;
}

/* ---------------------------------------------------------------- frame */
let lastT = 0, fpsAcc = 0, fpsN = 0, fpsMax = 0;
const camW = new THREE.Vector3();
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
  placeCamera();
  camera.updateMatrixWorld(true);
  camera.getWorldPosition(camW);
  if (S.mode === 'globe') globe.update(dt, camW);
  else if (city) city.update(dt, t / 1000, camera);
  xr.update(dt);
  fadeTick(dt);
  renderer.render(scene, camera);
  if (overlay.dbg) {
    fpsAcc += dt; fpsN++; fpsMax = Math.max(fpsMax, dt);
    if (fpsAcc > 1) { const i = renderer.info.render; overlay.stats(`${(fpsN / fpsAcc).toFixed(0)} fps · worst ${(fpsMax * 1000).toFixed(0)} ms · ${i.triangles.toLocaleString()} tris · ${i.calls} calls`); fpsAcc = 0; fpsN = 0; fpsMax = 0; }
  }
}

/* ---------------------------------------------------------------- boot */
async function main() {
  $('#loadMsg').textContent = tx(U.loading);
  try {
    app.data = await loadData('data/');
    const base = await (await fetch('assets/globe_base.json')).json();
    const d = app.data;
    S.pathway = d.pathway(params.get('pathway')) ? params.get('pathway') : (d.pathway('ssp245') ? 'ssp245' : d.pathways[0]?.id || null);
    S.stop = d.stop(params.get('stop')) ? params.get('stop') : (d.stop('now') ? 'now' : d.stops[0].id);

    renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.xr.setFoveation(1);
    app.renderer = renderer;
    scene = new THREE.Scene(); app.scene = scene;
    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.05, 2500); app.camera = camera;
    scene.add(camera);
    content = new THREE.Group(); scene.add(content); app.content = content;
    globe = new Globe(base, d); content.add(globe.root); app.globe = globe;
    globe.face(34, BRISTOL.lon);
    globeEnv = buildGlobeEnv(); content.add(globeEnv);
    fadeMesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
    fadeMesh.renderOrder = 1000; fadeMesh.visible = false; camera.add(fadeMesh);

    try {
      const { BristolScene } = await import('./bristol/scene.js');
      city = new BristolScene(app); await city.init(); content.add(city.root); app.city = city;
    } catch (e) { console.error(e); d.warnings.push('Bristol scene: ' + (e.message || e)); }

    xr = new XRUI(app, { sim: SIM }); app.xr = xr;
    overlay = new Overlay(app); app.overlay = overlay;
    onLang(() => { globe.relabel(); if (city) city.relabel(); changed(); });
    await document.fonts.ready.catch(() => {});
    if (city && params.get('mode') === 'city') S.mode = 'city';
    setMode();
    if (S.mode === 'city') applyCity();
    refreshGlobe();
    changed();
    bindDesktop();
    const vrBtn = $('#btnVR');
    xr.supported().then(ok => { vrBtn.hidden = !ok; });
    vrBtn.onclick = () => xr.enter().catch(e => { vrBtn.textContent = String(e.message || e).slice(0, 60); });
    renderer.xr.addEventListener('sessionstart', () => { xr.setActive(true); layout(); changed(); });
    renderer.xr.addEventListener('sessionend', () => { xr.setActive(SIM); content.rotation.y = 0; layout(); changed(); });
    $('#loading').hidden = true;
    renderer.setAnimationLoop(frame);
  } catch (e) {
    console.error(e);
    $('#loading').classList.add('err');
    $('#loadMsg').textContent = fmt(U.fail, { e: e.message || e });
  }
}
main();
