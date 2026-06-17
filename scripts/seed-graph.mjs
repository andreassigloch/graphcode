// GraphCode SE graph — BOOTSTRAP / INPUT (run once).
//
// Governance: the materialized graph (docs/graph/graphcode.graph.json) and the
// live harness are the SINGLE POINT OF TRUTH. This script, docs/SPEC.md and
// docs/RECOMMENDATIONS.md are historical *input* — not authoritative. See REQ-graph-is-ssot.
//
// LAYERING (2026-06-16, full data-flow):
//   UC (customer benefit) ─compose→ FCHAIN (behavioral scenario) ─compose→ FUNC (operation)
//   FUNC ─io→ FLOW ─io→ FUNC   (functions chain ONLY through FLOW; there is no FUNC→FUNC)
//   ACTOR ─io→ FLOW ─io→ FUNC  (actors reach functions ONLY through FLOW)
//   FUNC ─satisfy→ {UC, REQ} · FUNC ─allocate→ MOD · FCHAIN ─satisfy→ REQ (end-to-end NFR)
//   REQ kinds incl. precondition/postcondition (pre/post = REQ). TEST ─verify→ REQ.
// All edges conform to @sigloch/contracts/se TRACE_PATTERNS.
//
// Usage: node scripts/seed-graph.mjs   (harness must run at $GRAPH_API, default :3001)
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const TS = '2026-06-16T00:00:00.000Z';
const API = process.env.GRAPH_API || 'http://localhost:3001';

const E = [];
const T = [];
const el = (id, type, name, description, extra = {}) =>
  E.push({ id, type, name, description, status: extra.status ?? 'reviewed', created_at: TS, ...extra });
const tr = (source, target, type) => T.push({ source, target, type, weight: 1, created_at: TS });
const req = (id, name, description, kinds) => el(id, 'REQ', name, description, { kinds, status: 'open' });
const reqKind = (id, name, description, kind) => el(id, 'REQ', name, description, { kinds: [kind], status: 'open' });
const test = (id, name, description, method = 'test') => el(id, 'TEST', name, description, { method, status: 'open' });
const flow = (id, name, description) => { if (!E.some(e => e.id === id)) el(id, 'FLOW', name, description); };
// pipe([{node},{flow,name,desc},{node},...]) → FLOW els + io edges (node→flow→node per hop)
const pipe = (steps) => {
  for (let i = 0; i + 2 < steps.length; i += 2) {
    const a = steps[i], m = steps[i + 1], b = steps[i + 2];
    flow(m.flow, m.name, m.desc);
    tr(a.node, m.flow, 'io');
    tr(m.flow, b.node, 'io');
  }
};

// ── SYS ──
el('SYS-graphcode', 'SYS', 'GraphCode',
  'Headless Claude-Code-Sidecar-Governance-Harness: Store + Apply-Gate + Hooks + Learning-Emission, eine Instanz pro Repo. Carve-Out aus aimprove. (README, SPEC §0)');

// ── MOD (4 runtime + 2 app-specific) ──
el('MOD-harness', 'MOD', 'harness.ts — GraphCodeHarness', 'Apply-Gate: loadGraph/saveGraph/mutate/evaluateRules/close gegen lokalen Kuzu. (SPEC §2.1)');
el('MOD-mcp-tools', 'MOD', 'mcp-tools.ts — MCP-Registry', 'MCP-stdio Tool-Registry, an die Harness gebunden; read/write/query Tools. (SPEC §2.2)');
el('MOD-hooks', 'MOD', 'hooks.ts — HookSystem', 'pre-commit / post-apply / nightly-batch Extension-Points. (SPEC §2.3)');
el('MOD-codec', 'MOD', 'codec.ts — GraphCodeCodec', 'Format-E ↔ OntologyGraph, deterministische Serialisierung, Validierung gegen SE-Ontologie. (SPEC §2.4)');
el('MOD-cli', 'MOD', 'cli — npx-Distribution & Lifecycle', 'bin `npx @sigloch/graphcode init|update|remove`: self-contained Installer. App-spezifisch. (REQ-npx-distribution)');
el('MOD-docs', 'MOD', 'docs — Markdown-Re-Exporter', 'App-spezifisches Rendering: Graph → Markdown-Views (deterministisch, GENERATED-Header). (REQ-doc-export, code-realisiert, target)');
el('MOD-skills', 'MOD', 'skills/prompts — agent-realisierte Funktionen', 'App-spezifisches Modul: .claude/skills/ (+ Prompts) — Skill-/Prompt-Definitionen als agent-ausgeführte Funktionen (z.B. se-view-* Graph→Markdown-Views). Lifecycle via FUNC-harness-cli. Allokation hierher = prompt-realisiert (vs. code-realisiert in den übrigen MODs). Beweis: Skills = Funktionen.');

// ── ACTOR ──
el('ACTOR-claude-code', 'ACTOR', 'Claude Code — Realisierungs-Agent', 'Realisierungs-Agent unter graphcode-Kontrolle (OpenCode-executed); MCP-stdio-Client; nutzt den Graphen statt grep (Ziel a). Delegierte HOW-Ebene. (SPEC §5 Kanal 1)');
el('ACTOR-dashboard', 'ACTOR', 'Browser-Dashboard', 'SSE/WS read-only Viewer; Live-Q-Status-Visualisierung (Ziel b). (SPEC §5 Kanal 2)');
el('ACTOR-learning-engine', 'ACTOR', 'Learning-Engine', 'Consumer der post-apply/nightly Trajectory-/Outcome-Emissionen. (SPEC §2.3)');
el('ACTOR-developer', 'ACTOR', 'Entwickler / Repo-Owner', 'Kunde/Nutzer: will exzellente Code-Qualität bei effizientem Testen und minimalem Token-/LLM-Aufwand.');
el('ACTOR-graphify', 'ACTOR', 'graphify (Slicer)', 'Externes Slicer-System; produziert Format-E aus großen Code/Docs zum Import. graphcode extrahiert NICHT selbst (REQ-no-extraction).');
el('ACTOR-systems-engineer', 'ACTOR', 'Systems Engineer', 'Kunde: arbeitet auf Architektur-/Nutzen-Ebene (UC/REQ/FUNC/FCHAIN), delegiert Realisierung an gegatete Agenten. Die WAS-Ebene.');
el('ACTOR-vibe-coder', 'ACTOR', 'Vibe Coder', 'Kunde: denkt in Architektur + Kundennutzen, delegiert Code-Realisierung an graphcode-kontrollierte Agenten. Die WAS-Ebene.');
el('ACTOR-facilitating-agent', 'ACTOR', 'Facilitating Agent — Architekt', 'Gegateter Agent mit Architektur-Autorität: bearbeitet Interface-Änderungs-Eskalationen — Impact-Analyse, Gate-Entscheidung, Dependents koordinieren.');

// ── SCHEMA (Interface-Datenformate, Layer 2; zodDefinition referenziert @sigloch/contracts) ──
const schema = (id, name, description, zodDefinition) => el(id, 'SCHEMA', name, description, { attributes: { zodDefinition } });
schema('SCHEMA-mutate-command', 'MutateCommand', 'Edit-Operation durch das Gate. @sigloch/contracts harness (D1).',
  "z.object({ op: z.enum(['add','update','delete']), target: z.enum(['node','edge']), element: z.unknown(), consumerType: z.string() })");
schema('SCHEMA-mutate-result', 'MutateResult', 'Apply-Ergebnis + Violations + Confidence/Tier. @sigloch/contracts harness (D1).',
  "z.object({ success: z.boolean(), applied: z.number(), violations: z.array(z.object({ ruleId: z.string(), severity: z.enum(['error','warning','info']), elementId: z.string(), msg: z.string() })), confidence: z.number().optional(), tier: z.enum(['auto','suggest','block']).optional() })");
schema('SCHEMA-ontology-graph', 'OntologyGraph', 'Elements (13 ElementTypes) + Traces (7 TraceTypes). @sigloch/contracts/se.',
  "z.object({ elements: z.array(z.object({ id: z.string(), type: ElementType, name: z.string(), description: z.string() })), traces: z.array(z.object({ source: z.string(), target: z.string(), type: TraceType })) })");
schema('SCHEMA-format-e', 'Format-E', 'Kompaktes Snapshot-/Diff-Format. @sigloch/contracts/se.',
  "z.object({ nodes: z.array(z.string()), edges: z.array(z.string()), operations: z.array(z.enum(['+','-','~','M'])).optional(), baseSnapshot: z.string().optional() })");
schema('SCHEMA-trajectory', 'Trajectory/Outcome', 'append-only Lern-Emission. @sigloch/learning-core.',
  "z.object({ step: z.string(), action: z.string(), outcome: z.string(), ts: z.string() })");
schema('SCHEMA-update-event', 'UpdateEvent', 'SSE invalidate Event.',
  "z.object({ type: z.literal('invalidate'), domains: z.array(z.enum(['graph','rules','readiness','suggestions'])), version: z.number() })");
schema('SCHEMA-query-params', 'QueryParams', 'Query-/Request-Parameter.',
  "z.object({ elementId: z.string().optional(), depth: z.number().optional(), branch: z.string().optional(), cursor: z.string().optional(), view: z.string().optional() })");
schema('SCHEMA-cli-command', 'CliCommand', 'npx-CLI Kommando + Ergebnis.',
  "z.object({ command: z.enum(['init','update','remove']), repoPath: z.string(), result: z.string().optional() })");
schema('SCHEMA-markdown-view', 'MarkdownView', 'Generierte human-readable View mit GENERATED-Header.',
  "z.object({ view: z.string(), markdown: z.string(), generated: z.literal(true) })");

// ── MS (Milestones) — M1 Spezifikation (Gate: IRR) → M2 Coding & V&V ──
el('MS-1-specification', 'MS', 'M1: Spezifikation', 'Modell (UC/REQ/FUNC/Architektur/Interfaces/Tests) + ADR-001 + CR-Spezifikationen. Abschluss-Gate: IRR (Internal Readiness Review, docs/records/irr.md).');
el('MS-2-coding-vv', 'MS', 'M2: Coding & V&V', 'Realisierung der Module (CR-GC-100..103, 107) + Verifikation/Validierung (Tests, Benchmark). Start nach IRR-Freigabe.');

// ════════════════════════════════ LAYER 1 — CUSTOMER USE CASES ════════════════════════════════
const UCS = [
  { id: 'UC-code-quality', name: 'Exzellente, governte Code-Qualität',
    desc: 'Als Entwickler will ich exzellente, konsistente Code-Qualität: jede Änderung (Mensch/KI) ist ontologie-/regel-konform und driftet nicht — Architektur/Interfaces/Integration/Tests strikt aus dem governten Graph getrieben.',
    reqs: [
      { id: 'REQ-code-governed-quality', name: 'Gate-validierte, driftfreie Qualität', kind: 'functional', desc: 'Jede Code-/Modell-Änderung ist gate-validiert (SE-Ontologie + V3_RULES), konsistent und driftfrei — kein ungeprüfter Schreibpfad.' },
      { id: 'REQ-structure-driven', name: 'Struktur-getrieben (Schema-first)', kind: 'non-functional', desc: 'Architektur/Interfaces/Integration/Tests werden strikt aus dem governten Graph abgeleitet (Schema-first), nicht ad-hoc.' },
    ],
    actors: ['ACTOR-systems-engineer', 'ACTOR-vibe-coder', 'ACTOR-developer', 'ACTOR-claude-code', 'ACTOR-dashboard', 'ACTOR-graphify', 'ACTOR-facilitating-agent'],
    test: { id: 'TEST-code-quality', req: 'REQ-code-governed-quality', name: 'Code-Quality-Gate-Test', desc: 'Regelverletzende Änderung wird vom Gate geblockt; konformer Graph bleibt driftfrei.' } },
  { id: 'UC-efficient-testing', name: 'Effizientes, impact-basiertes Testen',
    desc: 'Als Entwickler will ich nur die richtigen Tests laufen lassen: der Impact-/Abhängigkeitsgraph bestimmt das selektive Testset; „erledigt" = „nachgewiesen".',
    reqs: [{ id: 'REQ-impact-based-testing', name: 'Selektives Testset via Impact', kind: 'functional', desc: 'Testset wird aus dem Impact-/Abhängigkeitsgraph bestimmt (richtige Tests statt alle); Coverage = nachgewiesen.' }],
    actors: ['ACTOR-systems-engineer', 'ACTOR-vibe-coder', 'ACTOR-developer'],
    test: { id: 'TEST-efficient-testing', req: 'REQ-impact-based-testing', name: 'Impact-Testset-Test', desc: 'graph_impact(geänderter Knoten) liefert genau die betroffenen TEST-Knoten; nicht betroffene sind nicht im Set.' } },
  { id: 'UC-token-efficiency', name: 'Minimaler Token-Verbrauch',
    desc: 'Als Nutzer/Agent will ich minimalen Token-Verbrauch: präziser Query-Kontext (exakter Blast-Radius/Slice) statt grep-Dump oder Result-Kompression.',
    reqs: [{ id: 'REQ-precise-context', name: 'Präziser Kontext statt grep-Dump', kind: 'non-functional', desc: 'Kontext = exakter Blast-Radius/Sub-Graph-Slice (Format-E) statt grep-Dump/Result-Kompression.' }],
    actors: ['ACTOR-systems-engineer', 'ACTOR-vibe-coder', 'ACTOR-developer', 'ACTOR-claude-code'],
    test: { id: 'TEST-token-efficiency', req: 'REQ-precise-context', name: 'Token-Budget-Test', desc: 'graph_impact-Kontext ist messbar kleiner als ein Volltext-/grep-Dump desselben Scopes (Token-Count-Assertion).' } },
  { id: 'UC-reduced-llm', name: 'Reduzierte LLM-Anforderungen',
    desc: 'Als Nutzer will ich mit kleinen/lokalen LLMs auskommen: deterministische, modellfreie Gates/Regeln + Query-Precision senken den Modell-Bedarf.',
    reqs: [{ id: 'REQ-small-model-viable', name: 'Kleine/lokale LLMs tragfähig', kind: 'non-functional', desc: 'Deterministische, modellfreie Gates/Regeln + Query-Precision halten kleine/lokale LLMs tragfähig; Kern läuft ohne LLM (degraded).' }],
    actors: ['ACTOR-systems-engineer', 'ACTOR-vibe-coder', 'ACTOR-developer', 'ACTOR-claude-code', 'ACTOR-learning-engine'],
    test: { id: 'TEST-reduced-llm', req: 'REQ-small-model-viable', name: 'Modellfrei-Gate-Test', desc: 'Gate/Regel-Evaluation läuft ohne Modell-Call (localReachable=false) deterministisch; nur LLM-Zusatzfeatures degradieren.' } },
];

// ════════════════════════════════ LAYER 2 — OPERATION FUNCTIONS ════════════════════════════════
// uc = customer benefit(s) it satisfies; reqs = specific requirements it implements; mod = allocation.
const OPS = [
  { id: 'FUNC-mutate', name: 'mutate(commands)', mod: 'MOD-harness', uc: ['UC-code-quality'], reqs: ['REQ-one-gate-per-repo', 'REQ-confidence-tier'],
    desc: 'Apply-Gate-Einstieg: wendet Commands in-memory an, orchestriert den 6-Schritt-Ablauf. (SPEC §3)' },
  { id: 'FUNC-evaluate-rules', name: 'evaluateRules()', mod: 'MOD-harness', uc: ['UC-code-quality'], reqs: ['REQ-rule-enforcement'],
    desc: 'Regel-Engine gegen V3_RULES; Violations {ruleId,severity,elementId}; kein lokaler Parser (L2).' },
  { id: 'FUNC-save-graph', name: 'saveGraph(graph)', mod: 'MOD-harness', uc: ['UC-code-quality'], reqs: ['REQ-disk-persistence'],
    desc: 'Persistiert in-memory Graph nach Disk-Kuzu, falls keine error-Violations. (SPEC §3.4, §4)' },
  { id: 'FUNC-emit-trajectory', name: 'emitTrajectory()', mod: 'MOD-hooks', uc: ['UC-reduced-llm'], reqs: ['REQ-trajectory-emit'],
    desc: 'post-apply append-only Trajectory/Outcome nach .aimprove/*.jsonl. (CR-GC-102)' },
  { id: 'FUNC-emit-update-event', name: 'emitUpdateEvent(domains)', mod: 'MOD-hooks', uc: ['UC-code-quality'], reqs: ['REQ-mutation-emits-event', 'REQ-versioned-broadcast'],
    desc: 'Live-Update-Event (SSE invalidate) bei jeder Mutation; Basis des read-only Dashboards. (R9)' },
  { id: 'FUNC-encode', name: 'encode(graph)', mod: 'MOD-codec', uc: ['UC-code-quality', 'UC-token-efficiency'], reqs: ['REQ-deterministic-serialization', 'REQ-formatE-diff-dialect', 'REQ-formatE-parity'],
    desc: 'Deterministische Format-E-Serialisierung (stabile Sortierung), Diff-Dialekt. (CR-GC-103, R3/R5)' },
  { id: 'FUNC-decode', name: 'decode(json)', mod: 'MOD-codec', uc: ['UC-code-quality'], reqs: ['REQ-roundtrip-conformance', 'REQ-codec-validation'],
    desc: 'Format-E → OntologyGraph, Validierung gegen SE_DESCRIPTOR. (CR-GC-103)' },
  { id: 'FUNC-graph-impact', name: 'graph_impact(id, depth?)', mod: 'MOD-mcp-tools', uc: ['UC-token-efficiency', 'UC-reduced-llm', 'UC-efficient-testing'], reqs: ['REQ-query-precision', 'REQ-subgraph-slicing', 'REQ-audit-trail'],
    desc: 'Exakter Blast-Radius (Caller/Traces/Tests) als Format-E. (CR-GC-101, R6/R12)' },
  { id: 'FUNC-graph-expand', name: 'graph_expand(handle, branch, depth+1)', mod: 'MOD-mcp-tools', uc: ['UC-token-efficiency'], reqs: ['REQ-progressive-expansion', 'REQ-cache-layering'],
    desc: 'Progressive On-Demand-Kuzu-Re-Traversierung; kein Originals-Store. (CR-GC-101, R13)' },
  { id: 'FUNC-import', name: 'importGraph(formatE, mode)', mod: 'MOD-harness', uc: ['UC-code-quality'], reqs: ['REQ-bootstrap-through-gate'],
    desc: 'Format-E-Bulk-Import (replace/merge) ausschließlich durchs Gate; Cold-Start aus graphify/Slicer-Output.', mode: 'bootstrap', pre: 'Leerer/zu befüllender Repo-Graph; Format-E-Quelle (graphify/Import) liegt vor.', post: 'Graph durchs Gate befüllt; kein Direct-Write; Violations berichtet.' },
  { id: 'FUNC-merge-nodes', name: 'mergeNodes(graph)', mod: 'MOD-codec', uc: ['UC-code-quality'], reqs: ['REQ-conflict-free-merge', 'REQ-auto-persist-merge'],
    desc: 'Conflict-free Merge via merge_nodes + deterministischer Serialisierung; keine verlorenen Knoten/Traces.', mode: 'merge', pre: 'Zwei (oder mehr) Branch-Versionen des committed Graph-Artefakts.', post: 'Conflict-free gemerged; keine verlorenen Knoten/Traces; deterministisch sortiert.' },
  { id: 'FUNC-migrate-schema', name: 'migrateSchema(from, to)', mod: 'MOD-harness', uc: ['UC-code-quality'], reqs: ['REQ-schema-version-migration'],
    desc: 'Re-Validierung + Migration des Graphen bei ONTOLOGY/RULES_VERSION-Bump; Version am Artefakt mitgeführt.', mode: 'migration', pre: 'Version-Bump in contracts/se; bestehender Graph auf alter Version.', post: 'Graph re-validiert/migriert; Violations berichtet; Artefakt-Version aktualisiert.' },
  { id: 'FUNC-harness-cli', name: 'graphcode init|update|remove', mod: 'MOD-cli', uc: ['UC-code-quality'], reqs: ['REQ-repo-install', 'REQ-repo-update', 'REQ-repo-uninstall', 'REQ-install-idempotent', 'REQ-self-contained-dist', 'REQ-npx-distribution'],
    desc: 'npx-CLI Lifecycle: scaffolds/aktualisiert/entfernt .graphcode/, .claude/hooks, .mcp.json, Controller — idempotent, self-contained.', mode: 'lifecycle', pre: 'Repo vorhanden, npx/Node verfügbar.', post: 'Artefakte installiert/aktualisiert/restlos entfernt; idempotent; Store bei Update erhalten.' },
  { id: 'FUNC-export-markdown', name: 'exportMarkdown(graph, view)', mod: 'MOD-docs', uc: ['UC-code-quality'], reqs: ['REQ-doc-export'],
    desc: 'Rendert Graph (View: spec/architecture/cr-list/references) deterministisch nach Markdown mit GENERATED-Header.', mode: 'export', pre: 'Aktueller Graph (SSOT) geladen; View gewählt.', post: 'Deterministische Markdown-Views mit GENERATED-Header; nie hand-editiert.' },
  { id: 'FUNC-render-views', name: 'render graph→markdown views', mod: 'MOD-skills', uc: ['UC-code-quality'], reqs: ['REQ-doc-export'],
    desc: 'PROMPT-realisierter Graph→Markdown-Renderer via se-view-Skills (.claude/skills/se-view-*); erzeugt z.B. architecture-graph.md. Interim-Realisierung von REQ-doc-export, bis FUNC-export-markdown (code, MOD-docs) gebaut ist. Beweis: Skills = Funktionen (Allokation an MOD-skills = prompt-realisiert).' },
];
// atomic capabilities that carry pre/post directly on the FUNC
const ATOMIC_PREPOST = ['FUNC-import', 'FUNC-merge-nodes', 'FUNC-migrate-schema', 'FUNC-harness-cli', 'FUNC-export-markdown',
  { id: 'FUNC-emit-update-event', pre: 'Mutation committed; SSE/WS-Bridge verbunden.', post: 'Genau ein Live-Update-Event mit korrekten domains; ausschließlich read-only.' },
  { id: 'FUNC-emit-trajectory', pre: 'Mutation erfolgreich applied (post-apply-Phase).', post: 'Trajectory/Outcome append-only nach .aimprove/*.jsonl, Format stabil.' }];

// ════════════════════════════════ LAYER 2b — FCHAINS (behavioral scenarios) ════════════════════
const CHAINS = [
  { id: 'FCHAIN-apply-gate', name: 'Apply-Gate-Ablauf (Governed Mutation)', ownerUC: 'UC-code-quality',
    desc: 'pre-commit → in-memory apply → evaluateRules → saveGraph → post-apply → emit. (SPEC §3, 6 Schritte)',
    steps: ['FUNC-mutate', 'FUNC-evaluate-rules', 'FUNC-save-graph', 'FUNC-emit-trajectory'],
    nfr: ['REQ-responsiveness', 'REQ-mcp-gate-symmetry'],
    pre: 'Harness initialisiert, Graph geladen, gültige MutateCommands liegen vor.',
    post: 'Gültige Ops persistiert oder bei error-Severity geblockt; consumerType geloggt; Live-Event + Trajectory emittiert.' },
  { id: 'FCHAIN-agent-query', name: 'Agent-Graph-Query (Impact + progressive Expansion)', ownerUC: 'UC-token-efficiency',
    desc: 'graph_impact liefert exakten Blast-Radius; graph_expand vertieft on-demand statt zu greppen. (Ziel a, R12/R13)',
    steps: ['FUNC-graph-impact', 'FUNC-graph-expand'],
    nfr: ['REQ-precise-context'],
    pre: 'Graph geladen, MCP-Tools gebunden, elementId existiert.',
    post: 'Exakter Subgraph als Format-E; on-demand vertieft; Graph read-only unverändert.' },
  { id: 'FCHAIN-codec-roundtrip', name: 'Format-E Round-Trip (encode∘decode)', ownerUC: 'UC-code-quality',
    desc: 'encode → decode → Vergleich; deterministisch, validiert; commit-/merge-arm. (SPEC §2.4, L3)',
    steps: ['FUNC-encode', 'FUNC-decode'],
    nfr: ['REQ-roundtrip-conformance'],
    pre: 'Gültiger OntologyGraph (encode) bzw. Format-E-JSON (decode).',
    post: 'decode(encode(g))==g; byte-identisch; ungültige Typen → Validierungsfehler.' },
  { id: 'FCHAIN-capture', name: 'Interaktive Erfassung (Text → suggest-Tier)', ownerUC: 'UC-code-quality',
    desc: 'Agent erzeugt Format-E-Kandidaten (agent-seitig); decode → mutate(suggest-Tier), Review vor Persist. Keine Eigen-Extraktion.',
    steps: ['FUNC-decode', 'FUNC-mutate'],
    nfr: ['REQ-interactive-capture-suggest'],
    pre: 'NL/Text-Eingang (chat-tauglich) + Agent verfügbar.',
    post: 'Format-E-Kandidaten im suggest-Tier durchs Gate; kein auto-apply; Review vor Persist.' },
  { id: 'FCHAIN-impact-testing', name: 'Impact-basierte Testauswahl', ownerUC: 'UC-efficient-testing',
    desc: 'Geändertes Element → graph_impact → exakt betroffene TEST-Knoten → bottom-up ausführen (REQ-Tests → FCHAIN → UC).',
    steps: ['FUNC-graph-impact'], nfr: ['REQ-impact-based-testing'],
    pre: 'Geändertes Element bekannt; Graph geladen.',
    post: 'Genau die betroffenen Tests ausgewählt (bottom-up); nicht betroffene ausgelassen.' },
  { id: 'FCHAIN-modelfree-gate', name: 'Modellfreier Gate-Betrieb', ownerUC: 'UC-reduced-llm',
    desc: 'Gate + Regeln laufen deterministisch ohne Modell-Call (mutate + evaluateRules); kleine/lokale LLMs tragfähig.',
    steps: ['FUNC-mutate', 'FUNC-evaluate-rules'], nfr: ['REQ-small-model-viable', 'REQ-graceful-degradation'],
    pre: 'MutateCommands liegen vor; LLM-Sidecar evtl. nicht erreichbar.',
    post: 'Apply + Regelprüfung deterministisch, kein Modell-Call; nur LLM-Zusatzfeatures degradieren.' },
  { id: 'FCHAIN-interface-escalation', name: 'Interface-Änderungs-Eskalation', ownerUC: 'UC-code-quality',
    desc: 'Agent erkennt nötige Interface-Änderung → Notwendigkeitsprüfung → CR an Facilitating-Agent → graph_impact(FLOW) → Gate-Entscheidung → Dependents re-scopen. Interface = FLOW ist bindend.',
    steps: ['FUNC-graph-impact', 'FUNC-mutate'], nfr: ['REQ-interface-change-escalation'],
    pre: 'Realisierungs-Agent stellt fest: bestehender FLOW-Vertrag reicht nicht.',
    post: 'Interface NICHT direkt mutiert; eskaliert, impact-analysiert, gegatet, Dependents sequenziert — oder verworfen (im Vertrag bleiben).' },
];

// ════════════════════════════════ REQUIREMENTS ════════════════════════════════
// locked constraints + governance (system-level)
req('REQ-single-store', 'Ein Store: Kuzu', 'Genau ein Store = Kuzu (embedded native+WASM, Cypher). Kein Neo4j. (SPEC §0)', ['non-functional']);
req('REQ-single-transport', 'Ein Transport: MCP-stdio', 'Genau ein Transport = MCP-stdio; kein Express-REST/HTTP im Harness-Core. (SPEC §0, §5)', ['non-functional']);
req('REQ-one-gate-per-repo', 'Ein Apply-Gate pro Repo', 'Jede Edit-Op (Mensch oder KI) durch denselben mutate()-Pfad; consumerType nur geloggt. (SPEC §3, L1)', ['functional']);
req('REQ-single-kuzu-owner', 'Single Kuzu-Owner', 'Genau ein Host-Prozess besitzt .graphcode/kuzu (single-writer; kein 2. DB-Handle). (SPEC §4, L1)', ['non-functional']);
req('REQ-disk-persistence', 'Disk-Persistenz', 'Persistenz auf Disk (.graphcode/kuzu/), kein :memory:. (SPEC §4)', ['non-functional']);
req('REQ-import-se-ontology', 'SE-Ontologie importieren', 'SE-Ontologie aus @sigloch/contracts/se importieren, nicht lokal neu definieren. (SPEC §1, Drift D1)', ['non-functional']);
req('REQ-confidence-tier', 'Confidence/Tier am MutateResult', 'MutateResult trägt Confidence/Tier (auto-apply/suggest/block); speist 3-Tier-Gate. (R1)', ['functional']);
req('REQ-auto-persist-merge', 'Auto-Persist + conflict-free Merge', 'Auto-Rebuild/Persist bei Commit + conflict-free Merge-Strategie fürs Graph-Artefakt. (R2)', ['functional']);
req('REQ-deterministic-serialization', 'Deterministische Serialisierung', 'Stabile Sortierung → commit-/merge-arm; zwei Encodes byte-identisch. (R3)', ['non-functional']);
req('REQ-rule-enforcement', 'Regel-Enforcement (V3_RULES)', 'evaluateRules() gegen V3_RULES; error-Severity blockt den Apply. (L2)', ['functional']);
req('REQ-query-precision', 'Query-Precision statt Kompression', 'graph_impact liefert exakten Blast-Radius als Format-E (Anti-grep, Ziel a). (R6/R12)', ['functional']);
req('REQ-subgraph-slicing', 'Sub-Graph-Slicing', 'Sub-Graph-Slicing + pruneToFit(maxTokens) als Context-Primitive. (R7)', ['functional']);
req('REQ-progressive-expansion', 'Progressive Query-Expansion', 'graph_expand vertieft on-demand (Kuzu-Re-Traversierung, kein Originals-Store). (R13)', ['functional']);
req('REQ-cache-layering', 'Prompt-Cache-Layering', 'Nur Onto+Rules stabil cachen, nie mit Live-Graph; Prefix-Hygiene. (R8/R14)', ['non-functional']);
req('REQ-versioned-broadcast', 'Versioned Diff-Broadcast', 'Versioned Diff-Broadcast an Dashboard (read-only, Late-Joiner-Cache). (R9)', ['functional']);
req('REQ-roundtrip-conformance', 'Round-Trip-Conformance', 'decode(encode(g)) == g modulo Whitespace (rasentraktor-Fixture). (L3)', ['non-functional']);
req('REQ-trajectory-emit', 'Trajectory/Outcome-Emission', 'post-apply/nightly: Trajectory/Outcome append-only nach .aimprove/*.jsonl, Format stabil. (CR-GC-102, L1)', ['functional']);
req('REQ-no-extraction', 'Keine Extraktion in graphcode', 'Keine tree-sitter/AST/LLM-Extraktion; Extraktion ist Slicer-/graphify-Aufgabe. (RECOMMENDATIONS)', ['negative']);
req('REQ-readonly-bridge', 'Read-only Bridge', 'Bridge read-only; keine Inbound-Mutations, Writes nur via MCP→mutate(). (RECOMMENDATIONS)', ['negative']);
req('REQ-graph-is-ssot', 'Graph ist Single Point of Truth', 'Der materialisierte Graph + die Live-Harness sind SSOT. docs/*.md sind historischer Input (Bootstrap). Modelländerungen am Graph (mutate/import), dann Re-Export. (2026-06-14)', ['non-functional']);
req('REQ-frame-binding', 'Frame ist bindend für Realisierung', 'Beschluss 2026-06-16: Die in diesem Graph definierte Struktur + Interfaces (6 MOD, 4 Customer-UC, FUNC/FCHAIN/FLOW/REQ + SE-Ontologie/TRACE_PATTERNS) sind BINDEND für die Realisierung. Ergänzungen NUR, wenn sie in die vordefinierten Boxen passen (neue FUNC/FLOW/REQ/TEST an bestehendem MOD/UC durchs Gate). Strukturelle Änderungen — neues sigloch-modules-Shared, neuer ElementType/TraceType, neue Customer-UC/MOD — brauchen Familie-Review.', ['non-functional']);
req('REQ-mutation-emits-event', 'Mutation emittiert Live-Update-Event', 'CONSTRAINT: Jede Graph-Mutation MUSS ein Live-Update-Event emittieren (SSE invalidate, domains graph/rules/readiness/suggestions). Beleg: aimprove import emittiert keins → Dashboard-Lag ~90s. Fix: alle Write-Pfade einheitlich.', ['non-functional']);
req('REQ-doc-export', 'Graph → Markdown Re-Export', 'human-readable Docs (SPEC/Architektur/CR-Liste/References) werden DETERMINISTISCH aus dem Graph generiert (GENERATED-Header), nie hand-editiert. Schließt die graph-is-ssot-Drift-Lücke. (REQ-graph-is-ssot)', ['functional']);
req('REQ-responsiveness', 'Erste Reaktion < 0,2 s', 'Bindende NFR (Familie §6b): erste Reaktion < 0,2s (UI+Transport+Store-Query+Onto-/Rule-Check, ohne LLM). Draft-Apply sofort + nur betroffener Subgraph geprüft; volle Konsistenz am Commit. End-to-end über FCHAIN-apply-gate.', ['non-functional']);
req('REQ-repo-install', 'Ein-Kommando-Installation', 'Installation der Harness in ein beliebiges Repo mit einem Kommando: scaffolds .graphcode/, .claude/hooks, .mcp.json, Controller.', ['functional']);
req('REQ-repo-update', 'Update ohne Datenverlust', 'Update aktualisiert installierte Artefakte/Pfade, ohne den lokalen Graph-Store (.graphcode/) zu verlieren.', ['functional']);
req('REQ-repo-uninstall', 'Restlose Deinstallation', 'Deinstallation entfernt alle installierten Artefakte ohne Residuen.', ['functional']);
req('REQ-install-idempotent', 'Idempotent, keine parallelen Pfade', 'Install/Update idempotent; alte Versionen überschrieben/gelöscht, nicht dupliziert.', ['non-functional']);
req('REQ-self-contained-dist', 'Self-contained Distribution', 'Zielprojekt darf NICHT von einer Kopie des aimprove-Quellbaums abhängen; Distribution self-contained (versionierte Deps). Blockiert auf D5 + CR-GC-100..103.', ['non-functional']);
req('REQ-npx-distribution', 'npx-CLI als Distribution', 'Distribution als npm-Paket mit bin `npx @sigloch/graphcode init|update|remove`. GATED auf REQ-buildable-standalone + CR-GC-100..103.', ['functional']);
req('REQ-buildable-standalone', 'Standalone baufähig (D5)', 'CR-GC-100 Task 0 / SPEC §8 D5 (Blocker): workspace:*-Deps auflösen (versionierte/file-Deps), npm install + tsc --noEmit grün — vor jedem Code.', ['non-functional']);
req('REQ-harness-schema-in-contracts', 'Harness-Schemas in contracts (D1)', 'CR-GC-100 Task 1 / D1: HarnessConfig/MutateCommand/MutateResult nach @sigloch/contracts (eigener harness-Export, NICHT /se), importieren, lokale Defs löschen.', ['non-functional']);
req('REQ-mcp-tool-registry', 'MCP-Tool-Registry an Harness gebunden', 'CR-GC-101: Registry graph_elements/get_node/get_edges (read), graph_mutate (write durchs Gate), rules_evaluate/get_violations, audit_trail/stats — via bindToolsToHarness.', ['functional']);
req('REQ-mcp-gate-symmetry', 'MCP-Gate-Symmetrie (L2)', 'CR-GC-101 L2: MCP graph_mutate == in-process mutate() — identische Semantik, identisches Violations-Dict (end-to-end).', ['non-functional']);
req('REQ-audit-trail', 'Audit-Trail / History', 'CR-GC-101: audit_trail/audit_stats liefern Mutations-History/Statistik.', ['functional']);
req('REQ-hook-extension-points', 'Drei Hook-Extension-Points', 'CR-GC-102: registerHook(type, handler) + runPreCommitHooks/runPostApplyHooks/scheduleNightlyBatch; Storage .graphcode/hooks/.', ['functional']);
req('REQ-precommit-timeout', 'pre-commit blockierbar + Timeout', 'CR-GC-102: pre-commit-Hook kann eine Mutation blocken; preCommitTimeout (default 5000ms).', ['non-functional']);
req('REQ-hook-order-deterministic', 'Deterministische Hook-Reihenfolge (L3)', 'CR-GC-102 L3: Hook-Execution-Order stabil/deterministisch.', ['non-functional']);
req('REQ-versioned-cache', 'Version-keyed Cache + Dirty-Flag (R11)', 'CR-GC-102 R11: version-keyed Response-Cache + Dirty-Flag → auf Kuzu-Version mappen.', ['non-functional']);
req('REQ-formatE-diff-dialect', 'Format-E-Diff-Dialekt (R5)', 'CR-GC-103 R5: Diff-Dialekt +/-/~/M mit <operations><base_snapshot>ID@version + 1:N-Grouping; implicit-add VERWERFEN.', ['functional']);
req('REQ-codec-validation', 'Codec-Validierung gegen SE_DESCRIPTOR', 'CR-GC-103: encode/decode validiert gegen SE_DESCRIPTOR; ungültige Typen → Validierungsfehler, kein silent pass.', ['functional']);
req('REQ-formatE-parity', 'Format-E-Parity = contracts (L1)', 'CR-GC-103 L1: Format-E-Parität = contracts-Baseline; genau EIN Codec.', ['non-functional']);
req('REQ-graceful-degradation', 'Betrieb ohne LLM (Degraded-Modus)', 'CONSTRAINT (ConOps): Harness voll funktionsfähig bei nicht erreichbarem LLM-Sidecar — Gate/Regeln deterministisch, kein Modell-Call.', ['non-functional']);
req('REQ-store-recovery', 'Store-Recovery (Recovery-Modus)', 'CONSTRAINT (ConOps): Recovery bei Kuzu Lock-Konflikt / abgestürztem Owner / korruptem Store — Lock-Erkennung + sicherer Re-Open.', ['non-functional']);
req('REQ-bootstrap-through-gate', 'Erstbefüllung nur durchs Gate', 'FUNC-import: Erstbefüllung ausschließlich über das mutate()-Gate; Quelle = Format-E; kein Direct-Write.', ['functional']);
req('REQ-conflict-free-merge', 'Conflict-free Graph-Merge', 'FUNC-merge-nodes: Branch-/Multi-Dev-Merge conflict-free (deterministische Serialisierung + merge_nodes).', ['functional']);
req('REQ-schema-version-migration', 'Schema-Versions-Migration', 'FUNC-migrate-schema: bei Version-Bump re-validieren/migrieren, Violations berichten, Version mitführen.', ['functional']);
req('REQ-interactive-capture-suggest', 'Interaktive Erfassung im suggest-Tier', 'FCHAIN-capture: NL→Format-E agent-seitig (REQ-no-extraction); Resultat im suggest-Tier durchs Gate, Review vor Persist.', ['functional']);
req('REQ-interface-schema', 'Interface trägt ein Datenformat (SCHEMA)', 'Jeder FLOW (Interface) hat ein SCHEMA (Layer 2, Datenformat) — referenziert @sigloch/contracts Zod. Code-Precondition: ohne Datenvertrag rät der Agent das Format. (3-Schichten-Interface-Modell)', ['non-functional']);
req('REQ-dashboard-ontology-sync', 'Dashboard/Readiness nutzt SE-Ontologie + V3_RULES', 'Das Dashboard/Readiness-Scorer MUSS gegen @sigloch/contracts Ontologie + V3_RULES evaluieren (via harness.evaluateRules, L2) — nicht die aimprove-Vorgänger-Regeln (rules 2.0.0, BQ-06/BQ-02 INCOSE). Heutige 155 BQ-Warnungen messen unsere REQs gegen eine Fremd-Regelbasis; nach Adoption echte Familie-Compliance. (NEXT REQ 2026-06-17)', ['functional']);
req('REQ-benchmark-harness', 'Benchmark-Harness (graphcode vs classic)', 'Setting zum Vergleich graphcode-Modus vs. Claude-Code-classic über eine fixe Task-Suite, 2 LLMs (groß + klein/lokal), mit Token-Counter + Quality-Scorer. Liefert task×mode×LLM → {tokens, success, quality} und belegt token-efficiency + reduced-llm + code-quality. NUR Requirement — Harness-Bau ist Realisierung (eigene CR).', ['functional']);
req('REQ-quality-metric', 'Messbare Code-/Tool-Qualität', 'Qualität = graph-eigene Metriken: (1) 0 error-Violations am Commit, (2) REQ→TEST-Traceability-Coverage, (3) keine Drift bei Re-Eval; gegen classic messbar. Definiert, was „exzellente Code-Qualität" (UC-code-quality) bedeutet — kein Vibe.', ['non-functional']);
req('REQ-interface-change-escalation', 'Interface-Änderung nur per Eskalation', 'Ein Realisierungs-Agent darf ein Interface (FLOW/SCHEMA) NICHT direkt mutieren. Bei Bedarf: (a) Notwendigkeit prüfen (sonst im Vertrag bleiben, Tech-Debt vermeiden); (b) CR an Facilitating-Agent + Boundary pausieren; (c) graph_impact(FLOW) Impact-Analyse; (d) Gate-Entscheidung (versionierte FLOW-Mutation / reject); (e) Dependents re-scopen/sequenzieren. Erhält conflict-free Parallelität; Interface-Drift zentral + gegatet.', ['functional']);

// ── CR (open change requests) ──
const cr = (id, name, mod, why) => { el(id, 'CR', name, why, { status: 'open', attributes: { status: 'open' } }); tr(id, mod, 'relation'); };
cr('CR-GC-100', 'Harness Core', 'MOD-harness', 'Apply-Gate (mutate → V3_RULES → Disk-Kuzu) lauffähig statt Stub; löst D5/D1. Why: jede Edit durch EIN Gate (L1); der Vorgänger (Express+JSON) verletzt Kuzu/Disk/Rules-Constraints. (docs/cr/open/CR-GC-100)');
cr('CR-GC-101', 'MCP-Tools', 'MOD-mcp-tools', 'MCP-stdio-Surface: Agent nutzt Graph statt grep (Ziel a), graph_impact/expand, Gate-Symmetrie (L2). Why: präziser Blast-Radius = Token-/LLM-Effizienz; ohne MCP kein Agent-Zugriff. (docs/cr/open/CR-GC-101)');
cr('CR-GC-102', 'Hook-System', 'MOD-hooks', 'pre-commit/post-apply/nightly Extension-Points; Live-Event + Trajectory-Emission. Why: Kopplung an Dashboard (Ziel b) + Learning-Engine; deterministisch + blockierbar. (docs/cr/open/CR-GC-102)');
cr('CR-GC-103', 'Format-E Codec', 'MOD-codec', 'Deterministischer Format-E-Codec (encode/decode), commit-/merge-arm, Validierung gegen SE_DESCRIPTOR. Why: conflict-free git-Merge + Ontologie-Konformität; genau EIN Codec (L1). (docs/cr/open/CR-GC-103)');
cr('CR-GC-104', 'Skills/Prompts-Modul', 'MOD-skills', 'MOD-skills (.claude/skills/) + prompt-realisierte FUNC-render-views. Why: Skills/Prompts sind reale, zu managende Dateien = Modul; Allokation dorthin = prompt-realisiert (Skills = Funktionen). (docs/cr/open/CR-GC-104)');
cr('CR-GC-105', 'Architektur-Verfeinerung', 'MOD-mcp-tools', 'Kunden-Aktoren (Systems Engineer, Vibe Coder) + Realisierungs-Agent-Reframing; Interface-Eskalations-Prozess (FCHAIN + REQ + Facilitating-Agent); fehlende FCHAINs für efficient-testing + reduced-llm. Why: Mensch=Architektur/Nutzen, Agent=Realisierung; Interface-Drift kontrolliert; jeder UC ein Szenario. (docs/cr/open/CR-GC-105)');
cr('CR-GC-106', 'Interface-Schemas', 'MOD-codec', '9 SCHEMA-Knoten (→ @sigloch/contracts Zod) + FLOW→SCHEMA für alle 28 Interfaces; REQ-interface-schema. Why: Datenvertrag = Code-Precondition (schema-before-code), schließt Readiness-Dimension schema=0. (docs/cr/open/CR-GC-106)');
cr('CR-GC-107', 'Dashboard auf SE-Ontologie', 'MOD-harness', 'Readiness/Scorer nutzt @sigloch/contracts V3_RULES (via harness.evaluateRules) statt Vorgänger-BQ-Regeln (2.0.0). Why: heutige Readiness teils fremd-gemessen (155 BQ-Warnungen); nach Adoption echte Familie-Compliance. NEXT. (docs/cr/open/CR-GC-107)');
cr('CR-GC-108', 'Test-Konzept im Graph + Benchmark-REQ', 'MOD-docs', 'TEST-Metadaten (level/tool/constraint) am Graph → test-concept.md als View rekonstruierbar (se-view-testconcept); REQ-benchmark-harness + REQ-quality-metric (nur definiert, nicht gebaut). Why: Test-Konzept ist eine View, kein Hand-Doc; Benchmark-Bau ist Realisierung. (docs/cr/open/CR-GC-108)');
const crReqs = {
  'CR-GC-100': ['REQ-one-gate-per-repo', 'REQ-rule-enforcement', 'REQ-confidence-tier', 'REQ-single-kuzu-owner', 'REQ-disk-persistence', 'REQ-import-se-ontology', 'REQ-harness-schema-in-contracts', 'REQ-buildable-standalone'],
  'CR-GC-101': ['REQ-single-transport', 'REQ-query-precision', 'REQ-subgraph-slicing', 'REQ-cache-layering', 'REQ-progressive-expansion', 'REQ-mcp-tool-registry', 'REQ-mcp-gate-symmetry', 'REQ-audit-trail'],
  'CR-GC-102': ['REQ-trajectory-emit', 'REQ-auto-persist-merge', 'REQ-hook-extension-points', 'REQ-precommit-timeout', 'REQ-hook-order-deterministic', 'REQ-versioned-cache'],
  'CR-GC-103': ['REQ-deterministic-serialization', 'REQ-roundtrip-conformance', 'REQ-formatE-diff-dialect', 'REQ-codec-validation', 'REQ-formatE-parity'],
  'CR-GC-104': ['REQ-doc-export'],
  'CR-GC-105': ['REQ-interface-change-escalation', 'REQ-impact-based-testing', 'REQ-small-model-viable'],
  'CR-GC-106': ['REQ-interface-schema'],
  'CR-GC-107': ['REQ-dashboard-ontology-sync'],
  'CR-GC-108': ['REQ-benchmark-harness', 'REQ-quality-metric'],
};

// ── TEST (capability acceptance gates) ──
test('TEST-mutate-gate', 'mutate()-Gate Unit-Test', 'mutate() wendet an, gibt Violations zurück, blockt bei error-Severity. (FCHAIN-apply-gate)');
test('TEST-mcp-symmetry', 'MCP-Symmetrie-Test', 'MCP graph_mutate == in-process mutate(): identische Semantik/Violations. (FCHAIN-apply-gate, L2)');
test('TEST-roundtrip', 'Format-E Round-Trip Conformance', 'decode(encode(g))==g; zwei Encodes byte-identisch. (FCHAIN-codec-roundtrip)');
test('TEST-impact-subgraph', 'graph_impact Subgraph-Test', 'graph_impact liefert nur den betroffenen Subgraphen (kein Full-Dump). (FCHAIN-agent-query)');
test('TEST-harness-install', 'Harness-Install Smoke (durchgeführt)', 'Install → Controller → /api/health 200 + Dashboard 200. 2026-06-13 (aimprove-init.sh). NICHT self-contained (AIMPRO_ROOT).', 'demonstration');
test('TEST-live-view', 'Live-Update-Event-Test', 'Jede Mutation emittiert genau ein Live-Update-Event (korrekte domains); Dashboard ohne Reload. (FUNC-emit-update-event)');
test('TEST-learning-emit', 'Learning-Emission-Test', 'post-apply schreibt Trajectory/Outcome append-only, Format stabil. (FUNC-emit-trajectory)');
test('TEST-bootstrap', 'Cold-Start-Import-Test', 'Format-E-Import befüllt leeren Graphen ausschließlich durchs Gate; Direct-Write schlägt fehl. (FUNC-import)');
test('TEST-merge', 'Conflict-free-Merge-Test', 'Zwei Branch-Änderungen mergen conflict-free; keine verlorenen Knoten/Traces. (FUNC-merge-nodes)');
test('TEST-schema-migration', 'Schema-Migrations-Test', 'Version-Bump → Graph re-validiert/migriert, Violations berichtet, Version aktualisiert. (FUNC-migrate-schema)');
test('TEST-capture', 'Interaktive-Erfassung-Test', 'Agent-Kandidaten laufen im suggest-Tier durchs Gate (kein auto-apply). (FCHAIN-capture)');
test('TEST-doc-export', 'Doc-Re-Export-Test', 'exportMarkdown deterministisch (byte-identisch) + spiegelt Graph; GENERATED-Header. (FUNC-export-markdown)');
test('TEST-responsiveness', 'Responsiveness-Test (<0,2s)', 'Draft-Apply + betroffener-Subgraph-Check antwortet < 0,2s (ohne LLM). (FCHAIN-apply-gate NFR)');
test('TEST-interface-escalation', 'Interface-Eskalations-Test', 'Direkter FLOW-Mutationsversuch eines Realisierungs-Agenten wird abgelehnt; nur der Eskalationspfad (CR an Facilitating-Agent → graph_impact → Gate) ändert ein Interface. (FCHAIN-interface-escalation)');
test('TEST-interface-schema', 'Interface-Schema-Test', 'Jeder FLOW hat ein SCHEMA (relation); ein FLOW ohne Datenformat ist ein Readiness-Blocker. (REQ-interface-schema)', 'inspection');
test('TEST-dashboard-ontology-sync', 'Dashboard-Ontologie-Test', 'Readiness/Violations stammen aus @sigloch/contracts V3_RULES (Rule-IDs == contracts), keine Vorgänger-BQ-Regeln; valide Familie-REQs werfen keine BQ-Warnungen. (REQ-dashboard-ontology-sync)', 'analysis');

// ════════════════════════════════ TRACES ════════════════════════════════
// SYS → MOD
['MOD-harness', 'MOD-mcp-tools', 'MOD-hooks', 'MOD-codec', 'MOD-cli', 'MOD-docs', 'MOD-skills'].forEach(m => tr('SYS-graphcode', m, 'compose'));
// SYS → REQ (system-level constraints + governance)
['REQ-single-store', 'REQ-single-transport', 'REQ-single-kuzu-owner', 'REQ-disk-persistence', 'REQ-import-se-ontology', 'REQ-no-extraction', 'REQ-readonly-bridge', 'REQ-graph-is-ssot', 'REQ-frame-binding', 'REQ-graceful-degradation', 'REQ-store-recovery', 'REQ-buildable-standalone', 'REQ-harness-schema-in-contracts', 'REQ-interface-schema']
  .forEach(r => tr('SYS-graphcode', r, 'compose'));
tr('SYS-graphcode', 'REQ-graceful-degradation', 'satisfy');
// MOD → REQ (module-level NFR / infrastructure)
tr('MOD-harness', 'REQ-single-kuzu-owner', 'satisfy');
tr('MOD-harness', 'REQ-single-store', 'satisfy');
tr('MOD-mcp-tools', 'REQ-single-transport', 'satisfy');
tr('MOD-mcp-tools', 'REQ-mcp-tool-registry', 'satisfy');
tr('MOD-hooks', 'REQ-hook-extension-points', 'satisfy');
tr('MOD-hooks', 'REQ-precommit-timeout', 'satisfy');
tr('MOD-hooks', 'REQ-hook-order-deterministic', 'satisfy');
tr('MOD-hooks', 'REQ-versioned-cache', 'satisfy');
// UC → REQ (compose) — interface-escalation is a code-quality requirement
tr('UC-code-quality', 'REQ-interface-change-escalation', 'compose');
// UC → REQ (compose) — dashboard-ontology-sync is a code-quality/governance concern (no UC-live-graph-view; it's FUNC-emit-update-event under code-quality)
tr('UC-code-quality', 'REQ-dashboard-ontology-sync', 'compose');

// LAYER 1 — Customer UCs
for (const u of UCS) {
  el(u.id, 'UC', u.name, u.desc);
  tr('SYS-graphcode', u.id, 'compose');
  for (const r of u.reqs) { reqKind(r.id, r.name, r.desc, r.kind); tr(u.id, r.id, 'compose'); }
  for (const a of u.actors) tr(a, u.id, 'io');
  el(u.test.id, 'TEST', u.test.name, u.test.desc, { method: 'test', status: 'open' });
  tr(u.test.id, u.test.req, 'verify');
}

// LAYER 2 — Operation FUNCs: satisfy UC + REQ, allocate MOD
for (const f of OPS) {
  el(f.id, 'FUNC', f.name, f.desc, f.mode ? { attributes: { operatingMode: f.mode } } : {});
  for (const u of f.uc) tr(f.id, u, 'satisfy');
  for (const r of f.reqs) tr(f.id, r, 'satisfy');
  tr(f.id, f.mod, 'allocate');
}
// pre/post for atomic capabilities (FUNC → satisfy → precondition/postcondition REQ)
for (const a of ATOMIC_PREPOST) {
  const f = typeof a === 'string' ? OPS.find(o => o.id === a) : a;
  const short = f.id.replace('FUNC-', '');
  reqKind(`REQ-pre-${short}`, `Precondition: ${f.name || f.id}`, f.pre, 'precondition');
  reqKind(`REQ-post-${short}`, `Postcondition: ${f.name || f.id}`, f.post, 'postcondition');
  tr(f.id, `REQ-pre-${short}`, 'satisfy');
  tr(f.id, `REQ-post-${short}`, 'satisfy');
}

// LAYER 2b — FCHAINs: UC→compose→FCHAIN, FCHAIN→compose→FUNC, FCHAIN→satisfy→{NFR, pre/post}
for (const c of CHAINS) {
  el(c.id, 'FCHAIN', c.name, c.desc);
  tr(c.ownerUC, c.id, 'compose');
  for (const s of c.steps) tr(c.id, s, 'compose');
  for (const r of c.nfr) tr(c.id, r, 'satisfy');
  const short = c.id.replace('FCHAIN-', '');
  reqKind(`REQ-pre-${short}`, `Precondition: ${c.name}`, c.pre, 'precondition');
  reqKind(`REQ-post-${short}`, `Postcondition: ${c.name}`, c.post, 'postcondition');
  tr(c.id, `REQ-pre-${short}`, 'satisfy');
  tr(c.id, `REQ-post-${short}`, 'satisfy');
}

// ── DATA FLOW (FLOW nodes + io edges): functions chain through FLOW ──
// apply-gate
pipe([{ node: 'ACTOR-claude-code' }, { flow: 'FLOW-mutate-cmd', name: 'Mutate-Command', desc: 'Edit-Op (add/update/delete) vom Agent/Mensch.' },
  { node: 'FUNC-mutate' }, { flow: 'FLOW-draft-graph', name: 'Draft-Graph', desc: 'In-memory applizierter Graph (draft) vor Regelprüfung.' },
  { node: 'FUNC-evaluate-rules' }, { flow: 'FLOW-violations', name: 'Violations', desc: 'Regel-Violations {ruleId,severity,elementId}.' },
  { node: 'FUNC-save-graph' }, { flow: 'FLOW-committed-graph', name: 'Committed-Graph', desc: 'Persistierter Graph + Version-Counter.' },
  { node: 'FUNC-emit-trajectory' }, { flow: 'FLOW-trajectory', name: 'Trajectory/Outcome', desc: 'append-only Lern-Emission.' },
  { node: 'ACTOR-learning-engine' }]);
// fan-out: committed-graph also feeds the live-update emission → dashboard
tr('FLOW-committed-graph', 'FUNC-emit-update-event', 'io');
pipe([{ node: 'FUNC-emit-update-event' }, { flow: 'FLOW-live-event', name: 'Live-Update-Event', desc: 'SSE invalidate (graph/rules/readiness/suggestions).' }, { node: 'ACTOR-dashboard' }]);
// agent-query (impact, then progressive expand)
pipe([{ node: 'ACTOR-claude-code' }, { flow: 'FLOW-query-request', name: 'Query-Request', desc: 'elementId + depth.' },
  { node: 'FUNC-graph-impact' }, { flow: 'FLOW-impact-subgraph', name: 'Impact-Subgraph', desc: 'Exakter Blast-Radius als Format-E + Cursor.' },
  { node: 'ACTOR-claude-code' }]);
pipe([{ node: 'ACTOR-claude-code' }, { flow: 'FLOW-expand-request', name: 'Expand-Request', desc: 'Cursor/handle + branch + depth+1.' },
  { node: 'FUNC-graph-expand' }, { flow: 'FLOW-expanded-subgraph', name: 'Expanded-Subgraph', desc: 'On-demand vertiefter Subgraph.' },
  { node: 'ACTOR-claude-code' }]);
// codec round-trip
pipe([{ node: 'ACTOR-developer' }, { flow: 'FLOW-graph-state', name: 'Graph-State', desc: 'Aktueller OntologyGraph (in-memory).' },
  { node: 'FUNC-encode' }, { flow: 'FLOW-formatE-artifact', name: 'Format-E-Artefakt', desc: 'Deterministisch serialisierter Graph (commit-fähig).' },
  { node: 'FUNC-decode' }, { flow: 'FLOW-parsed-graph', name: 'Parsed-Graph', desc: 'Aus Format-E rekonstruierter Graph (== Original).' },
  { node: 'ACTOR-developer' }]);
// capture (agent-produced candidates → decode → mutate suggest tier)
pipe([{ node: 'ACTOR-claude-code' }, { flow: 'FLOW-formatE-candidates', name: 'Format-E-Kandidaten', desc: 'Agent-interpretierte NL → Format-E (agent-seitig).' },
  { node: 'FUNC-decode' }, { flow: 'FLOW-capture-draft', name: 'Capture-Draft', desc: 'Dekodierter Kandidaten-Graph.' },
  { node: 'FUNC-mutate' }, { flow: 'FLOW-suggest-result', name: 'Suggest-Result', desc: 'Confidence-getaggte Vorschläge (suggest-Tier).' },
  { node: 'ACTOR-developer' }]);
// atomic capability flows
pipe([{ node: 'ACTOR-graphify' }, { flow: 'FLOW-bulk-formatE', name: 'Bulk-Format-E', desc: 'Slicer-Output großer Docs (graphify).' },
  { node: 'FUNC-import' }, { flow: 'FLOW-bootstrap-result', name: 'Bootstrap-Result', desc: 'Befüllter Graph + Violations-Report.' }, { node: 'ACTOR-developer' }]);
pipe([{ node: 'ACTOR-developer' }, { flow: 'FLOW-branch-graphs', name: 'Branch-Graphs', desc: 'Zwei Branch-Versionen des Graph-Artefakts.' },
  { node: 'FUNC-merge-nodes' }, { flow: 'FLOW-merged-graph', name: 'Merged-Graph', desc: 'Conflict-free gemergter Graph.' }, { node: 'ACTOR-developer' }]);
pipe([{ node: 'ACTOR-developer' }, { flow: 'FLOW-version-bump', name: 'Version-Bump', desc: 'Neue ONTOLOGY/RULES_VERSION aus contracts/se.' },
  { node: 'FUNC-migrate-schema' }, { flow: 'FLOW-migrated-graph', name: 'Migrated-Graph', desc: 'Re-validierter/migrierter Graph + Report.' }, { node: 'ACTOR-developer' }]);
pipe([{ node: 'ACTOR-developer' }, { flow: 'FLOW-cli-command', name: 'CLI-Command', desc: 'init | update | remove.' },
  { node: 'FUNC-harness-cli' }, { flow: 'FLOW-install-result', name: 'Install-Result', desc: 'Scaffold-/Update-/Remove-Ergebnis.' }, { node: 'ACTOR-developer' }]);
pipe([{ node: 'ACTOR-developer' }, { flow: 'FLOW-export-request', name: 'Export-Request', desc: 'View-Auswahl (spec/architecture/cr-list/references).' },
  { node: 'FUNC-export-markdown' }, { flow: 'FLOW-markdown-docs', name: 'Markdown-Docs', desc: 'Generierte Markdown-Views (GENERATED-Header).' }, { node: 'ACTOR-developer' }]);
pipe([{ node: 'ACTOR-developer' }, { flow: 'FLOW-view-request', name: 'View-Request', desc: 'Welche View gerendert werden soll (arch/status/...).' },
  { node: 'FUNC-render-views' }, { flow: 'FLOW-rendered-view', name: 'Rendered-View', desc: 'Generierte Markdown-View, z.B. architecture-graph.md.' }, { node: 'ACTOR-developer' }]);

// ── FLOW → SCHEMA (relation): jedes Interface trägt ein Datenformat (PDR Layer 2) ──
const flowSchema = {
  'FLOW-mutate-cmd': 'SCHEMA-mutate-command',
  'FLOW-violations': 'SCHEMA-mutate-result', 'FLOW-suggest-result': 'SCHEMA-mutate-result', 'FLOW-bootstrap-result': 'SCHEMA-mutate-result',
  'FLOW-draft-graph': 'SCHEMA-ontology-graph', 'FLOW-committed-graph': 'SCHEMA-ontology-graph', 'FLOW-parsed-graph': 'SCHEMA-ontology-graph', 'FLOW-graph-state': 'SCHEMA-ontology-graph', 'FLOW-migrated-graph': 'SCHEMA-ontology-graph', 'FLOW-merged-graph': 'SCHEMA-ontology-graph', 'FLOW-capture-draft': 'SCHEMA-ontology-graph', 'FLOW-branch-graphs': 'SCHEMA-ontology-graph',
  'FLOW-formatE-artifact': 'SCHEMA-format-e', 'FLOW-formatE-candidates': 'SCHEMA-format-e', 'FLOW-bulk-formatE': 'SCHEMA-format-e', 'FLOW-impact-subgraph': 'SCHEMA-format-e', 'FLOW-expanded-subgraph': 'SCHEMA-format-e',
  'FLOW-trajectory': 'SCHEMA-trajectory',
  'FLOW-live-event': 'SCHEMA-update-event',
  'FLOW-query-request': 'SCHEMA-query-params', 'FLOW-expand-request': 'SCHEMA-query-params', 'FLOW-export-request': 'SCHEMA-query-params', 'FLOW-view-request': 'SCHEMA-query-params', 'FLOW-version-bump': 'SCHEMA-query-params',
  'FLOW-cli-command': 'SCHEMA-cli-command', 'FLOW-install-result': 'SCHEMA-cli-command',
  'FLOW-markdown-docs': 'SCHEMA-markdown-view', 'FLOW-rendered-view': 'SCHEMA-markdown-view',
};
for (const [f, s] of Object.entries(flowSchema)) tr(f, s, 'relation');

// ── Test-Konzept im Graph: TEST-Metadaten (level/tool/constraint) → als View rekonstruierbar ──
const testMeta = {
  'TEST-code-quality': { level: 'acceptance', tool: 'harness + benchmark', constraint: 'Disk-Kuzu, V3_RULES; vs classic' },
  'TEST-efficient-testing': { level: 'acceptance', tool: 'graph_impact assertion', constraint: 'precision/recall vs full run' },
  'TEST-token-efficiency': { level: 'acceptance', tool: 'benchmark + token counter', constraint: 'graphcode vs classic; <50% tokens' },
  'TEST-reduced-llm': { level: 'acceptance', tool: 'benchmark, 2 LLMs', constraint: 'small/local LLM succeeds' },
  'TEST-mutate-gate': { level: 'integration', tool: 'vitest', constraint: 'Disk-Kuzu' },
  'TEST-mcp-symmetry': { level: 'integration', tool: 'vitest', constraint: 'MCP==in-process' },
  'TEST-roundtrip': { level: 'conformance', tool: 'vitest', constraint: 'rasentraktor fixture (L3)' },
  'TEST-impact-subgraph': { level: 'integration', tool: 'vitest', constraint: 'no full-dump' },
  'TEST-harness-install': { level: 'smoke', tool: 'bash', constraint: 'health 200' },
  'TEST-live-view': { level: 'integration', tool: 'vitest', constraint: 'one event per mutation' },
  'TEST-learning-emit': { level: 'integration', tool: 'vitest', constraint: 'append-only jsonl' },
  'TEST-bootstrap': { level: 'integration', tool: 'vitest', constraint: 'gate-only import' },
  'TEST-merge': { level: 'integration', tool: 'vitest', constraint: 'conflict-free' },
  'TEST-schema-migration': { level: 'integration', tool: 'vitest', constraint: 'version bump' },
  'TEST-capture': { level: 'integration', tool: 'vitest', constraint: 'suggest-tier' },
  'TEST-doc-export': { level: 'conformance', tool: 'vitest', constraint: 'deterministic + GENERATED header' },
  'TEST-responsiveness': { level: 'performance', tool: 'benchmark', constraint: '<0,2s, no LLM' },
  'TEST-interface-escalation': { level: 'integration', tool: 'vitest', constraint: 'direct FLOW mutation rejected' },
  'TEST-interface-schema': { level: 'inspection', tool: 'jq/grep', constraint: 'every FLOW relation SCHEMA' },
  'TEST-dashboard-ontology-sync': { level: 'analysis', tool: 'rule-id compare', constraint: 'rule-ids == contracts' },
};
for (const e of E) if (e.type === 'TEST' && testMeta[e.id]) e.attributes = { ...(e.attributes || {}), ...testMeta[e.id] };
// benchmark + quality-metric: composed by their UC, verified by the matching acceptance test
tr('UC-token-efficiency', 'REQ-benchmark-harness', 'compose');
tr('UC-code-quality', 'REQ-quality-metric', 'compose');
tr('TEST-token-efficiency', 'REQ-benchmark-harness', 'verify');
tr('TEST-code-quality', 'REQ-quality-metric', 'verify');

// ── MS wiring: M1 composes the spec UCs; M2 depends on M1; CRs assigned to milestones ──
['UC-code-quality', 'UC-efficient-testing', 'UC-token-efficiency', 'UC-reduced-llm'].forEach(u => tr('MS-1-specification', u, 'compose'));
tr('MS-2-coding-vv', 'MS-1-specification', 'relation'); // depends-on
const crMs = {
  'CR-GC-104': 'MS-1-specification', 'CR-GC-105': 'MS-1-specification', 'CR-GC-106': 'MS-1-specification', 'CR-GC-108': 'MS-1-specification',
  'CR-GC-100': 'MS-2-coding-vv', 'CR-GC-101': 'MS-2-coding-vv', 'CR-GC-102': 'MS-2-coding-vv', 'CR-GC-103': 'MS-2-coding-vv', 'CR-GC-107': 'MS-2-coding-vv',
};
for (const [c, m] of Object.entries(crMs)) tr(c, m, 'relation');

// TEST → REQ (verify)
const testReqs = {
  'TEST-mutate-gate': ['REQ-one-gate-per-repo', 'REQ-rule-enforcement'], 'TEST-mcp-symmetry': ['REQ-mcp-gate-symmetry', 'REQ-one-gate-per-repo'],
  'TEST-roundtrip': ['REQ-roundtrip-conformance', 'REQ-deterministic-serialization'], 'TEST-impact-subgraph': ['REQ-query-precision'],
  'TEST-harness-install': ['REQ-repo-install'], 'TEST-live-view': ['REQ-mutation-emits-event', 'REQ-versioned-broadcast'],
  'TEST-learning-emit': ['REQ-trajectory-emit'], 'TEST-bootstrap': ['REQ-bootstrap-through-gate'], 'TEST-merge': ['REQ-conflict-free-merge'],
  'TEST-schema-migration': ['REQ-schema-version-migration'], 'TEST-capture': ['REQ-interactive-capture-suggest'],
  'TEST-doc-export': ['REQ-doc-export'], 'TEST-responsiveness': ['REQ-responsiveness'],
  'TEST-interface-escalation': ['REQ-interface-change-escalation'],
  'TEST-interface-schema': ['REQ-interface-schema'],
  'TEST-dashboard-ontology-sync': ['REQ-dashboard-ontology-sync'],
};
for (const [t, reqs] of Object.entries(testReqs)) for (const r of reqs) tr(t, r, 'verify');
// CR → REQ (relation)
for (const [crId, reqs] of Object.entries(crReqs)) for (const r of reqs) tr(crId, r, 'relation');

// ── Materialize SSOT artifact + load into harness ──
const graph = { elements: E, traces: T };
const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outDir = join(repoRoot, 'docs', 'graph');
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, 'graphcode.graph.json');
writeFileSync(outFile, JSON.stringify(graph, null, 2) + '\n');
console.log(`wrote SSOT artifact → ${outFile} (${E.length} elements, ${T.length} traces)`);

const res = await fetch(`${API}/api/graph/import`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ ...graph, mode: 'replace' }),
});
console.log(`import → HTTP ${res.status}:`, JSON.stringify(await res.json()));
