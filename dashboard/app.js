// Token Launch Radar dashboard: a static page over window.RADAR (data.js, written by main.ts from
// the same board as board.json). No fetch, no network, no framework. The farm plans below are
// generated from each row's own record with the same playbook lib/model.ts uses for board.json,
// so what a reader sees in a detail view is what the board handed in.
(function () {
  'use strict';
  var DATA = window.RADAR;
  var main = document.getElementById('board');
  var method = document.getElementById('method');
  var state = { tab: 'board', q: '', category: 'all', chain: 'all', conf: 'all', wl: false, sort: 'rank', dir: 1, detail: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtUsd(n) {
    if (n == null) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(n) { return n == null ? '—' : (n > 0 ? '+' : '') + (Math.round(n * 10) / 10) + '%'; }
  function fmtAge(d) {
    if (d == null) return 'unknown';
    if (d < 30) return d + 'd';
    if (d < 365) return Math.round(d / 30.4) + ' mo';
    return (Math.round(d / 36.5) / 10) + ' yr';
  }
  function fmtMult(n) { return '×' + (Math.round(n * 100) / 100); }

  // ---- farm plan playbook (mirrors lib/model.ts) ----
  function chainOf(r) { return r.chains && r.chains.length ? r.chains[0] : 'its main chain'; }
  function capitalFor(r) { return r.tvl_usd >= 5e9 ? 250 : r.tvl_usd >= 1e9 ? 150 : r.tvl_usd >= 1e8 ? 100 : 50; }
  function holdDaysFor(age) { return age == null ? 45 : age < 180 ? 60 : age < 365 ? 45 : 30; }
  function actionFor(r, capital, chain) {
    var c = (r.category || '').toLowerCase(), n = r.name;
    if (c.indexOf('lend') >= 0) return 'Supply $' + capital + ' of USDC to ' + n + ' on ' + chain + ' so the wallet appears as a lender in its markets.';
    if (c.indexOf('cdp') >= 0) return 'Open a $' + capital + ' collateral position on ' + n + ' on ' + chain + ' and mint a small amount of its debt asset.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('restak') >= 0) return 'Stake $' + capital + " of the chain's native asset through " + n + ' on ' + chain + ' and keep the staking receipt in the wallet.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('canonical') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + n + ', then use the bridged funds in one app on the far side.';
    if (c.indexOf('dex') >= 0) return 'Provide $' + capital + ' of liquidity to ' + n + "'s most active pair on " + chain + ' and leave the position open.';
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + n + ' and open one small hedged trade, then close it a day later.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Deposit $' + capital + ' into a ' + n + ' vault on ' + chain + ' and hold the vault shares it issues.';
    if (c.indexOf('rwa') >= 0) return 'Mint $' + capital + ' of ' + n + "'s yield-bearing asset on " + chain + ' after its onboarding check, and hold it.';
    if (c.indexOf('basis') >= 0) return 'Open the $' + capital + ' hedged position ' + n + ' offers on ' + chain + ' (long spot, short perp in one flow) and keep both legs.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and take one position in a liquid market on ' + n + ', then let it settle.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + n + ' on ' + chain + ' for one month and keep the policy NFT.';
    if (c.indexOf('yield') >= 0) return 'Deposit $' + capital + ' of USDC into ' + n + ' on ' + chain + ' and keep the yield position open.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + n + ' on ' + chain + ' and hold it in the wallet.';
    return 'Deposit $' + capital + ' of USDC into ' + n + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(r, chain) {
    var c = (r.category || '').toLowerCase(), n = r.name;
    if (c.indexOf('lend') >= 0) return 'Borrow a small amount against the supply on ' + n + ', repay it within a week, and keep the borrow history clean.';
    if (c.indexOf('cdp') >= 0) return 'Repay part of the minted debt on ' + n + ' and top the collateral up once, so the position shows management, not a single touch.';
    if (c.indexOf('liquid staking') >= 0 || c.indexOf('restak') >= 0) return 'Use the staking receipt from ' + n + ' in one integrated app it lists (a lending market or vault) instead of leaving it idle.';
    if (c.indexOf('bridge') >= 0 || c.indexOf('canonical') >= 0) return 'Bridge a smaller amount back through ' + n + ' a week later, so the wallet shows two-way use rather than a one-way hop.';
    if (c.indexOf('dex') >= 0) return "Make two swaps through " + n + "'s own interface on " + chain + ' on different days, separate from the liquidity position.';
    if (c.indexOf('derivative') >= 0 || c.indexOf('perpetual') >= 0) return 'Place one limit order on ' + n + ' and let it fill, so the wallet records both order types.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0) return 'Move a quarter of the position to a second ' + n + ' vault with a different strategy, keeping both open.';
    if (c.indexOf('rwa') >= 0) return 'Redeem a small slice of the ' + n + ' asset once, then re-mint it, so both directions appear in the wallet\u2019s history.';
    if (c.indexOf('basis') >= 0) return 'Rebalance the ' + n + ' hedge once after a funding-rate change, keeping the pair delta-neutral.';
    if (c.indexOf('prediction') >= 0) return 'Take a second position on the opposite side of a different ' + n + ' market, sized at half the first.';
    if (c.indexOf('yield') >= 0) return 'Harvest the yield ' + n + ' shows once and restake it into the same position instead of withdrawing it.';
    return 'Repeat the main action on ' + n + ' with a quarter of the first amount, a week later, so the history shows a pattern.';
  }
  function farmSteps(r) {
    var chain = chainOf(r), capital = capitalFor(r), hold = holdDaysFor(r.age_days);
    var gas = chain === 'Ethereum' ? 'about $6-12 of ETH gas per transaction on Ethereum mainnet' : 'about $1-3 of gas per transaction on ' + chain;
    var multi = r.chains.length > 1 ? ' It also runs on ' + r.chains[1] + ', where a second, smaller position doubles the footprint.' : '';
    return [
      { text: 'Start from a fresh wallet funded only with the farm amount, and reach ' + r.name + ' only through the link on its official site or its DefiLlama page — never through a search ad or a DM.', cost: 'under $3 to fund and make the first transaction', time: '10 minutes' },
      { text: actionFor(r, capital, chain), cost: '$' + capital + ' of capital, ' + gas, time: '15 minutes to set up' },
      { text: secondActionFor(r, chain) + multi, cost: 'about a quarter of the first position, ' + gas, time: '10 minutes, one week after step 2' },
      { text: 'Repeat one qualifying action on ' + r.name + ' every week — a deposit, a swap, a vote or a claim — so the wallet reads as a user, not a one-time visitor.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days: ' + r.name + ' has run ' + (r.age_days == null ? 'an unrecorded span' : r.age_days + ' days') + ' with no token, and snapshots that count farmers usually span months, not days.', cost: 'the $' + capital + ' stays in the position and carries its smart-contract risk', time: hold + ' days' },
      { text: 'Check ' + r.name + "'s own app and announcements for a points or rewards page every two weeks. If one exists, enrol from inside the app; if a site ever asks you to pay to \u201cclaim\u201d an airdrop, it is a scam — close it.", cost: 'nothing to check; never pay to claim', time: '5 minutes every two weeks' },
      { text: 'Keep a farm log (wallet, dates, amounts, transaction hashes) and set an exit rule now: withdraw if ' + r.name + "'s TVL falls by half, if its contracts are paused, or when you no longer want the position — token or no token.", cost: 'nothing but the log', time: '5 minutes to set up, reviewed monthly' }
    ];
  }

  // ---- header stats ----
  function renderStats() {
    var elx = document.getElementById('stats');
    var totalImplied = DATA.rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    elx.innerHTML =
      stat(DATA.board_size, 'pre-token ranked') + stat(DATA.watchlist_size + ' / ' + DATA.watchlist_size, 'watchlist covered') +
      stat(DATA.early_size, 'early finds below $50M') + stat(fmtUsd(totalImplied), 'total implied value') +
      stat(DATA.as_of, 'snapshot date');
    document.getElementById('provenance').textContent =
      'Source: ' + DATA.source + ' · Model ' + DATA.model_version + ' · Dashboard generated from the sealed snapshot; no network, no tracking, no live prices.';
    function stat(v, l) { return '<div class="stat"><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; }
  }

  // ---- board ----
  function filtered() {
    return DATA.rows.filter(function (r) {
      if (state.wl && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Uncategorized') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.conf !== 'all' && r.confidence !== state.conf) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function sorted(list) {
    var k = state.sort, d = state.dir;
    if (k === 'rank') return list;
    return list.slice().sort(function (a, b) {
      var x = a[k], y = b[k];
      if (x == null) return 1; if (y == null) return -1;
      return (x < y ? -1 : x > y ? 1 : 0) * d;
    });
  }
  function th(key, label, cls) {
    var arrow = state.sort === key ? (state.dir === 1 ? ' ↑' : ' ↓') : '';
    return '<th class="' + (cls || '') + '"><button type="button" data-sort="' + key + '">' + label + arrow + '</button></th>';
  }
  function renderBoard() {
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Uncategorized'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains); }, []))).sort();
    var list = sorted(filtered());
    var h = '<div class="controls">' +
      '<input type="search" id="q" placeholder="Search protocols…" value="' + esc(state.q) + '" aria-label="Search protocols">' +
      sel('cat', 'Category', ['all'].concat(cats), state.category, 'All categories') +
      sel('chn', 'Chain', ['all'].concat(chains), state.chain, 'All chains') +
      sel('cnf', 'Confidence', ['all', 'high', 'medium', 'low'], state.conf, 'Any confidence') +
      '<label><input type="checkbox" id="wl"' + (state.wl ? ' checked' : '') + '> Watchlist only</label>' +
      '</div>' +
      '<p class="count">' + list.length + ' of ' + DATA.rows.length + ' pre-token protocols · ranked by implied value · click a row for its farm plan</p>';
    if (!list.length) { main.innerHTML = h + '<div class="empty">No protocol matches those filters. <button type="button" class="tab" id="clr">Clear filters</button></div>'; wireControls(); return; }
    h += '<table><thead><tr>' + th('rank', '#') + '<th>Protocol</th>' + th('tvl_usd', 'TVL', 'num') +
      '<th class="num hideS">7d</th><th class="num hideS">Tokenless</th><th class="num hideS">Peer ×</th>' +
      th('implied_value_usd', 'Implied value', 'num') + '<th>Confidence</th></tr></thead><tbody>';
    list.forEach(function (r) {
      var chg = r.change_7d == null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
      h += '<tr data-slug="' + esc(r.slug) + '" tabindex="0"><td class="num">' + r.rank + '</td>' +
        '<td><span class="pname">' + esc(r.name) + '</span>' + (r.watchlist ? ' <span class="chip wl">watchlist</span>' : '') +
        '<br><span class="pmeta">' + esc(r.category || 'Uncategorized') + ' · ' + esc(r.chains.slice(0, 3).join(', ') || '—') + '</span></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num hideS ' + chg + '">' + fmtPct(r.change_7d) + '</td>' +
        '<td class="num hideS">' + fmtAge(r.age_days) + '</td><td class="num hideS">' + fmtMult(r.peer_multiple) + '</td>' +
        '<td class="num"><b>' + fmtUsd(r.implied_value_usd) + '</b></td>' +
        '<td><span class="conf ' + r.confidence + '">' + r.confidence + '</span></td></tr>';
    });
    main.innerHTML = h + '</tbody></table>';
    wireControls();
    Array.prototype.forEach.call(main.querySelectorAll('tbody tr'), function (tr) {
      function open() { state.detail = tr.getAttribute('data-slug'); location.hash = '#/p/' + state.detail; render(); }
      tr.addEventListener('click', open);
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
    function sel(id, label, opts, cur, allLabel) {
      var o = opts.map(function (v) {
        return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(v === 'all' ? allLabel : v) + '</option>';
      }).join('');
      return '<select id="' + id + '" aria-label="' + label + '">' + o + '</select>';
    }
  }
  function wireControls() {
    var q = document.getElementById('q');
    if (q) q.addEventListener('input', function () { state.q = q.value; renderBoardKeepFocus(); });
    var cat = document.getElementById('cat'); if (cat) cat.addEventListener('change', function () { state.category = cat.value; render(); });
    var chn = document.getElementById('chn'); if (chn) chn.addEventListener('change', function () { state.chain = chn.value; render(); });
    var cnf = document.getElementById('cnf'); if (cnf) cnf.addEventListener('change', function () { state.conf = cnf.value; render(); });
    var wl = document.getElementById('wl'); if (wl) wl.addEventListener('change', function () { state.wl = wl.checked; render(); });
    var clr = document.getElementById('clr'); if (clr) clr.addEventListener('click', function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.conf = 'all'; state.wl = false; render(); });
    Array.prototype.forEach.call(main.querySelectorAll('[data-sort]'), function (b) {
      b.addEventListener('click', function () {
        var k = b.getAttribute('data-sort');
        if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = -1; }
        render();
      });
    });
  }
  function renderBoardKeepFocus() {
    var pos = document.getElementById('q').selectionStart;
    renderBoard();
    var q2 = document.getElementById('q'); q2.focus(); q2.setSelectionRange(pos, pos);
  }

  // ---- detail ----
  function flags(r) {
    var f = [];
    if (r.change_7d != null && r.change_7d <= -10) f.push('Shrinking: TVL fell ' + fmtPct(r.change_7d) + ' in the last 7 days of the snapshot — momentum is against this row.');
    if (r.age_days != null && r.age_days < 90) f.push('Very young: ' + r.age_days + ' days on the index. Young protocols carry the highest contract and team risk.');
    if (r.age_days == null) f.push('No listing date in the snapshot: the maturity factor used the model\u2019s 180-day default, so treat the rank as softer.');
    if (r.chains.length <= 1) f.push('Single-chain: the whole position sits on ' + chainOf(r) + '; a chain incident is a position incident.');
    if (r.confidence === 'low') f.push('Low confidence: few trading peers in ' + (r.category || 'its category') + ' or missing figures — the peer multiple is mostly the global median.');
    if (r.change_7d == null) f.push('No 7-day TVL change in the snapshot: the growth factor read as neutral (×1.00).');
    return f;
  }
  function bar(label, val, max, shown) {
    var pct = Math.max(2, Math.min(100, (val / max) * 100));
    return '<div class="factor"><span>' + esc(label) + '</span><span class="bar"><span class="fill" style="display:block;width:' + pct + '%"></span></span><span class="val">' + esc(shown) + '</span></div>';
  }
  function renderDetail(r) {
    var catStat = DATA.categories.filter(function (c) { return c.category === (r.category || 'Uncategorized'); })[0];
    var steps = farmSteps(r);
    var h = '<button type="button" class="back" id="back">← Back to the board</button><div class="detail">' +
      '<p class="kicker">Rank #' + r.rank + ' · ' + esc(r.category || 'Uncategorized') + (r.watchlist ? ' · on the $50M watchlist' : ' · early find below the $50M floor') + '</p>' +
      '<h2>' + esc(r.name) + '</h2>' +
      '<p class="pmeta">' + esc(r.chains.join(', ') || 'No chains recorded') + ' · listed ' + esc(r.listed_at || 'date unknown') + ' · slug ' + esc(r.slug) + '</p>' +
      '<div class="kv">' +
      kv(fmtUsd(r.implied_value_usd), 'implied value') + kv(fmtUsd(r.tvl_usd), 'TVL') +
      kv(fmtPct(r.change_7d), 'TVL change 7d') + kv(fmtAge(r.age_days), 'running tokenless') +
      kv(r.peer_count + ' peers', 'category calibration') + kv(r.confidence, 'confidence') + '</div>' +
      '<h3>Why this value</h3><div class="factors">' +
      bar('TVL base', r.tvl_usd, DATA.rows[0].tvl_usd, fmtUsd(r.tvl_usd)) +
      bar('Peer multiple (' + (r.category || 'global') + ')', r.peer_multiple, 1.5, fmtMult(r.peer_multiple)) +
      bar('Growth factor', r.growth_multiplier, 1.6, fmtMult(r.growth_multiplier)) +
      bar('Maturity factor', r.maturity_multiplier, 1.0, fmtMult(r.maturity_multiplier)) +
      '</div>' +
      '<p class="pmeta">' + fmtUsd(r.tvl_usd) + ' × ' + fmtMult(r.peer_multiple) + ' × ' + fmtMult(r.growth_multiplier) + ' × ' + fmtMult(r.maturity_multiplier) +
      ' = <b>' + fmtUsd(r.implied_value_usd) + '</b>. The peer multiple is the shrunk median market-cap/TVL of ' + r.peer_count +
      ' trading protocols in ' + esc(r.category || 'this category') + (catStat ? ' (' + r.peer_count + ' peers; ' + catStat.pre_token_count + ' pre-token protocols share the category)' : '') +
      '; the snapshot-wide median is ' + fmtMult(DATA.global_multiple) + '.</p>';
    var fl = flags(r);
    if (fl.length) h += '<h3>Risk flags</h3><ul class="flags">' + fl.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
    h += '<h3>Farm plan — seven steps</h3><ol class="steps">' + steps.map(function (s) {
      return '<li>' + esc(s.text) + '<span class="meta">Cost: ' + esc(s.cost) + ' · Time: ' + esc(s.time) + '</span></li>';
    }).join('') + '</ol>' +
      '<p class="pmeta">Generic playbook from this record\u2019s category, chains, size and age. A plan is not a promise: most protocols on this board will never issue a token, and none of this is financial advice.</p></div>';
    main.innerHTML = h;
    document.getElementById('back').addEventListener('click', function () { state.detail = null; location.hash = ''; render(); });
    window.scrollTo(0, 0);
  }

  // ---- live ----
  function renderLive() {
    var h = '<p class="count">' + DATA.live.length + ' largest live-token protocols by market cap — set aside, shown at the market\u2019s own values. These calibrate the peer multiples; the model never ranks them.</p>' +
      '<table><thead><tr><th>Protocol</th><th class="num">Market cap</th><th class="num">TVL</th><th class="num hideS">Mcap / TVL</th><th class="num hideS">7d</th></tr></thead><tbody>';
    DATA.live.forEach(function (r) {
      h += '<tr><td><span class="pname">' + esc(r.name) + '</span><br><span class="pmeta">' + esc(r.category || 'Uncategorized') + ' · ' + esc(r.chains.slice(0, 3).join(', ')) + '</span></td>' +
        '<td class="num">' + fmtUsd(r.mcap_usd) + '</td><td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num hideS">' + (r.mcap_usd && r.tvl_usd ? fmtMult(r.mcap_usd / r.tvl_usd) : '—') + '</td>' +
        '<td class="num hideS">' + fmtPct(r.change_7d) + '</td></tr>';
    });
    main.innerHTML = h + '</tbody></table>';
  }

  // ---- model ----
  function renderModel() {
    method.hidden = false;
    var old = document.getElementById('catstats');
    if (old) old.remove();
    var div = document.createElement('div');
    div.id = 'catstats';
    var h = '<h2>Category calibration, computed from this snapshot</h2><p>The multiple each category\u2019s pre-token rows are priced with, the trading peers behind it, and how many pre-token protocols it prices. Global median multiple: <strong>' + fmtMult(DATA.global_multiple) + '</strong>.</p>' +
      '<table class="cat-table"><thead><tr><th>Category</th><th>Peer multiple</th><th>Trading peers</th><th>Pre-token rows</th></tr></thead><tbody>';
    DATA.categories.forEach(function (c) {
      h += '<tr><td>' + esc(c.category) + '</td><td>' + fmtMult(c.peer_multiple) + '</td><td>' + c.peer_count + '</td><td>' + c.pre_token_count + '</td></tr>';
    });
    div.innerHTML = h + '</tbody></table>';
    method.appendChild(div);
  }

  // ---- shell ----
  function kv(v, l) { return '<div class="stat"><b>' + esc(v) + '</b><span>' + esc(l) + '</span></div>'; }
  function render() {
    method.hidden = true;
    if (state.tab === 'live') { renderLive(); return; }
    if (state.tab === 'model') { main.innerHTML = ''; renderModel(); return; }
    if (state.detail) {
      var r = DATA.rows.filter(function (x) { return x.slug === state.detail; })[0];
      if (r) { renderDetail(r); return; }
      state.detail = null;
    }
    renderBoard();
  }
  Array.prototype.forEach.call(document.querySelectorAll('.tab[data-tab]'), function (b) {
    b.addEventListener('click', function () {
      state.tab = b.getAttribute('data-tab');
      Array.prototype.forEach.call(document.querySelectorAll('.tab[data-tab]'), function (x) { x.classList.toggle('active', x === b); });
      render();
    });
  });
  var m = /#\/p\/(.+)$/.exec(location.hash || '');
  if (m) state.detail = decodeURIComponent(m[1]);
  renderStats();
  render();
})();
