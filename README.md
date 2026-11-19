# Token Launch Radar

A make.fun **token-radar-01** entry: a program that reads the sealed DefiLlama snapshot and
answers one question — *which pre-token protocol is worth farming next, what is the farm worth
in dollars, and what do I do about it?*

## Run it

```
node main.ts --input <snapshot.json> --output <directory>
```

Node 22, standard library only, no network. Outside the grader's container,
`MAKEFUN_OUTPUT_DIR` stands in for `/output`. The program writes:

- `board.json` — the ranked board: every watchlist slug, plus the other rankable pre-token
  protocols, each row with its model factors and its farm plan
- `data.js` — the same board in the dashboard's form, plus the set-aside list, the fitted
  curve, the category adjustments, and the holdout grade
- `dashboard/` — a static, offline dashboard: the board with verdict filters and a deposit
  selector, a detail view per protocol, the model and its out-of-sample grade
- `screenshots/` — this repository's own captures of the dashboard
- `dossier.json` — the judge's summary, built with the vendored make.fun library

The program refuses to write a board the sealed gate would refuse (its own `boardIssue`
check runs before anything touches disk), and two runs over the same snapshot write
byte-identical output.

## The model (radar-5)

A protocol is **pre-token** when its record shows no token. Protocols whose token already
trades are never ranked; they are the yardstick the pricing is fitted on.

**Implied value** is an expected value, built in four moves, all from the snapshot itself:

```
curve      = least-squares fit of log(market cap) on log(TVL) over the traded protocols
adjustment = per category, the median ratio of actual cap to curve price, shrunk toward 1
odds       = of the protocols tracked for about as long, the share that record a token
             today (age cohort, blended with the category's share, shrunk to the global)
implied    = curve(TVL) × adjustment × odds × growth(7d, half weight) × breadth(chains)
```

**Set aside, not ranked.** Exchanges and their products, canonical bridges, wrapped or
staked forms of a token that already trades, and versioned successors do not launch a first
token of their own, so they leave the board entirely and are listed with the reason. The
snapshot's watchlist is never set aside.

**Graded in the open.** The traded protocols are split in two by a hash of the slug; the
curve and adjustments are refitted on one half and used to price the other. The dashboard
prints the median miss next to the flat-TVL-multiple baseline's miss on the same unseen
half (this snapshot: ×1.25 against ×1.56).

**Farm verdict.** The farmer pool is taken as 8% of the implied value; a deposit earns its
share of that pool against the capital expected to chase it (1% of TVL). Net of estimated
fees and a 4% T-bill yield on the deposit: **FARM** when the slice clears twice the costs,
**THIN** when it merely clears them, **SKIP** when it does not. The detail view prints the
whole calculation and a farm plan as a table — when, what, what it costs, how long it takes.

## Reading the board honestly

"Records no token" is what the snapshot says; a protocol may have a token its record does
not carry. An implied value is this board's own claim about a token that does not exist, and
the launch odds are a cross-section of one snapshot — neither is a prediction that a token
will be issued, or when.
