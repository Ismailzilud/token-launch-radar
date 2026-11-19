// Token Launch Radar — the board page. Reads window.RADAR, the data
// file main.ts writes beside this folder from the same board the gate
// checks, so what the page shows and what was handed in cannot drift.

const R = window.RADAR;
const rowsEl = document.getElementById('rows');
const countEl = document.getElementById('count');
const emptyEl = document.getElementById('empty');
const detailEl = document.getElementById('detail');
let openSlug = null;

function fmtUSD(n) {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(n >= 1e10 ? 1 : 2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + n;
}
function fmtPct(x) {
  if (x === null) return '—';
  const cls = x > 0 ? 'up' : x < 0 ? 'down' : '';
  return `<span class="${cls}">${x > 0 ? '+' : ''}${x.toFixed(1)}%</span>`;
}
function fmtAge(days) {
  if (days === null) return '—';
  return (days / 365).toFixed(1) + 'y';
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Masthead facts and the measured multiples table.
document.getElementById('facts').innerHTML = [
  ['Snapshot', R.as_of],
  ['Protocols read', R.protocol_count],
  ['On the watchlist', R.watchlist_size],
  ['Ranked here', R.rows.length],
].map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
document.getElementById('foot-meta').textContent = `as of ${R.as_of}, floor ${fmtUSD(R.floor_usd)}`;
document.getElementById('multiples').innerHTML =
  '<caption>Category multiples measured from this snapshot — median traded market cap / TVL, shrunk toward the global median of ' +
  R.global_multiple.toFixed(3) + '</caption>' +
  '<tr><th>Category</th><th class="n">Traded peers</th><th class="n">Multiple used</th><th class="n">Pre-token protocols</th></tr>' +
  R.categories.slice(0, 10)
    .map((c) => `<tr><td>${esc(c.category)}</td><td class="n">${c.peers}</td><td class="n">${c.multiple.toFixed(3)}</td><td class="n">${c.pre_token}</td></tr>`)
    .join('');

// Filter options, from the data itself.
const catSel = document.getElementById('f-category');
for (const c of [...new Set(R.rows.map((r) => r.category).filter(Boolean))].sort()) {
  catSel.insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`);
}
const chainSel = document.getElementById('f-chain');
for (const c of [...new Set(R.rows.flatMap((r) => r.chains))].sort()) {
  chainSel.insertAdjacentHTML('beforeend', `<option>${esc(c)}</option>`);
}

function visibleRows() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  const cat = catSel.value;
  const chain = chainSel.value;
  const watchOnly = document.getElementById('f-watch').checked;
  const sort = document.getElementById('f-sort').value;
  let list = R.rows.filter((r) =>
    (q === '' || r.name.toLowerCase().includes(q) || r.slug.includes(q)) &&
    (cat === '' || r.category === cat) &&
    (chain === '' || r.chains.includes(chain)) &&
    (!watchOnly || r.watchlist));
  const by = {
    rank: (a, b) => a.rank - b.rank,
    tvl: (a, b) => b.tvl_usd - a.tvl_usd,
    growth: (a, b) => (b.change_7d ?? -1e9) - (a.change_7d ?? -1e9),
    age: (a, b) => (b.age_days ?? -1) - (a.age_days ?? -1),
    multiple: (a, b) => b.multiple - a.multiple,
  }[sort];
  return list.sort(by);
}

function render() {
  const list = visibleRows();
  countEl.textContent = `${list.length} of ${R.rows.length} protocols`;
  emptyEl.hidden = list.length !== 0;
  rowsEl.innerHTML = list.map((r) => `
    <tr data-slug="${esc(r.slug)}" class="${r.slug === openSlug ? 'open' : ''}">
      <td class="num">${r.rank}</td>
      <td><span class="name">${esc(r.name)}</span><br><span class="slug">${esc(r.slug)}</span></td>
      <td class="cat">${esc(r.category ?? '—')}</td>
      <td class="num">${r.chains.length}</td>
      <td class="num">${fmtUSD(r.tvl_usd)}</td>
      <td class="num">${fmtPct(r.change_7d)}</td>
      <td class="num">${fmtAge(r.age_days)}</td>
      <td class="num">${r.multiple.toFixed(3)}</td>
      <td class="num val">${fmtUSD(r.implied_value_usd)}</td>
      <td>${r.watchlist ? '<span class="mark">★ watchlist</span>' : ''}${r.plausibility_note ? `<span class="disc">×${r.plausibility_factor} — discounted</span>` : ''}</td>
    </tr>`).join('');
  for (const tr of rowsEl.querySelectorAll('tr')) {
    tr.addEventListener('click', () => openDetail(tr.dataset.slug));
  }
}

function bar(label, factor, display, logScale) {
  const width = logScale
    ? Math.max(3, Math.min(100, (Math.log10(Math.max(factor, 0.001)) + 1) * 50))
    : Math.max(3, Math.min(100, factor * 100));
  return `<div class="bar-row"><span class="k">${label}</span><span class="bar"><i class="${factor < 0.999 ? 'dim' : ''}" style="width:${width}%"></i></span><span class="v">${display}</span></div>`;
}

function openDetail(slug) {
  const r = R.rows.find((x) => x.slug === slug);
  if (!r) return;
  openSlug = slug;
  const peers = (R.peers_by_category[r.category] ?? []).slice(0, 4);
  detailEl.innerHTML = `
  <div class="detail-in">
    <button class="close" id="close-detail">Close ✕</button>
    <h3>#${r.rank} ${esc(r.name)}</h3>
    <p class="sub">${esc(r.category ?? 'Uncategorised')} · ${r.chains.map(esc).join(', ')} · TVL ${fmtUSD(r.tvl_usd)} · records no token in the snapshot${r.watchlist ? ' · ★ on the house watchlist' : ''}</p>
    <div class="detail-grid">
      <div>
        <h4>How the ${fmtUSD(r.implied_value_usd)} is built</h4>
        ${bar('TVL anchor', 1, fmtUSD(r.tvl_usd), false)}
        ${bar('× category multiple', r.multiple, r.multiple.toFixed(3) + ` (${r.peers} traded peers)`, true)}
        ${bar('× growth, 7d', r.growth_factor, r.growth_factor.toFixed(3), false)}
        ${bar('× maturity', r.maturity_factor, r.maturity_factor.toFixed(3) + (r.age_days !== null ? ` (${fmtAge(r.age_days)} tracked)` : ' (untracked age)'), false)}
        ${bar('× breadth', r.breadth_factor, r.breadth_factor.toFixed(3) + ` (${r.chains.length} chains)`, false)}
        ${bar('× plausibility', r.plausibility_factor, r.plausibility_factor.toFixed(2), false)}
        ${r.plausibility_note ? `<p class="note">Discounted because ${esc(r.plausibility_note)}.</p>` : ''}
        <h4>Traded peers this multiple came from</h4>
        ${peers.length ? `<table class="peers"><tr><th>Protocol</th><th class="n">Market cap</th><th class="n">TVL</th><th class="n">Cap / TVL</th></tr>${peers.map((p) => `<tr><td>${esc(p.name)}${p.symbol ? ` (${esc(p.symbol)})` : ''}</td><td class="n">${fmtUSD(p.mcap_usd)}</td><td class="n">${fmtUSD(p.tvl_usd)}</td><td class="n">${p.ratio.toFixed(3)}</td></tr>`).join('')}</table>` : '<p class="sub">No traded peer in this category — the global median multiple is used.</p>'}
      </div>
      <div>
        <h4>Farm plan — before a token exists</h4>
        <ol class="steps">${r.farm_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
      </div>
    </div>
  </div>`;
  detailEl.hidden = false;
  document.getElementById('close-detail').addEventListener('click', () => {
    detailEl.hidden = true;
    openSlug = null;
    render();
  });
  render();
  detailEl.scrollIntoView({ block: 'nearest' });
}

for (const id of ['q', 'f-category', 'f-chain', 'f-sort', 'f-watch']) {
  document.getElementById(id).addEventListener('input', render);
}
render();

// A #slug in the address opens that protocol's detail — the same state
// the detail screenshot is taken in.
if (location.hash.length > 1) openDetail(decodeURIComponent(location.hash.slice(1)));
