#!/usr/bin/env node
/**
 * Commit-Prüfung (CR-GC-848): Fluss gegen Aufruf (RC-12), Aufruf ohne Fluss (RC-13), `realRef` (RC-01).
 *
 * Läuft im pre-commit-Hook, sobald eine `.ts`-Datei gestaget ist. Das Modell ist der GESTAGTE Snapshot
 * (`docs/graph/*.graph.json` im Index), der Code ist der Arbeitsbaum. Gemeldet wird jeder Befund, dessen FUNC- oder
 * FLOW-`realRef` in einer gestagten Datei liegt; ein Paar zählt mit, wenn eine seiner Seiten dort liegt. Ein
 * solcher Befund bricht den Commit ab. Befunde an Dateien, die der Commit nicht anfasst, nennt die Prüfung als Zahl.
 *
 * Die Regeln urteilt contracts, die Aufrufe liefert `extractCallFacts` — dieselbe `conformanceEvaluation`, die
 * `rules_evaluate` fährt. Das Skript liest nur den Index und filtert.
 *
 * Exit 0: nichts zu melden. Exit 1: Befunde an gestagten Dateien, oder die Prüfung konnte nicht laufen.
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { relative } from 'node:path';
import { readCallScope } from '../dist/kernel/call-edges.js';
import { conformanceEvaluation, extractCodeFacts } from '../dist/kernel/conformance.js';
import { snapshotPathOf, snapshotToGraph } from '../dist/projections/test-selection-audit.js';

const RULES = new Set(['RC-01', 'RC-12', 'RC-13']);
const t0 = performance.now();
const log = (s) => process.stderr.write(`[commit-pruefung] ${s}\n`);
const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const lines = (s) => s.split('\n').filter(Boolean);

const repoRoot = git(['rev-parse', '--show-toplevel']).trim();
const staged = new Set(lines(git(['diff', '--cached', '--name-only', '--no-renames'], repoRoot)));
const deleted = new Set(lines(git(['diff', '--cached', '--name-only', '--no-renames', '--diff-filter=D'], repoRoot)));
const scope = new Set(readCallScope(repoRoot) ?? []);
const touched = [...staged].filter((f) => f.endsWith('.ts') && (scope.has(f) || deleted.has(f)));
if (touched.length === 0) {
  log('keine gestagte .ts-Datei unter callScope — RC-01/RC-12/RC-13 laufen nicht.');
  process.exit(0);
}

const snapshot = relative(repoRoot, snapshotPathOf(repoRoot));
const graph = snapshotToGraph(JSON.parse(git(['show', `:${snapshot}`], repoRoot)));
const ev = conformanceEvaluation({ getGraph: () => graph, getRepoRoot: () => repoRoot });
const byId = new Map(graph.nodes.map((n) => [n.uid, n]));
const refOf = (uid) => byId.get(uid)?.attributes?.realRef;
const siteOf = (uid) => {
  const r = refOf(uid);
  return r ? `${r.file}#${r.symbol ?? ''}` : `${uid} (ohne realRef)`;
};
const inCommit = (...uids) => uids.some((u) => staged.has(refOf(u)?.file));

/** Die Felder, die die Meldung trägt — aus dem Wortlaut der Regel in contracts. Passt er nicht, ist der Vertrag gebrochen. */
const RC12 = /^(\S+) is sync, but no call between (\S+) and (\S+) within (\d+) calls/;
const RC13 = /^(\S+) calls (\S+) without a flow — path: (.+)$/;
const parse = (re, v) => {
  const m = re.exec(v.message);
  if (!m) throw new Error(`${v.ruleId}: Meldung passt nicht zum Vertrag aus contracts — ${v.message}`);
  return m;
};

/**
 * Neu deklarierte Symbole einer Datei: im Arbeitsbaum deklariert, in einer gegenüber HEAD hinzugefügten Zeile genannt,
 * in keiner entfernten. Verglichen wird der Arbeitsbaum, denn den liest auch die Prüfung. Ohne HEAD gibt es keinen
 * Vergleich und damit keinen Vorschlag.
 */
let facts;
const hasHead = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'HEAD'], { cwd: repoRoot }).status === 0;
function newSymbols(file) {
  if (!hasHead) return [];
  facts ??= extractCodeFacts(graph, repoRoot);
  const declared = facts.files[file]?.declaredSymbols ?? [];
  const diff = git(['diff', 'HEAD', '-U0', '--', file], repoRoot).split('\n');
  const ids = (prefix) => new Set(diff.filter((l) => l.startsWith(prefix) && !l.startsWith(prefix.repeat(3))).flatMap((l) => l.match(/[A-Za-z_$][\w$]*/g) ?? []));
  const added = ids('+');
  const removed = ids('-');
  return declared.filter((s) => added.has(s) && !removed.has(s));
}
/** Wohin eine gestagte Umbenennung die Datei gelegt hat. */
function renamedTo(file) {
  for (const l of lines(git(['diff', '--cached', '-M', '--name-status', '--diff-filter=R'], repoRoot))) {
    const [, from, to] = l.split('\t');
    if (from === file) return to;
  }
  return undefined;
}

function rc01(v) {
  const r = refOf(v.elementId);
  const missingFile = /does not exist on disk/.test(v.message);
  const file = missingFile ? (renamedTo(r.file) ?? '<neue Datei>') : r.file;
  const candidates = missingFile ? [] : newSymbols(r.file);
  const symbol = missingFile ? r.symbol : candidates.length === 1 ? candidates[0] : '<neues Symbol>';
  const ref = JSON.stringify({ ...r, file, ...(r.symbol !== undefined ? { symbol } : {}) });
  return [
    `RC-01  ${v.elementId}: ${missingFile ? `realRef-Datei ${r.file} fehlt` : `${r.symbol} ist in ${r.file} nicht deklariert`}`,
    `  Weg im Code: ${siteOf(v.elementId)}`,
    ...(candidates.length > 1 ? [`  neu deklariert: ${candidates.join(', ')}`] : []),
    `  Zug (update-node): ~ ${v.elementId}`,
    `                     @realRef ${ref}`,
  ];
}
function rc12(v) {
  const [, flow, a, b, max] = parse(RC12, v);
  return [
    `RC-12  ${flow}: ${a} → ${b} ist sync, im Code ruft keine Seite die andere`,
    `  Weg im Code: keiner zwischen ${siteOf(a)} und ${siteOf(b)} (höchstens ${max} Aufrufe, beide Richtungen)`,
    `  Zug: ${v.fixHint}`,
  ];
}
function rc13(v) {
  const [, a, b, path] = parse(RC13, v);
  return [`RC-13  ${a} → ${b}: Aufruf ohne Fluss`, `  Weg im Code: ${path}`, `  Zug: ${v.fixHint}`];
}

const reported = [];
let outside = 0;
for (const v of ev.violations.filter((x) => RULES.has(x.ruleId))) {
  const ends =
    v.ruleId === 'RC-12' ? [v.elementId, ...parse(RC12, v).slice(2, 4)] : v.ruleId === 'RC-13' ? parse(RC13, v).slice(1, 3) : [v.elementId];
  if (!inCommit(...ends)) {
    outside += 1;
    continue;
  }
  reported.push(v.ruleId === 'RC-01' ? rc01(v) : v.ruleId === 'RC-12' ? rc12(v) : rc13(v));
}

const ms = Math.round(performance.now() - t0);
const rest = outside ? `; ${outside} Befund(e) an Dateien ausserhalb dieses Commits` : '';
if (reported.length === 0) {
  log(`RC-01/RC-12/RC-13: 0 Befunde an ${touched.length} gestagten .ts-Datei(en)${rest} (${ms} ms).`);
  process.exit(0);
}
process.stderr.write(`BLOCKED (CR-GC-848): ${reported.length} Befund(e) an gestagten Dateien — Modell und Code passen nicht.\n`);
for (const block of reported) process.stderr.write(block.join('\n') + '\n');
process.stderr.write(
  `Den Zug über graph_mutate anwenden, graph_export, dann erneut committen. Gegen den gestagten Snapshot ${snapshot} geprüft${rest} (${ms} ms).\n`,
);
process.exit(1);
