# GraphCode — Empfehlungen (graphify- + graphengine-Vergleiche)

**Stand:** 2026-06-13
**Volle Analysen (SSOT):** `bok/docs/research/graphify-comparison.md` (R1–R4) ·
`bok/docs/research/graphengine-efficiency.md` (R5–R11)
**Scope dieser Datei:** nur die **graphcode-relevanten** Handlungspunkte. Extraktions-/Slicer-
Themen (tree-sitter, Leiden, Inline-Comments, Namenskollision) gehören zu graphify (Prio 2),
nicht hierher.

## Kernaussage

graphcode konkurriert **nicht** mit graphify: graphify = read/extract, graphcode = governter
write-gate + store. graphifys bewusste Lücke (kein Regel-Enforcement, kein getyptes Apply-Gate)
ist genau unser **Moat**. → Fokus halten: **Store + Gate + Hooks + Learning-Emission**, keine
Extraktion in graphcode bauen (die kommt vom Slicer/aimprove).

## Konkrete To-Dos (in graphcode umzusetzen)

| # | Empfehlung | Bezug | Wohin im Code |
|---|---|---|---|
| R1 | **Confidence-Metadaten am Mutate-Result/Violation** (analog EXTRACTED/INFERRED/AMBIGUOUS) — speist den 3-Tier-Apply-Gate (auto-apply / suggest / block) | graphify Confidence-Tags | `harness.ts` MutateResult, `MutateResultSchema` (§2.2) |
| R2 | **Auto-Rebuild/-Persist bei Commit + conflict-free Merge-Strategie** für das Graph-Artefakt | graphify Auto-Rebuild + Merge-Driver | `hooks.ts` post-apply + nightly; `.graphcode/` Artefakt |
| R3 | **Graph-Artefakt commit-fähig & merge-arm halten** (deterministische Serialisierung via codec) | graphify graph.json + Merge-Driver | `codec.ts` (Format-E, stabile Sortierung) |
| R4 | **Differenzierung explizit dokumentieren** in Architektur-Docs: governter Write-Gate als Alleinstellung | graphify hat keinen Write-Gate | `docs/ARCHITECTURE.md` (TBD) |

## Aus graphengine-Vergleich (R5–R11) — Effizienz: Prompt-Reduktion + Streaming

graphengine ist **komplementär**, kein Widerspruch: es liefert das Effizienz-Substrat, graphcode
die Governance. Layer-Tags: **[codec]** contracts · **[MCP]** Tool-Responses · **[Bridge]** SSE/WS-
Dashboard · **[hook]** mutate-Gate.

| # | Empfehlung | Quelle (file:line) | Wohin |
|---|---|---|---|
| R5 | **[codec]** Format-E-**Diff-Dialekt** (`+/-/~/M`, `<operations><base_snapshot>ID@version`) + 1:N-Edge-Grouping übernehmen — **aber** „implicit-add"-Toleranz **verwerfen** (Gate muss laut scheitern). `base_snapshot@version` → Kuzu single-writer Version-Counter | `format-e-parser.ts:194-390,323-335` | CR-GC-103 + contracts |
| R6 | **[MCP]** `graph_query`-Tool (`edges\|nodes\|check_edge\|io_chain`) als kanonische **Anti-grep-Oberfläche** (= Ziel a); strukturierte Issue-Returns (`io_chain` erkennt bidir/zyklisch/dup); Antwort als **Format-E** (nicht JSON) | `agentdb-query-tool.ts:84-141` | CR-GC-101 |
| R7 | **[MCP]** `ContextManager`-Sub-Graph-Slicing + `pruneToFit(maxTokens)` als Context-Primitive — **und tatsächlich verdrahten** (graphengine tat es nicht); in graphcode *ist* die Tool-Response der Context | `context-manager.ts:61-108,359-408` | CR-GC-101 |
| R8 | **[cache]** Prompt-Cache-**Layering**: nur Ontologie+`V3_RULES` stabil cachen, **nie** mit Live-Graph zusammen (graphengines Bug); Graph als frische Tool-Result-Slices | `prompt-builder.ts:77-101` (Bug A4) | CR-GC-101 |
| R9 | **[Bridge]** Versioned Diff-**Broadcast** `{type,diff,graphVersion,workspace:system}` + 1-Entry-Cache für Late-Joiner (= Ziel b, read-only) | `websocket-server.ts:16-27,174-235` | CR-195c (Host/Bridge) |
| R10 | **[Bridge]** **Stream-Gate**: `<operations>`-Tiefe tracken → Prosa live streamen, Maschinen-Diff bis vollständig zurückhalten, dann atomar applizieren | `llm-engine.ts:322-330,183-199` | CR-195c |
| R11 | **[hook]** Version-keyed Response-Cache + Dirty-Flag → auf Kuzu-Version mappen (Invalidierung + inkrementeller Persist) | `llm-engine.ts:78-115`, `neo4j-sync.ts:123-131` | CR-GC-102 |

**Wichtig:** Die „**74% Token-Reduktion**" ist in graphengine **nirgends gemessen** (nur Doc-Strings) —
nicht als belegte Zahl verwenden; bei Bedarf real auf Kuzu-Graph messen.

## Nicht tun (Scope-Abgrenzung)

- ❌ **Keine** tree-sitter/AST-Extraktion in graphcode — das ist Slicer-Aufgabe (graphify Prio 2).
- ❌ **Keine** LLM-Semantik-Extraktion, keine Community-Detection (Leiden) hier.
- ❌ Multi-Assistant Skill-Installer = Distributions-/Familien-Thema, nicht graphcode-Core.
- ❌ **Kein** Neo4j (`neo4j-driver`/`neo4j-sync`) — Kuzu ist verriegelt; nur das Dirty-Flag-Persist-*Muster* erben.
- ❌ **Kein** Canvas/Terminal-UI (`src/canvas`, `src/terminal-ui`, `ink`/`react`) — graphcode ist headless.
- ❌ **Kein** WS-Write-Hub — Bridge ist read-only; Inbound-Mutations deaktivieren, Writes nur via MCP→`mutate()`.
- ❌ **Kein** In-Memory-Map-SSOT / `agentdb`-Pkg / Reflexion / Skill-Library / Embeddings — Kuzu *ist* der Store; Rest out-of-scope Prio 1a.

## Verriegelung

Diese Empfehlungen ändern **nicht** die verriegelten Entscheidungen (Kuzu-Store, MCP-stdio,
ein Apply-Gate, SE-Ontologie aus contracts/se). R1–R3 → CR-GC-100/102/103; R5–R8/R11 → CR-GC-101/102/103;
R9/R10 → CR-195c (Host/Bridge). Alle erst **nach** §6-Checkpoint (abgezeichnet 2026-06-13).
