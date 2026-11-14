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
  pre-token protocol in the snapshot), each row with its model factors and a 7-step farm plan
- `data.js` — the same board in the dashboard's compact form
- `dashboard/` — a static, offline dashboard (board, detail views, live-token view, method)
- `screenshots/` — this repository's own captures of the dashboard
- `dossier.json` — the judge's summary, built with the vendored make.fun library

The program refuses to write a board the sealed gate would refuse (its own `boardIssue`
check runs before anything touches disk).

## The model (radar-2)

A protocol is **pre-token** when its record shows no token: no market cap, no CoinGecko id,
no symbol. Protocols whose token already trades are set aside and shown at the market's own
values; they are never ranked.

The **implied value** is calibrated by the snapshot itself:

```
peers      = tokenized protocols in the same category, TVL ≥ $1,000,000
             (each peer's market-cap / TVL ratio capped at 5)
peerMult   = (n × category median + 3 × global median) / (n + 3),
             held inside [0.2×, 3×] the global median
growth     = 1 + clamp(change_7d, −50%, +100%) × 0.6      (missing reads neutral)
maturity   = 0.70 + 0.30 × min(tokenless days, 1095) / 1095   (unknown age reads 180)
implied    = TVL × peerMult × growth × maturity
```

The reading: if this protocol's token priced today the way its already-trading category
peers price against their TVL, this is the market value that TVL would carry — lifted when
the protocol grows and the longer it has run without a token. It is a claim about relative
worth, **not** a prediction that a token will be issued. Every row carries its factors and a
confidence grade (peer depth + record completeness) so thin rows can be discounted.

**Exclusions** (a launch that is really somebody else's token story): centralised exchanges;
versioned deployments (name ends in V2 / v3 / 1.5); wrapped products of a trading asset
("Wrapped" in the name, a wrapped-asset ticker such as FBTC/sBTC, or a bare ticker standing
in a bridge category — the WBTC record is the wrapped asset itself); products of a listed
exchange group; and a tokenless record sharing its name with a record that already has a token.

**Farm plans** are generated per row from its category playbook, chains (gas priced for
Ethereum mainnet vs L2s), TVL tier (position size) and tokenless age (hold window): seven
steps, each with a cost and a time — qualify, diversify the footprint, stay active weekly,
hold through snapshots, check for a points programme safely, keep an exit rule.

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
