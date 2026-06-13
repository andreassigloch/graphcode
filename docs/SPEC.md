# GraphCode — Implementation Spec (Initial, v0.1)

**Stand:** 2026-06-12 · **Status:** Carve-Out, vor §6-Checkpoint (CRs gated)
**Funktionen:** F10 Gate · F11 SSOT · F12 Local Agents · F13 Code-Kopplung · MCP-Tools · Hooks

## 0. Geltung & Grenze

Dies ist die **implementierungs-spezifische** Spec von GraphCode. Die **Schnittstellen-Verträge
zwischen Apps sind SSOT in bok** und werden hier nur **verlinkt, nicht kopiert**
(Modell: `bok/docs/governance/REPO-BOUNDARY.md`). Diese Datei beschreibt das *Wie* innerhalb
von graphcode; das *Was* der Verträge bleibt bok.

**Verriegelte Entscheidungen, die graphcode binden** (`bok/.../2yR-SSOT-stand-und-ziel.md`):
ein Store = **Kuzu** (embedded native+WASM, Cypher) · ein Transport = **MCP-stdio** (kein
Express-REST, kein curl-Hook) · TypeScript · Zod · OpenCode-Sidecar (BYOK) · ein Apply-Gate pro
Repo · SE-Ontologie aus `@sigloch/contracts/se`. Öffnen nur mit Messung/Spike.

## 1. Inter-App-Verträge — SSOT in bok (nur Links)

| Vertrag | Kanonische Quelle |
|---|---|
| HarnessConfig, MutateCommand/Result, HookType/HookResult, MCPToolRegistry (Zod) | `bok/docs/governance/graphcode-governance.md` §2 |
| Consumer-Matrix (aimprove/graphify/graph-view-edit/learning-engine) | `bok/docs/governance/graphcode-governance.md` §4 + `USAGE-MATRIX.md` |
| Drift-Locks L1–L4 (GraphCode-Enforcement) | `graphcode-governance.md` §3 + `aise-family/DRIFT-LOCKS.md` |
| SE-Ontologie: ElementType(13)/TraceType(7)/TRACE_PATTERNS/V3_RULES(17) | `@sigloch/contracts/se` |
| StorageAdapter · SE_DESCRIPTOR · FormatECodec-Baseline | `@sigloch/graph-api-core` |
| Store-Entscheidung (Kuzu ersetzt Neo4j+APOC) | `bok/.../2yR-35-store-spec.md` |
| Format-E-Codec-Baseline (+ `merge_nodes` Pflicht) | `bok/.../2yR-36-codec-spec.md` |
| Governance-Gate (3-Tier, autorenunabhängig) | `unified-model-interface` §4 |

**Regel:** graphcode **importiert** diese Typen, definiert sie nicht neu. → siehe §8 Drift D1.

## 2. Implementierungs-Architektur (graphcode-spezifisch)

Vier Module in `src/` (Skelette vorhanden, Logik im Carve-Out). Verantwortungen *intern*:

### 2.1 `harness.ts` — `GraphCodeHarness`
- `constructor(config: HarnessConfig, storage: StorageAdapter)` — repo-zentrisch, eine Instanz/Repo.
- `loadGraph()` / `saveGraph(graph)` — In-Memory-Cache über `storage` (Kuzu).
- `mutate(commands)` — **der Apply-Gate** (§3). Aktuell Stub → CR-GC-100.
- `evaluateRules()` — Regel-Engine gegen `V3_RULES` (kein lokaler Parser, L2). Stub → CR-GC-100.
- `close()` — `storage.close()`.

### 2.2 `mcp-tools.ts` — MCP-Registry + Binding
- Registry: `graph_elements/get_node/get_edges` (read), `graph_mutate` (write, durchs Gate),
  `rules_evaluate/get_violations`, `audit_trail/stats`.
- `bindToolsToHarness(harness)` — jedes Tool ruft `harness.mutate/loadGraph/evaluateRules`.
  Transport **MCP-stdio** (Claude-Code-native). Stub → CR-GC-101.

### 2.3 `hooks.ts` — `HookSystem`
- `registerHook(type, handler)` + `runPreCommitHooks/runPostApplyHooks/scheduleNightlyBatch`.
- Typen: `pre-commit` (Validierung vor Write), `post-apply` (Emission/Cleanup),
  `nightly-batch` (Aggregation/Learning-Trigger). Storage `.graphcode/hooks/`, `preCommitTimeout`.
  → CR-GC-102.

### 2.4 `codec.ts` — `GraphCodeCodec`
- `encode/decode` Format-E ↔ `OntologyGraph`, Validierung gegen SE-Ontologie.
- **Deterministische Serialisierung** (stabile Sortierung) → commit-/merge-arm (R3). → CR-GC-103.

## 3. Mutate-Gate (Apply-Pfad) — Kernablauf

Ein Gate pro Repo (L1). Jede Edit-Op (Mensch *oder* KI) durch denselben Pfad; Aufrufer wird nur
als `consumerType` geloggt, nie zum Überspringen genutzt.

```
mutate(commands):
  1. runPreCommitHooks(commands)              # hooks.ts, Timeout
  2. apply commands → in-memory OntologyGraph # add/update/delete node|edge
  3. evaluateRules() gegen V3_RULES (L2)      # violations[{ruleId,severity,elementId,msg}]
  4. if keine error-violations: storage.saveGraph()  # Kuzu persist
  5. runPostApplyHooks(result)                # emit Trajectory/Outcome → learning-engine
  6. return MutateResult{success, applied, mutations, violations?, trajectoryId?}
```

**3-Tier (F10, `unified-model-interface` §4):** auto-apply / suggest / block — gesteuert über
Confidence/Severity. Confidence-Metadaten am Result (R1) speisen die Tier-Entscheidung.

## 4. Lokale Persistenz (impl) — Single Kuzu-Owner

- `.graphcode/kuzu/` — Kuzu-DB, per-Repo, persistent (kein `:memory:`), **gitignored** (Artefakt).
- `.graphcode/hooks/` — Hook-Handler/State.
- **Single Kuzu-Owner per Repo (L1-Verstärkung):** Kuzu ist single-writer **ohne** Multi-Prozess-
  Safety (lock-file-Konflikt sobald ein 2. Prozess dasselbe DB-Verzeichnis öffnet). **Genau ein
  Host-Prozess** besitzt `.graphcode/kuzu`; alle anderen Consumer (Agent, Dashboard) erreichen den
  Graphen **über den Host**, nie mit einem zweiten DB-Handle. Reads/Writes *innerhalb* des
  Owner-Prozesses sind multi-thread-safe.
- Graph-Artefakt commit-fähig halten via deterministischem Codec (§2.4) + conflict-free
  Merge-Strategie (R2).

## 5. Transport & Topologie (impl) — Host + zwei Client-Kanäle

graphcode ist **headless** und wird in einen **Host-Prozess eingebettet** (aimprove-Dashboard,
CLI-Sidecar oder P2 Tauri). Der Host ist der **Single Kuzu-Owner** (§4) und exponiert zwei
Client-Kanäle — beide Schreibpfade laufen durch **dasselbe `mutate()`-Gate**:

| Kanal | Consumer | Ziel | Lock |
|---|---|---|---|
| **MCP-stdio** | Claude Code (LLM-Agent) | Agent nutzt Graph statt grep (Ziel a) | MCP-stdio (verriegelt) |
| **SSE/WS-Bridge** | Browser-Dashboard | Live Q-Status-Viz, gleiche DB online (Ziel b) | SSE/WS Bridge↔Viewer (verriegelt) |

**Kein Express-REST/HTTP im Harness-Core.** HTTP/SSE-WS ist Sache des **Host/Bridge**, nicht des
Harness — Lock **bestätigt** (nicht geöffnet). Das Live-Dashboard ist Kuzu-safe, weil es **über
den Host** liest (single-process multi-thread reads während writes), nicht via zweitem DB-Handle.
P3 (VPS): Dashboard = Remote-Client der Bridge — die Single-Owner-Regel bleibt.

## 6. Test-Strategie (impl, = governance §6 Checkpoint)

- **Unit:** `mutate()`-Gate (Apply + Rule-Eval + Violations), `evaluateRules()`.
- **Integration:** MCP-Tools gegen lokalen Kuzu (Tool-invoke → harness).
- **Conformance:** Format-E Round-Trip `encode∘decode == identity` (rasentraktor-Fixture, L3).
- **E2E:** Claude-Code-CLI MCP-Integration (nach aimprove-Import).

## 7. Build/Run (impl)

`package.json` + `tsconfig.json` vorhanden. Abhängigkeiten: `@sigloch/graph-api-core`,
`@sigloch/contracts`, `zod`, Kuzu-Binding. Scripts (`build`/`test`/`typecheck`) im Carve-Out
zu konkretisieren (CR-GC-100).

## 8. Offene Punkte & Drift

| # | Punkt | Aktion |
|---|---|---|
| **D1** *(entschieden, deferred)* | `harness.ts` definiert `HarnessConfig`/`MutateCommand`/`MutateResult` **lokal** — parallel zur SSOT | **Entschieden:** nach `@sigloch/contracts` verschieben (eigener `harness`-Export, **nicht** `/se`-Ontologie) + importieren, lokale Defs löschen. **Blockiert auf D5** → erste Aufgabe in CR-GC-100 |
| **D2** *(gelöst)* | Transport: REST vs. MCP-Lock | **Gelöst:** Harness headless (MCP-stdio + in-process); HTTP/SSE-WS via Host/Bridge (§5). Lock **bestätigt**; governance §4/CR-195c umgeschrieben |
| **D3** | `mutate()`/`evaluateRules()`/`bindToolsToHarness()` sind Stubs | Carve-Out aus aimprove → CR-GC-100/101 |
| **D4** *(done)* | §6-Checkpoint | **Abgezeichnet 2026-06-13**; CR-GC-100→103 offen in `docs/cr/open/` |
| **D5** *(blocker)* | graphcode `workspace:*`-Deps unauflösbar — Standalone-Repo, kein sigloch-modules-Package; kein `node_modules`, `tsc` nicht lauffähig | Build-Setup entscheiden (Monorepo-Package vs. versionierte/file-Deps) + `npm install` + `tsc` grün **vor** Code — CR-GC-100 Task 0 |
| **R1–R11** | Empfehlungen aus graphify + graphengine | `docs/RECOMMENDATIONS.md` → CR-GC-100/101/102/103 + CR-195c |

---

## 9. graphengine-Effizienz-Erbe (Prompt-Reduktion + Streaming)

**Kein Widerspruch zur Architektur — komplementär** (Analyse:
`bok/docs/research/graphengine-efficiency.md`, code-belegt). graphengine liefert das *Effizienz*-
Substrat, graphcode die *Governance*; sie treffen sich an Format-E (bereits verriegelt).

**Erben (R5–R11):** Format-E-**Diff**-Dialekt (R5) · `graph_query` Anti-grep-Tool = **Ziel a** (R6) ·
Sub-Graph-**Slicing** als Context-Primitive — und *verdrahten*, was graphengine versäumte (R7) ·
Prompt-Cache **nur** Onto+Rules, nicht den Live-Graph (R8) · versioned Diff-**Broadcast** = **Ziel b** (R9) ·
**Stream-Gate** `<operations>` (Prosa live, Diff atomar, R10) · version-keyed Response-Cache (R11).

**Legacy/Out — Widersprüche, aufgelöst per „Muster behalten, Impl verwerfen":** Neo4j→Kuzu ·
Canvas/Terminal-UI→headless · WS-Write-Hub→read-only Bridge · In-Memory-Map-SSOT→Kuzu *ist* der
Store · all-ephemeral-Cache→Layering. Reflexion/Skill-Library/Embeddings = out-of-scope Prio 1a.

**Korrektur:** Die „74% Token-Reduktion" ist in graphengine **unbelegt** (nur Doc-Strings, nie
gemessen) — nicht als belegte Zahl zitieren; bei Bedarf real auf Kuzu-Graph messen.

**Local-LLM-Pfad (H3):** Für ein kleines Context-Fenster zusätzlich **R12–R14** (aus
`headroom-ai`-Analyse, `bok/docs/research/headroom-ai-evaluation.md`): Subset-Scoring übergroßer
`graph_query`-Ergebnisse + reversibles Retrieve (Originale in Kuzu) + Cache-Prefix-Alignment —
alle **deterministisch, kein Modell-Call**. `headroom-ai` selbst **nicht** als Dependency (Python-
Proxy + SQLite widersprechen headless-TS/ein-Kuzu); nur die Muster nachbauen. Erwartung auf dichten
Graph-Daten ~20–35%, nicht 60–95%.

---
**Verwandt:** `README.md` (Carve-Out-Strategie) · `docs/RECOMMENDATIONS.md` · bok SSOT (§1).
**Abgrenzung & Modul-Sharing:** bok `konzept/aise-family-architecture.md` §5c (graphcode vs.
aise-Nachfolger) + `konzept/shared-vs-specific-modules.md` (A4-Diagramm: shared/specific + Self-Learning).
ARCHITECTURE/MCP-TOOLS/HOOKS/INTEGRATION (README-Struktur) werden bei Reife aus §2 ausgegliedert.
