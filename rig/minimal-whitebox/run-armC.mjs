// Arm C — Executor-Runde mit WHITEBOX statt `graph_elements({})`.
//
// Manipulation an EINER Stelle: der Element-Index, den `buildRoundInjection`
// rendert, kommt nicht mehr aus dem ganzen Graphen, sondern aus
//   W = Fund-Elemente des Schritts + 1-Ring  ∪  alle Knoten der Fokus-Typen.
// Alles andere (Prompt, Guide-Slice, Modell, Runden, N) bleibt die CR-GC-293-
// Baseline. Der Executor selbst wird NICHT verändert — der Rig wrappt das
// Registry, das er bekommt.
//
// Baselines (rig/greenfield-systemtest/results/README.md):
//   v20-noinject  24 Rd., N=3, injection=false -> 40 El / 51 Tr
//   v19-recount   16+7 Rd., N=3, injection=true -> 31 El (unterbrochen)
//   v15           24 Rd., N=1, injection=true  -> 22 El
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KuzuAdapter } from '@sigloch/graph-api-core/kuzu';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../../dist/harness.js';
import { bindToolsToHarness } from '../../dist/mcp-tools.js';
import { runExecutor, ExecutorConfigSchema } from '../../dist/executor.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'results');
mkdirSync(OUT, { recursive: true });
const TAG = process.env.ARM_C_TAG ?? 'armC-whitebox';
// Arm-Modus: 'whitebox' = W statt Voll-Index · 'full' = heutiger Voll-Index (Baseline)
// · 'off' = injection=false (CR-GC-293-Bedingung v20). Alles andere identisch.
const MODE = process.env.ARM_C_MODE ?? 'whitebox';
const LOG = join(OUT, `${TAG}.run.log`);

const INTENT =
  'Multiuser-fähige Web-App aus dem graphcode harness: Nutzer melden sich an, autorieren ' +
  'gemeinsam einen governten Systemgraphen über das Apply-Gate, sehen Live-Updates und ' +
  'exportieren den Stand.';

const repoRoot = mkdtempSync(join(tmpdir(), 'armC-'));
mkdirSync(join(repoRoot, 'docs', 'graph'), { recursive: true });
const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode', 'kuzu') });
const harness = new GraphCodeHarness(
  { repoRoot, scope: { workspaceId: 'armC', systemId: 'armC' }, consumerType: 'system', preCommitTimeout: 5000 },
  storage,
);
await harness.initialize();
const registry = bindToolsToHarness(harness);

// --- die EINE Manipulation ------------------------------------------------
let injectionCalls = 0;
let modelUnfilteredCalls = 0;   // Konfundierungs-Zähler: ruft das MODELL graph_elements{}?
const inner = registry['graph_elements'].handler;
let injectionWindow = false;

async function whiteboxNodes() {
  const step = await origGenerate({ intent: INTENT });
  const focusTypes = step.focusTypes ?? [];
  const graph = harness.getGraph();
  const seeds = graph.nodes.map((n) => n.uid).filter((u) => step.prompt.includes(u));
  const keep = new Set(seeds);
  for (const s of seeds) {
    try { for (const n of (await harness.subgraph(s, 1, 'both')).nodes) keep.add(n.uid); } catch { /* neuer Knoten */ }
  }
  for (const n of graph.nodes) if (focusTypes.includes(n.type)) keep.add(n.uid);
  return graph.nodes.filter((n) => keep.has(n.uid)).map((n) => ({ uid: n.uid, type: n.type, name: n.name }));
}

const origGenerate = registry['graph_generate'].handler;
registry['graph_generate'] = {
  ...registry['graph_generate'],
  async handler(input) { const r = await origGenerate(input); injectionWindow = true; return r; },
};

registry['graph_elements'] = {
  ...registry['graph_elements'],
  async handler(input) {
    const unfiltered = !input || (!input.type && !input.search);
    if (unfiltered && injectionWindow && MODE === 'whitebox') {
      injectionWindow = false;      // Einmal pro Runde — buildRoundInjection ruft genau 1x
      injectionCalls++;
      const nodes = await whiteboxNodes();
      appendFileSync(LOG, `[whitebox-index] ${nodes.length} von ${harness.getGraph().nodes.length} Knoten\n`);
      return { nodes, total: nodes.length };
    }
    if (unfiltered) modelUnfilteredCalls++;
    return inner(input);
  },
};

// Einmal-Fenster: der Executor ruft je Runde erst graph_generate, dann
// buildRoundInjection (genau EIN graph_elements). Danach ist das Fenster zu —
// jeder weitere ungefilterte Aufruf kommt vom MODELL und wird nur gezählt,
// nicht ersetzt (sonst wäre die Messung konfundiert).

const config = ExecutorConfigSchema.parse({
  backend: 'openai',
  baseUrl: process.env.LMSTUDIO ?? 'http://localhost:1234',
  model: process.env.ARM_C_MODEL ?? 'mistralai/devstral-small-2-2512',
  maxRounds: Number(process.env.ARM_C_ROUNDS ?? 24),
  candidates: Number(process.env.ARM_C_N ?? 3),
  judge: 'gate',
  injection: MODE !== 'off',
  temperature: 0.15,
  maxTokens: Number(process.env.ARM_C_MAX_TOKENS ?? 2048),
  ...(process.env.ARM_C_EFFORT ? { reasoningEffort: process.env.ARM_C_EFFORT } : {}),
  callTimeoutMs: Number(process.env.ARM_C_TIMEOUT ?? 600000),
});

const t0 = Date.now();
const trace = (line) => { appendFileSync(LOG, line + '\n'); console.log(line); };
const stats = await runExecutor({ registry, workspaceDir: repoRoot, intent: INTENT, config, trace });
const wall = Math.round((Date.now() - t0) / 1000);

const graph = harness.getGraph();
const readiness = await registry['graph_readiness'].handler({});
const byType = {};
for (const n of graph.nodes) byType[n.type] = (byType[n.type] ?? 0) + 1;
const result = {
  tag: TAG, model: config.model, rounds: config.maxRounds, candidates: config.candidates,
  injection: MODE, wallSeconds: wall,
  elements: graph.nodes.length, traces: graph.edges.length, byType,
  injectionCalls, modelUnfilteredCalls, stats, readiness,
};
writeFileSync(join(OUT, `${TAG}.result.json`), JSON.stringify(result, null, 2));
writeFileSync(join(OUT, `${TAG}.graph.json`), JSON.stringify(
  { elements: graph.nodes, traces: graph.edges }, null, 2));
console.log(JSON.stringify({ elements: result.elements, traces: result.traces, byType, wall, injectionCalls, modelUnfilteredCalls }, null, 2));
await harness.close();
rmSync(repoRoot, { recursive: true, force: true });
