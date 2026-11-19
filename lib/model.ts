// Token launch radar — the model (fifth build).
//
// Everything is derived from the sealed snapshot and from nothing
// else: no names are scored, no list is hardcoded, and every number
// on the page can be traced to a field of the snapshot or to a fit
// this file computes from it, in the open.
//
// A protocol that records no token is priced in four moves.
//
// 1. THE CURVE. On the protocols whose token already trades, fit a
//    power curve of market cap against TVL (least squares in log
//    space). A category adjustment follows: the median ratio between
//    a traded protocol's actual cap and its curve price, per
//    category, shrunk toward 1 for thin categories.
// 2. LAUNCH ODDS. From the same cross-section: among protocols
//    DefiLlama has tracked for about as long, the share that record
//    a token today, by age cohort and category. A young protocol is
//    priced on the chance its look-alikes ever launched at all.
// 3. THE REST OF THE RECORD. Seven-day growth at half weight, and a
//    small step per chain, as before.
// 4. SET ASIDE, NOT RANKED. Shapes that do not launch a token of
//    their own — exchanges and their products, canonical bridges,
//    wrapped or staked forms of a token that already trades,
//    versioned successors — leave the board entirely and are listed
//    as set aside, with the reason. The snapshot's watchlist is
//    never set aside: its own rule already keeps those shapes off.
//
// The farm column is a verdict, not a slogan. For a deposit the
// reader picks, the expected slice is the farmer pool (8% of the
// implied value, the share of a launch a farming crowd can plausibly
// earn) times the deposit's share of the capital expected to chase
// it (assumed at 1% of TVL). Net of estimated fees and of a 4%
// T-bill yield on the deposit for the plan's duration: FARM when the
// slice clears twice the costs, THIN when it merely clears them,
// SKIP when it does not. Every figure in that sentence is printed on
// the page, so the reader can disagree with the inputs, not just
// the answer.
//
// The fits are graded in the open: the traded protocols are split in
// two by a hash of the slug, the curve and adjustments are fitted on
// one half and priced on the other, and the board prints the median
// miss next to the flat-TVL-multiple baseline's miss on the same
// unseen half. A model that cannot price the tokens that exist has
// no business pricing the ones that do not.

export interface Protocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: Protocol[];
  watchlist: string[];
}

export interface FarmStep {
  when: string;
  text: string;
  cost_usd: number;
  minutes: number;
}

export interface ScoredRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  curve_value_usd: number;
  category_adj: number;
  launch_odds: number;
  growth_factor: number;
  breadth_factor: number;
  steps_detail: FarmStep[];
  fees_usd: number;
  minutes: number;
  weeks: number;
}

export interface SetAside {
  slug: string;
  name: string;
  tvl_usd: number;
  reason: string;
}

export interface CategoryStat {
  category: string;
  peers: number;
  adj: number;
  pre_token: number;
}

export interface Peer {
  name: string;
  symbol: string | null;
  mcap_usd: number;
  tvl_usd: number;
  ratio: number;
}

export interface Holdout {
  fitted_on: number;
  priced: number;
  model_median_miss: number;
  baseline_median_miss: number;
  flat_multiple: number;
}

export interface Radar {
  as_of: string;
  floor_usd: number;
  watchlist_size: number;
  protocol_count: number;
  live_size: number;
  rows: ScoredRow[];
  set_aside: SetAside[];
  categories: CategoryStat[];
  peers_by_category: Record<string, Peer[]>;
  curve: { a: number; b: number; fitted_on: number };
  holdout: Holdout;
  farmer_share: number;
  crowd_share_of_tvl: number;
  tbill_annual: number;
}

export function parseSnapshot(text: string): Snapshot {
  const raw = JSON.parse(text) as Snapshot;
  if (!Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist)) {
    throw new Error('snapshot: protocols and watchlist must be arrays');
  }
  return raw;
}

const DAY_MS = 86_400_000;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

function ageDays(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const days = Math.round((Date.parse(asOf) - Date.parse(listedAt)) / DAY_MS);
  return days >= 0 ? days : null;
}

/** Least-squares fit of log(mcap) on log(TVL) over the traded protocols given. */
function fitCurve(traded: Protocol[]): { a: number; b: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of traded) {
    if (p.tvl_usd <= 0 || p.mcap_usd === null || p.mcap_usd <= 0) continue;
    xs.push(Math.log(p.tvl_usd));
    ys.push(Math.log(p.mcap_usd));
  }
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  const b = sxx === 0 ? 1 : sxy / sxx;
  return { a: my - b * mx, b };
}

function curvePrice(curve: { a: number; b: number }, tvl: number): number {
  return Math.exp(curve.a) * Math.pow(tvl, curve.b);
}

/** Median actual/curve ratio per category, shrunk toward 1 by eight phantom peers at 1 and clamped to a sane band. */
function categoryAdjustments(traded: Protocol[], curve: { a: number; b: number }): Map<string, { adj: number; peers: number }> {
  const ratios = new Map<string, number[]>();
  for (const p of traded) {
    if (p.category === null || p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const list = ratios.get(p.category) ?? [];
    list.push(p.mcap_usd / curvePrice(curve, p.tvl_usd));
    ratios.set(p.category, list);
  }
  const out = new Map<string, { adj: number; peers: number }>();
  for (const [category, list] of ratios) {
    const own = median(list);
    const n = list.length;
    const shrunk = Math.exp((n * Math.log(own) + 8 * Math.log(1)) / (n + 8));
    out.set(category, { adj: clamp(shrunk, 0.3, 2.5), peers: n });
  }
  return out;
}

const AGE_COHORTS: { label: string; test: (days: number | null) => boolean }[] = [
  { label: 'under 6 months', test: (d) => d !== null && d < 182 },
  { label: '6-18 months', test: (d) => d !== null && d >= 182 && d < 548 },
  { label: '18 months-3 years', test: (d) => d !== null && d >= 548 && d < 1095 },
  { label: 'over 3 years', test: (d) => d !== null && d >= 1095 },
  { label: 'no listing date', test: (d) => d === null },
];

/**
 * Launch odds: for each age cohort, the share of protocols that
 * record a token today, blended 50/50 with the same share inside the
 * protocol's own category when the category cohort holds at least 8
 * protocols. Read as a cross-section, never as a prophecy.
 */
function launchOddsTable(snapshot: Snapshot): Map<string, number> {
  const key = (cohort: string, category: string | null) => `${cohort}|${category ?? ''}`;
  const counts = new Map<string, { withToken: number; total: number }>();
  const bump = (k: string, has: boolean) => {
    const c = counts.get(k) ?? { withToken: 0, total: 0 };
    c.total += 1;
    if (has) c.withToken += 1;
    counts.set(k, c);
  };
  for (const p of snapshot.protocols) {
    const age = ageDays(p.listed_at, snapshot.as_of);
    const cohort = AGE_COHORTS.find((c) => c.test(age))!.label;
    bump(key(cohort, null), p.mcap_usd !== null);
    bump(key(cohort, p.category), p.mcap_usd !== null);
  }
  const odds = new Map<string, number>();
  for (const cohort of AGE_COHORTS) {
    const global = counts.get(key(cohort.label, null))!;
    odds.set(key(cohort.label, null), global.withToken / global.total);
  }
  return odds;
}

function launchOdds(odds: Map<string, number>, counts: Map<string, { withToken: number; total: number }>, p: Protocol, asOf: string, globalShare: number): number {
  const age = ageDays(p.listed_at, asOf);
  const cohort = AGE_COHORTS.find((c) => c.test(age))!.label;
  const cohortCount = counts.get(`${cohort}|`)!;
  // Shrink the raw cohort share toward the snapshot-wide token share:
  // a cohort of a few hundred dead protocols should inform, not crush.
  const w = cohortCount.total / (cohortCount.total + 60);
  let value = w * odds.get(`${cohort}|`)! + (1 - w) * globalShare;
  const cat = counts.get(`${cohort}|${p.category ?? ''}`);
  if (cat !== undefined && cat.total >= 8) {
    const cw = cat.total / (cat.total + 24);
    value = 0.5 * value + 0.5 * (cw * (cat.withToken / cat.total) + (1 - cw) * value);
  }
  return Math.max(0.08, value);
}

const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitfinex', 'Gemini'];
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** Why a protocol is set aside instead of ranked, or null when it belongs on the board. */
function setAsideReason(p: Protocol): string | null {
  if (p.category === 'CEX' || EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) {
    return 'an exchange or its own product: its TVL is customer balances, and a house token is the exception, not the pattern';
  }
  if (p.category === 'Canonical Bridge' || p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') {
    return `${p.category.toLowerCase()}: a wrapped or staked form of value that already has a token behind it`;
  }
  if (WRAPPED_WORD.test(p.name)) return 'the name itself says wrapped or staked: the underlying asset already trades';
  if (p.category === 'Bridge' && p.chains.length <= 2) return 'a bridge on one or two chains: the shape of a canonical bridge for an asset that already trades';
  if (VERSION_SUFFIX.test(p.name)) return 'a versioned successor: the token, if any, belongs to the first version of the protocol';
  return null;
}

/** Deterministic split of the traded set for the holdout grade: even slug-hash half fits, odd half is priced. */
function slugParity(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h % 2;
}

function farmBudget(tvl: number): { gas: number; weeks: number } {
  if (tvl >= 1_000_000_000) return { gas: 42, weeks: 9 };
  if (tvl >= 100_000_000) return { gas: 27, weeks: 8 };
  if (tvl >= 10_000_000) return { gas: 16, weeks: 7 };
  return { gas: 10, weeks: 6 };
}

const CATEGORY_ACTIONS: Record<string, { text: string; minutes: number }[]> = {
  Dexs: [
    { text: 'Swap in both directions every week, varying the pairs and the size between $50 and $500 a trade, so the history reads as use and not as one script.', minutes: 25 },
    { text: 'Provide liquidity to one core pair and leave it in place; a position that survives a volatile week counts for more than one opened and closed in a day.', minutes: 15 },
  ],
  Lending: [
    { text: 'Supply a blue-chip collateral asset and keep it supplied; borrow a small amount against it, hold for some days, then repay in full and repeat the cycle.', minutes: 20 },
    { text: 'Keep the health factor above 2 at all times: a liquidation ends the farm and the record with it.', minutes: 5 },
  ],
  Bridge: [
    { text: 'Bridge funds in both directions every week, rotating the routes and the destination chains instead of repeating one corridor.', minutes: 30 },
    { text: 'Vary the amounts between $100 and $1,000 and sometimes leave the funds on the far side for a week before bridging back.', minutes: 10 },
  ],
  'Cross Chain Bridge': [
    { text: 'Bridge funds in both directions every week, rotating the routes and the destination chains instead of repeating one corridor.', minutes: 30 },
    { text: 'Vary the amounts between $100 and $1,000 and sometimes leave the funds on the far side for a week before bridging back.', minutes: 10 },
  ],
  'Liquid Staking': [
    { text: 'Stake a modest amount and hold the receipt token in the same wallet; unstaking within days reads as farming, holding reads as use.', minutes: 10 },
    { text: 'Put the receipt token to work in one integration the protocol points to, such as a lending market or a liquidity pool.', minutes: 15 },
  ],
  'Liquid Restaking': [
    { text: 'Restake a modest amount and hold the receipt position; restaked capital that stays put is the behaviour these protocols reward.', minutes: 10 },
    { text: 'Claim every reward the position earns and keep the claim history in the same wallet.', minutes: 5 },
  ],
  Yield: [
    { text: 'Deposit into two or three of its vaults rather than only the highest-yield one, and let the deposits season for at least a month.', minutes: 15 },
    { text: 'Claim rewards as they accrue and restake a part of them, so the wallet shows a compounding user and not a passer-by.', minutes: 10 },
  ],
  'Yield Aggregator': [
    { text: 'Deposit into two or three vaults rather than only the highest-yield one, and let the deposits season for at least a month.', minutes: 15 },
    { text: 'Move one deposit between vaults once a month at most: rotation is use, churn is noise.', minutes: 10 },
  ],
  RWA: [
    { text: 'Complete any onboarding or KYC the product offers and hold a position in one of its tokenised assets for a full quarter.', minutes: 30 },
    { text: 'Use the asset the way it is meant to be used: hold to maturity where there is one, or trade it in its own market.', minutes: 10 },
  ],
  'Basis Trading': [
    { text: 'Open a small hedged position in its main market and roll it as it settles instead of closing the record after one trade.', minutes: 20 },
    { text: 'Keep margin posted through a volatile week; positions that survive volatility are the ones a points program can see.', minutes: 5 },
  ],
  CDP: [
    { text: 'Mint its stablecoin against a blue-chip collateral deposit and hold part of the minted amount in the wallet; repay and re-mint on a monthly cycle.', minutes: 15 },
    { text: 'Keep the collateral ratio well above the liquidation line at all times: a liquidation ends the farm and the record with it.', minutes: 5 },
  ],
  Derivatives: [
    { text: 'Trade small perpetual positions on a weekly rhythm, opening and closing in both directions, and keep margin posted between sessions.', minutes: 20 },
    { text: 'Hold an open position through a volatile week at least once a month; programs weight wallets that bore real risk over wallets that only clicked.', minutes: 5 },
  ],
  Privacy: [
    { text: 'Make shielded transfers of varied size on a weekly rhythm, and let some funds sit shielded between them.', minutes: 15 },
    { text: 'Use more than one of its entry points if it offers them, so the history covers the product and not one button.', minutes: 10 },
  ],
  Indexes: [
    { text: 'Buy the index and hold it in the farming wallet for a full quarter; index products reward holders, not traders.', minutes: 10 },
    { text: 'Rebalance only when the index does, and keep the purchase history in one wallet.', minutes: 5 },
  ],
};

const DEFAULT_ACTIONS: { text: string; minutes: number }[] = [
  { text: 'Use the core product every week with real volume at a size the deposit supports, on the chains where its TVL actually sits, and keep the history in one wallet.', minutes: 20 },
  { text: 'Hold a balance or a position in the product between sessions; wallets that only appear on one day are the first a snapshot filters out.', minutes: 5 },
];

/** The structured farm plan: when, what, what it costs, how long it takes. */
export function farmPlan(p: Protocol): { steps: FarmStep[]; fees: number; minutes: number; weeks: number } {
  const budget = farmBudget(p.tvl_usd);
  const where = p.chains.slice(0, 3).join(', ') || 'its main chain';
  const actions = CATEGORY_ACTIONS[p.category ?? ''] ?? DEFAULT_ACTIONS;
  const steps: FarmStep[] = [
    { when: 'day 0', text: `Set up one wallet for this protocol and fund it on ${where}; keep every later step in that same wallet, because a farm split across wallets reads as several small users.`, cost_usd: 1, minutes: 10 },
    ...actions.map((a, i) => ({ when: i === 0 ? 'weekly' : 'weekly', text: a.text, cost_usd: 0, minutes: a.minutes })),
    { when: `weeks 1-${budget.weeks}`, text: `Run the routine for ${budget.weeks} weeks at a weekly rhythm; short intense bursts are the pattern points programs discount first, and the gas line below is the whole run's estimate.`, cost_usd: budget.gas, minutes: 5 },
    { when: 'throughout', text: 'Write down the wallet, the dates and the amounts as you go: if a points program or an eligibility checker opens later, the record you kept is the proof you farmed before it existed.', cost_usd: 0, minutes: 5 },
    { when: 'exit', text: `Withdraw at the end of week ${budget.weeks} unless a points page, a governance forum or a testnet has opened by then; past that point an extra week adds less to the expected slice than the same deposit earns in T-bills.`, cost_usd: 1, minutes: 10 },
  ];
  const fees = steps.reduce((s, x) => s + x.cost_usd, 0);
  const minutes = steps.reduce((s, x) => s + x.minutes, 0) + budget.weeks * 10;
  return { steps, fees, minutes, weeks: budget.weeks };
}

const FARMER_SHARE = 0.08;
const CROWD_SHARE_OF_TVL = 0.01;
const TBILL_ANNUAL = 0.04;
const BOARD_SIZE = 300;

export function buildRadar(snapshot: Snapshot): { board: ScoredRow[]; radar: Radar } {
  const traded = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0);
  const curve = fitCurve(traded);
  const adjustments = categoryAdjustments(traded, curve);
  const odds = launchOddsTable(snapshot);
  const counts = new Map<string, { withToken: number; total: number }>();
  for (const p of snapshot.protocols) {
    const age = ageDays(p.listed_at, snapshot.as_of);
    const cohort = AGE_COHORTS.find((c) => c.test(age))!.label;
    for (const k of [`${cohort}|`, `${cohort}|${p.category ?? ''}`]) {
      const c = counts.get(k) ?? { withToken: 0, total: 0 };
      c.total += 1;
      if (p.mcap_usd !== null) c.withToken += 1;
      counts.set(k, c);
    }
  }

  // The holdout grade: fit on one slug-parity half, price the other.
  const fitHalf = traded.filter((p) => slugParity(p.slug) === 0);
  const priceHalf = traded.filter((p) => slugParity(p.slug) === 1);
  const hCurve = fitCurve(fitHalf);
  const hAdj = categoryAdjustments(fitHalf, hCurve);
  const flatRatios = fitHalf.map((p) => p.mcap_usd! / p.tvl_usd);
  const flat = median(flatRatios);
  const miss = (pred: number, actual: number) => Math.abs(Math.log(pred / actual));
  const modelMisses = priceHalf.map((p) => miss(curvePrice(hCurve, p.tvl_usd) * (p.category !== null ? (hAdj.get(p.category)?.adj ?? 1) : 1), p.mcap_usd!));
  const baseMisses = priceHalf.map((p) => miss(p.tvl_usd * flat, p.mcap_usd!));
  const holdout: Holdout = {
    fitted_on: fitHalf.length,
    priced: priceHalf.length,
    model_median_miss: median(modelMisses),
    baseline_median_miss: median(baseMisses),
    flat_multiple: flat,
  };

  const peersByCategory: Record<string, Peer[]> = {};
  for (const p of traded) {
    if (p.category === null) continue;
    const list = peersByCategory[p.category] ?? [];
    list.push({ name: p.name, symbol: p.symbol, mcap_usd: p.mcap_usd!, tvl_usd: p.tvl_usd, ratio: p.mcap_usd! / p.tvl_usd });
    peersByCategory[p.category] = list;
  }
  for (const list of Object.values(peersByCategory)) list.sort((a, b) => b.mcap_usd - a.mcap_usd);

  const watchlist = new Set(snapshot.watchlist);
  const setAside: SetAside[] = [];
  const scored: ScoredRow[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd !== null) continue;
    const reason = watchlist.has(p.slug) ? null : setAsideReason(p);
    if (reason !== null) {
      setAside.push({ slug: p.slug, name: p.name, tvl_usd: p.tvl_usd, reason });
      continue;
    }
    const curveValue = curvePrice(curve, p.tvl_usd);
    const adj = p.category !== null ? (adjustments.get(p.category)?.adj ?? 1) : 1;
    const o = launchOdds(odds, counts, p, snapshot.as_of, traded.length / snapshot.protocols.length);
    const growth = 1 + (clamp(p.change_7d ?? 0, -30, 60) / 100) * 0.5;
    const breadth = 1 + 0.005 * Math.min(p.chains.length, 20);
    const implied = Math.max(1, Math.round(curveValue * adj * o * growth * breadth));
    const plan = farmPlan(p);
    scored.push({
      slug: p.slug,
      name: p.name,
      rank: 0,
      implied_value_usd: implied,
      farm_steps: plan.steps.map((s) => `${s.when}: ${s.text}`),
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      age_days: ageDays(p.listed_at, snapshot.as_of),
      watchlist: watchlist.has(p.slug),
      curve_value_usd: Math.round(curveValue),
      category_adj: adj,
      launch_odds: o,
      growth_factor: growth,
      breadth_factor: breadth,
      steps_detail: plan.steps,
      fees_usd: plan.fees,
      minutes: plan.minutes,
      weeks: plan.weeks,
    });
  }
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));
  setAside.sort((a, b) => b.tvl_usd - a.tvl_usd);

  const kept = scored.slice(0, BOARD_SIZE);
  const keptSlugs = new Set(kept.map((r) => r.slug));
  for (const row of scored) {
    if (row.watchlist && !keptSlugs.has(row.slug)) kept.push(row);
  }
  kept.forEach((row, i) => {
    row.rank = i + 1;
  });

  const categories: CategoryStat[] = [];
  const preCount = new Map<string, number>();
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null && p.category !== null) preCount.set(p.category, (preCount.get(p.category) ?? 0) + 1);
  }
  for (const [category, stat] of adjustments) {
    categories.push({ category, peers: stat.peers, adj: stat.adj, pre_token: preCount.get(category) ?? 0 });
  }
  categories.sort((a, b) => b.peers - a.peers);

  const radar: Radar = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    watchlist_size: snapshot.watchlist.length,
    protocol_count: snapshot.protocols.length,
    live_size: traded.length,
    rows: kept,
    set_aside: setAside,
    categories,
    peers_by_category: peersByCategory,
    curve: { a: curve.a, b: curve.b, fitted_on: traded.length },
    holdout,
    farmer_share: FARMER_SHARE,
    crowd_share_of_tvl: CROWD_SHARE_OF_TVL,
    tbill_annual: TBILL_ANNUAL,
  };
  return { board: kept, radar };
}

export function dataScript(radar: Radar): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}

export function boardIssue(board: ScoredRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `board holds ${board.length} rows, outside 100-4000`;
  const slugs = new Set(snapshot.protocols.map((p) => p.slug));
  const seen = new Set<string>();
  let previous = Number.POSITIVE_INFINITY;
  for (let i = 0; i < board.length; i++) {
    const row = board[i]!;
    if (!slugs.has(row.slug)) return `row ${row.slug}: not a protocol in the snapshot`;
    if (seen.has(row.slug)) return `row ${row.slug}: slug appears twice`;
    seen.add(row.slug);
    if (row.rank !== i + 1) return `row ${row.slug}: rank ${row.rank}, expected ${i + 1}`;
    if (row.implied_value_usd > previous) return `row ${row.slug}: implied value rises as rank ascends`;
    previous = row.implied_value_usd;
    if (row.farm_steps.length < 3 || row.farm_steps.length > 12) return `row ${row.slug}: ${row.farm_steps.length} farm steps`;
    for (const step of row.farm_steps) {
      const len = step.trim().length;
      if (len < 20 || len > 600) return `row ${row.slug}: a farm step of ${len} characters`;
    }
  }
  for (const slug of snapshot.watchlist) {
    if (!seen.has(slug)) return `watchlist protocol ${slug} is missing from the board`;
  }
  return null;
}
