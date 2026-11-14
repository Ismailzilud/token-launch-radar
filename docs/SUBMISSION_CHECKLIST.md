# Submission checklist — token-radar-01

State at the radar-3 improvement pass (2026-11-15). Items marked "at submit" can only be
verified by the server when the entry is actually submitted.

- [x] Program runs on the sealed snapshot and writes board.json, dashboard/, screenshots/
      and dossier.json (`node main.ts --input <dir> --output <dir>`).
- [x] Sealed gate: dashboard ≤400 files / ≤4 MiB / offline; board 196 rows (100–4000) with
      ranks 1..n in descending implied value; watchlist coverage 40/40; farm steps 9
      per row, 20–600 chars each; 3 screenshots 1440×900 ≤512 KiB; dossier ≤1.5 MiB with
      the full dashboard source inside the 65,536-byte text budget.
- [x] verify.ts passes on the sealed snapshot (now also asserting no set-aside record is
      ranked outside the watchlist floor, ranges bracket values, nine steps per row);
      two builds are byte-identical.
- [x] Dashboard consistency proven in a real browser: the page recomputes 196/196 rows
      to the same dollar as board.json, and regenerated farm plans are string-identical
      to board.json on every sampled row (100 rows in the first pass, all 16 previously
      failing RWA rows plus the watchlist-floor rows in the recheck).
- [x] Screenshots are genuine captures of the shipped dashboard at 1440×900, recaptured
      after the last code change.
- [x] No secrets in the repo (pattern scan clean); vendor/ and LICENSE untouched since
      the starter commit.
- [ ] Official kit check on the final commit: ok = true, failed = [] (run at submit).
- [ ] At submit: repo is public and owned by the submitting account; the commit is in
      the repo; the snapshot is not a duplicate of another entry.
- [ ] At submit: competition login approved; final submission confirmed by the owner.
