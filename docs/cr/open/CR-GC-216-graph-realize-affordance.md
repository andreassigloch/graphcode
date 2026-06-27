# CR-GC-216: `graph_realize` — ergonomisches Write-back-Affordance (Write-Twin von `graph_context`)

**Status:** Open (2026-06-27) · **Milestone:** `MS-5-efficiency` · **Max Files:** 3
**Graph (SSOT):** zu seeden (gate-only) `REQ-realize-affordance`, `FUNC-graph-realize` (→ `src/mcp-tools.ts`), `TEST-graph-realize` (→ `tests/mcp.context.test.ts`), `CR-GC-216`; unter `MS-5-efficiency`.

## Problem (Why)

Benchmark `SPIKE-GC-loop-executor-benchmark` (2026-06-27): kleine lokale Modelle (qwen3.6-27b) implementieren den Milestone graph-first korrekt — **scheitern aber am Graph-Write-back über rohes `graph_mutate`**. Beobachtet: das Modell riet das Kommando-Format falsch — `{"op":"update","uid":…,"patch":{"codeRef":"src/x.ts"}}` statt der echten diskriminierten Union `{"op":"update-node","node":{"uid":…,"attributes":{"codeRef":{"file":…,"symbol":…}}}}`. Erst als das exakte Schema **ausbuchstabiert** im Prompt stand, schrieb es korrekt zurück.

Das ist exakt das `graph_context`-Muster auf der **Schreib**-Seite: ein generisches, scharfes Tool (`graph_mutate`, nested discriminated union + `CodeRef`/`TestRef`-Objekte) ist für ein kleines Modell zu fehleranfällig. Ein **präzises, flaches Affordance** dreht „rät das Format" in „ein Call".

## Decision

Dünnes MCP-Tool **`graph_realize`** in `src/mcp-tools.ts` — **flaches** Schema, das die häufigste Realisierungs-Mutation kapselt und **über dasselbe Gate** (`harness.mutate()`) läuft (keine Parallelpfade — komponiert `mutate()`, kein neuer Write-Pfad):

```
graph_realize({ funcUid, file, symbol, lang?, testUid?, testFile?, testCase?, tool? })
```

- Setzt `funcUid.attributes.codeRef = {file, symbol, lang?}` via `op:update-node` (R-20).
- Optional `testUid.attributes.testRef = {file, case?, tool?}` (R-19).
- Gibt das Readiness-/`missingRefs`-Delta zurück (vorher/nachher), damit der Agent die Realisierung **bestätigt sieht** (statt blind).
- Autor wird geloggt (Gate-Semantik identisch zu `graph_mutate`).

Abgrenzung: `graph_mutate` bleibt das generische Gate-Tool (add/delete/edge/beliebige Attribute). `graph_realize` ist die **flache Abkürzung** für den 90%-Fall „FUNC/TEST realisiert" — der Write-Twin zu `graph_context` (Read).

## Akzeptanz

- `graph_realize({funcUid:'FN-x', file:'src/x.ts', symbol:'x'})` → `FN-x.codeRef={file,symbol}` **über das Gate** gesetzt; `FN-x` verlässt `missingRefs`; Rückgabe enthält das Delta.
- Optional `testUid`/`testFile` → `testRef` am TEST gesetzt (R-19).
- Schreibt **ausschließlich** über `harness.mutate()` (Gate-only-writes, kein zweiter Pfad); ungültige uid → klarer Fehler.
- Ein flaches Schema ohne nested discriminated union (für kleine Modelle robust callable).
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- `status`-Übergänge (`specified`→`realized`) — separat, falls Readiness es braucht.
- Batch-Realize mehrerer FUNCs in einem Call.

## Dependencies

`src/mcp-tools.ts` (komponiert `harness.mutate`) · `@sigloch/contracts/se` (`CodeRefSchema`/`TestRefSchema`, R-19/R-20). Folgt aus `SPIKE-GC-loop-executor-benchmark`; komplementär zu CR-GC-213 (`graph_context`, Read-Twin).
