# CR-GC-849: Modell: 36 Aufrufe zwischen verankerten FUNCs ohne Fluss nachziehen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1043 (finding)
**Erstellt:** 2026-10-23
**Item:** bok/items/ITEM-2026-1043.json (Lane: code)
**Vor:** CR-GC-846. Danach meldet RC-13 am Selbstmodell 0 Paare.

---

## Befund

Gemessen am 2026-10-23 mit der Aufrufsuche aus CR-GC-843, in umgekehrter Richtung:
- 71 verankerte FUNCs lösen sich auf.
- Zwischen ihnen gibt es 122 Paare mit einem Aufrufweg von höchstens 3 Schritten. Gezählt wurde nur ein Weg, der durch keine weitere verankerte FUNC geht, und es gilt der innerste Anker.
- 36 dieser Paare haben keinen FLOW.

Entschieden am 2026-10-23: Aufbau, Start und Ende gehören als Flüsse ins Modell. Das passt zu den 8 Aufbau-Flüssen, die am Hoststart schon stehen (`FLOW-store-open`, `FLOW-bind-request`, …). Methodenregel 4 bleibt: Start, Ende und Anfrage sind getrennte Ketten.

## Die 36 Paare

**Daten in einer Anfrage (18)**

| Aufrufer → Gerufener | Weg im Code | Vorbild im Modell |
|---|---|---|
| graph-readiness, rules-tool, graph-help, graph-merge-tool, health-endpoint, import-code-verb → graph-store | `getGraph`/`evaluateRules` > `current` | Leser an `FLOW-graph-state` |
| graph-metrics, graph-mutate-tool, graph-readiness, vorschlag → target-profile-load | `loadTargetProfile` | `FLOW-target-profile` |
| graph-readiness → tool-context | `arbeitsmenge` | `FLOW-audit-entry` |
| graph-suggest → tool-context | `serializeToolWrite` | `FLOW-audit-entry` |
| rules-tool → check-code-conformance | `evaluateAll > conformanceEvaluation` | — |
| health-endpoint → list-elements | `health > listElements` | `FLOW-store-query` |
| serve-sse → health-endpoint, graph-expand | `start > route` | — |
| reseed → graph-store | `reseed > importTarget` | `FLOW-imported-graph` |
| tool-context → emit-trajectory | `recordAudit > materializeTrajectory` | heute nur `async` über `FLOW-audit-record`. Der Aufruf ist direkt, deshalb wird der Fluss geteilt (Fehlerklasse 10). |

**Aufbau, Start und Ende (18)**

| Aufrufer → Gerufener | Weg im Code |
|---|---|
| create-harness → graph-store, claim-store-lock, emit-update-event | `GraphCodeHarness`, `StoreLock`, `registerEmitters` |
| graph-store → claim-store-lock, schema-guard, apply-reseed | `open > acquire`, `schemaFingerprint`, `applyReseed` |
| open-store → graph-store | `open > load` |
| bind-tools → read-tools; host-proxy, import-code-verb → bind-tools | `bindToolsToHarness` |
| serve-stdio → session-shutdown, host-proxy, broadcast-diff, own-kuzu-host, graph-store | `SessionLifecycle`, `buildProxyRegistry`, `broadcast`, `maybeStartBridge`, `close` |
| serve-sse → broadcast-diff | `start > broadcast` |
| cli-dispatch, rewind → graph-store | `shutdown`/`executeRewind` > `close` |

## Änderung

- Je Paar ein FLOW mit Erzeuger und Abnehmer nach Regel 2 aus `se:top-level`, mit `sync` nach Regel 7.
- Paare mit derselben Übergabe werden gebündelt, zum Beispiel die Leser an `FLOW-graph-state`. Der Zug hängt dann nur `io`-Kanten an, er legt keinen neuen FLOW an.
- Ein neuer FLOW ist Glied der Kette seines Auslösers: Anfrage, Hoststart oder Ende.
- Vor jedem Zug `graph_impact` am FLOW, den der Zug teilt (`FLOW-audit-record`).

## Umfang

Nur Modell: `docs/graph/`, `docs/views/`. Kein Code.

## Akzeptanz

- Die umgekehrte Aufrufsuche meldet am Selbstmodell 0 Paare ohne FLOW.
- `npm run abgleich:fluss` meldet weiter 0 `kein-aufruf` und 0 `beleg-kaputt`.
- `rules_evaluate` meldet keinen neuen Error.
