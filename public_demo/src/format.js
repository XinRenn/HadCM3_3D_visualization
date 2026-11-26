/* Numbers with units, in the current language. A null value is "no data". */
import { LANG, U, tx, vegLabel } from './i18n.js';
import { BANDS } from './data.js';

const num = (v, d) => {
  const s = Math.abs(v).toLocaleString(LANG === 'zh' ? 'zh-CN' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  return (v < 0 ? '−' : '') + s;
};
const UNITS = {
  sea_level_m: { en: 'm', zh: '米' }, temp_c: { en: '°C', zh: '°C' }, wind_ms: { en: 'm/s', zh: '米/秒' },
  rain_mm_yr: { en: 'mm', zh: '毫米' }, snow_depth_cm: { en: 'cm', zh: '厘米' },
};
export function fmtValue(name, v, { band = false } = {}) {
  if (v == null) return tx(U.noData);
  if (name === 'vegetation') return vegLabel(v);
  const u = UNITS[name] ? UNITS[name][LANG] || UNITS[name].en : '';
  const sp = u.startsWith('°') ? ' ' : ' ';
  let s;
  if (name === 'sea_level_m') s = (v > 0 ? '+' : '') + num(v, Math.abs(v) < 10 ? 1 : 0) + sp + u;
  else if (name === 'temp_c') s = num(v, 1) + sp + u;
  else if (name === 'wind_ms') s = num(v, 1) + sp + u;
  else s = num(v, 0) + sp + u;
  if (band) {
    const b = name === 'wind_ms' ? BANDS.wind(v) : name === 'rain_mm_yr' ? BANDS.rain(v) : null;
    if (b) s += ` (${tx(U[b])})`;
  }
  return s;
}
/* which stop the closing card compares: the current one if it differs by pathway, else 2100, else the latest that does */
export function closingStop(data, stopId) {
  const ok = id => data.stop(id) && !data.sharedStop(id) && data.bristol[id];
  if (ok(stopId)) return data.stop(stopId);
  if (ok('y2100')) return data.stop('y2100');
  const s = data.stops.filter(x => ok(x.id));
  return s.length ? s[s.length - 1] : null;
}
