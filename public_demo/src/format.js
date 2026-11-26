/* Numbers with units, in the current language. A null value is "no data". */
import { LANG, U, tx, vegLabel } from './i18n.js';
import { BANDS } from './data.js';

const num = (v, d) => {
  const s = Math.abs(v).toLocaleString(LANG === 'zh' ? 'zh-CN' : 'en-GB', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  return (v < 0 ? '−' : '') + s;
};
const UNITS = {
  sea_level_m: { en: 'm', zh: '米' }, temp_c: { en: '°C', zh: '°C' }, wind_ms: { en: 'm/s', zh: '米/秒' },
  rain_mm_yr: { en: 'mm', zh: '毫米' }, snow_depth_cm: { en: 'cm', zh: '厘米' }, co2_ppm: { en: 'ppm', zh: 'ppm' },
};
export function fmtValue(name, v, { band = false } = {}) {
  if (v == null) return tx(U.noData);
  if (name === 'vegetation') return vegLabel(v);
  const u = UNITS[name] ? UNITS[name][LANG] || UNITS[name].en : '';
  let s;
  if (name === 'sea_level_m') s = (v > 0.05 ? '+' : '') + num(v, Math.abs(v) < 10 ? 1 : 0) + ' ' + u;
  else if (name === 'temp_c' || name === 'wind_ms') s = num(v, 1) + ' ' + u;
  else if (name === 'snow_depth_cm') s = num(v, v < 1 ? 1 : 0) + ' ' + u;
  else s = num(v, 0) + ' ' + u;
  if (band) {
    const b = name === 'wind_ms' ? BANDS.wind(v) : name === 'rain_mm_yr' ? BANDS.rain(v) : null;
    if (b) s += ` (${tx(U[b])})`;
  }
  return s;
}
/* the time the closing card compares: the chosen time, or 1,000 years if today is chosen (all pathways agree today) */
export function closingTime(t) { return t >= 1 ? t : 1; }
