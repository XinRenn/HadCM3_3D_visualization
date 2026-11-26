/* Standing in Bristol's Future: boot, app state, the two scenes (globe, Bristol), teleport fades, the
   desktop camera and the frame loop. URL options: ?lang=zh|en  ?t=<kyr>  ?pathway=<id>  ?mode=city  ?layer=<name>
   ?xrsim=1 (VR panels on a desktop, mouse = controller)  ?debug=1 (override values, frame time)
   ?data=<folder> (another data folder next to this page, same format as data/) */
import * as THREE from 'three';
import { loadData, LAYERS } from './data.js';
import { U, tx, fmt, LANG, setLang, onLang } from './i18n.js';
import { Globe, BRISTOL, loadRelief } from './globe.js';
import { XRUI } from './ui/xr.js';
import { Overlay } from './ui/overlay.js';
import { closingTime } from './format.js';
import { p2t, t2p, stepT } from './timeaxis.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const SIM = params.get('xrsim') === '1';
const DATA_DIR = (/^[\w-]+(\/[\w-]+)*$/.test(params.get('data') || '') ? params.get('data') : 'data') + '/';
const D2R = Math.PI / 180;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const FADE_S = 0.3;            // seconds to black, and the same back
const SEATED_DROP = 0.45;      // metres the world moves down in seated mode
const EYE = 1.6;               // desktop eye height above the pontoon deck
const PLAY_S = 45;             // seconds for Play to cross the whole slider
const XR_GLOBE = { pos: new THREE.Vector3(0, 1.36, -0.82), scale: 0.27 };

const S = {
  mode: 'globe', t: 0, tPreview: null, pathway: null, layer: 'surface', seated: false, playing: false, seaDemo: null,
  seen: new Set(), closingShown: false, closingOpen: false, override: null,
};
const app = { S, SIM, look: () => {}, snapTurn: () => {}, p2t, t2p };
window.DEMO = app;

let renderer, scene, camera, content, globe, city = null, xr, overlay, globeEnv, fadeMesh;
const VIEW = { yaw: 0, pitch: -4, fov: 62, zoom: 1, dist: 4.6 };
const FADE = { a: 0, dir: 0, mid: null, res: null, busy: false };

/* ---------------------------------------------------------------- state changes */
app.layerNames = () => LAYERS.slice();
app.xrActive = () => !!(renderer && renderer.xr.isPresenting) || SIM;
app.shownT = () => (S.tPreview != null ? S.tPreview : S.t);
app.vals = () => {
  const v = app.data.values(S.t, S.pathway);
  if (S.override) for (const [k, x] of Object.entries(S.override)) v[k] = x;
  return v;
};
function changed() { overlay.render(); xr.syncVisibility(); xr.redraw(); app.resize(); }
function refreshGlobe() { globe.setTime(S.t, S.pathway, S.seaDemo); }
function applyCity() {
  if (!city) return;
  city.apply(app.vals(), S.t);
  city.root.position.copy(city.viewOrigin);
  noteSeen();
}
/* in Bristol, a new time or pathway moves the water and the pontoon, so it fades like a teleport */
function sceneChange(fn) {
  if (S.mode === 'city') app.fade(() => { fn(); applyCity(); refreshGlobe(); changed(); });
  else { fn(); refreshGlobe(); changed(); }
}
app.setTime = t => { t = app.data.clampT(t); S.tPreview = null; if (t === S.t) { changed(); return; } sceneChange(() => { S.t = t; }); };
app.previewTime = t => { S.tPreview = app.data.clampT(t); overlay.renderTime(); xr.redrawTime(); };      // while dragging in Bristol
app.stepTime = d => { app.stopPlay(); app.setTime(stepT(S.t, d, app.data.axis.end)); };
app.setPathway = id => { if (id !== S.pathway && app.data.pathway(id)) sceneChange(() => { S.pathway = id; }); };
app.setLayer = name => { if (name === S.layer) return; S.layer = name; if (name !== 'sea') S.seaDemo = null; globe.setLayer(name); refreshGlobe(); changed(); };
app.setSeaDemo = v => { S.seaDemo = v == null ? null : clamp(v, -130, 70); refreshGlobe(); overlay.renderLegend(); xr.legendPanel.redraw(); };
app.togglePlay = () => { if (S.mode !== 'globe') return; S.playing = !S.playing; if (S.playing && S.t >= app.data.axis.end) S.t = 0; S.seaDemo = null; changed(); };
app.stopPlay = () => { if (S.playing) { S.playing = false; changed(); } };
app.toggleLang = () => setLang(LANG === 'zh' ? 'en' : 'zh');
app.setOverride = o => { S.override = o; if (S.mode === 'city') applyCity(); changed(); };
app.visit = () => {
  if (S.mode === 'city' || FADE.busy) return;
  if (!city) { console.warn('Bristol scene not available'); return; }
  S.playing = false; S.seaDemo = null;
  app.fade(() => { S.mode = 'city'; setMode(); refreshGlobe(); applyCity(); VIEW.yaw = 0; VIEW.pitch = -4; changed(); });
};
app.back = () => { if (S.mode !== 'globe' && !FADE.busy) app.fade(() => { S.mode = 'globe'; S.closingOpen = false; setMode(); refreshGlobe(); changed(); }); };
app.toggleSeated = () => app.fade(() => { S.seated = !S.seated; content.position.y = S.seated ? -SEATED_DROP : 0; changed(); });
app.snapTurn = deg => { if (S.mode === 'city') content.rotation.y += deg * D2R; };
app.resetGlobe = () => {
  if (app.xrActive()) { globe.root.position.copy(XR_GLOBE.pos); globe.root.quaternion.identity(); globe.root.scale.setScalar(XR_GLOBE.scale); }
  globe.face(34, BRISTOL.lon); VIEW.zoom = 1; zoomed(); app.resize();
};
app.canCompare = () => S.seen.size >= 2;
app.closingInfo = () => {
  const d = app.data, c = d.compare || [], lo = d.pathway(c[0]) || d.pathways[0], hi = d.pathway(c[1]) || d.pathways[d.pathways.length - 1];
  if (!lo || !hi || lo === hi) return null;
  const t = closingTime(S.t);
  return { t, low: { p: lo, v: d.values(t, lo.id) }, high: { p: hi, v: d.values(t, hi.id) } };
};
app.openClosing = () => { if (!app.closingInfo()) return; S.closingOpen = true; S.closingShown = true; changed(); };
app.closeClosing = () => { S.closingOpen = false; changed(); };
let closingTimer = null;
function noteSeen() {
  if (S.mode !== 'city' || S.t < 1) return;
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
  scene.background = g ? new THREE.Color(0x03060B) : null;
  content.rotation.y = 0;
  layout();
}
function layout() {
  const xrLike = app.xrActive();
  if (xrLike) { if (!layout.placed) { app.resetGlobe(); layout.placed = true; } globe.setLabelSize(0.09); }
  else { layout.placed = false; globe.root.position.set(0, 0, 0); globe.root.quaternion.identity(); globe.root.scale.setScalar(1); zoomed(); }
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
    VIEW.dist = Math.max(1.12, clamp(1.3 / (Math.tan(camera.fov * D2R / 2) * fit), 2.2, 30) * VIEW.zoom);
  } else camera.fov = VIEW.fov;
  if (!SIM && Math.abs(H / 2 - cy) > 1) camera.setViewOffset(W, H, 0, H / 2 - cy, W, H); else camera.clearViewOffset();
  camera.updateProjectionMatrix();
};
function placeCamera() {
  if (renderer.xr.isPresenting) return;
  if (S.mode === 'globe' && !SIM) { camera.position.set(0, 0, VIEW.dist); camera.quaternion.identity(); return; }
  camera.position.set(0, EYE, 0);
  camera.quaternion.setFromEuler(EUL.set(VIEW.pitch * D2R, VIEW.yaw * D2R, 0, 'YXZ'));
}
app.look = (dx, dy) => { VIEW.yaw -= dx * 0.18; VIEW.pitch = clamp(VIEW.pitch - dy * 0.18, -70, 70); };
app.zoomBy = f => { VIEW.zoom = clamp(VIEW.zoom * f, 0.3, 1.6); zoomed(); app.resize(); };
function zoomed() { document.body.classList.toggle('zoomed', VIEW.zoom < 0.8); if (!app.xrActive()) globe.setLabelSize(0.08 * Math.max(0.35, VIEW.zoom)); }

/* ---------------------------------------------------------------- desktop mouse and touch (not in ?xrsim) */
function bindDesktop() {
  const el = renderer.domElement, rc = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down = null, moved = 0, pinch = null;
  const pinAt = e => {
    if (S.mode !== 'globe') return false;
    ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    rc.setFromCamera(ndc, camera);
    return globe.hitPin(rc) != null;
  };
  const pts = new Map();
  el.addEventListener('pointerdown', e => { if (SIM) return; pts.set(e.pointerId, [e.clientX, e.clientY]); down = [e.clientX, e.clientY]; moved = 0; el.setPointerCapture(e.pointerId); el.classList.add('grabbing'); });
  el.addEventListener('pointermove', e => {
    if (SIM) return;
    if (!down) { const p = pinAt(e); el.classList.toggle('pin', p); globe.pinHover = p; return; }
    if (pts.has(e.pointerId)) pts.set(e.pointerId, [e.clientX, e.clientY]);
    if (pts.size === 2) {                                   // two fingers: pinch to zoom
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch && S.mode === 'globe') app.zoomBy(pinch / d); pinch = d; moved += 10; return;
    }
    const dx = e.clientX - down[0], dy = e.clientY - down[1]; down = [e.clientX, e.clientY]; moved += Math.abs(dx) + Math.abs(dy);
    if (S.mode === 'globe') { const k = 0.25 * Math.min(1, 700 / window.innerHeight) * VIEW.zoom; globe.nudge(dy * k, -dx * k); }
    else app.look(dx, dy);
  });
  const up = e => { if (SIM) return; pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size) return; el.classList.remove('grabbing'); if (down && moved < 6 && pinAt(e)) app.visit(); down = null; };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  el.addEventListener('wheel', e => {
    if (SIM) return; e.preventDefault();
    if (S.mode === 'globe') app.zoomBy(Math.exp(e.deltaY * 0.0012));
    else { VIEW.fov = clamp(VIEW.fov * Math.exp(e.deltaY * 0.001), 30, 80); app.resize(); }
  }, { passive: false });
  window.addEventListener('resize', app.resize);
}

/* ---------------------------------------------------------------- the space around the globe: stars (as v3), and a floor in VR */
function buildGlobeEnv() {
  const g = new THREE.Group(), ns = 2400, sp = new Float32Array(ns * 3), sz = new Float32Array(ns), v = new THREE.Vector3();
  for (let i = 0; i < ns; i++) { v.randomDirection().multiplyScalar(60 + Math.random() * 40); sp.set([v.x, v.y, v.z], i * 3); sz[i] = 0.8 + Math.random() * Math.random() * 2.8; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  g.add(new THREE.Points(sg, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'attribute float sz; void main() { gl_PointSize = sz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'void main() { vec2 d = gl_PointCoord - 0.5; float a = 1.0 - smoothstep(0.2, 0.5, length(d)); gl_FragColor = vec4(vec3(0.86, 0.9, 1.0), a * 0.75); }',
  })));
  const fc = document.createElement('canvas'); fc.width = fc.height = 512;
  const fg = fc.getContext('2d'), grd = fg.createRadialGradient(256, 256, 20, 256, 256, 256);
  grd.addColorStop(0, 'rgba(90,130,200,0.35)'); grd.addColorStop(0.7, 'rgba(50,80,150,0.18)'); grd.addColorStop(1, 'rgba(30,50,110,0)');
  fg.fillStyle = grd; fg.fillRect(0, 0, 512, 512); fg.strokeStyle = 'rgba(255,255,255,0.22)'; fg.lineWidth = 3;
  for (const r of [70, 140, 210]) { fg.beginPath(); fg.arc(256, 256, r, 0, Math.PI * 2); fg.stroke(); }
  const ft = new THREE.CanvasTexture(fc); ft.colorSpace = THREE.SRGBColorSpace;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: ft, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.002; g.add(floor); g.userData.floor = floor;
  return g;
}

/* ---------------------------------------------------------------- frame */
let lastT = 0, fpsAcc = 0, fpsN = 0, fpsMax = 0, playP = 0;
const camW = new THREE.Vector3(), EUL = new THREE.Euler();
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0.016); lastT = t;
  if (S.playing) {                                        // Play: glide along the slider; the data steps every 1,000 years
    playP = Math.min(1, (playP || t2p(S.t)) + dt / PLAY_S);
    const nt = app.data.clampT(p2t(playP));
    if (nt !== S.t) { S.t = nt; refreshGlobe(); overlay.renderTime(); xr.redrawTime(); }
    if (playP >= 1) { S.playing = false; changed(); }
  } else playP = 0;
  placeCamera();
  camera.updateMatrixWorld(true);
  camera.getWorldPosition(camW);
  if (S.mode === 'globe') globe.update(dt, camera);
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
    const [data, base, relief] = await Promise.all([loadData(DATA_DIR), fetch('assets/globe_base.json').then(r => r.json()), loadRelief('assets/relief_10m.png')]);
    app.data = data;
    const d = data;
    S.pathway = d.pathway(params.get('pathway')) ? params.get('pathway') : (d.pathway('ssp245') ? 'ssp245' : d.pathways[0]?.id || null);
    S.t = d.clampT(+(params.get('t') || 0));
    if (LAYERS.includes(params.get('layer'))) S.layer = params.get('layer');

    renderer = new THREE.WebGLRenderer({ canvas: $('#gl'), antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    renderer.xr.setFoveation(1);
    app.renderer = renderer;
    scene = new THREE.Scene(); app.scene = scene;
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sunL = new THREE.DirectionalLight(0xffffff, 1.4); sunL.position.set(-1, 1, 1); scene.add(sunL);
    camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.01, 2500); app.camera = camera;
    scene.add(camera);
    content = new THREE.Group(); scene.add(content); app.content = content;
    globe = new Globe(base, relief, d); content.add(globe.root); app.globe = globe;
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
    globe.setLayer(S.layer);
    setMode();
    refreshGlobe();
    if (S.mode === 'city') applyCity();
    changed();
    bindDesktop();
    const vrBtn = $('#btnVR');
    xr.supported().then(ok => { vrBtn.hidden = !ok; });
    vrBtn.onclick = () => xr.enter().catch(e => { vrBtn.textContent = String(e.message || e).slice(0, 60); });
    renderer.xr.addEventListener('sessionstart', () => { xr.setActive(true); layout.placed = false; layout(); changed(); });
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
