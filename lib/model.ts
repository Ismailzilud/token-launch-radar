// Token launch radar — the model.
//
// Everything on the board is derived from the sealed snapshot and from
// nothing else: no names are scored, no list is hardcoded, and every
// number a reader sees can be traced back to a field of the snapshot
// or to an aggregate this file computes from it.
//
// The implied value of a protocol that records no token is
//
//   implied = TVL x category multiple x growth x maturity x breadth
//             x plausibility
//
// - category multiple: the median market-cap/TVL ratio of the
//   protocols in the same DefiLlama category whose token already
//   trades in this snapshot, shrunk toward the global median when a
//   category has few traded peers. It is the market's own answer to
//   "what is a dollar of TVL worth in a token like this".
// - growth: the seven-day TVL change, clamped, at half weight.
// - maturity: how long DefiLlama has tracked the protocol with no
//   token recorded; three years of record earns the full factor.
// - breadth: one small step per chain the protocol runs on, capped.
// - plausibility: a discount for shapes that rarely launch a token of
//   their own — centralised exchanges, canonical bridges and wrapped
//   or staked products of a token that already trades, versioned
//   successors of a protocol that has one. The signals are the same
//   ones the snapshot's own watchlist rule uses; here they discount
//   instead of deleting, so the reader still sees those protocols on
//   the board, priced as the long shots they are.
//
// Protocols whose token already trades never enter the ranking. They
// are the yardstick: the dashboard shows them beside each category as
// the comparables the multiples came from.

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

export interface ScoredRow {
  slug: string;
  name: string;
  rank: number;
  implied_value_usd: number;
  farm_steps: string[];
  // The working, shown in the detail view so the number can be audited.
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  watchlist: boolean;
  multiple: number;
  growth_factor: number;
  maturity_factor: number;
  breadth_factor: number;
  plausibility_factor: number;
  plausibility_note: string | null;
  peers: number;
}

export interface CategoryStat {
  category: string;
  peers: number;
  multiple: number;
  pre_token: number;
}

export interface Peer {
  name: string;
  symbol: string | null;
  mcap_usd: number;
  tvl_usd: number;
  ratio: number;
}

export interface Radar {
  as_of: string;
  floor_usd: number;
  watchlist_size: number;
  protocol_count: number;
  live_size: number;
  rows: ScoredRow[];
  categories: CategoryStat[];
  peers_by_category: Record<string, Peer[]>;
  global_multiple: number;
}

/** Parse and lightly validate the sealed snapshot. */
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

/** Whole days between the day DefiLlama began tracking a protocol and the snapshot's day. */
function ageDays(listedAt: string | null, asOf: string): number | null {
  if (listedAt === null) return null;
  const days = Math.round((Date.parse(asOf) - Date.parse(listedAt)) / DAY_MS);
  return days >= 0 ? days : null;
}

const EXCHANGE_PREFIXES = ['Binance', 'Coinbase', 'Bybit', 'Kraken', 'Bitget', 'OKX', 'Bitfinex', 'Gemini'];
const VERSION_SUFFIX = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/**
 * The launch-plausibility discount and the reason for it, from the
 * protocol's own category and name. 1 means an ordinary candidate.
 */
function plausibility(p: Protocol): { factor: number; note: string | null } {
  const hits: { factor: number; note: string }[] = [];
  if (p.category === 'CEX' || EXCHANGE_PREFIXES.some((x) => p.name.startsWith(x))) {
    hits.push({ factor: 0.05, note: 'an exchange or its own product: a house token is the exception, not the pattern, and its TVL is customer balances rather than a protocol waiting to launch' });
  }
  if (p.category === 'Canonical Bridge' || p.category === 'Liquid Staking' || p.category === 'Liquid Restaking' || p.category === 'Restaked BTC') {
    hits.push({ factor: 0.3, note: `${p.category.toLowerCase()}: a wrapped or staked form of value that already has a token behind it` });
  }
  if (WRAPPED_WORD.test(p.name)) {
    hits.push({ factor: 0.3, note: 'the name itself says wrapped or staked: the underlying asset already trades' });
  }
  if (p.category === 'Bridge' && p.chains.length <= 2) {
    hits.push({ factor: 0.35, note: 'a bridge on one or two chains: the shape of a canonical bridge for an asset that already trades' });
  }
  if (p.category === 'Bridge') {
    hits.push({ factor: 0.6, note: 'bridges often stay tokenless infrastructure or launch through a parent project' });
  }
  if (VERSION_SUFFIX.test(p.name)) {
    hits.push({ factor: 0.5, note: 'a versioned successor: the token, if any, usually belongs to the first version' });
  }
  if (hits.length === 0) return { factor: 1, note: null };
  hits.sort((a, b) => a.factor - b.factor);
  return { factor: hits[0]!.factor, note: hits[0]!.note };
}

/** Position size and running cost a realistic farm of this size calls for. */
function farmBudget(tvl: number): { position: string; gas: string; weeks: string } {
  if (tvl >= 1_000_000_000) return { position: '$1,000-$5,000', gas: '$25-$60', weeks: '8-10' };
  if (tvl >= 100_000_000) return { position: '$500-$2,500', gas: '$15-$40', weeks: '6-10' };
  if (tvl >= 10_000_000) return { position: '$250-$1,000', gas: '$8-$25', weeks: '6-8' };
  return { position: '$100-$500', gas: '$5-$15', weeks: '4-8' };
}

const CATEGORY_ACTIONS: Record<string, string[]> = {
  Dexs: [
    'Swap in both directions every week, varying the pairs and the size between $50 and $500 a trade, so the history reads as use and not as one script.',
    'Provide liquidity to one core pair and leave it in place; a position that survives a volatile week counts for more than one opened and closed in a day.',
  ],
  Lending: [
    'Supply a blue-chip collateral asset and keep it supplied; borrow a small amount against it, hold for some days, then repay in full and repeat the cycle',
    'Keep the health factor above 2 at all times: a liquidation ends the farm and the record with it.',
  ],
  Bridge: [
    'Bridge funds in both directions every week, rotating the routes and the destination chains instead of repeating one corridor.',
    'Vary the amounts between $100 and $1,000 and sometimes leave the funds on the far side for a week before bridging back.',
  ],
  'Cross Chain Bridge': [
    'Bridge funds in both directions every week, rotating the routes and the destination chains instead of repeating one corridor.',
    'Vary the amounts between $100 and $1,000 and sometimes leave the funds on the far side for a week before bridging back.',
  ],
  'Liquid Staking': [
    'Stake a modest amount and hold the receipt token in the same wallet; unstaking within days reads as farming, holding reads as use',
    'Put the receipt token to work in one integration the protocol points to, such as a lending market or a liquidity pool',
  ],
  'Liquid Restaking': [
    'Restake a modest amount and hold the receipt position; restaked capital that stays put is the behaviour these protocols reward.',
    'Claim every reward the position earns and keep the claim history in the same wallet.',
  ],
  Yield: [
    'Deposit into two or three of its vaults rather than only the highest-yield one, and let the deposits season for at least a month',
    'Claim rewards as they accrue and restake a part of them, so the wallet shows a compounding user and not a passer-by.',
  ],
  'Yield Aggregator': [
    'Deposit into two or three vaults rather than only the highest-yield one, and let the deposits season for at least a month',
    'Move one deposit between vaults once a month at most: rotation is use, churn is noise.',
  ],
  RWA: [
    'Complete any onboarding or KYC the product offers and hold a position in one of its tokenised assets for a full quarter',
    'Use the asset the way it is meant to be used: hold to maturity where there is one, or trade it in its own market.',
  ],
  'Basis Trading': [
    'Open a small hedged position in its main market and roll it as it settles instead of closing the record after one trade',
    'Keep margin posted through a volatile week; positions that survive volatility are the ones a points program can see.',
  ],
  Privacy: [
    'Make shielded transfers of varied size on a weekly rhythm, and let some funds sit shielded between them.',
    'Use more than one of its entry points if it offers them, so the history covers the product and not one button.',
  ],
  Indexes: [
    'Buy the index and hold it in the farming wallet for a full quarter; index products reward holders, not traders.',
    'Rebalance only when the index does, and keep the purchase history in one wallet.',
  ],
};

const DEFAULT_ACTIONS = [
  'Use the core product every week with real volume at the size above, on the chains where its TVL actually sits, and keep the history in one wallet.',
  'Hold a balance or a position in the product between sessions; wallets that only appear on one day are the first a snapshot filters out.',
];

/** A concrete farm plan for one row, built from its own category, chains and size. */
export function farmSteps(p: Protocol): string[] {
  const budget = farmBudget(p.tvl_usd);
  const where = p.chains.slice(0, 3).join(', ') || 'its main chain';
  const actions = CATEGORY_ACTIONS[p.category ?? ''] ?? DEFAULT_ACTIONS;
  const steps = [
    `Set up one wallet for this protocol and fund it with ${budget.position} of working capital on ${where}; keep every later step in that same wallet, because a farm split across wallets reads as several small users.`,
    ...actions,
    `Run the routine for ${budget.weeks} weeks at a weekly rhythm, spending roughly ${budget.gas} in gas over the whole run; short intense bursts are the pattern points programs discount first.`,
    'Write down the wallet, the dates and the amounts as you go: if a points program or an eligibility checker opens later, the record you kept is the proof you farmed before it existed.',
    'Watch for a governance forum, a points page or a testnet announcement from the team, and take part early; when a launch comes, the snapshot that counts is usually taken with no warning.',
  ];
  return steps.slice(0, 6);
}

interface MultipleTable {
  byCategory: Map<string, { multiple: number; peers: number }>;
  global: number;
}

/** Median traded mcap/TVL per category, shrunk toward the global median for thin categories. */
function multiples(snapshot: Snapshot): MultipleTable {
  const ratios = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0) continue;
    const ratio = p.mcap_usd / p.tvl_usd;
    if (ratio < 0.01 || ratio > 20) continue;
    all.push(ratio);
    if (p.category !== null) {
      const list = ratios.get(p.category) ?? [];
      list.push(ratio);
      ratios.set(p.category, list);
    }
  }
  const global = median(all);
  const byCategory = new Map<string, { multiple: number; peers: number }>();
  for (const [category, list] of ratios) {
    const own = median(list);
    const n = list.length;
    byCategory.set(category, { multiple: (n * own + 4 * global) / (n + 4), peers: n });
  }
  return { byCategory, global };
}

const BOARD_SIZE = 300;

/** Score every pre-token protocol, rank them, and keep the top of the board plus the whole watchlist. */
export function buildRadar(snapshot: Snapshot): { board: ScoredRow[]; radar: Radar } {
  const table = multiples(snapshot);
  const watchlist = new Set(snapshot.watchlist);

  const peersByCategory: Record<string, Peer[]> = {};
  for (const p of snapshot.protocols) {
    if (p.mcap_usd === null || p.tvl_usd <= 0 || p.category === null) continue;
    const list = peersByCategory[p.category] ?? [];
    list.push({ name: p.name, symbol: p.symbol, mcap_usd: p.mcap_usd, tvl_usd: p.tvl_usd, ratio: p.mcap_usd / p.tvl_usd });
    peersByCategory[p.category] = list;
  }
  for (const list of Object.values(peersByCategory)) list.sort((a, b) => b.mcap_usd - a.mcap_usd);

  const preToken = snapshot.protocols.filter((p) => p.mcap_usd === null);
  const scored: ScoredRow[] = preToken.map((p) => {
    const stat = p.category !== null ? table.byCategory.get(p.category) : undefined;
    const multiple = stat?.multiple ?? table.global;
    const growth = 1 + (clamp(p.change_7d ?? 0, -30, 60) / 100) * 0.5;
    const age = ageDays(p.listed_at, snapshot.as_of);
    const maturity = age === null ? 0.85 : 0.7 + 0.3 * Math.min(1, age / 1095);
    const breadth = 1 + 0.005 * Math.min(p.chains.length, 20);
    const plaus = plausibility(p);
    const implied = Math.max(1, Math.round(p.tvl_usd * multiple * growth * maturity * breadth * plaus.factor));
    return {
      slug: p.slug,
      name: p.name,
      rank: 0,
      implied_value_usd: implied,
      farm_steps: farmSteps(p),
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      change_7d: p.change_7d,
      listed_at: p.listed_at,
      age_days: age,
      watchlist: watchlist.has(p.slug),
      multiple,
      growth_factor: growth,
      maturity_factor: maturity,
      breadth_factor: breadth,
      plausibility_factor: plaus.factor,
      plausibility_note: plaus.note,
      peers: stat?.peers ?? 0,
    };
  });
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1));

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
  for (const p of preToken) if (p.category !== null) preCount.set(p.category, (preCount.get(p.category) ?? 0) + 1);
  for (const [category, stat] of table.byCategory) {
    categories.push({ category, peers: stat.peers, multiple: stat.multiple, pre_token: preCount.get(category) ?? 0 });
  }
  categories.sort((a, b) => b.peers - a.peers);

  const radar: Radar = {
    as_of: snapshot.as_of,
    floor_usd: snapshot.floor_usd,
    watchlist_size: snapshot.watchlist.length,
    protocol_count: snapshot.protocols.length,
    live_size: snapshot.protocols.length - preToken.length,
    rows: kept,
    categories,
    peers_by_category: peersByCategory,
    global_multiple: table.global,
  };
  return { board: kept, radar };
}

/** The data script the dashboard reads: the same rows, with their working. */
export function dataScript(radar: Radar): string {
  return `window.RADAR = ${JSON.stringify(radar)};\n`;
}

/** Null when the board passes the gate's shape, else the first problem found. */
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
