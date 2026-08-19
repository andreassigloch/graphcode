// Arm "pull" — KEINE Injektion + die Präzisions-Trias im Tool-Angebot.
//
// Frage: liest das Modell breit (`graph_elements` ungefiltert), WEIL ihm ein
// präzises Lese-Werkzeug fehlt? Der `off`-Arm aus Arm C (rig/minimal-whitebox/
// results/qwen36/) ist die Vergleichsbedingung: identischer Intent, identische
// Runden/N/Tokens/Temperatur, injection=false — einzige Variable ist, dass dem
// Modell zusätzlich `graph_context` / `graph_impact` / `graph_expand` angeboten
// werden.
//
// Die EINE Manipulation:
//   AUTHORING_TOOLS (src/executor-prompt.ts) wird zur Laufzeit um die Trias
//   erweitert. `src/` bleibt unverändert; das Set ist ein exportiertes Objekt,
//   der Rig mutiert seine Kopie im eigenen Prozess.
//
// Warum nicht "geprunetes Registry + toolset:'full'": buildToolSpecs bietet dem
// Modell bei 'full' ALLES außer WITHHELD_TOOLS an. `graph_get_edges` braucht der
// Executor intern (loadGraphSnapshot), müsste also im Registry bleiben — und
// wäre dem Modell dann zusätzlich angeboten. Das wäre ein zweiter Unterschied
// zum `off`-Arm. Über AUTHORING_TOOLS ist die Delta-Menge exakt +3.
//
// Executor-intern gerufene Registry-Tools (grep `registry[` in src/executor.ts):
//   graph_generate (jede Runde) · graph_elements({limit:100000}) +
//   graph_get_edges({edgeType:'verify'}) (loadGraphSnapshot, je runMutate) ·
//   graph_mutate (Gate-Call) · graph_authoring_guide (nur buildRoundInjection,
//   hier injection=false ⇒ nie). Alle bleiben im Registry.
//
// Zählung: `trace` ist die exakte Quelle für MODELL-Tool-Calls (der Executor
// tracet jeden Turn als "cand n/m.t: name,name"). Die Handler-Wrapper zählen
// zusätzlich ALLE Aufrufe; internal = total − model. Der Zähler
// `modelUnfilteredCalls` aus run-armC.mjs ist NICHT trennscharf (er zählt die
// Preflight-Snapshots und im Modus `full` den Injektions-Aufruf mit) — hier
// stehen beide Größen nebeneinander.
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KuzuAdapter } from '@sigloch/graph-api-core/kuzu';
import { SE_DESCRIPTOR } from '@sigloch/graph-api-core';
import { GraphCodeHarness } from '../../dist/harness.js';
import { bindToolsToHarness } from '../../dist/mcp-tools.js';
import { runExecutor, ExecutorConfigSchema, buildToolSpecs } from '../../dist/executor.js';
import { AUTHORING_TOOLS } from '../../dist/executor-prompt.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'results');
mkdirSync(OUT, { recursive: true });
const TAG = process.env.ARM_C_TAG ?? 'armC-pull';
const LOG = join(OUT, `${TAG}.run.log`);
// STUB=1: Verdrahtungs-Nachweis ohne Modell-Kosten (deterministischer callModel).
const STUB = process.env.ARM_PULL_STUB === '1';

/** Die Präzisions-Trias — der einzige Unterschied zum `off`-Arm. */
const PRECISION_TOOLS = ['graph_context', 'graph_impact', 'graph_expand'];

const INTENT =
  'Multiuser-fähige Web-App aus dem graphcode harness: Nutzer melden sich an, autorieren ' +
  'gemeinsam einen governten Systemgraphen über das Apply-Gate, sehen Live-Updates und ' +
  'exportieren den Stand.';

const repoRoot = mkdtempSync(join(tmpdir(), 'armC-pull-'));
mkdirSync(join(repoRoot, 'docs', 'graph'), { recursive: true });
const storage = new KuzuAdapter({ ontology: SE_DESCRIPTOR, path: join(repoRoot, '.graphcode', 'kuzu') });
const harness = new GraphCodeHarness(
  { repoRoot, scope: { workspaceId: 'armC', systemId: 'armC' }, consumerType: 'system', preCommitTimeout: 5000 },
  storage,
);
await harness.initialize();
const registry = bindToolsToHarness(harness);

// --- die EINE Manipulation ------------------------------------------------
const missing = PRECISION_TOOLS.filter((t) => !registry[t]);
if (missing.length > 0) throw new Error('Registry kennt diese Tools nicht: ' + missing.join(','));
for (const t of PRECISION_TOOLS) AUTHORING_TOOLS.add(t);

// --- Zählung ---------------------------------------------------------------
const totalCalls = {};      // jeder Registry-Aufruf, egal wer
const unfilteredElements = { total: 0 };  // graph_elements ohne type/search (Baseline-Semantik)
for (const name of Object.keys(registry)) {
  const inner = registry[name].handler;
  registry[name] = {
    ...registry[name],
    async handler(input) {
      totalCalls[name] = (totalCalls[name] ?? 0) + 1;
      if (name === 'graph_elements' && (!input || (!input.type && !input.search))) {
        unfilteredElements.total += 1;
      }
      return inner(input);
    },
  };
}

// Modell-Tool-Calls exakt aus dem Trace (Executor tracet jeden Modell-Turn).
const modelCalls = {};
let tracedTurns = 0;
// Alle DREI Label-Formen des Executors (cand k/n.t · repair cand k.t · R.T),
// identisch zu tally-toolcalls.mjs — wer nur die erste greppt, verliert die
// Repair-Turns. Kanonisch bleibt trotzdem das Tally über die *.run.log.
const TURN_RE = /^\s{2}(?:cand \d+\/\d+|repair cand \d+|\d+)\.\d+: (.+)$/;
const RECOVER_RE = /recovered text tool-call (\S+)/;
const trace = (line) => {
  appendFileSync(LOG, line + '\n');
  console.log(line);
  const m = TURN_RE.exec(line);
  if (m) {
    tracedTurns += 1;
    if (!m[1].startsWith('(')) {
      for (const raw of m[1].split(',')) {
        const n = raw.trim();
        if (/^[a-z_]+$/.test(n)) modelCalls[n] = (modelCalls[n] ?? 0) + 1;
      }
    }
  }
  const r = RECOVER_RE.exec(line);
  if (r) modelCalls[r[1]] = (modelCalls[r[1]] ?? 0) + 1;
};

const config = ExecutorConfigSchema.parse({
  backend: process.env.ARM_C_BACKEND ?? 'openai',
  baseUrl: process.env.LMSTUDIO ?? 'http://localhost:1234',
  model: process.env.ARM_C_MODEL ?? 'mistralai/devstral-small-2-2512',
  maxRounds: Number(process.env.ARM_C_ROUNDS ?? 12),
  candidates: Number(process.env.ARM_C_N ?? 3),
  judge: 'gate',
  injection: false,          // Arm "pull" = KEINE Injektion
  toolset: 'authoring',      // = AUTHORING_TOOLS ∪ Trias (s.o.)
  temperature: 0.15,
  maxTokens: Number(process.env.ARM_C_MAX_TOKENS ?? 8192),
  ...(process.env.ARM_C_EFFORT ? { reasoningEffort: process.env.ARM_C_EFFORT } : {}),
  ...(process.env.ARM_C_API_KEY ? { apiKey: process.env.ARM_C_API_KEY } : {}),
  callTimeoutMs: Number(process.env.ARM_C_TIMEOUT ?? 900000),
});

// Was das Modell tatsächlich angeboten bekommt — vor dem Lauf festgehalten.
const offered = buildToolSpecs(registry, config.toolset).map((t) => t.name);
appendFileSync(LOG, `[tool-offer] ${offered.join(', ')}\n`);
console.log('[tool-offer]', offered.join(', '));

// --- Stub-callModel: Verdrahtungs-Nachweis ohne Modell ---------------------
// Deterministisch: Turn 1 = ein Präzisions-Lesecall, Turn 2 = ein graph_mutate.
let stubSeenTools = null;
const stubPrompts = [];
const stubTurn = new Map();
const stubCallModel = async (_system, messages, tools) => {
  stubSeenTools = tools.map((t) => t.function?.name ?? t.name);
  const last = JSON.stringify(messages[0]?.content ?? '');
  stubPrompts.push(last);
  const key = messages.length;
  const n = (stubTurn.get(last) ?? 0) + 1;
  stubTurn.set(last, n);
  const uid = 'UC-stub-' + stubPrompts.length;
  const call =
    n === 1
      ? { id: 'c' + key, name: 'graphcode_graph_context', input: { uid: 'SYS-armC' } }
      : {
          id: 'c' + key,
          name: 'graphcode_graph_mutate',
          input: {
            commands: [
              {
                op: 'add-node',
                node: { uid, type: 'UC', name: 'Stub ' + stubPrompts.length, description: 'Stub-Knoten des Verdrahtungstests.', attributes: {} },
              },
            ],
          },
        };
  return {
    text: '',
    toolCalls: [call],
    assistantMsg: {
      role: 'assistant',
      content: null,
      tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: JSON.stringify(call.input) } }],
    },
    usage: { in: 0, out: 0, reasoning: 0 },
  };
};

const t0 = Date.now();
const stats = await runExecutor({
  registry,
  workspaceDir: repoRoot,
  intent: INTENT,
  config,
  trace,
  ...(STUB ? { callModel: stubCallModel } : {}),
});
const wall = Math.round((Date.now() - t0) / 1000);

const graph = harness.getGraph();
const readiness = await registry['graph_readiness'].handler({});
const byType = {};
for (const n of graph.nodes) byType[n.type] = (byType[n.type] ?? 0) + 1;

// internal = total − model. graph_mutate: der Executor ruft das Gate für jeden
// Kandidaten (dryRun) und den Gewinner — die Modellzahl ist die Emission.
const internalCalls = {};
for (const [n, c] of Object.entries(totalCalls)) {
  const d = c - (modelCalls[n] ?? 0);
  if (d !== 0) internalCalls[n] = d;
}

const result = {
  tag: TAG,
  arm: 'pull',
  model: config.model,
  backend: config.backend,
  rounds: config.maxRounds,
  candidates: config.candidates,
  maxTokens: config.maxTokens,
  // Auditierbar halten: die Baseline-Arme liefen mit ARM_C_EFFORT=low (run-armC-ab.sh).
  reasoningEffort: config.reasoningEffort ?? null,
  injection: 'off',
  toolset: config.toolset,
  offeredTools: offered,
  precisionTools: PRECISION_TOOLS,
  stub: STUB,
  wallSeconds: wall,
  elements: graph.nodes.length,
  traces: graph.edges.length,
  byType,
  modelToolCalls: modelCalls,
  tracedModelTurns: tracedTurns,
  totalRegistryCalls: totalCalls,
  internalRegistryCalls: internalCalls,
  // graph_mutate ist in dieser Differenz NICHT interpretierbar: das Modell
  // *emittiert* den Batch (modelToolCalls), der Executor sammelt ihn ein und
  // ruft das Gate selbst — je Kandidat einmal als dryRun-Probe und für den
  // Gewinner nochmal. total = Gate-Calls, model = Emissionen; die Differenz ist
  // kein "interner Extra-Aufruf". Für alle übrigen Tools gilt sie.
  internalCallsNote: 'internal = total − model; für graph_mutate bedeutungslos (Gate-Calls vs. Emissionen)',
  unfilteredElementsCalls: unfilteredElements.total,
  stats,
  readiness,
};
writeFileSync(join(OUT, `${TAG}.result.json`), JSON.stringify(result, null, 2));
writeFileSync(join(OUT, `${TAG}.graph.json`), JSON.stringify({ elements: graph.nodes, traces: graph.edges }, null, 2));

if (STUB) {
  const expected = [...AUTHORING_TOOLS].map((n) => 'graphcode_' + n);
  const offeredGc = offered.filter((n) => n.startsWith('graphcode_'));
  const checks = {
    'tool-liste an das Modell == AUTHORING_TOOLS ∪ Trias':
      [...offeredGc].sort().join(',') === [...expected].sort().join(','),
    'Trias im Angebot': PRECISION_TOOLS.every((t) => offeredGc.includes('graphcode_' + t)),
    'graph_generate/graph_next_step NICHT im Angebot':
      !offeredGc.includes('graphcode_graph_generate') && !offeredGc.includes('graphcode_graph_next_step'),
    'Backend bekam genau diese Tools': stubSeenTools !== null &&
      [...stubSeenTools].sort().join(',') === [...offered].sort().join(','),
    'kein Injektions-Block im Runden-Prompt':
      stubPrompts.length > 0 &&
      !stubPrompts.some((p) => p.includes('Element-Index des Graphen') || p.includes('Kanten-Grammatik der Fokus-Typen')),
    'buildRoundInjection lief nicht (kein graph_authoring_guide-Aufruf durch den Executor)':
      (internalCalls['graph_authoring_guide'] ?? 0) === 0,
    'Trias-Call des Modells wurde ausgeführt': (modelCalls['graph_context'] ?? 0) > 0 &&
      (totalCalls['graph_context'] ?? 0) > 0,
    'Lauf terminiert, Mutationen angewandt': stats.mutatesApplied > 0,
  };
  const fails = Object.entries(checks).filter(([, ok]) => !ok);
  console.log('\n=== Verdrahtungs-Nachweis (STUB) ===');
  for (const [k, ok] of Object.entries(checks)) console.log((ok ? 'OK   ' : 'FAIL ') + k);
  console.log('promptProbe:', JSON.stringify(stubPrompts[0] ?? '').slice(0, 600));
  writeFileSync(join(OUT, `${TAG}.wiring.json`), JSON.stringify(
    { offered, checks, modelCalls, totalCalls, stats, firstPrompt: stubPrompts[0] ?? null }, null, 2));
  if (fails.length > 0) process.exitCode = 1;
}

console.log(JSON.stringify({
  elements: result.elements, traces: result.traces, byType, wall,
  modelToolCalls: modelCalls, unfilteredElementsCalls: unfilteredElements.total,
}, null, 2));
await harness.close();
rmSync(repoRoot, { recursive: true, force: true });
