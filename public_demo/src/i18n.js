/* Every label of the demo in English and Chinese. L(en, zh) makes one; tx() picks the current language.
   Pathway labels come from the data file (label / label_zh), with the names below as a fallback. */
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
  earlier: L('Earlier', '更早'), later: L('Later', '更晚'), play: L('Play', '播放'), pause: L('Pause', '暂停'),
  today: L('Today', '今天'), inYears: L('In {n} years', '{n} 年后'), inMillion: L('In 1 million years', '100 万年后'),
  visit: L('Visit Bristol', '去布里斯托尔'),
  pinHintXR: L('or point at the pin and pull the trigger', '或者用手柄指向图钉，扣动扳机'),
  pinHint: L('or click the pin on the globe', '或者点击地球上的图钉'),
  back: L('Back to globe', '回到地球'),
  seated: L('Seated mode', '坐姿模式'),
  enterVR: L('Enter VR', '进入 VR'), exitVR: L('Exit VR', '退出 VR'),
  noData: L('no data', '无数据'),
  bristol: L('Bristol', '布里斯托尔'),
  lang: L('中文', 'EN'),
  loading: L('Loading the demo', '正在载入'),
  fail: L('The demo could not start: {e}. Serve this folder over HTTP (see README) and use a browser with WebGL.', '演示无法启动：{e}。请用 HTTP 服务打开这个文件夹（见 README），并使用支持 WebGL 的浏览器。'),
  warnings: L('{n} data note(s)', '{n} 条数据说明'),
  dragGlobe: L('Drag to turn the globe · scroll to zoom', '拖动转动地球 · 滚轮放大缩小'),
  dragLook: L('Drag to look around', '拖动可以环顾四周'),
  summary: L('Compare', '对比'),
  resetGlobe: L('Reset globe', '地球复位'),
  flood: L('Water drawn as one flat level: approximate', '水面按单一平面水位绘制：仅为近似'),
  allPaths: L('every pathway', '所有路径'),
  seaNow: L('Sea level: {v} vs today', '海平面：比今天 {v}'),
  seaDemo: L('Try it: move the sea', '试一试：移动海平面'),
  seaDemoOn: L('Demo sea level (not a scenario)', '演示海平面（不是情景）'),
  seaDemoOff: L('Back to the scenario', '回到情景'),

  /* globe layers */
  l_surface: L('Earth', '地球'), l_temp: L('Temperature', '气温'), l_rain: L('Rain', '降水'), l_plants: L('Plants', '植被'), l_sea: L('Sea level', '海平面'),
  g_surface: L('Earth today', '今天的地球'), gu_surface: L('Land cover from the HadCM3 model; heights from SRTM15+', '地表类型来自 HadCM3 模型；地形高度来自 SRTM15+'),
  g_temp: L('Warmer or colder than today', '比今天更暖还是更冷'), gu_temp: L('°C change in yearly average air temperature (HadCM3 emulator)', '年平均气温变化（°C，HadCM3 模拟器）'),
  g_rain: L("Today's rain and snow", '今天的雨和雪'), gu_rain: L('HadCM3, November average. Future rain maps are not available, so this does not change.', 'HadCM3，11 月平均。没有未来的降水地图，所以不会随时间变化。'),
  g_plants: L("Today's plants", '今天的植被'), gu_plants: L('HadCM3 surface types. Future plant maps are not available; plants on flooded land disappear.', 'HadCM3 地表类型。没有未来的植被地图；被淹的陆地上植被会消失。'),
  g_sea: L('Sea level and coastline', '海平面与海岸线'), gu_sea: L('Global sea level from the scenario; the coast moves on real heights (SRTM15+)', '海平面来自情景；海岸线按真实地形（SRTM15+）移动'),
  g_rainDrop: L('Rain', '雨'), g_snowFlake: L('Snow', '雪'),
  g_flooded: L('Land under the sea', '被海水淹没的陆地'), g_dry: L('Sea floor that is now dry', '露出水面的海底'), g_todayCoast: L("Today's coastline", '今天的海岸线'),
  fixedNote: L('Does not change with time or pathway', '不随时间和路径变化'),

  /* weather board */
  board: L('Bristol weather board', '布里斯托尔气象牌'),
  b_sea: L('Sea level vs today', '海平面（与今天比）'), b_temp: L('Temperature (year avg.)', '气温（年平均）'),
  b_wind: L('Wind', '风速'), b_rain: L('Rain per year', '年降水量'), b_snow: L('Snow on the ground', '地面积雪'), b_veg: L('Plants', '植被'), b_co2: L('CO₂ in the air', '空气中的 CO₂'),
  still: L('still', '无风'), breezy: L('breezy', '有风'), stormy: L('stormy', '大风'),
  dry: L('dry', '干燥'), light: L('light', '小雨'), steady: L('steady', '中雨'), heavy: L('heavy', '大雨'),
  snowing: L('snow', '降雪'),
  baseNote: L('Today = Met Office Filton average 1991–2020, plus the emulator change', '今天 = 英国气象局 Filton 站 1991–2020 平均，加上模拟器的变化'),

  /* tide pole */
  t_today: L('Today', '今天'), t_here: L('This scenario', '这个情景'), t_range: L('likely range', '可能范围'),
  t_below: L('{v} m: far below', '{v} 米：远在下方'),
  mshed: L('M Shed', 'M Shed 博物馆'),

  /* closing card */
  c_title: L('Lower emissions, smaller changes', '排放越低，变化越小'),
  c_intro: L('Bristol {when}, on two pathways:', '{when}的布里斯托尔，两条路径对比：'),
  c_sea: L('Sea level', '海平面'), c_temp: L('Temperature', '气温'),
  c_hope: L('The low-emissions picture is still within reach. Clean energy, homes that need less heating, walking, cycling and buses, and looking after nature all cut emissions. The sooner we start, the closer Bristol stays to the Bristol we know.',
    '低排放的未来仍然可以实现。清洁能源、更省能的房屋、步行骑车和坐公交、保护自然，都能减少排放。越早行动，布里斯托尔就越接近我们熟悉的样子。'),
  c_close: L('Keep exploring', '继续探索'),

  /* VR */
  vrHintGlobe: L('Trigger: press, or drag the globe. Grip: move it; both grips: resize. Right stick: turn and resize.', '扳机：按按钮或拖动地球。握把：移动地球；双手握把：缩放。右摇杆：旋转和缩放。'),

  about: L('About', '说明'),
  aboutBody: L(
    '<p><b>What this is.</b> Pick a time and an emissions pathway, then visit Bristol\'s harbourside to see the average conditions there.</p><p><b>The data.</b> The future comes from the NWS climate-emulation workflow (HadCM3 emulator), ensemble member 67, every 1,000 years up to a million years. Global sea level is the scenario\'s sea-level input. Bristol\'s weather is the emulator box nearest Bristol, added as a change to today\'s Met Office average at Filton. The temperature map comes from the same emulator. Rain and plants on the globe are today\'s, from HadCM3, because future maps of them were not saved.</p><p><b>Flooding</b> in Bristol is one flat water level over a cartoon harbour, so it is approximate. On the globe, the coastline follows real heights (SRTM15+).</p>',
    '<p><b>这是什么。</b>选一个时间和一条排放路径，再去布里斯托尔的港口看看那时的平均状况。</p><p><b>数据。</b>未来数据来自 NWS 气候模拟工作流（HadCM3 模拟器）第 67 号集合成员，每 1000 年一个值，直到 100 万年。全球海平面是情景的海平面输入。布里斯托尔的天气取离布里斯托尔最近的模拟器格点，作为变化量加在英国气象局 Filton 站今天的平均值上。气温地图来自同一个模拟器。地球上的降水和植被是 HadCM3 的今天状态，因为未来的这两种地图没有保存。</p><p><b>洪水</b>在布里斯托尔场景里是卡通港口上的单一平面水位，只是近似。地球上的海岸线按真实地形（SRTM15+）变化。</p>'),
};

const NAMES = {
  pathways: {
    natural: L('No human emissions', '没有人类排放'), ssp119: L('Very low emissions', '极低排放'), ssp126: L('Low emissions', '低排放'),
    ssp245: L('Middle road', '中间道路'), ssp370: L('High emissions', '高排放'), ssp585: L('Very high emissions', '极高排放'), pgc10000: L('Burn it all', '烧光化石燃料'),
  },
  veg: {
    tundra: L('Tundra', '苔原'), boreal_forest: L('Conifer forest', '针叶林'), steppe: L('Grassy steppe', '草原'), temperate_forest: L('Leafy forest', '温带森林'),
    mediterranean: L('Mediterranean', '地中海植被'), subtropical: L('Subtropical', '亚热带植被'), desert_scrub: L('Desert scrub', '荒漠灌丛'),
  },
};
export const pathLabel = p => (!p ? '' : LANG === 'zh' ? (p.label_zh || NAMES.pathways[p.id]?.zh || p.label || p.id) : (p.label || NAMES.pathways[p.id]?.en || p.id));
export const pathSub = p => (!p ? '' : LANG === 'zh' && p.ssp_zh ? p.ssp_zh : p.ssp);
export const vegLabel = id => (id == null ? tx(U.noData) : tx(NAMES.veg[id]) || String(id).replace(/_/g, ' '));
export function sourceLabel(d) {
  if (!d) return '';
  if (d.placeholder) return tx(U.demoData);
  return LANG === 'zh' && d.sourceLabelZh ? d.sourceLabelZh : d.sourceLabel;
}
const num = v => Math.round(v).toLocaleString(LANG === 'zh' ? 'zh-CN' : 'en-GB');
/* t in kyr after present -> "Today", "In 12,000 years" */
export function timeLabel(t) {
  if (!t) return tx(U.today);
  if (t >= 1000) return tx(U.inMillion);
  return fmt(U.inYears, { n: num(t * 1000) });
}
export function markLabel(m) { return LANG === 'zh' ? (m.label_zh || m.label) : m.label; }
document.documentElement.lang = LANG === 'zh' ? 'zh-Hans' : 'en';
