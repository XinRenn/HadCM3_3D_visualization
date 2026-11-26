/* Loads and checks data/timeline.json, data/scenarios.json and data/globe_layers/index.json.
   Nothing here throws on bad or missing data: a problem becomes a warning, and the value becomes null,
   which the page shows as "no data". */

export const VARS = ['sea_level_m', 'temp_c', 'wind_ms', 'rain_mm_yr', 'snow_depth_cm', 'vegetation'];
export const LAYER_VARS = ['temp_c', 'rain_mm_yr', 'snow_depth_cm', 'vegetation', 'sea_level_m'];
export const VEG_DEFAULT = ['tundra', 'steppe', 'temperate_forest', 'mediterranean', 'subtropical', 'desert_scrub'];

/* Thresholds that turn a number into what the scene shows. Change them here. */
export const BANDS = {
  wind: v => (v == null ? null : v < 3 ? 'still' : v <= 8 ? 'breezy' : 'stormy'),            // m/s
  rain: v => (v == null ? null : v < 300 ? 'dry' : v < 700 ? 'light' : v <= 1000 ? 'steady' : 'heavy'),  // mm/yr
  outfit: t => (t == null ? null : t < 5 ? 'cold' : t < 15 ? 'cool' : t <= 25 ? 'warm' : 'hot'),  // °C
  snowfall: (snowCm, t) => snowCm != null && snowCm >= 10 && (t == null || t <= 4),  // falling snow instead of rain
  snowmen: snowCm => snowCm != null && snowCm > 10,
  haze: t => t != null && t > 28,
};

async function getJSON(url, warnings) {
  try {
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    warnings.push(`${url}: ${e.message}`);
    return null;
  }
}

const isNum = v => typeof v === 'number' && Number.isFinite(v);

export async function loadData(base = 'data/') {
  const warnings = [];
  const [tl, sc, li] = await Promise.all([
    getJSON(base + 'timeline.json', warnings), getJSON(base + 'scenarios.json', warnings), getJSON(base + 'globe_layers/index.json', warnings)]);

  /* stops: keep the valid ones, ordered by time */
  const stops = [];
  for (const s of (tl && Array.isArray(tl.stops) ? tl.stops : [])) {
    if (!s || typeof s.id !== 'string') { warnings.push('timeline.json: a stop without an id was skipped'); continue; }
    if (!isNum(s.year)) { warnings.push(`timeline.json: stop "${s.id}" has no numeric year; skipped`); continue; }
    stops.push({ id: s.id, label: s.label || s.id, label_zh: s.label_zh, kind: s.kind || 'ssp', year: s.year });
  }
  stops.sort((a, b) => a.year - b.year);
  if (!stops.length) { warnings.push('timeline.json: no stops; using "Today" only'); stops.push({ id: 'now', label: 'Today', kind: 'now', year: 2025 }); }

  const pathways = [];
  for (const p of (sc && Array.isArray(sc.pathways) ? sc.pathways : [])) {
    if (!p || typeof p.id !== 'string') { warnings.push('scenarios.json: a pathway without an id was skipped'); continue; }
    pathways.push({ id: p.id, label: p.label || p.id, label_zh: p.label_zh, ssp: p.ssp || '', icon: p.icon });
  }
  if (!pathways.length) warnings.push('scenarios.json: no pathways');

  const vegTypes = sc && Array.isArray(sc.vegetation_types) && sc.vegetation_types.length ? sc.vegetation_types.slice() : VEG_DEFAULT.slice();
  const bristol = sc && sc.bristol && typeof sc.bristol === 'object' ? sc.bristol : {};
  if (!sc || !sc.bristol) warnings.push('scenarios.json: no "bristol" block');

  /* anything not explicitly marked as real data is treated as placeholder */
  const metas = [tl, sc, li].filter(Boolean).map(x => x.meta || {});
  const placeholder = !metas.length || metas.some(m => m.placeholder !== false);
  const sourceLabel = (sc && sc.meta && sc.meta.source_label) || (placeholder ? 'DEMO DATA' : '');

  const ds = new DataSet({ stops, pathways, vegTypes, bristol, layers: li, placeholder, sourceLabel, warnings, base });
  ds.checkCoverage();
  return ds;
}

export class DataSet {
  constructor(o) { Object.assign(this, o); this._layer = new Map(); }
  stop(id) { return this.stops.find(s => s.id === id) || null; }
  pathway(id) { return this.pathways.find(p => p.id === id) || null; }
  /* "all" applies to every pathway: the past, and today */
  sharedStop(id) { const c = this.bristol[id]; return !!(c && c.all && !this.pathways.some(p => c[p.id])); }
  cell(stopId, pathwayId) {
    const c = this.bristol[stopId];
    if (!c || typeof c !== 'object') return null;
    return c[pathwayId] || c.all || null;
  }
  value(stopId, pathwayId, key) {
    const c = this.cell(stopId, pathwayId);
    if (!c || !(key in c)) return null;
    const v = c[key];
    if (key === 'vegetation') return typeof v === 'string' && this.vegTypes.includes(v) ? v : null;
    if (key === 'sea_level_m_range') return Array.isArray(v) && v.length === 2 && v.every(isNum) ? [Math.min(...v), Math.max(...v)] : null;
    return isNum(v) ? v : null;
  }
  values(stopId, pathwayId) {
    const o = {};
    for (const k of VARS) o[k] = this.value(stopId, pathwayId, k);
    const s = o.sea_level_m;
    o.sea_level_m_range = this.value(stopId, pathwayId, 'sea_level_m_range') || (s == null ? null : [Math.min(s * 0.8, s * 1.2), Math.max(s * 0.8, s * 1.2)]);
    return o;
  }
  checkCoverage() {
    let missing = 0, bad = 0;
    for (const s of this.stops) for (const p of this.pathways) {
      const c = this.cell(s.id, p.id);
      if (!c) { missing++; continue; }
      for (const k of VARS) if (this.value(s.id, p.id, k) == null) bad++;
    }
    if (missing) this.warnings.push(`scenarios.json: ${missing} stop × pathway combination(s) have no Bristol values`);
    if (bad) this.warnings.push(`scenarios.json: ${bad} value(s) are missing or invalid and show as "no data"`);
    const vs = new Set();
    for (const c of Object.values(this.bristol)) for (const v of Object.values(c || {})) if (v && typeof v.vegetation === 'string' && !this.vegTypes.includes(v.vegetation)) vs.add(v.vegetation);
    if (vs.size) this.warnings.push(`scenarios.json: unknown vegetation type(s): ${[...vs].join(', ')}`);
  }

  /* ---------------- globe layers */
  layerFile(name, stopId, pathwayId) {
    const f = this.layers && this.layers.files && this.layers.files[name] && this.layers.files[name][stopId];
    if (!f) return null;
    return f[pathwayId] || f.all || null;
  }
  layerInfo(name) { return (this.layers && this.layers.variables && this.layers.variables[name]) || null; }
  /* resolves to { grid, values: Float32Array (NaN = no data) | null, cats: Int16Array (-1 = no data) | null, info } or null */
  layer(name, stopId, pathwayId) {
    const file = this.layerFile(name, stopId, pathwayId), info = this.layerInfo(name), grid = this.layers && this.layers.grid;
    if (!file || !info || !grid) return Promise.resolve(null);
    const url = this.base + 'globe_layers/' + file;
    if (!this._layer.has(url)) {
      this._layer.set(url, decodePNG(url, grid).then(code => {
        const n = code.length;
        if ('categories' in info) {
          const cats = new Int16Array(n);
          for (let i = 0; i < n; i++) { const c = code[i] - 1; cats[i] = c >= 0 && c < info.categories.length ? c : -1; }
          return { grid, values: null, cats, info };
        }
        const values = new Float32Array(n), lo = info.lo, hi = info.hi;
        for (let i = 0; i < n; i++) values[i] = code[i] === 0 ? NaN : lo + (code[i] - 1) / 254 * (hi - lo);
        return { grid, values, cats: null, info };
      }).catch(e => { this.warnings.push(`${url}: ${e.message}`); return null; }));
    }
    return this._layer.get(url);
  }
}

function decodePNG(url, grid) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      if (img.width !== grid.nx || img.height !== grid.ny) { rej(new Error(`size ${img.width}×${img.height}, expected ${grid.nx}×${grid.ny}`)); return; }
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, img.width, img.height).data, out = new Uint8Array(img.width * img.height);
      for (let i = 0; i < out.length; i++) out[i] = px[i * 4];
      res(out);
    };
    img.onerror = () => rej(new Error('could not load'));
    img.src = url;
  });
}
