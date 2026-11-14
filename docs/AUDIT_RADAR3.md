# Radar-3 improvement audit (2026-11-15)

Why radar-3 exists, what evidence drove each change, and how the result was validated.
The radar-2 triple audit remains in docs/AUDIT.md; this addendum covers only the delta.

## Evidence base

- The submitted radar-2 entry scored a dev-phase judge win rate of 93.21% (rank 299 of
  2,508, 20 sampled matches, no losses) — strong, but outside the top-10 prize zone.
- The top of the dev leaderboard (95.1–95.9%) was studied from the only public evidence
  available before the 14 Dec source unsealing: the judge-artifact dashboard images and
  API metadata of the top entries. Convergent findings across ranks 1, 2, 3, 5, 6, 8, 9, 13:
  (a) every top-5 model prices off a fitted size curve, not category constants;
  (b) the field's board converges on ~198 ranked rows from the same 342 tokenless records —
  bridges, staking/restaking receipts, staking pools and wrappers are set aside;
  (c) backtest or calibration statistics are displayed, not just claimed;
  (d) farm economics are concrete per row (tickets, per-$1k yields).
- radar-2's own defect, measured on the sealed snapshot: its Risk Curators multiple came
  from a single trading peer, band-capped at 3× the global median, and did not decay with
  size — the board's #1 row (Steakhouse Financial, $2.75B TVL) was priced at $1.70B, where
  the fitted-curve entries price the same protocol at $65M–$438M.

## Changes and their local measurements (sealed snapshot, leave-one-out)

| Model | LOO median miss | Within ×2 |
|---|---|---|
| radar-2 (category median + band, old seasoning) | ×5.20 | 20% |
| Flat global median, no seasoning | ×4.94 | 30% |
| radar-3 (size curve + category effect + seasoning) | ×3.24 | 34% |

- Fitted curve on 119 comps: level ×0.144 at $100M TVL, slope −0.528 per decade —
  the same shape the top entries publish (×0.165 @ $100M, slope −0.445; TVL^0.446 value
  curves), fitted here from the snapshot itself, not copied.
- Steakhouse Financial reprices from $1.70B (radar-2) to $87.7M (radar-3).
- Board 259 → 196 rows; the 146 set-aside tokenless records are listed with reasons in a
  new dashboard view (funnel: 758 = 416 trading + 196 ranked + 146 set aside).
- Farm plans 7 → 9 steps (sizing by modelled claim; launch-signal hygiene). Every row
  gains a value range (the backtest's middle-half band, ×0.22–×2.65) and an
  airdrop-per-$1k yardstick under a stated 10%-to-depositors assumption.

## Validation

- `node verify.ts` passes (extended with set-aside, range-bracket and nine-step asserts);
  two builds byte-identical.
- Real-browser checks (local Chromium over the shipped dashboard): the page's own
  recomputation matches board.json on 196/196 rows; dashboard-regenerated farm plans are
  string-identical to board.json across 100 sampled rows in the first pass and across all
  previously failing rows in the recheck (one apostrophe divergence in the RWA playbook
  branch was found by this test and fixed).
- Screenshots recaptured from the shipped dashboard at 1440×900 after the last change.
- Official kit check on the final commit: see the submission record (run at submit time).

## Known remaining weaknesses

- The judge's dev sample is 20 matches with a 90% interval of ±1.75pp around radar-2's
  score; radar-3's improvement is measured by backtest and by field convergence, not by a
  guaranteed dev-score delta. The final phase re-judges every dossier from scratch.
- Risk Curators still calibrates from a single trading peer; the category effect is
  shrunk and clamped, and the rows carry low confidence, but the category remains the
  board's thinnest evidence.
- The airdrop yardstick's 10%-to-depositors assumption is a sizing convention, stated on
  the page; real distributions, if any, will differ.
