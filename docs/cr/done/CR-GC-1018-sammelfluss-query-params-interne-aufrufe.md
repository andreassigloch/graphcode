# CR-GC-1018: Sammelfluss query-params: interne Aufrufe ohne eigenen Vertrag

**Typ:** aus Item ITEM-2026-1622 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1622.json (Lane: code)

---

## Befund

Fortsetzung von CR-GC-1014 bis CR-GC-1017. An `SCHEMA-query-params` hängen noch interne Aufrufe, und jeder trägt im Code eine andere Form:

| Flüsse | Aufruf im Code | Vertrag |
|---|---|---|
| keine | | |
| `FLOW-harness-request` und vier Geschwister | `createHarness(config)`, parst `HarnessConfigSchema` | HarnessConfig aus contracts, ohne SCHEMA-Knoten |
| `FLOW-own-kuzu-request`, `-stdio` | `ownKuzu(opts)` | `OwnKuzuOptions`, nur Interface |
| `FLOW-verlauf-request` | `verlaufAmRepo(e)` | `VerlaufAmRepoEingabe`, nur Interface |
| `FLOW-read-request`, `FLOW-test-impact-request`, `-ingest`, `FLOW-http-route` | Methoden des Harness (`impact`, `subgraph`, `listElements`, `testImpact`) | `SCHEMA-harness-handle`, wie die übrigen Aufrufe an den Harness |
| `FLOW-health-request` | `GET /health` ohne Daten | `SCHEMA-aufruf-ohne-daten` |
| `FLOW-query-export` | `exportMarkdown(graph, view, name)`, parst `MarkdownViewSchema` | `SCHEMA-markdown-view`, wie `FLOW-render-view-request` |

## Zug

1. `OwnKuzuOptionsSchema` in `src/kernel/own-kuzu.ts`, mit `z.function()` für die Fabrik und die Senke. Der Harness-Griff ist `HarnessHandle`. `ownKuzu` parst den Auftrag.
2. `VerlaufAmRepoEingabeSchema` in `src/projections/verlauf-repo.ts`. Der Typ ist daraus abgeleitet, und graph_readiness parst den Auftrag vor dem Aufruf (Erzeuger parst).
3. Modell: neue SCHEMA `SCHEMA-harness-config` (external, contracts), `SCHEMA-own-kuzu-options` und `SCHEMA-verlauf-request`. Alle Flüsse der Tabelle werden umgebunden.
4. Je neuem SCHEMA ein erzeugter Vertragstest. Der Probelauf-Test ist neu gemessen.
5. Die Bindung von `SCHEMA-harness-config` hat einen zweiten Parse aufgedeckt (RC-09). `createHarness` parst die Konfiguration, und der Konstruktor von `GraphCodeHarness` parst sie danach erneut. Der Parse im Konstruktor entfällt. Sein Parameter ist schon als fertiges `HarnessConfig` getypt, und alle direkten Aufrufer übergeben die volle Form. Die eine Grenze bleibt `createHarness`.

## Was danach an SCHEMA-query-params bleibt

- `FLOW-generation-request`: `generationStep` nimmt acht Positionsargumente. Ein Vertrag dafür verlangt ein Objekt als Parameter, bei 105 Aufrufstellen. Das kommt als eigener CR.
- `FLOW-dashboard-call`: Die Zeile `ShimRequest` liegt in `@sigloch/graphcode-client`, und das geht in den Familien-Zug.
- `FLOW-auftrag` und `FLOW-skill-request`: Prompt-Text an den Agent-Host, kein Wire-Format. Das ist dieselbe Lage wie bei `SCHEMA-steering-channel`.

## Folge für die Kennzahlen

Der Steuerwert geht von 13,50 auf 14,00.

## Abnahme

- R-32 nennt keines der drei neuen SCHEMA.
- Die Vertragstests sind grün. Die Gegenprobe ohne Mindestlänge an `repoRoot` von ownKuzu macht 1 Fall rot.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1573, Tiefe 1, Wurzeln: `SCHEMA-query-params`._

Reichweite: 18 Elemente (FLOW 18); Blackbox-Rand 13, nicht geoeffnet.

Dateien (realRef, 1):
- src/kernel/own-kuzu.ts

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
