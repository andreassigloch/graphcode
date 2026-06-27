# CR-GC-213: `graph_context` — Node-scoped Definition-of-Done-Context-Pack (MCP)

**Status:** Done (2026-06-26) · **Milestone:** `MS-5-efficiency` · **Max Files:** 3
**Graph (SSOT):** zu seeden (gate-only) `REQ-context-pack`, `FUNC-graph-context` (→ `src/mcp-tools.ts`), `TEST-graph-context` (→ `tests/mcp.context.test.ts`), `CR-GC-213`; unter `MS-5-efficiency`. Pointer, nicht autoritativ.

> **Closed 2026-06-26:** `graph_context` live in `src/mcp-tools.ts`; 7 Tests `tests/mcp.context.test.ts` grün, Gesamt-Suite 159 grün. `referenceImpl` verworfen (= `codeRef`, keine Parallelpfade). Live-Smoke gegen das graphcode-Selbstmodell: 3-Node-Bundle ~250 tok, 111× kleiner als der `graph_elements{300}`-Dump. Selbstmodell-Seed (`FUNC-graph-context` etc.) = Follow-up beim nächsten `seed-graph`-Lauf.

## Problem (Why)

Erste Realanwendung (graphify, Impl-Session `4025681c`). Gemessen am Implementier-Loop:

- Precise-Nav-Tools (`graph_impact`/`graph_expand`/`graph_get_node`): **0 Calls**. Stattdessen `Read` 31×/171.417 chars, `Bash` 90×/78.787 chars — **`docs/SPEC.md` in EINEM Read = 50.132 chars** (größte Einzel-Injektion der Session). Peak-Context 619.123 Tokens.
- **Root Cause = Ergonomie, nicht Modell.** Um EINEN Realisierungs-Knoten zu implementieren, hätte der Agent `graph_get_node` + `graph_impact` + `graph_expand` + `graph_get_edges` einzeln aufrufen und synthetisieren müssen. Ein einziges `Read docs/SPEC.md` „liefert alles" in einem Call. Der Pfad des geringsten Widerstands war der 50k-Monolith — der Graph verlor auf Bequemlichkeit, nicht auf Inhalt.
- **Richtungs-Lücke:** `graph_impact` liefert **Downstream** (Dependents / Regressionsradius — wer bricht, wenn ich ändere). Zum **Implementieren** braucht man das **Upstream-Spec-Closure**: welche `REQ`/`UC` muss ich erfüllen, welcher `TEST` verifiziert sie, welche `FLOW`/`SCHEMA` tausche ich — plus die `description`-Prosa des Knotens. Das liefert **kein** Tool in einem Call. (CR-GC-209 deutet das Server-Tool im Out-of-scope an: „`graph_plan` … Kandidat, falls die Prompt-Ableitung unzuverlässig wird.")

## Decision

Neues MCP-Tool **`graph_context(id, depth=1)`** in `src/mcp-tools.ts` — das **Definition-of-Done-Pack** für genau einen Realisierungs-Knoten, server-seitig assembliert, als ein Format-E-Slice (gleicher `uid.TYPE`-Dialekt wie `graph_impact`):

- der Knoten selbst inkl. `description` (Prosa) + `attributes.codeRef` / `testRef`,
- die `REQ`/`UC`, die er via **`satisfy`** erfüllt,
- die `TEST`, die diese REQ via **`verify`** prüfen (1 Hop über die erreichten REQ — die `verify`-Rückkante),
- die `FLOW`/`SCHEMA`, die er via **`io`/`relation`** austauscht,
- das `MOD`, dem er via **`allocate`** zugeordnet ist.

Komposition aus bestehenden Harness-Primitiven (`harness.subgraph(id, depth, 'out')` + gezielte `verify`-Rückkante über die erreichten REQ), `codec.serialize` → Format-E. **Kein** Full-Dump, **kein** neuer Store, **keine** Rule-Logik im Tool (R-08/R-18 bleiben im Gate).

**Abgrenzung (keine Parallelpfade):** `impact` = Downstream-Blast-Radius; `expand` = manuelles Branch-Deepening; `context` = Upstream-Spec-Closure (implement-ready). Die Tool-`description` nennt die Abgrenzung explizit, damit der Agent das richtige Tool wählt.

## Akzeptanz

- `graph_context('FUNC-x')` liefert ein Format-E-Slice mit: den von `FUNC-x` per `satisfy` erfüllten REQ, den diese REQ per `verify` prüfenden TEST, und der `description`-Prosa von `FUNC-x` — in **einem** Call, round-trip-parsebar durch `codec.parse`.
- Slice enthält `attributes.codeRef`/`testRef`, sofern am Knoten gesetzt; `missingRefs` listet realisierungs­reife FUNCs ohne `codeRef`. (**Keine** `referenceImpl`: eine Referenz-Implementierung **ist** ein `codeRef` auf einen Stub/Spike — kein neues Attribut, keine Parallelpfade.)
- Slice ist **minimal**: nur das `depth`-Hop-Spec-Closure (+ `verify`-Rückkante), **nicht** der Blast-Radius, **nicht** der Full-Graph. `nodeCount` messbar ≪ `graph_elements {limit:300}` für denselben Knoten.
- Unbekannte/nicht existente `id` → klarer Fehler, kein leeres Silent-Slice.
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- Un-realisierte FUNCs in graphify mit `codeRef` auf Spike/Stub versehen (Referenz-Impl = `codeRef`) **oder** den Algorithmus-Hinweis in die REQ/TEST-Prosa schreiben — Daten-Task, Fixture-Prep in `SPIKE-GC-context-sufficiency`. Kein neues Attribut.
- `format`-Param (JSON-Variante) — erbt aus CR-GC-210, falls dort generalisiert; hier Format-E-only.
- Read-seitige **Erzwingung** (Agent MUSS `graph_context` statt `SPEC.md` lesen) → CR-GC-214.

## Dependencies

`@sigloch/contracts/se` (TraceTypes `satisfy`/`verify`/`io`/`allocate`/`relation`) · `src/codec.ts` (`serialize`/`parse`) · `src/harness.ts` (`subgraph`). Komplementär zu CR-GC-207 (Materialisierung) und CR-GC-209 (`se-plan` nutzt `graph_context` pro CR-Knoten als Implementier-Input). **MVP-under-test** für `SPIKE-GC-context-sufficiency`.
