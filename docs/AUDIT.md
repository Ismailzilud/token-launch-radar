# OMEGA Triple Audit — token-radar-01 entry (2026-11-14, after commit a01331f)

## Pass 1 — Functional (headless Chrome against the real generated output)
- F1 board DOM rows == board.json (order + rank + slug): PASS 274/274
- F2 search filter: PASS (1 row for "steakhouse")
- F3 chain filter Ethereum: PASS 124/124 exact
- F4 confidence filter high: PASS 104/104 (an initial "fail" was a test bug — the test
  read BoardRow.confidence instead of model.confidence; recounted against data.js)
- F5 watchlist-only: PASS 40 rows
- F6 sort by TVL: PASS (first row = max TVL $2,76B)
- F7 live tab: PASS 24 rows
- F8 model tab + category calibration table: PASS 33 categories, method visible
- F9 detail farm steps vs board.json (4 samples across categories): FAIL → fixed → PASS.
  Cause: step 6 used typographic quotes in the page generator vs straight quotes in
  lib/model.ts. Generators unified; screenshots recaptured; exact string equality now.
- Page errors during all interactions: none.

## Pass 2 — Adversarial
- A1 malformed snapshots (13 cases: empty, missing watchlist slug, duplicate slugs,
  negative/zero/1e15 TVL, change_7d = 1e9, garbage/future listed_at, 1000-char name,
  null category, empty chains, invalid JSON, missing fields): all handled — clean
  SnapshotError for unparseable input, boardIssue refusal for a missing watchlist slug,
  no invalid row (unsafe integer, non-positive implied, out-of-cap step) in any board.
- A2 XSS: poisoned snapshot (img onerror in name, script in category, quote breakout in
  chain) renders as inert text in board and detail; window.__pwned never set.
- A3 determinism: two full runs → board.json and dossier.json byte-identical (md5).
- A4 performance: full program run 0,27 s on the sealed snapshot.
- A5 offline: request interception logged ZERO external requests from the dashboard.

## Pass 3 — Judge audit vs the published rubric (RULES.txt lines 47–52)
1. Working radar — VERIFIED: watchlist 40/40, every row states its implied value and
   factors, 234 rows below the floor, screenshots↔code agreement proven by F1/F9.
2. Value model — VERIFIED as designed: implied value is a function of snapshot figures
   only (TVL, 7-day growth, tokenless age, peer calibration from the snapshot's own
   tokenized rows). No protocol receives a hand-set value; the only name patterns in the
   code are classification rules (wrapped assets, exchange-group products, versioned
   pools) applied uniformly. Tokenized protocols are separated into the Live view and
   never ranked.
3. Farm plans — VERIFIED: 7 steps per row, every step carries a cost and a time
   (string-checked across all 274 rows), first two steps are category-specific actions.
4. Dashboard as a page — VERIFIED by F2–F9: sortable, filterable (search/category/
   chain/confidence/watchlist), detail view per protocol, glanceable cover.
5. Looks made — VERIFIED as fact (own palette, spacing system, type scale; no framework;
   5,6 KB hand-written CSS); how a judge weighs it is not measurable locally.

## Scorecard
- VERIFIED: sealed-gate compliance 7/7 rows; functional tests F1–F9 pass; adversarial
  suite A1–A5 pass; rubric criteria 1–4 evidenced as above.
- ESTIMATED: none offered — no local proxy for the pairwise AI judge exists.
- UNKNOWN: dev-phase win rate and final placement. The judge compares dossiers pairwise
  against the field and four house anchors; that number exists only on make.fun's server.

## Residual weaknesses (accepted, documented in the dashboard itself)
- Top of the board concentrates in Risk Curators calibrated by a single trading peer
  (multiple at the 3× band cap, labelled low confidence in the UI).
- A few records remain judgment calls (e.g. USDD: a traded stablecoin asset whose
  protocol could still issue a governance token).
- The board inherits the snapshot's own data quirks; change_7d spikes (max +4.448%) are
  clamped by the model rather than investigated per protocol.
