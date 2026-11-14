// Self-verification for the Token Launch Radar: builds the board twice from a snapshot and
// asserts every invariant the sealed gate checks, plus reproducibility. Run it before handing
// anything in:
//
//   node verify.ts --input <snapshot.json|directory>
//
// Exit code 0 means every assertion held; the first failure prints its reason and exits 1.
// Standard library only, like the entry itself.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { boardIssue, buildBoard, isPreToken, parseSnapshot, setAsideReason } from './lib/model.ts';

function fail(message: string): never {
  process.stderr.write(`verify: FAIL — ${message}\n`);
  process.exit(1);
}

const args = process.argv.slice(2);
const at = args.indexOf('--input');
const inputArg = at >= 0 && at + 1 < args.length ? args[at + 1]! : '/input';
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');

let snapshot;
try {
  snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
} catch (err) {
  fail(`snapshot does not parse: ${(err as Error).message}`);
}

const board = buildBoard(snapshot);
const again = buildBoard(snapshot);

// The gate's own invariants, via the model's own checker.
const issue = boardIssue(board, snapshot);
if (issue !== null) fail(`boardIssue: ${issue}`);

// Coverage shape: the watchlist is the floor, and the board must reach past it.
if (board.length < 100) fail(`board has ${board.length} rows, under the gate's 100-row floor`);
if (board.length > 4000) fail(`board has ${board.length} rows, over the gate's 4000-row cap`);
const watchlist = new Set(snapshot.watchlist);
const early = board.filter((r) => !watchlist.has(r.slug)).length;
if (early === 0) fail('board carries no protocol below the watchlist floor');

// No ranked row may be a tokenized protocol, an exchange, or a duplicate.
const seen = new Set<string>();
for (const row of board) {
  if (row.mcap_usd !== null || row.gecko_id !== null || row.symbol !== null) fail(`${row.slug} is ranked but records a token`);
  if (row.category === 'CEX') fail(`${row.slug} is ranked but is an exchange`);
  if (seen.has(row.slug)) fail(`${row.slug} appears twice`);
  seen.add(row.slug);
}

// No ranked row outside the watchlist floor may be one the model itself sets aside, and every
// row's range must bracket its value (boardIssue checks this too; here it is asserted directly).
const bySlug = new Map(snapshot.protocols.map((p) => [p.slug, p]));
const tokenizedNames = new Set(snapshot.protocols.filter((q) => !isPreToken(q)).map((q) => q.name.trim().toLowerCase()));
for (const row of board) {
  if (!watchlist.has(row.slug)) {
    const reason = setAsideReason(bySlug.get(row.slug)!, tokenizedNames);
    if (reason !== null) fail(`${row.slug} is ranked but the model sets it aside: ${reason}`);
  }
  if (!(row.implied_low_usd <= row.implied_value_usd && row.implied_value_usd <= row.implied_high_usd)) {
    fail(`${row.slug} has a range that does not bracket its implied value`);
  }
  if (row.farm_steps.length !== 9) fail(`${row.slug} has ${row.farm_steps.length} farm steps, not nine`);
}

// Reproducibility: the same snapshot must produce the same board, byte for byte.
if (JSON.stringify(board) !== JSON.stringify(again)) fail('two builds of the same snapshot differ');

process.stdout.write(
  `verify: PASS — ${board.length} rows (${watchlist.size} watchlist + ${early} early), ` +
    `ranks ordered, steps within caps, no tokenized row ranked, builds reproducible\n`,
);
