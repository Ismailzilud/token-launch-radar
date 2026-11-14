// Token Launch Radar (token-radar-01 entry): a program that turns the sealed DefiLlama snapshot
// into a ranked pre-token board, a static dashboard, and the dossier the judge reads.
//
//   node main.ts [--input <snapshot.json|directory>] [--output <directory>]
//
// Input defaults to the grader's /input mount; output defaults to /output (or $MAKEFUN_OUTPUT_DIR
// outside the container). The program refuses to write a board the sealed gate would refuse: the
// model's own boardIssue runs before anything touches disk. Screenshots are this repository's own
// captures of this dashboard and are copied as-is; the dossier is written last, from the finished
// output directory, with the vendored make.fun library — byte for byte the scorer's own copy.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's published caps: the dossier's text budget and the screenshot rules. */
const DOSSIER_TEXT_MAX = 65_536;
const SCREENSHOTS_CAP = { max: 4, max_bytes: 524_288 };
const DASHBOARD_CAP = { max_files: 400, max_bytes: 4_194_304 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** The value of `--name <value>` or `--name=<value>` among the arguments, else the fallback. */
function argument(name: string, fallback: string): string {
  const args = process.argv.slice(2);
  const at = args.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < args.length) return args[at + 1]!;
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  return inline === undefined ? fallback : inline.slice(name.length + 3);
}

/** Copy a directory's regular, non-hidden files into `target`; return the names copied. */
function copyFlat(source: string, target: string): string[] {
  if (!existsSync(source)) return [];
  mkdirSync(target, { recursive: true });
  const names: string[] = [];
  for (const name of readdirSync(source)) {
    if (name.startsWith('.')) continue;
    const from = join(source, name);
    if (!statSync(from).isFile()) continue;
    copyFileSync(from, join(target, name));
    names.push(name);
  }
  return names;
}

function run(): void {
  const inputArg = argument('input', process.env.MAKEFUN_INPUT_DIR ?? '/input');
  const snapshotPath = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
  if (!existsSync(snapshotPath)) {
    process.stderr.write(`token radar: no snapshot at ${snapshotPath} — pass --input <snapshot.json|directory> or mount the sealed input\n`);
    process.exit(2);
  }
  const outDir = argument('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

  const snapshot = parseSnapshot(readFileSync(snapshotPath, 'utf8'));
  const { board, radar } = buildRadar(snapshot);
  const issue = boardIssue(board, snapshot);
  if (issue !== null) {
    process.stderr.write(`token radar: refusing to write a board the gate would refuse: ${issue}\n`);
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
  writeFileSync(join(outDir, 'data.js'), dataScript(radar));

  const dashFiles = copyFlat(join(repoDir, 'dashboard'), join(outDir, 'dashboard'));
  const shots = copyFlat(join(repoDir, 'screenshots'), join(outDir, 'screenshots'));
  if (shots.length < 3) {
    process.stderr.write(`token radar: screenshots/ holds ${shots.length} image(s); the gate wants 3 or 4 — the board, a detail view, a filtered view\n`);
    process.exit(1);
  }
  for (const name of shots) {
    if (!IMAGE_NAME.test(name)) {
      process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
      process.exit(1);
    }
  }

  // Last, from the finished output: the dossier the scorer rebuilds and compares byte for byte.
  const dossier = buildDossier(outDir, {
    text_max_bytes: DOSSIER_TEXT_MAX,
    screenshots: SCREENSHOTS_CAP,
    dashboard: DASHBOARD_CAP,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  process.stdout.write(
    `token radar: ${snapshot.protocols.length} protocols read, ${snapshot.watchlist.length} on the watchlist, ` +
      `${board.length} pre-token rows ranked (${radar.early_size} below the watchlist floor), ${radar.live_size} live-token rows set aside\n` +
      `token radar: wrote board.json, data.js, dashboard/ (${dashFiles.length} files), screenshots/ (${shots.length} images) and dossier.json under ${outDir}\n`,
  );
}

run();
