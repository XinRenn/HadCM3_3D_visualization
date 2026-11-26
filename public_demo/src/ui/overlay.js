/* Desktop fallback: the same actions as the VR panels, as an HTML overlay driven by mouse, touch or keys.
   ?debug=1 adds a panel that overrides any Bristol value, to test every visual state. */
import { U, tx, fmt, LANG, setLang, pathLabel, pathSub, sourceLabel, timeLabel, markLabel } from '../i18n.js';
import { iconURL } from './icons.js';
import { fmtValue } from '../format.js';
import { pathColor, pathIcon } from './xr.js';
import { VARS } from '../data.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ICON = { surface: 'globe', temp: 'temp_c', rain: 'rain_mm_yr', plants: 'vegetation', sea: 'sea_level_m' };
const SLIDER_N = 1000;          // the HTML range runs 0..1000 over the stretched time scale

export class Overlay {
  constructor(app) {
    this.app = app;
    this._bind();
    if (new URLSearchParams(location.search).get('debug') === '1') this._debug();
    if (window.ResizeObserver) new ResizeObserver(() => this._dockH()).observe($('#dock'));
  }
  _dockH() { document.documentElement.style.setProperty('--dock-h', $('#dock').offsetHeight + 'px'); this.app.resize(); }
  _bind() {
    const app = this.app, S = app.S;
    document.querySelectorAll('.lang button').forEach(b => { b.onclick = () => setLang(b.dataset.lang); });
    $('#btnEarlier').onclick = () => app.stepTime(-1);
    $('#btnLater').onclick = () => app.stepTime(1);
    $('#btnPlay').onclick = () => app.togglePlay();
    $('#btnVisit').onclick = () => app.visit();
    $('#btnBack').onclick = () => app.back();
    $('#btnSeated').onclick = () => app.toggleSeated();
    $('#btnSummary').onclick = () => app.openClosing();
    $('#btnReset').onclick = () => app.resetGlobe();
    $('#btnAbout').onclick = () => { const a = $('#about'); a.hidden = !a.hidden; $('#btnAbout').setAttribute('aria-expanded', String(!a.hidden)); };
    $('#warnBtn').onclick = () => { $('#warnList').hidden = !$('#warnList').hidden; };
    $('#layers').onclick = e => { const b = e.target.closest('[data-layer]'); if (b) app.setLayer(b.dataset.layer); };
    $('#paths').onclick = e => { const b = e.target.closest('[data-path]'); if (b) app.setPathway(b.dataset.path); };
    $('#closing').onclick = e => { if (e.target.id === 'closing' || e.target.closest('[data-close]')) app.closeClosing(); };
    const sl = $('#tSlider'), end = () => app.data.axis.end, val = () => app.p2t(sl.value / SLIDER_N, end());
    sl.addEventListener('input', () => { app.stopPlay(); if (S.mode === 'city') app.previewTime(val()); else app.setTime(val()); });
    sl.addEventListener('change', () => { if (S.mode === 'city') app.setTime(val()); });
    $('#legend').addEventListener('input', e => { if (e.target.id === 'seaDemo') app.setSeaDemo(+e.target.value); });
    $('#legend').addEventListener('click', e => { if (e.target.closest('[data-seaoff]')) app.setSeaDemo(null); });
    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.key === 'Escape' && S.closingOpen) { app.closeClosing(); return; }
      if (e.key === 'ArrowRight') app.stepTime(1);
      if (e.key === 'ArrowLeft') app.stepTime(-1);
      if (e.key === ' ' && S.mode === 'globe') { e.preventDefault(); app.togglePlay(); }
      if (/^[1-9]$/.test(e.key)) { const p = app.data.pathways[+e.key - 1]; if (p) app.setPathway(p.id); }
      if (e.key === 'Enter' && S.mode === 'globe' && !e.target.closest('button')) app.visit();
      if (e.key === 'Backspace' && S.mode === 'city') app.back();
    });
  }
  render() {
    const app = this.app, S = app.S, d = app.data;
    document.title = tx(U.title);
    document.body.classList.toggle('city', S.mode === 'city');
    document.body.classList.toggle('sim', !!app.SIM);
    const b = $('#badgeDemo');
    b.hidden = false; b.textContent = d.placeholder ? sourceLabel(d) : fmt(U.source, { s: sourceLabel(d) });
    b.classList.toggle('real', !d.placeholder); b.title = d.placeholder ? tx(U.demoDataLong) : '';
    $('#tagScenario').textContent = tx(U.notPrediction);
    $('#tagAverage').textContent = tx(U.average);
    document.querySelectorAll('.lang button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.lang === LANG)));
    $('#btnAbout').textContent = tx(U.about); $('#about').innerHTML = tx(U.aboutBody);
    $('#btnSeated').hidden = S.mode !== 'city'; $('#btnSeated').textContent = tx(U.seated); $('#btnSeated').setAttribute('aria-pressed', String(S.seated));
    $('#btnVR').textContent = app.renderer.xr.isPresenting ? tx(U.exitVR) : tx(U.enterVR);
    $('#title').innerHTML = `<h1>${esc(tx(U.title))}</h1><p>${esc(tx(U.tagline))}</p>`;
    $('#layers').innerHTML = app.layerNames().map(n =>
      `<button type="button" class="pill" data-layer="${n}" aria-pressed="${S.layer === n}"><img alt="" src="${iconURL(ICON[n], 52)}">${esc(tx(U['l_' + n]))}</button>`).join('');
    $('#paths').innerHTML = d.pathways.map((p, k) =>
      `<button type="button" class="path" data-path="${esc(p.id)}" aria-pressed="${S.pathway === p.id}" style="--pc:${pathColor(p, k)}" title="${esc(p.ssp)}">`
      + `<img alt="" src="${iconURL(pathIcon(p, k), 80)}"><b>${esc(pathLabel(p))}</b><small>${esc(pathSub(p))}</small></button>`).join('')
      || `<span class="shared">${esc(tx(U.noData))}</span>`;
    const end = d.axis.end;
    $('#tMarks').innerHTML = d.marks.map(m => { const q = app.t2p(m.t, end) * 100; return `<span style="left:${q.toFixed(2)}%" class="${q < 2 ? 'first' : q > 98 ? 'last' : ''}">${esc(markLabel(m))}</span>`; }).join('');
    $('#btnEarlier').textContent = '◀ ' + tx(U.earlier); $('#btnLater').textContent = tx(U.later) + ' ▶';
    $('#btnVisit').innerHTML = `<img alt="" src="${iconURL('pin', 64)}" style="width:34px;height:34px;vertical-align:-8px;margin-right:8px">${esc(tx(U.visit))}`;
    $('#btnBack').innerHTML = `<img alt="" src="${iconURL('globe', 64)}" style="width:32px;height:32px;margin-right:8px">${esc(tx(U.back))}`;
    $('#btnReset').textContent = tx(U.resetGlobe);
    $('#visitHint').textContent = tx(U.pinHint);
    $('#btnSummary').hidden = !(S.mode === 'city' && app.canCompare()); $('#btnSummary').textContent = tx(U.summary);
    $('#hint').textContent = S.mode === 'globe' ? tx(U.dragGlobe) : `${tx(U.dragLook)} · ${tx(U.flood)}`;
    const w = d.warnings;
    $('#warn').hidden = !w.length; $('#warnBtn').textContent = 'ⓘ ' + fmt(U.warnings, { n: w.length });
    $('#warnList').innerHTML = w.map(s => `<li>${esc(s)}</li>`).join('');
    this.renderTime();
    this.renderLegend();
    this.renderClosing();
    if (this.dbg) this._debugSync();
  }
  renderTime() {
    const app = this.app, S = app.S, d = app.data, t = app.shownT(), pw = d.pathway(S.pathway);
    const sl = $('#tSlider');
    if (document.activeElement !== sl || S.playing) sl.value = Math.round(app.t2p(t, d.axis.end) * SLIDER_N);
    $('#tLabel').textContent = timeLabel(t);
    $('#btnEarlier').disabled = S.t <= 0; $('#btnLater').disabled = S.t >= d.axis.end;
    $('#btnPlay').textContent = (S.playing ? '❚❚ ' : '▶ ') + tx(S.playing ? U.pause : U.play); $('#btnPlay').setAttribute('aria-pressed', String(S.playing));
    $('#tagChoice').textContent = `${timeLabel(t)} · ${pw ? pathLabel(pw) : tx(U.noData)}`;
    if (S.mode === 'globe') this.renderLegend();
  }
  renderLegend() {
    const app = this.app, S = app.S, info = app.globe.legendInfo, el = $('#legend');
    if (!info) { el.innerHTML = ''; return; }
    let h = `<h3>${esc(info.title)}</h3><p class="unit">${esc(info.unit)}</p>`;
    if (info.missing) h += `<p class="unit" style="color:var(--demo)">${esc(tx(U.noData))}</p>`;
    if (info.gradient) {
      h += `<div class="bar" style="background:linear-gradient(90deg, ${info.gradient.map(([q, c]) => `${c} ${(q * 100).toFixed(1)}%`).join(', ')})"></div>`
        + `<div class="ticks">${info.ticks.map(([q, l]) => `<span style="left:${(q * 100).toFixed(1)}%">${esc(l)}</span>`).join('')}</div><p class="unit" style="text-align:right;margin:0">${esc(info.sym)}</p>`;
    }
    if (info.cats) h += `<div class="cats">${info.cats.map(([c, l]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')}</div>`;
    h += `<p class="seanow">${esc(fmt(U.seaNow, { v: fmtValue('sea_level_m', info.sea) }))}${S.seaDemo != null ? ' *' : ''}</p>`;
    if (info.name === 'sea') {
      const v = S.seaDemo ?? Math.round(info.sea);
      h += `<label class="seademo">${esc(tx(S.seaDemo != null ? U.seaDemoOn : U.seaDemo))}<input type="range" id="seaDemo" min="-130" max="70" step="1" value="${v}"><span class="sd-ticks"><span>−130 m</span><span>0</span><span>+70 m</span></span></label>`
        + (S.seaDemo != null ? `<button type="button" class="small" data-seaoff>${esc(tx(U.seaDemoOff))}</button>` : '');
    } else if (info.fixed && info.name !== 'surface') h += `<p class="note fixed">${esc(tx(U.fixedNote))}</p>`;
    const active = document.activeElement && document.activeElement.id === 'seaDemo';
    if (active) { const n = el.querySelector('.seanow'); if (n) n.textContent = fmt(U.seaNow, { v: fmtValue('sea_level_m', info.sea) }) + ' *'; return; }
    el.innerHTML = h;
  }
  renderClosing() {
    const app = this.app, wrap = $('#closing'), on = app.S.closingOpen && !app.xrActive();
    wrap.hidden = !on;
    if (!on) return;
    const c = app.closingInfo(), d = app.data;
    if (!c) { wrap.hidden = true; return; }
    const col = (s, cls) => { const k = d.pathways.indexOf(s.p); return `<div class="col ${cls}" style="--pc:${pathColor(s.p, k)}"><h3><img alt="" src="${iconURL(pathIcon(s.p, k), 72)}">${esc(pathLabel(s.p))}</h3><dl>`
      + `<dt>${esc(tx(U.c_sea))}</dt><dd>${esc(fmtValue('sea_level_m', s.v.sea_level_m))}</dd>`
      + `<dt>${esc(tx(U.c_temp))}</dt><dd>${esc(fmtValue('temp_c', s.v.temp_c))}</dd></dl></div>`; };
    $('#closingCard').innerHTML = `<h2 id="cTitle">${esc(tx(U.c_title))}</h2><p class="intro">${esc(fmt(U.c_intro, { when: timeLabel(c.t) }))}</p>`
      + `<div class="cols">${col(c.low, 'low')}${col(c.high, 'high')}</div>`
      + `<p class="hope">${esc(tx(U.c_hope))}</p>`
      + `<p class="${d.placeholder ? 'demo' : 'src'}">${esc(d.placeholder ? sourceLabel(d) + ': ' + tx(U.demoDataLong) : fmt(U.source, { s: sourceLabel(d) }))}</p>`
      + `<button type="button" class="big closecard" data-close>${esc(tx(U.c_close))}</button>`;
    const btn = $('#closingCard [data-close]'); if (btn && document.activeElement !== btn) btn.focus({ preventScroll: true });
  }

  /* ---------------------------------------------------------------- ?debug=1: override the Bristol values */
  _debug() {
    const el = $('#debug'); el.hidden = false; this.dbg = true;
    const app = this.app, veg = app.data.vegTypes;
    const R = { sea_level_m: [-130, 40, 0.5], temp_c: [-5, 35, 0.5], wind_ms: [0, 14, 0.5], rain_mm_yr: [0, 2000, 10], snow_depth_cm: [0, 80, 1] };
    el.innerHTML = '<h4>Debug: override Bristol values</h4>' + Object.entries(R).map(([k, [a, b, s]]) =>
      `<label><input type="checkbox" data-on="${k}"> ${k} <output id="o_${k}"></output><input type="range" data-k="${k}" min="${a}" max="${b}" step="${s}"></label>`).join('')
      + `<label><input type="checkbox" data-on="vegetation"> vegetation<select data-k="vegetation">${veg.map(v => `<option>${v}</option>`).join('')}</select></label>`
      + '<div class="row"><button type="button" id="dbgClear">clear</button><button type="button" id="dbgMissing">all missing</button></div><p id="dbgStats"></p>';
    const read = () => {
      const o = {};
      el.querySelectorAll('[data-on]').forEach(c => { if (c.checked) { const i = el.querySelector(`[data-k="${c.dataset.on}"]`); o[c.dataset.on] = i.tagName === 'SELECT' ? i.value : +i.value; } });
      app.setOverride(Object.keys(o).length ? o : null);
    };
    el.addEventListener('input', e => { const k = e.target.dataset.k; if (k) { el.querySelector(`[data-on="${k}"]`).checked = true; } read(); this._debugSync(); });
    el.querySelector('#dbgClear').onclick = () => { el.querySelectorAll('[data-on]').forEach(c => { c.checked = false; }); app.setOverride(null); this._debugSync(); };
    el.querySelector('#dbgMissing').onclick = () => { const o = {}; for (const k of VARS) o[k] = null; app.setOverride(o); };
    this._debugSync();
  }
  _debugSync() {
    const el = $('#debug'), v = this.app.vals();
    el.querySelectorAll('[data-k]').forEach(i => {
      const k = i.dataset.k, c = el.querySelector(`[data-on="${k}"]`);
      if (!c.checked && v[k] != null) i.value = v[k];
      const o = el.querySelector('#o_' + k); if (o) o.textContent = k === 'vegetation' ? '' : (v[k] == null ? 'null' : v[k]);
    });
  }
  stats(s) { const e = document.getElementById('dbgStats'); if (e) e.textContent = s; }
}
