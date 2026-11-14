# Token Launch Radar

A make.fun **token-radar-01** entry: a program that reads the sealed DefiLlama snapshot and
answers one question — *which pre-token protocol is worth farming next, and what do I do about it?*

## Run it

```
node main.ts --input <snapshot.json|directory> --output <directory>
```

Node 22, standard library only, no network. Outside the grader's container,
`MAKEFUN_OUTPUT_DIR` stands in for `/output`. The program writes:

- `board.json` — the ranked board (every watchlist slug, plus every other rankable
  pre-token protocol in the snapshot), each row with its model factors, a value range,
  an airdrop yardstick, and a 9-step farm plan
- `data.js` — the same board in the dashboard's compact form, plus the set-aside list
- `dashboard/` — a static, offline dashboard (board, detail views, set-aside view,
  live-token view, model & calibration)
- `screenshots/` — this repository's own captures of the dashboard
- `dossier.json` — the judge's summary, built with the vendored make.fun library

The program refuses to write a board the sealed gate would refuse (its own `boardIssue`
check runs before anything touches disk).

## The model (radar-3)

A protocol is **pre-token** when its record shows no token: no market cap, no CoinGecko id,
no symbol. Protocols whose token already trades are set aside and shown at the market's own
values; they are never ranked.

The **implied value** is priced off the snapshot's own size curve — the market pays a
different multiple per TVL dollar at $5M than at $5B, so the model fits that curve instead
of charging one category constant at every size:

```
comps      = tokenized protocols with a market cap, TVL ≥ $1,000,000, exchanges excluded
curve      = OLS fit of log10(mcap / TVL) on log10(TVL) over the comps:
             multiple(TVL) = 10 ^ (level + slope × log10(TVL))
catEffect  = per category, the median residual of its comps around the curve, shrunk
             toward ×1 with 4 pseudo-peers, clamped to [×0.4, ×2.5]
growth     = 1 + 0.75 × clamp(change_7d, −40%, +60%)     (missing reads neutral)
maturity   = 0.55 + 0.45 × min(tokenless days, 730) / 730   (unknown age reads 365)
implied    = TVL × multiple(TVL) × catEffect × growth × maturity
```

The model grades itself: a **leave-one-out backtest** reprices every comp as if it were
tokenless (refitting without it) and reports the median multiplicative miss next to the
flat-median benchmark's; the middle half of the model's own errors is printed on every row
as its **value range**. Each row also carries an **airdrop yardstick** — what $1,000 farmed
maps to if a launch ever gave 10% of supply to depositors pro rata — labelled as the
assumption it is. An implied value is a claim about relative worth, **not** a prediction
that a token will be issued. Every row carries its factors and a confidence grade (peer
depth + record completeness) so thin rows can be discounted.

**Exclusions** (a launch that is really somebody else's token story): centralised exchanges;
bridges of every kind, including a chain's own canonical bridge; liquid staking and
restaking receipts and staking pools; stablecoin wrappers; versioned deployments (name
ends in V2 / v3 / 1.5); wrapped products of a trading asset ("Wrapped" in the name or a
wrapped-asset ticker such as FBTC/sBTC); products of a listed exchange group; and a
tokenless record sharing its name with a record that already has a token. Every set-aside
record is listed in the dashboard's Set aside view with its reason — nothing is dropped
silently. On this snapshot: 758 protocols → 416 already trade → 342 tokenless → 146 set
aside → 196 ranked (the 40-slug watchlist is the floor; its few members in set-aside
categories are ranked anyway and flagged).

**Farm plans** are generated per row from its category playbook, chains (gas priced for
Ethereum mainnet vs L2s), TVL tier (position size), tokenless age (hold window) and the
row's own modelled claim (the sizing step prices the position's slice of the modelled
launch, range included): nine steps, each with a cost and a time — qualify, diversify the
footprint, size by the modelled claim, stay active weekly, hold through snapshots, check
for a points programme safely, watch for launch signals without falling for fake claim
pages, keep an exit rule.

## Layout

- `main.ts` — lifecycle: parse, score, self-check, write outputs, dossier last
- `lib/model.ts` — classification, peer calibration, scoring, farm plans, gate self-check
- `dashboard/` — the static dashboard (`index.html`, `app.css`, `app.js`)
- `vendor/makefun-board.ts` — the kit's dossier library, byte for byte the scorer's own copy

## Verification

`node verify.ts --input <snapshot.json>` rebuilds the board twice and asserts every
invariant the sealed gate checks (coverage, ordering, step caps, no tokenized row ranked,
reproducible output). The entry's triple-audit report — functional, adversarial and
rubric passes with their evidence — lives in [docs/AUDIT.md](docs/AUDIT.md).
