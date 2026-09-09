/**
 * measured.ts — DER Messaufbau (CR-GC-491). Ein Bootstrap für Rig, Spike,
 * Alternativenvergleich und Test; sie unterscheiden sich in der Frage, nicht im Aufbau.
 *
 * Bis hierher gab es vier: `greenfield` über `createHarness`, `minimal-whitebox` und
 * `moneyflow-struktur` über `new GraphCodeHarness(cfg, storage)`, und
 * `spike-lexikographisch` ganz ohne Harness. Die beiden mittleren fallen bei fehlendem
 * `opts.graphcodeConfig` STILL auf `DEFAULT_CONFIG` zurück (`harness.ts`) und übergeben dem
 * Store den unparametrisierten `SE_DESCRIPTOR` statt `createSeDescriptor(policy)` — sie messen
 * also auf Default-Budgets, egal was im Repo steht. Heute folgenlos, weil
 * `graphcode.config.jsonc` zeichengleich mit `DEFAULT_METRIC_POLICY` ist. Invertierend, sobald
 * ein Budget wandert — und genau das ist die Stellgröße (CR-GC-484 T-S3, CR-SM-303).
 *
 * Zwei Regeln tragen den Aufbau:
 *   1. Die Config REIST MIT DEM GRAPHEN. Wer einen fremden Graphen in ein Wegwerf-Repo kopiert,
 *      kopiert seine Urteilsschwellen mit — oder das Ergebnis sagt `source: 'default'`.
 *   2. OHNE STEMPEL KEINE ZAHL. Jedes Ergebnis trägt Graph (Pfad, sha256, Umfang), Policy und
 *      ihre Herkunft, Regel-/Ontologie-Version und den Code-Stand.
 *
 * @author andreas@siglochconsulting
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { META_MODEL_VERSION, ONTOLOGY_VERSION, RULES_VERSION, type MetricPolicy } from '@sigloch/contracts/se';
import { CONFIG_FILENAME, DEFAULT_CONFIG } from '../kernel/config.js';
import type { GraphCodeHarness } from '../kernel/harness.js';
import { createHarness } from './create-harness.js';
import type { MCPToolRegistry } from '../kernel/tool-contract.js';
import { bindToolsToHarness } from './mcp-tools.js';

/** Woher die Urteilsschwellen dieses Laufs kommen — nie zu erraten, immer im Ergebnis. */
export interface PolicyProvenance {
  /** `file` = beim Graphen lag eine Config · `inline` = der Aufrufer hat sie gesetzt · `default` = keine da. */
  readonly source: 'file' | 'inline' | 'default';
  /** Der QUELL-Pfad der Config, nicht die Kopie im Wegwerf-Repo. `null` bei `default`/`inline`. */
  readonly from: string | null;
}

export interface Provenance {
  /** `null` beim Greenfield-Start (CR-GC-493) — die Abwesenheit wird gesagt, nicht erfunden. */
  readonly graph: { readonly path: string; readonly sha256: string; readonly elements: number; readonly traces: number } | null;
  readonly policy: PolicyProvenance & { readonly value: MetricPolicy };
  readonly versions: { readonly rules: string; readonly ontology: string; readonly metaModel: string };
  readonly code: { readonly sha: string; readonly dirty: boolean };
  readonly repoRoot: string;
  readonly at: string;
}

export interface Measured {
  readonly harness: GraphCodeHarness;
  readonly tools: MCPToolRegistry;
  readonly graph: () => ReturnType<GraphCodeHarness['getGraph']>;
  readonly policy: MetricPolicy;
  readonly provenance: Provenance;
  /** Die Wurzel, gegen die geurteilt und aufgelöst wird — das echte Repo, wenn eins genannt war. */
  readonly repoRoot: string;
  /** Das Wegwerf-Verzeichnis: Store, `owner.lock` und Audit-Log. Wird beim `close()` gelöscht. */
  readonly storeRoot: string;
  readonly close: () => Promise<void>;
}

export interface OpenMeasuredOptions {
  /**
   * Absoluter Pfad auf den `*.graph.json`, der gemessen werden soll. Wird KOPIERT, nie geöffnet.
   *
   * CR-GC-493: **optional**. Ohne ihn startet ein leeres Wegwerf-Repo — der Greenfield-Fall der
   * Autorier-Rigs, die bis dahin von Hand bauten, weil dieser Parameter Pflicht war.
   */
  readonly graph?: string;
  readonly systemId: string;
  readonly workspaceId?: string;
  /**
   * Repo-Wurzel, deren `graphcode.config.jsonc` mitreisen soll. Ohne Angabe abgeleitet aus der
   * Konvention `<repo>/docs/graph/<name>.graph.json` — und das Ergebnis steht im Stempel, damit
   * die Ableitung sichtbar ist statt magisch.
   */
  readonly configFrom?: string;
  /**
   * Die ECHTE Repo-Wurzel, gegen die geurteilt und aufgelöst wird (CR-GC-496). Ohne sie ist die
   * Wurzel das Wegwerf-Verzeichnis selbst — der Vorgabefall für einen fremden Graphen.
   *
   * Mit ihr bleiben `graphcode.config.jsonc` und die `realRef`-Auflösung am echten Repo, während
   * der Store im Temp liegt. Das Repo wird dabei **nur gelesen**: nichts wird hineingeschrieben,
   * und `close()` löscht ausschliesslich das Wegwerf-Verzeichnis.
   */
  readonly repoRoot?: string;
  /**
   * Policy direkt setzen (Alternativenvergleich, Test) — schlägt `configFrom`. Der Teil-Wert
   * wird auf `DEFAULT_CONFIG` GEMISCHT: die Schema-Prüfung verlangt eine vollständige Policy
   * (CR-GC-329, kein stiller Default), aber wer EINE Schwelle variiert, soll nicht acht
   * abschreiben müssen — genau das ist der Alternativenvergleich.
   */
  readonly config?: { metricPolicy?: Partial<MetricPolicy>; focusThreshold?: number };
}

const sha256 = (buf: Buffer): string => createHash('sha256').update(buf).digest('hex');

/** Der Code-Stand DIESES Pakets — hochlaufen bis zum `.git`, nicht `process.cwd()` raten. */
function codeStamp(): { sha: string; dirty: boolean } {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8 && !existsSync(join(dir, '.git')); i++) dir = dirname(dir);
  try {
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
    const dirty = execFileSync('git', ['status', '--porcelain'], { cwd: dir, encoding: 'utf8' }).trim().length > 0;
    return { sha, dirty };
  } catch {
    // Kein git (Tarball-Installation) — ein leerer Stempel ist ehrlicher als ein erfundener.
    return { sha: '0000000', dirty: false };
  }
}

/** `<repo>/docs/graph/x.graph.json` → `<repo>`. Trifft die Konvention nicht, bleibt es beim Graph-Verzeichnis. */
function repoOfGraph(graphPath: string): string {
  const graphDir = dirname(graphPath);
  const docsDir = dirname(graphDir);
  return graphDir.endsWith(join('docs', 'graph')) || docsDir.endsWith('docs') ? dirname(docsDir) : graphDir;
}

/**
 * Einen Harness über einen fremden Graphen öffnen — isolierter Store, Config des Quell-Repos,
 * Herkunftsstempel. Der Aufrufer schließt mit `close()`; das Wegwerf-Repo wird dabei gelöscht.
 */
export async function openMeasured(opts: OpenMeasuredOptions): Promise<Measured> {
  const storeRoot = mkdtempSync(join(tmpdir(), 'measured-'));
  // CR-GC-496: die Wurzel ist das echte Repo, wenn eins genannt ist — sonst das Wegwerf-Verzeichnis.
  const repoRoot = opts.repoRoot ?? storeRoot;
  if (repoRoot === storeRoot) mkdirSync(join(repoRoot, 'docs', 'graph'), { recursive: true });

  let graphStamp: Provenance['graph'] = null;
  let ontology: { elements?: unknown[]; traces?: unknown[] } | null = null;
  if (opts.graph !== undefined) {
    const raw = readFileSync(opts.graph);
    ontology = JSON.parse(raw.toString('utf8')) as { elements?: unknown[]; traces?: unknown[] };
    graphStamp = {
      path: opts.graph,
      sha256: sha256(raw),
      elements: ontology.elements?.length ?? 0,
      traces: ontology.traces?.length ?? 0,
    };
  }

  // Regel 1: die Config reist mit dem Graphen. Ohne Graphen gibt es nichts, womit sie reisen
  // könnte — dann zählt nur `configFrom`, und sonst gilt sichtbar der Startwert.
  const sourceRepo =
    opts.configFrom ?? opts.repoRoot ?? (opts.graph !== undefined ? repoOfGraph(opts.graph) : repoRoot);
  const sourceConfig = join(sourceRepo, CONFIG_FILENAME);
  let policySource: PolicyProvenance;
  if (opts.config) {
    // Eine Inline-Policy in ein FREMDES Repo zu schreiben wäre ein Schreibzugriff auf ein
    // echtes Arbeitsverzeichnis — genau das, was dieser Aufbau ausschliesst.
    if (opts.repoRoot !== undefined) {
      throw new Error('openMeasured: `config` und `repoRoot` schliessen sich aus — die Policy des echten Repos gilt, oder es ist keins.');
    }
    const merged = {
      metricPolicy: { ...DEFAULT_CONFIG.metricPolicy, ...opts.config.metricPolicy },
      focusThreshold: opts.config.focusThreshold ?? DEFAULT_CONFIG.focusThreshold,
    };
    writeFileSync(join(repoRoot, CONFIG_FILENAME), JSON.stringify(merged));
    policySource = { source: 'inline', from: null };
  } else if (existsSync(sourceConfig)) {
    // Kopieren nur ins Wegwerf-Repo; ist die Wurzel echt, liest `createHarness` sie ohnehin dort.
    if (repoRoot === storeRoot) copyFileSync(sourceConfig, join(repoRoot, CONFIG_FILENAME));
    policySource = { source: 'file', from: sourceConfig };
  } else {
    policySource = { source: 'default', from: null };
  }

  const harness = await createHarness({
    repoRoot,
    scope: { workspaceId: opts.workspaceId ?? 'measured', systemId: opts.systemId },
    consumerType: 'system',
    preCommitTimeout: 5000,
  }, { storeRoot });
  await harness.initialize();
  // `importGraph` statt `seedFromJson`: der Graph wird GELESEN, nie in ein fremdes Repo kopiert.
  if (ontology !== null) await harness.importGraph(ontology as Parameters<typeof harness.importGraph>[0]);

  const provenance: Provenance = {
    graph: graphStamp,
    policy: { ...policySource, value: harness.getMetricPolicy() },
    versions: { rules: RULES_VERSION, ontology: ONTOLOGY_VERSION, metaModel: META_MODEL_VERSION },
    code: codeStamp(),
    repoRoot,
    at: new Date().toISOString(),
  };

  return {
    harness,
    tools: bindToolsToHarness(harness),
    graph: () => harness.getGraph(),
    policy: harness.getMetricPolicy(),
    provenance,
    repoRoot,
    storeRoot,
    close: async () => {
      await harness.close();
      // NUR das Wegwerf-Verzeichnis — ein echtes Repo wird nie gelöscht.
      rmSync(storeRoot, { recursive: true, force: true });
    },
  };
}

/** Eine Zeile für den Kopf jedes Berichts — ohne Stempel keine Zahl. */
export function stampLine(p: Provenance): string {
  const cfg = p.policy.source === 'file' ? p.policy.from : p.policy.source;
  return [
    // CR-GC-493: kein Graph heisst „—", nie ein erfundener Hash.
    p.graph === null ? 'graph —' : `graph ${p.graph.sha256.slice(0, 12)} (${p.graph.elements}/${p.graph.traces})`,
    `policy ${cfg}`,
    `rules ${p.versions.rules}`,
    `code ${p.code.sha}${p.code.dirty ? '+dirty' : ''}`,
  ].join(' · ');
}

export interface Discrimination<T> {
  /** Alle Kandidaten haben denselben Wert — es gibt nichts zu ranken. */
  readonly blind: boolean;
  readonly spread: number;
  readonly values: readonly number[];
  /** Aufsteigend sortiert — `null`, wenn blind. NIE ein Tiebreak-Rang. */
  readonly ranked: readonly T[] | null;
  readonly reason: string | null;
}

/**
 * Blindheitsausgang statt Rang (CR-SM-291 Satz F): vier Kandidaten mit Δ0 lieferten fünf
 * Lesarten „bestanden", weil der Rang aus dem alphabetischen Tiebreak kam. Eine Messung, deren
 * unterscheidende Größe nicht streut, hat kein Ergebnis — sie hat eine Blindstelle, und die
 * muss so heißen.
 */
export function discriminate<T>(
  candidates: readonly T[],
  by: (c: T) => number,
  opts: { name: string },
): Discrimination<T> {
  const values = candidates.map(by);
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  if (spread === 0) {
    return {
      blind: true,
      spread,
      values,
      ranked: null,
      reason: `blind: ${opts.name} streut nicht über ${candidates.length} Kandidaten (alle ${values[0] ?? 'n/a'}) — kein Rang, kein Ergebnis`,
    };
  }
  const ranked = candidates.map((c, i) => ({ c, v: values[i] })).sort((a, b) => a.v - b.v).map((x) => x.c);
  return { blind: false, spread, values, ranked, reason: null };
}
