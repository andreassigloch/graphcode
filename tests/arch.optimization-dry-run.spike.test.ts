/**
 * CR-GC-436 — Spike: Architektur-Optimierung von graphcode als TROCKENÜBUNG,
 * diesmal am ECHTEN Gate (Nachtrag 2; der erste Nachtrag war eine In-Memory-
 * Simulation, weil CR-GC-435 — Umhängen — noch fehlte).
 *
 * TROCKENÜBUNG heißt: der produktive Graph/Store wird NICHT verändert.
 * `docs/graph/graphcode.graph.json` wird nur GELESEN (Hash vorher = nachher,
 * am Ende jedes Laufs geprüft). Je Lauf ein eigener Disk-Kuzu in mkdtempSync
 * (nie :memory:, nie der Repo-Store), danach rmSync. Alle Züge gehen durch
 * `harness.mutate()`; Endwerte werden per `loadGraph()` AUS DEM STORE
 * zurückgelesen, nicht aus der Arbeitskopie. Währung: layer:'arch'.
 *
 * ZWEI LÄUFE (Muster CR-GC-430, `steering.divergence-two-profiles.test.ts`):
 *
 *   Lauf A — GREEDY: nimm je Runde die bestbewertete ANWENDBARE Suggestion aus
 *            `graph_suggest` (Zielprofil aus .graphcode/target-profile.json:
 *            coherence 1 · modifiability 0.7 · faultTolerance 0.3), wende sie
 *            als Verbund-Batch [delete-edge(retire), add-edge] durchs Gate an,
 *            bis nichts Positives mehr kommt. Das ist die Reichweite des
 *            heutigen Autopiloten — erst seit CR-GC-435 überhaupt > 0 Züge.
 *   Lauf B — HANDSCHNITT: der 8er-Zielschnitt aus dem ersten Nachtrag
 *            (scripts/spike-arch-handschnitt.mjs), aber als Gate-Batches:
 *            merge-nodes (Renames + FLOW-Konsolidierung), delete+add-allocate
 *            (Umhängungen, verschiedene Kanten-Schlüssel — der persist-
 *            Fallstrick greift nur bei DERSELBEN Kante), merge-nodes
 *            (geleerte Splitter-MODs in ihre Nachfolger). Obergrenze dessen,
 *            was Umhängen überhaupt bewegen kann — und der Nachweis, dass der
 *            Schnitt durchs Gate KOMMT (Delta-Semantik: nur NEU eingeführte
 *            error-Verstöße blocken).
 *
 * Der Test URTEILT nicht über GO/No-Go — er misst und druckt den Messblock;
 * die Zahlen stehen im CR, die Entscheidung liegt beim Auftraggeber.
 *
 * @author andreas@siglochconsulting
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { metrics, toArray, buildAdjacency, detectCommunities, modularityOf, modularityQ } from '@sigloch/se-engine';
import { moduleMetrics } from '@sigloch/contracts/se';
import type { MutateCommand } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from '../src/harness.js';
import { bindToolsToHarness, type MCPToolRegistry } from '../src/mcp-tools.js';
import { toOntologyGraph } from '../src/conformance.js';
import { makeSteeringConfig, type FixtureGraph } from './fixtures/steering-graphs.js';
import type { GraphSuggestResult } from '../src/tools/suggest.js';

const REPO_GRAPH = join(__dirname, '..', 'docs/graph/graphcode.graph.json');

/** Das hinterlegte Zielprofil (.graphcode/target-profile.json) — hier fest im
 *  Test, damit der Lauf nicht von einer Config im Temp-repoRoot abhängt. */
const PROFILE = { coherence: 1, modifiability: 0.7, faultTolerance: 0.3 };

const DIMS = ['modifiability', 'faultTolerance', 'flowEfficiency', 'coherence', 'viability', 'scalability'] as const;
const EPS = 1e-9;
/** Harte Obergrenze für die Greedy-Kette — nicht-terminierend soll laut scheitern. */
const MAX_STEPS = 15;

// ---------------------------------------------------------------------------
// Rig — identisch zu suggest.rehang.test.ts: Disk-Kuzu, echtes Gate.
// ---------------------------------------------------------------------------

interface Rig {
  tmp: string;
  harness: GraphCodeHarness;
  tools: MCPToolRegistry;
}

async function makeRig(): Promise<Rig> {
  const fixture = JSON.parse(readFileSync(REPO_GRAPH, 'utf8')) as FixtureGraph;
  const tmp = mkdtempSync(join(tmpdir(), 'graphcode-arch-dry-run-'));
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, 'kuzu') });
  const harness = new GraphCodeHarness(makeSteeringConfig(tmp), storage);
  await harness.initialize();
  await harness.importGraph(fixture);
  return { tmp, harness, tools: bindToolsToHarness(harness) };
}

async function dropRig(rig: Rig): Promise<void> {
  await rig.harness.close();
  rmSync(rig.tmp, { recursive: true, force: true });
}

const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

// ---------------------------------------------------------------------------
// Messwerk — dieselben Instrumente wie die beiden In-Memory-Skripte
// (spike-arch-top-views/-handschnitt.mjs), damit die Zahlen vergleichbar sind.
// ---------------------------------------------------------------------------

interface Snapshot {
  r6: number[];
  /** Blatt-Verbindungen (producer×consumer je FLOW, FUNC-Blattpaare) + Anteil intern. */
  pairs: number;
  intra: number;
  /** Modularität des DEKLARIERTEN Schnitts + CNM-Referenz (natürliche Communities). */
  qDecl: number;
  qRef: number;
  mods: { id: string; funcs: number; int: number; ext: number; ratio: number }[];
  nulls: number;
}

function measure(h: GraphCodeHarness): Snapshot {
  const graph = h.getGraph();
  const type = new Map(graph.nodes.map((n) => [n.uid, n.type]));
  const parent = new Map<string, string>();
  for (const e of graph.edges)
    if (e.edgeType === 'compose' && type.get(e.sourceId) === 'FUNC' && type.get(e.targetId) === 'FUNC')
      parent.set(e.targetId, e.sourceId);
  const top = (id: string) => {
    let x = id;
    while (parent.has(x)) x = parent.get(x)!;
    return x;
  };
  const prod = new Map<string, string[]>();
  const cons = new Map<string, string[]>();
  for (const e of graph.edges) {
    if (e.edgeType !== 'io') continue;
    if (type.get(e.sourceId) === 'FUNC' && type.get(e.targetId) === 'FLOW')
      (prod.get(e.targetId) ?? prod.set(e.targetId, []).get(e.targetId)!).push(e.sourceId);
    if (type.get(e.sourceId) === 'FLOW' && type.get(e.targetId) === 'FUNC')
      (cons.get(e.sourceId) ?? cons.set(e.sourceId, []).get(e.sourceId)!).push(e.targetId);
  }
  const alloc = new Map<string, string>();
  for (const e of graph.edges)
    if (e.edgeType === 'allocate' && type.get(e.sourceId) === 'FUNC') alloc.set(e.sourceId, e.targetId);
  const modOf = (f: string) => alloc.get(f) ?? alloc.get(top(f));
  const pairs: { p: string; c: string }[] = [];
  for (const [fl, cc] of cons) for (const c of cc) for (const p of prod.get(fl) ?? []) if (p !== c) pairs.push({ p, c });
  const intra = pairs.filter((x) => modOf(x.p) && modOf(x.p) === modOf(x.c)).length;

  const og = toOntologyGraph(graph);
  const adj = buildAdjacency(og);
  const decl = new Map<string, number>();
  {
    let i = 0;
    const idx = new Map<string, number>();
    for (const [f, m] of alloc) {
      if (!idx.has(m)) idx.set(m, i++);
      decl.set(f, idx.get(m)!);
    }
  }
  const qDecl = modularityOf(adj, new Map([...detectCommunities(adj).keys()].map((k) => [k, decl.get(k) ?? -1])));
  const mm = moduleMetrics(og).filter((m) => m.cohesion);
  return {
    r6: toArray(metrics(og, { layer: 'arch' })),
    pairs: pairs.length,
    intra,
    qDecl,
    qRef: modularityQ(adj),
    mods: mm
      .map((m) => ({
        id: m.moduleId,
        funcs: m.allocatedFuncs,
        int: m.cohesion!.internal,
        ext: m.cohesion!.external,
        ratio: m.cohesion!.ratio,
      }))
      .sort((a, b) => a.ratio - b.ratio),
    nulls: mm.filter((m) => m.cohesion!.internal === 0).length,
  };
}

/** Verstoß-Schlüssel ruleId@elementId über rules_evaluate — für die Bilanz
 *  geschlossen/neu entstanden (Kill-Kriterium 3). */
async function findingKeys(tools: MCPToolRegistry): Promise<Set<string>> {
  const ev = (await tools.rules_evaluate.handler({ detail: 'summary' })) as {
    violations: { ruleId: string; severity: string; elementId?: string }[];
  };
  return new Set(ev.violations.map((v) => `${v.ruleId}@${v.elementId ?? '-'}`));
}

const byRule = (keys: Set<string>) => {
  const m = new Map<string, number>();
  for (const k of keys) {
    const r = k.split('@')[0];
    m.set(r, (m.get(r) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([r, n]) => `${r}×${n}`).join(' ');
};

const unit = (w: Partial<Record<(typeof DIMS)[number], number>>) => {
  const v = DIMS.map((d) => w[d] ?? 0);
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return n < 1e-12 ? v : v.map((x) => x / n);
};
/** Projektion einer ℝ⁶-Bewegung auf die Zielprofil-Einheitsrichtung — EINE Zahl je Lauf. */
const along = (start: number[], end: number[]) =>
  end.reduce((s, x, i) => s + (x - start[i]) * unit(PROFILE)[i], 0);

const fmt = (v: number[]) => `[${v.map((x) => x.toFixed(3)).join(', ')}]`;

function printSnapshot(label: string, s: Snapshot): void {
  console.log(`\n== ${label}`);
  console.log(`   ℝ⁶(arch) ${fmt(s.r6)}   (${DIMS.join(', ')})`);
  console.log(
    `   Blatt: ${s.pairs} Verbindungen, intern ${s.intra} (${((100 * s.intra) / s.pairs).toFixed(1)} %) · ` +
      `Q(deklariert)=${s.qDecl.toFixed(3)} (CNM-Referenz ${s.qRef.toFixed(3)}) · 0-intern: ${s.nulls}/${s.mods.length}`,
  );
  for (const m of s.mods)
    console.log(
      `   ${m.id.padEnd(22)} FUNCs ${String(m.funcs).padStart(2)} · int ${String(m.int).padStart(3)} / ext ${String(
        m.ext,
      ).padStart(3)} / ratio ${m.ratio.toFixed(2)}`,
    );
}

function printBalance(before: Set<string>, after: Set<string>): void {
  const closed = [...before].filter((k) => !after.has(k));
  const opened = [...after].filter((k) => !before.has(k));
  console.log(`   Befund-Bilanz: geschlossen ${closed.length} [${byRule(new Set(closed))}]`);
  console.log(`                  neu         ${opened.length} [${byRule(new Set(opened))}]`);
}

// ---------------------------------------------------------------------------
// Lauf A — greedy über graph_suggest, jeder Zug durchs echte Gate.
// ---------------------------------------------------------------------------

describe('CR-GC-436 Nachtrag 2: Trockenübung am echten Gate (Repo-Graph, Disk-Kuzu)', () => {
  it('Lauf A — greedy: Reichweite des Autopiloten nach CR-GC-435', async () => {
    const ssot = sha256(REPO_GRAPH);
    const rig = await makeRig();
    try {
      // Schritt 0 — Grammatik pinnen: gegen welche contracts-Version wird gemessen?
      const contractsVersion = (
        JSON.parse(readFileSync(join(__dirname, '..', 'node_modules/@sigloch/contracts/package.json'), 'utf8')) as {
          version: string;
        }
      ).version;
      const graphVersion = (JSON.parse(readFileSync(REPO_GRAPH, 'utf8')) as { graphVersion: number }).graphVersion;

      // Schritt 0 — Baseline-Vorlast: bestehende Verstöße sind kein Spike-Ergebnis
      // (das Gate blockt nur auf NEU eingeführten, src/harness.ts Delta-Semantik).
      const base = await findingKeys(rig.tools);
      const start = measure(rig.harness);
      console.log(`\n#### LAUF A (greedy) — contracts ${contractsVersion} (Link-Modus), graphVersion ${graphVersion}`);
      console.log(`   Baseline-Vorlast: ${base.size} Verstöße [${byRule(base)}]`);
      printSnapshot('Lauf A — START (aus dem Store)', start);

      const applied = new Set<string>();
      const steps: { n: number; ruleId: string; edit: string; promised: number }[] = [];
      let leftover = 0;
      for (let n = 1; n <= MAX_STEPS; n++) {
        const res = (await rig.tools.graph_suggest.handler({ target: PROFILE, k: 20, layer: 'arch' })) as GraphSuggestResult;
        const applicable = res.suggestions.filter((s) => s.applicable && s.edit);
        const best = applicable.find(
          (s) => s.score > EPS && !applied.has(`${s.edit!.source}->${s.edit!.target}`),
        );
        if (!best) {
          // Erschöpfung: nichts Anwendbares hilft dem Ziel mehr. Was noch auf dem
          // Tisch liegt (anwendbar, aber Δm·t̂ ≤ 0), ist Teil der Reichweiten-Aussage.
          leftover = applicable.filter((s) => s.score <= EPS).length;
          break;
        }
        const e = best.edit!;
        const cmds: MutateCommand[] = [
          ...(e.retire
            ? [{ op: 'delete-edge' as const, edge: { sourceId: e.retire.source, targetId: e.retire.target, edgeType: e.retire.type } }]
            : []),
          { op: 'add-edge' as const, edge: { sourceId: e.source, targetId: e.target, edgeType: e.type, attributes: {} } },
        ];
        const g = await rig.harness.mutate(cmds);
        expect(
          g.success,
          `Gate wies Zug ${n} ab (${best.ruleId}): ${g.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`,
        ).toBe(true);
        applied.add(`${e.source}->${e.target}`);
        steps.push({
          n,
          ruleId: best.ruleId,
          edit: `${e.source} -${e.type}-> ${e.target}${e.retire ? ` (retire ${e.retire.target})` : ''}`,
          promised: best.score,
        });
      }
      expect(steps.length, 'Greedy-Kette terminierte nicht (MAX_STEPS)').toBeLessThan(MAX_STEPS);

      // Endwerte AUS DEM STORE, nicht aus der Arbeitskopie.
      await rig.harness.loadGraph();
      const end = measure(rig.harness);
      const after = await findingKeys(rig.tools);

      console.log(`\n   Züge: ${steps.length} · danach anwendbar-aber-nicht-zielführend: ${leftover}`);
      for (const s of steps) console.log(`   ${s.n}. [${s.ruleId}] ${s.edit} · versprochen ${s.promised.toFixed(4)}`);
      printSnapshot('Lauf A — ENDE (loadGraph aus dem Store)', end);
      const promised = steps.reduce((s, x) => s + x.promised, 0);
      console.log(
        `   Projektion auf Zielprofil: realisiert ${along(start.r6, end.r6).toFixed(4)} · versprochen (Σ Schritt-Scores) ${promised.toFixed(4)}`,
      );
      printBalance(base, after);

      // CR-GC-435 ist Voraussetzung: mindestens EIN Zug muss möglich gewesen sein —
      // vorher endete der Spike hier per Kill-Kriterium 1.
      expect(steps.length).toBeGreaterThan(0);
      // Trockenübung: der produktive SSOT ist nachweislich unverändert.
      expect(sha256(REPO_GRAPH)).toBe(ssot);
    } finally {
      await dropRig(rig);
    }
  }, 900_000);

  // -------------------------------------------------------------------------
  // Lauf B — der 8er-Handschnitt als Gate-Batches (Obergrenze des Umhängens).
  // -------------------------------------------------------------------------

  /** Umhängungen (identisch zu scripts/spike-arch-handschnitt.mjs REALLOC). */
  const REALLOC: Record<string, string> = {
    'FUNC-emit-trajectory': 'MOD-store', 'FUNC-emit-update-event': 'MOD-store',
    'FUNC-migrate-schema': 'MOD-store', 'FUNC-schema-guard': 'MOD-store',
    'FUNC-score-completeness': 'MOD-metrics-engine', 'FUNC-check-code-conformance': 'MOD-gate',
    'FUNC-list-elements': 'MOD-mcp-tools',
    'FUNC-broadcast-diff': 'MOD-live', 'FUNC-health-endpoint': 'MOD-live',
    'FUNC-own-kuzu-host': 'MOD-live', 'FUNC-serve-sse': 'MOD-live', 'FUNC-host-socket': 'MOD-live',
    'FUNC-block-live-dashboard': 'MOD-live', 'FUNC-block-schaufenster': 'MOD-live',
    'FUNC-block-speicherwerk': 'MOD-store', 'FUNC-block-gedaechtnis': 'MOD-codec',
    'FUNC-block-gate': 'MOD-gate', 'FUNC-block-messwerk': 'MOD-steering',
    'FUNC-block-anschluss': 'MOD-mcp-tools', 'FUNC-block-ruestzeug': 'MOD-mcp-tools',
    'FUNC-block-betrieb': 'MOD-cli', 'FUNC-block-antrieb': 'MOD-executor',
    'FUNC-mutate': 'MOD-gate', 'FUNC-evaluate-rules': 'MOD-gate', 'FUNC-load-config': 'MOD-gate',
    'FUNC-fit-advisory': 'MOD-gate', 'FUNC-preflight': 'MOD-gate',
    'FUNC-tool-context': 'MOD-mcp-tools', 'FUNC-graph-suggest': 'MOD-steering',
  };
  /** Renames als merge-nodes: Ziel neu anlegen, Quelle hineinmergen (Kanten wandern mit). */
  const RENAME: Record<string, string> = {
    'MOD-harness': 'MOD-store', 'MOD-docs': 'MOD-views', 'MOD-skills': 'MOD-agent-surface',
  };
  /** FLOW-Konsolidierungen, die dem Code folgen (SteeringSnapshot / MutateResult / Graph-als-Wert). */
  const FLOW_MERGE: Record<string, string> = {
    'FLOW-measurement-vector': 'FLOW-steering-snapshot', 'FLOW-arch-fitness': 'FLOW-steering-snapshot',
    'FLOW-dimension-readiness': 'FLOW-steering-snapshot', 'FLOW-phase-readiness': 'FLOW-steering-snapshot',
    'FLOW-fit-advisory': 'FLOW-gate-verdict', 'FLOW-steering-delta': 'FLOW-gate-verdict',
    'FLOW-graph-snapshot': 'FLOW-graph-state',
  };
  /**
   * SCHEMA-Konsolidierung — vom GATE ERZWUNGEN, nicht geplant: der erste Lauf
   * dieses Tests schickte nur die FLOW-Merges, und das Gate blockte mit R-18
   * („FLOW-steering-snapshot has 5 relation traces to SCHEMA — the meta-model
   * allows at most 1"). Eine FLOW-Konsolidierung zieht die Konsolidierung der
   * Datenverträge zwingend nach — die In-Memory-Simulation hatte das übersehen.
   */
  const SCHEMA_MERGE: Record<string, string> = {
    'SCHEMA-measurement-vector': 'SCHEMA-steering-snapshot', 'SCHEMA-metric-vector': 'SCHEMA-steering-snapshot',
    'SCHEMA-readiness-report': 'SCHEMA-steering-snapshot', 'SCHEMA-phase-readiness': 'SCHEMA-steering-snapshot',
    'SCHEMA-fit-advisory': 'SCHEMA-mutate-result', 'SCHEMA-steering-delta': 'SCHEMA-mutate-result',
  };
  /** Geleerte Splitter-MODs → Nachfolger (satisfy/relation/compose wandern mit statt zu reißen). */
  const DISSOLVE: Record<string, string> = {
    'MOD-hooks': 'MOD-store', 'MOD-schema-migration': 'MOD-store', 'MOD-conformance': 'MOD-gate',
    'MOD-element-slice': 'MOD-mcp-tools', 'MOD-completeness': 'MOD-metrics-engine',
    'MOD-host-bridge': 'MOD-live',
  };

  it('Lauf B — Handschnitt (8er-Schnitt) als Gate-Batches, Endwerte aus dem Store', async () => {
    const ssot = sha256(REPO_GRAPH);
    const rig = await makeRig();
    try {
      const base = await findingKeys(rig.tools);
      const start = measure(rig.harness);
      console.log(`\n#### LAUF B (Handschnitt am Gate) — Baseline-Vorlast ${base.size} [${byRule(base)}]`);
      printSnapshot('Lauf B — START (aus dem Store)', start);

      const newMod = (uid: string, description: string): MutateCommand => ({
        op: 'add-node',
        node: { uid, type: 'MOD', name: uid.replace('MOD-', ''), description, attributes: {} },
      });

      // ZWEITER Gate-Befund des ersten Testlaufs: Umbenennen-per-merge RE-KEYT
      // die Vorlast — die grammatik-illegalen `MOD -satisfy-> REQ`-Kanten (R-18-
      // Vorlast auf MOD-harness/MOD-docs/MOD-hooks/…) tauchen am neuen MOD als
      // NEUE Verstöße auf und blocken unter der Delta-Semantik. Der saubere
      // Zielzustand lässt sie fallen (der ehrliche Fix — satisfy auf FUNC-Ebene —
      // ist Modellpflege außerhalb dieses Spikes).
      const modSatisfyDrops = (mods: string[]): MutateCommand[] => {
        const isReq = new Set(rig.harness.getGraph().nodes.filter((n) => n.type === 'REQ').map((n) => n.uid));
        return rig.harness
          .getGraph()
          .edges.filter((e) => mods.includes(e.sourceId) && e.edgeType === 'satisfy' && isReq.has(e.targetId))
          .map((e) => ({ op: 'delete-edge' as const, edge: { sourceId: e.sourceId, targetId: e.targetId, edgeType: 'satisfy' } }));
      };

      // Batch 1 — Renames + FLOW-Konsolidierung + die vom Gate erzwungene
      // SCHEMA-Konsolidierung, alles merge-nodes (Kanten wandern mit, dedupe
      // gegen CR-GC-384). Das Gate urteilt EINMAL über den Endzustand des Batches.
      const b1: MutateCommand[] = [
        newMod('MOD-store', 'Store/Lifecycle (Spike-Zielmodul, vorher MOD-harness)'),
        newMod('MOD-views', 'Deterministische Views (vorher MOD-docs)'),
        newMod('MOD-agent-surface', 'Bedienschicht: Markdown-Skill-Treiber (vorher MOD-skills)'),
        ...modSatisfyDrops(Object.keys(RENAME)),
        ...Object.entries(RENAME).map(([s, t]) => ({ op: 'merge-nodes' as const, sourceUid: s, targetUid: t })),
        ...Object.entries(FLOW_MERGE).map(([s, t]) => ({ op: 'merge-nodes' as const, sourceUid: s, targetUid: t })),
        ...Object.entries(SCHEMA_MERGE).map(([s, t]) => ({ op: 'merge-nodes' as const, sourceUid: s, targetUid: t })),
      ];
      const r1 = await rig.harness.mutate(b1);
      expect(r1.success, `Batch 1 (Renames+FLOW-Merge) blockte: ${r1.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`).toBe(true);

      // Batch 2 — Umhängungen: je FUNC [delete-edge(ist), add-edge(soll)] — verschiedene
      // Schlüssel, No-Ops werden übersprungen (delete+add DERSELBEN Kante wäre der
      // bekannte persist-Fallstrick). Neue Ziel-MODs + compose an den Container.
      const alloc = new Map(
        rig.harness.getGraph().edges.filter((e) => e.edgeType === 'allocate').map((e) => [e.sourceId, e.targetId]),
      );
      const have = new Set(rig.harness.getGraph().nodes.map((n) => n.uid));
      const b2: MutateCommand[] = [];
      for (const t of new Set(Object.values(REALLOC)))
        if (!have.has(t)) {
          b2.push(newMod(t, 'Spike-Zielmodul (8er-Schnitt)'));
          b2.push({ op: 'add-edge', edge: { sourceId: 'MOD-repo-root', targetId: t, edgeType: 'compose', attributes: {} } });
        }
      for (const [f, want] of Object.entries(REALLOC)) {
        const is = alloc.get(f);
        if (is === want) continue;
        if (is) b2.push({ op: 'delete-edge', edge: { sourceId: f, targetId: is, edgeType: 'allocate' } });
        b2.push({ op: 'add-edge', edge: { sourceId: f, targetId: want, edgeType: 'allocate', attributes: {} } });
      }
      const r2 = await rig.harness.mutate(b2);
      expect(r2.success, `Batch 2 (Umhängungen) blockte: ${r2.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`).toBe(true);

      // Batch 3 — geleerte Splitter-MODs in ihre Nachfolger mergen (kein delete-node:
      // deren satisfy-Kanten zu REQs würden reißen und die Bilanz künstlich verschlechtern).
      const b3: MutateCommand[] = [
        ...modSatisfyDrops(Object.keys(DISSOLVE)),
        ...Object.entries(DISSOLVE).map(([s, t]) => ({ op: 'merge-nodes' as const, sourceUid: s, targetUid: t })),
      ];
      const r3 = await rig.harness.mutate(b3);
      expect(r3.success, `Batch 3 (Splitter auflösen) blockte: ${r3.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`).toBe(true);

      // Endwerte AUS DEM STORE — und der Nachweis, dass der Store den Schnitt trägt.
      await rig.harness.loadGraph();
      const allocEnd = new Map(
        rig.harness.getGraph().edges.filter((e) => e.edgeType === 'allocate').map((e) => [e.sourceId, e.targetId]),
      );
      for (const [f, want] of Object.entries(REALLOC)) expect(allocEnd.get(f), `Allokation ${f}`).toBe(want);
      const uids = new Set(rig.harness.getGraph().nodes.map((n) => n.uid));
      for (const gone of [...Object.keys(RENAME), ...Object.keys(FLOW_MERGE), ...Object.keys(SCHEMA_MERGE), ...Object.keys(DISSOLVE)])
        expect(uids.has(gone), `${gone} sollte gemergt sein`).toBe(false);

      const end = measure(rig.harness);
      const after = await findingKeys(rig.tools);
      printSnapshot('Lauf B — ENDE (loadGraph aus dem Store)', end);
      console.log(`   Projektion auf Zielprofil: realisiert ${along(start.r6, end.r6).toFixed(4)}`);
      printBalance(base, after);

      expect(sha256(REPO_GRAPH)).toBe(ssot);
    } finally {
      await dropRig(rig);
    }
  }, 900_000);
});
