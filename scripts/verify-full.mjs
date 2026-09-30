#!/usr/bin/env node
/**
 * `npm run verify:full <CR-ID>` (CR-GC-718) — der Volllauf vor dem CR-Abschluss, gemessen.
 *
 * Fährt die ganze Suite und hält fest, ob ein roter Test AUSSERHALB der Auswahl lag, die
 * `verify:code` für dieselbe Änderung getroffen hätte (Schlupf). Die Zeile landet in
 * `docs/messung/testauswahl.jsonl`; nach SCHLUPF_SCHWELLE CRs der CODE-Spur ohne Schlupf
 * entfällt der Volllauf je CR (CI und Publish fahren ihn weiter).
 *
 * Änderung eines CR = alle Dateien der Commits, deren Nachricht die CR-ID trägt, plus der
 * Arbeitsbaum. Auswahl und Zusage kommen aus denselben Funktionen wie `verify:code`
 * (`selectForChange`/`planCodeLane`) — kein zweiter Pfad. Setzt einen aktuellen Build voraus.
 *
 * Usage: node scripts/verify-full.mjs <CR-ID>
 *
 * @author andreas@siglochconsulting
 */
import { spawnSync, execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { buildContext, planCodeLane, selectForChange } from '../dist/projections/test-selection-audit.js';
import { INCLUDED as MODEL_TESTS } from './model-test-set.mjs';
import { blackboxBindung, leseSchlupfZeilen, schlupfFreieFolge, schlupfVon, SchlupfZeileSchema, SCHLUPF_SCHWELLE } from '../dist/projections/test-schlupf.js';

const cr = process.argv[2];
if (!cr || !/^CR-[A-Z]+-\d+[A-Z]?$/.test(cr)) {
  console.error('Usage: node scripts/verify-full.mjs <CR-ID>   (z. B. CR-GC-718)');
  process.exit(2);
}
const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const git = (args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });

const ausCommits = git(['log', `--grep=${cr}`, '--name-only', '--format=']).split('\n').filter(Boolean);
const ausBaum = git(['status', '--porcelain']).split('\n').filter(Boolean).map((l) => l.slice(3).trim().split(' -> ').pop());
const files = [...new Set([...ausCommits, ...ausBaum])].filter((f) => existsSync(join(repoRoot, f)));

const ctx = buildContext(repoRoot);
const plan = planCodeLane(files, ctx, { modelTests: MODEL_TESTS });
const auswahl = selectForChange(files, ctx);
const zusage = blackboxBindung(ctx.graph);

const tmp = mkdtempSync(join(tmpdir(), 'verify-full-'));
const bericht = join(tmp, 'vitest.json');
const res = spawnSync('npx', ['vitest', 'run', '--reporter=default', '--reporter=json', `--outputFile.json=${bericht}`], {
  stdio: 'inherit',
  cwd: repoRoot,
});
let rot = [];
let gesamt = ctx.allTests.length;
if (existsSync(bericht)) {
  const json = JSON.parse(readFileSync(bericht, 'utf8'));
  gesamt = json.testResults.length;
  rot = json.testResults.filter((t) => t.status === 'failed').map((t) => relative(repoRoot, t.name)).sort();
}
rmSync(tmp, { recursive: true, force: true });

const spur = plan.lane;
const { schlupf, schlupfNurGraph } = schlupfVon(rot, spur === 'CODE' ? plan.files : ctx.allTests, auswahl.graphOnly);
const zeile = SchlupfZeileSchema.parse({
  cr,
  at: new Date().toISOString(),
  code: git(['rev-parse', '--short', 'HEAD']).trim(),
  spur,
  ausgewaehlt: spur === 'CODE' ? plan.files.length : gesamt,
  ausGraph: auswahl.graphOnly.length,
  gesamt,
  rot,
  schlupf,
  schlupfNurGraph,
  zusage,
});
const ziel = join(repoRoot, 'docs/messung/testauswahl.jsonl');
mkdirSync(join(repoRoot, 'docs/messung'), { recursive: true });
appendFileSync(ziel, JSON.stringify(zeile) + '\n');

const alle = leseSchlupfZeilen(readFileSync(ziel, 'utf8'));
const folge = schlupfFreieFolge(alle);
const pct = (t) => (t.total === 0 ? '—' : `${Math.round((100 * t.gebunden) / t.total)} %`);
console.error(`[verify:full] ${cr}: Spur ${spur}, Auswahl ${zeile.ausgewaehlt}/${gesamt} (Graph ${zeile.ausGraph}), rot ${rot.length}, Schlupf ${schlupf.length} (nur Graph ${schlupfNurGraph.length}).`);
for (const f of schlupf) console.error(`[verify:full]   Schlupf: ${f}`);
console.error(
  `[verify:full] Zusage: Blackbox-Tests ${zusage.blackbox.gebunden}/${zusage.blackbox.total} gebunden (${pct(zusage.blackbox)}), ` +
    `Schnittstellen ${zusage.schnittstelle.gebunden}/${zusage.schnittstelle.total} (${pct(zusage.schnittstelle)}).`,
);
console.error(
  folge >= SCHLUPF_SCHWELLE
    ? `[verify:full] ${folge} CRs der CODE-Spur ohne Schlupf — der Volllauf je CR ist verzichtbar (CI + Publish bleiben).`
    : `[verify:full] Folge ohne Schlupf: ${folge}/${SCHLUPF_SCHWELLE} — bis dahin bleibt der Volllauf vor jedem CR-Abschluss.`,
);
process.exit(res.status ?? 1);
