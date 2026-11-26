/* Every label of the demo in English and Chinese. L(en, zh) makes one; tx() picks the current language.
   Labels that come from the data files (stops, pathways) use label / label_zh from the file, then the
   names below, then the id, so new stops in the data still get a label. */
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private window */ } },
};
const fromUrl = new URLSearchParams(location.search).get('lang');
export let LANG = fromUrl === 'zh' || fromUrl === 'en' ? fromUrl
  : store.get('bristol-demo-lang') || ((navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en');
const listeners = [];
export function onLang(f) { listeners.push(f); }
export function setLang(l) { if (l === LANG) return; LANG = l; store.set('bristol-demo-lang', l); document.documentElement.lang = l === 'zh' ? 'zh-Hans' : 'en'; listeners.forEach(f => f()); }
export const L = (en, zh) => ({ en, zh });
export const tx = o => (o == null ? '' : typeof o === 'string' ? o : (o[LANG] ?? o.en ?? ''));
export const fmt = (o, vars = {}) => tx(o).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

export const U = {
  title: L("Standing in Bristol's Future", '站在布里斯托尔的未来'),
  tagline: L('Our choices today decide what the future looks like.', '我们今天的选择，决定未来的样子。'),
  demoData: L('DEMO DATA', '演示数据'),
  demoDataLong: L('Made-up numbers for testing. Not real science yet.', '测试用的编造数字，还不是真实的科学结果。'),
  notPrediction: L('Scenario, not a prediction', '这是情景，不是预测'),
  average: L('Average conditions for this time, not a single day', '这是那个时期的平均状况，不是某一天的天气'),
  source: L('Data: {s}', '数据：{s}'),
  layers: L('Map', '地图'),
  choosePath: L('Choose a pathway', '选一条排放路径'),
  chooseTime: L('Choose a time', '选一个时间'),
  earlier: L('Earlier', '更早'), later: L('Later', '更晚'),
  visit: L('Visit Bristol', '去布里斯托尔'),
  pinHintXR: L('or point at the pin on the globe and pull the trigger', '或者用手柄指向地球上的图钉，扣动扳机'),
  pinHint: L('or click the pin on the globe', '或者点击地球上的图钉'),
  back: L('Back to globe', '回到地球'),
  seated: L('Seated mode', '坐姿模式'),
  enterVR: L('Enter VR', '进入 VR'), exitVR: L('Exit VR', '退出 VR'),
  noData: L('no data', '无数据'),
  pastAll: L('The past is the same for every pathway', '过去已经发生，每条路径都一样'),
  nowAll: L('Today is the same for every pathway', '今天对每条路径都一样'),
  allPaths: L('every pathway', '所有路径'),
  bristol: L('Bristol', '布里斯托尔'),
  lang: L('中文', 'EN'),
  loading: L('Loading the demo', '正在载入'),
  fail: L('The demo could not start: {e}. Serve this folder over HTTP (see README) and use a browser with WebGL.', '演示无法启动：{e}。请用 HTTP 服务打开这个文件夹（见 README），并使用支持 WebGL 的浏览器。'),
  warnings: L('{n} data warning(s)', '{n} 条数据提示'),
  dragGlobe: L('Drag to turn the globe', '拖动可以转动地球'),
  dragLook: L('Drag to look around', '拖动可以环顾四周'),
  summary: L('Compare', '对比'),
  flood: L('Water drawn as one flat level: approximate', '水面按单一平面水位绘制：仅为近似'),
  shelf: L('Dry sea floor estimated from the model sea depth', '露出的海底按模型海深估算'),

  /* layers */
  l_temp_c: L('Temperature', '气温'), l_rain_mm_yr: L('Rainfall', '降水'), l_snow_depth_cm: L('Snow', '积雪'),
  l_vegetation: L('Plants', '植被'), l_sea_level_m: L('Sea level', '海平面'),
  u_temp_c: L('°C, year average', '°C，年平均'), u_rain_mm_yr: L('mm per year', '毫米 / 年'), u_snow_depth_cm: L('cm of snow on the ground', '地面积雪厘米数'),
  u_sea_level_m: L('m compared with today', '米，与今天相比'), u_vegetation: L('main plant type', '主要植被类型'),

  /* weather board */
  board: L('Bristol weather board', '布里斯托尔气象牌'),
  b_sea: L('Sea level vs today', '海平面（与今天比）'), b_temp: L('Temperature (year avg.)', '气温（年平均）'),
  b_wind: L('Wind', '风速'), b_rain: L('Rain per year', '年降水量'), b_snow: L('Snow on the ground', '地面积雪'), b_veg: L('Plants', '植被'),
  still: L('still', '无风'), breezy: L('breezy', '有风'), stormy: L('stormy', '大风'),
  dry: L('dry', '干燥'), light: L('light', '小雨'), steady: L('steady', '中雨'), heavy: L('heavy', '大雨'),
  snowing: L('snow', '降雪'),

  /* tide pole */
  t_today: L('Today', '今天'), t_here: L('This scenario', '这个情景'), t_range: L('likely range', '可能范围'),
  t_below: L('{v} m: far below', '{v} 米：远在下方'),
  mshed: L('M Shed', 'M Shed 博物馆'),

  /* closing card */
  c_title: L('Lower emissions, smaller changes', '排放越低，变化越小'),
  c_intro: L('Bristol in {stop}, on two pathways:', '{stop}的布里斯托尔，两条路径对比：'),
  c_sea: L('Sea level', '海平面'), c_temp: L('Temperature', '气温'),
  c_hope: L('The low-emissions picture is still within reach. Clean energy, homes that need less heating, walking, cycling and buses, and looking after nature all cut emissions. The sooner we start, the closer Bristol stays to the Bristol we know.',
    '低排放的未来仍然可以实现。清洁能源、更省能的房屋、步行骑车和坐公交、保护自然，都能减少排放。越早行动，布里斯托尔就越接近我们熟悉的样子。'),
  c_close: L('Keep exploring', '继续探索'),

  /* VR */
  vrHintGlobe: L('Point and pull the trigger to press. Right stick or trigger-drag turns the globe.', '指向并扣扳机即可按下。右摇杆或按住扳机拖动可以转动地球。'),
  vrHintCity: L('Point and pull the trigger to press. Look around: you are on a floating pontoon.', '指向并扣扳机即可按下。四处看看：你站在一个浮动码头上。'),
  vrNone: L('VR needs the Meta Quest Browser over HTTPS', 'VR 需要在 Meta Quest 浏览器中通过 HTTPS 打开'),

  about: L('About', '说明'),
  aboutBody: L(
    '<p><b>What this is.</b> Pick a time and an emissions pathway, then visit Bristol\'s harbourside to see what the average conditions could look like.</p><p><b>The numbers are not real yet.</b> While the data files say <i>placeholder</i>, every number is made up for testing and the page shows a DEMO DATA badge.</p><p><b>Flooding</b> is drawn as one flat water level over a cartoon harbour, so it is approximate. The globe\'s coastline comes from the HadCM3 climate model.</p>',
    '<p><b>这是什么。</b>选一个时间和一条排放路径，然后去布里斯托尔的港口，看看那时的平均状况可能是什么样子。</p><p><b>这些数字还不是真实的。</b>只要数据文件标着 <i>placeholder</i>，所有数字都是为测试编造的，页面会显示“演示数据”标志。</p><p><b>洪水</b>按卡通港口上的单一平面水位绘制，只是近似。地球的海岸线来自 HadCM3 气候模型。</p>'),
};

const NAMES = {
  stops: {
    past_cold: L('Ice age', '冰期'), past_warm: L('Warm period', '温暖期'), now: L('Today', '今天'),
    y2050: L('2050', '2050 年'), y2100: L('2100', '2100 年'), y3000: L('Year 3000', '3000 年'), y5000: L('Year 5000', '5000 年'),
    y10000: L('10,000 years', '1 万年后'), y100000: L('100,000 years', '10 万年后'), y1000000: L('1 million years', '100 万年后'),
  },
  pathways: {
    ssp126: L('Low emissions', '低排放'), ssp245: L('Middle road', '中间道路'),
    ssp370: L('High emissions', '高排放'), ssp585: L('Very high emissions', '极高排放'),
  },
  veg: {
    tundra: L('Tundra', '苔原'), steppe: L('Grassy steppe', '草原'), temperate_forest: L('Leafy forest', '温带森林'),
    mediterranean: L('Mediterranean', '地中海植被'), subtropical: L('Subtropical', '亚热带植被'), desert_scrub: L('Desert scrub', '荒漠灌丛'),
  },
};
const named = (kind, item) => {
  if (!item) return '';
  if (LANG === 'zh') return item.label_zh || NAMES[kind][item.id]?.zh || item.label || item.id;
  return item.label || NAMES[kind][item.id]?.en || item.id;
};
export const stopLabel = s => named('stops', s);
export const pathLabel = p => named('pathways', p);
export const vegLabel = id => (id == null ? tx(U.noData) : tx(NAMES.veg[id]) || String(id).replace(/_/g, ' '));
export function sourceLabel(s) { return s === 'DEMO DATA' ? tx(U.demoData) : s; }
/* the year under a stop's label: "21,000 years ago", "2100", "in 10,000 years" */
export function yearNote(stop, nowYear = 2025) {
  if (!stop || typeof stop.year !== 'number' || /\d/.test(stopLabel(stop))) return '';     // the label already says when
  const y = stop.year, n = v => Math.round(v).toLocaleString(LANG === 'zh' ? 'zh-CN' : 'en-GB');
  if (y < 0) return LANG === 'zh' ? `${n(-y)} 年前` : `${n(-y)} years ago`;
  if (y - nowYear >= 5000) return LANG === 'zh' ? `${n(y - nowYear)} 年后` : `in ${n(y - nowYear)} years`;
  return LANG === 'zh' ? `${y} 年` : String(y);
}
document.documentElement.lang = LANG === 'zh' ? 'zh-Hans' : 'en';
