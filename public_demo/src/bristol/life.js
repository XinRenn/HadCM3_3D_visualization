/* People and plants on the harbourside.
   People: 10, instanced part by part (legs, body, coat, arms, head, hair, hats, scarf, umbrella, blob shadow).
     Outfit by temperature band (BANDS.outfit): cold = coat, scarf, woolly hat; cool = jacket and trousers;
     warm = light clothes; hot = shorts and sun hat. Umbrellas in steady or heavy rain. Purely visual.
     If the quay a person stands on is under water, they move onto a boat (or leave if there is none).
   Plants: one set per vegetation type in VEG_SETS. Add a type there (and its colour in globe.js PALETTES)
     to extend the list; each set says the ground colour and how many of each tree kind to scatter. */
import * as THREE from 'three';
import { toon } from './materials.js';
import * as A from './assets.js';
import { BANDS } from '../data.js';
import { rng } from './scene.js';

/* ---------------------------------------------------------------- plants */
export const VEG_SETS = {
  tundra: { ground: '#B7B58E', kinds: { tuft: 1.0, shrub: 0.55, dwarf: 0.25 }, density: 0.55, crowns: ['#8E9A5B', '#A3A86A', '#7D8C55'] },
  steppe: { ground: '#D9C77B', kinds: { tuft: 1.0, shrub: 0.35, dwarf: 0.1 }, density: 0.55, crowns: ['#B5A955', '#C9B866', '#9AA453'] },
  temperate_forest: { ground: '#7CC46A', kinds: { round: 1.0, cone: 0.25, shrub: 0.35 }, density: 1.0, crowns: ['#3FAE55', '#4FBF5E', '#2F9A4C', '#66C766'] },
  mediterranean: { ground: '#BFC27A', kinds: { umbrella: 0.55, cypress: 0.65, shrub: 0.6, tuft: 0.3 }, density: 0.8, crowns: ['#7E9A4E', '#6E8C45', '#93A85A'] },
  subtropical: { ground: '#5DBB6A', kinds: { palm: 0.8, round: 0.5, shrub: 0.45 }, density: 1.0, crowns: ['#2FA35A', '#3DBA66', '#22905A'] },
  desert_scrub: { ground: '#E3C48A', kinds: { cactus: 0.4, shrub: 0.45, tuft: 0.5 }, density: 0.45, crowns: ['#8FA35A', '#A9A65E', '#7E9B55'] },
};
const FALLBACK = 'temperate_forest';

/* tree kinds: [trunk geometry or null, crown geometry], base at y = 0, metres */
function kinds() {
  const ico = (r, y, sy = 1, d = 0) => { const g = new THREE.IcosahedronGeometry(r, d); g.scale(1, sy, 1); g.translate(0, y, 0); return g.toNonIndexed(); };
  const tr = (r, h) => { const g = new THREE.CylinderGeometry(r * 0.8, r, h, 6, 1, true); g.translate(0, h / 2, 0); return g.toNonIndexed(); };
  const cone = (r, h, y) => { const g = new THREE.ConeGeometry(r, h, 7, 1, true); g.translate(0, y + h / 2, 0); return g.toNonIndexed(); };
  const join = gs => A.merge(gs.map(g => ({ g, c: new THREE.Color(1, 1, 1) })));
  const palmLeaves = () => { const gs = []; for (let k = 0; k < 7; k++) { const g = new THREE.BoxGeometry(0.35, 0.06, 2.4); g.translate(0, 0, 1.2); g.rotateX(0.5); g.rotateY(k / 7 * Math.PI * 2); g.translate(0.35, 5.4, 0); gs.push(g.toNonIndexed()); } return join(gs); };
  const palmTrunk = () => { const gs = []; for (let k = 0; k < 5; k++) { const g = new THREE.CylinderGeometry(0.17, 0.22, 1.12, 6, 1, true); g.translate(k * 0.08, 0.56 + k * 1.1, 0); gs.push(g.toNonIndexed()); } return join(gs); };
  const cactus = () => join([tr(0.32, 2.4), (() => { const g = new THREE.CylinderGeometry(0.18, 0.18, 0.9, 6); g.translate(0.55, 1.5, 0); return g.toNonIndexed(); })(),
    (() => { const g = new THREE.CylinderGeometry(0.18, 0.18, 0.6, 6); g.rotateZ(Math.PI / 2); g.translate(0.35, 1.1, 0); return g.toNonIndexed(); })(), ico(0.32, 2.4)]);
  return {
    round: [tr(0.22, 2.6), join([ico(2.0, 3.9, 0.95), ico(1.3, 4.9, 0.9)])],
    cone: [tr(0.2, 1.2), join([cone(1.7, 3.2, 1.0), cone(1.3, 2.6, 2.6), cone(0.8, 2.0, 4.0)])],
    cypress: [tr(0.18, 0.8), cone(0.75, 6.2, 0.5)],
    umbrella: [tr(0.2, 4.6), ico(2.6, 5.0, 0.42, 1)],
    palm: [palmTrunk(), palmLeaves()],
    shrub: [null, join([ico(0.9, 0.55, 0.75), ico(0.6, 0.6, 0.8)].map((g, k) => { if (k) g.translate(0.6, 0, 0.2); return g; }))],
    dwarf: [tr(0.08, 0.6), ico(0.7, 1.0, 0.8)],
    tuft: [null, join([cone(0.12, 0.7, 0), cone(0.1, 0.55, 0), cone(0.1, 0.6, 0)].map((g, k) => { g.translate(Math.cos(k * 2.1) * 0.15, 0, Math.sin(k * 2.1) * 0.15); return g; }))],
    cactus: [null, cactus()],
  };
}

/* ---------------------------------------------------------------- people */
const SKIN = ['#F2C9A0', '#D9A066', '#A86B3C', '#7A4A2A', '#F5D5B8', '#C68A5A'];
const HAIR = ['#2B2222', '#5A3A22', '#C9A35A', '#1B1B1B', '#8C4A2A', '#B0B0B0'];
const OUTFIT = {
  cold: { body: ['#2F4A6E', '#6B2E3A', '#3E5A3A', '#4A4A58'], legs: ['#2B2F3A', '#3B3B46'], coat: true, scarf: true, hat: 'beanie', arms: 'sleeve', shorts: false },
  cool: { body: ['#E8364F', '#2D8CFF', '#F0A030', '#5A9E6E', '#7A5AC0'], legs: ['#3A4A6A', '#2B2F3A', '#6B5A4A'], coat: false, scarf: false, hat: 'hair', arms: 'sleeve', shorts: false },
  warm: { body: ['#FFD966', '#9FD8CB', '#F7A1A1', '#FFFFFF', '#B5E08A'], legs: ['#5A7AB0', '#E8D9B0', '#3A4A6A'], coat: false, scarf: false, hat: 'hair', arms: 'skin', shorts: false },
  hot: { body: ['#FFE066', '#FF8A6E', '#7FD6FF', '#FFFFFF', '#B9F28A'], legs: ['#F2C14E', '#5AB0E0', '#F08A5D'], coat: false, scarf: false, hat: 'sunhat', arms: 'skin', shorts: true },
};

export default class Life {
  constructor(city) { this.city = city; this.veg = null; }

  init() {
    this._plantsInit();
    this._peopleInit();
  }

  /* ---------------- plants */
  _plantsInit() {
    const c = this.city, T = c.T, r = rng(21), spots = [];
    const free = (x, z) => T.surfaceAt(x, z) === 'grass';
    /* between the rows of houses on the hill, at the quay ends, and a park to the left */
    for (let z = -49; z >= -175; z -= 10.5) for (let x = -235; x <= 235; x += 8 + r() * 9) { const zz = z + (r() - 0.5) * 2; if (free(x, zz)) spots.push([x, zz, 'hill']); }
    for (let i = 0; i < 45; i++) { const x = -150 + r() * 70, z = -38 - r() * 40; if (free(x, z)) spots.push([x, z, 'park']); }
    for (let z = 52; z <= 165; z += 16) for (let x = -235; x <= 235; x += 9 + r() * 10) { const zz = z + 5 + (r() - 0.5) * 2; if (free(x, zz)) spots.push([x, zz, 'hill']); }
    /* planters on the quays, near you */
    for (const x of [-50, -42, 30, 38, 46]) spots.push([x, T.harbour.zSouth - 4.5, 'quay']);
    for (const x of [-26, -14, 12, 24]) spots.push([x, T.harbour.zNorth + 4.5, 'quay']);
    this.vegSpots = spots.map(([x, z, k]) => ({ x, z, k, y: T.heightAt(x, z), r1: r(), r2: r(), r3: r(), s: 0.8 + r() * 0.45, ry: r() * 6.28 }));
    const K = kinds();
    this.kind = {};
    const trunkMat = toon({ color: 0x8A5A3B, sway: 0.0035 }), crownMat = toon({ sway: 0.0035 });
    const cap = spots.length;
    for (const [name, [tg, cg]] of Object.entries(K)) {
      const k = { name };
      if (tg) { k.trunk = new THREE.InstancedMesh(tg, trunkMat, cap); k.trunk.count = 0; c.root.add(k.trunk); }
      k.crown = new THREE.InstancedMesh(cg, crownMat, cap); k.crown.count = 0; c.root.add(k.crown);
      this.kind[name] = k;
    }
    const sg = new THREE.CircleGeometry(1, 12); sg.rotateX(-Math.PI / 2);
    this.treeShadow = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x1B2A4A, transparent: true, opacity: 0.18, depthWrite: false }), cap);
    this.treeShadow.count = 0; this.treeShadow.renderOrder = 1; c.root.add(this.treeShadow);
  }
  _plants(type) {
    if (type === this.veg) return;
    const set = VEG_SETS[type] || VEG_SETS[FALLBACK];
    this.veg = type;
    this.city.groundColor(set.ground);
    const names = Object.keys(set.kinds), wsum = names.reduce((s, n) => s + set.kinds[n], 0);
    const counts = {}; for (const n in this.kind) counts[n] = 0;
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0), C = new THREE.Color();
    let ns = 0;
    for (const sp of this.vegSpots) {
      if (sp.k !== 'quay' && sp.r1 > set.density) continue;
      let pick = sp.r2 * wsum, name = names[0];
      for (const n of names) { pick -= set.kinds[n]; if (pick <= 0) { name = n; break; } }
      const k = this.kind[name], i = counts[name]++;
      const s = sp.s * (sp.k === 'quay' ? 0.8 : 1);
      M.compose(P.set(sp.x, sp.y - 0.05, sp.z), Q.setFromAxisAngle(Y, sp.ry), S.set(s, s, s));
      if (k.trunk) k.trunk.setMatrixAt(i, M);
      k.crown.setMatrixAt(i, M);
      k.crown.setColorAt(i, C.set(set.crowns[Math.floor(sp.r3 * set.crowns.length)]));
      const big = { round: 2.2, cone: 1.7, cypress: 0.9, umbrella: 2.5, palm: 1.8, shrub: 1, dwarf: 0.8, tuft: 0.35, cactus: 0.6 }[name] * s;
      M.compose(P.set(sp.x, sp.y + 0.04, sp.z), Q.identity(), S.set(big, 1, big)); this.treeShadow.setMatrixAt(ns++, M);
    }
    for (const n in this.kind) {
      const k = this.kind[n]; k.crown.count = counts[n]; k.crown.instanceMatrix.needsUpdate = true; if (k.crown.instanceColor) k.crown.instanceColor.needsUpdate = true;
      if (k.trunk) { k.trunk.count = counts[n]; k.trunk.instanceMatrix.needsUpdate = true; }
      k.crown.visible = counts[n] > 0; if (k.trunk) k.trunk.visible = counts[n] > 0;
      k.crown.computeBoundingSphere(); if (k.trunk) k.trunk.computeBoundingSphere();
    }
    this.treeShadow.count = ns; this.treeShadow.instanceMatrix.needsUpdate = true;
  }

  /* ---------------- people */
  _peopleInit() {
    const c = this.city, T = c.T, r = rng(31), N = 10;
    const zS = T.harbour.zSouth, zN = T.harbour.zNorth;
    /* where each person spends their time: [x0, x1, z, walks?] */
    const beats = [[-30, -4, zS - 2.5, 1], [4, 30, zS - 3.2, 1], [-20, 20, zS - 6, 1], [-8, -8, zS - 1.2, 0], [6, 6, zS - 1.0, 0],
      [-14, 14, zN + 2.5, 1], [-6, -6, zN + 1.4, 0], [9, 22, zN + 5, 1], [-40, -18, zS - 1.8, 1], [24, 24, zN + 1.5, 0]];
    this.people = beats.slice(0, N).map(([x0, x1, z, walk], i) => ({
      x0, x1, z, walk: !!walk, x: x0 + (x1 - x0) * r(), dir: r() < 0.5 ? -1 : 1, sp: 0.7 + r() * 0.6, ph: r() * 6.28,
      skin: SKIN[i % SKIN.length], hair: HAIR[(i * 5) % HAIR.length], pick: r(), face: z < 0 ? 0 : Math.PI, h: 0.92 + r() * 0.16, child: i % 4 === 3,
      boat: null, hidden: false,
    }));
    const box = (w, h, d, y) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(0, y, 0); return g.toNonIndexed(); };
    const leg = (y0, y1) => { const g = new THREE.BoxGeometry(0.15, y1 - y0, 0.17); g.translate(0, -(0.82 - (y0 + y1) / 2), 0); return g.toNonIndexed(); };    // pivot at the hip (0.82 m)
    const arm = () => { const g = new THREE.BoxGeometry(0.11, 0.58, 0.12); g.translate(0, -0.29, 0); return g.toNonIndexed(); };                      // pivot at the shoulder
    const hairG = new THREE.SphereGeometry(0.175, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55); hairG.translate(0, 1.6, -0.01);
    const beanie = new THREE.SphereGeometry(0.18, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5); beanie.translate(0, 1.63, 0);
    const sunhat = A.merge([A.cyl(0.36, 0.36, 0.03, 14, '#ffffff', 0, 1.66), A.cyl(0.15, 0.18, 0.16, 12, '#ffffff', 0, 1.66)]);
    const scarf = box(0.36, 0.12, 0.28, 1.38);
    const umb = A.merge([A.part(new THREE.ConeGeometry(0.62, 0.3, 8), '#ffffff', { y: 2.12 }), A.cyl(0.015, 0.015, 1.0, 4, '#555555', 0, 1.15)]);
    const mk = (geo, n, o = {}) => { const m = new THREE.InstancedMesh(geo, toon(Object.assign({ snow: false }, o)), n); m.frustumCulled = false; c.root.add(m); return m; };
    this.P = {
      legU: mk(leg(0.45, 0.82), N * 2), legL: mk(leg(0.0, 0.45), N * 2),
      body: mk(box(0.42, 0.62, 0.25, 1.1), N), coat: mk(box(0.46, 0.42, 0.29, 0.62), N),
      arm: mk(arm(), N * 2), head: mk(new THREE.IcosahedronGeometry(0.17, 1).translate(0, 1.58, 0), N),
      hair: mk(hairG.toNonIndexed(), N), beanie: mk(beanie.toNonIndexed(), N), sunhat: mk(sunhat, N, { vertexColors: true }),
      scarf: mk(scarf, N), umb: mk(umb, N, { vertexColors: true }),
    };
    const sg = new THREE.CircleGeometry(0.42, 12); sg.rotateX(-Math.PI / 2);
    this.shadow = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ color: 0x1B2A4A, transparent: true, opacity: 0.25, depthWrite: false }), N);
    this.shadow.renderOrder = 1; this.shadow.frustumCulled = false; c.root.add(this.shadow);
    this.outfit = 'cool'; this.umbrella = false;
    this._dress();
  }
  _dress() {
    const o = OUTFIT[this.outfit] || OUTFIT.cool, C = new THREE.Color(), P = this.P;
    this.people.forEach((p, i) => {
      const body = o.body[Math.floor(p.pick * o.body.length)], legs = o.legs[Math.floor(p.pick * 7) % o.legs.length];
      P.body.setColorAt(i, C.set(body)); P.coat.setColorAt(i, C.set(body));
      for (const s of [0, 1]) { P.legU.setColorAt(i * 2 + s, C.set(legs)); P.legL.setColorAt(i * 2 + s, C.set(o.shorts ? p.skin : legs)); P.arm.setColorAt(i * 2 + s, C.set(o.arms === 'skin' ? p.skin : body)); }
      P.head.setColorAt(i, C.set(p.skin)); P.hair.setColorAt(i, C.set(p.hair));
      P.beanie.setColorAt(i, C.set(['#E8364F', '#FFC93C', '#2D8CFF', '#2FB65A'][i % 4])); P.sunhat.setColorAt(i, C.set(['#F5E6B8', '#FFFFFF', '#F2C14E'][i % 3]));
      P.scarf.setColorAt(i, C.set(['#FFC93C', '#E8364F', '#FFFFFF', '#2FB65A'][(i + 1) % 4])); P.umb.setColorAt(i, C.set(['#E8364F', '#2D8CFF', '#FFC93C', '#7A5AC0', '#2FB65A'][i % 5]));
    });
    for (const m of Object.values(P)) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
  /* each person's ground: their quay, or a boat if the quay is under water */
  _place() {
    const c = this.city, boats = c.boats.slice(), used = new Set();
    for (const p of this.people) {
      const ground = c.T.heightAt(p.x0, p.z);
      p.boat = null; p.hidden = false;
      if (ground < c.waterY + 0.15) {
        const b = boats.find(q => !used.has(q) && !q.userData.aground);
        if (b) { used.add(b); p.boat = b; } else p.hidden = true;
      }
    }
  }

  /* ---------------- data -> people and plants */
  apply(v, c) {
    this._plants(v.vegetation || null);
    const o = BANDS.outfit(v.temp_c) || 'cool';
    if (o !== this.outfit) { this.outfit = o; this._dress(); }
    const rb = BANDS.rain(v.rain_mm_yr);
    this.umbrella = !BANDS.snowfall(v.snow_depth_cm, v.temp_c) && (rb === 'steady' || rb === 'heavy');
    this._place();
  }

  update(dt, t, c) {
    const P = this.P, o = OUTFIT[this.outfit] || OUTFIT.cool, M = new THREE.Matrix4(), Mb = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler();
    const V = new THREE.Vector3(), S = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 0);
    const hide = new THREE.Matrix4().makeScale(0, 0, 0), T = c.T;
    this.people.forEach((p, i) => {
      if (p.hidden) { for (const m of Object.values(P)) { if (m.count === this.people.length * 2) { m.setMatrixAt(i * 2, hide); m.setMatrixAt(i * 2 + 1, hide); } else m.setMatrixAt(i, hide); } this.shadow.setMatrixAt(i, hide); return; }
      let walking = p.walk && !p.boat, yaw = p.face, x, y, z;
      if (walking) {
        p.x += p.dir * p.sp * dt;
        if (p.x > p.x1) { p.x = p.x1; p.dir = -1; } if (p.x < p.x0) { p.x = p.x0; p.dir = 1; }
        yaw = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      const s = p.h * (p.child ? 0.7 : 1);
      if (p.boat) {
        p.boat.updateMatrix(); V.set(1.3, 0.54, 0).applyMatrix4(p.boat.matrix); x = V.x; y = V.y; z = V.z; yaw = p.boat.rotation.y + Math.PI / 2;
      } else { x = walking ? p.x : p.x0; z = p.z; y = T.heightAt(x, z); }
      const ph = t * p.sp * 6 + p.ph, sw = walking ? Math.sin(ph) * 0.5 : 0, bob = walking ? Math.abs(Math.cos(ph)) * 0.04 : 0;
      Mb.compose(V.set(x, y + bob * s, z), Q.setFromEuler(E.set(0, yaw, 0)), S.set(s, s, s));
      P.body.setMatrixAt(i, Mb); P.head.setMatrixAt(i, Mb);
      P.coat.setMatrixAt(i, o.coat ? Mb : hide); P.scarf.setMatrixAt(i, o.scarf ? Mb : hide);
      P.hair.setMatrixAt(i, o.hat === 'hair' || (o.hat === 'sunhat' && this.umbrella) ? Mb : hide);
      P.beanie.setMatrixAt(i, o.hat === 'beanie' ? Mb : hide);
      P.sunhat.setMatrixAt(i, o.hat === 'sunhat' && !this.umbrella ? Mb : hide);
      P.umb.setMatrixAt(i, this.umbrella ? Mb : hide);
      for (const k of [0, 1]) {
        const side = k ? 1 : -1, a = sw * side;
        M.compose(Z.set(side * 0.1, 0.82, 0), Q.setFromEuler(E.set(a, 0, 0)), S.set(1, 1, 1)); M.premultiply(Mb);
        P.legU.setMatrixAt(i * 2 + k, M); P.legL.setMatrixAt(i * 2 + k, M);
        const hold = this.umbrella && k === 1;
        M.compose(Z.set(side * 0.27, 1.38, 0), Q.setFromEuler(E.set(hold ? -1.2 : -a * 0.8, 0, side * (o.coat ? 0.12 : 0.06))), S.set(1, 1, 1)); M.premultiply(Mb);
        P.arm.setMatrixAt(i * 2 + k, M);
      }
      M.compose(V.set(x, y + 0.03, z), Q.identity(), S.set(s, 1, s)); this.shadow.setMatrixAt(i, M);
    });
    for (const m of Object.values(P)) m.instanceMatrix.needsUpdate = true;
    this.shadow.instanceMatrix.needsUpdate = true;
  }
}
