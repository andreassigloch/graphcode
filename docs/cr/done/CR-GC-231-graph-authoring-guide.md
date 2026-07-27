# CR-GC-231: `graph_authoring_guide` — Meta-Modell-Kanten-Guidance für graph-natives Autoren

**Status:** Open (2026-06-27, renumbered from CR-GC-217 to clear a number collision with the shipped `CR-GC-217-graph-state-time-travel`) · **Milestone:** `MS-5-efficiency` · **Max Files:** 3
**Graph (SSOT):** zu seeden (gate-only) `REQ-authoring-guide`, `FUNC-graph-authoring-guide` (→ `src/mcp-tools.ts`), `TEST-graph-authoring-guide` (→ `tests/mcp.context.test.ts`), `CR-GC-231`; unter `MS-5-efficiency`.

## Problem (Why)

`SPIKE-GC-loop-executor-benchmark` (Spec-Teil, 2026-06-27): opencode@local (qwen3.6-27b) autoriert Spec-**Inkremente** korrekt über das Gate (UC + 2 REQs + TEST + 4 Kanten, 0 Rejections) — **aber nur, wenn die Kanten-Typen + Richtungen im Prompt ausbuchstabiert** waren (SYS→UC `compose`, TEST→REQ `verify`, …). Ohne Vorgabe müsste das kleine Modell die SE-Ontologie raten — *welche* Kante zwischen *welchen* Typen legal ist — und das ist fehleranfällig (dasselbe Muster wie der `graph_mutate`-Format-Fumble in Benchmark-Befund 3).

Das Wissen „welche Relation ist für eine `UC` legal" liegt bereits im **importierten SE-Meta-Modell** (`@sigloch/contracts/se`, `META_MODEL`/`TRACE_PATTERNS`) — aber der Agent hat **keinen Query darauf**. Er muss es erraten oder vorgekaut bekommen.

## Decision

Read-only MCP-Tool **`graph_authoring_guide({ type })`** — surfaced **aus dem importierten Meta-Modell** (NICHT geforkt, kein lokaler Rule-Parser): für einen `ElementType` die **legalen Inzidenz-Kanten** als flache Liste —
- `outgoing`: `[{ edgeType, targetType, cardinality, description }]`
- `incoming`: `[{ edgeType, sourceType, cardinality, description }]`
- `requiredAttrs`: aus dem Node-Descriptor.

Der Agent ruft `graph_authoring_guide({type:'UC'})` **vor** dem Autoren, emittiert dann ein korrektes `add-node`/`add-edge` via `graph_mutate` (Write bleibt **ausschließlich** das Gate — **kein Parallelpfad**). Das ist das **Read-Pendant zu `graph_context` für die SCHREIB-Seite** der Spec: `graph_context` = „was ist die Definition-of-Done eines existierenden Knotens" (implement); `graph_authoring_guide` = „welche Struktur ist für diesen Typ legal" (author).

## Akzeptanz

- `graph_authoring_guide({type:'UC'})` liefert u. a. `outgoing` `compose→REQ`/`compose→FCHAIN` und `incoming` `compose←SYS`, `satisfy←FUNC`, `io←ACTOR|FLOW` — **abgeleitet aus dem Meta-Modell**, nicht hartkodiert.
- `requiredAttrs` pro Typ enthalten; unbekannter Typ → klarer Fehler.
- Quelle = `@sigloch/contracts/se`-Meta-Modell (Drift-Lock L1/L2: importiert, Version folgt der Familie — kein lokaler Fork).
- Rein lesend; ändert den Graphen nicht.
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- **Flache Write-Helfer** (`add-uc`/`add-req`/`link-verify`, CR-GC-216-Familie) — falls Guidance allein dem kleinen Modell nicht reicht (dann komponieren sie `harness.mutate()`, kein zweiter Write-Pfad).
- `status`/Lifecycle-Übergänge.

## Dependencies

`@sigloch/contracts/se` (`META_MODEL`/`TRACE_PATTERNS`, `ElementType`, Node-Descriptor) · `src/mcp-tools.ts`. Folgt aus `SPIKE-GC-loop-executor-benchmark`; Schreib-Seiten-Guidance komplementär zu CR-GC-213 (`graph_context`, Read/implement) und CR-GC-216 (`graph_realize`, Write/realize).
