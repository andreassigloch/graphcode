// SPIKE-GC-minimal-whitebox — Arme A0 / A / B, deterministisch (kein LLM).
//
// Pro Job:
//   B = Blast-Radius   (harness.impact = die Traversierung hinter graph_impact)
//   W = Whitebox       (graph_context-Spec-Closure der Seeds, das reale Tool)
//   Ring = B \ W       als Schnittstellenzeile (uid · type · name · io/relation-Vertrag)
//   heute = buildRoundInjection (der echte Executor-Kontext, unverändert importiert)
// Nichts wird nachgebaut; alle Zahlen stammen aus dem gebundenen Tool-Registry.
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KuzuAdapter } from '@sigloch/graph-cypher-wasm';
import { SE_DESCRIPTOR, FormatECodec } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../../dist/harness.js';
import { bindToolsToHarness } from '../../dist/mcp-tools.js';
import { buildRoundInjection } from '../../dist/executor-prompt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'results');
mkdirSync(OUT, { recursive: true });

const codec = new FormatECodec(SE_DESCRIPTOR);
const tok = (s) => Math.round(s.length / 4);

/**
 * Ein Wegwerf-Repo pro Fixture: Store UND Owner-Lock liegen im Temp-Verzeichnis,
 * der Live-Store des Repos wird nie angefasst (REQ-single-kuzu-owner).
 */
async function openFixture(absGraphJson, systemId) {
  const tmp = mkdtempSync(join(tmpdir(), 'wb-'));
  mkdirSync(join(tmp, 'docs', 'graph'), { recursive: true });
  copyFileSync(absGraphJson, join(tmp, 'docs', 'graph', 'graph.json'));
  const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(tmp, '.graphcode', 'kuzu') });
  const harness = new GraphCodeHarness(
    { repoRoot: tmp, scope: { workspaceId: 'spike', systemId }, consumerType: 'system', preCommitTimeout: 5000 },
    storage,
  );
  await harness.initialize();
  const seeded = await harness.seedFromJson('docs/graph/graph.json');
  const reg = bindToolsToHarness(harness);
  return {
    harness, reg, seeded,
    graph: () => harness.getGraph(),
    close: async () => { await harness.close(); rmSync(tmp, { recursive: true, force: true }); },
  };
}

/** uids aus einem Format-E-Slice — über denselben Codec, der ihn geschrieben hat. */
function uidsOf(formatE) {
  const diff = codec.parse(formatE);
  const uids = new Set();
  for (const op of diff.operations) {
    if (op.id) uids.add(op.id);
    if (op.sourceId) uids.add(op.sourceId);
    if (op.targetId) uids.add(op.targetId);
  }
  return uids;
}

function sliceOf(graph, uidSet) {
  const nodes = graph.nodes.filter((n) => uidSet.has(n.uid));
  const edges = graph.edges.filter((e) => uidSet.has(e.sourceId) && uidSet.has(e.targetId));
  return { nodes, edges, formatE: codec.serialize({ nodes, edges }) };
}

/** Blackbox-Zeile: Identität + Vertrag (io/relation-Kanten), KEIN description-Body. */
function blackboxLine(graph, uid) {
  const n = graph.nodes.find((x) => x.uid === uid);
  if (!n) return `${uid} · ?`;
  const contract = [...new Set(graph.edges
    .filter((e) => (e.sourceId === uid || e.targetId === uid) && (e.edgeType === 'io' || e.edgeType === 'relation'))
    .map((e) => (e.sourceId === uid ? `${e.edgeType}→${e.targetId}` : `${e.sourceId} ${e.edgeType}→`)))];
  return `${n.uid} · ${n.type} · ${n.name}${contract.length ? ' · ' + contract.join(' ') : ''}`;
}

/**
 * Slice-Artefakt (§8): Format-E-Inhalt plus Rollenspalte `seed | whitebox | blackbox`.
 * Kanten nur, wenn beide Enden im Slice liegen — sonst zeigt der Viewer Kanten ins Nichts.
 */
function buildArtifact(graph, job, white, ringUids) {
  const roleOf = (uid) =>
    job.seeds.includes(uid) ? 'seed' : white.has(uid) ? 'whitebox' : 'blackbox';
  const uids = new Set([...white, ...ringUids]);
  return {
    job: job.name,
    seeds: job.seeds,
    nodes: graph.nodes
      .filter((n) => uids.has(n.uid))
      .map((n) => ({
        uid: n.uid, type: n.type, name: n.name, role: roleOf(n.uid),
        // Blackbox: NUR Identität + Vertrag. Die Beschreibung bleibt zu — das ist der Schnitt.
        description: roleOf(n.uid) === 'blackbox' ? undefined : n.description,
      })),
    edges: graph.edges
      .filter((e) => uids.has(e.sourceId) && uids.has(e.targetId))
      .map((e) => ({ source: e.sourceId, type: e.edgeType, target: e.targetId })),
  };
}

async function measureJob(fx, job) {
  const graph = fx.graph();
  const G = graph.nodes.length;

  // --- A0: Blast-Radius (Kontrolle) ---
  const blast = new Set();
  for (const s of job.seeds) for (const n of (await fx.harness.impact(s, job.blastDepth ?? 1)).nodes) blast.add(n.uid);
  const A0 = sliceOf(graph, blast);

  // --- A/B: Whitebox = Seeds + graph_context-Closure je Seed ---
  const white = new Set(job.seeds);
  const missingRefs = new Set();
  const noClosure = [];
  for (const s of job.seeds) {
    try {
      const r = await fx.reg['graph_context'].handler({ id: s, depth: job.ctxDepth ?? 1 });
      for (const u of uidsOf(r.formatE)) white.add(u);
      for (const m of r.missingRefs) missingRefs.add(m);
    } catch (err) { noClosure.push(`${s}: ${err.message}`); }
  }
  const W = sliceOf(graph, white);

  const ringUids = [...blast].filter((u) => !white.has(u)).sort();
  const ringText = ringUids.map((u) => blackboxLine(graph, u)).join('\n');

  const armB = W.formatE;                              // Whitebox pur
  const armA = ringText ? `${W.formatE}\n\n## Blackbox-Ring (Schnittstelle, nicht öffnen)\n${ringText}` : W.formatE;

  // --- heute: der echte Executor-Kontext ---
  const today = await buildRoundInjection(fx.reg, { focusTypes: job.focusTypes ?? [] });

  // --- Ground Truth ---
  const gt = job.groundTruth ?? [];
  const inW = gt.filter((u) => white.has(u));
  const inB = gt.filter((u) => blast.has(u));
  const onlyRing = gt.filter((u) => !white.has(u) && blast.has(u));
  const outside = gt.filter((u) => !white.has(u) && !blast.has(u));
  // Sieht der HEUTIGE Executor-Kontext die Job-Knoten ueberhaupt? (uid-Zeilen im Index)
  const inToday = gt.filter((u) => today.includes(u));
  // Lage von W zu B: der Kern der H1-Frage — ist W ueberhaupt eine Teilmenge?
  const wInB = [...white].filter((u) => blast.has(u));
  const wOutB = [...white].filter((u) => !blast.has(u));

  return {
    job: job.name, seeds: job.seeds, G,
    blast: { nodes: blast.size, edges: A0.edges.length, tokens: tok(A0.formatE) },
    whitebox: { nodes: white.size, edges: W.edges.length, tokens: tok(armB) },
    ring: { nodes: ringUids.length, tokens: tok(ringText) },
    armA_tokens: tok(armA), armB_tokens: tok(armB), today_tokens: tok(today),
    ratios: {
      W_over_B: blast.size ? +(white.size / blast.size).toFixed(3) : null,
      W_over_G: +(white.size / G).toFixed(3),
      today_over_G: 1,
    },
    groundTruth: {
      total: gt.length, inWhitebox: inW.length, inBlast: inB.length, inTodayIndex: inToday.length,
      onlyInRing: onlyRing, outsideBlast: outside,
      missedByBlast: gt.filter((u) => !blast.has(u)),
      missedByToday: gt.filter((u) => !today.includes(u)),
    },
    overlap: { W_and_B: wInB.length, W_outside_B: wOutB.length, W_outside_B_uids: wOutB.sort() },
    missingRefs: [...missingRefs], noClosure,
    // §8: EIN serialisierbares Slice-Objekt je Arm — Rollenspalte je Knoten.
    // Genau das, was ein Viewer rendert; er rechnet den Schnitt NICHT nach.
    artifact: buildArtifact(graph, job, white, ringUids),
    texts: { armA, armB, a0: A0.formatE, today },
  };
}

export { openFixture, measureJob, uidsOf, sliceOf, blackboxLine, tok, OUT, writeFileSync, join };
