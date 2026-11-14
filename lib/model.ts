// The token radar's model (radar-2): one sealed snapshot in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every other
// rankable pre-token protocol the snapshot carries: the early rows the radar exists to find. A protocol
// is pre-token when its record shows no token (no market cap, no CoinGecko id, no symbol); protocols
// whose token already trades are set apart and shown at the market's own values, never ranked by a model.
//
// The implied value is calibrated by the snapshot itself, not by a constant somebody picked:
//
//   peers      = the already-tokenized protocols in the same category, each with a market cap and
//                at least $1,000,000 of TVL (dust records would bend the ratio); each peer's
//                market-cap / TVL ratio is capped at 5 before use — beyond that a token's price
//                reflects float and listing scope, not a price for the protocol's TVL
//   peerMult   = the category's median ratio, shrunk toward the snapshot-wide median by peer
//                count, (n x category median + 3 x global median) / (n + 3), then held inside
//                [0.2 x, 3 x] the global median so one thin category cannot dominate the board
//   growthMult = 1 + clamp(change_7d, -50, 100) / 100 x 0.6     (a missing change reads as 0)
//   maturity   = 0.70 + 0.30 x min(tokenless age in days, 1095) / 1095   (unknown age reads as 180)
//   implied    = max(1, round(tvl x peerMult x growthMult x maturity))
//
// The reading: if this protocol's token priced today the way its already-trading category peers price
// against their TVL, this is the market value that TVL would carry — lifted when the protocol is
// growing and when it has run longer without a token, marked down when it shrinks. It is a model's
// claim about relative worth, never a prediction that a token will exist. Every row carries its own
// factors and a confidence grade (peer depth plus data completeness) so a reader can discount the
// rows the snapshot speaks about thinly. No protocol name is ever special-cased.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
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

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the board's rows carry it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The model's fixed weights: stated in the dashboard, identical for every row. */
export const MODEL = {
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1095,
  unknown_age_days: 180,
  peer_min_tvl_usd: 1_000_000,
  peer_shrink_prior: 3,
  peer_ratio_cap: 5,
  multiple_band_low: 0.2,
  multiple_band_high: 3,
};

/** A farm step before it is flattened to the board's string form. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
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
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    peer_multiple: number;
    peer_count: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
    confidence: 'high' | 'medium' | 'low';
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row; the page rebuilds the farm plan from the same fields. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  peer_multiple: number;
  peer_count: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  confidence: 'high' | 'medium' | 'low';
  watchlist: boolean;
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** One category's calibration as the dashboard's methodology panel states it. */
export interface CategoryStat {
  category: string;
  peer_count: number;
  peer_multiple: number;
  pre_token_count: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model: typeof MODEL;
  global_multiple: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  categories: CategoryStat[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * A release marker at the end of a name ("Morpho V2", "Pool 1.5", "Vault v3"): DefiLlama's own
 * convention for a pool or deployment of another protocol, which inherits that protocol's token
 * story instead of starting one.
 */
const VERSIONED = /(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A wrapped product of an asset that already trades ("Coinbase Wrapped Staked ETH", "Wrapped X"). */
const WRAPPED = /wrapped/i;

/** A product of a listed exchange group, whose equity already trades (Coinbase Bridge, …). */
const EXCHANGE_PARENT = /\b(coinbase|binance|kraken|okx|bybit)\b/i;

/** A wrapped or staked form of a flagship trading asset, named by that asset's ticker (Function FBTC). */
const WRAPPED_ASSET = /\b(fbtc|wbtc|sbtc|weth|steth|wsteth|cbeth|reth|sfrxeth)\b/i;

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange, not a canonical
 * bridge, not a versioned pool, not a wrapped product of a trading asset, not an exchange
 * group's product, and not the tokenless twin of a record that already carries a token under
 * the same name.
 */
export function isRankable(p: SnapshotProtocol, tokenizedNames?: ReadonlySet<string>): boolean {
  if (!isPreToken(p) || p.category === 'CEX') return false;
  // A canonical bridge is the chain's own bridge: the token in its story is the chain's token
  // (several such records in the snapshot carry the chain token's market cap outright), never
  // a launch of the bridge record itself, so there is nothing here to farm toward.
  if (p.category === 'Canonical Bridge') return false;
  const name = p.name.trim();
  if (VERSIONED.test(name) || WRAPPED.test(name) || EXCHANGE_PARENT.test(name) || WRAPPED_ASSET.test(name)) return false;
  if (tokenizedNames !== undefined && tokenizedNames.has(name.toLowerCase())) return false;
  // A bare ticker in a bridge category is the wrapped asset itself (WBTC), not a protocol launch.
  if ((p.category === 'Bridge' || p.category === 'Canonical Bridge') && /^[A-Z0-9]{2,6}$/.test(name)) return false;
  return true;
}

/** The median of a non-empty list. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export interface PeerStats {
  /** Market-cap / TVL multiple per category key, after shrinkage toward the global median. */
  multipleByCategory: Map<string, number>;
  /** How many tokenized peers calibrated each category key. */
  countByCategory: Map<string, number>;
  /** The snapshot-wide median multiple. */
  globalMultiple: number;
}

const categoryKey = (category: string | null): string => category ?? 'Uncategorized';

/**
 * Calibrate the multiples from the snapshot's own tokenized protocols: for every category, the
 * median market-cap/TVL of its trading members with at least the floor TVL, shrunk toward the
 * global median so a category with two peers cannot shout.
 */
export function peerStats(snapshot: Snapshot): PeerStats {
  const ratiosByCategory = new Map<string, number[]>();
  const all: number[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.category === 'CEX') continue;
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd < MODEL.peer_min_tvl_usd) continue;
    const ratio = Math.min(p.mcap_usd / p.tvl_usd, MODEL.peer_ratio_cap);
    const key = categoryKey(p.category);
    if (!ratiosByCategory.has(key)) ratiosByCategory.set(key, []);
    ratiosByCategory.get(key)!.push(ratio);
    all.push(ratio);
  }
  const globalMultiple = all.length > 0 ? median(all) : 0.25;
  const multipleByCategory = new Map<string, number>();
  const countByCategory = new Map<string, number>();
  for (const [key, ratios] of ratiosByCategory) {
    const n = ratios.length;
    const shrunk = (n * median(ratios) + MODEL.peer_shrink_prior * globalMultiple) / (n + MODEL.peer_shrink_prior);
    const banded = Math.min(MODEL.multiple_band_high * globalMultiple, Math.max(MODEL.multiple_band_low * globalMultiple, shrunk));
    multipleByCategory.set(key, banded);
    countByCategory.set(key, n);
  }
  return { multipleByCategory, countByCategory, globalMultiple };
}

export interface ScoredFactors {
  implied: number;
  peerMultiple: number;
  peerCount: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
  confidence: 'high' | 'medium' | 'low';
}

/** Every factor one protocol gets, and the implied value they multiply to. */
export function scoreProtocol(p: SnapshotProtocol, asOf: string, peers: PeerStats): ScoredFactors {
  const age = ageDays(asOf, p.listed_at);
  const key = categoryKey(p.category);
  const peerMultiple = peers.multipleByCategory.get(key) ?? peers.globalMultiple;
  const peerCount = peers.countByCategory.get(key) ?? 0;
  const growthPct = Math.min(MODEL.growth_cap, Math.max(MODEL.growth_floor, finite(p.change_7d, 0)));
  const growthMult = 1 + (growthPct / 100) * MODEL.growth_weight;
  const ageForModel = age ?? MODEL.unknown_age_days;
  const maturityMult = MODEL.maturity_floor + (Math.min(Math.max(ageForModel, 0), MODEL.maturity_days) / MODEL.maturity_days) * MODEL.maturity_range;
  const implied = Math.max(1, Math.round(p.tvl_usd * peerMultiple * growthMult * maturityMult));
  const missing = (p.change_7d === null ? 1 : 0) + (p.listed_at === null ? 1 : 0);
  const confidence: ScoredFactors['confidence'] =
    peerCount >= 8 && missing === 0 ? 'high' : peerCount >= 3 && missing <= 1 ? 'medium' : 'low';
  return { implied, peerMultiple, peerCount, growthPct, growthMult, maturityMult, age, confidence };
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Whether the first chain is Ethereum mainnet, where gas is priced differently. */
function isMainnet(p: SnapshotProtocol): boolean {
  return chainOf(p) === 'Ethereum';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The primary qualifying action for the category, in words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend')) return `Supply $${capital} of USDC to ${name} on ${chain} so the wallet appears as a lender in its markets.`;
  if (c.includes('cdp')) return `Open a $${capital} collateral position on ${name} on ${chain} and mint a small amount of its debt asset.`;
  if (c.includes('liquid staking') || c.includes('restak')) return `Stake $${capital} of the chain's native asset through ${name} on ${chain} and keep the staking receipt in the wallet.`;
  if (c.includes('bridge') || c.includes('canonical')) return `Bridge $${capital} of USDC to ${chain} through ${name}, then use the bridged funds in one app on the far side.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s most active pair on ${chain} and leave the position open.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged trade, then close it a day later.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and hold the vault shares it issues.`;
  if (c.includes('rwa')) return `Mint $${capital} of ${name}'s yield-bearing asset on ${chain} after its onboarding check, and hold it.`;
  if (c.includes('basis')) return `Open the $${capital} hedged position ${name} offers on ${chain} (long spot, short perp in one flow) and keep both legs.`;
  if (c.includes('prediction')) return `Fund $${capital} and take one position in a liquid market on ${name}, then let it settle.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} for one month and keep the policy NFT.`;
  if (c.includes('yield')) return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the yield position open.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it in the wallet.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/** A second, category-specific qualifying action, so the wallet's history is not one-dimensional. */
function secondActionFor(p: SnapshotProtocol, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend')) return `Borrow a small amount against the supply on ${name}, repay it within a week, and keep the borrow history clean.`;
  if (c.includes('cdp')) return `Repay part of the minted debt on ${name} and top the collateral up once, so the position shows management, not a single touch.`;
  if (c.includes('liquid staking') || c.includes('restak')) return `Use the staking receipt from ${name} in one integrated app it lists (a lending market or vault) instead of leaving it idle.`;
  if (c.includes('bridge') || c.includes('canonical')) return `Bridge a smaller amount back through ${name} a week later, so the wallet shows two-way use rather than a one-way hop.`;
  if (c.includes('dex')) return `Make two swaps through ${name}'s own interface on ${chain} on different days, separate from the liquidity position.`;
  if (c.includes('derivative') || c.includes('perpetual')) return `Place one limit order on ${name} and let it fill, so the wallet records both order types.`;
  if (c.includes('curator') || c.includes('allocator')) return `Move a quarter of the position to a second ${name} vault with a different strategy, keeping both open.`;
  if (c.includes('rwa')) return `Redeem a small slice of the ${name} asset once, then re-mint it, so both directions appear in the wallet's history.`;
  if (c.includes('basis')) return `Rebalance the ${name} hedge once after a funding-rate change, keeping the pair delta-neutral.`;
  if (c.includes('prediction')) return `Take a second position on the opposite side of a different ${name} market, sized at half the first.`;
  if (c.includes('yield')) return `Harvest the yield ${name} shows once and restake it into the same position instead of withdrawing it.`;
  return `Repeat the main action on ${name} with a quarter of the first amount, a week later, so the history shows a pattern.`;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age) — the category playbook, the chain's gas
 * reality, the age's hold window — never from a list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = isMainnet(p) ? 'about $6-12 of ETH gas per transaction on Ethereum mainnet' : `about $1-3 of gas per transaction on ${chain}`;
  const multiChain = p.chains.length > 1 ? ` It also runs on ${p.chains[1]}, where a second, smaller position doubles the footprint.` : '';
  return [
    {
      text: `Start from a fresh wallet funded only with the farm amount, and reach ${p.name} only through the link on its official site or its DefiLlama page — never through a search ad or a DM.`,
      cost: 'under $3 to fund and make the first transaction',
      time: '10 minutes',
    },
    {
      text: actionFor(p, capital, chain),
      cost: `$${capital} of capital, ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: secondActionFor(p, chain) + multiChain,
      cost: `about a quarter of the first position, ${gas}`,
      time: '10 minutes, one week after step 2',
    },
    {
      text: `Repeat one qualifying action on ${p.name} every week — a deposit, a swap, a vote or a claim — so the wallet reads as a user, not a one-time visitor.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days: ${p.name} has run ${age === null ? 'an unrecorded span' : `${age} days`} with no token, and snapshots that count farmers usually span months, not days.`,
      cost: `the $${capital} stays in the position and carries its smart-contract risk`,
      time: `${hold} days`,
    },
    {
      text: `Check ${p.name}'s own app and announcements for a points or rewards page every two weeks. If one exists, enrol from inside the app; if a site ever asks you to pay to "claim" an airdrop, it is a scam — close it.`,
      cost: 'nothing to check; never pay to claim',
      time: '5 minutes every two weeks',
    },
    {
      text: `Keep a farm log (wallet, dates, amounts, transaction hashes) and set an exit rule now: withdraw if ${p.name}'s TVL falls by half, if its contracts are paused, or when you no longer want the position — token or no token.`,
      cost: 'nothing but the log',
      time: '5 minutes to set up, reviewed monthly',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** The ranked board: every watchlist slug, plus every other rankable pre-token protocol. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const peers = peerStats(snapshot);
  const index = new Map(snapshot.protocols.map((p) => [p.slug, p]));
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug is ranked even if a filter would drop it.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every remaining rankable pre-token protocol, at any TVL the snapshot carries.
  const tokenizedNames = new Set(
    snapshot.protocols.filter((q) => !isPreToken(q)).map((q) => q.name.trim().toLowerCase()),
  );
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p, tokenizedNames)) chosen.set(p.slug, p);
  }
  const scored = [...chosen.values()].map((p) => ({ p, f: scoreProtocol(p, snapshot.as_of, peers) }));
  scored.sort((a, b) => b.f.implied - a.f.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token' as const,
    age_days: s.f.age,
    implied_value_usd: s.f.implied,
    model: {
      peer_multiple: round4(s.f.peerMultiple),
      peer_count: s.f.peerCount,
      growth_pct: s.f.growthPct,
      growth_multiplier: round4(s.f.growthMult),
      maturity_multiplier: round4(s.f.maturityMult),
      age_days: s.f.age,
      confidence: s.f.confidence,
    },
    farm_steps: farmSteps(s.p, s.f.age).map(stepText),
  }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, watchlist: ReadonlySet<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    peer_multiple: row.model.peer_multiple,
    peer_count: row.model.peer_count,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    confidence: row.model.confidence,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const peers = peerStats(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const preCount = new Map<string, number>();
  for (const row of board) {
    const key = categoryKey(row.category);
    preCount.set(key, (preCount.get(key) ?? 0) + 1);
  }
  const categories: CategoryStat[] = [...peers.multipleByCategory.entries()]
    .map(([category, multiple]) => ({
      category,
      peer_count: peers.countByCategory.get(category) ?? 0,
      peer_multiple: round4(multiple),
      pre_token_count: preCount.get(category) ?? 0,
    }))
    .sort((a, b) => b.pre_token_count - a.pre_token_count);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model: MODEL,
    global_multiple: round4(peers.globalMultiple),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watchlist.has(r.slug)).length,
    live_size: live.length,
    categories,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, a real ranking, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
