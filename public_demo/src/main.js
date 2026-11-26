/* Boot: load and check the data, show the always-on labels. (Milestone 2: the scenes come next.) */
import { loadData } from './data.js';
import { U, tx, fmt, setLang, onLang, LANG, sourceLabel } from './i18n.js';

const $ = s => document.querySelector(s);
let DATA = null;

function renderTags() {
  const b = $('#badgeDemo');
  b.hidden = !DATA || !DATA.placeholder;
  b.textContent = DATA ? sourceLabel(DATA.sourceLabel) : '';
  b.title = tx(U.demoDataLong);
  $('#tagScenario').textContent = tx(U.notPrediction);
  $('#tagAverage').textContent = tx(U.average);
  document.querySelectorAll('.lang button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.lang === LANG)));
  const w = DATA ? DATA.warnings : [];
  $('#warn').hidden = !w.length;
  $('#warnBtn').textContent = '⚠ ' + fmt(U.warnings, { n: w.length });
  $('#warnList').innerHTML = w.map(s => `<li>${s.replace(/</g, '&lt;')}</li>`).join('');
}

async function main() {
  $('#loadMsg').textContent = tx(U.loading);
  document.querySelectorAll('.lang button').forEach(x => { x.onclick = () => setLang(x.dataset.lang); });
  $('#warnBtn').onclick = () => { $('#warnList').hidden = !$('#warnList').hidden; };
  onLang(renderTags);
  try {
    DATA = await loadData('data/');
    window.DEMO = { data: DATA };
    renderTags();
    $('#loading').hidden = true;
  } catch (e) {
    console.error(e);
    $('#loading').classList.add('err');
    $('#loadMsg').textContent = fmt(U.fail, { e: e.message || e });
  }
}
main();
