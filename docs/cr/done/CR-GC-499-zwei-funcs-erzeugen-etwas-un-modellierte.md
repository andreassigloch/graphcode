# CR-GC-499: Zwei FUNCs erzeugen etwas Un-modelliertes: tool-context (ToolContext) und create-harness (Harness)

**Status:** ✅ Done (2026-09-10)
**Typ:** aus Item ITEM-2026-025 (finding)
**Erstellt:** 2026-09-10
**Item:** bok/items/ITEM-2026-025.json (Lane: graph)

---

Sichtbar geworden bei der IO-02-Reparatur (ITEM-2026-024): nach dem Loeschen der falschen
Produzenten-Kanten meldet R-31 zwei FUNCs ohne Ausgang.

  FUNC-tool-context   createToolContext (src/surface/tool-context.ts) liefert einen ToolContext:
                      Codec, graphVersion, sessionId, Aufrufer, Repo-Wurzel. Jeder Werkzeugaufruf
                      bekommt ihn. Im Modell hatte er faelschlich FLOW-trajectory als Ausgang —
                      das RUFT er nur (Zeilen 457, 487).
  FUNC-create-harness createHarness (src/surface/create-harness.ts) liefert den GraphCodeHarness,
                      die oeffentliche Programmierschnittstelle. Im Modell hatte er faelschlich
                      FLOW-store-ownership als Ausgang — den setzt er nur auf (lockDir/onLockLost).

Beide erzeugen etwas Reales, das kein FLOW traegt. Solange das so ist, ist der Weg zu ihren
Konsumenten im Modell nicht da — graph_impact findet ihn nicht.

OFFEN: brauchen sie je einen FLOW mit eigenem SCHEMA, oder ist "die Fabrik liefert das Objekt,
auf dem alle anderen arbeiten" bewusst nicht als Fluss modelliert? Der zweite Fall waere eine
Regel-Frage an R-31, nicht eine Modell-Luecke.


---

## Entscheidung

Beide erzeugen Information, die andere Funktionen abholen — nach dem Vertragstest des
Auftraggebers ("ich uebergebe oder hole Information, die eine andere Funktion hinterlegt hat")
ist das ein FLOW. Also modellieren, nicht die Regel aufweichen.

Der Umfang bleibt klein, weil die Konsumenten am Code abgelesen und nicht geraten werden:

```
create-harness --[harness-handle]--> bind-tools, serve-stdio, import-code-verb, rewind,
                                     run-verb, tool-context
tool-context   --[tool-context]----> bind-tools
bind-tools     --[tool-registry]---> serve-stdio
```

Die dritte Zeile kam beim Umsetzen dazu: `FUNC-bind-tools` hatte vorher GAR keine io-Kante,
deshalb schwieg R-31 an ihm. Mit einem Eingang wachte die Regel auf und meldete den fehlenden
Ausgang — zu Recht. Beleg: `mcp-server.ts:69` reicht das Ergebnis von `bindToolsToHarness`
direkt an `bindRegistryToMcpServer` weiter. Erst damit endet die Kette an einem ACTOR.

Beleg: `mcp-tools.ts:127` ruft `createToolContext(harness, …)` — der Harness geht in den
Kontext hinein. `measured.ts:172`, `import-code-verb.ts:101`, `mcp-server.ts:163`,
`rewind.ts:140`, `run-verb.ts:92` rufen `createHarness(…)`. `bindToolsToHarness`
(`mcp-tools.ts:124`) haelt den ctx und reicht ihn an `bindReadTools` / `bindWriteTools` /
`bindAuditTools` weiter — die drei sind keine eigenen Modell-FUNC, deshalb endet die
Konsumentenliste bei `FUNC-bind-tools`.

Beide SCHEMA sind `concept: true` (spec-only, Praezedenz `SCHEMA-action`): der Harness und
der ToolContext sind Objekte mit Verhalten, kein Zod-Datenvertrag.

## Aenderungen (Modell, kein Code)

| was | wie |
|---|---|
| `SCHEMA-harness-handle` · `SCHEMA-tool-context` · `SCHEMA-tool-registry` | neu, alle drei concept |
| `FLOW-harness-handle` · `FLOW-tool-context` · `FLOW-tool-registry` | neu, je relation -> ihr SCHEMA |
| io-Kanten | 12 neu: 1P+6K harness-handle, 1P+1K tool-context, 1P+1K tool-registry |

## Akzeptanzkriterien

1. `rules_evaluate` meldet R-31 fuer `FUNC-tool-context`, `FUNC-create-harness` und
   `FUNC-bind-tools` nicht mehr.
2. IO-02 (Produzenten-Seite) steigt nicht: beide neuen FLOWs haben genau einen Produzenten.
3. Kein neuer Error im Gate; das Verdict bleibt `suggest`.
4. SSOT und Views re-exportiert.

## Nicht in dieser CR

Ob R-31 von einer Fabrik ueberhaupt einen Ausgangs-FLOW verlangen sollte. Die Frage entfaellt,
sobald die beiden FLOWs stehen.


---

## Ergebnis

graphVersion 243 -> 244, 20 Kommandos, `tier: suggest`, 0 Errors.

1. ✅ `rules_evaluate`: R-31 zaehlt 7 Verstoesse — decode, graph-export-snapshot,
   migrate-schema, nd-similarity, own-kuzu-host, rewind, session-shutdown. Die drei
   Fabriken sind raus.
2. ✅ Alle drei neuen FLOWs haben genau einen Produzenten.
3. ✅ Verdict `suggest`, 0 Errors im Gesamtlauf.
4. ✅ SSOT und 15 Views re-exportiert. `npm run verify:model`: 44 Dateien / 351 Tests gruen.

Kennzahlen ehrlich: `fitAdvisory` verbessert sich deutlich (modifiability +0,072,
coherence +0,111, scalability +0,039), das Chebyshev-Steering verschlechtert sich um
0,25 — BW-02 an `FUNC-block-grounding` steigt von 18 auf 20 Vertraege. Drei neue Vertraege
kreuzen die Grenze des groessten Blocks. Das ist der Preis dafuer, dass die Fabriken jetzt
im Modell stehen; die Konsolidierung dieses Blocks ist eine eigene Frage.
