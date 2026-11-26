/* Loads and checks data/timeline.json, data/scenarios.json and data/globe_tas.json (format in README).
   Time is t in thousands of years after present (kyr), 0 = today, on the axis in timeline.json.
   Nothing here throws on bad or missing data: a problem becomes a warning, the value becomes null, and the page
   shows "no data". */

export const VARS = ['sea_level_m', 'temp_c', 'wind_ms', 'rain_mm_yr', 'snow_depth_cm', 'vegetation', 'co2_ppm', 'lai'];
export const LAYERS = ['surface', 'temp', 'rain', 'plants', 'sea'];
export const VEG_DEFAULT = ['tundra', 'boreal_forest', 'steppe', 'temperate_forest', 'mediterranean', 'subtropical', 'desert_scrub'];

/* Thresholds that turn a number into what the scene shows. Change them here. */
export const BANDS = {
  wind: v => (v == null ? null : v < 3 ? 'still' : v <= 8 ? 'breezy' : 'stormy'),            // m/s
  rain: v => (v == null ? null : v < 300 ? 'dry' : v < 700 ? 'light' : v <= 1000 ? 'steady' : 'heavy'),  // mm/yr
  outfit: t => (t == null ? null : t < 5 ? 'cold' : t < 15 ? 'cool' : t <= 25 ? 'warm' : 'hot'),  // °C
  snowfall: (snowCm, t) => snowCm != null && snowCm >= 0.5 && (t == null || t <= 4),  // falling snow instead of rain
  snowCover: snowCm => (snowCm == null || snowCm < 0.2 ? 0 : 0.35 + 0.65 * Math.min(1, (snowCm - 0.2) / 9.8)),
  snowmen: snowCm => snowCm != null && snowCm > 10,
  haze: t => t != null && t > 28,
};

async function getJSON(url, warnings) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) { warnings.push(`${url}: ${e.message}`); return null; }
}
const isNum = v => typeof v === 'number' && Number.isFinite(v);
function b64(s, T) { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new T(u.buffer); }

export async function loadData(base = 'data/') {
  const warnings = [];
  const [tl, sc, gt] = await Promise.all([getJSON(base + 'timeline.json', warnings), getJSON(base + 'scenarios.json', warnings), getJSON(base + 'globe_tas.json', warnings)]);
  const ax = (tl && tl.axis) || {};
  const axis = { start: isNum(ax.start) ? ax.start : 0, end: isNum(ax.end) ? ax.end : 1000, step: isNum(ax.step) && ax.step > 0 ? ax.step : 1, nowYear: isNum(ax.now_year) ? ax.now_year : 2025 };
  if (!tl || !tl.axis) warnings.push('timeline.json: no "axis"; using 0 to 1000 kyr');
  const marks = (tl && Array.isArray(tl.marks) ? tl.marks : []).filter(m => m && isNum(m.t));
  const pathways = [];
  for (const p of (sc && Array.isArray(sc.pathways) ? sc.pathways : [])) {
    if (!p || typeof p.id !== 'string') { warnings.push('scenarios.json: a pathway without an id was skipped'); continue; }
    pathways.push({ id: p.id, label: p.label || p.id, label_zh: p.label_zh, ssp: p.ssp || '', ssp_zh: p.ssp_zh, icon: p.icon, color: p.color });
  }
  if (!pathways.length) warnings.push('scenarios.json: no pathways');
  const metas = [tl, sc, gt].filter(Boolean).map(x => x.meta || {});
  const placeholder = !metas.length || metas.some(m => m.placeholder !== false);
  const m0 = (sc && sc.meta) || {};
  const ds = new DataSet({
    axis, marks, pathways, warnings, placeholder,
    sourceLabel: m0.source_label || (placeholder ? 'DEMO DATA' : ''), sourceLabelZh: m0.source_label_zh || '',
    vegTypes: sc && Array.isArray(sc.vegetation_types) ? sc.vegetation_types : VEG_DEFAULT.slice(),
    bristol: (sc && sc.bristol) || {}, baseline: (sc && sc.baseline) || null, compare: (sc && sc.closing_compare) || null,
    missing: (sc && sc.missing) || [], gt,
  });
  if (ds.missing.length) warnings.push('Not in the site data (shown as "no data"): ' + ds.missing.join(', '));
  ds.check();
  return ds;
}

export class DataSet {
  constructor(o) { Object.assign(this, o); this.n = Math.round((this.axis.end - this.axis.start) / this.axis.step) + 1; this._tas = null; }
  pathway(id) { return this.pathways.find(p => p.id === id) || null; }
  clampT(t) { const a = this.axis; return Math.min(a.end, Math.max(a.start, Math.round((t - a.start) / a.step) * a.step + a.start)); }
  index(t) { return Math.round((this.clampT(t) - this.axis.start) / this.axis.step); }
  value(t, pid, key) {
    const c = this.bristol[pid], s = c && c[key];
    if (!Array.isArray(s)) return null;
    const v = s[this.index(t)];
    if (key === 'vegetation') return typeof v === 'string' && this.vegTypes.includes(v) ? v : null;
    return isNum(v) ? v : null;
  }
  values(t, pid) { const o = {}; for (const k of VARS) o[k] = this.value(t, pid, k); o.sea_level_m_range = null; return o; }
  check() {
    let bad = 0;
    for (const p of this.pathways) {
      const c = this.bristol[p.id];
      if (!c) { this.warnings.push(`scenarios.json: no Bristol series for "${p.id}"`); continue; }
      for (const k of VARS) { const s = c[k]; if (!Array.isArray(s)) bad++; else if (s.length !== this.n) this.warnings.push(`scenarios.json: ${p.id}.${k} has ${s.length} values, expected ${this.n}`); }
    }
    if (bad) this.warnings.push(`scenarios.json: ${bad} series missing`);
    if (!this.gt) this.warnings.push('globe_tas.json missing: no temperature map');
  }
  /* global temperature change from today on the model grid (Float32Array) or null */
  get tasGrid() { return this.gt && this.gt.grid; }
  tasField(t, pid) {
    const g = this.gt; if (!g || !g.coeffs || !g.coeffs[pid]) return null;
    if (!this._tas) {
      const npx = g.grid.nx * g.grid.ny, k = g.k, qb = b64(g.basis, Int16Array), basis = new Float32Array(k * npx);
      for (let c = 0; c < k; c++) { const s = g.bscale[c] / 32767; for (let i = 0; i < npx; i++) basis[c * npx + i] = qb[c * npx + i] * s; }
      this._tas = { npx, k, mean: b64(g.mean, Float32Array), basis, co: {} };
    }
    const T = this._tas;
    if (!T.co[pid]) T.co[pid] = b64(g.coeffs[pid], Int16Array);
    const i = this.index(t), co = T.co[pid], out = Float32Array.from(T.mean);
    for (let c = 0; c < T.k; c++) {
      const w = co[i * T.k + c] * g.cscale[c] / 32767; if (!w) continue;
      const b = T.basis, o = c * T.npx;
      for (let p = 0; p < T.npx; p++) out[p] += w * b[o + p];
    }
    return out;
  }
}
