/* The ground, behind one function, so a real terrain can replace the cartoon one later.

   loadTerrain(city, cfg) resolves to:
     { mesh,                 a THREE.Mesh in city coordinates (metres; y = height above today's harbour water)
       heightAt(x, z),       ground height at a point
       surfaceAt(x, z),      'stone' | 'grass' | 'mud' (what kind of ground is there)
       harbour: { zSouth, zNorth, floor }, quaySouth, quayNorth }

   Today it builds the placeholder from config/bristol_scene.json ("terrain"). To use real terrain, add a branch
   that loads a height grid (for example a 16-bit PNG or a GeoTIFF converted to JSON from public LiDAR / OS
   Terrain 50 data), keep the same return shape, and the rest of the scene follows: buildings, trees and
   people are placed with heightAt(), and the water and pontoon only need the harbour block. */
import * as THREE from 'three';
import { toon } from './materials.js';

export async function loadTerrain(city, cfg) {
  if (city !== 'bristol') throw new Error(`no terrain for "${city}"`);
  return cartoonBristol(cfg.terrain);
}

function smooth(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

function cartoonBristol(T) {
  const H = T.harbour, zS = H.z_south, zN = H.z_north, floor = H.floor_m;
  const hill = T.hill, rise = T.north_rise;
  function heightAt(x, z) {
    if (z > zS && z < zN) return floor;
    if (z <= zS) {
      const t = smooth(hill.start_z, hill.peak_z, z);
      const wob = hill.wobble_m * (Math.sin(x * 0.021) * 0.7 + Math.sin(x * 0.053 + 1.3) * 0.3);
      return T.south_quay_m + t * (hill.peak_m - T.south_quay_m + wob * t);
    }
    const t = smooth(rise.start_z, rise.end_z, z);
    return T.north_quay_m + t * (rise.top_m - T.north_quay_m + 3 * Math.sin(x * 0.03) * t);
  }
  function surfaceAt(x, z) {
    if (z > zS && z < zN) return 'mud';
    if ((z <= zS && z >= T.paved_south_to_z) || (z >= zN && z <= T.paved_north_to_z)) return 'stone';
    return 'grass';
  }
  /* grid: even x; z with extra rows hugging the quay edges so the quay walls come out vertical */
  const [x0, x1] = T.extent_x, [z0, z1] = T.extent_z, c = T.cell_m, e = 0.02;
  const xs = []; for (let x = x0; x <= x1 + 1e-6; x += c) xs.push(x);
  const zset = new Set();
  for (let z = z0; z <= z1 + 1e-6; z += c) zset.add(+z.toFixed(3));
  for (let z = zS - 30; z <= zN + 30; z += 1.5) zset.add(+z.toFixed(3));      // finer near the harbour
  for (const z of [zS - e, zS, zS + e, zS + 2 * e, zN - 2 * e, zN - e, zN, zN + e, T.paved_south_to_z, T.paved_north_to_z]) zset.add(+z.toFixed(3));
  const zs = [...zset].filter(z => z >= z0 && z <= z1).sort((a, b) => a - b);
  const nx = xs.length, nz = zs.length, pos = new Float32Array(nx * nz * 3), surf = new Float32Array(nx * nz * 3), col = new Float32Array(nx * nz * 3);
  const SURF = { stone: [1, 0, 0], grass: [0, 1, 0], mud: [0, 0, 1] };
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = xs[i], z = zs[j];
    let h = heightAt(x, z), s = surfaceAt(x, z);
    /* the wall: the rows just inside the harbour are floor height but stone coloured */
    if ((Math.abs(z - (zS + e)) < 1e-3) || (Math.abs(z - (zN - e)) < 1e-3)) s = 'stone';
    if (Math.abs(z - zS) < 1e-3) { h = T.south_quay_m; s = 'stone'; }
    if (Math.abs(z - zN) < 1e-3) { h = T.north_quay_m; s = 'stone'; }
    pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    surf.set(SURF[s], k * 3);
    const n = 0.94 + 0.12 * fract(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453);      // a little colour noise per vertex
    col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = n;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, d = a + nx, f = d + 1;
    idx.push(a, d, b, b, d, f);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSurf', new THREE.BufferAttribute(surf, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, toon({ surf: true, vertexColors: true }));
  mesh.name = 'terrain';
  return { mesh, heightAt, surfaceAt, harbour: { zSouth: zS, zNorth: zN, floor }, quaySouth: T.south_quay_m, quayNorth: T.north_quay_m, extent: { x: T.extent_x, z: T.extent_z } };
}
function fract(x) { return x - Math.floor(x); }
