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

## 4. Lokale Persistenz (impl)

- `.graphcode/kuzu/` — Kuzu-DB, per-Repo, persistent (kein `:memory:`), **gitignored** (Artefakt).
- `.graphcode/hooks/` — Hook-Handler/State.
- Graph-Artefakt commit-fähig halten via deterministischem Codec (§2.4) + conflict-free
  Merge-Strategie (R2).

## 5. Transport (impl)

**Nur MCP-stdio** (verriegelt). Kein Express-REST im Core. SSE/WS nur als Bridge↔Viewer (außerhalb
graphcode-core). → Konflikt mit governance §4 „REST (P2)" / CR-195c, siehe §8 Drift D2.

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
| **D1** | `harness.ts` definiert `HarnessConfigSchema`/`MutateCommandSchema`/`MutateResultSchema` **lokal neu** — parallel zur SSOT in contracts/graph-api-core | Aus `@sigloch/contracts/se` importieren, lokale Defs löschen (keine parallelen Pfade) — CR-GC-100 |
| **D2** | Transport-Konflikt: SSOT verriegelt **MCP-stdio only**, governance §4/CR-195c nennen REST/ExpressTransport | Governance-Review: REST streichen oder Lock mit Spike öffnen (bok-Entscheidung) |
| **D3** | `mutate()`/`evaluateRules()`/`bindToolsToHarness()` sind Stubs | Carve-Out aus aimprove → CR-GC-100/101 |
| **D4** | §6-Checkpoint unsigned → CR-GC-100→103 gated | Governance-Guardian zeichnet ab, dann CRs in `docs/cr/open/` |
| **R1–R4** | Empfehlungen aus graphify-Vergleich | `docs/RECOMMENDATIONS.md` → falten in CR-GC-100/102/103 |

---
**Verwandt:** `README.md` (Carve-Out-Strategie) · `docs/RECOMMENDATIONS.md` · bok SSOT (§1).
ARCHITECTURE/MCP-TOOLS/HOOKS/INTEGRATION (README-Struktur) werden bei Reife aus §2 ausgegliedert.
