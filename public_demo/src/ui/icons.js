/* Cartoon icons drawn on a 2D canvas, so the same picture serves the HTML buttons (as an image) and the
   VR panels (drawn straight into the panel canvas). drawIcon(g, kind, cx, cy, size). */
const INK = '#1B2A4A';

function blob(g, pts, fill, lw) {
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
}
function circ(g, x, y, r, fill, lw) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fillStyle = fill; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); } }
function rrect(g, x, y, w, h, r, fill, lw) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); } if (lw) { g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); }
}

const DRAW = {
  leaf(g, s, lw) {   // low emissions: a leaf
    g.beginPath(); g.moveTo(-0.38 * s, 0.36 * s); g.bezierCurveTo(-0.5 * s, -0.3 * s, 0.1 * s, -0.5 * s, 0.42 * s, -0.4 * s);
    g.bezierCurveTo(0.42 * s, 0.1 * s, 0.1 * s, 0.46 * s, -0.38 * s, 0.36 * s); g.closePath();
    g.fillStyle = '#5BD17A'; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
    g.beginPath(); g.moveTo(-0.42 * s, 0.42 * s); g.quadraticCurveTo(0, 0, 0.3 * s, -0.28 * s); g.stroke();
  },
  road(g, s, lw) {   // middle road: a road to the horizon
    blob(g, [[-0.1 * s, -0.4 * s], [0.1 * s, -0.4 * s], [0.42 * s, 0.42 * s], [-0.42 * s, 0.42 * s]], '#8A96AE', lw);
    g.fillStyle = '#FFE28A'; for (let k = 0; k < 3; k++) { const y = -0.25 * s + k * 0.24 * s, w = 0.03 * s + k * 0.02 * s; g.fillRect(-w, y, 2 * w, 0.13 * s); }
    circ(g, 0.3 * s, -0.3 * s, 0.11 * s, '#FFC93C', lw * 0.8);
  },
  factory(g, s, lw) {   // high emissions: a factory with smoke
    circ(g, 0.22 * s, -0.36 * s, 0.1 * s, '#C9CFDA', lw * 0.8); circ(g, 0.06 * s, -0.42 * s, 0.08 * s, '#C9CFDA', lw * 0.8);
    blob(g, [[0.14 * s, -0.25 * s], [0.3 * s, -0.25 * s], [0.3 * s, 0.1 * s], [0.14 * s, 0.1 * s]], '#B04A3A', lw);
    blob(g, [[-0.44 * s, 0.4 * s], [-0.44 * s, -0.02 * s], [-0.2 * s, 0.12 * s], [-0.2 * s, -0.02 * s], [0.04 * s, 0.12 * s], [0.04 * s, -0.02 * s], [0.42 * s, 0.1 * s], [0.42 * s, 0.4 * s]], '#E8875A', lw);
  },
  smoke(g, s, lw) {   // very high emissions: two chimneys and thick smoke
    for (const [x, y, r] of [[-0.12, -0.3, 0.13], [0.08, -0.38, 0.14], [0.28, -0.3, 0.12], [-0.3, -0.36, 0.1]]) circ(g, x * s, y * s, r * s, '#7D8597', lw * 0.8);
    blob(g, [[-0.3 * s, -0.18 * s], [-0.14 * s, -0.18 * s], [-0.14 * s, 0.1 * s], [-0.3 * s, 0.1 * s]], '#8E2F2F', lw);
    blob(g, [[0.12 * s, -0.18 * s], [0.28 * s, -0.18 * s], [0.28 * s, 0.1 * s], [0.12 * s, 0.1 * s]], '#8E2F2F', lw);
    blob(g, [[-0.44 * s, 0.42 * s], [-0.44 * s, 0.04 * s], [0.44 * s, 0.04 * s], [0.44 * s, 0.42 * s]], '#D9434A', lw);
  },
  temp_c(g, s, lw) {   // thermometer
    rrect(g, -0.1 * s, -0.44 * s, 0.2 * s, 0.6 * s, 0.1 * s, '#fff', lw);
    circ(g, 0, 0.26 * s, 0.17 * s, '#FF5A4E', lw);
    g.fillStyle = '#FF5A4E'; g.fillRect(-0.045 * s, -0.2 * s, 0.09 * s, 0.4 * s);
  },
  rain_mm_yr(g, s, lw) {   // a drop
    g.beginPath(); g.moveTo(0, -0.44 * s); g.bezierCurveTo(0.12 * s, -0.2 * s, 0.34 * s, 0.02 * s, 0.34 * s, 0.16 * s);
    g.arc(0, 0.16 * s, 0.34 * s, 0, Math.PI); g.bezierCurveTo(-0.34 * s, 0.02 * s, -0.12 * s, -0.2 * s, 0, -0.44 * s);
    g.fillStyle = '#4FB3FF'; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke();
    circ(g, -0.12 * s, 0.14 * s, 0.06 * s, '#D9F0FF', 0);
  },
  snow_depth_cm(g, s, lw) {   // snowflake
    g.lineCap = 'round'; g.strokeStyle = INK; g.lineWidth = lw * 2.6;
    const arm = () => { for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3, c = Math.cos(a), d = Math.sin(a); g.beginPath(); g.moveTo(0, 0); g.lineTo(c * 0.42 * s, d * 0.42 * s); g.moveTo(c * 0.26 * s, d * 0.26 * s); g.lineTo((c * 0.26 - d * 0.12) * s, (d * 0.26 + c * 0.12) * s); g.moveTo(c * 0.26 * s, d * 0.26 * s); g.lineTo((c * 0.26 + d * 0.12) * s, (d * 0.26 - c * 0.12) * s); g.stroke(); } };
    arm(); g.strokeStyle = '#BFE6FF'; g.lineWidth = lw * 1.1; arm();
  },
  vegetation(g, s, lw) {   // a round tree
    g.fillStyle = '#8A5A3B'; g.fillRect(-0.07 * s, 0.05 * s, 0.14 * s, 0.38 * s); g.lineWidth = lw; g.strokeStyle = INK; g.strokeRect(-0.07 * s, 0.05 * s, 0.14 * s, 0.38 * s);
    circ(g, 0, -0.12 * s, 0.32 * s, '#49B95E', lw);
    circ(g, -0.1 * s, -0.2 * s, 0.08 * s, '#7FDB8C', 0);
  },
  sea_level_m(g, s, lw) {   // waves
    rrect(g, -0.44 * s, -0.08 * s, 0.88 * s, 0.5 * s, 0.1 * s, '#3FA7F5', lw);
    g.strokeStyle = '#fff'; g.lineWidth = lw * 1.2; g.lineCap = 'round';
    for (const y of [0.06, 0.24]) { g.beginPath(); for (let k = 0; k <= 16; k++) { const x = -0.34 + k * 0.68 / 16; g.lineTo(x * s, (y + 0.04 * Math.sin(k * 1.2)) * s); } g.stroke(); }
    g.strokeStyle = INK; g.lineWidth = lw; g.beginPath(); g.moveTo(0.3 * s, -0.42 * s); g.lineTo(0.3 * s, -0.12 * s); g.moveTo(0.2 * s, -0.22 * s); g.lineTo(0.3 * s, -0.12 * s); g.lineTo(0.4 * s, -0.22 * s); g.stroke();
  },
  globe(g, s, lw) {
    circ(g, 0, 0, 0.42 * s, '#4FB3FF', lw);
    blob(g, [[-0.2 * s, -0.3 * s], [0.05 * s, -0.25 * s], [0.0, -0.05 * s], [-0.25 * s, 0.05 * s]], '#6BCB6B', lw * 0.7);
    blob(g, [[0.12 * s, 0.05 * s], [0.32 * s, 0.1 * s], [0.18 * s, 0.32 * s]], '#6BCB6B', lw * 0.7);
  },
  pin(g, s, lw) {
    g.beginPath(); g.moveTo(0, 0.44 * s); g.bezierCurveTo(-0.1 * s, 0.1 * s, -0.32 * s, -0.02 * s, -0.32 * s, -0.16 * s);
    g.arc(0, -0.16 * s, 0.32 * s, Math.PI, 0); g.bezierCurveTo(0.32 * s, -0.02 * s, 0.1 * s, 0.1 * s, 0, 0.44 * s);
    g.fillStyle = '#FF4F5E'; g.fill(); g.lineWidth = lw; g.strokeStyle = INK; g.stroke(); circ(g, 0, -0.16 * s, 0.12 * s, '#fff', lw * 0.8);
  },
};
export const ICONS = Object.keys(DRAW);

export function drawIcon(g, kind, cx, cy, size) {
  const f = DRAW[kind] || DRAW.globe;
  g.save(); g.translate(cx, cy); g.lineJoin = 'round';
  f(g, size, Math.max(1.5, size * 0.065));
  g.restore();
}
const URLS = {};
export function iconURL(kind, px = 64) {
  const k = kind + '@' + px;
  if (URLS[k]) return URLS[k];
  const c = document.createElement('canvas'); c.width = c.height = px;
  drawIcon(c.getContext('2d'), kind, px / 2, px / 2, px * 0.92);
  return (URLS[k] = c.toDataURL());
}
export { rrect, circ, INK };
