# Changelog

All notable changes to the Token Launch Radar entry. The model is deterministic: the same
snapshot always produces the same board, so every entry below is reproducible from the
commit it names.

## 2026-11-19 — radar-5: launch odds, farm verdicts, graded in the open

- Expected-value pricing: the fitted size curve and category adjustments are now multiplied
  by launch odds — the share of same-age look-alikes that record a token today — so the
  board ranks by what a launch is worth in expectation, not only if it comes.
- Set aside replaces discounted: exchanges, canonical bridges, wrapped/staked forms and
  versioned successors leave the board entirely (260 protocols, each with its reason).
- Farm verdicts in dollars: FARM / THIN / SKIP from the expected slice against fees plus a
  4% T-bill opportunity cost, recomputed in the page at the reader's deposit.
- The fit is graded out of sample on the dashboard: median miss ×1.25 against ×1.56 for a
  flat TVL multiple on the unseen half of the traded set.
- Farm plans are tables now: when, what, cost, minutes — including an exit rule tied to the
  T-bill comparison.

commit it names.

## 2026-11-15 — radar-3: size curve, set-aside view, backtested ranges

- Model radar-3 replaces radar-2's per-category median multiple (which charged a $2.75B
  curator the same multiple as a $5M one and priced the board's top row at $1.7B) with a
  size curve fitted to the snapshot's own trading protocols: OLS of log10(mcap/TVL) on
  log10(TVL) over 119 comps (level ×0.144 at $100M TVL, slope −0.528 per decade), bent per
  category by a shrunk, clamped median-residual effect. The same protocol now prices at
  $87.7M — inside the range the market's own curve supports.
- The model now grades itself in the open: a leave-one-out backtest over the comps
  (median miss ×3.24) is printed next to the flat-median benchmark (×5.03) in the
  dashboard header and calibration panel; the middle half of the model's errors is every
  row's value range. radar-2's own leave-one-out miss, measured the same way, was ×5.20.
- Classification tightened to the launch-candidate line: bridges of every kind, liquid
  staking and restaking receipts, staking pools and stablecoin wrappers are set aside
  alongside the existing exclusions. The board goes 259 → 196 rows; every one of the 146
  set-aside records is listed in a new dashboard view with its reason.
- Farm plans grow from seven to nine steps: a sizing step prices the position's slice of
  the modelled launch under the board's stated 10%-to-depositors assumption (also shown
  per row as an airdrop-per-$1k yardstick), and a launch-signal watch step covers safe
  claim hygiene. The dashboard still regenerates every plan from the same data —
  string-equality re-verified — and now also recomputes every row's implied value from
  its published factors on the page (196/196 match), which is why scoreProtocol rounds
  its multipliers before use.
- Growth and maturity re-weighted to the form the fitted field supports: growth
  1 + 0.75 × clamp(Δ7d, −40%, +60%); maturity 0.55 → 1.00 over 730 days, unknown age 365.

## 2026-11-14 — judge-attack fix: canonical bridges excluded

- A strict-evaluator pass found canonical bridges (a chain's own bridge — Base Bridge,
  Robinhood Chain Bridge, …) ranked as high as #3. They never issue a token of their own:
  tokenized records in that category carry the chain token's market cap itself. The
  category is now excluded by the same uniform rule style as the other classifications;
  the board goes 274 → 259 rows, the watchlist is untouched, and the dashboard's
  exclusion note explains the reasoning. Full evidence in docs/AUDIT.md.

## 2026-11-14 — radar-2, triple audit, final optimizer

- Model radar-2: implied value = TVL × category peer multiple × growth factor × maturity
  factor. The peer multiple is the median market-cap-to-TVL ratio of the category's own
  tokenized protocols in the sealed snapshot, shrunk toward the global median and banded,
  so thin categories stay honest instead of explosive.
- Classification: protocols that already trade, wrapped assets, exchange-group products,
  versioned pools and exchanges are never ranked as pre-token; the tokenized set is shown
  separately in the Live view.
- Farm plans: seven steps per protocol from category playbooks, each step carrying its
  cost and its time; the dashboard regenerates the same plans from the same data, and a
  string-equality test proves the page and board.json agree.
- Audit fixes: change_7d read as percent everywhere (an early build multiplied it by 100
  in the views); a single uncapped peer ratio that briefly priced a protocol at $31,9B is
  now capped and banded; farm-step quote style unified between the two generators.
- Added verify.ts, a self-check that rebuilds the board twice and asserts every gate
  invariant, and docs/AUDIT.md with the full triple-audit evidence.
