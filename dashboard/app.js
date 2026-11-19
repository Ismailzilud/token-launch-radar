// Token Launch Radar — the board page. Reads window.RADAR, the data
// file main.ts writes beside this folder from the same board the gate
// checks, so what the page shows and what was handed in cannot drift.
// The farm verdict is recomputed here, in the open, whenever the
// reader changes the deposit: the formula and its inputs are printed
// in the model section above.

const R = window.RADAR;
const rows = R.rows;
const bySlug = new Map(rows.map((r) => [r.slug, r]));

const $ = (id) => document.getElementById(id);
const els = {
  facts: $('facts'), multiples: $('multiples'), grade: $('grade'), aside: $('aside-note'),
  search: $('f-search'), category: $('f-category'), chain: $('f-chain'),
  verdict: $('f-verdict'), deposit: $('f-deposit'), sort: $('f-sort'), watch: $('f-watch'),
  count: $('count'), body: $('rows'), detail: $('detail'),
};

function money(v) {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}
function dollars(v) {
  const sign = v < 0 ? '-$' : '$';
  return sign + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function pct(v) {
  if (v === null || v === undefined) return '—';
  const cls = v >= 0 ? 'up' : 'down';
  return `<span class="${cls}">${v >= 0 ? '+' : ''}${v.toFixed(1)}%</span>`;
}
function ageLabel(days) {
  if (days === null) return '—';
  if (days < 60) return `${days}d`;
  if (days < 730) return `${(days / 30.44).toFixed(1)}mo`;
  return `${(days / 365.25).toFixed(1)}y`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** The verdict math, exactly as the model section states it. */
function verdict(row, deposit) {
  const pool = row.implied_value_usd * R.farmer_share;
  const crowd = Math.max(row.tvl_usd * R.crowd_share_of_tvl, deposit);
  const slice = pool * (deposit / (deposit + crowd));
  const opportunity = deposit * R.tbill_annual * (row.weeks / 52);
  const costs = row.fees_usd + opportunity;
  const net = slice - costs;
  const kind = slice >= 2 * costs ? 'FARM' : net > 0 ? 'THIN' : 'SKIP';
  return { pool, crowd, slice, opportunity, costs, net, kind };
}

function renderFacts() {
  const f = [
    ['Snapshot', R.as_of],
    ['Protocols read', R.protocol_count],
    ['Ranked here', rows.length],
    ['Set aside', R.set_aside.length],
    ['Watchlist ranked', `${rows.filter((r) => r.watchlist).length}/${R.watchlist_size}`],
    ['Traded peers fitted', R.curve.fitted_on],
  ];
  els.facts.innerHTML = f.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('');
  const h = R.holdout;
  const modelX = Math.exp(h.model_median_miss);
  const baseX = Math.exp(h.baseline_median_miss);
  els.grade.innerHTML =
    `<strong>Graded out of sample.</strong> The curve and adjustments were refitted on ` +
    `${h.fitted_on} traded protocols and used to price ${h.priced} others the fit never saw: ` +
    `the typical price lands within <span class="big">&times;${modelX.toFixed(2)}</span> of the actual ` +
    `market cap, against <span class="big">&times;${baseX.toFixed(2)}</span> for the flat TVL multiple ` +
    `(${'$'}1 of TVL = ${dollars(h.flat_multiple)} of cap) on the same unseen half. ` +
    `The curve fitted on all ${R.curve.fitted_on} traded protocols runs cap &asymp; TVL<sup>${R.curve.b.toFixed(2)}</sup>.`;
  const top = R.categories.slice(0, 10);
  els.multiples.innerHTML =
    `<table class="mini"><thead><tr><th>Category</th><th class="num">Traded peers</th>` +
    `<th class="num">Adjustment</th><th class="num">Pre-token protocols</th></tr></thead><tbody>` +
    top.map((c) => `<tr><td>${esc(c.category)}</td><td class="num">${c.peers}</td>` +
      `<td class="num">&times;${c.adj.toFixed(3)}</td><td class="num">${c.pre_token}</td></tr>`).join('') +
    `</tbody></table>`;
  const names = R.set_aside.slice(0, 6).map((s) => s.name).join(' · ');
  els.aside.innerHTML =
    `<strong>${R.set_aside.length} protocols are set aside and none is ranked</strong> — ` +
    `${esc(names)} and ${Math.max(0, R.set_aside.length - 6)} more: exchanges and their products, ` +
    `canonical bridges, wrapped or staked forms of tokens that already trade, and versioned ` +
    `successors. Each carries its reason in the data file; the board ranks only protocols that ` +
    `could plausibly launch a first token of their own.`;
}

function fillFilters() {
  const cats = [...new Set(rows.map((r) => r.category).filter(Boolean))].sort();
  els.category.innerHTML = '<option value="">All categories</option>' + cats.map((c) => `<option>${esc(c)}</option>`).join('');
  const chains = [...new Set(rows.flatMap((r) => r.chains))].sort();
  els.chain.innerHTML = '<option value="">All chains</option>' + chains.map((c) => `<option>${esc(c)}</option>`).join('');
}

function currentRows() {
  const q = els.search.value.trim().toLowerCase();
  const cat = els.category.value;
  const chain = els.chain.value;
  const want = els.verdict.value;
  const deposit = Number(els.deposit.value);
  let list = rows.filter((r) =>
    (q === '' || r.name.toLowerCase().includes(q) || r.slug.includes(q)) &&
    (cat === '' || r.category === cat) &&
    (chain === '' || r.chains.includes(chain)) &&
    (!els.watch.checked || r.watchlist));
  const withV = list.map((r) => ({ r, v: verdict(r, deposit) }));
  const filtered = want === '' ? withV : withV.filter((x) => x.v.kind === want);
  const sort = els.sort.value;
  if (sort === 'net') filtered.sort((a, b) => b.v.net - a.v.net);
  else if (sort === 'tvl') filtered.sort((a, b) => b.r.tvl_usd - a.r.tvl_usd);
  else if (sort === 'odds') filtered.sort((a, b) => b.r.launch_odds - a.r.launch_odds);
  else if (sort === 'growth') filtered.sort((a, b) => (b.r.change_7d ?? -999) - (a.r.change_7d ?? -999));
  else filtered.sort((a, b) => a.r.rank - b.r.rank);
  return filtered;
}

function render() {
  const deposit = Number(els.deposit.value);
  const list = currentRows();
  els.count.textContent = `${list.length} of ${rows.length} protocols · deposit ${dollars(deposit)}`;
  els.body.innerHTML = list.map(({ r, v }) => `
    <tr data-slug="${esc(r.slug)}">
      <td class="num">${r.rank}</td>
      <td><span class="name">${esc(r.name)}</span><span class="slug">${esc(r.slug)}</span></td>
      <td>${esc(r.category ?? '—')}</td>
      <td class="num">${r.chains.length}</td>
      <td class="num">${money(r.tvl_usd)}</td>
      <td class="num">${pct(r.change_7d)}</td>
      <td class="num">${ageLabel(r.age_days)}</td>
      <td class="num">${Math.round(r.launch_odds * 100)}%</td>
      <td class="num implied">${money(r.implied_value_usd)}</td>
      <td class="verdict"><span class="v-${v.kind.toLowerCase()}">${v.kind}</span> <span class="net">${v.net >= 0 ? '+' : ''}${dollars(v.net)} · ${dollars(r.fees_usd)} fees · ${r.minutes} min</span>${r.watchlist ? ' <span class="watch">★</span>' : ''}</td>
    </tr>`).join('');
  for (const tr of els.body.querySelectorAll('tr')) {
    tr.addEventListener('click', () => openDetail(tr.dataset.slug));
  }
}

function bar(label, factor, display, logScale) {
  const width = logScale
    ? Math.max(3, Math.min(100, (Math.log10(Math.max(factor, 0.001)) + 2) / 3 * 100))
    : Math.max(3, Math.min(100, factor * 100));
  const dim = factor < 0.999 ? ' dim' : '';
  return `<div class="bar-row"><span class="lbl">${esc(label)}</span>` +
    `<span class="bar-track"><span class="bar-fill${dim}" style="width:${width.toFixed(0)}%;display:block"></span></span>` +
    `<span class="val">${esc(display)}</span></div>`;
}

function openDetail(slug) {
  const r = bySlug.get(slug);
  if (!r) return;
  const deposit = Number(els.deposit.value);
  const v = verdict(r, deposit);
  const peers = (R.peers_by_category[r.category ?? ''] ?? []).slice(0, 4);
  const bars =
    bar('TVL anchor', 1, money(r.tvl_usd), false) +
    bar('size curve', r.curve_value_usd / r.tvl_usd, `→ ${money(r.curve_value_usd)}`, true) +
    bar('× category adj', r.category_adj, `×${r.category_adj.toFixed(3)}`, true) +
    bar('× launch odds', r.launch_odds, `${Math.round(r.launch_odds * 100)}% of look-alikes`, false) +
    bar('× growth, 7d', r.growth_factor, `×${r.growth_factor.toFixed(3)}`, true) +
    bar('× breadth', r.breadth_factor, `×${r.breadth_factor.toFixed(3)} (${r.chains.length} chains)`, true);
  const math =
    `<div><span>Farmer pool (8% of implied)</span><span>${dollars(v.pool)}</span></div>` +
    `<div><span>Your ${dollars(deposit)} against expected crowd</span><span>${dollars(v.crowd)}</span></div>` +
    `<div><span>Expected slice</span><span>${dollars(v.slice)}</span></div>` +
    `<div><span>Fees over ${r.weeks} weeks</span><span>−${dollars(r.fees_usd)}</span></div>` +
    `<div><span>T-bill yield given up (4%)</span><span>−${dollars(v.opportunity)}</span></div>` +
    `<div class="total"><span>Net if it launches at the implied value</span><span class="v-${v.kind.toLowerCase()}">${v.kind} ${v.net >= 0 ? '+' : ''}${dollars(v.net)}</span></div>`;
  const plan = r.steps_detail.map((s) =>
    `<tr><td class="when">${esc(s.when)}</td><td>${esc(s.text)}</td>` +
    `<td class="num">${s.cost_usd ? dollars(s.cost_usd) : '—'}</td><td class="num">${s.minutes} min</td></tr>`).join('');
  const peerRows = peers.length === 0 ? '<p class="sub">No traded peers in this category in the snapshot.</p>' :
    `<table class="mini"><thead><tr><th>Protocol</th><th class="num">Market cap</th><th class="num">TVL</th><th class="num">Cap / TVL</th></tr></thead><tbody>` +
    peers.map((p) => `<tr><td>${esc(p.name)}${p.symbol ? ` (${esc(p.symbol)})` : ''}</td>` +
      `<td class="num">${money(p.mcap_usd)}</td><td class="num">${money(p.tvl_usd)}</td>` +
      `<td class="num">${p.ratio.toFixed(3)}</td></tr>`).join('') + `</tbody></table>`;
  els.detail.innerHTML = `
    <button class="close" id="d-close">Close ×</button>
    <h2>#${r.rank} ${esc(r.name)}${r.watchlist ? ' <span class="watch">★ watchlist</span>' : ''}</h2>
    <div class="sub">${esc(r.category ?? 'Uncategorised')} · ${esc(r.chains.slice(0, 10).join(', '))}${r.chains.length > 10 ? ` +${r.chains.length - 10} more` : ''} · TVL ${money(r.tvl_usd)} · records no token in the snapshot</div>
    <div class="cols">
      <div>
        <h4>How the ${money(r.implied_value_usd)} is built</h4>
        ${bars}
        <h4>Traded peers the adjustment came from</h4>
        ${peerRows}
      </div>
      <div>
        <h4>Farm verdict at a ${dollars(deposit)} deposit</h4>
        <div class="math">${math}</div>
        <h4>Farm plan — ${r.weeks} weeks, ${dollars(r.fees_usd)} of fees, ${r.minutes} minutes of work</h4>
        <table class="plan"><thead><tr><th>When</th><th>Step</th><th class="num">Cost</th><th class="num">Time</th></tr></thead><tbody>${plan}</tbody></table>
      </div>
    </div>`;
  els.detail.hidden = false;
  $('d-close').addEventListener('click', () => { els.detail.hidden = true; });
  els.detail.scrollIntoView({ block: 'nearest' });
}

for (const el of [els.search, els.category, els.chain, els.verdict, els.deposit, els.sort, els.watch]) {
  el.addEventListener('input', render);
}
renderFacts();
fillFilters();
render();
if (location.hash.length > 1) openDetail(location.hash.slice(1));
