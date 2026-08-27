/**
 * Messinstrument zur selektiven Testauswahl (CR-GC-381, Instrument zu
 * SPIKE-GC-selective-tests) — die Logik hinter `scripts/test-selection-audit.mjs`.
 *
 * Beantwortet reproduzierbar die vier Fragen des Spikes:
 *   M1 Quellseite — Quelldateien mit Knoten ÷ Quelldateien auf Disk
 *   M3 Testseite  — Testdateien mit TEST-Knoten ÷ Testdateien auf Disk
 *   M2 Recall     — Graph-Auswahl ∩ direkt importierende Tests ÷ direkt importierende Tests
 *   M8 Potenzial  — Auswahl je Commit über die letzten n Commits gegen den Volllauf
 *
 * Quelle ist der COMMITTETE Snapshot (`docs/graph/*.graph.json`), nie der Kuzu-Store:
 * der MCP-Server besitzt das einzige Handle (REQ-single-kuzu-owner). Die Kantensemantik
 * kommt aus `impactedTests()` — dieselbe Funktion, die `graph_tests` benutzt, kein
 * nachgebauter zweiter Pfad.
 *
 * Vergleichsmaßstab für M2/M8 ist der DIREKTE Import, nicht die transitive Hülle: über
 * die Hub-Module importiert fast jeder Test fast alles, damit wäre jede Auswahl trivial
 * "unvollständig". Der direkte Import unterschätzt eher (ein Test kann eine FUNC über die
 * CLI treiben, ohne sie zu importieren) — die gemessene Lücke ist eine UNTERE Schranke.
 *
 * @author andreas@siglochconsulting
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, normalize, relative } from 'node:path';
import type { Graph, GraphNode } from '@sigloch/graph-api-core';
import { impactedTests } from './test-selection.js';

/** Änderungen hieran wirken auf JEDEN Test — sie können nie selektiv laufen. */
const FULL_RUN_TRIGGERS = [/^package(-lock)?\.json$/, /^tsconfig/, /^vitest\.config\./];

export const isTestFile = (p: string): boolean => /\.test\.tsx?$/.test(p);
export const isSourceFile = (p: string): boolean => /\.tsx?$/.test(p) && !isTestFile(p) && !p.endsWith('.d.ts');

/** Alle Dateien unterhalb `dir`, die `pred` erfüllen — ohne node_modules/dist/dotdirs. */
export function walk(dir: string, pred: (p: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, pred, out);
    else if (pred(path)) out.push(path);
  }
  return out;
}

interface SnapshotElement extends Record<string, unknown> {
  id: string;
  type: string;
  name?: string;
  description?: string;
}
interface Snapshot {
  elements: SnapshotElement[];
  traces: Array<{ source: string; target: string; type: string }>;
}

/**
 * Snapshot (`{elements, traces}`) → Store-Graph (`{nodes, edges}`), damit
 * `impactedTests` beide Quellen gleich sieht.
 */
export function snapshotToGraph(snapshot: Snapshot): Graph {
  const nodes: GraphNode[] = snapshot.elements.map((el) => {
    const { id, type, name, description, ...attributes } = el;
    return { uid: id, type, name: name ?? id, description: description ?? '', attributes } as GraphNode;
  });
  const edges = snapshot.traces.map((t) => ({ sourceId: t.source, edgeType: t.type, targetId: t.target, attributes: {} }));
  return { nodes, edges };
}

/** Datei → Knoten über `realRef` (die feine Ebene). */
export function fileToNodes(graph: Graph): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const node of graph.nodes) {
    const file = (node.attributes?.realRef as { file?: string } | undefined)?.file;
    if (!file) continue;
    const bucket = map.get(file);
    if (bucket) bucket.push(node.uid);
    else map.set(file, [node.uid]);
  }
  return map;
}

/** MOD-Knoten mit `path` — die grobe Auflösung für Dateien ohne eigenen Knoten. */
export function modPaths(graph: Graph): Array<{ uid: string; path: string }> {
  return graph.nodes
    .filter((n) => n.type === 'MOD' && typeof n.attributes?.path === 'string')
    .map((n) => ({ uid: n.uid, path: String(n.attributes.path).replace(/\/+$/, '') }));
}

/** Die Knoten, über die eine geänderte Datei aufgelöst wird — fein vor grob. */
export function nodesForFile(file: string, byFile: Map<string, string[]>, mods: Array<{ uid: string; path: string }>): string[] {
  const exact = byFile.get(file);
  if (exact?.length) return exact;
  const owner = mods
    .filter((m) => file === m.path || file.startsWith(`${m.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return owner ? [owner.uid] : [];
}

/** TEST-Knoten → die Dateien, die sie als Evidenz-Adresse tragen. */
export function testFilesOf(graph: Graph, testIds: string[]): { files: string[]; unresolved: string[] } {
  const byUid = new Map(graph.nodes.map((n) => [n.uid, n]));
  const files = new Set<string>();
  const unresolved: string[] = [];
  for (const uid of testIds) {
    const refs = byUid.get(uid)?.attributes?.testRefs as Array<{ file?: string }> | undefined;
    if (!Array.isArray(refs) || refs.length === 0) {
      unresolved.push(uid);
      continue;
    }
    for (const ref of refs) if (ref?.file) files.add(ref.file);
  }
  return { files: [...files].sort(), unresolved };
}

/** Testdatei → die Quelldateien, die sie DIREKT importiert (das Vergleichsorakel). */
export function directImports(repoRoot: string, testFiles: string[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const testFile of testFiles) {
    const text = readFileSync(join(repoRoot, testFile), 'utf8');
    const targets = new Set<string>();
    for (const match of text.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const base = normalize(join(dirname(testFile), match[1])).replace(/\.js$/, '.ts');
      for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
        const abs = join(repoRoot, candidate);
        if (existsSync(abs) && statSync(abs).isFile()) targets.add(candidate);
      }
    }
    map.set(testFile, targets);
  }
  return map;
}

/** Alles, was die Kennzahlen brauchen — einmal gelesen, an alle weitergereicht. */
export interface AuditContext {
  graph: Graph;
  byFile: Map<string, string[]>;
  mods: Array<{ uid: string; path: string }>;
  importsByTest: Map<string, Set<string>>;
  allSources: string[];
  allTests: string[];
}

export interface Selection {
  /** Die Dateien, die laufen müssen. */
  files: string[];
  /** Der Anteil, den ALLEIN der Graph beigetragen hat (für das A/B). */
  graphOnly: string[];
  /** false ⇒ die Auswahl ist NICHT hinreichend, es muss voll gelaufen werden. */
  complete: boolean;
  reason: string;
  unresolvedFiles: string[];
}

/**
 * Die Auswahl für einen ChangeSet von DATEIEN — inklusive der Fallback-Regel.
 *
 * `complete: false` heißt: mindestens eine geänderte Datei ist nicht auflösbar (kein
 * Knoten, oder ein Trigger wie `package.json`). Dann ist der Volllauf die einzige
 * ehrliche Antwort — eine leere Auswahl darf NIE zu `--passWithNoTests` werden, das
 * wäre ein grüner Lauf ohne einen einzigen Test.
 */
export function selectForChange(changedFiles: string[], ctx: AuditContext, opts: { assumeModelComplete?: boolean } = {}): Selection {
  const { graph, byFile, mods, importsByTest, allTests } = ctx;
  const selected = new Set(changedFiles.filter((f) => allTests.includes(f)));
  const graphOnly = new Set<string>();
  const unresolvedFiles: string[] = [];

  for (const file of changedFiles) {
    if (FULL_RUN_TRIGGERS.some((re) => re.test(file))) {
      return { files: [...allTests].sort(), graphOnly: [], complete: false, reason: `full run: ${file}`, unresolvedFiles: [file] };
    }
    if (allTests.includes(file) || !isSourceFile(file)) continue; // Doku/CR/Snapshot tragen keinen Test
    const nodes = nodesForFile(file, byFile, mods);
    if (nodes.length === 0) unresolvedFiles.push(file);
    else {
      for (const testFile of testFilesOf(graph, impactedTests(graph, nodes).testIds).files) {
        graphOnly.add(testFile);
        selected.add(testFile);
      }
    }
    for (const [testFile, imports] of importsByTest) if (imports.has(file)) selected.add(testFile);
  }

  // `assumeModelComplete` beantwortet die Deckenfrage des Spikes: was WÄRE die Auswahl,
  // wenn jede geänderte Datei einen Knoten hätte? Dann trägt das Import-Netz die Datei
  // und der Fallback entfällt. Nur fürs Messen — nie für einen echten Lauf.
  const complete = unresolvedFiles.length === 0 || opts.assumeModelComplete === true;
  return {
    files: complete ? [...selected].sort() : [...allTests].sort(),
    graphOnly: [...graphOnly].sort(),
    complete,
    reason: complete ? 'selective' : `full run: ${unresolvedFiles.length} unbound file(s)`,
    unresolvedFiles,
  };
}

export interface Coverage {
  sources: { total: number; bound: number; unbound: string[] };
  tests: { total: number; anchored: number; unanchored: string[] };
}

/** M1/M3 — was vom Repo überhaupt modelliert ist. */
export function coverage(ctx: AuditContext): Coverage {
  const { graph, byFile, mods, allSources, allTests } = ctx;
  // NUR TEST-Knoten zaehlen. `testRefs` an einem anderen Typ ist keine Abnahme, sondern
  // ein Bindungs-Irrlaeufer — real vorgefunden an FUNC-upgrade, wo er dem Audit eine
  // verankerte Datei vortaeuschte, die `graph_test_ingest` folgerichtig nicht aufloeste
  // (CR-GC-385). Ein Instrument, das eine Bindung am falschen Typ gutschreibt, meldet
  // genau die Vollstaendigkeit, die es pruefen soll.
  const anchored = new Set<string>();
  for (const node of graph.nodes) {
    if (node.type !== 'TEST') continue;
    const refs = node.attributes?.testRefs as Array<{ file?: string }> | undefined;
    if (Array.isArray(refs)) for (const ref of refs) if (ref?.file) anchored.add(ref.file);
  }
  const unbound = allSources.filter((f) => nodesForFile(f, byFile, mods).length === 0);
  const unanchored = allTests.filter((f) => !anchored.has(f));
  return {
    sources: { total: allSources.length, bound: allSources.length - unbound.length, unbound },
    tests: { total: allTests.length, anchored: allTests.length - unanchored.length, unanchored },
  };
}

export interface Recall {
  selected: number;
  coupled: number;
  hit: number;
  ratio: number;
  rows: Array<{ file: string; selected: number; coupled: number; hit: number }>;
}

/** M2 — Recall der reinen Graph-Auswahl gegen das Direkt-Import-Orakel. */
export function recall(ctx: AuditContext): Recall {
  const { graph, byFile, mods, importsByTest, allSources } = ctx;
  const rows: Recall['rows'] = [];
  let selected = 0;
  let coupled = 0;
  let hit = 0;
  for (const file of allSources) {
    const nodes = nodesForFile(file, byFile, mods);
    if (nodes.length === 0) continue;
    const picked = testFilesOf(graph, impactedTests(graph, nodes).testIds).files;
    const truth = [...importsByTest].filter(([, imports]) => imports.has(file)).map(([testFile]) => testFile);
    const intersection = picked.filter((f) => truth.includes(f));
    selected += picked.length;
    coupled += truth.length;
    hit += intersection.length;
    rows.push({ file, selected: picked.length, coupled: truth.length, hit: intersection.length });
  }
  return { selected, coupled, hit, ratio: coupled === 0 ? 1 : hit / coupled, rows };
}

export interface Potential {
  commits: number;
  /** Dateiläufe mit dem heutigen Modell UND dem ehrlichen Fallback (Volllauf bei Lücke). */
  selected: number;
  /** Dateiläufe, wenn jede geänderte Datei einen Knoten hätte — die Decke. */
  ceiling: number;
  graphOnly: number;
  full: number;
  savedPct: number;
  ceilingSavedPct: number;
  perCommit: Array<{ sha: string; selected: number; graphOnly: number; complete: boolean }>;
}

/** M8 — was die Auswahl über die letzten `n` Commits an Dateiläufen gespart hätte. */
export function potential(repoRoot: string, ctx: AuditContext, commits: number): Potential {
  const git = (args: string[]): string => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
  const shas = git(['log', `-n${commits}`, '--format=%H']).trim().split('\n').filter(Boolean);
  const perCommit: Potential['perCommit'] = [];
  let selected = 0;
  let ceiling = 0;
  let graphOnly = 0;
  for (const sha of shas) {
    const files = git(['show', '--name-only', '--format=', sha]).trim().split('\n').filter(Boolean);
    const result = selectForChange(files, ctx);
    selected += result.files.length;
    ceiling += selectForChange(files, ctx, { assumeModelComplete: true }).files.length;
    graphOnly += result.graphOnly.length;
    perCommit.push({ sha: sha.slice(0, 7), selected: result.files.length, graphOnly: result.graphOnly.length, complete: result.complete });
  }
  const full = shas.length * ctx.allTests.length;
  const saved = (n: number): number => (full === 0 ? 0 : 100 - (100 * n) / full);
  return { commits: shas.length, selected, ceiling, graphOnly, full, savedPct: saved(selected), ceilingSavedPct: saved(ceiling), perCommit };
}

/** Der Snapshot des Repos — der gleichnamige, sonst der einzige; keiner ist ein Fehler. */
export function snapshotPathOf(repoRoot: string): string {
  const dir = join(repoRoot, 'docs/graph');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.graph.json')) : [];
  if (files.length === 0) throw new Error(`test-selection-audit: kein Snapshot in ${dir}`);
  const own = files.find((f) => f === `${repoRoot.split('/').pop()}.graph.json`);
  return join(dir, own ?? files[0]);
}

export function buildContext(repoRoot: string, snapshotPath = snapshotPathOf(repoRoot)): AuditContext {
  const graph = snapshotToGraph(JSON.parse(readFileSync(snapshotPath, 'utf8')) as Snapshot);
  const allSources = walk(join(repoRoot, 'src'), isSourceFile).map((p) => relative(repoRoot, p));
  const allTests = walk(join(repoRoot, 'tests'), isTestFile).map((p) => relative(repoRoot, p));
  return { graph, byFile: fileToNodes(graph), mods: modPaths(graph), importsByTest: directImports(repoRoot, allTests), allSources, allTests };
}

/** Der ganze Bericht als Text — ein Aufruf, damit der Runner dünn bleibt. */
export function renderAudit(repoRoot: string, commits = 60): string {
  const snapshotPath = snapshotPathOf(repoRoot);
  const ctx = buildContext(repoRoot, snapshotPath);
  const cov = coverage(ctx);
  const rec = recall(ctx);
  const pot = potential(repoRoot, ctx, commits);
  const pct = (a: number, b: number): string => (b === 0 ? '—' : `${Math.round((100 * a) / b)} %`);
  const lines = [
    `test-selection-audit — ${snapshotPath}`,
    `  M1 Quellseite   ${cov.sources.bound}/${cov.sources.total} Dateien modelliert (${pct(cov.sources.bound, cov.sources.total)})`,
    `  M3 Testseite    ${cov.tests.anchored}/${cov.tests.total} Dateien verankert (${pct(cov.tests.anchored, cov.tests.total)})`,
    `  M2 Recall       ${rec.hit}/${rec.coupled} direkt gekoppelte Tests getroffen (${pct(rec.hit, rec.coupled)}), Auswahl ${rec.selected}`,
    `  M8 Potenzial    ${pot.selected} statt ${pot.full} Dateiläufe über ${pot.commits} Commits (${Math.round(pot.savedPct)} % weniger), davon ${pot.graphOnly} aus dem Graphen`,
    `     Decke        ${pot.ceiling} Dateiläufe (${Math.round(pot.ceilingSavedPct)} % weniger), wenn jede geänderte Datei einen Knoten hätte`,
  ];
  const gaps = rec.rows.filter((r) => r.hit < r.coupled).sort((a, b) => b.coupled - b.hit - (a.coupled - a.hit));
  if (gaps.length > 0) {
    lines.push('', '  größte Lücken (Datei | Auswahl | gekoppelt | Treffer):');
    for (const row of gaps.slice(0, 10)) lines.push(`    ${row.file} | ${row.selected} | ${row.coupled} | ${row.hit}`);
  }
  if (cov.sources.unbound.length > 0) lines.push('', `  ohne Knoten (${cov.sources.unbound.length}): ${cov.sources.unbound.join(' ')}`);
  if (cov.tests.unanchored.length > 0) lines.push('', `  ohne TEST-Knoten (${cov.tests.unanchored.length}): ${cov.tests.unanchored.join(' ')}`);
  return lines.join('\n');
}
