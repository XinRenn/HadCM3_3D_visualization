/* Desktop fallback: the same actions as the VR panels, as an HTML overlay driven by mouse, touch or keys.
   ?debug=1 adds a panel that overrides any Bristol value, to test every visual state. */
import { U, tx, fmt, LANG, setLang, stopLabel, pathLabel, yearNote, sourceLabel } from '../i18n.js';
import { iconURL } from './icons.js';
import { fmtValue } from '../format.js';
import { pathColor, pathIcon } from './xr.js';
import { VARS } from '../data.js';

const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Overlay {
  constructor(app) {
    this.app = app;
    this._bind();
    if (new URLSearchParams(location.search).get('debug') === '1') this._debug();
    if (window.ResizeObserver) new ResizeObserver(() => this._dockH()).observe($('#dock'));
  }
  _dockH() { document.documentElement.style.setProperty('--dock-h', $('#dock').offsetHeight + 'px'); this.app.resize(); }
  _bind() {
    const app = this.app;
    document.querySelectorAll('.lang button').forEach(b => { b.onclick = () => setLang(b.dataset.lang); });
    $('#btnEarlier').onclick = () => app.stepStop(-1);
    $('#btnLater').onclick = () => app.stepStop(1);
    $('#btnVisit').onclick = () => app.visit();
    $('#btnBack').onclick = () => app.back();
    $('#btnSeated').onclick = () => app.toggleSeated();
    $('#btnSummary').onclick = () => app.openClosing();
    $('#btnAbout').onclick = () => { const a = $('#about'); a.hidden = !a.hidden; $('#btnAbout').setAttribute('aria-expanded', String(!a.hidden)); };
    $('#warnBtn').onclick = () => { $('#warnList').hidden = !$('#warnList').hidden; };
    $('#layers').onclick = e => { const b = e.target.closest('[data-layer]'); if (b) app.setLayer(b.dataset.layer); };
    $('#paths').onclick = e => { const b = e.target.closest('[data-path]'); if (b) app.setPathway(b.dataset.path); };
    $('#stops').onclick = e => { const b = e.target.closest('[data-stop]'); if (b) app.setStop(b.dataset.stop); };
    $('#closing').onclick = e => { if (e.target.id === 'closing' || e.target.closest('[data-close]')) app.closeClosing(); };
    document.addEventListener('keydown', e => {
      if (e.target.closest && e.target.closest('input, select, textarea')) return;
      if (e.key === 'Escape' && app.S.closingOpen) { app.closeClosing(); return; }
      if (e.key === 'ArrowRight') app.stepStop(1);
      if (e.key === 'ArrowLeft') app.stepStop(-1);
      if (/^[1-9]$/.test(e.key)) { const p = app.data.pathways[+e.key - 1]; if (p) app.setPathway(p.id); }
      if (e.key === 'Enter' && app.S.mode === 'globe' && !e.target.closest('button')) app.visit();
      if (e.key === 'Backspace' && app.S.mode === 'city') app.back();
    });
  }
  render() {
    const app = this.app, S = app.S, d = app.data;
    document.title = tx(U.title);
    document.body.classList.toggle('city', S.mode === 'city');
    document.body.classList.toggle('sim', !!app.SIM);
    /* always-on labels */
    const b = $('#badgeDemo');
    b.hidden = !d.placeholder; b.textContent = sourceLabel(d.sourceLabel); b.title = tx(U.demoDataLong);
    $('#tagScenario').textContent = tx(U.notPrediction);
    $('#tagAverage').textContent = tx(U.average);
    const st = d.stop(S.stop), pw = d.pathway(S.pathway);
    $('#tagChoice').textContent = `${st ? stopLabel(st) : tx(U.noData)} · ${d.sharedStop(S.stop) ? tx(U.allPaths) : (pw ? pathLabel(pw) : tx(U.noData))}`;
    document.querySelectorAll('.lang button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.lang === LANG)));
    $('#btnAbout').textContent = tx(U.about); $('#about').innerHTML = tx(U.aboutBody);
    $('#btnSeated').hidden = S.mode !== 'city'; $('#btnSeated').textContent = tx(U.seated); $('#btnSeated').setAttribute('aria-pressed', String(S.seated));
    $('#btnVR').textContent = app.renderer.xr.isPresenting ? tx(U.exitVR) : tx(U.enterVR);
    $('#title').innerHTML = `<h1>${esc(tx(U.title))}</h1><p>${esc(tx(U.tagline))}</p>`;
    /* layers */
    $('#layers').innerHTML = `<span class="sr" hidden>${esc(tx(U.layers))}</span>` + app.layerNames().map(n =>
      `<button type="button" class="pill" data-layer="${n}" aria-pressed="${S.layer === n}"><img alt="" src="${iconURL(n, 52)}">${esc(tx(U['l_' + n]))}</button>`).join('');
    /* pathways */
    const shared = d.sharedStop(S.stop);
    $('#paths').innerHTML = d.pathways.map((p, k) =>
      `<button type="button" class="path" data-path="${esc(p.id)}" aria-pressed="${S.pathway === p.id}" style="--pc:${pathColor(p, k)}" title="${esc(p.ssp)}">`
      + `<img alt="" src="${iconURL(pathIcon(p, k), 88)}"><b>${esc(pathLabel(p))}</b><small>${esc(p.ssp)}</small></button>`).join('')
      + (shared ? `<span class="shared">${esc(tx(st && st.kind === 'now' ? U.nowAll : U.pastAll))}</span>` : '');
    $('#paths').classList.toggle('is-shared', shared);
    if (!d.pathways.length) $('#paths').innerHTML = `<span class="shared">${esc(tx(U.noData))}</span>`;
    /* stops */
    const cur = app.stopIndex();
    $('#stops').innerHTML = d.stops.map((s, k) =>
      `<button type="button" class="stop${s.kind === 'past' ? ' past' : ''}" data-stop="${esc(s.id)}" aria-pressed="${k === cur}"><i></i><b>${esc(stopLabel(s))}</b><small>${s.kind === 'now' ? '&nbsp;' : esc(yearNote(s))}</small></button>`).join('');
    $('#btnEarlier').textContent = '◀ ' + tx(U.earlier); $('#btnEarlier').disabled = cur <= 0;
    $('#btnLater').textContent = tx(U.later) + ' ▶'; $('#btnLater').disabled = cur >= d.stops.length - 1;
    const curB = $('#stops [aria-pressed="true"]'); if (curB) curB.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    /* go row */
    $('#btnVisit').innerHTML = `<img alt="" src="${iconURL('pin', 64)}" style="width:34px;height:34px;vertical-align:-8px;margin-right:8px">${esc(tx(U.visit))}`;
    $('#btnBack').innerHTML = `<img alt="" src="${iconURL('globe', 64)}" style="width:32px;height:32px;margin-right:8px">${esc(tx(U.back))}`;
    $('#visitHint').textContent = tx(U.pinHint);
    $('#btnSummary').hidden = !(S.mode === 'city' && app.canCompare()); $('#btnSummary').textContent = tx(U.summary);
    $('#hint').textContent = S.mode === 'globe' ? tx(U.dragGlobe) : `${tx(U.dragLook)} · ${tx(U.flood)}`;
    /* warnings */
    const w = d.warnings;
    $('#warn').hidden = !w.length; $('#warnBtn').textContent = '⚠ ' + fmt(U.warnings, { n: w.length });
    $('#warnList').innerHTML = w.map(s => `<li>${esc(s)}</li>`).join('');
    this.renderLegend();
    this.renderClosing();
    if (this.dbg) this._debugSync();
  }
  renderLegend() {
    const info = this.app.globe.legendInfo, el = $('#legend');
    if (!info) { el.innerHTML = ''; return; }
    let h = `<h3>${esc(info.title)}</h3><p class="unit">${esc(info.unit)}</p>`;
    if (info.missing) h += `<p class="unit" style="color:var(--demo)">${esc(tx(U.noData))}</p>`;
    if (info.cats) h += `<div class="cats">${info.cats.map(([c, l]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')}</div>`;
    else if (info.bands) {
      const n = info.bands.length, grad = info.bands.map(([c], k) => `${c || '#86C46A'} ${(k / n * 100).toFixed(2)}% ${((k + 1) / n * 100).toFixed(2)}%`).join(', ');
      h += `<div class="bar" style="background:linear-gradient(90deg, ${grad})"></div><div class="ticks">${info.ticks.map(t => {
        const k = info.bands.findIndex(b => b[1] === t); return k < 0 ? '' : `<span style="left:${(k / n * 100).toFixed(1)}%">${t}</span>`;
      }).join('')}</div><p class="unit" style="text-align:right;margin:0">${esc(info.sym)}</p>`;
    }
    if (info.shelf) h += `<p class="note">${esc(tx(U.shelf))}</p>`;
    el.innerHTML = h;
  }
  renderClosing() {
    const app = this.app, wrap = $('#closing'), on = app.S.closingOpen && !app.xrActive();
    wrap.hidden = !on;
    if (!on) return;
    const c = app.closingInfo(), d = app.data;
    if (!c) { wrap.hidden = true; return; }
    const col = (s, cls, k) => `<div class="col ${cls}"><h3><img alt="" src="${iconURL(pathIcon(s.p, k), 72)}">${esc(pathLabel(s.p))}</h3><dl>`
      + `<dt>${esc(tx(U.c_sea))}</dt><dd>${esc(fmtValue('sea_level_m', s.v.sea_level_m))}</dd>`
      + `<dt>${esc(tx(U.c_temp))}</dt><dd>${esc(fmtValue('temp_c', s.v.temp_c))}</dd></dl></div>`;
    $('#closingCard').innerHTML = `<h2 id="cTitle">${esc(tx(U.c_title))}</h2><p class="intro">${esc(fmt(U.c_intro, { stop: stopLabel(c.stop) }))}</p>`
      + `<div class="cols">${col(c.low, 'low', 0)}${col(c.high, 'high', 3)}</div>`
      + `<p class="hope">${esc(tx(U.c_hope))}</p>`
      + (d.placeholder ? `<p class="demo">${esc(sourceLabel(d.sourceLabel))}: ${esc(tx(U.demoDataLong))}</p>` : '')
      + `<button type="button" class="big visit" data-close>${esc(tx(U.c_close))}</button>`;
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
    el.addEventListener('input', e => { const k = e.target.dataset.k; if (k) { const c = el.querySelector(`[data-on="${k}"]`); c.checked = true; } read(); this._debugSync(); });
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
