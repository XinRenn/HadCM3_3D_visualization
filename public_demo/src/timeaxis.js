/* The time slider: 0 to 1000 kyr after present on a stretched scale, so the first thousands of years get as
   much room as the last hundreds of thousands. p (0..1, slider position) <-> t (kyr). */
const BASE = 1001;
export const p2t = (p, end = 1000) => Math.round(Math.pow(BASE, Math.min(1, Math.max(0, p))) - 1) * end / 1000;
export const t2p = (t, end = 1000) => Math.log(t * 1000 / end + 1) / Math.log(BASE);
/* one press of Earlier / Later: small steps near today, bigger ones far ahead */
export function stepT(t, dir, end = 1000) {
  const s = t < 20 || (dir < 0 && t <= 20) ? 1 : t < 100 || (dir < 0 && t <= 100) ? 5 : t < 300 || (dir < 0 && t <= 300) ? 10 : 50;
  return Math.min(end, Math.max(0, dir > 0 ? Math.floor(t / s) * s + s : Math.ceil(t / s) * s - s));
}
