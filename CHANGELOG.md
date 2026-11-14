# Changelog

All notable changes to the Token Launch Radar entry. The model is deterministic: the same
snapshot always produces the same board, so every entry below is reproducible from the
commit it names.

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
