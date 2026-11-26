/* The art kit for the harbourside: low-poly pieces built in code, so there are no model files to load.
   To swap a piece, replace its builder (or load a glTF in scene.js and use it in its place); every builder
   returns a BufferGeometry in metres with vertex colours, origin at the base of the object. */
import * as THREE from 'three';

const col = h => new THREE.Color(h);
const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3();

/* place a geometry: { geo, color, x, y, z, rx, ry, rz, sx, sy, sz } -> part */
export function part(geo, color, o = {}) {
  E.set(o.rx || 0, o.ry || 0, o.rz || 0); Q.setFromEuler(E);
  P.set(o.x || 0, o.y || 0, o.z || 0); S.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1);
  M.compose(P, Q, S);
  const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(M);
  return { g, c: col(color) };
}
/* merge parts into one geometry with position, normal and color */
export function merge(parts) {
  let n = 0;
  for (const p of parts) n += p.g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), cc = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    const a = p.g.attributes.position, b = p.g.attributes.normal;
    pos.set(a.array, o * 3);
    if (b) nor.set(b.array, o * 3);
    for (let i = 0; i < a.count; i++) { cc[(o + i) * 3] = p.c.r; cc[(o + i) * 3 + 1] = p.c.g; cc[(o + i) * 3 + 2] = p.c.b; }
    o += a.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  g.computeBoundingSphere();
  return g;
}
/* a box with its base at y */
export function box(w, h, d, color, x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, h / 2, 0);
  return part(g, color, { x, y, z, ry, rx, rz });
}
export function cyl(rt, rb, h, seg, color, x = 0, y = 0, z = 0, rx = 0, rz = 0) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg); g.translate(0, h / 2, 0);
  return part(g, color, { x, y, z, rx, rz });
}

/* ---------------------------------------------------------------- buildings (instanced) */
/* unit body: 1 x 1 x 1, base at 0; scaled per instance. Use with toon({ windows: true }). */
export function unitBox() { const g = new THREE.BoxGeometry(1, 1, 1); g.translate(0, 0.5, 0); return g.toNonIndexed(); }
/* unit gable roof: ridge along x, 1 wide (z), 1 high, base at 0 */
export function unitRoof() {
  const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false });
  g.translate(0, 0, -0.5); g.rotateY(Math.PI / 2);
  return g.toNonIndexed();
}
export const HOUSE_COLOURS = ['#F2A65A', '#F7D488', '#9FD8CB', '#F28C8C', '#B5A8E0', '#8EC5F2', '#F5EFE0', '#E5989B', '#C7E39A', '#FFB4A2'];
export const ROOF_COLOURS = ['#5E5A6B', '#7A4E45', '#4F5D75', '#6B5B53'];

/* ---------------------------------------------------------------- landmarks */
export function mshed(L, H, D) {
  const brick = '#A9553F', clad = '#8E9DAA', roof = '#59616C', door = '#3C4656';
  const p = [box(L, 3.4, D, brick), box(L, H - 3.4, D, clad, 0, 3.4), box(L + 1.2, 0.5, D + 1.2, roof, 0, H)];
  for (let k = 0; k < 7; k++) p.push(box(4.2, 3.0, 0.2, door, -L / 2 + 6 + k * ((L - 12) / 6), 0, D / 2 + 0.05));     // loading doors on the harbour side
  p.push(box(L, 0.35, 0.6, '#E8E2D2', 0, 3.4, D / 2 + 0.25));                                                          // a cream band
  return merge(p);
}
/* one of the dockside cranes in front of M Shed, jib pointing over the water (+z) */
export function crane() {
  const red = '#8A2E2E', dark = '#3B3F4A', cab = '#C9C0AE';
  const p = [
    box(0.7, 4.2, 0.7, red, -1.7, 0, -1.2), box(0.7, 4.2, 0.7, red, 1.7, 0, -1.2), box(0.7, 4.2, 0.7, red, -1.7, 0, 1.2), box(0.7, 4.2, 0.7, red, 1.7, 0, 1.2),
    box(4.2, 0.8, 3.2, red, 0, 4.2), box(1.2, 6.5, 1.2, red, 0, 5.0),
    box(3.0, 2.6, 3.4, cab, 0, 11.4), box(3.2, 0.3, 3.6, dark, 0, 14.0),
    box(1.6, 1.0, 1.0, '#7FB2D9', 0, 12.5, 1.72),
  ];
  /* jib: a long beam tilted up toward the harbour, and a short counter-jib with a weight */
  const jib = new THREE.BoxGeometry(0.7, 0.7, 12); jib.translate(0, 0, 6);
  p.push(part(jib, red, { x: 0, y: 13, z: 1.2, rx: -0.55 }));
  p.push(box(2.2, 1.8, 2.2, dark, 0, 11.6, -2.6));
  const hook = new THREE.CylinderGeometry(0.04, 0.04, 6, 4); hook.translate(0, -3, 0);
  p.push(part(hook, dark, { x: 0, y: 18.9, z: 11.1 }));
  p.push(box(0.6, 0.6, 0.6, '#E8B04C', 0, 12.6, 11.1));
  return merge(p);
}
/* the floating pontoon you stand on: deck top at y = 0 */
export function pontoon(w, d) {
  const wood = '#C8925A', wood2 = '#B57F4A', float = '#3C4656', rail = '#E8E2D2';
  const p = [box(w, 0.12, d, wood, 0, -0.12), box(w - 0.2, 0.5, d - 0.2, float, 0, -0.62)];
  for (let k = 0; k < Math.floor(w / 0.5); k++) p.push(box(0.04, 0.125, d, wood2, -w / 2 + 0.5 * k + 0.25, -0.12));
  const post = (x, z) => p.push(box(0.08, 1.0, 0.08, rail, x, 0, z));
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (let z = -d / 2 + 0.05; z <= d / 2; z += (d - 0.1) / 3) post(x, z);
  for (let x = -w / 2 + 0.05; x <= w / 2; x += (w - 0.1) / 4) post(x, d / 2 - 0.05);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) p.push(box(0.1, 0.08, d, rail, x, 0.96, 0));
  p.push(box(w, 0.08, 0.1, rail, 0, 0.96, d / 2 - 0.05));
  /* the front (towards M Shed) stays open apart from two short posts, so the view is clear */
  post(-w / 2 + 0.05, -d / 2 + 0.05); post(w / 2 - 0.05, -d / 2 + 0.05);
  /* a stand for the weather board and a base for the thermometer */
  p.push(box(0.1, 1.0, 0.1, '#5E6670', -2.25, 0, -1.25), box(0.1, 1.0, 0.1, '#5E6670', -1.35, 0, -1.7));
  return merge(p);
}
/* a gangway (ramp), 1 m wide, length along +z from its hinge */
export function gangway(len) {
  const p = [box(1.1, 0.1, len, '#9AA3AE', 0, 0, len / 2)];
  for (const x of [-0.55, 0.55]) { p.push(box(0.05, 0.05, len, '#E8E2D2', x, 0.9, len / 2)); for (let z = 0.2; z < len; z += len / 4) p.push(box(0.05, 0.9, 0.05, '#E8E2D2', x, 0, z)); }
  return merge(p);
}
/* tide-mark pole: 1 m bands, a dark band every 5 m, from y0 to y1 */
export function tidePole(y0, y1) {
  const p = [];
  for (let y = Math.floor(y0); y < y1; y++) {
    const five = ((y % 5) + 5) % 5 === 0, c = five ? '#1B2A4A' : (((y % 2) + 2) % 2 ? '#F2F2EE' : '#E8364F');
    p.push(cyl(0.11, 0.11, 1, 12, c, 0, y, 0));
    if (five) p.push(cyl(0.16, 0.16, 0.06, 12, '#1B2A4A', 0, y, 0));
  }
  p.push(cyl(0.2, 0.2, 0.3, 12, '#FFC93C', 0, y1, 0));
  return merge(p);
}
/* a small harbour boat, bow toward +x */
export function boat(hull = '#E8364F', top = '#F5EFE0') {
  const s = new THREE.Shape();
  s.moveTo(-2.4, 0.9); s.lineTo(2.2, 0.9); s.lineTo(3.0, 0.95); s.lineTo(2.2, 0.0); s.lineTo(-2.2, 0.0); s.lineTo(-2.5, 0.9);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1.8, bevelEnabled: false }); g.translate(0, -0.45, -0.9);
  const p = [part(g, hull), box(4.6, 0.12, 1.6, '#C8925A', -0.1, 0.42), box(1.8, 1.1, 1.3, top, -0.6, 0.5), box(2.0, 0.12, 1.5, '#4F5D75', -0.6, 1.6)];
  p.push(box(0.5, 0.4, 0.05, '#7FB2D9', 0.31, 0.95, 0.66, Math.PI / 2));
  return merge(p);
}
/* quayside furniture: bench, bollard, lamp */
export function bench() { return merge([box(1.8, 0.08, 0.5, '#B57F4A', 0, 0.45), box(1.8, 0.45, 0.06, '#B57F4A', 0, 0.55, -0.24), box(0.08, 0.45, 0.4, '#3C4656', -0.75), box(0.08, 0.45, 0.4, '#3C4656', 0.75)]); }
export function bollard() { return merge([cyl(0.16, 0.2, 0.6, 8, '#2D3340'), cyl(0.22, 0.22, 0.1, 8, '#2D3340', 0, 0.6)]); }
export function lamp() { return merge([cyl(0.07, 0.09, 4.2, 6, '#2D3340'), box(0.5, 0.5, 0.5, '#FFE6A0', 0, 4.2), box(0.65, 0.12, 0.65, '#2D3340', 0, 4.7)]); }
