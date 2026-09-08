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
 *
 *            CR-GC-488: sie ist WIEDER 0, und das ist ein Befund, kein Defekt.
 *            Seit CR-SM-292 rankt der veröffentlichte Score nach CHEBYSHEV, also
 *            nach dem MAXIMUM der vier normierten Überschüsse. Auf diesem Graphen
 *            ist dieses Maximum `BW-02 @ FUNC-block-grounding` mit 19 querenden
 *            SCHEMA-Verträgen gegen eine Schwelle von 4 (normiert 3.75). Eine
 *            zusätzliche Kante kann Randbreite nur ERHÖHEN; senken kann sie nur
 *            ein Merge zweier Verträge, die BEIDE diesen Rand queren, oder ein
 *            Umhängen. Die vier anwendbaren Merges liegen an anderen FLOWs.
 *
 *            Der Test misst deshalb ab hier nicht mehr „mindestens ein Zug",
 *            sondern WARUM keiner kommt: 19 Verträge über einen Rand löst man
 *            durch Zerlegen dieses Blocks, nicht durch einen Zug, den ein
 *            Optimierer findet. Die Zahl steht dem Menschen längst zur Verfügung
 *            (`graph_metrics`, und in graph-view-edit sichtbar) — der erste Zug
 *            ist hier von Hand, und das ist die richtige Arbeitsteilung. Ein
 *            Score, der stattdessen Plateau-Züge belohnte, wäre die Summen-Logik
 *            zurück, die CR-SM-292 gerade entfernt hat: Kompensation verdeckt das
 *            Maximum, und der Autopilot arbeitete an allem ausser am Engpass.
 *   Lauf B — HANDSCHNITT: ZURÜCKGEBAUT mit CR-GC-446 (Begründung am Platz des
 *            Laufs weiter unten). Sein Subjekt — der 17-MOD-SSOT — existiert
 *            nicht mehr; der Schnitt ist seit CR-GC-446 am echten Modell
 *            vollzogen, auf FÜNF Module.
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
import { GraphCodeHarness } from '../src/kernel/harness.js';
import { bindToolsToHarness } from '../src/surface/mcp-tools.js';
import type { MCPToolRegistry } from '../src/kernel/tool-contract.js';
import { toOntologyGraph } from '../src/kernel/conformance.js';
import { makeSteeringConfig, type FixtureGraph } from './fixtures/steering-graphs.js';
import { batchFor, type GraphSuggestResult } from '../src/loop/suggest.js';

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
// (CR-GC-436 Lauf A/B), damit die Zahlen vergleichbar sind.
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
      /**
       * CR-GC-488: der DOMINIERENDE Term des Chebyshev-Scores — `worstAt` aus dem
       * Gate-Advisory. Ohne ihn ist eine Reichweite von 0 nicht lesbar: "kein Zug"
       * und "kein Zug FÜR DIESEN Engpass" sind verschiedene Aussagen.
       */
      let dominant: { ruleId: string; elementId: string } | null = null;
      for (let n = 1; n <= MAX_STEPS; n++) {
        const res = (await rig.tools.graph_suggest.handler({ target: PROFILE, k: 20, layer: 'arch' })) as GraphSuggestResult;
        const applicable = res.suggestions.filter((s) => s.applicable && s.edit);
        dominant = applicable.find((s) => s.verdict?.steer?.worstAt)?.verdict!.steer!.worstAt ?? dominant;
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
        // CR-GC-444: DIESELBE Batch-Bildung wie graph_suggest (`batchFor`) — der
        // Autopilot darf den Verbund nicht ein zweites Mal nachbauen, sonst wendet
        // er etwas anderes an, als der dryRun beurteilt hat (hier gemessen: der
        // Merge-Vorschlag wurde als add-edge FLOW→FLOW abgeschickt und starb an R-18).
        const g = await rig.harness.mutate(batchFor(e));
        expect(
          g.success,
          `Gate wies Zug ${n} ab (${best.ruleId}): ${g.violations.map((v) => `${v.ruleId}: ${v.message}`).join(' | ')}`,
        ).toBe(true);
        applied.add(`${e.source}->${e.target}`);
        steps.push({
          n,
          ruleId: best.ruleId,
          edit:
            e.op === 'merge-nodes'
              ? `${e.target} absorbiert ${e.source}${e.merges?.length ? ` (+ ${e.merges.map((m) => `${m.target}←${m.source}`).join(', ')})` : ''}`
              : `${e.source} -${e.type}-> ${e.target}${e.retire ? ` (retire ${e.retire.target})` : ''}`,
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

      console.log(
        `   Dominierender Term (Chebyshev-Maximum): ${dominant ? `${dominant.ruleId} @ ${dominant.elementId}` : 'keiner'}`,
      );

      // CR-GC-435 war die Voraussetzung dafür, dass hier ÜBERHAUPT ein Zug möglich ist,
      // und der Spike hat das damals belegt. CR-GC-488 misst nach — die Reichweite ist
      // wieder 0, aber aus einem anderen Grund als vor CR-GC-435, und der Unterschied ist
      // der ganze Punkt. Deshalb steht hier nicht mehr eine Schrittzahl, sondern die
      // Begründung; die Begründung ist es, die rot werden muss, wenn sie sich ändert.
      //
      // (1) Der Aktionsraum ist NICHT leer. Wäre er es, wäre nicht der Score das Thema.
      expect(leftover, 'kein einziger anwendbarer Zug — dann ist der Aktionsraum leer, nicht der Score wählerisch').toBeGreaterThan(0);
      // (2) Der Engpass ist benannt und deterministisch: 19 querende SCHEMA-Verträge über
      //     EINEN Blackbox-Rand, Schwelle 4. Eine zusätzliche Kante kann Randbreite nur
      //     erhöhen — kein Operator des heutigen Satzes senkt sie an DIESER Stelle.
      expect(dominant, 'kein Verdict trug worstAt — ohne den dominierenden Term ist die Null nicht lesbar').not.toBeNull();
      expect(`${dominant!.ruleId} @ ${dominant!.elementId}`).toBe('BW-02 @ FUNC-block-grounding');
      // (3) Und deshalb kommt kein Zug. Wird das eines Tages falsch — weil ein Operator
      //     dazukam oder der Engpass abgetragen wurde —, MUSS dieser Test rot werden: der
      //     Befund oben ist dann veraltet und gehört neu geschrieben, nicht stillschweigend
      //     überholt. Der erste Zug an diesem Engpass ist heute ein menschlicher: die Zahl
      //     steht in `graph_metrics` und in graph-view-edit sichtbar am Element.
      expect(steps.length, 'ein Zug ist möglich geworden — der Befund oben ist veraltet, bitte neu messen').toBe(0);
      // Trockenübung: der produktive SSOT ist nachweislich unverändert.
      expect(sha256(REPO_GRAPH)).toBe(ssot);
    } finally {
      await dropRig(rig);
    }
  }, 900_000);

  // -------------------------------------------------------------------------
  // -------------------------------------------------------------------------
  // Lauf B — der 8er-Handschnitt: ZURUECKGEBAUT mit CR-GC-446.
  //
  // Lauf B simulierte den 8er-Zielschnitt auf dem damaligen 17-MOD-SSOT. Sein
  // Subjekt existiert nicht mehr: CR-GC-445 hat die FLOW-/SCHEMA-Haelfte am
  // echten Modell gefahren (und sechs der sechs SCHEMA-Merges nach fachlicher
  // Pruefung ABGELEHNT), CR-GC-446 hat den Modulschnitt am echten Modell
  // vollzogen — auf FUENF Module, nicht acht. MOD-harness/-docs/-skills/-hooks/
  // -conformance/-element-slice/-completeness/-host-bridge und die sieben
  // FLOW-Quellen gibt es im SSOT nicht mehr; der Nachbau haette nur noch
  // Namenskollisionen mit den heutigen Modulen (MOD-agent-surface) gemessen.
  //
  // Die Zahl, die Lauf B liefern sollte (Obergrenze des Umhaengens), liegt in
  // CR-GC-436 Nachtrag 2 und ist durch CR-GC-446 am produktiven Modell abgeloest:
  // Kohaesion 9,7 % -> 17,2 %, Modul-Paare 79 -> 10, 0-Kohaesions-Module 3 -> 0.
  // Ein zweiter, simulierter Schnitt neben dem echten waere genau der parallele
  // Pfad, den CLAUDE.md verbietet. Lauf A (Reichweite des Autopiloten) bleibt —
  // er misst den Vorschlagspfad, nicht eine Partition.
  // -------------------------------------------------------------------------

});
