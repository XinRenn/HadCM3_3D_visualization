/* ================================================================ VR (WebXR, Meta Quest)
   Appended to app.js by build_v3.py for HadCM3_3D_VR.html, so it shares the module scope
   (scene, camera, renderer, VIEW, P, go, advance, refreshAll …) and plugs in through HOOKS.
   In the headset the whole model scene (globe, shells, particles, cutaway, sun, stars) becomes
   one object floating in front of you; WebXR's own space (VR.root) holds the hands, the
   controllers, the wrist panel, the caption and the pointer label.
   - left palm (or left controller) turned toward the face: the control panel, on the hand
   - right controller ray + trigger, a pinch while pointing, or a right index-finger poke: press
   - trigger / pinch on the globe and drag: spin; grip (or pinch off the globe): move and turn;
     both hands: resize; right stick: turn and resize; A play, B next, X previous, Y reset */
import { XRControllerModelFactory } from 'three/addons/webxr/XRControllerModelFactory.js';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

(() => {
  const VU = {
    enter: L('Enter VR', '进入 VR'), ar: L('Passthrough', '透视模式'), checking: L('VR…', 'VR…'), novr: L('VR unavailable', 'VR 不可用'),
    novrT: L('Open this page in the Meta Quest Browser over HTTPS (or http://localhost) to enter VR.', '请在 Meta Quest 浏览器中通过 HTTPS（或 http://localhost）打开本页，即可进入 VR。'),
    enterT: L('Put on the headset: the globe floats in front of you; turn your left palm toward you for the controls.', '戴上头显：地球悬浮在你面前；把左手掌心转向自己即可打开控制面板。'),
    failed: L('Could not start VR: {e}', '无法启动 VR：{e}'),
    tNow: L('Now', '当前'), tDet: L('Details', '详情'), tLay: L('Layers', '图层'), tSurf: L('Surface', '地表'), tHelp: L('Help', '帮助'),
    pin: L('Pin', '固定'), reset: L('Reset globe', '复位地球'), exit: L('Exit VR', '退出 VR'),
    routineOf: L('Routine {i} of {n} in this step', '本步第 {i} / {n} 个子程序'),
    step: L('step', '步'), routine: L('routine', '子程序'), speed: L('speed', '速度'),
    caption: L('Caption under the globe', '地球下方字幕'), cutFollow: L('Wedge follows the step', '楔形随步骤移动'), autoCam: L('Turn the globe to each step', '地球随步骤转向'),
    hint: L('Turn your left palm toward you to open the controls', '把左手掌心转向自己，打开控制面板'),
    more: L('+ {n} more', '另有 {n} 项'), lang: L('中文', 'EN'), none: L('—', '—'),
    lev: L('level {k} · {p} hPa', '第 {k} 层 · {p} hPa'), dep: L('level {k} · {z} m', '第 {k} 层 · {z} m'),
    westFace: L('Western face {v}°E', '西侧剖面 {v}°E'), width: L('Width {v}°', '宽度 {v}°'),
    vis: L('In the 3D view', '3D 视图中'),
  };
  const HELP = [
    [L('Open the controls', '打开控制面板'), L('Turn your left palm, or the left controller, toward your face. Pin leaves the panel where it is so both hands are free.', '把左手掌心（或左手柄）转向面部。点“固定”让面板停在原处，双手就都空出来了。')],
    [L('Press a button', '按按钮'), L('Point with the right controller and pull the trigger, pinch while pointing, or touch the button with your right index finger.', '用右手柄指向并扣扳机；或指向后捏合；或用右手食指直接点。')],
    [L('Spin the globe', '转动地球'), L('Point at the globe, hold the trigger (or pinch) and drag.', '指向地球，按住扳机（或捏合）拖动。')],
    [L('Move and turn it', '移动和转动'), L('Hold the grip button, or pinch away from the globe, and move your hand; turning the wrist turns the globe.', '按住握把键（或在地球外捏合）移动手；转动手腕，地球随之转动。')],
    [L('Resize it', '缩放'), L('Grab with both hands and pull apart or push together. Right stick: left and right turn it, up and down resize it.', '双手同时抓住后拉开或靠拢。右摇杆：左右旋转，上下缩放。')],
    [L('Buttons', '按键'), L('A play or pause · B next routine · X previous routine · Y reset the globe · left stick left or right: one routine back or on.', 'A 播放/暂停 · B 下一个子程序 · X 上一个子程序 · Y 复位地球 · 左摇杆左右：前后一个子程序。')],
    [L('Read a value', '读数'), L('Point at the globe: the label gives the position, the atmosphere and ocean grid boxes and the value of the surface field.', '指向地球：标签给出位置、大气和海洋格点编号，以及当前地表场的数值。')],
  ];

  const V3 = THREE.Vector3, Q = THREE.Quaternion, UP = new V3(0, 1, 0);
  const VR = {
    on: false, mode: 'vr', frames: 0, placed: false, root: null, src: [], head: new V3(), two: null, tween: null,
    panelOn: false, pinned: false, cap: true, hintUntil: 0, windLev: 12, curLev: 1, stars: null, floor: null, scale0: 0.34,
  };
  window.HAD3D_VR = VR;

  HOOKS.presenting = () => VR.on;
  HOOKS.scene = () => (VR.on ? VR.root : scene);
  HOOKS.camTo = (lat, lon) => { if (!VR.on) return false; if (VIEW.autoCam && !grabbing()) faceTo(lat, lon, REDUCED ? 0 : 1.6); return true; };
  HOOKS.init.push(initVR);
  HOOKS.frame.push(vrFrame);

  /* ---------------------------------------------------------------- set-up */
  function initVR() {
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    VR.root = new THREE.Scene();
    VR.root.add(scene);
    scene.add(sunLight.target);                  /* the sun's light aims at the globe's centre wherever the globe is */
    VR.stars = scene.children.find(o => o.isPoints) || null;
    VR.root.add(new THREE.AmbientLight(0xffffff, 0.6));

    const fl = new THREE.PolarGridHelper(2.4, 12, 6, 72, 0x2F4555, 0x213240);
    fl.material.transparent = true; fl.material.opacity = 0.45; fl.material.depthWrite = false;
    VR.floor = fl; VR.root.add(fl);

    const cmf = new XRControllerModelFactory(), hmf = new XRHandModelFactory();
    for (let i = 0; i < 2; i++) {
      const c = renderer.xr.getController(i), g = renderer.xr.getControllerGrip(i), h = renderer.xr.getHand(i);
      const model = cmf.createControllerModel(g);
      h.add(hmf.createHandModel(h, 'mesh'));
      const S = { i, c, g, h, src: null, hand: false, side: '', mode: null, kind: null, hov: null, poked: false, flick: false, prev: [], pP: new V3(), qP: new Q(), spinL: new V3(), spinR: 1 };
      /* the controller model is for controllers only: with hand tracking it may get a hand profile whose
         nodes it cannot find, which would throw inside the frame loop */
      const upd = model.updateMatrixWorld.bind(model), plain = THREE.Object3D.prototype.updateMatrixWorld;
      model.updateMatrixWorld = function (force) { if (S.hand) return plain.call(this, force); try { upd(force); } catch (e) { plain.call(this, force); } };
      g.add(model);
      S.ray = rayLine(); c.add(S.ray);
      S.dot = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 8), new THREE.MeshBasicMaterial({ color: 0xE7B04C, depthTest: false, transparent: true }));
      S.dot.renderOrder = 120; S.dot.visible = false; VR.root.add(S.dot);
      c.addEventListener('connected', e => { S.src = e.data; S.hand = !!e.data.hand; S.side = e.data.handedness; model.visible = !S.hand; });
      c.addEventListener('disconnected', () => { S.src = null; S.hand = false; S.side = ''; if (S.mode) { S.mode = null; regrab(); } S.ray.visible = S.dot.visible = false; });
      c.addEventListener('selectstart', () => press(S, 'select'));
      c.addEventListener('selectend', () => release(S, 'select'));
      c.addEventListener('squeezestart', () => press(S, 'squeeze'));
      c.addEventListener('squeezeend', () => release(S, 'squeeze'));
      VR.root.add(c, g, h);
      VR.src.push(S);
    }
    buildPanel(); buildCaption(); buildTip();
    VR.root.visible = true;
    addButtons();
    if (document.fonts && document.fonts.addEventListener) document.fonts.addEventListener('loadingdone', () => { UI.sig = ''; CAP.sig = ''; });
  }
  function rayLine() {
    const geo = new THREE.BufferGeometry().setFromPoints([new V3(0, 0, 0), new V3(0, 0, -1)]);
    geo.setAttribute('color', new THREE.Float32BufferAttribute([0.91, 0.69, 0.30, 0.91, 0.69, 0.30], 3));
    const l = new THREE.Line(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.75, depthWrite: false }));
    l.visible = false; l.renderOrder = 110; l.frustumCulled = false;
    return l;
  }

  /* ---------------------------------------------------------------- the Enter VR buttons */
  function addButtons() {
    const tools = $('.tools'), lang = tools.querySelector('.lang');
    const mk = (id) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'tbtn vrbtn'; b.id = id; tools.insertBefore(b, lang); return b; };
    const bVR = mk('btnVR'), bAR = mk('btnAR');
    bAR.hidden = true;
    const state = { vr: null, ar: false };
    const label = () => {
      bVR.textContent = tx(state.vr === null ? VU.checking : state.vr ? VU.enter : VU.novr);
      bVR.disabled = !state.vr; bVR.title = tx(state.vr ? VU.enterT : VU.novrT);
      bAR.textContent = tx(VU.ar); bAR.hidden = !state.ar;
    };
    label();
    document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setTimeout(label, 0)));
    bVR.addEventListener('click', () => enter('vr'));
    bAR.addEventListener('click', () => enter('ar'));
    if (!navigator.xr) { state.vr = false; label(); return; }
    navigator.xr.isSessionSupported('immersive-vr').then(ok => { state.vr = ok; label(); }).catch(() => { state.vr = false; label(); });
    navigator.xr.isSessionSupported('immersive-ar').then(ok => { state.ar = ok; label(); }).catch(() => {});
  }
  async function enter(mode) {
    if (VR.on) return;
    try {
      const s = await navigator.xr.requestSession(mode === 'ar' ? 'immersive-ar' : 'immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'] });
      VR.mode = mode;
      s.addEventListener('end', onEnd);
      await renderer.xr.setSession(s);
      onStart();
    } catch (e) {
      console.error(e);
      alert(fmt(VU.failed, { e: e && e.message || e }));
    }
  }
  function onStart() {
    VR.on = true; VR.frames = 0; VR.placed = false; VR.two = null; VR.tween = null;
    VR.camSaved = camera.position.clone();
    CAMTWEEN = null; controls.enabled = false; $('#tip').hidden = true;
    const ar = VR.mode === 'ar';
    renderer.setClearAlpha(ar ? 0 : 1);
    if (VR.stars) VR.stars.visible = !ar;
    VR.floor.visible = !ar;
    VR.hintUntil = performance.now() / 1000 + 14;
    UI.sig = CAP.sig = '';
  }
  function onEnd() {
    VR.on = false;
    VR.src.forEach(S => { S.mode = null; S.ray.visible = S.dot.visible = false; });
    VR.panelOn = false; PANEL.mesh.visible = false; CAP.mesh.visible = false; TIP.mesh.visible = false;
    scene.position.set(0, 0, 0); scene.quaternion.identity(); scene.scale.setScalar(1); scene.updateMatrixWorld(true);
    renderer.setClearAlpha(1); if (VR.stars) VR.stars.visible = true;
    camera.position.copy(VR.camSaved || xyz(18, 350, 6.4)); camera.quaternion.identity(); camera.scale.set(1, 1, 1);
    controls.enabled = true; controls.update();
    setTimeout(resize, 0);                       /* after three.js has restored the canvas size */
  }
  const endSession = () => { const s = renderer.xr.getSession(); if (s) s.end(); };

  /* ---------------------------------------------------------------- the globe in your space */
  const _a = new V3(), _b = new V3(), _c = new V3(), _q = new Q(), _q2 = new Q(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();
  const gscale = () => scene.scale.x;
  const grabbing = () => VR.src.some(s => s.mode);
  function headFwd(out) {
    camera.getWorldDirection(out); out.y = 0;
    if (out.lengthSq() < 1e-4) out.set(0, 0, -1);
    return out.normalize();
  }
  function place() {
    VR.head.copy(camera.position);
    const f = headFwd(_a);
    scene.scale.setScalar(VR.scale0);
    scene.position.copy(VR.head).addScaledVector(f, 0.95); scene.position.y = Math.max(0.6, VR.head.y - 0.12);
    scene.quaternion.copy(orientFor(20, wrap360(VIEW.cutLon + VIEW.cutW / 2)));
    VR.tween = null; VR.placed = true;
  }
  /* the rotation that turns the point (lat, lon) of the globe toward your head, north kept up */
  function orientFor(lat, lon) {
    const p = xyz(lat, lon, 1).normalize();
    const h = _b.copy(VR.head).sub(scene.position); h.y *= 0.35;           /* mostly level: look at the focus, not down on it */
    if (h.lengthSq() < 1e-6) h.set(0, 0, 1);
    h.normalize();
    const lx = new V3().crossVectors(UP, p); if (lx.lengthSq() < 1e-6) lx.set(1, 0, 0); lx.normalize();
    const ly = new V3().crossVectors(p, lx);
    const wx = new V3().crossVectors(UP, h); if (wx.lengthSq() < 1e-6) wx.set(1, 0, 0); wx.normalize();
    const wy = new V3().crossVectors(h, wx);
    _m.makeBasis(lx, ly, p).transpose();
    _m2.makeBasis(wx, wy, h).multiply(_m);
    return new Q().setFromRotationMatrix(_m2);
  }
  function faceTo(lat, lon, dur) {
    if (!VR.placed) return;
    const to = orientFor(lat, lon);
    if (!dur) { scene.quaternion.copy(to); VR.tween = null; return; }
    VR.tween = { from: scene.quaternion.clone(), to, t: 0, dur };
  }
  function resetGlobe() { VR.src.forEach(s => { s.mode = null; }); VR.two = null; place(); }

  /* pose of a grabbing hand: the wrist for tracked hands, the grip for controllers */
  function pose(S, p, q) {
    if (S.hand) {
      const j = S.h.joints, w = j && j['wrist'];
      if (w && w.visible) { w.getWorldPosition(p); w.getWorldQuaternion(q); return true; }   /* the wrist: steadier than the closing fingers */
      S.c.getWorldPosition(p); S.c.getWorldQuaternion(q); return true;
    }
    S.g.getWorldPosition(p); S.g.getWorldQuaternion(q); return true;
  }
  function rayOf(S, o, d) { S.c.updateMatrixWorld(); o.setFromMatrixPosition(S.c.matrixWorld); d.set(0, 0, -1).transformDirection(S.c.matrixWorld); }
  function raySphere(o, d, R) {
    const C = scene.position, oc = _c.copy(o).sub(C), b = oc.dot(d), c = oc.lengthSq() - R * R, disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t < 0) return null;
    return { dist: t, point: o.clone().addScaledVector(d, t) };
  }
  function press(S, kind) {
    if (!VR.on || !S.src) return;
    if (holdsPanel(S)) return;
    const h = S.hov;
    if (kind === 'select' && h && h.kind === 'panel') { if (h.id) click(h.id, S); return; }
    S.kind = kind;
    S.mode = kind === 'select' && h && h.kind === 'globe' ? 'spin' : 'move';
    VR.tween = null;
    regrab();
  }
  function release(S, kind) { if (S.mode && S.kind === kind) { S.mode = null; S.kind = null; regrab(); } }
  function regrab() {
    const gs = VR.src.filter(s => s.mode);
    VR.two = null;
    gs.forEach(S => { pose(S, S.pP, S.qP); });
    if (gs.length >= 2) {
      const [a, b] = gs;
      VR.two = { a, b, d0: Math.max(a.pP.distanceTo(b.pP), 0.02), s0: gscale(), mid0: a.pP.clone().add(b.pP).multiplyScalar(0.5),
        pos0: scene.position.clone(), v0: b.pP.clone().sub(a.pP).normalize(), q0: scene.quaternion.clone() };
    } else if (gs.length === 1 && gs[0].mode === 'spin') {
      const S = gs[0], o = new V3(), d = new V3(); rayOf(S, o, d);
      let hit = raySphere(o, d, gscale()); S.spinR = 1;
      if (!hit) { hit = raySphere(o, d, gscale() * (1 + ATM_H)); S.spinR = 1 + ATM_H; }
      if (hit) S.spinL.copy(hit.point).sub(scene.position).applyQuaternion(_q.copy(scene.quaternion).invert()).normalize();
      else S.mode = 'move';
    }
  }
  function updateGrabs() {
    const gs = VR.src.filter(s => s.mode);
    if (!gs.length) return;
    if (VR.two) {
      const T = VR.two;
      pose(T.a, _a, _q); pose(T.b, _b, _q2);
      const d = Math.max(_a.distanceTo(_b), 0.02), s = clamp(T.s0 * d / T.d0, 0.06, 4);
      const mid = _a.clone().add(_b).multiplyScalar(0.5), v = _b.clone().sub(_a).normalize();
      const dq = new Q().setFromUnitVectors(T.v0, v);
      scene.scale.setScalar(s);
      scene.quaternion.copy(dq).multiply(T.q0);
      scene.position.copy(T.pos0).sub(T.mid0).multiplyScalar(s / T.s0).applyQuaternion(dq).add(mid);
      return;
    }
    const S = gs[0];
    if (S.mode === 'spin') {
      const o = new V3(), d = new V3(); rayOf(S, o, d);
      const hit = raySphere(o, d, gscale() * S.spinR);
      if (hit) {
        const cur = S.spinL.clone().applyQuaternion(scene.quaternion).normalize(), tgt = hit.point.sub(scene.position).normalize();
        scene.quaternion.premultiply(_q.setFromUnitVectors(cur, tgt)).normalize();
      }
      return;
    }
    pose(S, _a, _q);
    scene.position.add(_b.copy(_a).sub(S.pP));
    _q2.copy(S.qP).invert(); const dq = _q.clone().multiply(_q2);
    scene.quaternion.premultiply(dq).normalize();
    S.pP.copy(_a); S.qP.copy(_q);
  }
  function readPads(dt) {
    VR.src.forEach(S => {
      const gp = S.src && !S.hand ? S.src.gamepad : null;
      if (!gp) return;
      const b = gp.buttons, ax = gp.axes, right = S.side === 'right';
      const edge = i => { const now = !!(b[i] && b[i].pressed), was = !!S.prev[i]; S.prev[i] = now; return now && !was; };
      if (edge(4)) { if (right) togglePlay(); else advance(-1); buzz(S); }
      if (edge(5)) { if (right) advance(1); else resetGlobe(); buzz(S); }
      const x = ax[2] || 0, y = ax[3] || 0;
      if (right) {
        if (Math.abs(x) > 0.15) { scene.quaternion.premultiply(_q.setFromAxisAngle(UP, -x * dt * 1.4)); VR.tween = null; }
        if (Math.abs(y) > 0.15 && !VR.two) scene.scale.setScalar(clamp(gscale() * Math.exp(-y * dt * 1.1), 0.06, 4));
      } else {
        if (!S.flick && Math.abs(x) > 0.7) { S.flick = true; advance(x > 0 ? 1 : -1); buzz(S); }
        if (Math.abs(x) < 0.3) S.flick = false;
      }
    });
  }
  function buzz(S, k = 0.35, ms = 25) {
    try { const h = S.src && S.src.gamepad && S.src.gamepad.hapticActuators && S.src.gamepad.hapticActuators[0]; if (h && h.pulse) h.pulse(k, ms); } catch (e) { /* no haptics */ }
  }
  function togglePlay() { P.playing = !P.playing; renderTransport(); }

  /* ---------------------------------------------------------------- canvas drawing */
  const FB = '"IBM Plex Sans", "Noto Sans SC", system-ui, sans-serif', FM = '"IBM Plex Mono", ui-monospace, monospace', FD = '"Source Serif 4", "Noto Serif SC", Georgia, serif';
  const K = { bg: '#0C141B', raise: '#131F28', raise2: '#1A2934', line: '#213240', line2: '#2F4555', ink: '#E3EBEE', muted: '#95A6AE', faint: '#62747D', acc: '#E7B04C' };
  const TOK = /[⺀-鿿豈-﫿＀-￯　-〿]|[^\s⺀-鿿豈-﫿＀-￯　-〿]+\s*|\s+/g;
  const rgbaS = (h, a) => { const c = hex3(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; };
  const STRIP = new Map();
  const strip = s => {
    if (!s) return '';
    if (!STRIP.has(s)) { let t; try { t = new DOMParser().parseFromString(String(s), 'text/html').body.textContent || ''; } catch (e) { t = String(s).replace(/<[^>]*>/g, ''); } STRIP.set(s, t); }
    return STRIP.get(s);
  };
  function canvasPlane(w, h, mw) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    const mh = mw * h / w;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mw, mh), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false }));
    mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 100;
    return { cv, g: cv.getContext('2d'), tex, mesh, w, h, mw, mh, sig: '', op: 0, t: 0 };
  }
  let G = null;
  const font = (sz, w = 400, fam = FB) => { G.font = `${w} ${sz}px ${fam}`; };
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    G.beginPath(); G.moveTo(x + r, y); G.arcTo(x + w, y, x + w, y + h, r); G.arcTo(x + w, y + h, x, y + h, r); G.arcTo(x, y + h, x, y, r); G.arcTo(x, y, x + w, y, r); G.closePath();
  }
  const fill = c => { G.fillStyle = c; G.fill(); };
  const stroke = (c, lw = 2) => { G.strokeStyle = c; G.lineWidth = lw; G.stroke(); };
  const dot = (x, y, r, c) => { G.beginPath(); G.arc(x, y, r, 0, Math.PI * 2); fill(c); };
  function fit(s, maxW) {
    s = String(s);
    if (!maxW || G.measureText(s).width <= maxW) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (G.measureText(s.slice(0, mid) + '…').width <= maxW) lo = mid; else hi = mid - 1; }
    return s.slice(0, lo).trimEnd() + '…';
  }
  function text(s, x, y, sz, col = K.ink, w = 400, fam = FB, align = 'left', maxW = 0) {
    font(sz, w, fam); G.fillStyle = col; G.textAlign = align; G.textBaseline = 'alphabetic';
    G.fillText(fit(s, maxW), x, y);
  }
  const textW = (s, sz, w = 400, fam = FB) => { font(sz, w, fam); return G.measureText(String(s)).width; };
  function lines(s, maxW) {
    const out = []; let cur = '';
    for (const t of (String(s).match(TOK) || [])) {
      const blank = /^\s+$/.test(t);
      if (blank && !cur) continue;
      const test = cur + t;
      if (G.measureText(test.trimEnd()).width > maxW && cur.trim()) { out.push(cur.trimEnd()); cur = blank ? '' : t; }
      else cur = test;
    }
    if (cur.trim()) out.push(cur.trimEnd());
    return out;
  }
  /* a wrapped paragraph whose first baseline is y; returns the baseline after the last line */
  function para(s, x, y, maxW, sz, lh, col = K.ink, maxL = 99, w = 400, fam = FB) {
    font(sz, w, fam); G.fillStyle = col; G.textAlign = 'left'; G.textBaseline = 'alphabetic';
    const ls = lines(s, maxW), n = Math.min(ls.length, maxL);
    for (let i = 0; i < n; i++) G.fillText(i === n - 1 && ls.length > n ? fit(ls[i] + ' …', maxW) : ls[i], x, y + i * lh);
    return y + n * lh;
  }
  function icon(k, cx, cy, s, col) {
    G.fillStyle = col; G.beginPath();
    const tri = (x, dir) => { G.moveTo(x, cy - s / 2); G.lineTo(x + dir * s * 0.8, cy); G.lineTo(x, cy + s / 2); G.closePath(); };
    const bar = x => { G.rect(x, cy - s / 2, s * 0.22, s); };
    if (k === 'play') tri(cx - s * 0.35, 1);
    else if (k === 'pause') { bar(cx - s * 0.32); bar(cx + s * 0.1); }
    else if (k === 'next') { tri(cx - s * 0.5, 1); bar(cx + s * 0.32); }
    else if (k === 'prev') { bar(cx - s * 0.54); tri(cx + s * 0.5, -1); }
    else if (k === 'ff') { tri(cx - s * 0.8, 1); tri(cx, 1); }
    else if (k === 'rw') { tri(cx, -1); tri(cx + s * 0.8, -1); }
    G.fill();
  }
  function btn(id, x, y, w, h, label, o, fn) {
    o = o || {};
    const hov = UI.hover.has(id), on = !!o.on;
    rr(x, y, w, h, o.r || 14); fill(on ? 'rgba(231,176,76,0.17)' : hov ? K.raise2 : K.raise); stroke(on ? K.acc : hov ? K.muted : K.line2, hov ? 3 : 2);
    const col = o.dim ? K.faint : on ? K.acc : K.ink, sz = o.sz || 25;
    if (o.icon) {
      icon(o.icon, x + w / 2, y + (o.sub ? h * 0.40 : h / 2), o.is || 26, col);
      if (o.sub) text(o.sub, x + w / 2, y + h - 14, 19, K.muted, 400, FB, 'center', w - 10);
    } else if (o.check !== undefined) {
      rr(x + 16, y + h / 2 - 13, 26, 26, 6);
      if (o.check) { fill(K.acc); G.strokeStyle = K.bg; G.lineWidth = 4; G.beginPath(); G.moveTo(x + 22, y + h / 2); G.lineTo(x + 28, y + h / 2 + 6); G.lineTo(x + 37, y + h / 2 - 7); G.stroke(); }
      else stroke(K.muted, 2);
      text(label, x + 54, y + h / 2 + sz * 0.36, sz, col, 400, FB, 'left', w - 64);
    } else text(label, x + w / 2, y + h / 2 + sz * 0.36, sz, col, o.bold ? 600 : 500, FB, 'center', w - 18);
    if (fn) UI.hits.push({ id, x, y, w, h, fn });
  }
  const hitAt = (hits, px, py) => { for (let i = hits.length - 1; i >= 0; i--) { const r = hits[i]; if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return r; } return null; };

  /* ---------------------------------------------------------------- actions from the panel */
  function viewChanged() { refreshAll(); syncLayers(); renderPanel(); updateCutLabels(); }
  const tog = k => () => { VIEW[k] = !VIEW[k]; viewChanged(); };
  const cyc = (k, list) => () => { VIEW[k] = list[(list.indexOf(VIEW[k]) + 1) % list.length]; viewChanged(); };
  function switchLang() { const b = document.querySelector(`.lang button[data-lang="${LANG === 'zh' ? 'en' : 'zh'}"]`); if (b) b.click(); }
  function jumpStage(i) { P.si = i; P.t = 0; P.sub = null; applyStage({}); renderChips(); renderPanel(); renderHud(); }
  function cycleSpeed() { const sp = [0.5, 1, 2, 4]; P.speed = sp[(sp.indexOf(P.speed) + 1) % sp.length]; const e = $('#selSpeed'); if (e) e.value = String(P.speed); }
  function toggleDetail() { P.detail = !P.detail; const e = $('#chkDetail'); if (e) e.checked = P.detail; go(P.mi, 0); }
  function click(id, S) {
    const r = UI.hits.find(h => h.id === id);
    if (!r) return;
    r.fn(); UI.sig = ''; CAP.sig = ''; buzz(S, 0.5, 18);
  }

  /* ---------------------------------------------------------------- the wrist panel */
  const UI = { tab: 'now', grp: null, hover: new Set(), hits: [], sig: '' };
  let PANEL, CAP, TIP;
  const PX = 40, PWID = 944, CTOP = 246, CBOT = 1050;
  function buildPanel() { PANEL = canvasPlane(1024, 1336, 0.27); VR.root.add(PANEL.mesh); }
  function drawPanel() {
    const p = PANEL; G = p.g; UI.hits = [];
    G.clearRect(0, 0, p.w, p.h);
    rr(4, 4, p.w - 8, p.h - 8, 40); fill('rgba(12,20,27,0.96)'); stroke(K.line2, 3);
    text('HadCM3', PX, 76, 44, K.ink, 600, FD);
    text('VR', PX + textW('HadCM3', 44, 600, FD) + 12, 68, 24, K.acc, 500, FM);
    let x = p.w - 36;
    const hb = (id, label, w, o, fn) => { x -= w; btn(id, x, 26, w, 62, label, Object.assign({ sz: 23 }, o), fn); x -= 10; };
    hb('exit', tx(VU.exit), 150, {}, endSession);
    hb('reset', tx(VU.reset), 176, {}, resetGlobe);
    hb('pin', tx(VU.pin), 104, { on: VR.pinned }, () => { VR.pinned = !VR.pinned; });
    hb('lang', tx(VU.lang), 92, {}, switchLang);
    const [c1, c2] = clockText();
    text(`${c1} · ${c2}`, PX, 140, 23, K.acc, 500, FM, 'left', PWID);
    [['now', VU.tNow], ['det', VU.tDet], ['lay', VU.tLay], ['surf', VU.tSurf], ['help', VU.tHelp]].forEach(([k, l], i) =>
      btn('tab:' + k, PX + i * 190, 164, 180, 60, tx(l), { on: UI.tab === k, sz: 25 }, () => { UI.tab = k; if (k === 'surf') UI.grp = null; }));
    G.save(); G.beginPath(); G.rect(0, CTOP - 6, p.w, CBOT - CTOP + 6); G.clip();
    ({ now: drawNow, det: drawDet, lay: drawLay, surf: drawSurf, help: drawHelp })[UI.tab](CTOP);
    G.restore();
    G.beginPath(); G.moveTo(PX, CBOT + 8); G.lineTo(PX + PWID, CBOT + 8); stroke(K.line, 2);
    drawTransport(CBOT + 24);
    p.tex.needsUpdate = true;
  }
  function procName(st, n) { return n ? tx(n.t) : (st.p === 'init' ? tx(U.startup) : st.p === 'next' ? tx(U.dayN1) : tx(U.runEnd)); }
  function drawNow(y) {
    const st = P.list[P.si], [mod, p] = curProc(), n = procNode(mod, p), m = curMacro();
    const card = V1[LANG].STEPS[cardOf(st, p)];
    const yb = CBOT - 92;
    if (mod) { dot(PX + 12, y + 20, 11, compColor(mod)); text(tx(COMP[mod].n) + (n ? ' · ' + procNum(mod, p) : ''), PX + 34, y + 30, 26, compColor(mod), 600, FB, 'left', PWID - 40); }
    y = para(procName(st, n), PX, y + 88, PWID, 40, 48, K.ink, 2, 600, FD);
    if (n) y = para(n.r, PX, y + 2, PWID, 23, 30, K.muted, 2, 400, FM);
    if (n && (n.off || n.cond || n.loop)) {
      const t = tx(n.off ? U.off : n.cond || n.loop), w = Math.min(textW(t, 21, 500) + 28, PWID);
      rr(PX, y - 4, w, 36, 18); fill(n.off ? 'rgba(240,107,180,0.14)' : K.raise2); stroke(n.off ? '#F06BB4' : K.line2, 1.5);
      text(t, PX + 14, y + 21, 21, n.off ? '#F06BB4' : K.muted, 500, FB, 'left', PWID - 28); y += 46;
    }
    if (card) y = para(strip(card.title) + (card.call ? ' · ' + card.call : ''), PX, y + 8, PWID, 22, 30, K.faint, 2);
    if (n && n.d) y = para(tx(n.d), PX, y + 24, PWID, 26, 36, K.ink, Math.max(1, Math.floor((yb - 150 - y) / 36)));
    if (CUR.loop) { rr(PX, y + 6, PWID, 54, 12); fill('rgba(231,176,76,0.12)'); stroke('rgba(231,176,76,0.5)', 1.5); text(CUR.loop, PX + 18, y + 42, 24, K.acc, 500, FM, 'left', PWID - 36); y += 70; }
    const note = hudNote();
    if (note && y < yb - 80) y = para(note, PX, y + 30, PWID, 23, 32, K.muted, Math.max(1, Math.floor((yb - 70 - y) / 32)));
    if (m.kind === 'atm' && y < yb - 60) {
      const k = m.s - 1 + (st.p === 'k2' ? 1 : 0);
      text(fmt(U.accum, { n: k }), PX, y + 34, 21, K.muted, 400, FB, 'left', PWID);
      rr(PX, y + 46, PWID, 10, 5); fill(K.raise2); if (k) { rr(PX, y + 46, PWID * k / 48, 10, 5); fill(compColor('cpl')); }
    } else if (m.kind === 'ocn' && y < yb - 40) para(tx(U.oceanNote), PX, y + 34, PWID, 21, 30, K.muted, 1);
    /* the routines of this step, in call order */
    text(fmt(VU.routineOf, { i: P.si + 1, n: P.list.length }), PX, yb, 22, K.muted, 400, FB, 'left', PWID);
    const N = P.list.length, gap = N > 40 ? 2 : 4, bw = Math.min(56, (PWID - gap * (N - 1)) / N);
    P.list.forEach((s, i) => {
      const bx = PX + i * (bw + gap), id = 'st:' + i, c = compColor(s.mod || 'state');
      rr(bx, yb + 16, bw, 54, Math.min(8, bw / 3)); fill(i === P.si ? c : rgbaS(c, i < P.si ? 0.5 : 0.18));
      if (UI.hover.has(id) || i === P.si) stroke(K.ink, 2);
      UI.hits.push({ id, x: bx, y: yb + 10, w: bw + gap, h: 66, fn: () => jumpStage(i) });
    });
  }
  function drawDet(y) {
    const [mod, p] = curProc(), n = procNode(mod, p);
    if (n) {
      const { r, w, par } = rwOf(mod, p), colW = (PWID - 30) / 2, maxI = 7;
      const col = (list, x, title) => {
        text(title, x, y + 30, 24, K.muted, 600);
        if (!list.length) { text(tx(VU.none), x, y + 72, 23, K.faint); return; }
        list.slice(0, maxI).forEach((nd, i) => {
          const c = nd.k === 'in' || nd.k === 'out' ? nd.c : mod, yy = y + 72 + i * 38;
          dot(x + 9, yy - 8, 8, compColor(c));
          const where = nd.k === 'in' ? ` ← ${tx(COMP[c] ? COMP[c].n : c)}` : nd.k === 'out' ? ` → ${tx(COMP[c] ? COMP[c].n : c)}` : '';
          const t = tx(nd.t), tw = textW(t, 23);
          text(t, x + 26, yy, 23, K.ink, 400, FB, 'left', colW - 30);
          if (where && tw < colW - 60) text(where, x + 26 + tw, yy, 20, K.faint, 400, FB, 'left', colW - 34 - tw);
        });
        if (list.length > maxI) text(fmt(VU.more, { n: list.length - maxI }), x + 26, y + 72 + maxI * 38, 21, K.faint);
      };
      col(r, PX, tx(U.reads)); col(w, PX + colW + 30, tx(U.writes));
      y += 72 + Math.min(Math.max(r.length, w.length, 1), maxI + 1) * 38;
      if (par.length) {
        text(tx(U.params), PX, y + 24, 24, K.muted, 600);
        let cx = PX, cy = y + 44, cut = 0;
        par.forEach(rw => {
          const a = String(rw[0]), b = String(rw[3] || rw[1] || ''), wa = textW(a, 21, 500, FM), wb = textW(b, 21, 600, FM), cw = Math.min(wa + wb + 40, PWID);
          if (cx + cw > PX + PWID) { cx = PX; cy += 46; }
          if (cy > CBOT - 150) { cut++; return; }
          rr(cx, cy, cw, 38, 10); fill(K.raise); stroke(K.line2, 1.5);
          text(a, cx + 12, cy + 26, 21, K.muted, 500, FM);
          text(b, cx + 26 + wa, cy + 26, 21, K.acc, 600, FM, 'left', cw - wa - 34);
          cx += cw + 10;
        });
        if (cut) { text(fmt(VU.more, { n: cut }), PX, cy + 74, 21, K.faint); cy += 30; }
        y = cy + 52;
      }
    }
    const vis = visList();
    if (vis.length && y < CBOT - 80) {
      text(tx(VU.vis), PX, y + 30, 24, K.muted, 600); y += 66;
      for (const v of vis) { if (y > CBOT - 10) break; y = para('· ' + v, PX, y, PWID, 21, 29, K.ink, 3) + 8; }
    }
  }
  function drawLay(y) {
    const cw = (PWID - 14) / 2, h = 50, pitch = 57;
    let row = 0, colI = 0;
    const cell = (wide) => { if (wide && colI) { row++; colI = 0; } const r = { x: PX + colI * (cw + 14), y: y + row * pitch, w: wide ? PWID : cw }; if (wide) { row++; colI = 0; } else if (++colI > 1) { colI = 0; row++; } return r; };
    const chk = (id, label, on, fn, wide) => { const c = cell(wide); btn('l:' + id, c.x, c.y, c.w, h, tx(label), { check: !!on, sz: 23 }, fn); };
    const cy = (id, label, val, fn) => { const c = cell(false); btn('l:' + id, c.x, c.y, c.w, h, `${tx(label)}: ${val}`, { sz: 22 }, fn); };
    const stp = (id, label, dim, minus, plus) => {
      const c = cell(false);
      rr(c.x, c.y, c.w, h, 14); fill(K.bg); stroke(K.line, 1.5);
      btn('l:' + id + '-', c.x, c.y, 60, h, '−', { sz: 30 }, minus);
      btn('l:' + id + '+', c.x + c.w - 60, c.y, 60, h, '+', { sz: 30 }, plus);
      text(label, c.x + c.w / 2, c.y + h / 2 + 8, 22, dim ? K.faint : K.ink, 400, FB, 'center', c.w - 136);
    };
    chk('follow', U.follow, VIEW.follow, tog('follow')); chk('plants', U.plants, VIEW.plants, tog('plants'));
    chk('clouds', U.clouds, VIEW.clouds, tog('clouds')); chk('towers', U.towers, VIEW.towers, tog('towers'));
    chk('rain', U.rain, VIEW.rain, () => { VIEW.rain = VIEW.rain ? '' : 'ls'; RAIN.kind = ''; viewChanged(); }); chk('ice', U.ice, VIEW.ice, tog('ice'));
    chk('winds', U.winds, VIEW.winds, () => { VIEW.winds = VIEW.winds ? 0 : VR.windLev; viewChanged(); });
    chk('cur', U.currents, VIEW.currents, () => { VIEW.currents = VIEW.currents ? 0 : VR.curLev; viewChanged(); });
    if (VIEW.winds) VR.windLev = VIEW.winds;
    if (VIEW.currents) VR.curLev = VIEW.currents;
    const wl = k => () => { VR.windLev = clamp(VR.windLev + k, 1, 19); if (VIEW.winds) { VIEW.winds = VR.windLev; viewChanged(); } };
    const cl = k => () => { VR.curLev = clamp(VR.curLev + k, 1, 20); if (VIEW.currents) { VIEW.currents = VR.curLev; viewChanged(); } };
    stp('wl', fmt(VU.lev, { k: VR.windLev, p: fmtP(levelP(VR.windLev)) }), !VIEW.winds, wl(-1), wl(1));
    stp('cl', fmt(VU.dep, { k: VR.curLev, z: Math.round(ST.levels.ocn.z[VR.curLev - 1]) }), !VIEW.currents, cl(-1), cl(1));
    chk('runoff', U.runoff, VIEW.runoff, tog('runoff')); chk('psi', U.psi, VIEW.psi, tog('psi'));
    chk('gridA', U.gridA, VIEW.gridA, tog('gridA')); chk('gridO', U.gridO, VIEW.gridO, tog('gridO'));
    chk('cut', U.cut, VIEW.cut, tog('cut')); chk('cutFollow', VU.cutFollow, VIEW.cutFollow, tog('cutFollow'));
    stp('clon', fmt(VU.westFace, { v: VIEW.cutLon }), !VIEW.cut, () => { VIEW.cutLon = wrap360(VIEW.cutLon - 10); viewChanged(); }, () => { VIEW.cutLon = wrap360(VIEW.cutLon + 10); viewChanged(); });
    stp('cw', fmt(VU.width, { v: VIEW.cutW }), !VIEW.cut, () => { VIEW.cutW = clamp(VIEW.cutW - 10, 20, 140); viewChanged(); }, () => { VIEW.cutW = clamp(VIEW.cutW + 10, 20, 140); viewChanged(); });
    cy('cutA', U.cutA, tx(CUTA[VIEW.cutA].name), cyc('cutA', Object.keys(CUTA))); cy('cutO', U.cutO, tx(CUTO[VIEW.cutO].name), cyc('cutO', Object.keys(CUTO)));
    chk('shade', U.shade, VIEW.shade, tog('shade')); chk('autoCam', VU.autoCam, VIEW.autoCam, tog('autoCam'));
    cy('relief', U.relief, tx({ smooth: U.reliefSmooth, blocky: U.reliefBlocky, off: U.reliefOff }[VIEW.relief]), cyc('relief', ['smooth', 'blocky', 'off']));
    cy('vmode', U.vscale, tx(VIEW.vmode === 'levels' ? U.vLevels : U.vPhys), cyc('vmode', ['levels', 'phys']));
    chk('spin', U.spin, VIEW.spin, () => { VIEW.spin = !VIEW.spin; controls.autoRotate = VIEW.spin; const b = $('#btnSpin'); if (b) b.setAttribute('aria-pressed', String(VIEW.spin)); });
    chk('cap', VU.caption, VR.cap, () => { VR.cap = !VR.cap; });
    chk('cutCur', U.cutCur, VIEW.cutCur, tog('cutCur')); chk('detail', U.detail, P.detail, toggleDetail);
  }
  function colorbar(s, x, y, w, h, tsz) {
    if (s.cat) {
      let cx = x, cy = y;
      VEG.forEach(([c, n]) => { const t = tx(n), tw = textW(t, tsz) + 44; if (cx + tw > x + w) { cx = x; cy += tsz + 16; } rr(cx, cy, 22, 22, 4); fill(c); text(t, cx + 30, cy + 19, tsz, K.ink); cx += tw + 10; });
      return cy + tsz + 16;
    }
    const L3 = lut(s.cmap), seg = w / 256;
    for (let i = 0; i < 256; i++) { G.fillStyle = `rgb(${L3[i * 3]},${L3[i * 3 + 1]},${L3[i * 3 + 2]})`; G.fillRect(x + i * seg, y, seg + 0.6, h); }
    G.strokeStyle = K.line2; G.lineWidth = 1.5; G.strokeRect(x, y, w, h);
    niceTicks(s).forEach(([t, v]) => {
      const tx0 = x + t * w; G.fillStyle = K.muted; G.fillRect(tx0 - 1, y + h, 2, 8);
      text(fmtV(v), clamp(tx0, x + 20, x + w - 20), y + h + 10 + tsz, tsz, K.muted, 400, FM, 'center');
    });
    return y + h + 18 + tsz;
  }
  function drawSurf(y) {
    const s = SURF[VIEW.surf] || SURF.tstar;
    y = para(tx(s.name) + (unitsOf(s) ? ` (${unitsOf(s)})` : ''), PX, y + 40, PWID, 32, 40, K.ink, 2, 600);
    y = para(`${timeLabel(s)} · ${srcOf(s)}`, PX, y + 2, PWID, 21, 28, K.muted, 2);
    y = colorbar(s, PX, y + 10, PWID, 26, 20) + 18;
    let gi = UI.grp; if (gi == null) { gi = SURF_GROUPS.findIndex(([, keys]) => keys.includes(VIEW.surf)); if (gi < 0) gi = 0; }
    const gw = (PWID - 30) / 4;
    SURF_GROUPS.forEach(([g], i) => btn('sg:' + i, PX + i * (gw + 10), y, gw, 56, tx(U[g]), { on: i === gi, sz: 20 }, () => { UI.grp = i; }));
    y += 72;
    const keys = SURF_GROUPS[gi][1], cw = (PWID - 14) / 2, rows = Math.ceil(keys.length / 2), pitch = Math.min(64, (CBOT - y) / rows), h = pitch - 8;
    keys.forEach((k, i) => {
      const x = PX + (i % 2) * (cw + 14), yy = y + Math.floor(i / 2) * pitch;
      btn('sf:' + k, x, yy, cw, h, tx(SURF[k].name), { on: VIEW.surf === k, sz: 20 }, () => { VIEW.surf = k; viewChanged(); });
    });
  }
  function drawHelp(y) {
    y += 40;
    for (const [t, d] of HELP) {
      if (y > CBOT - 30) break;
      text(tx(t), PX, y, 25, K.acc, 600, FB, 'left', PWID);
      y = para(tx(d), PX, y + 34, PWID, 22, 30, K.ink, 4) + 22;
    }
  }
  function tickKind(mi) {
    if (mi >= 1 && mi <= 48) return (mi - 1) % 6 === 0 ? '#E7B04C' : '#6FAEE0';
    if (mi === 49 || mi === 74) return '#E5864A';
    if (mi >= 50 && mi <= 73) return '#35B6C2';
    return '#95A6AE';
  }
  function drawTransport(y) {
    const n = MACRO.length, tw = PWID / n;
    for (let mi = 0; mi < n; mi++) {
      const x = PX + mi * tw, c = tickKind(mi), cur = mi === P.mi, id = 'tl:' + mi, hov = UI.hover.has(id);
      rr(x + 1, cur ? y : y + 8, tw - 3, cur ? 52 : 36, 3); fill(cur ? K.ink : rgbaS(c, mi < P.mi ? 0.95 : hov ? 0.8 : 0.32));
      UI.hits.push({ id, x, y: y - 4, w: tw, h: 64, fn: () => go(mi, 0) });
    }
    const lab = (s, a, b) => text(s, PX + (a + b + 1) / 2 * tw, y + 82, 19, K.muted, 400, FB, 'center', (b - a + 1) * tw + 40);
    lab(tx(U.atmGroup), 1, 48); lab(tx(U.ocnGroup), 50, 73);
    const by = y + 104, bh = 104, bw = (PWID - 50) / 6;
    const items = [
      ['rw', 'rw', tx(VU.step), () => go(P.mi - 1, 0)],
      ['pv', 'prev', tx(VU.routine), () => advance(-1)],
      ['pl', P.playing ? 'pause' : 'play', P.playing ? tx(U.pause).replace(/^\S+\s*/, '') : tx(U.play).replace(/^\S+\s*/, ''), togglePlay],
      ['nx', 'next', tx(VU.routine), () => advance(1)],
      ['ff', 'ff', tx(VU.step), () => go(P.mi + 1, 0)],
    ];
    items.forEach(([id, ic, sub, fn], i) => btn('tp:' + id, PX + i * (bw + 10), by, bw, bh, '', { icon: ic, sub, is: 34, on: id === 'pl' && P.playing }, fn));
    btn('tp:sp', PX + 5 * (bw + 10), by, bw, bh, '', {}, cycleSpeed);
    text(`${P.speed}×`, PX + 5 * (bw + 10) + bw / 2, by + 52, 34, K.ink, 600, FM, 'center');
    text(tx(VU.speed), PX + 5 * (bw + 10) + bw / 2, by + bh - 14, 19, K.muted, 400, FB, 'center');
  }
  function panelSig() {
    return [UI.tab, UI.grp, P.mi, P.si, P.sub, P.playing, P.speed, P.detail, LANG, CUR.loop, VR.pinned, VR.cap, VR.windLev, VR.curLev,
      JSON.stringify(VIEW), [...UI.hover].join(',')].join('|');
  }

  /* ---------------------------------------------------------------- caption under the globe, pointer label */
  function buildCaption() { CAP = canvasPlane(1024, 212, 0.40); VR.root.add(CAP.mesh); }
  function drawCaption(now) {
    const c = CAP; G = c.g;
    G.clearRect(0, 0, c.w, c.h);
    rr(4, 4, c.w - 8, c.h - 8, 30); fill('rgba(12,20,27,0.84)'); stroke(K.line2, 2);
    const [c1, c2] = clockText(), [mod, p] = curProc(), n = procNode(mod, p), st = P.list[P.si];
    text(`${c1} · ${c2}`, 34, 54, 26, K.acc, 500, FM, 'left', 956);
    if (mod) dot(46, 96, 11, compColor(mod));
    text((mod ? tx(COMP[mod].n) + ' · ' : '') + procName(st, n), mod ? 68 : 34, 107, 32, K.ink, 600, FB, 'left', 920);
    if (now < VR.hintUntil && !VR.panelOn) text(tx(VU.hint), 34, 166, 26, K.acc, 500, FB, 'left', 956);
    else if (CUR.loop) text(CUR.loop, 34, 164, 24, K.acc, 500, FM, 'left', 956);
    else {
      const s = SURF[VIEW.surf] || SURF.tstar;
      text(tx(s.name) + (unitsOf(s) ? ` (${unitsOf(s)})` : ''), 34, 164, 23, K.muted, 400, FB, 'left', 440);
      if (!s.cat) colorbar(s, 490, 142, 500, 22, 19);
    }
    c.tex.needsUpdate = true;
  }
  function buildTip() { TIP = canvasPlane(640, 220, 0.15); TIP.mesh.renderOrder = 105; TIP.mesh.material.depthTest = false; TIP.key = ''; VR.root.add(TIP.mesh); }
  function tipLines(lat, lon) {
    const s = SURF[VIEW.surf] || SURF.tstar, jO = clamp(Math.round((lat + 89.375) / 1.25), 0, 143), iO = Math.round(lon / 1.25) % 288, a = idxA(lat, lon), land = KMT[jO * 288 + iO] === 0;
    let val;
    if (s.cat) { const q = vegAt(lat, lon); val = q >= 0 ? tx(VEG[q][1]) : '—'; }
    else { const v = surfValue(s, jO, iO); const masked = (s.mask === 'ocean' && land) || (s.mask === 'land' && !land) || (s.mask === 'oceanA' && LSM[a] > 0.5); val = masked || !(v === v) ? '—' : `${fmtV(v)} ${unitsOf(s)}`; }
    const out = [[`${fmtLat(lat)} ${lon.toFixed(1)}°E · ${tx(land ? U.tipLand : U.tipSea)}`, 28, K.ink, 600, FB],
      [`${tx(U.tipA)} i=${a % 96 + 1}, j=${Math.floor(a / 96) + 1} · ${tx(U.tipO)} i=${iO + 1}, j=${jO + 1}`, 20, K.muted, 400, FM],
      [`${tx(s.name)}: ${val}`, 24, K.acc, 500, FB]];
    if (VIEW.winds) { const k = VIEW.winds - 1, g = ST.grids.AU, u = bilin(F.u.lev(k), g, lat, lon), v = bilin(F.v.lev(k), g, lat, lon); out.push([`${tx(U.winds)} k=${VIEW.winds}: ${Math.hypot(u, v).toFixed(1)} m/s`, 22, K.ink, 400, FB]); }
    else if (VIEW.currents && !land) { const k = VIEW.currents - 1, g = ST.grids.OU, u = bilin(F.U.lev(k), g, lat, lon), v = bilin(F.V.lev(k), g, lat, lon); if (u === u) out.push([`${tx(U.currents)}: ${Math.hypot(u, v).toFixed(1)} cm/s`, 22, K.ink, 400, FB]); }
    return { key: [jO, iO, VIEW.surf, VIEW.winds, VIEW.currents, LANG, s.diurnal ? Math.round(MODEL_T * 4) : 0].join('|'), out };
  }
  function drawTip(out) {
    G = TIP.g; G.clearRect(0, 0, TIP.w, TIP.h);
    rr(3, 3, TIP.w - 6, TIP.h - 6, 22); fill('rgba(12,20,27,0.92)'); stroke(K.line2, 2);
    let y = 46;
    out.forEach(([s, sz, col, w, fam]) => { text(s, 24, y, sz, col, w, fam, 'left', TIP.w - 48); y += sz + 16; });
    TIP.tex.needsUpdate = true;
  }

  /* ---------------------------------------------------------------- per-frame */
  const _pa = new V3(), _pb = new V3(), _pc = new V3(), _pn = new V3(), _pq = new Q(), _pk = new V3(), _mi = new THREE.Matrix4(), _dummy = new THREE.Object3D();
  const holdsPanel = S => VR.panelOn && !VR.pinned && S.side === 'left';
  function palm(S, c, n) {
    if (S.hand) {
      const j = S.h.joints; if (!j) return false;
      const w = j['wrist'], im = j['index-finger-metacarpal'], pm = j['pinky-finger-metacarpal'], mm = j['middle-finger-metacarpal'];
      if (!w || !im || !pm || !mm || !w.visible) return false;
      w.getWorldPosition(c); im.getWorldPosition(_pa); pm.getWorldPosition(_pb);
      _pa.sub(c); _pb.sub(c); n.crossVectors(_pa, _pb);           /* left hand: index × pinky points out of the palm */
      if (n.lengthSq() < 1e-8) return false;
      n.normalize(); mm.getWorldPosition(_pa); c.add(_pa).multiplyScalar(0.5);
      return true;
    }
    if (!S.g.visible) return false;
    S.g.getWorldPosition(c); S.g.getWorldQuaternion(_pq); n.set(1, 0, 0).applyQuaternion(_pq);   /* grip space: +X leaves the left palm */
    return true;
  }
  function updatePanel(dt, now) {
    const LP = VR.src.find(s => s.src && s.side === 'left');
    let want = VR.pinned && VR.panelOn;
    if (!VR.pinned && LP && palm(LP, _pc, _pn)) {
      const face = _pn.dot(_pa.copy(VR.head).sub(_pc).normalize());
      want = _pc.y > VR.head.y - 0.75 && face > (VR.panelOn ? 0.3 : 0.62);
      if (want) {
        _dummy.position.copy(_pc).addScaledVector(_pn, 0.05).addScaledVector(UP, PANEL.mh / 2 + 0.06);
        _dummy.lookAt(VR.head);
        const k = PANEL.op < 0.05 ? 1 : 1 - Math.exp(-dt * 16);
        PANEL.mesh.position.lerp(_dummy.position, k); PANEL.mesh.quaternion.slerp(_dummy.quaternion, k);
      }
    }
    VR.panelOn = want;
    PANEL.op = clamp(PANEL.op + (want ? 1 : -1) * dt * 7, 0, 1);
    PANEL.mesh.material.opacity = PANEL.op; PANEL.mesh.visible = PANEL.op > 0.01;
    PANEL.mesh.updateMatrixWorld();
    if (PANEL.mesh.visible) { const s = panelSig(); if (s !== UI.sig && (now - PANEL.t > 0.06 || !UI.sig)) { UI.sig = s; PANEL.t = now; drawPanel(); } }
  }
  function rayPlane(Pl, o, d) {
    _mi.copy(Pl.mesh.matrixWorld).invert();
    const lo = o.clone().applyMatrix4(_mi), ld = d.clone().transformDirection(_mi);
    if (lo.z <= 0 || ld.z > -1e-6) return null;
    const t = -lo.z / ld.z, x = lo.x + ld.x * t, y = lo.y + ld.y * t;
    if (Math.abs(x) > Pl.mw / 2 || Math.abs(y) > Pl.mh / 2) return null;
    return { dist: t, point: o.clone().addScaledVector(d, t), px: (x / Pl.mw + 0.5) * Pl.w, py: (0.5 - y / Pl.mh) * Pl.h };
  }
  function updatePointers() {
    const hov = new Set(), o = new V3(), d = new V3(), panelLive = PANEL.mesh.visible && PANEL.op > 0.6;
    let tipP = null, tipS = null;
    VR.src.forEach(S => {
      S.hov = null;
      if (!S.src || holdsPanel(S)) { S.ray.visible = S.dot.visible = false; return; }
      rayOf(S, o, d);
      let best = null;
      if (panelLive) { const h = rayPlane(PANEL, o, d); if (h) { const r = hitAt(UI.hits, h.px, h.py); best = { kind: 'panel', dist: h.dist, point: h.point, id: r ? r.id : null }; } }
      const gh = raySphere(o, d, gscale() * 1.01);
      if (gh && (!best || gh.dist < best.dist)) best = { kind: 'globe', dist: gh.dist, point: gh.point };
      S.hov = best;
      if (best && best.id && !S.mode) hov.add(best.id);
      S.ray.visible = !S.hand || !!best || !!S.mode;
      S.ray.scale.set(1, 1, best ? best.dist : 1.2);
      S.dot.visible = !!best; if (best) S.dot.position.copy(best.point);
      if (best && best.kind === 'globe' && (!tipS || S.side === 'right')) { tipP = best.point; tipS = S; }
      /* index-finger poke on the panel */
      if (S.hand && panelLive) {
        const tip = S.h.joints && S.h.joints['index-finger-tip'];
        if (tip && tip.visible) {
          tip.getWorldPosition(_pk); PANEL.mesh.worldToLocal(_pk);
          const inside = Math.abs(_pk.x) < PANEL.mw / 2 && Math.abs(_pk.y) < PANEL.mh / 2;
          if (inside && _pk.z < 0.05 && _pk.z > -0.04) {
            const r = hitAt(UI.hits, (_pk.x / PANEL.mw + 0.5) * PANEL.w, (0.5 - _pk.y / PANEL.mh) * PANEL.h);
            if (r) hov.add(r.id);
            if (!S.poked && _pk.z < 0.008) { S.poked = true; if (r) click(r.id, S); }
          }
          if (!inside || _pk.z > 0.025) S.poked = false;
        }
      }
    });
    UI.hover = hov;
    /* the value under the pointer */
    if (tipP) {
      const lp = scene.worldToLocal(tipP.clone()), [lat, lon] = lonlatOf(lp);
      if (inCut(lon)) tipP = null;
      else {
        const { key, out } = tipLines(lat, lon);
        if (key !== TIP.key) { TIP.key = key; drawTip(out); }
        const toHead = _pa.copy(VR.head).sub(tipP), dist = toHead.length(); toHead.normalize();
        const k = clamp(dist / 0.8, 0.4, 2.5);
        TIP.mesh.scale.setScalar(k);
        TIP.mesh.position.copy(tipP).addScaledVector(toHead, Math.min(0.06 * k, dist * 0.3)).addScaledVector(UP, TIP.mh * k * 0.75);
        TIP.mesh.lookAt(VR.head);
      }
    }
    TIP.mesh.visible = !!tipP; TIP.mesh.material.opacity = 1;
  }
  function updateCaption(now) {
    const on = VR.cap;
    CAP.mesh.visible = on; CAP.mesh.material.opacity = 1;
    if (!on) return;
    const hint = now < VR.hintUntil && !VR.panelOn;
    const sig = [P.mi, P.si, P.sub, LANG, CUR.loop, VIEW.surf, hint].join('|');
    if (sig !== CAP.sig && now - CAP.t > 0.06) { CAP.sig = sig; CAP.t = now; drawCaption(now); }
    CAP.mesh.position.copy(scene.position).addScaledVector(UP, -(gscale() * (1 + ATM_H) + 0.04 + CAP.mh / 2));
    _pa.copy(VR.head).sub(CAP.mesh.position); _pa.y = 0;
    if (_pa.lengthSq() > 1e-6) CAP.mesh.position.addScaledVector(_pa.normalize(), gscale() * 0.5);
    CAP.mesh.lookAt(VR.head);
  }
  function vrFrame(dt, now) {
    if (!VR.on) return;
    VR.frames++;
    VR.head.copy(camera.position);
    if (!VR.placed) { if (VR.frames > 2) place(); else return; }
    readPads(dt);
    updateGrabs();
    if (VR.tween && !grabbing()) {
      const T = VR.tween; T.t += dt; const x = smooth(clamp(T.t / T.dur, 0, 1));
      scene.quaternion.slerpQuaternions(T.from, T.to, x);
      if (x >= 1) VR.tween = null;
    }
    if (VIEW.spin && !grabbing()) scene.quaternion.multiply(_q.setFromAxisAngle(UP, dt * 0.08));
    scene.updateMatrixWorld(true);
    updatePanel(dt, now);
    updatePointers();
    updateCaption(now);
  }
  VR.debug = { drawPanel: () => drawPanel(), drawCaption: () => drawCaption(performance.now() / 1000), UI, get PANEL() { return PANEL; }, get CAP() { return CAP; }, get TIP() { return TIP; }, click, place, faceTo };
})();
