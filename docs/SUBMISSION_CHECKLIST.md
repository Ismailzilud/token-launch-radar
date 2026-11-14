# Submission checklist — token-radar-01

State at the final optimizer pass (2026-11-14). Items marked "at submit" can only be
verified by the server when the entry is actually submitted.

- [x] Program runs on the sealed snapshot and writes board.json, dashboard/, screenshots/
      and dossier.json (`node main.ts --input <dir> --output <dir>`).
- [x] Sealed gate: dashboard ≤400 files / ≤4 MiB / offline; board 274 rows (100–4000) with
      ranks 1..n in descending implied value; watchlist coverage 40/40; farm steps 3–12
      per row, 20–600 chars each; 3 screenshots 1440×900 ≤512 KiB; dossier ≤1.5 MiB with
      the full dashboard source inside the 65,536-byte text budget.
- [x] verify.ts passes on the sealed snapshot; two builds are byte-identical.
- [x] Official kit check on the final commit: ok = true, failed = [] (authorship checks
      pass — every entry file was written across multiple turns of the building session).
- [x] Screenshots are genuine captures of the shipped dashboard at 1440×900, recaptured
      after the last code change; page and board farm plans are string-identical.
- [x] No secrets in the repo (pattern scan clean); vendor/ and LICENSE untouched since
      the starter commit.
- [ ] At submit: repo is public and owned by the submitting account; the commit is in
      the repo; the snapshot is not a duplicate of another entry.
- [ ] At submit: competition login approved; final submission confirmed by the owner.
