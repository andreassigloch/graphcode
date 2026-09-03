/**
 * CR-DRAFT-GC-466 — Spike M1: `Graph-State` hat EINEN Produzentenblock.
 *
 * TROCKENÜBUNG im Muster von CR-GC-436: der produktive Graph/Store wird NICHT
 * verändert — `docs/graph/graphcode.graph.json` wird nur gelesen (SHA-256 vorher =
 * nachher, asserted). Eigener Disk-Kuzu in mkdtempSync (nie :memory:, nie der
 * Repo-Store), danach rmSync. Die Korrektur geht durch DASSELBE Gate wie in
 * Produktion (`graph_mutate`-Tool-Handler, nicht rohes `harness.mutate()`).
 *
 * DIE KORREKTUR: Im Code schreiben nur `kernel/harness.ts`, `kernel/merge.ts` und
 * `kernel/harness-import.ts` in den Store (CR-DRAFT-GC-466, nachgemessen). Im Modell
 * hat `FLOW-graph-state` 17 Produzenten — 8 davon sind Leser oder Aufrufer, als
 * Schreiber modelliert (`decode`, `graph-export-snapshot`, `nd-similarity`, `rewind`,
 * `session-shutdown`, `own-kuzu-host`, `migrate-schema` ohne Code, und der ACTOR
 * `owner`, der unter L1 über `Mutate-Command` schreibt). Die 8 Kanten fallen; wer
 * liest, liest weiter (die Konsumenten-Kante bleibt).
 *
 * GEMESSEN wird, ob die Korrektur die STEUERUNG bewegt (Kill-Kriterium M1): der ℝ⁶-
 * Vektor auf `arch`, die CR-01-Grenzen (distinkte Verträge je Modulpaar) und die
 * Top-5 von `graph_suggest`. Bewegt sich nichts, ist die Korrektur Modellhygiene —
 * sie wird trotzdem gemacht (das Modell lügt über den Schreiber), aber ohne
 * Architektur-Claim.
 */
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KuzuAdapter } from './helpers/store.js';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { metrics, METRIC_DIMENSIONS } from '@sigloch/se-engine';
import type { MutateCommand } from '@sigloch/contracts/harness';
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { toOntologyGraph } from '../src/kernel/conformance.js';
import { makeSteeringConfig, type FixtureGraph } from './fixtures/steering-graphs.js';

const REPO_GRAPH = fileURLToPath(new URL('../docs/graph/graphcode.graph.json', import.meta.url));
const PROFILE = fileURLToPath(new URL('../.graphcode/target-profile.json', import.meta.url));
const sha256 = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

/** Die Store-Schreiber laut Code — alles andere ist Leser oder Aufrufer. */
const WRITER_FILES = /kernel\/(harness|merge|harness-import)\.ts$/;

interface Rig { tmp: string; harness: GraphCodeHarness; tools: MCPToolRegistry }

async function makeRig(): Promise<Rig> {
  const fixture = JSON.parse(readFileSync(REPO_GRAPH, 'utf8')) as FixtureGraph;
  const tmp = mkdtempSync(join(tmpdir(), 'graphcode-repository-style-'));
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

interface Snapshot {
  r6: number[];
  /** CR-01, wie der Anwender es sieht: Warnungen (≥ 3 Verträge) und Infos je Modulpaar aus `evaluateRules()`. */
  cr01Pairs: number;
  cr01Contracts: number;
  producers: string[];
  top5: string[];
}

async function measure(rig: Rig): Promise<Snapshot> {
  const graph = rig.harness.getGraph();
  const og = toOntologyGraph(graph);
  const r6 = METRIC_DIMENSIONS.map((d) => metrics(og, { layer: 'arch' })[d]);
  const cr01 = rig.harness.evaluateRules().filter((v) => v.ruleId === 'CR-01');
  const cr01Pairs = cr01.filter((v) => v.severity === 'warning').length;
  // Die Zahl der Verträge steht in der Meldung („… N distinct contract(s) …") — daraus die Summe.
  const cr01Contracts = cr01.reduce((a, v) => a + Number(/(\d+) distinct contract/.exec(v.message)?.[1] ?? 0), 0);
  const producers = graph.edges
    .filter((e) => e.edgeType === 'io' && e.targetId === 'FLOW-graph-state')
    .map((e) => e.sourceId)
    .sort();
  const weights = (JSON.parse(readFileSync(PROFILE, 'utf8')) as { weights: Record<string, number> }).weights;
  const res = (await rig.tools.graph_suggest.handler({ target: weights, k: 5, layer: 'arch' })) as Record<string, unknown>;
  // Die Rangliste ist das erste Array im Ergebnis; je Zeile die sprechenden Felder.
  const rows = (Object.values(res).find((v) => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object') ?? []) as Record<string, unknown>[];
  const top5 = rows.slice(0, 5).map((r) =>
    ['ruleId', 'id', 'elementId', 'target', 'score', 'delta']
      .filter((k) => k in r)
      .map((k) => `${k}=${typeof r[k] === 'number' ? (r[k] as number).toFixed(4) : JSON.stringify(r[k]).slice(0, 40)}`)
      .join(' '),
  );
  return { r6, cr01Pairs, cr01Contracts, producers, top5 };
}

describe('CR-DRAFT-GC-466 M1 — Graph-State auf einen Produzentenblock (Trockenübung, gate-hart)', () => {
  it('korrigiert die 8 falschen Produzenten im Temp-Store und misst die Steuerung vorher/nachher', async () => {
    const shaBefore = sha256(REPO_GRAPH);
    const rig = await makeRig();
    try {
      const before = await measure(rig);
      const graph = rig.harness.getGraph();
      const realRef = (uid: string) => {
        const n = graph.nodes.find((x) => x.uid === uid);
        const r = (n?.attributes as Record<string, unknown> | undefined)?.realRef as { file?: string } | undefined;
        return r?.file ?? '';
      };
      const type = new Map(graph.nodes.map((n) => [n.uid, n.type]));
      const wrong = before.producers.filter((uid) => !(type.get(uid) === 'FUNC' && WRITER_FILES.test(realRef(uid))));
      // Der Befund aus CR-DRAFT-GC-466: 17 Produzenten, 9 legitim, 8 falsch.
      expect(before.producers).toHaveLength(17);
      expect(wrong).toHaveLength(8);
      const commands: MutateCommand[] = wrong.map((uid) => ({
        op: 'delete-edge',
        edge: { sourceId: uid, targetId: 'FLOW-graph-state', edgeType: 'io' },
      }));
      const result = (await rig.tools.graph_mutate.handler({ commands })) as { success: boolean; appliedCommands: number };
      expect(result.success).toBe(true);
      expect(result.appliedCommands).toBe(8);
      await rig.harness.loadGraph();
      const after = await measure(rig);
      expect(after.producers).toHaveLength(9);
      for (const uid of after.producers) expect(WRITER_FILES.test(realRef(uid))).toBe(true);

      const fmt = (v: number[]) => v.map((x) => x.toFixed(3)).join('  ');
      const delta = after.r6.map((x, i) => x - before.r6[i]);
      const weights = (JSON.parse(readFileSync(PROFILE, 'utf8')) as { weights: Record<string, number> }).weights;
      const weighted = delta.reduce((a, d, i) => a + d * (weights[METRIC_DIMENSIONS[i]] ?? 0), 0);
      console.log(`\n### M1 — Graph-State: 17 → ${after.producers.length} Produzenten (8 Kanten durchs Gate gelöscht)\n`);
      console.log(`| | ${METRIC_DIMENSIONS.join(' | ')} | CR-01-Paare ≥3 | Verträge über Grenzen |`);
      console.log(`|---|${METRIC_DIMENSIONS.map(() => '---:').join('|')}|---:|---:|`);
      console.log(`| vorher | ${fmt(before.r6).split('  ').join(' | ')} | ${before.cr01Pairs} | ${before.cr01Contracts} |`);
      console.log(`| nachher | ${fmt(after.r6).split('  ').join(' | ')} | ${after.cr01Pairs} | ${after.cr01Contracts} |`);
      console.log(`| Δ | ${delta.map((d) => (d >= 0 ? '+' : '') + d.toFixed(3)).join(' | ')} | ${after.cr01Pairs - before.cr01Pairs} | ${after.cr01Contracts - before.cr01Contracts} |`);
      console.log(`\nΔ·w (Zielprofil): ${weighted >= 0 ? '+' : ''}${weighted.toFixed(3)}  — Kill-Kriterium |Δ·w| < 0,05: ${Math.abs(weighted) < 0.05 ? 'ERFÜLLT (Hygiene, kein Steuerungs-Claim)' : 'nicht erfüllt (Steuerung bewegt sich)'}`);
      console.log(`\ngraph_suggest Top-5 vorher:\n  ${before.top5.join('\n  ') || '(leer)'}`);
      console.log(`graph_suggest Top-5 nachher:\n  ${after.top5.join('\n  ') || '(leer)'}`);
      console.log(`Top-5 identisch: ${JSON.stringify(before.top5) === JSON.stringify(after.top5)}`);
    } finally {
      await dropRig(rig);
    }
    expect(sha256(REPO_GRAPH)).toBe(shaBefore);
  }, 120_000);
});
