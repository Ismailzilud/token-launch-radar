// The token radar's model (radar-3): one sealed snapshot in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and every other
// rankable pre-token protocol the snapshot carries: the early rows the radar exists to find. A protocol
// is pre-token when its record shows no token (no market cap, no CoinGecko id, no symbol); protocols
// whose token already trades are set apart and shown at the market's own values, never ranked by a model.
//
// radar-3 prices a launch off the snapshot's own size curve, not off a category constant. The market
// pays a different multiple per TVL dollar at $5M than at $5B, so the model fits that curve to the
// snapshot's own trading protocols and lets a category bend it only as far as its peers earn:
//
//   comps      = the already-tokenized protocols with a market cap and at least $1,000,000 of TVL
//                (dust records would bend the fit), exchanges excluded
//   curve      = an ordinary-least-squares fit of log10(market cap / TVL) on log10(TVL) over the comps:
//                multiple(TVL) = 10 ^ (level + slope x log10(TVL))
//   catEffect  = per category, the median residual of its comps around the curve, shrunk toward x1
//                with four pseudo-peers, (n x median + 4 x 0) / (n + 4) in log space, then clamped
//                to [x0.4, x2.5] so one thin category can bend the curve but never break it
//   growth     = 1 + 0.75 x clamp(change_7d, -40, +60) / 100     (a missing change reads as 0)
//   maturity   = 0.55 + 0.45 x min(tokenless age in days, 730) / 730   (unknown age reads as 365)
//   implied    = max(1, round(TVL x multiple(TVL) x catEffect x growth x maturity))
//
// The model grades itself in the open: a leave-one-out backtest reprices every comp as if it were
// tokenless (refitting without it) and reports the median multiplicative miss, next to the same
// number for a flat snapshot-wide median multiple. Each row also carries the backtest's middle-half
// error band as its value range, and an airdrop yardstick — what $1,000 farmed would map to if a
// launch ever gave 10% of supply to depositors pro rata — labelled as the assumption it is.
// No protocol name is ever special-cased.

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
export const MODEL_VERSION = 'radar-3';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The model's fixed weights: stated in the dashboard, identical for every row. */
export const MODEL = {
  growth_weight: 0.75,
  growth_floor: -40,
  growth_cap: 60,
  maturity_floor: 0.55,
  maturity_range: 0.45,
  maturity_days: 730,
  unknown_age_days: 365,
  peer_min_tvl_usd: 1_000_000,
  effect_shrink_prior: 4,
  effect_band_low: 0.4,
  effect_band_high: 2.5,
  airdrop_share: 0.1,
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
  implied_low_usd: number;
  implied_high_usd: number;
  model: {
    size_multiple: number;
    category_effect: number;
    model_multiple: number;
    peer_count: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
    airdrop_per_1k_usd: number;
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
  implied_low_usd: number;
  implied_high_usd: number;
  size_multiple: number;
  category_effect: number;
  model_multiple: number;
  peer_count: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  airdrop_per_1k_usd: number;
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

/** A tokenless protocol the board sets aside, with the reason it is not a launch candidate. */
export interface AsideRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  reason: string;
}

/** One category's calibration as the dashboard's methodology panel states it. */
export interface CategoryStat {
  category: string;
  peer_count: number;
  category_effect: number;
  pre_token_count: number;
}

/** The fitted curve and its leave-one-out report card, computed from the snapshot itself. */
export interface Calibration {
  comps: number;
  level_at_100m: number;
  slope_per_decade: number;
  global_multiple: number;
  loo_miss_model: number | null;
  loo_miss_flat: number | null;
  band_low_factor: number;
  band_high_factor: number;
}

/** Everything the dashboard needs: the board, the live set, the set-aside list, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  model: typeof MODEL;
  calibration: Calibration;
  protocols_size: number;
  tokenized_size: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  aside_size: number;
  live_size: number;
  categories: CategoryStat[];
  rows: RadarRow[];
  live: LiveRow[];
  aside: AsideRow[];
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
 * Categories whose tokenless records are claims on somebody else's token story, never an
 * independent launch: an exchange, the chain's own bridge, any other bridge, a staking or
 * restaking receipt, a staking pool, or a wrapper around a stable asset.
 */
const SET_ASIDE_CATEGORIES = new Map<string, string>([
  ['CEX', 'a centralised exchange — its equity, not a protocol token, is the launch story'],
  ['Canonical Bridge', "the chain's own bridge — the token in its story is the chain's token"],
  ['Bridge', 'a bridge route — value accrues to the bridge operator or the assets it carries, not to a token of this record'],
  ['Cross Chain Bridge', 'a cross-chain bridge route — value accrues elsewhere, not to a token of this record'],
  ['Liquid Staking', 'a staking receipt — a claim on the staked chain token, which already trades'],
  ['Liquid Restaking', 'a restaking receipt — a claim on assets and tokens that already trade'],
  ['Restaking', 'a restaking layer — its story rides on the tokens it restakes'],
  ['Staking Pool', 'a staking pool — a share of staking rewards, not an independent launch'],
  ['Stablecoin Wrapper', 'a wrapper around a stable asset that already exists'],
]);

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
 * Why a pre-token protocol is set aside instead of ranked, or null when the board may rank it:
 * an infrastructure or receipt category, a versioned pool, a wrapped product of a trading asset,
 * an exchange group's product, or the tokenless twin of a record that already carries a token
 * under the same name.
 */
export function setAsideReason(p: SnapshotProtocol, tokenizedNames?: ReadonlySet<string>): string | null {
  const byCategory = p.category === null ? undefined : SET_ASIDE_CATEGORIES.get(p.category);
  if (byCategory !== undefined) return byCategory;
  const name = p.name.trim();
  if (VERSIONED.test(name)) return 'a versioned deployment of another protocol — it inherits that protocol\u2019s token story';
  if (WRAPPED.test(name)) return 'a wrapped product of an asset that already trades';
  if (EXCHANGE_PARENT.test(name)) return 'a product of a listed exchange group — its equity already trades';
  if (WRAPPED_ASSET.test(name)) return 'a wrapped or staked form of a flagship asset that already trades';
  if (tokenizedNames !== undefined && tokenizedNames.has(name.toLowerCase())) {
    return 'shares its name with a record that already carries a token — the launch story belongs to that record';
  }
  return null;
}

/** Whether a protocol is one the board may rank: pre-token and not set aside for any reason. */
export function isRankable(p: SnapshotProtocol, tokenizedNames?: ReadonlySet<string>): boolean {
  return isPreToken(p) && setAsideReason(p, tokenizedNames) === null;
}

/** The median of a non-empty list. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/** The q-quantile of an already-sorted list, by nearest rank. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))]!;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round2 = (n: number): number => Math.round(n * 100) / 100;

const categoryKey = (category: string | null): string => category ?? 'Uncategorized';

/** One calibration comp: a trading protocol reduced to the numbers the curve is fit on. */
interface Comp {
  p: SnapshotProtocol;
  x: number; // log10(TVL)
  y: number; // log10(market cap / TVL)
}

/** The snapshot's calibration comps: tokenized, exchange-free, with a market cap and real TVL. */
function compsOf(snapshot: Snapshot): Comp[] {
  const comps: Comp[] = [];
  for (const p of snapshot.protocols) {
    if (isPreToken(p) || p.category === 'CEX') continue;
    if (p.mcap_usd === null || p.mcap_usd <= 0 || p.tvl_usd < MODEL.peer_min_tvl_usd) continue;
    comps.push({ p, x: Math.log10(p.tvl_usd), y: Math.log10(p.mcap_usd / p.tvl_usd) });
  }
  return comps;
}

/** An OLS line through (x, y) points; a degenerate set reads as its own flat median. */
function fitLine(pts: Comp[]): { level: number; slope: number } {
  if (pts.length === 0) return { level: Math.log10(0.25), slope: 0 };
  if (pts.length < 3) return { level: median(pts.map((c) => c.y)), slope: 0 };
  const n = pts.length;
  const mx = pts.reduce((s, c) => s + c.x, 0) / n;
  const my = pts.reduce((s, c) => s + c.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const c of pts) {
    sxy += (c.x - mx) * (c.y - my);
    sxx += (c.x - mx) * (c.x - mx);
  }
  if (sxx <= 0) return { level: my, slope: 0 };
  const slope = sxy / sxx;
  return { level: my - slope * mx, slope };
}

/**
 * A category's bend of the curve, in log10 space: the median residual of its comps around the
 * fitted line, shrunk toward zero with the model's pseudo-peer prior and clamped to the band.
 * A category with no comps earns no bend.
 */
function effectFor(residuals: number[]): number {
  if (residuals.length === 0) return 0;
  const shrunk = (residuals.length * median(residuals)) / (residuals.length + MODEL.effect_shrink_prior);
  return clamp(shrunk, Math.log10(MODEL.effect_band_low), Math.log10(MODEL.effect_band_high));
}

/** The growth factor of one record: its 7-day TVL change, clamped, weighted. */
function growthOf(p: SnapshotProtocol): { pct: number; mult: number } {
  const pct = clamp(finite(p.change_7d, 0), MODEL.growth_floor, MODEL.growth_cap);
  return { pct, mult: 1 + (pct / 100) * MODEL.growth_weight };
}

/** The maturity factor of one record: longer tokenless runs price higher, on a two-year ramp. */
function maturityOf(age: number | null): number {
  const days = clamp(age ?? MODEL.unknown_age_days, 0, MODEL.maturity_days);
  return MODEL.maturity_floor + (days / MODEL.maturity_days) * MODEL.maturity_range;
}

export interface PeerStats {
  /** The fitted curve over all comps. */
  fit: { level: number; slope: number };
  /** Category effects in log10 space, keyed by category. */
  effectByCategory: Map<string, number>;
  /** How many comps calibrated each category key. */
  countByCategory: Map<string, number>;
  /** The snapshot-wide median multiple, kept as the flat benchmark the backtest compares against. */
  globalMultiple: number;
  /** The model's leave-one-out report card. */
  calibration: Calibration;
}

/**
 * Calibrate the model from the snapshot's own trading protocols: fit the size curve, bend it by
 * category, then grade it leave-one-out — every comp repriced as if tokenless, with itself left
 * out of its own fit — against a flat median multiple graded the same way. The middle half of the
 * model's leave-one-out log errors becomes the band every board row carries as its value range.
 */
export function peerStats(snapshot: Snapshot): PeerStats {
  const comps = compsOf(snapshot);
  const fit = fitLine(comps);
  const residualsByCategory = new Map<string, number[]>();
  for (const c of comps) {
    const key = categoryKey(c.p.category);
    if (!residualsByCategory.has(key)) residualsByCategory.set(key, []);
    residualsByCategory.get(key)!.push(c.y - (fit.level + fit.slope * c.x));
  }
  const effectByCategory = new Map<string, number>();
  const countByCategory = new Map<string, number>();
  for (const [key, residuals] of residualsByCategory) {
    effectByCategory.set(key, effectFor(residuals));
    countByCategory.set(key, residuals.length);
  }
  const globalMultiple = comps.length > 0 ? median(comps.map((c) => 10 ** c.y)) : 0.25;

  // Leave-one-out: refit without each comp in turn. n is small (the snapshot's trading set with
  // real TVL), so the honest refit costs nothing next to the honesty it buys.
  const logErrModel: number[] = [];
  const logErrFlat: number[] = [];
  if (comps.length >= 8) {
    for (let i = 0; i < comps.length; i++) {
      const held = comps[i]!;
      const rest = comps.filter((_, j) => j !== i);
      const f = fitLine(rest);
      const key = categoryKey(held.p.category);
      const peers = rest.filter((c) => categoryKey(c.p.category) === key);
      const eff = effectFor(peers.map((c) => c.y - (f.level + f.slope * c.x)));
      const season = growthOf(held.p).mult * maturityOf(ageDays(snapshot.as_of, held.p.listed_at));
      const predicted = held.p.tvl_usd * 10 ** (f.level + f.slope * held.x + eff) * season;
      const flat = held.p.tvl_usd * median(rest.map((c) => 10 ** c.y)) * season;
      logErrModel.push(Math.log10(predicted / held.p.mcap_usd!));
      logErrFlat.push(Math.log10(flat / held.p.mcap_usd!));
    }
  }
  const miss = (errs: number[]): number | null =>
    errs.length === 0 ? null : round2(median(errs.map((e) => 10 ** Math.abs(e))));
  const sortedErr = [...logErrModel].sort((a, b) => a - b);
  const calibration: Calibration = {
    comps: comps.length,
    level_at_100m: round4(10 ** (fit.level + fit.slope * 8)),
    slope_per_decade: round4(fit.slope),
    global_multiple: round4(globalMultiple),
    loo_miss_model: miss(logErrModel),
    loo_miss_flat: miss(logErrFlat),
    band_low_factor: round4(10 ** quantile(sortedErr, 0.25)),
    band_high_factor: round4(10 ** quantile(sortedErr, 0.75)),
  };
  return { fit, effectByCategory, countByCategory, globalMultiple, calibration };
}

export interface ScoredFactors {
  implied: number;
  impliedLow: number;
  impliedHigh: number;
  sizeMultiple: number;
  categoryEffect: number;
  modelMultiple: number;
  peerCount: number;
  growthPct: number;
  growthMult: number;
  maturityMult: number;
  age: number | null;
  airdropPer1k: number;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Every factor one protocol gets, and the implied value they multiply to. The three multipliers
 * are rounded to four decimals before use, so the dashboard — which recomputes the product from
 * the same published factors — lands on the same dollar the board carries, row for row.
 */
export function scoreProtocol(p: SnapshotProtocol, asOf: string, peers: PeerStats): ScoredFactors {
  const age = ageDays(asOf, p.listed_at);
  const key = categoryKey(p.category);
  const sizeMultiple = 10 ** (peers.fit.level + peers.fit.slope * Math.log10(Math.max(p.tvl_usd, 1)));
  const categoryEffect = 10 ** (peers.effectByCategory.get(key) ?? 0);
  const peerCount = peers.countByCategory.get(key) ?? 0;
  const growth = growthOf(p);
  const modelMultiple = round4(sizeMultiple * categoryEffect);
  const growthMult = round4(growth.mult);
  const maturityMult = round4(maturityOf(age));
  const implied = Math.max(1, Math.round(p.tvl_usd * modelMultiple * growthMult * maturityMult));
  const impliedLow = Math.max(1, Math.min(implied, Math.round(implied * peers.calibration.band_low_factor)));
  const impliedHigh = Math.max(implied, Math.round(implied * peers.calibration.band_high_factor));
  const airdropPer1k = p.tvl_usd > 0 ? round2((implied * MODEL.airdrop_share * 1000) / p.tvl_usd) : 0;
  const missing = (p.change_7d === null ? 1 : 0) + (p.listed_at === null ? 1 : 0);
  const confidence: ScoredFactors['confidence'] =
    peerCount >= 8 && missing === 0 ? 'high' : peerCount >= 3 && missing <= 1 ? 'medium' : 'low';
  return {
    implied,
    impliedLow,
    impliedHigh,
    sizeMultiple,
    categoryEffect,
    modelMultiple,
    peerCount,
    growthPct: growth.pct,
    growthMult,
    maturityMult,
    age,
    airdropPer1k,
    confidence,
  };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** A compact dollar rendering for plan text: cents under $10, whole dollars to $999, then K/M/B. */
export function fmtUsd(n: number): string {
  if (n < 10) return `$${n.toFixed(2)}`;
  if (n < 1000) return `$${Math.round(n)}`;
  if (n < 1_000_000) return `$${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${(n / 1_000_000_000).toFixed(2)}B`;
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
 * A protocol's farm plan: nine steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age) and its modelled value — the category
 * playbook, the chain's gas reality, the age's hold window, and the position's own slice of the
 * modelled launch under the board's stated 10%-to-depositors assumption — never from a list of names.
 */
export function farmSteps(p: SnapshotProtocol, f: ScoredFactors): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(f.age);
  const gas = isMainnet(p) ? 'about $6-12 of ETH gas per transaction on Ethereum mainnet' : `about $1-3 of gas per transaction on ${chain}`;
  const multiChain = p.chains.length > 1 ? ` It also runs on ${p.chains[1]}, where a second, smaller position doubles the footprint.` : '';
  const share = p.tvl_usd > 0 ? MODEL.airdrop_share * (capital / p.tvl_usd) : 0;
  const slice = f.implied * share;
  const sliceLow = f.impliedLow * share;
  const sliceHigh = f.impliedHigh * share;
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
      text: `Size the position by its modelled claim, not by hope: if ${p.name} ever gave 10% of a launch to depositors pro rata, this $${capital} position maps to about ${fmtUsd(slice)} at the radar's modelled value — about ${fmtUsd(f.airdropPer1k)} per $1,000 farmed, inside a wide ${fmtUsd(sliceLow)} to ${fmtUsd(sliceHigh)} range for the position. Treat the range, not the point, as the estimate.`,
      cost: 'nothing — arithmetic before committing more',
      time: '5 minutes',
    },
    {
      text: `Repeat one qualifying action on ${p.name} every week — a deposit, a swap, a vote or a claim — so the wallet reads as a user, not a one-time visitor.`,
      cost: 'about $2 of gas a week',
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days: ${p.name} has run ${f.age === null ? 'an unrecorded span' : `${f.age} days`} with no token, and snapshots that count farmers usually span months, not days.`,
      cost: `the $${capital} stays in the position and carries its smart-contract risk`,
      time: `${hold} days`,
    },
    {
      text: `Check ${p.name}'s own app and announcements for a points or rewards page every two weeks. If one exists, enrol from inside the app; if a site ever asks you to pay to "claim" an airdrop, it is a scam — close it.`,
      cost: 'nothing to check; never pay to claim',
      time: '5 minutes every two weeks',
    },
    {
      text: `Watch for launch signals where they would actually appear: ${p.name}'s governance forum, docs changelog and official announcements. If an eligibility checker or claim page ever appears, verify its address from two official channels before connecting a wallet — the first link in a reply thread is the classic trap.`,
      cost: 'nothing to watch; never pay to claim',
      time: '10 minutes a month',
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
    implied_low_usd: s.f.impliedLow,
    implied_high_usd: s.f.impliedHigh,
    model: {
      size_multiple: round4(s.f.sizeMultiple),
      category_effect: round4(s.f.categoryEffect),
      model_multiple: s.f.modelMultiple,
      peer_count: s.f.peerCount,
      growth_pct: s.f.growthPct,
      growth_multiplier: s.f.growthMult,
      maturity_multiplier: s.f.maturityMult,
      age_days: s.f.age,
      airdrop_per_1k_usd: s.f.airdropPer1k,
      confidence: s.f.confidence,
    },
    farm_steps: farmSteps(s.p, s.f).map(stepText),
  }));
}

/** The tokenless protocols the board sets aside, each with its reason, largest first. */
export function setAsideRows(snapshot: Snapshot, board: BoardRow[]): AsideRow[] {
  const ranked = new Set(board.map((r) => r.slug));
  const tokenizedNames = new Set(
    snapshot.protocols.filter((q) => !isPreToken(q)).map((q) => q.name.trim().toLowerCase()),
  );
  return snapshot.protocols
    .filter((p) => isPreToken(p) && !ranked.has(p.slug))
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      reason: setAsideReason(p, tokenizedNames) ?? 'not ranked by the model',
    }))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
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
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    size_multiple: row.model.size_multiple,
    category_effect: row.model.category_effect,
    model_multiple: row.model.model_multiple,
    peer_count: row.model.peer_count,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    airdrop_per_1k_usd: row.model.airdrop_per_1k_usd,
    confidence: row.model.confidence,
    watchlist: watchlist.has(row.slug),
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const live = liveRows(snapshot);
  const aside = setAsideRows(snapshot, board);
  const peers = peerStats(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const preCount = new Map<string, number>();
  for (const row of board) {
    const key = categoryKey(row.category);
    preCount.set(key, (preCount.get(key) ?? 0) + 1);
  }
  const categories: CategoryStat[] = [...peers.countByCategory.entries()]
    .map(([category, count]) => ({
      category,
      peer_count: count,
      category_effect: round4(10 ** (peers.effectByCategory.get(category) ?? 0)),
      pre_token_count: preCount.get(category) ?? 0,
    }))
    .sort((a, b) => b.pre_token_count - a.pre_token_count || b.peer_count - a.peer_count);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    model: MODEL,
    calibration: peers.calibration,
    protocols_size: snapshot.protocols.length,
    tokenized_size: snapshot.protocols.filter((p) => !isPreToken(p)).length,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !watchlist.has(r.slug)).length,
    aside_size: aside.length,
    live_size: live.length,
    categories,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
    aside,
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

/** Why a board is not one the gate will take, or null: coverage, ranks, order, a real ranking, ranges, and farm steps. */
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
    if (r.implied_value_usd > 1e14) return `${r.slug} has implied value ${r.implied_value_usd}, over the gate's $1e14 cap`;
    if (!(r.implied_low_usd >= 1 && r.implied_low_usd <= r.implied_value_usd && r.implied_high_usd >= r.implied_value_usd)) {
      return `${r.slug} has a value range [${r.implied_low_usd}, ${r.implied_high_usd}] that does not bracket its implied value ${r.implied_value_usd}`;
    }
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
