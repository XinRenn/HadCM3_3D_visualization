/* HadCM3 in 3D: one coupled day of HadCM3 (UM vn4.5), routine by routine, on a 3D globe.
   Fields:   window.HADCM3_STATE   (data/hadcm3_state.js, made by build_data.py from the start dumps)
   Text:     window.HAD_V1         (v1 step cards and parameter tables, EN + ZH)
             window.HadNet.NETS    (v2 process networks, bilingual)
   Nothing is integrated here: the fields stay as stored; the animation shows which routine runs,
   in which order, on which points and levels, and what it reads and writes. */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

window.__had3dStarted = true;
THREE.ColorManagement.enabled = false;

const ST = window.HADCM3_STATE, V1 = window.HAD_V1, HN = window.HadNet;
const D2R = Math.PI / 180;
const $ = (s, el = document) => el.querySelector(s);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const wrap360 = x => ((x % 360) + 360) % 360;
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ================================================================ language */
const L = (en, zh) => ({ en, zh });
let LANG = (() => {
  if (window.HAD3D_LANG === 'en' || window.HAD3D_LANG === 'zh') return window.HAD3D_LANG;   // set by the per-language builds
  try { const s = localStorage.getItem('had3d-lang'); if (s === 'en' || s === 'zh') return s; } catch (e) { /* storage blocked */ }
  return /^zh/i.test(navigator.language || '') ? 'zh' : 'en';
})();
const tx = o => o == null ? '' : (typeof o === 'object' ? (o[LANG] != null ? o[LANG] : o.en) : String(o));
const fmt = (s, o) => tx(s).replace(/\{(\w+)\}/g, (m, k) => (o[k] != null ? o[k] : m));

const U = {
  sub: L('UM vn4.5 · pre-industrial job tdaah · one coupled day, routine by routine, on the model’s own grids',
         'UM vn4.5 · 工业革命前试验 tdaah · 一个耦合日，逐个子程序，在模式自己的网格上'),
  layers: L('Layers', '图层'), home: L('Reset view', '复位视角'), spin: L('Rotate', '自转'), v2: L('2D networks ↗', '二维网络图 ↗'),
  play: L('▶ Play', '▶ 播放'), pause: L('❚❚ Pause', '❚❚ 暂停'), prev: L('◀', '◀'), next: L('▶▶', '▶▶'),
  prevT: L('Previous routine', '上一个子程序'), nextT: L('Next routine', '下一个子程序'),
  speed: L('Speed', '速度'), detail: L('All routines on every step', '每一步都展开全部子程序'),
  loading: L('Loading HadCM3 fields…', '正在载入 HadCM3 场…'),
  nodata: L('The field file data/hadcm3_state.js did not load. Keep it next to this page (run v3/build_data.py to make it).', '场数据文件 data/hadcm3_state.js 没有载入。请把它放在页面旁边（用 v3/build_data.py 生成）。'),
  nogl: L('This page needs WebGL, which is not available in this browser.', '本页需要 WebGL，但当前浏览器不支持。'),
  atmGroup: L('atmosphere · 48 × 30 min', '大气 · 48 × 30 分钟'), ocnGroup: L('ocean · 24 × 1 h', '海洋 · 24 × 1 小时'),
  start: L('start', '启动'), a2o: L('A→O', 'A→O'), o2a: L('O→A', 'O→A'), nextDay: L('n+1', 'n+1'), end: L('end', '结束'),
  atmStep: L('Atmosphere step {s} / 48', '大气步 {s} / 48'), ocnStep: L('Ocean step {s} / 24', '海洋步 {s} / 24'),
  radStep: L('radiation step', '辐射步'), nonRad: L('no full radiation', '非辐射步'), mixStep: L('mixing step', '混合步'), leap: L('leapfrog', '蛙跳步'),
  startup: L('Start-up', '启动'), swapA2O: L('SWAP_A2O', 'SWAP_A2O'), swapO2A: L('SWAP_O2A', 'SWAP_O2A'), dayN1: L('Day n + 1', '第 n + 1 天'), runEnd: L('End of run', '运行结束'),
  oceanClock: L('ocean clock', '海洋时钟'), oceanNote: L('The ocean sees daily means only: no day and night.', '海洋只看到日平均：没有昼夜。'),
  accum: L('Daily means for the coupler: {n} / 48 steps', '耦合用日平均：已累计 {n} / 48 步'),
  inView: L('In the 3D view', '3D 视图中'), reads: L('Reads', '读入'), writes: L('Writes', '写出'), params: L('Parameters (tdaah)', '参数（tdaah）'),
  procs: L('{m}: routines in call order', '{m}：按调用顺序的子程序'), card: L('From the 2D walkthrough', '2D 版步骤说明'),
  cIn: L('In', '输入'), cCalc: L('Computed', '计算'), cOut: L('Out', '输出'),
  off: L('off in tdaah', 'tdaah 中关闭'), sometimes: L('only sometimes', '仅在部分步'),
  every: L('every step', '每步'), once: L('once a day', '每天一次'),
  surfH: L('Surface colour', '地表着色'), atmH: L('Atmosphere', '大气'), ocnH: L('Ocean', '海洋'), gridH: L('Grids', '网格'), cutH: L('Cutaway', '剖面'), viewH: L('View', '视图'),
  follow: L('Layers follow the step', '图层随步骤切换'), followHint: L('Untick to keep your own layer choice while playing.', '取消勾选后，播放时保留你自己选的图层。'),
  clouds: L('Layer cloud (19 levels)', '层状云（19 层）'), towers: L('Convective cloud', '对流云'), winds: L('Wind particles', '风场粒子'), level: L('Level', '层'),
  currents: L('Ocean currents', '洋流'), depth: L('Depth', '深度'), ice: L('Sea ice', '海冰'), psi: L('Streamfunction contours', '流函数等值线'), rain: L('Rain and snow', '雨雪'), runoff: L('Runoff to the coast', '径流入海'),
  gridA: L('Atmosphere 96 × 73', '大气 96 × 73'), gridO: L('Ocean 288 × 144', '海洋 288 × 144'),
  cut: L('Cut away a wedge', '切开一个楔形'), cutLon: L('Western face (°E)', '西侧剖面（°E）'), cutW: L('Wedge width (°)', '楔形宽度（°）'),
  cutA: L('Atmosphere section', '大气剖面'), cutO: L('Ocean section', '海洋剖面'), cutFollow: L('Wedge follows the camera', '楔形跟随视角'),
  shade: L('Day and night', '昼夜'), relief: L('Relief', '地形起伏'), reliefSmooth: L('smooth', '平滑'), reliefBlocky: L('grid boxes', '网格方块'), reliefOff: L('off', '关闭'),
  vscale: L('Vertical axis', '垂直坐标'), vLevels: L('model levels', '模式层'), vPhys: L('height and depth', '高度和深度'),
  autoCam: L('Move the camera with the step', '视角随步骤移动'),
  grpState: L('State at 1 Dec 00:00', '12 月 1 日 00:00 的状态'), grpNov: L('November means', '11 月平均'), grpDay: L('30 November, coupling', '11 月 30 日，耦合场'), grpLand: L('Land surface', '陆面'),
  tInst: L('start dump, 1 Dec 00:00', '启动 dump，12 月 1 日 00:00'), tNov: L('November mean', '11 月平均'), tDay: L('30 Nov daily mean', '11 月 30 日日平均'),
  tDiur: L('November mean at {h}', '11 月平均，{h} 时刻'), tCalc: L('derived here', '本页计算'),
  tipLand: L('land', '陆地'), tipSea: L('sea', '海洋'), tipA: L('atmos box', '大气格点'), tipO: L('ocean box', '海洋格点'),
  about: L('About the data', '关于数据'),
};

/* ================================================================ components */
const COMP = {
  dyn: { c: '#6FAEE0', n: L('Dynamics', '动力') },
  rad: { c: '#E7B04C', n: L('Radiation', '辐射') },
  cloud: { c: '#C9D6E2', n: L('Cloud and large-scale rain', '云与大尺度降水') },
  conv: { c: '#A58CF2', n: L('Convection', '对流') },
  bl: { c: '#4FC79A', n: L('Boundary layer', '边界层') },
  hydro: { c: '#C99A5B', n: L('Land hydrology', '陆面水文') },
  veg: { c: '#93C45A', n: L('Vegetation', '植被') },
  gwd: { c: '#8796B0', n: L('Gravity-wave drag', '重力波拖曳') },
  eng: { c: '#F06BB4', n: L('Energy correction', '能量订正') },
  cpl: { c: '#E5864A', n: L('Coupler', '耦合器') },
  ocn: { c: '#35B6C2', n: L('Ocean', '海洋') },
  ice: { c: '#A9B9E4', n: L('Sea ice', '海冰') },
  state: { c: '#95A6AE', n: L('model state', '模式状态') },
  file: { c: '#62747D', n: L('file or start-up', '文件或启动设置') },
  stash: { c: '#62747D', n: L('diagnostics', '诊断输出') },
};
const compColor = k => (COMP[k] || COMP.state).c;

/* ================================================================ fields */
const FWD = { lin: v => v, int: v => v, sqrt: v => Math.sqrt(Math.max(v, 0)), ssqrt: v => Math.sign(v) * Math.sqrt(Math.abs(v)), log1p: v => Math.log10(1 + Math.max(v, 0)) };
const INV = { lin: x => x, int: x => x, sqrt: x => x * x, ssqrt: x => Math.sign(x) * x * x, log1p: x => Math.pow(10, x) - 1 };
const F = {};
class Field {
  constructor(name, m, tiles) {
    Object.assign(this, m);
    this.name = name; this.g = ST.grids[m.grid];
    this.codes = m.tiles.map(t => tiles[t]);
    this.n = this.codes.length;
    this.flo = m.lo.map(FWD[m.tr]); this.fhi = m.hi.map(FWD[m.tr]); this.inv = INV[m.tr];
    this.cache = [];
  }
  val(k, i) { const c = this.codes[k][i]; return c === 0 ? NaN : this.inv(this.flo[k] + (c - 1) / 254 * (this.fhi[k] - this.flo[k])); }
  lev(k) {
    if (!this.cache[k]) { const n = this.codes[k].length, a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = this.val(k, i); this.cache[k] = a; }
    return this.cache[k];
  }
}
function decodeAtlas(a) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, img.width, img.height).data, out = [];
      for (let t = 0; t < a.n; t++) {
        const r0 = Math.floor(t / a.cols) * a.th, c0 = (t % a.cols) * a.tw, u = new Uint8Array(a.tw * a.th);
        for (let j = 0; j < a.th; j++) { const row = ((r0 + j) * img.width + c0) * 4; for (let i = 0; i < a.tw; i++) u[j * a.tw + i] = px[row + i * 4]; }
        out.push(u);
      }
      res(out);
    };
    img.onerror = () => rej(new Error('atlas decode failed'));
    img.src = a.png;
  });
}
async function loadData() {
  const tiles = {};
  for (const [g, a] of Object.entries(ST.atlases)) tiles[g] = await decodeAtlas(a);
  for (const [name, m] of Object.entries(ST.fields)) F[name] = new Field(name, m, tiles[m.grid]);
}

/* grid indexing: A rows run north→south, O rows south→north */
const idxA = (lat, lon) => clamp(Math.round((90 - lat) / 2.5), 0, 72) * 96 + ((Math.round(wrap360(lon) / 3.75)) % 96);
const idxO = (lat, lon) => clamp(Math.round((lat + 89.375) / 1.25), 0, 143) * 288 + ((Math.round(wrap360(lon) / 1.25)) % 288);
const latA = j => 90 - 2.5 * j, lonA = i => 3.75 * i, latO = j => -89.375 + 1.25 * j, lonO = i => 1.25 * i;
function bilin(arr, g, lat, lon) {
  let x = (wrap360(lon) - g.lon0) / g.dlon; x = ((x % g.nx) + g.nx) % g.nx;
  let y = clamp((lat - g.lat0) / g.dlat, 0, g.ny - 1.0001);
  const i0 = Math.floor(x), i1 = (i0 + 1) % g.nx, fx = x - i0, j0 = Math.floor(y), fy = y - j0, j1 = Math.min(j0 + 1, g.ny - 1);
  const a = arr[j0 * g.nx + i0], b = arr[j0 * g.nx + i1], c = arr[j1 * g.nx + i0], d = arr[j1 * g.nx + i1];
  return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
}
/* value on an A box from the four AU corners; on an O box from the four OU corners (missing corners skipped) */
function cornersA(arr, jA, iA) {
  let s = 0, n = 0;
  for (const [r, c] of [[jA - 1, iA - 1], [jA - 1, iA], [jA, iA - 1], [jA, iA]]) {
    if (r < 0 || r > 71) continue; const v = arr[r * 96 + ((c + 96) % 96)]; if (!Number.isNaN(v)) { s += v; n++; }
  }
  return n ? s / n : NaN;
}
function cornersO(arr, j, i) {
  let s = 0, n = 0;
  for (const [r, c] of [[j - 1, i - 1], [j - 1, i], [j, i - 1], [j, i]]) {
    if (r < 0 || r > 142) continue; const v = arr[r * 288 + ((c + 288) % 288)]; if (!Number.isNaN(v)) { s += v; n++; }
  }
  return n ? s / n : NaN;
}

/* ================================================================ geometry and vertical axes */
const ATM_H = 0.26, OCN_H = 0.22, SOIL_DZ = 0.011, RELIEF_MAX = 0.03;
const VIEW = {
  surf: 'tstar', clouds: false, towers: false, winds: 0, currents: 0, ice: true, psi: false, rain: '', runoff: false,
  gridA: false, gridO: false, cut: true, cutLon: 315, cutW: 76, cutA: 'temp', cutO: 'T', cutFollow: true,
  shade: true, relief: 'smooth', vmode: 'levels', autoCam: !REDUCED, spin: false, follow: true,
};
let KMT, LSM, BK, BKB, ZB, DB;
function initAxes() {
  KMT = F.kmt.lev(0); LSM = F.lsm.lev(0);
  BK = ST.levels.atm.B;
  BKB = [1]; for (let k = 1; k < 19; k++) BKB.push((BK[k - 1] + BK[k]) / 2); BKB.push(0);
  const p = ST.levels.atm.p, pb = [1000];
  for (let k = 1; k < 19; k++) pb.push(Math.sqrt(p[k - 1] * p[k]));
  pb.push(p[18] / 2);
  ZB = pb.map(x => 7.0 * Math.log(1000 / x));
  const dz = ST.levels.ocn.dz; DB = [0]; dz.forEach(d => DB.push(DB[DB.length - 1] + d));
}
const interp = (arr, kb) => { const k0 = clamp(Math.floor(kb), 0, arr.length - 2); return lerp(arr[k0], arr[k0 + 1], clamp(kb - k0, 0, 1)); };
const atmS = kb => VIEW.vmode === 'levels' ? ATM_H * kb / 19 : ATM_H * interp(ZB, kb) / ZB[19];
const ocnS = kb => VIEW.vmode === 'levels' ? OCN_H * kb / 20 : OCN_H * interp(DB, kb) / DB[20];
const bkAt = kb => interp(BKB, kb);
const kbOfDepth = z => { for (let k = 0; k < 20; k++) if (z <= DB[k + 1]) return k + (z - DB[k]) / (DB[k + 1] - DB[k]); return 20; };
const kbOfHeight = zm => { const z = zm / 1000; for (let k = 0; k < 19; k++) if (z <= ZB[k + 1]) return k + (z - ZB[k]) / (ZB[k + 1] - ZB[k]); return 19; };
const isLandO = (lat, lon) => KMT[idxO(lat, lon)] === 0;
function orogAt(lat, lon) {
  if (VIEW.relief === 'blocky') return F.orog.lev(0)[idxA(lat, lon)];
  return bilin(F.orog.lev(0), { nx: 96, ny: 73, lon0: 0, dlon: 3.75, lat0: 90, dlat: -2.5 }, lat, lon);
}
const reliefAt = (lat, lon) => VIEW.relief === 'off' || !isLandO(lat, lon) ? 0 : RELIEF_MAX * Math.max(orogAt(lat, lon), 0) / 6000;
const atmR = (kb, lat, lon) => 1 + reliefAt(lat, lon) * bkAt(kb) + atmS(kb);
const ocnR = kb => 1 - ocnS(kb);
function xyz(lat, lon, r, v = new THREE.Vector3()) {
  const p = lat * D2R, l = lon * D2R, c = Math.cos(p);
  return v.set(r * c * Math.cos(l), r * Math.sin(p), -r * c * Math.sin(l));
}
function lonlatOf(v) { const r = v.length(); return [Math.asin(clamp(v.y / r, -1, 1)) / D2R, wrap360(Math.atan2(-v.z, v.x) / D2R)]; }
const inCut = lon => VIEW.cut && wrap360(lon - VIEW.cutLon) < VIEW.cutW;
const levelP = k => ST.levels.atm.p[k - 1];
const fmtP = p => p >= 100 ? Math.round(p) : p >= 10 ? p.toFixed(0) : p.toFixed(1);
const fmtLat = lat => `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;

/* ================================================================ colour maps */
const CM = {
  thermal: ['#0B1530', '#23307A', '#4F3B98', '#87479A', '#BC5684', '#E66D5C', '#F79B45', '#F6CF55', '#F1F592'],
  div: ['#21468C', '#3B73BA', '#7FA6D6', '#BFC9D3', '#E6B49C', '#CF6B4E', '#962B29'],
  rain: ['#26323C', '#1D4766', '#1B6C93', '#2D96BC', '#63C1DD', '#AEE3F0', '#F0FBFD'],
  gray: ['#0F151B', '#353D44', '#666E74', '#9EA5A9', '#D3D7D9', '#FFFFFF'],
  ice: ['#0D1B2A', '#2B4A6A', '#6D8FB0', '#B4CADB', '#F4F8FB'],
  deep: ['#202D38', '#16435F', '#1C6C8C', '#3C9CB4', '#86CDD9', '#E3F7FA'],
  green: ['#111A0C', '#22401A', '#3E6B22', '#6A9A2E', '#A4C95A', '#E3F0A6'],
  soil: ['#3B2716', '#6E4D2B', '#9C8146', '#7E9B5A', '#4E9686', '#2F6FA6'],
  heat: ['#14091F', '#3E1550', '#79215A', '#B53A4A', '#E2683A', '#F7A93B', '#FCE38A'],
  sun: ['#120D06', '#3F2B0E', '#7A5214', '#B57F1E', '#E8B444', '#FBE7A0'],
  terrain: ['#2D3A2A', '#4C6234', '#7D8448', '#A68E5E', '#C7B092', '#F1ECE6'],
  haline: ['#2A1A6A', '#21499A', '#1D78A2', '#27A08E', '#66C46B', '#E2E36A'],
  snow: ['#18212A', '#4E5E6E', '#9AAABA', '#E9F0F6', '#FFFFFF'],
  oceanT: ['#0B1640', '#123A70', '#1C6C9A', '#2FA2B0', '#7DCB9A', '#E9E27A'],
  wind: ['#2B5C8A', '#4FA3D1', '#A6E1F0', '#FFFFFF', '#FFD98A'],
  cur: ['#5FC3D0', '#9FE6EE', '#E6FBFD', '#FFFFFF'],
  drift: ['#3B8BEB', '#1F5FC0', '#0E3A8A'],
};
const hex3 = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const LUTS = {};
function lut(name) {
  if (LUTS[name]) return LUTS[name];
  const st = CM[name].map(hex3), out = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const x = i / 255 * (st.length - 1), k = Math.min(Math.floor(x), st.length - 2), f = x - k;
    for (let c = 0; c < 3; c++) out[i * 3 + c] = Math.round(lerp(st[k][c], st[k + 1][c], f));
  }
  return (LUTS[name] = out);
}
const VEG = [
  ['#2F7D32', L('Broadleaf tree', '阔叶树')], ['#1E5E48', L('Needleleaf tree', '针叶树')], ['#A5C95A', L('C3 grass', 'C3 草')],
  ['#D8C65A', L('C4 grass', 'C4 草')], ['#7E9142', L('Shrub', '灌木')], ['#B4AAA2', L('Urban', '城市')],
  ['#3F8FD0', L('Inland water', '内陆水体')], ['#C9A46B', L('Bare soil', '裸土')], ['#E8F0F6', L('Land ice', '陆冰')],
];
/* map a value to 0..1 for a display spec {lo, hi, tr} */
function norm(s, v) {
  const f = FWD[s.tr || 'lin'];
  return clamp((f(v) - f(s.lo)) / (f(s.hi) - f(s.lo)), 0, 1);
}

/* ================================================================ surface layers */
const G_AU = () => ST.grids.AU, G_OU = () => ST.grids.OU;
const SURF = {};
function S(key, grp, o) { SURF[key] = Object.assign({ key, grp }, o); }
S('t15', 'nov', { f: 't15', cmap: 'thermal', lo: 230, hi: 305, name: L('Air temperature at 1.5 m', '1.5 m 气温'), diurnal: true });
S('tstar', 'inst', { f: 'tstar', cmap: 'thermal', lo: 230, hi: 305, name: L('Surface temperature T*', '地表温度 T*') });
S('sst', 'inst', { f: 'T', k: 0, mask: 'ocean', cmap: 'oceanT', lo: -2, hi: 30, name: L('Sea surface temperature (ocean level 1)', '海表温度（海洋第 1 层）') });
S('sss', 'inst', { f: 'S', k: 0, mask: 'ocean', cmap: 'haline', lo: 32, hi: 37.5, name: L('Sea surface salinity', '海表盐度') });
S('mld', 'inst', { f: 'mld', mask: 'ocean', cmap: 'deep', lo: 0, hi: 500, tr: 'sqrt', name: L('Ocean mixed-layer depth', '海洋混合层深度') });
S('aice', 'inst', { f: 'aice', mask: 'ocean', cmap: 'ice', lo: 0, hi: 1, name: L('Sea-ice concentration', '海冰密集度') });
S('hice', 'inst', { f: 'hice', mask: 'ocean', cmap: 'ice', lo: 0, hi: 5, tr: 'sqrt', name: L('Sea-ice thickness (grid-box mean)', '海冰厚度（格点平均）') });
S('pstar', 'inst', { f: 'pstar', cmap: 'deep', lo: 600, hi: 1040, name: L('Surface pressure p*', '地面气压 p*') });
S('snow', 'inst', { f: 'snow', cmap: 'snow', lo: 0, hi: 60000, tr: 'log1p', name: L('Snow amount', '积雪量') });
S('zbl', 'inst', { f: 'zbl', cmap: 'deep', lo: 0, hi: 2500, name: L('Boundary-layer depth', '边界层厚度') });
S('veg', 'inst', { cat: true, mask: 'land', name: L('Dominant surface type (9 MOSES tiles)', '主导地表类型（MOSES 9 类）'), src: '0/216' });
S('lai', 'inst', { mask: 'land', cmap: 'green', lo: 0, hi: 7, name: L('Leaf area index (box mean)', '叶面积指数（格点平均）'), src: 'Σ 0/216 × 0/217', units: '',
  value: (j, i, lat, lon) => { const a = idxA(lat, lon); let s = 0; for (let p = 0; p < 5; p++) s += F.frac.lev(p)[a] * F.lai.lev(p)[a]; return s; } });
S('smc', 'inst', { f: 'smc', k: 0, mask: 'land', cmap: 'soil', lo: 0, hi: 45, name: L('Soil moisture, top layer (0–10 cm)', '土壤水分，表层（0–10 cm）') });
S('tsoil', 'inst', { f: 'tsoil', k: 0, mask: 'land', cmap: 'thermal', lo: 230, hi: 305, name: L('Soil temperature, top layer', '土壤温度，表层') });
S('orog', 'inst', { f: 'orog', mask: 'land', cmap: 'terrain', lo: 0, hi: 5000, name: L('Orography', '地形高度') });
S('sdorog', 'inst', { f: 'sdorog', mask: 'land', cmap: 'terrain', lo: 0, hi: 1200, tr: 'sqrt', name: L('Sub-grid orography (standard deviation)', '次网格地形（标准差）') });
S('cloudTot', 'nov', { f: 'cloudTot', cmap: 'gray', lo: 0, hi: 1, name: L('Total cloud amount', '总云量') });
S('lsPrecip', 'nov', { f: 'lsPrecip', cmap: 'rain', lo: 0, hi: 20, tr: 'sqrt', name: L('Large-scale rain + snow', '大尺度雨 + 雪') });
S('cvPrecip', 'nov', { f: 'cvPrecip', cmap: 'rain', lo: 0, hi: 20, tr: 'sqrt', name: L('Convective rain + snow', '对流雨 + 雪') });
S('olr', 'nov', { f: 'olr', cmap: 'heat', lo: 120, hi: 310, name: L('Outgoing longwave at the top', '大气顶向外长波') });
S('toaSWin', 'nov', { f: 'toaSWin', cmap: 'sun', lo: 0, hi: 520, name: L('Incoming sunlight at the top', '大气顶入射太阳辐射') });
S('toaSWout', 'nov', { f: 'toaSWout', cmap: 'gray', lo: 0, hi: 300, name: L('Reflected shortwave at the top', '大气顶反射短波') });
S('sfcSWnet', 'nov', { f: 'sfcSWnet', cmap: 'sun', lo: 0, hi: 330, name: L('Net shortwave at the surface', '地面净短波') });
S('albedo', 'nov', { f: 'albedo', cmap: 'gray', lo: 0, hi: 0.9, name: L('Surface albedo (from SW fluxes)', '地表反照率（由短波通量推得）') });
S('sh', 'nov', { f: 'sh', cmap: 'div', lo: -150, hi: 150, mid: 0, name: L('Sensible heat flux (up +)', '感热通量（向上为正）') });
S('lh', 'nov', { f: 'lh', cmap: 'div', lo: -300, hi: 300, mid: 0, name: L('Latent heat flux (up +)', '潜热通量（向上为正）') });
S('gpp', 'nov', { f: 'gpp', mask: 'land', cmap: 'green', lo: 0, hi: 12, tr: 'sqrt', name: L('Gross primary productivity', '总初级生产力') });
S('runoff', 'nov', { f: 'runoff', mask: 'land', cmap: 'rain', lo: 0, hi: 10, tr: 'sqrt', name: L('Runoff (surface + sub-surface)', '径流（地表 + 地下）') });
S('dTaux', 'day30', { f: 'dTaux', mask: 'oceanA', cmap: 'div', lo: -0.4, hi: 0.4, tr: 'ssqrt', mid: 0, name: L('Zonal wind stress τx, atmosphere grid', '纬向风应力 τx，大气网格') });
S('oTaux', 'day30', { f: 'oTaux', mask: 'ocean', cmap: 'div', lo: -0.4, hi: 0.4, tr: 'ssqrt', mid: 0, name: L('Zonal wind stress τx, ocean grid', '纬向风应力 τx，海洋网格') });
S('dWme', 'day30', { f: 'dWme', mask: 'oceanA', cmap: 'deep', lo: 0, hi: 0.012, tr: 'sqrt', name: L('Wind-mixing energy, atmosphere grid', '风混合能，大气网格') });
S('oWme', 'day30', { f: 'oWme', mask: 'ocean', cmap: 'deep', lo: 0, hi: 0.012, tr: 'sqrt', name: L('Wind-mixing energy, ocean grid', '风混合能，海洋网格') });
S('dPmE', 'day30', { f: 'dPmE', mask: 'oceanA', cmap: 'div', lo: -12, hi: 12, tr: 'ssqrt', mid: 0, name: L('P − E, atmosphere grid', 'P − E，大气网格') });
S('oPmE', 'day30', { f: 'oPmE', mask: 'ocean', cmap: 'div', lo: -12, hi: 12, tr: 'ssqrt', mid: 0, name: L('P − E, ocean grid', 'P − E，海洋网格') });
S('oHtn', 'day30', { f: 'oHtn', mask: 'ocean', cmap: 'div', lo: -400, hi: 400, tr: 'ssqrt', mid: 0, name: L('Non-penetrating heat flux into the ocean', '进入海洋的非穿透热通量') });
S('oSol', 'day30', { f: 'oSol', mask: 'ocean', cmap: 'sun', lo: 0, hi: 200, name: L('Penetrating solar into the ocean', '进入海洋的穿透性太阳辐射') });
S('oRiver', 'day30', { f: 'oRiver', mask: 'ocean', cmap: 'rain', lo: 0, hi: 60, tr: 'sqrt', name: L('River outflow into the ocean', '河流入海') });
S('oSnow', 'day30', { f: 'oSnow', mask: 'ocean', cmap: 'snow', lo: 0, hi: 6, tr: 'sqrt', name: L('Snowfall into the ocean / onto ice', '降雪入海 / 落在冰上') });
S('qice', 'inst', { f: 'qice', mask: 'ocean', cmap: 'heat', lo: 0, hi: 120, tr: 'sqrt', name: L('Ocean-to-ice heat flux', '海洋向冰的热通量') });
S('wfix', 'inst', { f: 'wfix', mask: 'ocean', cmap: 'rain', lo: 0, hi: 0.15, tr: 'sqrt', name: L('Water fix (qrparm.waterfix.hadcm3)', 'water fix（qrparm.waterfix.hadcm3）') });
S('psi', 'nov', { f: 'psi', mask: 'ocean', cmap: 'div', lo: -250, hi: 250, tr: 'ssqrt', mid: 0, name: L('Barotropic streamfunction ψ', '正压流函数 ψ'), src: L('Σ 30/320 dz, integrated northward', 'Σ 30/320 dz，向北积分') });
S('sstA', 'inst', { mask: 'oceanA', cmap: 'oceanT', lo: -2, hi: 30, name: L('SST area-averaged to the atmosphere grid', '面积平均到大气网格的 SST'), units: '°C', src: '0/101', calc: true });
const SURF_GROUPS = [
  ['grpState', ['tstar', 'sst', 'sss', 'mld', 'aice', 'hice', 'pstar', 'snow', 'zbl', 'qice', 'wfix']],
  ['grpNov', ['t15', 'cloudTot', 'lsPrecip', 'cvPrecip', 'olr', 'toaSWin', 'toaSWout', 'sfcSWnet', 'albedo', 'sh', 'lh', 'gpp', 'runoff', 'psi']],
  ['grpDay', ['dTaux', 'oTaux', 'dWme', 'oWme', 'dPmE', 'oPmE', 'oHtn', 'oSol', 'oRiver', 'oSnow']],
  ['grpLand', ['veg', 'lai', 'smc', 'tsoil', 'orog', 'sdorog']],
];
const fieldOf = s => s.f ? F[s.f] : null;
const unitsOf = s => s.units != null ? s.units : (fieldOf(s) ? fieldOf(s).units : '');
const srcOf = s => s.src ? tx(s.src) : (fieldOf(s) ? fieldOf(s).src : '');
let SSTA = null;
function sstOnA() {
  if (SSTA) return SSTA;
  SSTA = new Float32Array(96 * 73).fill(NaN);
  const T = F.T.lev(0), sum = new Float32Array(96 * 73), n = new Float32Array(96 * 73);
  for (let j = 0; j < 144; j++) for (let i = 0; i < 288; i++) {
    const v = T[j * 288 + i]; if (Number.isNaN(v)) continue;
    const a = idxA(latO(j), lonO(i)); sum[a] += v * Math.cos(latO(j) * D2R); n[a] += Math.cos(latO(j) * D2R);
  }
  for (let a = 0; a < 96 * 73; a++) if (n[a] > 0 && !LSM[a]) SSTA[a] = sum[a] / n[a];
  return SSTA;
}
let MODEL_T = 0;   // model hours since 1 Dec 00:00 of the current day
function surfValue(s, j, i) {
  const lat = latO(j), lon = lonO(i);
  if (s.value) return s.value(j, i, lat, lon);
  if (s.key === 'sstA') return sstOnA()[idxA(lat, lon)];
  const f = F[s.f];
  if (s.diurnal) {
    const h = wrap360(MODEL_T * 15) / 15, x = h / 3, h0 = Math.floor(x) % 8, h1 = (h0 + 1) % 8, w = x - Math.floor(x), a = idxA(lat, lon);
    return lerp(f.lev(h0)[a], f.lev(h1)[a], w);
  }
  const arr = f.lev(s.k || 0);
  switch (f.grid) {
    case 'A': return arr[idxA(lat, lon)];
    case 'AU': { const a = idxA(lat, lon); return cornersA(arr, Math.floor(a / 96), a % 96); }
    case 'O': return arr[j * 288 + i];
    case 'OU': return cornersO(arr, j, i);
  }
  return NaN;
}
function vegAt(lat, lon) {
  const a = idxA(lat, lon); let best = -1, bv = 0.05;
  for (let p = 0; p < 9; p++) { const v = F.frac.lev(p)[a]; if (v > bv) { bv = v; best = p; } }
  return best;
}
function fillSurface(s, out) {
  const L3 = s.cat ? null : lut(s.cmap), orog = F.orog.lev(0);
  for (let j = 0; j < 144; j++) {
    const lat = latO(j);
    for (let i = 0; i < 288; i++) {
      const o = j * 288 + i, lon = lonO(i), land = KMT[o] === 0;
      let rgb = null;
      const masked = (s.mask === 'ocean' && land) || (s.mask === 'land' && !land) || (s.mask === 'oceanA' && LSM[idxA(lat, lon)] > 0.5);
      if (!masked) {
        if (s.cat) { const p = vegAt(lat, lon); if (p >= 0) rgb = hex3(VEG[p][0]); }
        else { const v = surfValue(s, j, i); if (!Number.isNaN(v)) { const k = Math.round(norm(s, v) * 255) * 3; rgb = [L3[k], L3[k + 1], L3[k + 2]]; } }
      }
      if (!rgb) {
        if (land) { const h = clamp(orog[idxA(lat, lon)] / 4500, 0, 1); rgb = [lerp(52, 118, h), lerp(54, 112, h), lerp(50, 100, h)]; }
        else { const d = KMT[o] / 20; rgb = [lerp(26, 11, d), lerp(52, 28, d), lerp(72, 46, d)]; }
      }
      out[o * 4] = rgb[0]; out[o * 4 + 1] = rgb[1]; out[o * 4 + 2] = rgb[2]; out[o * 4 + 3] = 255;
    }
  }
}

/* ================================================================ sun */
function sunAt(tHours) {
  const d = (330 + tHours / 24) * 365.25 / 360;
  const decl = -23.44 * Math.cos(2 * Math.PI * (d + 10) / 365.25);
  const B = 2 * Math.PI * (d - 81) / 364, eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const lon = wrap360(15 * (12 - ((tHours % 24) + eot / 60)));
  return { decl, lon, v: xyz(decl, lon, 1).normalize() };
}

/* ================================================================ shaders */
const GLSL_COMMON = `
uniform sampler2D uOro; uniform sampler2D uLand; uniform vec2 uOroLoHi; uniform float uRelief; uniform vec3 uCut;
float orogM(vec2 ll) {
  float c = texture2D(uOro, vec2((ll.x + 1.875) / 360.0, (ll.y + 91.25) / 182.5)).r * 255.0;
  return c < 0.5 ? 0.0 : uOroLoHi.x + (c - 1.0) / 254.0 * (uOroLoHi.y - uOroLoHi.x);
}
float landAt(vec2 ll) { return texture2D(uLand, vec2((ll.x + 0.625) / 360.0, (ll.y + 90.0) / 180.0)).r; }
float reliefAt(vec2 ll) { return uRelief * max(orogM(ll), 0.0) / 6000.0 * step(0.5, landAt(ll)); }
vec2 lonlat(vec3 p) { vec3 n = normalize(p); return vec2(mod(degrees(atan(-n.z, n.x + 1e-7)) + 360.0, 360.0), degrees(asin(clamp(n.y, -1.0, 1.0)))); }
bool inCut(float lon) { return uCut.x > 0.5 && mod(lon - uCut.y + 720.0, 360.0) < uCut.z; }
`;
const SH = {
  globeV: `${GLSL_COMMON}
varying vec3 vN;
void main() {
  vec3 n = normalize(position); vec2 ll = lonlat(n);
  vN = n;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(n * (1.0 + reliefAt(ll)), 1.0);
}`,
  globeF: `${GLSL_COMMON}
uniform sampler2D uSurf; uniform sampler2D uSurfB; uniform float uMix; uniform vec3 uSun; uniform float uShade;
uniform float uGridA; uniform float uGridO; uniform vec4 uBand; uniform vec3 uBandCol; uniform float uPolar; uniform float uZen; uniform float uNight;
uniform sampler2D uPsi; uniform float uPsiOn; uniform vec2 uPsiLoHi;
varying vec3 vN;
float gl1(float x) { float w = fwidth(x); return 1.0 - smoothstep(0.0, 1.1 * w, abs(fract(x - 0.5) - 0.5)); }
float glon(float lon, float off, float d) {
  float x1 = (lon - off) / d, x2 = (mod(lon + 180.0, 360.0) - 180.0 - off) / d;
  float a = gl1(x1), b = gl1(x2);
  return fwidth(x1) < fwidth(x2) ? a : b;
}
void main() {
  vec3 n0 = normalize(vN); vec2 ll = lonlat(n0);
  if (inCut(ll.x)) discard;
  vec2 uv = vec2((ll.x + 0.625) / 360.0, (ll.y + 90.0) / 180.0);
  vec3 col = texture2D(uSurf, uv).rgb;
  if (uMix > 0.001) col = mix(col, texture2D(uSurfB, uv).rgb, uMix);
  vec3 n = n0; float land = landAt(ll);
  if (uRelief > 0.0 && land > 0.5) {
    float e = 1.2, cl = max(cos(radians(ll.y)), 0.1);
    float hx = orogM(ll + vec2(e, 0.0)) - orogM(ll - vec2(e, 0.0)), hy = orogM(ll + vec2(0.0, e)) - orogM(ll - vec2(0.0, e));
    float s = uRelief / 6000.0 / (2.0 * radians(e)) * 2.5;
    float la = radians(ll.x), ph = radians(ll.y);
    vec3 east = vec3(-sin(la), 0.0, -cos(la)), north = vec3(-sin(ph) * cos(la), cos(ph), sin(ph) * sin(la));
    n = normalize(n0 - s * (hx / cl * east + hy * north));
  }
  float d0 = dot(n0, uSun), dayf = smoothstep(-0.09, 0.09, d0);
  float lit = mix(uNight, 1.0, dayf) * (0.86 + 0.24 * clamp(dot(n, uSun), 0.0, 1.0) - 0.12 * (1.0 - clamp(dot(n, n0) * 4.0 - 3.0, 0.0, 1.0)));
  col *= mix(1.0, lit, uShade);
  if (uZen > 0.0) col = mix(col, col * vec3(1.25, 1.12, 0.85) + vec3(0.10, 0.07, 0.0), uZen * clamp(d0, 0.0, 1.0));
  if (uShade > 0.0) col += uShade * vec3(0.55, 0.32, 0.12) * (1.0 - smoothstep(0.0, 0.035, abs(d0))) * 0.35;
  if (uGridA > 0.0) { float g = max(glon(ll.x, 1.875, 3.75), gl1((ll.y + 88.75) / 2.5)); col = mix(col, vec3(0.92, 0.96, 1.0), g * uGridA * 0.38); }
  if (uGridO > 0.0) { float g = max(glon(ll.x, 0.625, 1.25), gl1((ll.y + 90.0) / 1.25)); col = mix(col, vec3(0.55, 0.92, 1.0), g * uGridO * 0.32 * (1.0 - land)); }
  if (uBand.z > 0.0) {
    float b = 1.0 - smoothstep(uBand.y, uBand.y + 0.8, abs(ll.y - uBand.x));
    col = mix(col, uBandCol, b * uBand.z * (uBand.w > 0.5 ? (1.0 - land) : 1.0));
  }
  if (uPolar > 0.0) { float w = smoothstep(40.0, 75.0, abs(ll.y)); col = mix(col, vec3(0.45, 0.70, 1.0), w * uPolar * 0.45); }
  if (uPsiOn > 0.0) {
    float c = texture2D(uPsi, vec2(ll.x / 360.0, (ll.y + 89.375) / 178.75)).r * 255.0;
    float x = (uPsiLoHi.x + (c - 1.0) / 254.0 * (uPsiLoHi.y - uPsiLoHi.x)) / 10.0;
    float ln = 1.0 - smoothstep(0.0, 1.2 * fwidth(x), abs(fract(x - 0.5) - 0.5));
    col = mix(col, vec3(0.04, 0.07, 0.11), ln * (1.0 - land) * 0.75);
  }
  gl_FragColor = vec4(col, 1.0);
}`,
  shellV: `${GLSL_COMMON}
uniform float uR0; uniform float uB;
varying vec3 vN;
void main() { vec3 n = normalize(position); vN = n; gl_Position = projectionMatrix * modelViewMatrix * vec4(n * (1.0 + reliefAt(lonlat(n)) * uB + uR0), 1.0); }`,
  shellF: `${GLSL_COMMON}
uniform sampler2D uTex; uniform float uOpacity; uniform vec3 uColor; uniform float uMode; uniform vec3 uSun; uniform float uShade;
varying vec3 vN;
void main() {
  vec2 ll = lonlat(vN);
  if (inCut(ll.x)) discard;
  float a = uOpacity;
  if (uMode < 0.5) {
    float c = texture2D(uTex, vec2((ll.x + 1.875) / 360.0, (ll.y + 91.25) / 182.5)).r * 255.0;
    a *= pow(max(c - 1.0, 0.0) / 254.0, 1.7);
  }
  if (a < 0.008) discard;
  float day = smoothstep(-0.1, 0.15, dot(normalize(vN), uSun));
  gl_FragColor = vec4(uColor * mix(1.0, mix(0.42, 1.0, day), uShade), a);
}`,
  lineV: `attribute vec4 acol; attribute float at;
varying vec4 vC; varying float vT; varying vec3 vW;
void main() { vC = acol; vT = at; vW = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  lineF: `uniform vec3 uCut; uniform float uTime; uniform float uDash; uniform float uSpeed; uniform float uAlpha; uniform float uNoCut;
varying vec4 vC; varying float vT; varying vec3 vW;
bool inCut(float lon) { return uCut.x > 0.5 && mod(lon - uCut.y + 720.0, 360.0) < uCut.z; }
void main() {
  if (uNoCut < 0.5) { vec3 n = normalize(vW); float lon = mod(degrees(atan(-n.z, n.x)) + 360.0, 360.0); if (inCut(lon)) discard; }
  float a = vC.a * uAlpha;
  if (uDash > 0.0) { float f = fract(vT * uDash - uTime * uSpeed); a *= smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.45, 0.6, f)); }
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC.rgb, a);
}`,
  haloV: `varying vec3 vN; varying vec3 vV;
void main() { vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  haloF: `uniform vec3 uColor; uniform float uPow; uniform float uAlpha; varying vec3 vN; varying vec3 vV;
void main() { float f = pow(1.0 - abs(dot(vN, vV)), uPow); gl_FragColor = vec4(uColor, f * uAlpha); }`,
  starV: `attribute float sz; void main() { gl_PointSize = sz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  starF: `void main() { vec2 d = gl_PointCoord - 0.5; float a = 1.0 - smoothstep(0.2, 0.5, length(d)); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0), a * 0.55); }`,
};

/* ================================================================ scene */
let renderer, scene, camera, controls, sunLight, CLOCK;
const SHARED = {
  uOro: { value: null }, uLand: { value: null }, uOroLoHi: { value: new THREE.Vector2(-50, 6000) }, uRelief: { value: RELIEF_MAX },
  uCut: { value: new THREE.Vector3(1, 315, 76) }, uSun: { value: new THREE.Vector3(1, 0, 0) }, uShade: { value: 1 }, uTime: { value: 0 },
};
const OBJ = {};
let surfData, surfTex, surfDataB, surfTexB;

function dataTex(data, w, h, format, filter) {
  const t = new THREE.DataTexture(data, w, h, format, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  t.magFilter = t.minFilter = filter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
}
function aTex(codes) {            // A-grid codes, rows flipped so row 0 is the south pole
  const d = new Uint8Array(96 * 73);
  for (let j = 0; j < 73; j++) d.set(codes.subarray((72 - j) * 96, (73 - j) * 96), j * 96);
  return d;
}
function initScene() {
  const canvas = $('#gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x060B11, 1);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(30, 1, 0.01, 200);
  camera.position.copy(xyz(18, 350, 6.4));
  controls = new OrbitControls(camera, canvas);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enablePan: false, minDistance: 1.6, maxDistance: 12, rotateSpeed: 0.55, zoomSpeed: 0.8, autoRotateSpeed: 0.6 });
  controls.addEventListener('start', () => { CAMTWEEN = null; });
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  sunLight = new THREE.DirectionalLight(0xffffff, 0.85); scene.add(sunLight);
  CLOCK = new THREE.Clock();

  SHARED.uOro.value = dataTex(aTex(F.orog.codes[0]), 96, 73, THREE.RedFormat, THREE.LinearFilter);
  SHARED.uOroLoHi.value.set(F.orog.lo[0], F.orog.hi[0]);
  const land = new Uint8Array(288 * 144); for (let o = 0; o < land.length; o++) land[o] = KMT[o] === 0 ? 255 : 0;
  SHARED.uLand.value = dataTex(land, 288, 144, THREE.RedFormat, THREE.NearestFilter);

  surfData = new Uint8Array(288 * 144 * 4); surfDataB = new Uint8Array(288 * 144 * 4);
  const psi = Float32Array.from(F.psi.lev(0));
  for (let pass = 0; pass < 12; pass++) {
    const nxt = psi.slice();
    for (let j = 0; j < 143; j++) for (let i = 0; i < 288; i++) {
      const o = j * 288 + i; if (psi[o] === psi[o]) continue;
      let s = 0, n = 0;
      for (const [dj, di] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const jj = j + dj; if (jj < 0 || jj > 142) continue; const v = psi[jj * 288 + (i + di + 288) % 288]; if (v === v) { s += v; n++; } }
      if (n) nxt[o] = s / n;
    }
    psi.set(nxt);
  }
  const pc = new Uint8Array(288 * 143);
  for (let o = 0; o < pc.length; o++) pc[o] = psi[o] === psi[o] ? 1 + Math.round(clamp((psi[o] + 100) / 450, 0, 1) * 254) : 0;
  surfTex = dataTex(surfData, 288, 144, THREE.RGBAFormat, THREE.NearestFilter);
  surfTexB = dataTex(surfDataB, 288, 144, THREE.RGBAFormat, THREE.NearestFilter);

  const gU = Object.assign({}, SHARED, {
    uSurf: { value: surfTex }, uSurfB: { value: surfTexB }, uMix: { value: 0 }, uGridA: { value: 0 }, uGridO: { value: 0 },
    uBand: { value: new THREE.Vector4(0, 1, 0, 0) }, uBandCol: { value: new THREE.Color(0xE7B04C) }, uPolar: { value: 0 }, uZen: { value: 0 }, uNight: { value: 0.7 },
    uPsi: { value: null }, uPsiOn: { value: 0 }, uPsiLoHi: { value: new THREE.Vector2(-100, 350) },
  });
  gU.uPsi.value = dataTex(pc, 288, 143, THREE.RedFormat, THREE.LinearFilter);
  OBJ.globe = new THREE.Mesh(new THREE.SphereGeometry(1, 360, 180), new THREE.ShaderMaterial({ uniforms: gU, vertexShader: SH.globeV, fragmentShader: SH.globeF }));
  scene.add(OBJ.globe);

  OBJ.halo = new THREE.Mesh(new THREE.SphereGeometry(1 + ATM_H + 0.01, 96, 48), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(0x3E7FB8) }, uPow: { value: 2.6 }, uAlpha: { value: 0.32 } },
    vertexShader: SH.haloV, fragmentShader: SH.haloF, transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending }));
  OBJ.halo.renderOrder = -1; scene.add(OBJ.halo);

  const ns = 1400, sp = new Float32Array(ns * 3), sz = new Float32Array(ns);
  for (let i = 0; i < ns; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(60 + Math.random() * 40); sp.set([v.x, v.y, v.z], i * 3); sz[i] = 0.8 + Math.random() * 1.8; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  scene.add(new THREE.Points(sg, new THREE.ShaderMaterial({ vertexShader: SH.starV, fragmentShader: SH.starF, transparent: true, depthWrite: false })));

  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const g = sc.getContext('2d'), gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,248,220,1)'); gr.addColorStop(0.18, 'rgba(255,214,120,0.9)'); gr.addColorStop(0.5, 'rgba(231,176,76,0.25)'); gr.addColorStop(1, 'rgba(231,176,76,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  OBJ.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  OBJ.sun.scale.set(2.2, 2.2, 1); scene.add(OBJ.sun);

  buildShells(); buildTowers(); buildGwdBoxes(); buildParticles(); buildLines(); buildCut();
  window.addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(resize).observe($('#stage'));
  resize();
}
function resize() {
  const el = $('#stage'), w = el.clientWidth, h = el.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  camera.fov = Math.max(30, 2 * Math.atan(Math.tan(15 * D2R) / Math.min(camera.aspect, 1)) / D2R);
  camera.updateProjectionMatrix();
}

/* ---------------------------------------------------------------- level shells (clouds, highlight bands) */
function shellMat(opts) {
  return new THREE.ShaderMaterial({
    uniforms: Object.assign({}, SHARED, { uR0: { value: 0 }, uB: { value: 0 }, uTex: { value: opts.tex || null }, uOpacity: { value: opts.opacity || 0.5 },
      uColor: { value: new THREE.Color(opts.color || 0xffffff) }, uMode: { value: opts.tex ? 0 : 1 } }),
    vertexShader: SH.shellV, fragmentShader: SH.shellF, transparent: true, depthWrite: false, blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}
function buildShells() {
  const geo = new THREE.SphereGeometry(1, 200, 100);
  OBJ.clouds = [];
  for (let k = 1; k <= 19; k++) {
    const m = new THREE.Mesh(geo, shellMat({ tex: dataTex(aTex(F.cloud.codes[k - 1]), 96, 73, THREE.RedFormat, THREE.NearestFilter), opacity: 0.42, color: 0xF4F7FA }));
    m.renderOrder = 10 + k; m.visible = false; m.userData.k = k; scene.add(m); OBJ.clouds.push(m);
  }
  OBJ.band = new THREE.Mesh(geo, shellMat({ color: 0xE7B04C, opacity: 0.18, additive: true }));
  OBJ.band.renderOrder = 40; OBJ.band.visible = false; scene.add(OBJ.band);
  OBJ.energy = new THREE.Mesh(geo, shellMat({ color: 0xF06BB4, opacity: 0.0, additive: true }));
  OBJ.energy.renderOrder = 41; OBJ.energy.visible = false; scene.add(OBJ.energy);
  OBJ.iceShell = new THREE.Mesh(new THREE.SphereGeometry(1.0016, 288, 144), new THREE.ShaderMaterial({
    uniforms: Object.assign({}, SHARED, { uTex: { value: dataTex(F.aice.codes[0], 288, 144, THREE.RedFormat, THREE.NearestFilter) }, uH: { value: dataTex(F.hice.codes[0], 288, 144, THREE.RedFormat, THREE.NearestFilter) } }),
    vertexShader: `${GLSL_COMMON} varying vec3 vN; void main() { vN = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `${GLSL_COMMON} uniform sampler2D uTex; uniform sampler2D uH; uniform vec3 uSun; uniform float uShade; varying vec3 vN;
      void main() { vec2 ll = lonlat(vN); if (inCut(ll.x)) discard;
        vec2 uv = vec2((ll.x + 0.625) / 360.0, (ll.y + 90.0) / 180.0);
        float c = texture2D(uTex, uv).r * 255.0; float a = max(c - 1.0, 0.0) / 254.0; if (a < 0.02) discard;
        float h = texture2D(uH, uv).r * 255.0; h = max(h - 1.0, 0.0) / 254.0;
        float day = smoothstep(-0.1, 0.15, dot(normalize(vN), uSun));
        vec3 col = mix(vec3(0.70, 0.80, 0.90), vec3(0.97, 0.99, 1.0), h) * mix(1.0, mix(0.4, 1.0, day), uShade);
        gl_FragColor = vec4(col, 0.25 + 0.7 * a); }`,
    transparent: true, depthWrite: false }));
  OBJ.iceShell.renderOrder = 5; scene.add(OBJ.iceShell);
}
function placeShells() {
  OBJ.clouds.forEach(m => { const k = m.userData.k; m.material.uniforms.uR0.value = atmS(k - 0.5); m.material.uniforms.uB.value = BK[k - 1]; });
}

/* ---------------------------------------------------------------- convective towers */
let TOWERS = [];
function buildTowers() {
  const cca = F.cca.lev(0), ccb = F.ccb.lev(0), cct = F.cct.lev(0);
  TOWERS = [];
  for (let a = 0; a < 96 * 73; a++) {
    if (cca[a] > 0.01 && ccb[a] >= 1 && cct[a] >= ccb[a]) TOWERS.push({ a, lat: latA(Math.floor(a / 96)), lon: lonA(a % 96), cca: cca[a], b: ccb[a], t: cct[a] });
  }
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  OBJ.towers = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x1d1830, transparent: true, opacity: 0.9 }), Math.max(TOWERS.length, 1));
  const c = new THREE.Color();
  TOWERS.forEach((t, i) => { const deep = clamp((t.t - t.b) / 10, 0, 1); c.setRGB(lerp(0.80, 0.80, deep), lerp(0.82, 0.70, deep), lerp(0.86, 1.0, deep)); OBJ.towers.setColorAt(i, c); });
  OBJ.towers.visible = false; OBJ.towers.renderOrder = 8; scene.add(OBJ.towers);
}
const _m = new THREE.Matrix4(), _e = new THREE.Vector3(), _n = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3(), _h = new THREE.Vector3();
/* a box standing on an atmosphere grid box, from level boundary kb0 to kb1, s = fraction of the box width */
function boxAt(mesh, i, lat, lon, kb0, kb1, s) {
  if (inCut(lon) || kb1 <= kb0 || s <= 0) { _m.makeScale(0, 0, 0); mesh.setMatrixAt(i, _m); return; }
  const la = lon * D2R, ph = lat * D2R, r0 = atmR(kb0, lat, lon), r1 = atmR(kb1, lat, lon);
  _u.set(Math.cos(ph) * Math.cos(la), Math.sin(ph), -Math.cos(ph) * Math.sin(la));
  _e.set(-Math.sin(la), 0, -Math.cos(la)).multiplyScalar(3.75 * D2R * Math.max(Math.cos(ph), 0.03) * s);
  _n.set(-Math.sin(ph) * Math.cos(la), Math.cos(ph), Math.sin(ph) * Math.sin(la)).multiplyScalar(-2.5 * D2R * s);
  _p.copy(_u).multiplyScalar(r0);
  _m.makeBasis(_e, _h.copy(_u).multiplyScalar(r1 - r0), _n).setPosition(_p);
  mesh.setMatrixAt(i, _m);
}
function placeTowers(kNow = 99) {
  TOWERS.forEach((t, i) => boxAt(OBJ.towers, i, t.lat, t.lon, t.b - 1, Math.min(t.t, kNow), Math.sqrt(t.cca) * 0.95));
  OBJ.towers.instanceMatrix.needsUpdate = true;
}
let GWD = [];
function buildGwdBoxes() {
  const sd = F.sdorog.lev(0);
  GWD = [];
  for (let k = 0; k < sd.length; k++) if (sd[k] > 380) GWD.push({ lat: latA((k / 96) | 0), lon: lonA(k % 96), sd: sd[k] });
  const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
  OBJ.gwdCols = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0x9FB0CC, transparent: true, opacity: 0.38, depthWrite: false }), Math.max(GWD.length, 1));
  OBJ.gwdMark = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xE9F0FF, transparent: true, opacity: 0.95 }), Math.max(GWD.length, 1));
  OBJ.gwdCols.renderOrder = 33; OBJ.gwdMark.renderOrder = 34;
  OBJ.gwdCols.visible = OBJ.gwdMark.visible = false; scene.add(OBJ.gwdCols); scene.add(OBJ.gwdMark);
}
function placeGwd() {
  GWD.forEach((g, i) => boxAt(OBJ.gwdCols, i, g.lat, g.lon, 0, 19, 0.16 + 0.22 * clamp((g.sd - 380) / 900, 0, 1)));
  OBJ.gwdCols.instanceMatrix.needsUpdate = true;
}
function moveGwdMarks(t) {
  GWD.forEach((g, i) => { const k = 2 + ((t * 2.2 + (i % 7) * 0.9) % 17); boxAt(OBJ.gwdMark, i, g.lat, g.lon, k, k + 0.55, 0.42); });
  OBJ.gwdMark.instanceMatrix.needsUpdate = true;
}

/* ---------------------------------------------------------------- particles */
function lineMat(o = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { uCut: SHARED.uCut, uTime: SHARED.uTime, uDash: { value: o.dash || 0 }, uSpeed: { value: o.speed || 0 }, uAlpha: { value: o.alpha == null ? 1 : o.alpha }, uNoCut: { value: o.nocut ? 1 : 0 } },
    vertexShader: SH.lineV, fragmentShader: SH.lineF, transparent: true, depthWrite: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}
function lineGeo(n) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('acol', new THREE.BufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('at', new THREE.BufferAttribute(new Float32Array(n), 1).setUsage(THREE.DynamicDrawUsage));
  return g;
}
class Flow {
  constructor(n, o) {
    this.n = n; this.o = o; this.lat = new Float32Array(n); this.lon = new Float32Array(n); this.age = new Float32Array(n); this.life = new Float32Array(n);
    this.geo = lineGeo(n * 2); this.obj = new THREE.LineSegments(this.geo, lineMat({ additive: o.additive }));
    this.obj.renderOrder = o.order || 30; this.obj.visible = false; this.obj.frustumCulled = false; scene.add(this.obj);
    this.lut = lut(o.cmap);
  }
  reset() { for (let i = 0; i < this.n; i++) this.spawn(i, true); }
  spawn(i, first) {
    const [la, lo] = this.o.spawn(); this.lat[i] = la; this.lon[i] = lo;
    this.life[i] = 2 + Math.random() * 3; this.age[i] = first ? Math.random() * this.life[i] : 0;
  }
  update(dt) {
    if (!this.obj.visible) return;
    const P = this.geo.attributes.position.array, C = this.geo.attributes.acol.array, o = this.o, v3 = new THREE.Vector3();
    for (let i = 0; i < this.n; i++) {
      let [u, v] = o.sample(this.lat[i], this.lon[i]);
      this.age[i] += dt;
      if (!(u === u) || !(v === v) || this.age[i] > this.life[i]) { this.spawn(i); [u, v] = o.sample(this.lat[i], this.lon[i]); if (!(u === u)) { u = 0; v = 0; } }
      const cl = Math.max(Math.cos(this.lat[i] * D2R), 0.08);
      let dla = v * o.speed * dt, dlo = u * o.speed * dt / cl;
      const cap = 8 * dt; dla = clamp(dla, -cap, cap); dlo = clamp(dlo, -cap / cl, cap / cl);
      this.lat[i] += dla; this.lon[i] = wrap360(this.lon[i] + dlo);
      if (Math.abs(this.lat[i]) > 88.5) { this.spawn(i); }
      const la = this.lat[i], lo = this.lon[i], r = o.radius(la, lo), sp = Math.hypot(u, v);
      const tl = o.trail, tla = la - clamp(v * o.speed * tl, -3, 3), tlo = lo - clamp(u * o.speed * tl / cl, -6, 6);
      xyz(la, lo, r, v3); P[i * 6] = v3.x; P[i * 6 + 1] = v3.y; P[i * 6 + 2] = v3.z;
      xyz(tla, tlo, r, v3); P[i * 6 + 3] = v3.x; P[i * 6 + 4] = v3.y; P[i * 6 + 5] = v3.z;
      const k = Math.round(clamp(sp / o.vmax, 0, 1) * 255) * 3, a = Math.min(1, this.age[i] * 2, (this.life[i] - this.age[i]) * 2) * o.alpha;
      C[i * 8] = C[i * 8 + 4] = this.lut[k] / 255; C[i * 8 + 1] = C[i * 8 + 5] = this.lut[k + 1] / 255; C[i * 8 + 2] = C[i * 8 + 6] = this.lut[k + 2] / 255;
      C[i * 8 + 3] = a; C[i * 8 + 7] = 0;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.acol.needsUpdate = true;
  }
}
const FLOW = {};
let WET = [], ICY = [];
function randomSphere() { return [Math.asin(Math.random() * 2 - 1) / D2R, Math.random() * 360]; }
function pickCell(list, grid) {
  for (let t = 0; t < 30; t++) {
    const c = list[(Math.random() * list.length) | 0], lat = grid === 'O' ? latO((c / 288) | 0) : 0;
    if (Math.random() < Math.cos(lat * D2R) + 0.05) return [lat + (Math.random() - 0.5) * 1.25, lonO(c % 288) + (Math.random() - 0.5) * 1.25];
  }
  return randomSphere();
}
function buildParticles() {
  const gAU = ST.grids.AU, gOU = ST.grids.OU;
  FLOW.wind = new Flow(5200, {
    cmap: 'wind', vmax: 60, speed: 0.11, trail: 0.42, alpha: 0.9, additive: true,
    spawn: randomSphere,
    sample: (la, lo) => { const k = VIEW.winds - 1; return [bilin(F.u.lev(k), gAU, la, lo), bilin(F.v.lev(k), gAU, la, lo)]; },
    radius: (la, lo) => atmR(VIEW.winds - 0.5, la, lo) + 0.002,
  });
  FLOW.cur = new Flow(6000, {
    cmap: 'cur', vmax: 40, speed: 0.07, trail: 0.7, alpha: 0.95,
    spawn: () => WET.length ? pickCell(WET, 'O') : randomSphere(),
    sample: (la, lo) => { const k = VIEW.currents - 1; return [bilin(F.U.lev(k), gOU, la, lo), bilin(F.V.lev(k), gOU, la, lo)]; },
    radius: () => 1.004,
  });
  FLOW.ice = new Flow(2200, {
    cmap: 'drift', vmax: 0.25, speed: 9, trail: 0.6, alpha: 1, order: 31,
    spawn: () => ICY.length ? pickCell(ICY, 'O') : randomSphere(),
    sample: (la, lo) => { const o = idxO(la, lo); if (F.aice.lev(0)[o] < 0.1) return [NaN, NaN]; return [bilin(F.iceU.lev(0), gOU, la, lo), bilin(F.iceV.lev(0), gOU, la, lo)]; },
    radius: () => 1.006,
  });
  const aice = F.aice.lev(0); ICY = []; for (let o = 0; o < aice.length; o++) if (aice[o] > 0.15) ICY.push(o);
}
function setWetLevel(k) { WET = []; for (let o = 0; o < KMT.length; o++) if (KMT[o] >= k) WET.push(o); }

/* ---------------------------------------------------------------- line effects */
const LINES = {};
function makeLines(name, n, o) {
  const geo = lineGeo(n), obj = new THREE.LineSegments(geo, lineMat(o));
  obj.renderOrder = o.order || 32; obj.visible = false; obj.frustumCulled = false; scene.add(obj);
  LINES[name] = { geo, obj, n, used: 0 };
  return LINES[name];
}
function writer(Lr) {
  const P = Lr.geo.attributes.position.array, C = Lr.geo.attributes.acol.array, T = Lr.geo.attributes.at.array; let i = 0;
  return {
    seg(a, b, ca, cb, ta = 0, tb = 1) {
      if (i + 2 > Lr.n) return;
      P.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 3); C.set(ca, i * 4); C.set(cb || ca, i * 4 + 4); T[i] = ta; T[i + 1] = tb; i += 2;
    },
    done() {
      Lr.used = i; Lr.geo.setDrawRange(0, i);
      Lr.geo.attributes.position.needsUpdate = Lr.geo.attributes.acol.needsUpdate = Lr.geo.attributes.at.needsUpdate = true;
    },
  };
}
const rgba = (h, a) => { const c = hex3(h); return [c[0] / 255, c[1] / 255, c[2] / 255, a]; };
function buildLines() {
  makeLines('spikes', 96 * 73 * 4, {}); makeLines('stress', 40000, {}); makeLines('runoff', 120000, { dash: 3, speed: 0.6 });
  makeLines('rays', 4000, { dash: 1.6, speed: 0.9, nocut: true, additive: true });
  makeLines('lw', 4000, { dash: 1.2, speed: 0.8, nocut: true, additive: true }); makeLines('rain', 9000, {});
  makeLines('gsum', 4000, { dash: 1, speed: 0.7, nocut: true, additive: true });
  makeLines('cutLines', 30000, { nocut: true, order: 3 }); makeLines('cutHi', 6000, { nocut: true, order: 4, additive: true });
  makeLines('sunArrow', 8, { nocut: true });
}
function buildSpikes() {
  const w = writer(LINES.spikes), sh = F.sh.lev(0), lh = F.lh.lev(0), a = new THREE.Vector3(), b = new THREE.Vector3();
  for (let j = 0; j < 73; j++) for (let i = 0; i < 96; i++) {
    const lat = latA(j), lon = lonA(i), r = 1 + reliefAt(lat, lon) + 0.003, k = j * 96 + i;
    if (inCut(lon)) continue;
    const s = clamp(sh[k] / 200 * 0.05, -0.03, 0.06), l = clamp(lh[k] / 200 * 0.05, -0.03, 0.08);
    if (Math.abs(s) > 0.002) { xyz(lat, lon + 0.7, r, a); xyz(lat, lon + 0.7, r + s, b); w.seg(a, b, rgba(s > 0 ? '#F29A4A' : '#7F95AE', 0.95), rgba(s > 0 ? '#FFD39A' : '#B9C8D8', 0.35)); }
    if (Math.abs(l) > 0.002) { xyz(lat, lon - 0.7, r, a); xyz(lat, lon - 0.7, r + l, b); w.seg(a, b, rgba('#4FD1E0', 0.95), rgba('#BDF3F8', 0.35)); }
  }
  w.done();
}
function buildStress(grid) {
  const w = writer(LINES.stress), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const isA = grid === 'A', tx_ = (isA ? F.dTaux : F.oTaux).lev(0), ty_ = (isA ? F.dTauy : F.oTauy).lev(0);
  const nx = isA ? 96 : 288, ny = isA ? 72 : 143, step = isA ? 1 : 3;
  for (let j = 0; j < ny; j += step) for (let i = 0; i < nx; i += step) {
    const lat = isA ? 88.75 - 2.5 * j : -88.75 + 1.25 * j, lon = isA ? 1.875 + 3.75 * i : 0.625 + 1.25 * i;
    const X = tx_[j * nx + i], Y = ty_[j * nx + i];
    if (!(X === X) || !(Y === Y) || inCut(lon)) continue;
    if (isA && LSM[idxA(lat, lon)] > 0.5) continue;
    const m = Math.hypot(X, Y); if (m < 0.004) continue;
    const L0 = Math.min(Math.sqrt(m) * (isA ? 5.0 : 3.2), isA ? 3.6 : 2.4), ux = X / m, uy = Y / m, cl = Math.max(Math.cos(lat * D2R), 0.1);
    const la2 = lat + uy * L0, lo2 = lon + ux * L0 / cl, r = 1.003;
    xyz(lat, lon, r, a); xyz(la2, lo2, r, b);
    const col = rgba(isA ? '#FFE3B5' : '#FFFFFF', 0.9);
    w.seg(a, b, rgba(isA ? '#E5864A' : '#7DE3EC', 0.5), col);
    for (const s of [0.45, -0.45]) { const ca = Math.cos(Math.PI + s), sa = Math.sin(Math.PI + s), hx = ux * ca - uy * sa, hy = ux * sa + uy * ca; xyz(la2 + hy * L0 * 0.32, lo2 + hx * L0 * 0.32 / cl, r, c); w.seg(b, c, col, col); }
  }
  w.done();
}
function buildRunoff() {
  const w = writer(LINES.runoff), ro = F.runoff.lev(0), a = new THREE.Vector3(), b = new THREE.Vector3(), A = new THREE.Vector3(), B = new THREE.Vector3(), lu = lut('rain');
  ST.outflow.forEach(([s, d]) => {
    const v = ro[s]; if (!(v > 0.08)) return;
    const la1 = latA((s / 96) | 0), lo1 = lonA(s % 96), la2 = latA((d / 96) | 0), lo2 = lonA(d % 96);
    if (inCut(lo1) && inCut(lo2)) return;
    xyz(la1, lo1, 1, A); xyz(la2, lo2, 1, B);
    const ang = A.angleTo(B), N = clamp(Math.round(ang / 0.03), 2, 24), k = Math.round(norm({ lo: 0, hi: 10, tr: 'sqrt' }, v) * 200 + 55) * 3;
    const col = [lu[k] / 255, lu[k + 1] / 255, lu[k + 2] / 255, 0.95];
    for (let q = 0; q < N; q++) {
      const t0 = q / N, t1 = (q + 1) / N;
      slerpTo(A, B, t0, a).multiplyScalar(1 + reliefAt(la1, lo1) * (1 - t0) + 0.006 + 0.05 * ang * Math.sin(Math.PI * t0));
      slerpTo(A, B, t1, b).multiplyScalar(1 + reliefAt(la1, lo1) * (1 - t1) + 0.006 + 0.05 * ang * Math.sin(Math.PI * t1));
      w.seg(a, b, col, col, t0 * ang * 6, t1 * ang * 6);
    }
  });
  w.done();
}
function slerpTo(A, B, t, out) {
  const ang = A.angleTo(B); if (ang < 1e-6) return out.copy(A);
  const s = Math.sin(ang), wa = Math.sin((1 - t) * ang) / s, wb = Math.sin(t * ang) / s;
  return out.set(A.x * wa + B.x * wb, A.y * wa + B.y * wb, A.z * wa + B.z * wb).normalize();
}
function buildRain(kind) {
  const w = writer(LINES.rain); w.done();
  const pr = (kind === 'cv' ? F.cvPrecip : F.lsPrecip).lev(0), cdf = [], cells = [];
  let tot = 0;
  for (let k = 0; k < pr.length; k++) { const v = pr[k]; if (v > 0.3) { tot += v * Math.cos(latA((k / 96) | 0) * D2R); cdf.push(tot); cells.push(k); } }
  RAIN.drops = [];
  const n = 2600, cl = F.cloud, ts = F.tstar.lev(0), cct = F.cct.lev(0);
  for (let q = 0; q < n && cells.length; q++) {
    const x = Math.random() * tot; let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < x) lo = m + 1; else hi = m; }
    const k = cells[lo], lat = latA((k / 96) | 0) + (Math.random() - 0.5) * 2.4, lon = lonA(k % 96) + (Math.random() - 0.5) * 3.6;
    let top = 6;
    if (kind === 'cv' && cct[k] > 0) top = cct[k];
    else { let best = 0; for (let l = 0; l < 12; l++) { const c = cl.lev(l)[k]; if (c > best) { best = c; top = l + 1; } } }
    RAIN.drops.push({ lat, lon, kb: top, h: Math.random(), snow: ts[k] < 271.5 });
  }
}
const RAIN = { drops: [], kind: '' };
function updateRain(dt) {
  const Lr = LINES.rain; if (!Lr.obj.visible) return;
  const w = writer(Lr), a = new THREE.Vector3(), b = new THREE.Vector3();
  const cR = rgba('#8FD3F5', 0.85), cR0 = rgba('#8FD3F5', 0), cS = rgba('#FFFFFF', 0.95), cS0 = rgba('#FFFFFF', 0.2);
  RAIN.drops.forEach(d => {
    d.h -= dt * (d.snow ? 0.22 : 0.6); if (d.h < 0) d.h += 1;
    if (inCut(d.lon)) return;
    const kb = d.kb * d.h, r = atmR(kb, d.lat, d.lon), len = d.snow ? 0.004 : 0.016;
    xyz(d.lat, d.lon, r, a); xyz(d.lat, d.lon, r + len, b);
    w.seg(a, b, d.snow ? cS : cR, d.snow ? cS0 : cR0);
  });
  w.done();
}
function buildRays(sun) {
  const w = writer(LINES.rays), s = sun.v, e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  e1.set(0, 1, 0).cross(s).normalize(); e2.copy(s).cross(e1).normalize();
  const out = F.toaSWout.lev(0), inn = F.toaSWin.lev(0);
  for (let q = 0; q < 320; q++) {
    const rr = Math.sqrt(Math.random()) * 0.97, th = Math.random() * Math.PI * 2, ox = rr * Math.cos(th), oy = rr * Math.sin(th);
    const hit = Math.sqrt(1 - rr * rr) * (1 + ATM_H * 0.15);
    b.copy(e1).multiplyScalar(ox).addScaledVector(e2, oy).addScaledVector(s, hit);
    a.copy(b).addScaledVector(s, 2.2);
    w.seg(a, b, rgba('#FFD27A', 0.0), rgba('#FFD27A', 0.85), 0, 1);
    const [la, lo] = lonlatOf(b), k = idxA(la, lo), alb = inn[k] > 5 ? clamp(out[k] / inn[k], 0, 1) : 0;
    if (Math.random() < alb) {
      const n = b.clone().normalize(), d = s.clone().negate(), rdir = d.sub(n.multiplyScalar(2 * d.dot(n)));
      c.copy(b).addScaledVector(rdir, 0.7);
      w.seg(b, c, rgba('#FFFFFF', 0.85), rgba('#FFFFFF', 0), 1, 2);
    }
  }
  w.done();
}
function buildLW() {
  const w = writer(LINES.lw), olr = F.olr.lev(0), a = new THREE.Vector3(), b = new THREE.Vector3(), lu = lut('heat');
  for (let q = 0; q < 1300; q++) {
    const [la, lo] = randomSphere(), k = idxA(la, lo), v = olr[k];
    if (Math.random() > Math.pow((v - 100) / 220, 2)) continue;
    const r = atmR(19, la, lo), ci = Math.round(norm({ lo: 120, hi: 310 }, v) * 255) * 3, col = [lu[ci] / 255, lu[ci + 1] / 255, lu[ci + 2] / 255, 0.85];
    xyz(la, lo, r, a); xyz(la, lo, r + 0.22, b);
    const t0 = Math.random(); w.seg(a, b, col, [col[0], col[1], col[2], 0], t0, t0 + 1);
  }
  w.done();
}
function buildGsum() {
  const w = writer(LINES.gsum), a = new THREE.Vector3(), top = new THREE.Vector3(0, 1 + ATM_H + 0.45, 0), m = new THREE.Vector3();
  for (let q = 0; q < 700; q++) {
    const [la, lo] = randomSphere(); xyz(la, lo, atmR(19, la, lo), a);
    m.copy(a).add(top).multiplyScalar(0.5).normalize().multiplyScalar(1.55);
    const t0 = Math.random(); w.seg(a, m, rgba('#F06BB4', 0.7), rgba('#F06BB4', 0.7), t0, t0 + 0.5); w.seg(m, top, rgba('#F06BB4', 0.7), rgba('#FFD0EA', 0.9), t0 + 0.5, t0 + 1);
  }
  w.done();
}

/* ---------------------------------------------------------------- cutaway faces */
const CUTA = {
  temp: { f: 'temp', cmap: 'thermal', lo: 195, hi: 305, name: L('temperature', '温度'), units: 'K' },
  thetal: { f: 'thetal', cmap: 'thermal', lo: 250, hi: 480, name: L('θl (as stored)', 'θl（dump 中的变量）'), units: 'K' },
  u: { f: 'u', cmap: 'div', lo: -50, hi: 50, mid: 0, name: L('zonal wind u', '纬向风 u'), units: 'm/s' },
  v: { f: 'v', cmap: 'div', lo: -20, hi: 20, mid: 0, name: L('meridional wind v', '经向风 v'), units: 'm/s' },
  qt: { f: 'qt', cmap: 'rain', lo: 0, hi: 18, tr: 'sqrt', name: L('total water qt', '总水 qt'), units: 'g/kg' },
  cloud: { f: 'cloud', cmap: 'gray', lo: 0, hi: 0.7, tr: 'sqrt', name: L('layer cloud (Nov mean)', '层状云量（11 月平均）'), units: '' },
  swHeat: { f: 'swHeat', cmap: 'sun', lo: 0, hi: 4, name: L('SW heating (Nov mean)', '短波加热（11 月平均）'), units: 'K/day' },
  lwHeat: { f: 'lwHeat', cmap: 'div', lo: -4, hi: 4, mid: 0, name: L('LW heating (Nov mean)', '长波加热（11 月平均）'), units: 'K/day' },
};
const CUTO = {
  T: { f: 'T', cmap: 'oceanT', lo: -2, hi: 29, name: L('temperature', '温度'), units: '°C' },
  S: { f: 'S', cmap: 'haline', lo: 33.8, hi: 36.8, name: L('salinity', '盐度'), units: 'psu' },
  U: { f: 'U', cmap: 'div', lo: -30, hi: 30, tr: 'ssqrt', mid: 0, name: L('zonal current (Nov mean)', '纬向流（11 月平均）'), units: 'cm/s' },
  V: { f: 'V', cmap: 'div', lo: -10, hi: 10, tr: 'ssqrt', mid: 0, name: L('meridional current (Nov mean)', '经向流（11 月平均）'), units: 'cm/s' },
};
let CUTMESH = null;
function colorOf(spec, v, shade) {
  if (!(v === v)) return [0.16 * shade, 0.18 * shade, 0.2 * shade];
  const L3 = lut(spec.cmap), k = Math.round(norm(spec, v) * 255) * 3;
  return [L3[k] / 255 * shade, L3[k + 1] / 255 * shade, L3[k + 2] / 255 * shade];
}
function buildCut() {
  if (CUTMESH) { scene.remove(CUTMESH); CUTMESH.geometry.dispose(); }
  const pos = [], col = [];
  const P = new THREE.Vector3();
  const quad = (lon, laS, laN, r0S, r1S, r0N, r1N, c) => {
    const v = [xyz(laS, lon, r0S, P).toArray(), xyz(laS, lon, r1S, P).toArray(), xyz(laN, lon, r1N, P).toArray(), xyz(laN, lon, r0N, P).toArray()];
    for (const q of [0, 1, 2, 0, 2, 3]) { pos.push(v[q][0], v[q][1], v[q][2]); col.push(c[0], c[1], c[2]); }
  };
  const lw = writer(LINES.cutLines), a = new THREE.Vector3(), b = new THREE.Vector3();
  if (VIEW.cut) {
    const fa = CUTA[VIEW.cutA], fo = CUTO[VIEW.cutO], gAU = ST.grids.AU, gOU = ST.grids.OU;
    [VIEW.cutLon, wrap360(VIEW.cutLon + VIEW.cutW)].forEach((lon, fi) => {
      const shade = fi === 0 ? 1 : 0.8, lineC = [1, 1, 1, 0.13];
      for (let j = 0; j < 73; j++) {
        const lat = latA(j), laN = Math.min(90, lat + 1.25), laS = Math.max(-90, lat - 1.25), ia = idxA(lat, lon);
        const rS = reliefAt(laS, lon), rN = reliefAt(laN, lon);
        for (let k = 1; k <= 19; k++) {
          const f = F[fa.f], v = f.grid === 'AU' ? bilin(f.lev(k - 1), gAU, lat, lon) : f.lev(k - 1)[ia];
          const r0S = 1 + rS * bkAt(k - 1) + atmS(k - 1), r1S = 1 + rS * bkAt(k) + atmS(k), r0N = 1 + rN * bkAt(k - 1) + atmS(k - 1), r1N = 1 + rN * bkAt(k) + atmS(k);
          quad(lon, laS, laN, r0S, r1S, r0N, r1N, colorOf(fa, v, shade));
          xyz(laS, lon, r1S, a); xyz(laN, lon, r1N, b); lw.seg(a, b, lineC, lineC);
        }
      }
      const io = Math.round(wrap360(lon) / 1.25) % 288, fO = F[fo.f], soil = F.smc, ts = F.tsoil;
      for (let j = 0; j < 144; j++) {
        const lat = latO(j), laS = Math.max(-90, lat - 0.625), laN = Math.min(90, lat + 0.625), kmt = KMT[j * 288 + io];
        if (kmt > 0) {
          for (let k = 1; k <= kmt; k++) {
            const v = fO.grid === 'OU' ? cornersO(fO.lev(k - 1), j, io) : fO.lev(k - 1)[j * 288 + io];
            const r0 = ocnR(k - 1), r1 = ocnR(k);
            quad(lon, laS, laN, r1, r0, r1, r0, colorOf(fo, v, shade));
            xyz(laS, lon, r1, a); xyz(laN, lon, r1, b); lw.seg(a, b, lineC, lineC);
          }
          quad(lon, laS, laN, 1 - OCN_H - 0.002, ocnR(kmt), 1 - OCN_H - 0.002, ocnR(kmt), [0.20 * shade, 0.17 * shade, 0.14 * shade]);
        } else {
          const rS = 1 + reliefAt(laS, lon), rN = 1 + reliefAt(laN, lon), ia = idxA(lat, lon);
          for (let k = 1; k <= 4; k++) {
            const sv = soil.lev(k - 1)[ia], c = (sv === sv) ? colorOf({ cmap: 'soil', lo: 0, hi: [45, 110, 280, 860][k - 1] }, sv, shade) : [0.3 * shade, 0.26 * shade, 0.22 * shade];
            quad(lon, laS, laN, rS - SOIL_DZ * k, rS - SOIL_DZ * (k - 1), rN - SOIL_DZ * k, rN - SOIL_DZ * (k - 1), c);
          }
          quad(lon, laS, laN, 1 - OCN_H - 0.002, rS - SOIL_DZ * 4, 1 - OCN_H - 0.002, rN - SOIL_DZ * 4, [0.20 * shade, 0.17 * shade, 0.14 * shade]);
        }
      }
      for (let j = 0; j < 36; j++) {
        const laS = -90 + 5 * j, laN = laS + 5;
        quad(lon, laS, laN, 0.02, 1 - OCN_H - 0.002, 0.02, 1 - OCN_H - 0.002, [0.07 * shade, 0.08 * shade, 0.09 * shade]);
      }
      const sc = [1, 1, 1, 0.7];
      for (let j = 0; j < 144; j++) { const l1 = latO(j) - 0.625, l2 = latO(j) + 0.625; xyz(l1, lon, 1 + reliefAt(l1, lon) + 0.0008, a); xyz(l2, lon, 1 + reliefAt(l2, lon) + 0.0008, b); lw.seg(a, b, sc, sc); }
      cutOverlays(lon, lw);
    });
  }
  lw.done();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  CUTMESH = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  CUTMESH.renderOrder = 2; scene.add(CUTMESH);
  LINES.cutLines.obj.visible = VIEW.cut;
  updateCutLabels();
}
/* overlay lines on a face: boundary-layer top, tropopause, mixed layer */
function cutOverlays(lon, lw) {
  const a = new THREE.Vector3(), b = new THREE.Vector3();
  if (FX.bltop) {
    const zbl = F.zbl.lev(0), c = rgba('#4FC79A', 1);
    for (let j = 0; j < 72; j++) { const l1 = latA(j), l2 = latA(j + 1); xyz(l1, lon, atmR(kbOfHeight(zbl[idxA(l1, lon)]), l1, lon) + 0.0015, a); xyz(l2, lon, atmR(kbOfHeight(zbl[idxA(l2, lon)]), l2, lon) + 0.0015, b); lw.seg(a, b, c, c); }
  }
  if (FX.trop) {
    const tr = F.trop.lev(0), c = rgba('#E7B04C', 1);
    for (let j = 0; j < 72; j++) { const l1 = latA(j), l2 = latA(j + 1); xyz(l1, lon, atmR(tr[idxA(l1, lon)] - 0.5, l1, lon), a); xyz(l2, lon, atmR(tr[idxA(l2, lon)] - 0.5, l2, lon), b); lw.seg(a, b, c, c); }
  }
  if (FX.mld) {
    const mld = F.mld.lev(0), io = Math.round(wrap360(lon) / 1.25) % 288, c = rgba('#7DE3EC', 1);
    for (let j = 0; j < 143; j++) {
      const o1 = j * 288 + io, o2 = o1 + 288; if (KMT[o1] === 0 || KMT[o2] === 0) continue;
      xyz(latO(j), lon, ocnR(kbOfDepth(mld[o1])), a); xyz(latO(j + 1), lon, ocnR(kbOfDepth(mld[o2])), b); lw.seg(a, b, c, c);
    }
  }
}

/* ---------------------------------------------------------------- labels */
const LBL = new Map();
function setLabel(id, text, pos, cls = '', face = null) {
  let o = LBL.get(id);
  if (!o) { const el = document.createElement('div'); el.className = 'lbl ' + cls; $('#labels').appendChild(el); o = { el, pos: new THREE.Vector3() }; LBL.set(id, o); }
  if (o.el.textContent !== text) o.el.textContent = text;
  o.pos.copy(pos); o.face = face;
}
function dropLabels(prefix) { LBL.forEach((o, id) => { if (id.startsWith(prefix)) { o.el.remove(); LBL.delete(id); } }); }
const _v = new THREE.Vector3(), _d = new THREE.Vector3();
function updateLabels() {
  const el = $('#stage'), w = el.clientWidth, h = el.clientHeight, cam = camera.position;
  LBL.forEach(o => {
    _v.copy(o.pos).project(camera);
    _d.copy(o.pos).sub(cam); const len = _d.length(); _d.normalize();
    const b = cam.dot(_d), c = cam.lengthSq() - 1, disc = b * b - c;
    let hidden = _v.z > 1;
    if (o.face != null) { const a = wrap360(lonlatOf(cam)[1] - o.face); hidden = hidden || !VIEW.cut || a > 160 || a < 18 || cam.length() > 7 || w < 640; }
    else hidden = hidden || (disc > 0 && -b - Math.sqrt(disc) < len - 0.02 && -b - Math.sqrt(disc) > 0);
    if (hidden) { o.el.style.display = 'none'; return; }
    o.el.style.display = '';
    o.el.style.transform = `translate(${(_v.x * 0.5 + 0.5) * w}px, ${(-_v.y * 0.5 + 0.5) * h}px) translate(-50%, -50%)`;
  });
}
function updateCutLabels() {
  dropLabels('cut:');
  if (!VIEW.cut) return;
  const lon = VIEW.cutLon;
  [1, 10, 19].forEach(k => setLabel('cut:a' + k, `k=${k} · ${fmtP(levelP(k))} hPa`, xyz(-38, lon, atmR(k - 0.5, -38, lon)), 'lvl', lon));
  const zc = ST.levels.ocn.z;
  [1, 10, 20].forEach(k => setLabel('cut:o' + k, `k=${k} · ${zc[k - 1] < 100 ? zc[k - 1].toFixed(0) : Math.round(zc[k - 1])} m`, xyz(-62, lon, ocnR(k - 0.5)), 'lvl', lon));
}

/* ================================================================ effects state per stage */
const FX = {};
let CAMTWEEN = null;
function camTo(lat, lon, d, dur = 1.6) {
  if (REDUCED || !VIEW.autoCam) { if (VIEW.autoCam) camera.position.copy(xyz(lat, lon, d)); return; }
  const from = camera.position.clone(), to = xyz(lat, lon, d);
  CAMTWEEN = { from, to, t: 0, dur };
}
const CAM = {     /* focus point [lat, lon] and camera distance */
  globe: [15, 320, 6.2], atl: [5, 325, 5.6], pac: [0, 160, 5.6], npac: [40, 185, 5.4], mc: [0, 115, 5.2], gulf: [35, 295, 5.3], amazon: [-6, 300, 5.2],
  tibet: [30, 85, 5.2], africa: [5, 18, 5.4], natl: [45, 325, 5.2], arctic: [80, 340, 4.9], npole: [80, 330, 5.0], siberia: [55, 100, 5.3],
};
function applyCam(key, sun) {
  if (!key) return;
  let lat, lon, d;
  if (key === 'sun') { lat = clamp(sun.decl * 0.7, -30, 30); lon = sun.lon - 20; d = 5.6; }
  else [lat, lon, d] = CAM[key];
  /* the western face of the wedge runs just east of the focus; the camera looks into the wedge at 35° to each face */
  const polar = Math.abs(lat) > 60;
  if (VIEW.cutFollow && !polar) VIEW.cutLon = Math.round(wrap360(lon + 5));
  const camLon = polar ? lon : wrap360(VIEW.cutLon + (VIEW.cut ? Math.min(28, VIEW.cutW / 2) : -5));
  camTo(clamp(polar ? lat : lat * 0.6 + 14, -78, 78), camLon, d);
}

/* ================================================================ stages */
const MACRO = [];
(function () {
  MACRO.push({ id: 'init', kind: 'init' });
  for (let s = 1; s <= 48; s++) MACRO.push({ id: 'a' + s, kind: 'atm', s, rad: (s - 1) % 6 === 0 });
  MACRO.push({ id: 'A2O', kind: 'a2o' });
  for (let s = 1; s <= 24; s++) MACRO.push({ id: 'o' + s, kind: 'ocn', s });
  MACRO.push({ id: 'O2A', kind: 'o2a' });
  MACRO.push({ id: 'next', kind: 'next' });
  MACRO.push({ id: 'end', kind: 'end' });
})();
const seqOf = (mod, ids) => ids.map(p => [mod, p]);
const range = (pfx, a, b) => Array.from({ length: b - a + 1 }, (_, i) => pfx + (a + i));
function stagesOf(m, detail) {
  const out = [];
  const add = (mod, p, card) => out.push({ mod, p, card });
  if (m.kind === 'init') { add(null, 'init', 0); add('cpl', 'k1', 0); return out; }
  if (m.kind === 'atm') {
    const s = m.s, full = detail || s <= 2 || s === 48;
    if (full) {
      const c = k => s === 1 ? k : (m.rad ? 9 : (s === 48 ? 8 : 8));
      add('rad', 'r1', c(1));
      range('d', 1, 3).forEach(p => add('dyn', p, c(1)));
      range('d', 4, 10).forEach(p => add('dyn', p, c(2)));
      if (!m.rad) add('cloud', 'c1', c(3));
      ['c2', 'c3', 'c4', 'c5'].forEach(p => add('cloud', p, c(3)));
      if (!m.rad) { add('rad', 'r10', c(3)); add('rad', 'r11', c(3)); }
      if (s === 1) add('eng', 'e1', c(3));
      add('eng', 'e2', c(3));
      if (m.rad) range('r', 2, 9).forEach(p => add('rad', p, c(4)));
      range('b', 1, 14).forEach(p => add('bl', p, c(5)));
      add('cloud', 'c7', c(6)); add('cloud', 'c8', c(6));
      ['v1', 'v2', 'v3', 'KLOOP', 'v8', 'v9', 'v10', 'v11'].forEach(p => add('conv', p, c(6)));
      range('h', 1, 6).forEach(p => add('hydro', p, c(7)));
      range('w', 1, 4).forEach(p => add('gwd', p, c(7)));
    } else {
      const c = m.rad ? 9 : 8;
      add('rad', 'r1', c); add('dyn', 'd5', c); add('cloud', 'c3', c); add('eng', 'e2', c);
      add('rad', m.rad ? 'r6' : 'r10', c); add('bl', 'b7', c); add('cloud', 'c7', c); add('conv', 'v6', c); add('hydro', 'h4', c); add('gwd', 'w3', c);
    }
    add('cpl', 'k2', s === 1 ? 7 : (m.rad ? 9 : 8));
    if (s === 48) { range('g', 1, 7).forEach(p => add('veg', p, 10)); ['e4', 'e5', 'e6'].forEach(p => add('eng', p, 10)); }
    return out;
  }
  if (m.kind === 'a2o') { range('k', 3, 7).forEach(p => add('cpl', p, 11)); return out; }
  if (m.kind === 'ocn') {
    if (m.s === 1 || detail) {
      add('ocn', 'n1', m.s === 1 ? 12 : 16); add('ocn', 'ROWS', m.s === 1 ? 12 : 16); add('ocn', 'n16', m.s === 1 ? 14 : 16);
      add('ocn', 'n17', m.s === 1 ? 15 : 16); range('i', 3, 6).forEach(p => add('ice', p, m.s === 1 ? 15 : 16));
    } else { add('ocn', 'ROWSF', 16); add('ocn', 'n16', 16); add('ice', 'i4', 16); add('ice', 'i5', 16); }
    return out;
  }
  if (m.kind === 'o2a') { add('cpl', 'k9', 17); add('cpl', 'k10', 17); return out; }
  if (m.kind === 'next') { add(null, 'next', 18); return out; }
  add(null, 'end', 19); return out;
}
const ROWPROCS = range('n', 2, 15);
const KPROCS = ['v4', 'v5', 'v6', 'v7'];
const P = { mi: 0, si: 0, t: 0, playing: false, speed: 1, detail: false, list: [], sub: null };
function isShort(m) { return m.kind === 'atm' ? !(P.detail || m.s <= 2 || m.s === 48) : (m.kind === 'ocn' ? !(P.detail || m.s === 1) : false); }
function durOf(st, m) {
  if (st.p === 'ROWS') return 12; if (st.p === 'KLOOP') return 9; if (st.p === 'ROWSF') return 1.4;
  if (isShort(m)) return 0.32;
  if (st.p === 'c7') return 4.5;
  const off = offProc(st); return off ? 1.8 : 3.4;
}
function offProc(st) { const n = procNode(st.mod, st.p); return n && n.off; }

/* ---------------------------------------------------------------- networks (v2) */
const NETS = HN ? HN.NETS : {};
const GCACHE = {};
function graphOf(key) {
  const ck = key + ':' + LANG;
  if (!GCACHE[ck]) { try { HN.init(V1[LANG].MODS, LANG); GCACHE[ck] = HN.graph(key); } catch (e) { GCACHE[ck] = null; } }
  return GCACHE[ck];
}
function procNode(mod, p) { const n = NETS[mod]; return n ? n.nodes.find(x => x.id === p) : null; }
function procsOf(mod) { const n = NETS[mod]; return n ? n.nodes.filter(x => x.k === 'proc') : []; }
function procNum(mod, p) { return procsOf(mod).findIndex(x => x.id === p) + 1; }

/* ---------------------------------------------------------------- presets: what the 3D view shows for each routine */
const MDEF = {
  dyn: { surf: 'pstar', fx: { winds: 12 }, cutA: 'u', cam: 'atl' },
  cloud: { surf: 'cloudTot', fx: { clouds: 1 }, cutA: 'cloud', cam: 'pac' },
  eng: { surf: 't15', fx: { energy: 1 }, cutA: 'temp', cam: 'globe' },
  rad: { surf: 'toaSWout', fx: { sunpos: 1 }, cutA: 'swHeat', cam: 'sun' },
  bl: { surf: 'sh', fx: { spikes: 1, kband: [0, 5] }, cutA: 'temp', cam: 'gulf' },
  conv: { surf: 'cvPrecip', fx: { towers: 1 }, cutA: 'qt', cam: 'mc' },
  hydro: { surf: 'smc', fx: {}, cutA: 'temp', cam: 'amazon' },
  gwd: { surf: 'sdorog', fx: { gwd: 1, winds: 12 }, cutA: 'u', cam: 'tibet' },
  veg: { surf: 'veg', fx: {}, cam: 'africa', cut: false },
  cpl: { surf: 'oTaux', fx: { gridA: 1 }, cam: 'natl' },
  ocn: { surf: 'sst', fx: { currents: 1 }, cutO: 'T', cutA: 'temp', cam: 'atl' },
  ice: { surf: 'aice', fx: { iceDrift: 1 }, cam: 'arctic', cut: false },
};
const PRE = {
  init: { surf: 'tstar', fx: { gridA: 1 }, cam: 'globe', cutA: 'temp', cutO: 'T', hud: L('The start dumps hold every prognostic field: the atmosphere on 96 × 73 boxes and 19 levels, the ocean on 288 × 144 boxes and 20 levels. The fields on this globe come from such a pair of dumps, valid 1 Dec 00:00.', '启动 dump 存着所有预报场：大气 96 × 73 个格点、19 层，海洋 288 × 144 个格点、20 层。地球上显示的场就取自这样一对 dump（12 月 1 日 00:00）。') },
  k1: { surf: 'sst', fx: { gridA: 1, gridO: 1 }, cam: 'natl', hud: L('INITTIME sets the coupling period: 48 atmosphere steps of 30 min, then 24 ocean steps of 1 h, make one coupled day. Each atmosphere box covers 3 × 2 ocean boxes.', 'INITTIME 设定耦合周期：48 个 30 分钟的大气步，再加 24 个 1 小时的海洋步，构成一个耦合日。每个大气格点覆盖 3 × 2 个海洋格点。') },
  r1: { keep: true },
  d1: { hud: L('Δt = 1800 s for advection; the fast gravity waves get A_ADJSTEPS = 3 adjustment sub-steps of 600 s.', 'Δt = 1800 s 用于平流；快速的重力波用 A_ADJSTEPS = 3 个 600 s 的调整子步。') },
  d2: { fx: { winds: 12, polar: 1, gridA: 1 }, cam: 'npole', cut: false, hud: L('SET_FIL: near the poles the 3.75° meridians converge, so the grid boxes get narrow. Those rows get a Fourier filter; which zonal waves are removed is recomputed every step from GRAV_WAVE_SPEED and the strongest wind in each row.', 'SET_FIL：极区 3.75° 的经线汇聚，格点变窄，这些行要做傅里叶滤波；滤掉哪些纬向波每步都根据 GRAV_WAVE_SPEED 和每行最大风速重新计算。') },
  d3: { fx: { winds: 12, pulse: 1 }, hud: L('ADJ_CTL × 3: pressure-gradient and Coriolis terms for p*, θ, u, v over three 600 s sub-steps, with polar filtering inside each.', 'ADJ_CTL × 3：在三个 600 s 子步内积分 p*、θ、u、v 的气压梯度力和科氏力项，每个子步内都做极区滤波。') },
  d4: { cutA: 'thetal', hud: L('θl and qt are what the dump itself stores (0/5, 0/11); the section shows θl.', 'dump 中存的就是 θl 和 qt（0/5、0/11）；剖面显示 θl。') },
  d5: { hud: L('ADV_CTL: everything is carried by the wind over the full 30 minutes. The particles follow u, v on level 12 (≈ 250 hPa, the jet streams) from the start dump.', 'ADV_CTL：所有量随风平流整整 30 分钟。粒子沿启动 dump 第 12 层（约 250 hPa，急流所在）的 u、v 运动。') },
  d7: { cutA: 'v' },
  d8: { hud: L('DIF_CTL: ∇⁶ diffusion damps the shortest waves on levels 1–18; ∇² on the top level.', 'DIF_CTL：∇⁶ 扩散在第 1–18 层抑制最短波；顶层用 ∇²。') },
  d9: { cutA: 'qt' },
  d10: { fx: { winds: 12, polar: 1, gridA: 1 }, cam: 'npole', cut: false },
  c1: { hud: L('Not a radiation step: the heating rates stored at the last radiation step are read back.', '非辐射步：读回上一个辐射步存下的加热率。') },
  c2: { hud: L('Switched off in tdaah (L_RHCPT = .FALSE.): RHcrit is a fixed number per level.', 'tdaah 中关闭（L_RHCPT = .FALSE.）：RHcrit 按层取固定值。') },
  c3: { hud: L('LS_CLD: cloud forms where qt exceeds RHcrit × qsat over part of the box (RHcrit 0.95 → 0.70 upward). Shells: November-mean layer cloud on each of the 19 levels.', 'LS_CLD：格点内部分区域 qt 超过 RHcrit × qsat 就成云（RHcrit 从 0.95 往上降到 0.70）。各层壳：19 个模式层的 11 月平均层状云量。') },
  c4: { hud: L('Switched off in tdaah (L_CLD_AREA = .FALSE.).', 'tdaah 中关闭（L_CLD_AREA = .FALSE.）。') },
  c7: { surf: 'lsPrecip', fx: { clouds: 1, rain: 'ls', ksweep: 'down' }, cam: 'npac', hud: L('LS_PPN works from the top level down: ice falls, cloud water above a threshold turns to rain (higher threshold over land), rain evaporates below cloud.', 'LS_PPN 从顶层往下逐层计算：冰晶下落，云水超过阈值转为雨（陆地阈值更高），雨在云下蒸发。') },
  c8: { surf: 'lsPrecip', fx: { rain: 'ls' }, cam: 'npac' },
  e1: { hud: L('First step of the day: the daily net-flux sum starts again from zero.', '每天第一步：当日净通量累计从零开始。') },
  e2: { hud: L('ADD_ENG_CORR: yesterday’s energy error comes back as one uniform temperature increment, the same at every grid point and level.', 'ADD_ENG_CORR：前一天的能量误差作为一个统一的温度增量加回来，每个格点、每一层都一样。') },
  e4: { fx: { gsum: 1 }, hud: L('ENG_MASS_DIAG: total energy of the atmosphere now, to compare with 24 hours ago.', 'ENG_MASS_DIAG：此刻大气的总能量，与 24 小时前比较。') },
  e5: { fx: { gsum: 1 }, hud: L('DO_SUMS: global sum of the day’s net energy input (radiation, latent heat of rain and snow, surface sensible heat).', 'DO_SUMS：全球求和当天的净能量输入（辐射、雨雪潜热、地面感热）。') },
  e6: { fx: { gsum: 1, energy: 1 }, hud: L('CAL_ENG_MASS_CORR: energy change minus net input is the error; it becomes tomorrow’s uniform heating rate. p* is corrected for dry-mass drift.', 'CAL_ENG_MASS_CORR：能量变化减去净输入即误差，变成明天统一的加热率；同时修正 p* 的干空气质量漂移。') },
  r2: { fx: { sunpos: 1, trop: 1 }, cutA: 'temp', hud: L('TROPIN: the tropopause level of each column (the yellow line on the section is a lapse-rate estimate from the dump temperatures).', 'TROPIN：每个气柱的对流层顶层次（剖面上的黄线是用 dump 温度做的递减率估计）。') },
  r3: { surf: 'toaSWin', fx: { sunpos: 1 } },
  r4: { surf: 'toaSWin', fx: { sunpos: 1, zenith: 1 }, hud: L('SOLANG: mean cos(zenith angle) and sunlit fraction over the next 3 hours at every point.', 'SOLANG：每个格点未来 3 小时的平均 cos(天顶角) 和日照比例。') },
  r5: { surf: 'albedo', fx: { sunpos: 1 }, hud: L('FTSA: albedo of open sea, of sea ice (from its surface temperature) and of snow; land albedo comes from the MOSES tiles. Colours: November-mean albedo from the surface SW fluxes.', 'FTSA：开阔海面、海冰（由冰面温度决定）和积雪的反照率；陆面反照率来自 MOSES tile。颜色：由地面短波通量推得的 11 月平均反照率。') },
  r6: { surf: 'toaSWout', fx: { rays: 1, sunpos: 1, segments: 1 }, cutA: 'swHeat', hud: L('R2_SWRAD: Edwards–Slingo two-stream shortwave, 6 bands, for every sunlit point, done in A_SW_SEGMENTS = 4 chunks. Part of the light is reflected (white).', 'R2_SWRAD：Edwards–Slingo 二流短波，6 个波段，对每个日照点计算，分 A_SW_SEGMENTS = 4 块完成。部分光被反射（白色）。') },
  r7: { surf: 'olr', fx: { lw: 1, sunpos: 1 }, cutA: 'lwHeat', hud: L('R2_LWRAD: longwave in 8 bands at every point, day and night: water vapour, CO₂ (280 ppm), CH₄, N₂O, ozone, cloud.', 'R2_LWRAD：每个格点都算 8 个波段的长波，不分昼夜：水汽、CO₂（280 ppm）、CH₄、N₂O、臭氧、云。') },
  r8: { cutA: 'swHeat', hud: L('The heating rates are stored for the next 5 steps (RADINCS), shortwave per unit of incoming sunlight.', '加热率存下供后 5 步使用（RADINCS），短波按单位入射日照存储。') },
  r9: { hud: L('The net radiative heating of each column joins the day’s energy budget.', '每个气柱的净辐射加热计入当天的能量收支。') },
  r10: { surf: 't15', fx: { sunpos: 1, zenith: 1 }, cutA: 'swHeat', cam: 'sun', hud: L('Between radiation steps the stored shortwave heating is rescaled to this step’s sun angle, so day and night still move smoothly; longwave is reapplied as stored.', '两次辐射计算之间，存下的短波加热按本步太阳高度角重新缩放，昼夜交替因此仍是平滑的；长波原样加回。') },
  r11: { surf: 'veg', fx: { sunpos: 1 }, cam: 'africa', hud: L('RAD_MOSES: net radiation for each of the 9 surface tiles.', 'RAD_MOSES：9 种地表 tile 各自的净辐射。') },
  b1: { surf: 'veg', fx: {}, cam: 'africa', hud: L('TILEPTS: lists of the points that carry each of the 9 surface types.', 'TILEPTS：列出拥有每种地表类型（共 9 种）的格点。') },
  b2: { surf: 'gpp', fx: {}, cam: 'africa', hud: L('PHYSIOL: stomatal conductance, photosynthesis and respiration of the 5 plant types (colours: November-mean GPP).', 'PHYSIOL：5 种植物功能型的气孔导度、光合与呼吸（颜色：11 月平均 GPP）。') },
  b3: { fx: { kband: [0, 5] } },
  b4: { hud: L('SF_EXCH: exchange coefficients and fluxes for sea, sea ice and each land tile. Spikes: November-mean sensible (orange) and latent (cyan) heat flux.', 'SF_EXCH：海面、海冰和每个陆面 tile 的交换系数与通量。竖线：11 月平均感热（橙）和潜热（青）通量。') },
  b5: { fx: { kband: [0, 5], bltop: 1 } }, b6: { fx: { kband: [0, 5], bltop: 1 } },
  b7: { surf: 'tstar', fx: { kband: [0, 5], bltop: 1 }, hud: L('IM_CAL_TQ: implicit solve for T and q through the BL_LEVELS = 5 lowest levels (green line: boundary-layer top, 0/25).', 'IM_CAL_TQ：对最低 BL_LEVELS = 5 层隐式求解 T 和 q（绿线：边界层顶，0/25）。') },
  b8: { surf: 'aice', fx: {}, cam: 'arctic', cut: false, hud: L('SICE_HTF: heat conducted through the ice from its surface temperature and depth. The atmosphere, not the ocean, solves the ice surface energy balance.', 'SICE_HTF：由冰面温度和冰厚算穿过冰层的热传导。冰面能量平衡由大气而不是海洋求解。') },
  b9: { surf: 'lh', fx: { spikes: 1 } },
  b10: { surf: 'snow', fx: {}, cam: 'siberia' },
  b11: { surf: 't15', fx: {}, hud: L('SCREEN_TQ: temperature and humidity at 1.5 m. Colours: November-mean 1.5 m temperature at this time of day; scrub the day to see it follow the sun.', 'SCREEN_TQ：1.5 m 的温度和湿度。颜色：当日此刻的 11 月平均 1.5 m 气温；拖动时间可看到它随太阳变化。') },
  b12: { surf: 'dTaux', fx: { stressA: 1 }, cut: false, hud: L('IM_CAL_UV: implicit solve for u, v; it gives the surface wind stress (arrows: 30 Nov daily mean).', 'IM_CAL_UV：隐式求解 u、v，得到地面风应力（箭头：11 月 30 日日平均）。') },
  b13: { surf: 'cloudTot', fx: { clouds: 1 } },
  b14: { fx: {} },
  v1: { hud: L('A_CONV_STEP = 1: convection runs on every step.', 'A_CONV_STEP = 1：每一步都做对流。') },
  v2: { fx: { towers: 1, segments: 1 }, hud: L('CONV_CTL → GLUE_CONV: the columns are processed in A_CONVECT_SEGMENTS = 3 chunks.', 'CONV_CTL → GLUE_CONV：气柱分 A_CONVECT_SEGMENTS = 3 块处理。') },
  KLOOP: { fx: { towers: 'k', ksweep: 'up' } },
  v8: { hud: L('COR_ENGY: temperatures are corrected so each column conserves moist static energy. Cloud amount CCA = 0.7873 + 0.06 ln(condensed water) (CON_RAD).', 'COR_ENGY：订正温度，使每个气柱的湿静力能守恒。云量 CCA = 0.7873 + 0.06 ln(凝结水量)（CON_RAD）。') },
  v9: { hud: L('Switched off in tdaah (L_3D_CCA = .FALSE.): one convective cloud amount per column, as drawn here.', 'tdaah 中关闭（L_3D_CCA = .FALSE.）：每个气柱只有一个对流云量，即图中的方柱。') },
  v10: { fx: { towers: 1, rain: 'cv' } }, v11: { fx: { rain: 'cv' } },
  h1: { fx: { soil: 1 }, hud: L('HEAT_CON: thermal conductivity of the 4 soil layers (0.1, 0.25, 0.65 and 2.0 m thick, coloured by moisture on the section).', 'HEAT_CON：4 个土壤层（厚 0.1、0.25、0.65、2.0 m，剖面按含水量着色）的导热率。') },
  h2: { surf: 'snow', fx: {}, cam: 'siberia' },
  h3: { surf: 'runoff', fx: { runoff: 1 }, cut: false, hud: L('SURF_HYD: interception and throughfall on each tile; water the soil cannot take runs off. Each arc joins a land box to its coastal outflow point (0/93), where the coupler will deliver its runoff.', 'SURF_HYD：每个 tile 上的截留和穿透降水；土壤吸收不了的水形成径流。每条弧把一个陆地格点连到它的入海点（0/93），耦合器会把径流送到那里。') },
  h4: { surf: 'smc', fx: { soil: 1 }, hud: L('SOIL_HYD: water moves between the 4 layers, roots take it up, the bottom layer drains.', 'SOIL_HYD：水在 4 层之间流动，根系吸水，最底层排水。') },
  h5: { surf: 'tsoil', fx: { soil: 1 } },
  h6: { surf: 'smc', fx: { soil: 1 } },
  w1: { hud: L('UV_TO_P: winds interpolated to the land pressure points.', 'UV_TO_P：把风插值到陆地气压点。') },
  w2: { hud: L('GW_SURF: surface stress from the sub-grid orography (0/34) and the low-level wind; KAY_GWAVE = 2 × 10⁴ m⁻¹.', 'GW_SURF：由次网格地形（0/34）和低层风算地面应力；KAY_GWAVE = 2 × 10⁴ m⁻¹。') },
  w3: { fx: { gwd: 1, winds: 12, kband: [2, 19] }, hud: L('GW_VERT: the stress is deposited where the wave saturates, testing from START_LEVEL_GWDRAG = 3 upward; hydraulic-jump and trapped lee-wave drag are added.', 'GW_VERT：从 START_LEVEL_GWDRAG = 3 层往上检验，在波饱和处释放应力；另加水跃和陷波拖曳。') },
  g1: { hud: L('Counting steps since the last TRIFFID call.', '统计距上次 TRIFFID 调用的步数。') },
  g2: { surf: 'lai', hud: L('PHENOL, every day: leaf turnover from temperature updates the leaf area.', 'PHENOL，每天一次：由温度得到落叶率，更新叶面积。') },
  g3: { hud: L('TRIFFID runs every TRIFFID_PERIOD = 10 days, on fluxes averaged over that period.', 'TRIFFID 每 TRIFFID_PERIOD = 10 天运行一次，用这段时间的平均通量。') },
  g5: { hud: L('TRIFFID: carbon balance of each plant type and competition for space (Lotka–Volterra) set new fractions of the 5 plant types.', 'TRIFFID：各植物功能型的碳收支和空间竞争（Lotka–Volterra）决定 5 种植物的新比例。') },
  g7: { surf: 'lai' },
  k2: { keep: true },
  k3: { surf: 'dTaux', fx: { gridA: 1 }, hud: L('SETGRCTL: the atmosphere has finished its day; control passes to the ocean.', 'SETGRCTL：大气跑完这一天，控制权交给海洋。') },
  k4: { surf: 'dPmE', fx: { runoff: 1, gridA: 1 }, cut: false, hud: L('SWAP_A2O: gather the daily means. Runoff from every land box goes to its outflow point on the coast (arcs).', 'SWAP_A2O：收集日平均场。每个陆地格点的径流送到海岸上的入海点（弧线）。') },
  k5: { surf: 'dTaux', fx: { gridA: 1, gridO: 1, stressA: 1 }, cut: false, hud: L('H_INT_CO, COAST_AJ: bilinear weights from the 96 × 73 grid to the 288 × 144 grid, adjusted at coasts. Each atmosphere box covers 3 × 2 ocean boxes.', 'H_INT_CO、COAST_AJ：从 96 × 73 网格到 288 × 144 网格的双线性权重，并在海岸处调整。每个大气格点覆盖 3 × 2 个海洋格点。') },
  k6: { surf: 'oTaux', fx: { regrid: 'a2o', gridO: 1, stressO: 1 }, cut: false, hud: L('Interpolate and combine: wind stress (shown, 30 Nov), wind mixing, solar, heat, P − E, river outflow, snowfall, ice fluxes.', '插值并组合：风应力（图示，11 月 30 日）、风混合、太阳辐射、热量、P − E、河流入海、降雪、海冰通量。') },
  k7: { surf: 'oHtn', fx: { gridO: 1 }, cut: false, hud: L('SCATTER_FIELD: the ocean now holds its forcing for the whole day (net heat flux shown).', 'SCATTER_FIELD：海洋拿到了一整天的强迫场（图示为净热通量）。') },
  n1: { hud: L('OCN_FRST: on the first step of the day MOD(ITT, NMIX = 24) = 1, so this is the Euler-backward mixing step; the other 23 are leapfrog steps.', 'OCN_FRST：每天第一步 MOD(ITT, NMIX = 24) = 1，所以这是 Euler 后差混合步；其余 23 步是蛙跳步。') },
  ROWS: { fx: { currents: 1, rows: 1, mld: 1 } },
  ROWSF: { fx: { currents: 1, rows: 1 } },
  n16: { surf: 'psi', fx: { psi: 1 }, cam: 'globe', cut: false, hud: L('TROP_CTL → RELAX: with a rigid lid the depth-mean flow comes from a streamfunction, solved for the whole globe by successive over-relaxation (SOR = 1.775, up to MXSCAN = 500 sweeps), with NISLE = 6 island circulations. Colours: ψ from the November-mean currents.', 'TROP_CTL → RELAX：刚盖近似下，深度平均流由流函数给出，用超松弛迭代对全球求解（SOR = 1.775，最多 MXSCAN = 500 次），含 NISLE = 6 个岛屿环流。颜色：由 11 月平均洋流算出的 ψ。') },
  n17: { surf: 'aice', fx: {}, cam: 'arctic', cut: false },
  i3: { hud: L('Init_Ocean_Ice: split the fluxes from the coupler between ice and the open leads.', 'Init_Ocean_Ice：把耦合器传来的通量分到冰面和冰间水道。') },
  i4: { surf: 'hice', fx: { iceDrift: 1 }, hud: L('ICEDRIFT: ice depth, snow depth and concentration move with the surface currents (lines: November-mean ice velocity); ice depth is diffused. No rheology.', 'ICEDRIFT：冰厚、雪深和密集度随表层流移动（线条：11 月平均海冰速度）；冰厚做扩散。没有冰流变学。') },
  i5: { surf: 'qice', fx: {}, hud: L('ICEFLOE: zero-layer thermodynamics with leads; the ocean supplies heat ∝ (T₁ − T_freeze). Colours: ocean-to-ice heat flux.', 'ICEFLOE：带冰间水道的零层热力学；海洋供热 ∝ (T₁ − T_冰点)。颜色：海洋向冰的热通量。') },
  i6: { surf: 'aice', hud: L('Concentration capped at AMXNORTH = 0.995 in the north and AMXSOUTH = 0.98 in the south.', '密集度上限：北半球 AMXNORTH = 0.995，南半球 AMXSOUTH = 0.98。') },
  k9: { surf: 'sst', fx: { gridO: 1 }, cam: 'natl', cut: false, hud: L('SWAP_O2A: gather the SST, surface currents and ice state at the end of the ocean’s day.', 'SWAP_O2A：收集海洋这一天结束时的 SST、表层流和海冰状态。') },
  k10: { surf: 'sstA', fx: { regrid: 'o2a', gridA: 1 }, cut: false, hud: L('Area-average 3 × 2 ocean boxes into each atmosphere box. The atmosphere sees this SST, unchanged, for the whole of the next day.', '把 3 × 2 个海洋格点面积平均到每个大气格点。下一整天大气看到的都是这个不变的 SST。') },
  next: { surf: 't15', fx: {}, cam: 'globe', hud: L('Day n + 1 starts with atmosphere step 49 and the new SST. 360 such days make a model year: 17 280 atmosphere steps, 8 640 ocean steps, 720 swaps.', '第 n + 1 天从大气第 49 步开始，用新的 SST。360 个这样的日子构成一个模式年：17 280 个大气步、8 640 个海洋步、720 次交换。') },
  end: { surf: 'tstar', fx: {}, cam: 'globe', hud: L('DUMPCTL writes the final dumps, from which a continuation run or a new experiment can start.', 'DUMPCTL 写出最终 dump，续跑或新的试验都可以从这里开始。') },
};
function presetOf(st) {
  if (st.p === 'init' || st.p === 'next' || st.p === 'end') return PRE[st.p];
  const base = MDEF[st.mod] || {}, o = PRE[st.p] || {};
  if (o.keep) return o;
  return Object.assign({}, base, o, { fx: o.fx || base.fx || {} });
}

/* ================================================================ apply a stage */
let CUR = { m: null, st: null, pre: null, lastMod: null, loop: '' };
let PREVFX = {};
function curMacro() { return MACRO[P.mi]; }
function stageTime() {
  const m = curMacro(), n = P.list.length, d = durOf(P.list[P.si], m), f = clamp((P.si + P.t / d) / Math.max(n, 1), 0, 0.999);
  if (m.kind === 'atm') return (m.s - 1) * 0.5 + f * 0.5;
  if (m.kind === 'ocn') return (m.s - 1) + f;
  if (m.kind === 'init') return 0;
  return 24;
}
function go(mi, si, opts = {}) {
  P.mi = clamp(mi, 0, MACRO.length - 1);
  const m = curMacro();
  P.list = stagesOf(m, P.detail);
  P.si = si < 0 ? P.list.length - 1 : clamp(si, 0, P.list.length - 1);
  P.t = 0; P.sub = null;
  applyStage(opts);
  renderTimeline(); renderChips(); renderPanel(); renderHud();
}
function applyStage(opts = {}) {
  const m = curMacro(), st = P.list[P.si], pre = presetOf(st);
  const modChanged = CUR.lastMod !== st.mod;
  CUR = { m, st, pre, lastMod: st.mod, loop: '' };
  MODEL_T = stageTime();
  const oc = m.kind === 'ocn' || m.kind === 'a2o' || m.kind === 'o2a';
  const sun = sunAt(oc ? 24 : MODEL_T);
  for (const k of Object.keys(FX)) delete FX[k];
  Object.assign(FX, pre.keep ? PREVFX : {}, pre.fx || {});
  PREVFX = Object.assign({}, FX);
  if (oc) FX.noSun = 1;
  if (VIEW.follow && !pre.keep) {
    VIEW.surf = pre.surf || VIEW.surf;
    const fx = pre.fx || {};
    VIEW.winds = fx.winds || 0; VIEW.currents = fx.currents ? (VIEW.currents || 1) : 0;
    VIEW.clouds = !!fx.clouds; VIEW.towers = !!fx.towers; VIEW.rain = fx.rain || ''; VIEW.runoff = !!fx.runoff; VIEW.psi = !!fx.psi;
    VIEW.gridA = !!fx.gridA; VIEW.gridO = !!fx.gridO;
    VIEW.cut = pre.cut !== false;
    if (pre.cutA) VIEW.cutA = pre.cutA;
    if (pre.cutO) VIEW.cutO = pre.cutO;
  }
  FLOOR_K = -1;
  if (!opts.noCam && !pre.keep && !isShort(m) && (modChanged || (PRE[st.p] && PRE[st.p].cam))) applyCam(pre.cam, sun);
  REGRID.t = 0; REGRID.dir = FX.regrid || ''; REGRID.filled = '';
  refreshAll();
  syncLayers();
}
const REGRID = { t: 0, dir: '', filled: '' };
let LAST_SURF = '', LAST_HOUR = -1;
const BUILT = {};
function once(name, key, fn) { if (BUILT[name] !== key) { BUILT[name] = key; fn(); } }
function refreshAll() {
  const g = OBJ.globe.material.uniforms;
  const s = SURF[VIEW.surf] || SURF.tstar;
  const hourKey = s.diurnal ? Math.round(MODEL_T * 4) : -1;
  if (VIEW.surf !== LAST_SURF || hourKey !== LAST_HOUR) {
    fillSurface(s, surfData); surfTex.needsUpdate = true; LAST_SURF = VIEW.surf; LAST_HOUR = hourKey;
  }
  if (FX.regrid && REGRID.filled !== FX.regrid) {
    fillSurface(SURF[FX.regrid === 'a2o' ? 'dTaux' : 'sst'], surfDataB); surfTexB.needsUpdate = true; REGRID.filled = FX.regrid;
  }
  g.uGridA.value = VIEW.gridA ? 1 : 0; g.uGridO.value = VIEW.gridO ? 1 : 0;
  g.uPolar.value = FX.polar ? 1 : 0; g.uZen.value = FX.zenith ? 0.9 : 0; g.uNight.value = CUR.st && CUR.st.mod === 'rad' ? 0.48 : 0.7;
  g.uPsiOn.value = VIEW.psi ? 1 : 0;
  SHARED.uRelief.value = VIEW.relief === 'off' ? 0 : RELIEF_MAX;
  const oro = SHARED.uOro.value, filt = VIEW.relief === 'blocky' ? THREE.NearestFilter : THREE.LinearFilter;
  if (oro.magFilter !== filt) { oro.magFilter = oro.minFilter = filt; oro.needsUpdate = true; }
  SHARED.uCut.value.set(VIEW.cut ? 1 : 0, VIEW.cutLon, VIEW.cutW);
  const geoKey = [VIEW.cut, VIEW.cutLon, VIEW.cutW, VIEW.vmode, VIEW.relief].join('|');
  placeShells();
  OBJ.clouds.forEach(m => { m.visible = VIEW.clouds; });
  OBJ.towers.visible = !!VIEW.towers && TOWERS.length > 0;
  if (OBJ.towers.visible) once('towers', geoKey + (FX.towers === 'k' ? 'k' : ''), () => placeTowers(FX.towers === 'k' ? 0 : 99));
  OBJ.iceShell.visible = VIEW.ice;
  FLOW.wind.obj.visible = VIEW.winds > 0; if (VIEW.winds > 0 && FLOW.wind.k !== VIEW.winds) { FLOW.wind.k = VIEW.winds; FLOW.wind.reset(); }
  FLOW.cur.obj.visible = VIEW.currents > 0; if (VIEW.currents > 0 && FLOW.cur.k !== VIEW.currents) { FLOW.cur.k = VIEW.currents; setWetLevel(VIEW.currents); FLOW.cur.reset(); }
  FLOW.ice.obj.visible = !!FX.iceDrift; if (FX.iceDrift && !FLOW.ice.done) { FLOW.ice.reset(); FLOW.ice.done = true; }
  LINES.spikes.obj.visible = !!FX.spikes; if (FX.spikes) once('spikes', geoKey, buildSpikes);
  const sg = FX.stressO ? 'O' : 'A';
  LINES.stress.obj.visible = !!(FX.stressA || FX.stressO); if (FX.stressA || FX.stressO) once('stress', geoKey + sg, () => buildStress(sg));
  LINES.runoff.obj.visible = VIEW.runoff; if (VIEW.runoff) once('runoff', geoKey, buildRunoff);
  OBJ.gwdCols.visible = OBJ.gwdMark.visible = !!FX.gwd && GWD.length > 0; if (FX.gwd) once('gwd', geoKey, placeGwd);
  LINES.rain.obj.visible = !!VIEW.rain; if (VIEW.rain && RAIN.kind !== VIEW.rain) { RAIN.kind = VIEW.rain; buildRain(VIEW.rain); }
  LINES.lw.obj.visible = !!FX.lw; if (FX.lw) once('lw', geoKey, buildLW);
  LINES.gsum.obj.visible = !!FX.gsum; if (FX.gsum) once('gsum', geoKey, buildGsum);
  LINES.rays.obj.visible = !!FX.rays;
  OBJ.energy.visible = !!FX.energy;
  OBJ.band.visible = false;
  dropLabels('fx:');
  once('cut', [geoKey, VIEW.cutA, VIEW.cutO, !!FX.bltop, !!FX.trop, !!FX.mld].join('|'), buildCut);
  renderLegend();
}

/* ================================================================ per-frame animation */
let SUNNOW = sunAt(0), RAYS_AT = -99;
function animate(dt, now) {
  SHARED.uTime.value = now;
  const m = curMacro(), st = P.list[P.si];
  if (P.playing) {
    P.t += dt * P.speed;
    const d = durOf(st, m);
    if (P.t >= d) { advance(1); return; }
  }
  const d = durOf(st, m), f = clamp(P.t / d, 0, 1);
  MODEL_T = stageTime();
  const sun = sunAt(FX.noSun ? 24 : MODEL_T); SUNNOW = sun;
  SHARED.uSun.value.copy(sun.v); SHARED.uShade.value = (VIEW.shade && !FX.noSun) ? 1 : 0;
  OBJ.sun.visible = !FX.noSun && VIEW.shade; OBJ.sun.position.copy(sun.v).multiplyScalar(14);
  sunLight.position.copy(sun.v).multiplyScalar(10);
  if (SURF[VIEW.surf] && SURF[VIEW.surf].diurnal && Math.round(MODEL_T * 4) !== LAST_HOUR) { fillSurface(SURF[VIEW.surf], surfData); surfTex.needsUpdate = true; LAST_HOUR = Math.round(MODEL_T * 4); renderLegend(); }
  if (FX.rays && Math.abs(now - RAYS_AT) > 1.2) { buildRays(sun); RAYS_AT = now; }
  if (FX.sunpos) {
    setLabel('fx:sun', fmt(L('subsolar point · δ = {d}°', '太阳直射点 · δ = {d}°'), { d: sun.decl.toFixed(1) }), xyz(sun.decl, sun.lon, 1.02));
  }
  /* loops and sweeps */
  const g = OBJ.globe.material.uniforms, band = OBJ.band.material.uniforms;
  g.uBand.value.z = 0; OBJ.band.visible = false; LINES.cutHi.obj.visible = false;
  let loop = '';
  if (st.p === 'KLOOP') {
    const x = f * 18, k = Math.min(Math.floor(x) + 1, 18), sub = Math.min(Math.floor((x - (k - 1)) * 4), 3);
    setSub(KPROCS[sub]);
    if (FLOOR_K !== k) { FLOOR_K = k; placeTowers(k + 1); }
    showLevelBand(k - 1, k + 1, '#A58CF2');
    loop = `k = ${k} → ${k + 1} / 19 · ${fmtP(levelP(k))} hPa`;
  } else if (FX.ksweep === 'down') {
    const k = 19 - Math.min(Math.floor(f * 19), 18);
    showLevelBand(k - 1, k, '#C9D6E2'); loop = `k = ${k} ↓ · ${fmtP(levelP(k))} hPa`;
  } else if (FX.kband) {
    showLevelBand(FX.kband[0], FX.kband[1], st.mod === 'gwd' ? '#8796B0' : '#4FC79A', 0.10 + 0.05 * Math.sin(now * 3));
  }
  if (st.p === 'ROWS' || st.p === 'ROWSF') {
    let j, sub;
    if (st.p === 'ROWSF') { j = Math.min(Math.floor(f * 144), 143); sub = 2; }
    else if (f < 0.5) { const q = f / 0.25; j = Math.min(Math.floor(q), 1); sub = Math.min(Math.floor((q - j) * 14), 13); }
    else { const q = (f - 0.5) / 0.5 * 142; j = 2 + Math.min(Math.floor(q), 141); sub = Math.min(Math.floor((q - Math.floor(q)) * 14), 13); }
    setSub(ROWPROCS[sub]);
    const lat = latO(j);
    g.uBand.value.set(lat, 0.45, 0.85, 1); g.uBandCol.value.set(0xE7B04C);
    showRowCut(j);
    loop = `j = ${j + 1} / 144 · ${fmtLat(lat)} · ${procNode('ocn', ROWPROCS[sub]).r.split(' · ')[0]}`;
  }
  if (FX.segments && (st.p === 'r6' || st.p === 'v2')) {
    const nseg = st.p === 'r6' ? 4 : 3, s = Math.min(Math.floor(f * nseg), nseg - 1);
    const latN = 90 - s * 180 / nseg, latS = latN - 180 / nseg;
    g.uBand.value.set((latN + latS) / 2, 90 / nseg - 0.8, 0.28, 0); g.uBandCol.value.set(st.p === 'r6' ? 0xE7B04C : 0xA58CF2);
    loop = `${st.p === 'r6' ? 'A_SW_SEGMENTS' : 'A_CONVECT_SEGMENTS'}: ${s + 1} / ${nseg}`;
  }
  if (FX.pulse) {
    const s = Math.min(Math.floor(f * 3), 2), ph = (f * 3) % 1;
    OBJ.energy.visible = true; const u = OBJ.energy.material.uniforms;
    u.uColor.value.set(0x6FAEE0); u.uOpacity.value = 0.22 * Math.sin(Math.PI * ph); u.uR0.value = atmS(19) * (0.25 + 0.75 * ph); u.uB.value = 0;
    loop = `ADJ_CTL ${s + 1} / 3 · ${(s * 10)}–${(s + 1) * 10} min`;
  } else if (FX.energy) {
    const u = OBJ.energy.material.uniforms; u.uColor.value.set(0xF06BB4); u.uR0.value = atmS(19); u.uB.value = 0; u.uOpacity.value = 0.10 + 0.08 * Math.sin(now * 4);
  }
  if (REGRID.dir && FX.regrid) {
    REGRID.t += dt;
    const x = clamp((REGRID.t - 0.6) / 1.8, 0, 1);
    g.uMix.value = 1 - smooth(x);
    g.uGridA.value = FX.regrid === 'a2o' ? 1 - smooth(x) : smooth(x);
    g.uGridO.value = FX.regrid === 'a2o' ? smooth(x) : 1 - smooth(x);
  } else g.uMix.value = 0;
  CUR.loop = loop;
  /* moving parts */
  FLOW.wind.update(dt); FLOW.cur.update(dt); FLOW.ice.update(dt);
  if (FX.gwd && OBJ.gwdMark.visible) moveGwdMarks(now);
  updateRain(dt);
  if (CAMTWEEN) {
    CAMTWEEN.t += dt; const x = smooth(clamp(CAMTWEEN.t / CAMTWEEN.dur, 0, 1));
    const a = CAMTWEEN.from.clone().normalize(), b = CAMTWEEN.to.clone().normalize(), r = lerp(CAMTWEEN.from.length(), CAMTWEEN.to.length(), x);
    camera.position.copy(slerpTo(a, b, x, new THREE.Vector3()).multiplyScalar(r));
    if (x >= 1) CAMTWEEN = null;
  }
  hudTick();
}
let FLOOR_K = -1;
function setSub(p) {
  if (P.sub === p) return;
  P.sub = p; renderPanel(); renderHud(true);
}
function showLevelBand(k0, k1, color, alpha = 0.16) {
  const b = OBJ.band, u = b.material.uniforms;
  b.visible = true; u.uColor.value.set(color); u.uOpacity.value = alpha; u.uR0.value = atmS((k0 + k1) / 2); u.uB.value = bkAt((k0 + k1) / 2);
  const w = writer(LINES.cutHi), a = new THREE.Vector3(), c = new THREE.Vector3(), col = rgba(color, 0.9);
  if (VIEW.cut) {
    [VIEW.cutLon, wrap360(VIEW.cutLon + VIEW.cutW)].forEach(lon => {
      for (const kb of [k0, k1]) for (let j = 0; j < 72; j++) { const l1 = latA(j), l2 = latA(j + 1); xyz(l1, lon, atmR(kb, l1, lon) + 0.001, a); xyz(l2, lon, atmR(kb, l2, lon) + 0.001, c); w.seg(a, c, col, col); }
    });
  }
  w.done(); LINES.cutHi.obj.visible = VIEW.cut;
}
function showRowCut(j) {
  if (!VIEW.cut) return;
  const w = writer(LINES.cutHi), a = new THREE.Vector3(), c = new THREE.Vector3(), col = rgba('#E7B04C', 1);
  [VIEW.cutLon, wrap360(VIEW.cutLon + VIEW.cutW)].forEach(lon => {
    const io = Math.round(wrap360(lon) / 1.25) % 288, kmt = KMT[j * 288 + io], lat = latO(j);
    const r1 = kmt > 0 ? ocnR(kmt) : 1;
    for (const la of [lat - 0.625, lat + 0.625]) { xyz(la, lon, 1.002, a); xyz(la, lon, r1, c); w.seg(a, c, col, col); }
    xyz(lat - 0.625, lon, r1, a); xyz(lat + 0.625, lon, r1, c); w.seg(a, c, col, col);
  });
  w.done(); LINES.cutHi.obj.visible = true;
}
function advance(dir) {
  const m = curMacro();
  if (dir > 0) {
    if (P.si < P.list.length - 1) { P.si++; P.t = 0; P.sub = null; applyStage({}); renderChips(); renderPanel(); renderHud(); return; }
    if (P.mi < MACRO.length - 1) { go(P.mi + 1, 0); return; }
    P.playing = false; renderTransport(); return;
  }
  if (P.si > 0) { P.si--; P.t = 0; P.sub = null; applyStage({}); renderChips(); renderPanel(); renderHud(); return; }
  if (P.mi > 0) go(P.mi - 1, -1);
  void m;
}

/* ================================================================ UI: header, layers */
function renderStatic() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  $('#layers').setAttribute('aria-label', tx(L('Layers', '图层'))); $('#gl').setAttribute('aria-label', tx(L('3D globe', '三维地球')));
  document.querySelector('.lang').setAttribute('aria-label', tx(L('Language', '语言')));
  $('#sub').textContent = tx(U.sub);
  $('#btnLayers').textContent = tx(U.layers); $('#btnHome').textContent = tx(U.home); $('#btnSpin').textContent = tx(U.spin);
  const v2 = $('#lnkV2'); v2.textContent = tx(U.v2);
  const local = location.protocol === 'file:';
  v2.href = local ? `../v2/HadCM3_walkthrough_v2_${LANG}.html` : (LANG === 'zh' ? 'https://claude.ai/artifact/MGA4sQtd2KCcZ9YcxvpK9a' : 'https://claude.ai/artifact/Lg1UbvqWPZuGRLGoEN2T49');
  document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === LANG)));
  $('#btnPrev').textContent = tx(U.prev); $('#btnPrev').title = tx(U.prevT); $('#btnNext').textContent = tx(U.next); $('#btnNext').title = tx(U.nextT);
  $('#lblSpeed').textContent = tx(U.speed); $('#lblDetail').textContent = tx(U.detail);
  renderTransport(); buildLayers();
}
function renderTransport() { $('#btnPlay').textContent = tx(P.playing ? U.pause : U.play); }
function opt(v, label, cur) { return `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`; }
function buildLayers() {
  const el = $('#layers');
  const surfSel = SURF_GROUPS.map(([g, keys]) => `<optgroup label="${esc(tx(U[g]))}">${keys.map(k => opt(k, tx(SURF[k].name), VIEW.surf)).join('')}</optgroup>`).join('');
  const lvOpts = Array.from({ length: 19 }, (_, i) => opt(i + 1, `${i + 1} · ${fmtP(levelP(i + 1))} hPa`, VIEW.winds || 12)).join('');
  const zc = ST.levels.ocn.z, dOpts = zc.map((z, i) => opt(i + 1, `${i + 1} · ${Math.round(z)} m`, VIEW.currents || 1)).join('');
  el.innerHTML = `
  <div class="lg"><label><input type="checkbox" id="chkFollow"${VIEW.follow ? ' checked' : ''}> ${esc(tx(U.follow))}</label><p class="hint">${esc(tx(U.followHint))}</p></div>
  <div class="lg"><h3>${esc(tx(U.surfH))}</h3><select id="selSurf" aria-label="${esc(tx(U.surfH))}">${surfSel}</select></div>
  <div class="lg"><h3>${esc(tx(U.atmH))}</h3>
    <label><input type="checkbox" id="chkClouds"${VIEW.clouds ? ' checked' : ''}> ${esc(tx(U.clouds))}</label>
    <label><input type="checkbox" id="chkTowers"${VIEW.towers ? ' checked' : ''}> ${esc(tx(U.towers))}</label>
    <label><input type="checkbox" id="chkRain"${VIEW.rain ? ' checked' : ''}> ${esc(tx(U.rain))}</label>
    <label><input type="checkbox" id="chkWinds"${VIEW.winds ? ' checked' : ''}> ${esc(tx(U.winds))}</label>
    <label class="col"><span>${esc(tx(U.level))}</span><select id="selWindLev">${lvOpts}</select></label></div>
  <div class="lg"><h3>${esc(tx(U.ocnH))}</h3>
    <label><input type="checkbox" id="chkCur"${VIEW.currents ? ' checked' : ''}> ${esc(tx(U.currents))}</label>
    <label class="col"><span>${esc(tx(U.depth))}</span><select id="selCurLev">${dOpts}</select></label>
    <label><input type="checkbox" id="chkIce"${VIEW.ice ? ' checked' : ''}> ${esc(tx(U.ice))}</label>
    <label><input type="checkbox" id="chkRunoff"${VIEW.runoff ? ' checked' : ''}> ${esc(tx(U.runoff))}</label></div>
  <div class="lg"><h3>${esc(tx(U.gridH))}</h3>
    <label><input type="checkbox" id="chkGridA"${VIEW.gridA ? ' checked' : ''}> <i class="sw" style="background:#EAF2FA"></i>${esc(tx(U.gridA))}</label>
    <label><input type="checkbox" id="chkGridO"${VIEW.gridO ? ' checked' : ''}> <i class="sw" style="background:#7DE3EC"></i>${esc(tx(U.gridO))}</label></div>
  <div class="lg"><h3>${esc(tx(U.cutH))}</h3>
    <label><input type="checkbox" id="chkCut"${VIEW.cut ? ' checked' : ''}> ${esc(tx(U.cut))}</label>
    <label><input type="checkbox" id="chkCutFollow"${VIEW.cutFollow ? ' checked' : ''}> ${esc(tx(U.cutFollow))}</label>
    <label class="col"><span>${esc(tx(U.cutLon))}: <b id="cutLonV">${VIEW.cutLon}</b></span><input type="range" id="rngCutLon" min="0" max="359" step="1" value="${VIEW.cutLon}"></label>
    <label class="col"><span>${esc(tx(U.cutW))}: <b id="cutWV">${VIEW.cutW}</b></span><input type="range" id="rngCutW" min="20" max="140" step="5" value="${VIEW.cutW}"></label>
    <label class="col"><span>${esc(tx(U.cutA))}</span><select id="selCutA">${Object.entries(CUTA).map(([k, v]) => opt(k, tx(v.name), VIEW.cutA)).join('')}</select></label>
    <label class="col"><span>${esc(tx(U.cutO))}</span><select id="selCutO">${Object.entries(CUTO).map(([k, v]) => opt(k, tx(v.name), VIEW.cutO)).join('')}</select></label></div>
  <div class="lg"><h3>${esc(tx(U.viewH))}</h3>
    <label><input type="checkbox" id="chkShade"${VIEW.shade ? ' checked' : ''}> ${esc(tx(U.shade))}</label>
    <label><input type="checkbox" id="chkAutoCam"${VIEW.autoCam ? ' checked' : ''}> ${esc(tx(U.autoCam))}</label>
    <label class="col"><span>${esc(tx(U.relief))}</span><select id="selRelief">${opt('smooth', tx(U.reliefSmooth), VIEW.relief)}${opt('blocky', tx(U.reliefBlocky), VIEW.relief)}${opt('off', tx(U.reliefOff), VIEW.relief)}</select></label>
    <label class="col"><span>${esc(tx(U.vscale))}</span><select id="selV">${opt('levels', tx(U.vLevels), VIEW.vmode)}${opt('phys', tx(U.vPhys), VIEW.vmode)}</select></label></div>`;
  const on = (id, ev, fn) => { const e = $('#' + id); if (e) e.addEventListener(ev, fn); };
  on('chkFollow', 'change', e => { VIEW.follow = e.target.checked; });
  on('selSurf', 'change', e => { VIEW.surf = e.target.value; refreshAll(); });
  on('chkClouds', 'change', e => { VIEW.clouds = e.target.checked; refreshAll(); });
  on('chkTowers', 'change', e => { VIEW.towers = e.target.checked; refreshAll(); });
  on('chkRain', 'change', e => { VIEW.rain = e.target.checked ? 'ls' : ''; RAIN.kind = ''; refreshAll(); });
  on('chkWinds', 'change', e => { VIEW.winds = e.target.checked ? +$('#selWindLev').value : 0; refreshAll(); });
  on('selWindLev', 'change', e => { if (VIEW.winds) { VIEW.winds = +e.target.value; refreshAll(); } });
  on('chkCur', 'change', e => { VIEW.currents = e.target.checked ? +$('#selCurLev').value : 0; refreshAll(); });
  on('selCurLev', 'change', e => { if (VIEW.currents) { VIEW.currents = +e.target.value; refreshAll(); } });
  on('chkIce', 'change', e => { VIEW.ice = e.target.checked; refreshAll(); });
  on('chkRunoff', 'change', e => { VIEW.runoff = e.target.checked; refreshAll(); });
  on('chkGridA', 'change', e => { VIEW.gridA = e.target.checked; refreshAll(); });
  on('chkGridO', 'change', e => { VIEW.gridO = e.target.checked; refreshAll(); });
  on('chkCut', 'change', e => { VIEW.cut = e.target.checked; refreshAll(); });
  on('chkCutFollow', 'change', e => { VIEW.cutFollow = e.target.checked; });
  let ct = null;
  on('rngCutLon', 'input', e => { VIEW.cutLon = +e.target.value; $('#cutLonV').textContent = VIEW.cutLon; clearTimeout(ct); ct = setTimeout(refreshAll, 60); });
  on('rngCutW', 'input', e => { VIEW.cutW = +e.target.value; $('#cutWV').textContent = VIEW.cutW; clearTimeout(ct); ct = setTimeout(refreshAll, 60); });
  on('selCutA', 'change', e => { VIEW.cutA = e.target.value; refreshAll(); });
  on('selCutO', 'change', e => { VIEW.cutO = e.target.value; refreshAll(); });
  on('chkShade', 'change', e => { VIEW.shade = e.target.checked; });
  on('chkAutoCam', 'change', e => { VIEW.autoCam = e.target.checked; });
  on('selRelief', 'change', e => { VIEW.relief = e.target.value; refreshAll(); });
  on('selV', 'change', e => { VIEW.vmode = e.target.value; refreshAll(); updateCutLabels(); });
}
function syncLayers() {
  const set = (id, v) => { const e = $('#' + id); if (e) { if (e.type === 'checkbox') e.checked = !!v; else e.value = String(v); } };
  set('selSurf', VIEW.surf); set('chkClouds', VIEW.clouds); set('chkTowers', VIEW.towers); set('chkRain', VIEW.rain); set('chkWinds', VIEW.winds);
  if (VIEW.winds) set('selWindLev', VIEW.winds); set('chkCur', VIEW.currents); if (VIEW.currents) set('selCurLev', VIEW.currents);
  set('chkIce', VIEW.ice); set('chkRunoff', VIEW.runoff); set('chkGridA', VIEW.gridA); set('chkGridO', VIEW.gridO); set('chkCut', VIEW.cut);
  set('rngCutLon', VIEW.cutLon); set('rngCutW', VIEW.cutW); set('selCutA', VIEW.cutA); set('selCutO', VIEW.cutO);
  const a = $('#cutLonV'); if (a) a.textContent = VIEW.cutLon;
}

/* ================================================================ legend */
function niceTicks(s) {
  const f = FWD[s.tr || 'lin'], out = [], n = 4;
  for (let i = 0; i <= n; i++) {
    const x = f(s.lo) + (f(s.hi) - f(s.lo)) * i / n, v = INV[s.tr || 'lin'](x);
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(Math.abs(v), 1e-9)))), r = Math.abs(v) < 1e-9 ? 0 : Math.round(v / mag * 2) / 2 * mag;
    out.push([norm(s, r), r]);
  }
  return out.filter((t, i, a) => i === 0 || Math.abs(t[0] - a[i - 1][0]) > 0.12);
}
const fmtV = v => { const a = Math.abs(v); return a === 0 ? '0' : a >= 1000 ? Math.round(v).toLocaleString('en') : a >= 10 ? v.toFixed(0) : a >= 1 ? v.toFixed(1).replace(/\.0$/, '') : a >= 0.01 ? v.toFixed(2).replace(/0$/, '') : v.toExponential(0); };
function timeLabel(s) {
  const g = s.calc ? 'inst' : s.grp;
  if (s.diurnal) { const h = wrap360(MODEL_T * 15) / 15; return fmt(U.tDiur, { h: `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}` }); }
  return tx(g === 'nov' ? U.tNov : g === 'day30' ? U.tDay : U.tInst) + (s.calc ? ' · ' + tx(U.tCalc) : '');
}
function renderLegend() {
  const s = SURF[VIEW.surf] || SURF.tstar, el = $('#legend');
  const head = `<div class="lt">${esc(tx(s.name))}${unitsOf(s) ? ` <span style="color:var(--muted);font-weight:400">(${esc(unitsOf(s))})</span>` : ''}</div><div class="ls">${esc(timeLabel(s))} · ${esc(srcOf(s))}</div>`;
  if (s.cat) {
    el.innerHTML = head + `<div class="cats">${VEG.map(([c, n]) => `<span><i class="sw" style="background:${c}"></i>${esc(tx(n))}</span>`).join('')}</div>`;
    return;
  }
  el.innerHTML = head + `<canvas width="256" height="10" aria-hidden="true"></canvas><div class="ticks">${niceTicks(s).map(([t, v]) => `<span style="left:${(t * 100).toFixed(1)}%">${fmtV(v)}</span>`).join('')}</div>`;
  const c = el.querySelector('canvas').getContext('2d'), L3 = lut(s.cmap);
  for (let i = 0; i < 256; i++) { c.fillStyle = `rgb(${L3[i * 3]},${L3[i * 3 + 1]},${L3[i * 3 + 2]})`; c.fillRect(i, 0, 1, 10); }
}

/* ================================================================ HUD */
const hh = h => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`;
const decDay = d => LANG === 'zh' ? `12 月 ${d} 日` : `${d} Dec`;
function clockText() {
  const m = curMacro();
  if (m.kind === 'atm') return [`${decDay(1)} ${hh((m.s - 1) * 0.5)} → ${hh(m.s * 0.5)}`, `${fmt(U.atmStep, { s: m.s })} · ${tx(m.rad ? U.radStep : U.nonRad)}`];
  if (m.kind === 'ocn') return [`${tx(U.oceanClock)} ${hh(m.s - 1)} → ${hh(m.s)}`, `${fmt(U.ocnStep, { s: m.s })} · ${tx(m.s === 1 ? U.mixStep : U.leap)}`];
  if (m.kind === 'init') return [`${decDay(1)} 00:00`, tx(U.startup)];
  if (m.kind === 'a2o') return ['24:00', tx(U.swapA2O)];
  if (m.kind === 'o2a') return ['24:00', tx(U.swapO2A)];
  if (m.kind === 'next') return [`${decDay(2)} 00:00`, tx(U.dayN1)];
  return ['…', tx(U.runEnd)];
}
function curProc() {
  const st = P.list[P.si];
  if (st.p === 'KLOOP') return ['conv', P.sub || 'v4'];
  if (st.p === 'ROWS' || st.p === 'ROWSF') return ['ocn', P.sub || 'n2'];
  return [st.mod, st.p];
}
function hudNote() {
  const st = P.list[P.si], m = curMacro(), pre = presetOf(st);
  if (st.p === 'r1') {
    if (m.kind !== 'atm') return '';
    const r = (m.s - 1) % 6;
    return r === 0 ? fmt(L('SETTSCTL: MOD(STEP − 1, 6) = 0 on step {s}, so this is a radiation step: full shortwave and longwave.', 'SETTSCTL：第 {s} 步 MOD(STEP − 1, 6) = 0，所以是辐射步：完整计算短波和长波。'), { s: m.s })
      : fmt(L('SETTSCTL: MOD(STEP − 1, 6) = {r} on step {s}: no full radiation; the heating stored at step {k} is reused.', 'SETTSCTL：第 {s} 步 MOD(STEP − 1, 6) = {r}：不做完整辐射，沿用第 {k} 步存下的加热率。'), { s: m.s, r, k: m.s - r });
  }
  if (st.p === 'r3') { const s = SUNNOW; return fmt(L('SOLPOS: on 1 Dec the declination is about {d}°; at {t} UTC the sun is overhead at {l}°E.', 'SOLPOS：12 月 1 日赤纬约 {d}°；UTC {t} 时太阳直射 {l}°E。'), { d: s.decl.toFixed(1), t: hh(MODEL_T % 24), l: Math.round(s.lon) }); }
  if (st.p === 'KLOOP') {
    const p = P.sub || 'v4', n = procNode('conv', p);
    return n && n.d ? tx(n.d) : '';
  }
  if (st.p === 'ROWS' || st.p === 'ROWSF') return tx(L('ROWCALC sweeps the 144 rows from south to north. For each row j: equation of state, momentum (CLINIC), then tracers (TRACER), before moving to row j + 1.', 'ROWCALC 从南到北扫过 144 行。对每一行 j：状态方程、动量（CLINIC）、示踪物（TRACER），完成后再到 j + 1 行。'));
  if (st.p === 'n1' && m.kind === 'ocn' && m.s > 1) return tx(L('OCN_FRST: a leapfrog step (only the first step of each day is the mixing step).', 'OCN_FRST：蛙跳步（只有每天第一步是混合步）。'));
  return pre.hud ? tx(pre.hud) : '';
}
function renderHud(soft) {
  const [c1, c2] = clockText(), [mod, p] = curProc(), n = procNode(mod, p), st = P.list[P.si];
  const name = n ? tx(n.t) : (st.p === 'init' ? tx(U.startup) : st.p === 'next' ? tx(U.dayN1) : tx(U.runEnd));
  const num = n ? procNum(mod, p) : '';
  const m = curMacro();
  let h = `<div class="clock">${esc(c1)}<small>${esc(c2)}</small></div>`;
  h += `<div class="now"><i class="dot" style="background:${compColor(mod || 'state')}"></i><b>${mod ? esc(tx(COMP[mod].n)) + (num ? ' · ' + num : '') : ''}</b> ${esc(name)} ${n ? `<span class="mono">${esc(n.r.split(' · ')[0])}</span>` : ''}</div>`;
  h += `<div class="loop" id="hudLoop"${CUR.loop ? '' : ' hidden'}>${esc(CUR.loop || '')}</div>`;
  const note = hudNote(); if (note) h += `<div class="note">${esc(note)}</div>`;
  if (m.kind === 'atm') { const k = m.s - 1 + (st.p === 'k2' ? 1 : 0); h += `<div class="acc">${esc(fmt(U.accum, { n: k }))}<div class="bar"><i style="width:${(k / 48 * 100).toFixed(1)}%"></i></div></div>`; }
  if (m.kind === 'ocn') h += `<div class="note">${esc(tx(U.oceanNote))}</div>`;
  $('#hud').innerHTML = h;
  void soft;
}
let HUD_LOOP = '';
function hudTick() {
  if (CUR.loop !== HUD_LOOP) { HUD_LOOP = CUR.loop; const e = $('#hudLoop'); if (e) { e.textContent = CUR.loop; e.hidden = !CUR.loop; } }
  const c = $('#clockline'); if (c) { const [c1, c2] = clockText(); const t = `${c1} · ${c2}`; if (c.textContent !== t) c.textContent = t; }
}

/* ================================================================ panel */
function visList() {
  const out = [], s = SURF[VIEW.surf];
  if (s) out.push(fmt(L('Surface: {n} — {t}, {src}', '地表：{n}——{t}，{src}'), { n: tx(s.name), t: timeLabel(s), src: srcOf(s) }));
  if (VIEW.clouds) out.push(tx(L('Layer cloud on each of the 19 levels: 9/201, November mean', '19 个模式层上的层状云：9/201，11 月平均')));
  if (VIEW.towers) out.push(tx(L('Convective cloud from base level to top level (0/14, 0/15), width ∝ amount (0/13): start dump', '对流云从云底层到云顶层（0/14、0/15），宽度 ∝ 云量（0/13）：启动 dump')));
  if (VIEW.winds) out.push(fmt(L('Wind particles on level {k} (≈ {p} hPa): u, v from the start dump (0/2, 0/3)', '风场粒子：第 {k} 层（约 {p} hPa），启动 dump 的 u、v（0/2、0/3）'), { k: VIEW.winds, p: fmtP(levelP(VIEW.winds)) }));
  if (VIEW.currents) out.push(fmt(L('Ocean-current particles at {z} m: November-mean total velocity (30/320, 30/321)', '{z} m 处的洋流粒子：11 月平均总速度（30/320、30/321）'), { z: Math.round(ST.levels.ocn.z[VIEW.currents - 1]) }));
  if (VIEW.rain) out.push(tx(VIEW.rain === 'cv' ? L('Convective rain and snow, falling from the cloud top, density ∝ November-mean rate (5/205, 5/206)', '对流雨雪从云顶落下，密度 ∝ 11 月平均降水率（5/205、5/206）') : L('Large-scale rain and snow, falling from the cloudiest level, density ∝ November-mean rate (4/203, 4/204)', '大尺度雨雪从云量最大的层落下，密度 ∝ 11 月平均降水率（4/203、4/204）')));
  if (FX.spikes) out.push(tx(L('Spikes: November-mean sensible (orange) and latent (cyan) heat flux (3/217, 3/234)', '竖线：11 月平均感热（橙）和潜热（青）通量（3/217、3/234）')));
  if (FX.stressA) out.push(tx(L('Arrows: wind stress on the atmosphere grid, 30 Nov daily mean (3/219, 3/220)', '箭头：大气网格上的风应力，11 月 30 日日平均（3/219、3/220）')));
  if (FX.stressO) out.push(tx(L('Arrows: wind stress as the ocean received it, on the ocean grid (0/150, 0/151)', '箭头：海洋收到的风应力，海洋网格（0/150、0/151）')));
  if (VIEW.runoff) out.push(tx(L('Arcs: runoff from each land box to its coastal outflow point (0/93), November-mean rate', '弧线：每个陆地格点的径流到它的入海点（0/93），11 月平均径流率')));
  if (FX.gwd) out.push(tx(L('Columns: land boxes with sub-grid orography above 380 m (0/34), where the drag is largest', '竖柱：次网格地形标准差大于 380 m 的陆地格点（0/34），拖曳在这些地方最大')));
  if (FX.rays) out.push(tx(L('Rays: sunlight onto the day side; the share reflected follows the November-mean planetary albedo', '光线：照向白天一侧的太阳光；反射比例按 11 月平均行星反照率')));
  if (FX.lw) out.push(tx(L('Dashes: outgoing longwave from the model top, density ∝ November-mean OLR (2/205)', '短线：从模式顶射出的长波，密度 ∝ 11 月平均 OLR（2/205）')));
  if (FX.sunpos || FX.rays) out.push(tx(L('Sun, terminator and subsolar point for the model time, from the date and the orbit', '太阳、晨昏线和直射点：由日期和轨道算出的模式时刻位置')));
  if (FX.energy || FX.pulse) out.push(tx(FX.pulse ? L('Pulses: the three 600 s adjustment sub-steps', '脉冲：三个 600 s 调整子步') : L('Glow: one uniform increment for the whole atmosphere', '光晕：整个大气统一的增量')));
  if (FX.gsum) out.push(tx(L('Streams: every column contributes to one global sum', '流线：每个气柱都汇入同一个全球求和')));
  if (FX.trop) out.push(tx(L('Yellow line: tropopause level, lapse-rate estimate from the dump temperatures', '黄线：对流层顶层次，由 dump 温度的递减率估计')));
  if (FX.bltop) out.push(tx(L('Green line: boundary-layer top (0/25)', '绿线：边界层顶（0/25）')));
  if (FX.mld) out.push(tx(L('Cyan line: ocean mixed-layer depth (0/137)', '青线：海洋混合层深度（0/137）')));
  if (FX.rows) out.push(tx(L('Gold ring: the row ROWCALC is working on', '金色环：ROWCALC 正在计算的那一行')));
  if (FX.iceDrift) out.push(tx(L('White lines: November-mean ice velocity (32/209, 32/210)', '白线：11 月平均海冰速度（32/209、32/210）')));
  if (VIEW.ice) out.push(tx(L('Sea ice: concentration (0/146) and thickness (0/147), start dump', '海冰：密集度（0/146）和厚度（0/147），启动 dump')));
  if (VIEW.gridA) out.push(tx(L('White grid: atmosphere boxes, 3.75° × 2.5°', '白色网格：大气格点，3.75° × 2.5°')));
  if (VIEW.gridO) out.push(tx(L('Cyan grid: ocean boxes, 1.25° × 1.25°', '青色网格：海洋格点，1.25° × 1.25°')));
  if (FX.regrid) out.push(tx(FX.regrid === 'a2o' ? L('Fade: τx on the atmosphere grid (30 Nov) becomes τx on the ocean grid', '渐变：大气网格上的 τx（11 月 30 日）变为海洋网格上的 τx') : L('Fade: SST on the ocean grid becomes its area mean on the atmosphere grid (computed here)', '渐变：海洋网格上的 SST 变为大气网格上的面积平均（本页计算）')));
  if (VIEW.cut) out.push(fmt(L('Cutaway at {a}°E and {b}°E: atmosphere {fa}; ocean {fo}; 4 soil layers under land', '剖面位于 {a}°E 和 {b}°E：大气 {fa}；海洋 {fo}；陆地下为 4 个土壤层'), { a: VIEW.cutLon, b: Math.round(wrap360(VIEW.cutLon + VIEW.cutW)), fa: tx(CUTA[VIEW.cutA].name), fo: tx(CUTO[VIEW.cutO].name) }));
  return out;
}
function rwOf(mod, p) {
  const g = graphOf(mod); if (!g) return { r: [], w: [], par: [] };
  const lab = id => g.nodes.get(id);
  const r = g.edges.filter(e => e.kind === 'data' && e.b === p).map(e => lab(e.a)).filter(Boolean);
  const w = g.edges.filter(e => e.kind === 'data' && e.a === p).map(e => lab(e.b)).filter(Boolean);
  const pn = g.nodes.get('G:' + p);
  return { r, w, par: pn ? pn.rows : [] };
}
function varItem(n, mod) {
  const c = n.k === 'in' || n.k === 'out' ? n.c : mod;
  const where = n.k === 'in' ? ` ← ${tx(COMP[c] ? COMP[c].n : c)}` : n.k === 'out' ? ` → ${tx(COMP[c] ? COMP[c].n : c)}` : '';
  return `<li><i class="dot" style="background:${compColor(c)}"></i><span>${esc(tx(n.t))}<span style="color:var(--faint)">${esc(where)}</span></span></li>`;
}
function renderPanel() {
  const st = P.list[P.si], [mod, p] = curProc(), n = procNode(mod, p), m = curMacro();
  const card = V1[LANG].STEPS[cardOf(st, p)];
  const [c1, c2] = clockText();
  let h = `<div class="chiprow"><span class="chip">${esc(c2)}</span><span class="chip">${esc(c1)}</span>${mod ? `<span class="chip mod"><i class="dot" style="background:${compColor(mod)}"></i>${esc(tx(COMP[mod].n))}</span>` : ''}</div>`;
  h += `<h2>${card ? card.title : ''}</h2>`;
  if (card) h += `<div class="call">${esc(card.call)} · ${esc(card.src)}</div>`;
  if (n) {
    const num = procNum(mod, p), tag = n.off ? `<span class="tag off">${esc(tx(U.off))}</span>` : n.cond ? `<span class="tag">${esc(tx(n.cond))}</span>` : (n.loop ? `<span class="tag">${esc(tx(n.loop))}</span>` : '');
    h += `<div class="proc"><div class="ph"><span class="pn" style="background:${compColor(n.fam || mod)}">${num}</span><span class="pt">${esc(tx(n.t))}</span>${tag}</div><div class="pr">${esc(n.r)}</div>${n.d ? `<p>${esc(tx(n.d))}</p>` : ''}</div>`;
  }
  const vis = visList();
  if (vis.length) h += `<div class="sec"><h4>${esc(tx(U.inView))}</h4><ul class="vis">${vis.map(v => `<li>${esc(v)}</li>`).join('')}</ul></div>`;
  if (n) {
    const { r, w, par } = rwOf(mod, p);
    if (r.length || w.length) h += `<div class="sec rw"><div><h4>${esc(tx(U.reads))}</h4><ul>${r.map(x => varItem(x, mod)).join('') || '<li>—</li>'}</ul></div><div><h4>${esc(tx(U.writes))}</h4><ul>${w.map(x => varItem(x, mod)).join('') || '<li>—</li>'}</ul></div></div>`;
    if (par.length) h += `<div class="sec"><h4>${esc(tx(U.params))}</h4><div class="pchips">${par.map(rw => `<span class="pchip" title="${esc(rw[2])}">${esc(rw[0])}<b>${esc(rw[3] || rw[1])}</b></span>`).join('')}</div></div>`;
  }
  if (mod && NETS[mod]) {
    h += `<div class="sec"><h4>${esc(fmt(U.procs, { m: tx(COMP[mod].n) }))}</h4><ol class="plist">${procsOf(mod).map((q, i) => `<li><button type="button" data-proc="${q.id}" class="${q.id === p ? 'cur' : ''}${q.off ? ' off' : ''}"><span class="n">${i + 1}</span><span>${esc(tx(q.t))}<span class="r">${esc(q.r)}</span></span></button></li>`).join('')}</ol></div>`;
  }
  if (card) {
    const li = a => (a || []).map(x => `<li>${x}</li>`).join('');
    h += `<details class="card"><summary>${esc(tx(U.card))}</summary><h5>${esc(tx(U.cIn))}</h5><ul>${li(card.in)}</ul><h5>${esc(tx(U.cCalc))}</h5><ul>${li(card.calc)}</ul><h5>${esc(tx(U.cOut))}</h5><ul>${li(card.out)}</ul>${card.note ? `<p>${card.note}</p>` : ''}</details>`;
  }
  h += `<div class="about"><p><b>${esc(tx(U.about))}.</b> ${esc(tx(L(
    'Fields come from the BRIDGE standard HadCM3 (MOSES 2.1) pre-industrial start dumps tcylxa/tcylxo@dao09c1, valid 1 Dec 00:00, standing in for tdaah’s own dumps (HadCM3B-M2.1aD, not on bc5). Fields marked “start dump” are the instantaneous model state; “November mean” and “30 Nov” fields are STASH means stored in the same dumps. Nothing is integrated in the browser: the animation shows which routine runs, in which order, on which points and levels, and what it reads and writes; the fields stay as stored. Call order and source lines: UM vn4.5 decks, as in the 2D walkthrough.',
    '场取自 BRIDGE 标准 HadCM3（MOSES 2.1）工业革命前启动 dump tcylxa/tcylxo@dao09c1（12 月 1 日 00:00），代替 tdaah 自己的 dump（HadCM3B-M2.1aD，bc5 上没有）。标为“启动 dump”的场是瞬时模式状态；“11 月平均”和“11 月 30 日”的场是同一 dump 中存的 STASH 平均。浏览器里不做任何积分：动画展示的是哪个子程序在运行、顺序如何、作用在哪些格点和层上、读写了什么；场本身保持 dump 中的原样。调用顺序和源码行号取自 UM vn4.5 deck，与 2D 版一致。')))}</p></div>`;
  const el = $('#panel'); el.innerHTML = h;
  el.querySelectorAll('[data-proc]').forEach(b => b.addEventListener('click', () => jumpToProc(mod, b.dataset.proc)));
  void m;
}
function cardOf(st, p) {
  if (st.p === 'ROWS') return ['n2', 'n3', 'n4'].includes(p) ? 12 : 13;
  return st.card;
}
function jumpToProc(mod, p) {
  let i = P.list.findIndex(s => s.mod === mod && s.p === p);
  if (i < 0 && KPROCS.includes(p)) i = P.list.findIndex(s => s.p === 'KLOOP');
  if (i < 0 && ROWPROCS.includes(p)) i = P.list.findIndex(s => s.p === 'ROWS' || s.p === 'ROWSF');
  if (i >= 0) { P.si = i; P.t = 0; P.sub = null; applyStage({}); renderChips(); renderPanel(); renderHud(); return; }
  /* not in this step: find the next macro step that has it */
  for (let d = 1; d < MACRO.length; d++) {
    const mi = (P.mi + d) % MACRO.length, list = stagesOf(MACRO[mi], P.detail), k = list.findIndex(s => s.mod === mod && s.p === p);
    if (k >= 0) { go(mi, k); return; }
  }
}

/* ================================================================ timeline and chips */
function renderTimeline() {
  const el = $('#day');
  const tk = (mi, cls, label, title) => `<button type="button" class="tk ${cls}${mi === P.mi ? ' cur' : ''}${mi < P.mi ? ' done' : ''}" data-mi="${mi}" title="${esc(title)}">${label || ''}</button>`;
  let h = `<div class="seg"><span class="sl">&nbsp;</span><div class="ticks">${tk(0, 'misc', tx(U.start), tx(U.startup))}</div></div>`;
  h += `<div class="seg"><span class="sl">${esc(tx(U.atmGroup))}</span><div class="ticks">`;
  for (let s = 1; s <= 48; s++) { const mi = s; h += tk(mi, s === 48 ? 'atm d48' : (s - 1) % 6 === 0 ? 'atm rad' : 'atm', '', `${fmt(U.atmStep, { s })} · ${hh((s - 1) / 2)}–${hh(s / 2)}${(s - 1) % 6 === 0 ? ' · ' + tx(U.radStep) : ''}`); }
  h += `</div></div><div class="seg"><span class="sl">&nbsp;</span><div class="ticks">${tk(49, 'sw', tx(U.a2o), tx(U.swapA2O))}</div></div>`;
  h += `<div class="seg"><span class="sl">${esc(tx(U.ocnGroup))}</span><div class="ticks">`;
  for (let s = 1; s <= 24; s++) { const mi = 49 + s; h += tk(mi, s === 1 ? 'ocn mix' : 'ocn', '', `${fmt(U.ocnStep, { s })} · ${hh(s - 1)}–${hh(s)}`); }
  h += `</div></div><div class="seg"><span class="sl">&nbsp;</span><div class="ticks">${tk(74, 'sw', tx(U.o2a), tx(U.swapO2A))}${tk(75, 'misc', tx(U.nextDay), tx(U.dayN1))}${tk(76, 'misc', tx(U.end), tx(U.runEnd))}</div></div>`;
  el.innerHTML = h;
  el.querySelectorAll('[data-mi]').forEach(b => b.addEventListener('click', () => go(+b.dataset.mi, 0)));
}
function chipLabel(s) {
  if (s.p === 'KLOOP') return '↻ k · 4–7';
  if (s.p === 'ROWS' || s.p === 'ROWSF') return '↻ j · ROWCALC';
  if (s.p === 'init') return tx(U.startup); if (s.p === 'next') return tx(U.dayN1); if (s.p === 'end') return tx(U.runEnd);
  const n = procNode(s.mod, s.p); return n ? `${procNum(s.mod, s.p)} ${tx(n.t)}` : s.p;
}
function renderChips() {
  const el = $('#chips');
  el.innerHTML = P.list.map((s, i) => `<button type="button" class="sc${i === P.si ? ' cur' : i < P.si ? ' past' : ''}" data-si="${i}"><i class="dot" style="background:${compColor(s.mod || 'state')}"></i>${esc(chipLabel(s))}</button>`).join('');
  el.querySelectorAll('[data-si]').forEach(b => b.addEventListener('click', () => { P.si = +b.dataset.si; P.t = 0; P.sub = null; applyStage({}); renderChips(); renderPanel(); renderHud(); }));
  const cur = el.querySelector('.cur');
  if (cur) { const l = cur.offsetLeft - el.offsetLeft, w = el.clientWidth; if (l < el.scrollLeft + 20 || l > el.scrollLeft + w - 120) el.scrollLeft = Math.max(0, l - w / 3); }
  const day = $('#day'), t = day.querySelector('.cur');
  if (t) { const l = t.offsetLeft - day.offsetLeft, w = day.clientWidth; if (l < day.scrollLeft || l > day.scrollLeft + w - 40) day.scrollLeft = Math.max(0, l - w / 2); }
}

/* ================================================================ hover tooltip */
const RAY = new THREE.Raycaster(), MOUSE = new THREE.Vector2();
let TIP_EV = null;
function onHover(e) { TIP_EV = e; }
function tipTick() {
  const e = TIP_EV, tip = $('#tip'); if (!e) return; TIP_EV = null;
  if (e.type === 'pointerleave' || e.buttons) { tip.hidden = true; return; }
  const r = $('#gl').getBoundingClientRect();
  MOUSE.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  RAY.setFromCamera(MOUSE, camera);
  const o = RAY.ray.origin, d = RAY.ray.direction, b = o.dot(d), c = o.lengthSq() - 1, disc = b * b - c;
  if (disc < 0) { tip.hidden = true; return; }
  const p = o.clone().addScaledVector(d, -b - Math.sqrt(disc)), [lat, lon] = lonlatOf(p);
  if (inCut(lon)) { tip.hidden = true; return; }
  const s = SURF[VIEW.surf], jO = clamp(Math.round((lat + 89.375) / 1.25), 0, 143), iO = Math.round(lon / 1.25) % 288, a = idxA(lat, lon), land = KMT[jO * 288 + iO] === 0;
  let val = '';
  if (s.cat) { const q = vegAt(lat, lon); val = q >= 0 ? tx(VEG[q][1]) : '—'; }
  else { const v = surfValue(s, jO, iO); const masked = (s.mask === 'ocean' && land) || (s.mask === 'land' && !land) || (s.mask === 'oceanA' && LSM[a] > 0.5); val = masked || !(v === v) ? '—' : `${fmtV(v)} ${unitsOf(s)}`; }
  let h = `<div><b>${fmtLat(lat)} ${lon.toFixed(1)}°E</b> · ${esc(tx(land ? U.tipLand : U.tipSea))}</div><div class="k">${esc(tx(U.tipA))} i=${a % 96 + 1}, j=${Math.floor(a / 96) + 1} · ${esc(tx(U.tipO))} i=${iO + 1}, j=${jO + 1}</div><div>${esc(tx(s.name))}: <b>${esc(val)}</b></div>`;
  if (VIEW.winds) { const k = VIEW.winds - 1, g = ST.grids.AU, u = bilin(F.u.lev(k), g, lat, lon), v = bilin(F.v.lev(k), g, lat, lon); h += `<div>${esc(tx(U.winds))} k=${VIEW.winds}: <b>${Math.hypot(u, v).toFixed(1)} m/s</b></div>`; }
  if (VIEW.currents && !land) { const k = VIEW.currents - 1, g = ST.grids.OU, u = bilin(F.U.lev(k), g, lat, lon), v = bilin(F.V.lev(k), g, lat, lon); if (u === u) h += `<div>${esc(tx(U.currents))}: <b>${Math.hypot(u, v).toFixed(1)} cm/s</b></div>`; }
  tip.innerHTML = h; tip.hidden = false;
  const sr = $('#stage').getBoundingClientRect(); let x = e.clientX - sr.left + 14, y = e.clientY - sr.top + 14;
  if (x + 270 > sr.width) x -= 290; if (y + 110 > sr.height) y -= 120;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
}

/* ================================================================ main */
function bindControls() {
  $('#btnPlay').addEventListener('click', () => { P.playing = !P.playing; renderTransport(); });
  $('#btnPrev').addEventListener('click', () => advance(-1));
  $('#btnNext').addEventListener('click', () => advance(1));
  $('#selSpeed').addEventListener('change', e => { P.speed = +e.target.value; });
  $('#chkDetail').addEventListener('change', e => { P.detail = e.target.checked; go(P.mi, 0); });
  $('#btnHome').addEventListener('click', () => { CAMTWEEN = null; const p = xyz(20, wrap360(VIEW.cutLon + VIEW.cutW / 2), 6.2); if (!VIEW.autoCam || REDUCED) camera.position.copy(p); else CAMTWEEN = { from: camera.position.clone(), to: p, t: 0, dur: 1.2 }; });
  $('#btnSpin').addEventListener('click', e => { VIEW.spin = !VIEW.spin; controls.autoRotate = VIEW.spin; e.currentTarget.setAttribute('aria-pressed', String(VIEW.spin)); });
  $('#btnLayers').addEventListener('click', e => { const app = $('#app'), hide = !app.classList.contains('nolayers'); app.classList.toggle('nolayers', hide); e.currentTarget.setAttribute('aria-expanded', String(!hide)); setTimeout(resize, 30); });
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => {
    LANG = b.dataset.lang; try { localStorage.setItem('had3d-lang', LANG); } catch (e) { /* storage blocked */ }
    renderStatic(); renderTimeline(); renderChips(); renderPanel(); renderHud(); renderLegend(); updateCutLabels();
  }));
  const gl = $('#gl');
  gl.addEventListener('pointermove', onHover); gl.addEventListener('pointerleave', onHover); gl.addEventListener('pointerdown', () => { $('#tip').hidden = true; });
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, select, textarea')) return;
    if (e.key === ' ') { e.preventDefault(); P.playing = !P.playing; renderTransport(); }
    else if (e.key === 'ArrowRight') advance(1); else if (e.key === 'ArrowLeft') advance(-1);
  });
  if (window.innerWidth <= 1180) { $('#app').classList.add('nolayers'); $('#btnLayers').setAttribute('aria-expanded', 'false'); }
}
async function main() {
  const msg = $('#loadMsg'); msg.textContent = tx(U.loading);
  if (!ST) { $('#loading').classList.add('err'); msg.textContent = tx(U.nodata); return; }
  try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) throw new Error('nogl'); }
  catch (e) { $('#loading').classList.add('err'); msg.textContent = tx(U.nogl); return; }
  await loadData();
  initAxes();
  setWetLevel(1);
  initScene();
  bindControls();
  renderStatic();
  go(0, 0);
  $('#loading').hidden = true;
  let last = performance.now();
  const loop = t => {
    const dt = Math.min((t - last) / 1000, 0.1); last = t;
    animate(dt, t / 1000);
    controls.update();
    updateLabels(); tipTick();
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  window.HAD3D = { P, VIEW, go, F, FX, camera, scene, renderer, MACRO, advance, LINES, OBJ,
    settle() { if (CAMTWEEN) { camera.position.copy(CAMTWEEN.to); CAMTWEEN = null; } REGRID.t = 99; } };
}
main().catch(e => { console.error(e); const l = $('#loading'); l.hidden = false; l.classList.add('err'); $('#loadMsg').textContent = String(e && e.message || e); });
