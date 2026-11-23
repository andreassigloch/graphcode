# CR-GC-1020: R-26, R-32: audit-record, suggest-answer und der Dashboard-Socket an die neuen Familien-Schemas binden

**Typ:** aus Item ITEM-2026-1628 (finding)
**Erstellt:** 2026-11-23
**Item:** bok/items/ITEM-2026-1628.json (Lane: code)

---

## Befund

R-26 und R-32 melden drei SCHEMA ohne Zod-Schema und ohne Vertragstest. Bisher fehlte der Vertrag in den Familienpaketen. Seit dem Zug vom 2026-11-23 gibt es ihn: graph-api-core 6.1.0, se-engine 3.1.0 und graphcode-client 3.4.0.

- `SCHEMA-audit-record`: Der Satz im Operations-Log. `recordAudit` schreibt ihn ungeprüft auf die Platte. Gelesen wird er in einem anderen Prozess.
- `SCHEMA-suggest-answer`: Die Antwort von graph_suggest ist ein freies Objekt. Ihre Typen stehen nur als TS-interface im Code.
- `FLOW-dashboard-call`: Der Host liest jede Zeile vom Socket mit `JSON.parse(line) as ShimRequest`, also ohne Prüfung. Der Fluss hängt am Sammelknoten `SCHEMA-query-params`.

## Zug

1. Untergrenzen in package.json auf die drei neuen Versionen heben.
2. `SCHEMA-audit-record` bindet `AuditEntrySchema` aus graph-api-core (external). `recordAudit` parst jeden Satz, bevor er auf die Platte geht. Das Attribut `concept` entfällt.
3. `SCHEMA-suggest-answer` bindet ein neues `GraphSuggestAnswerSchema` in `src/loop/suggest.ts`. Es setzt sich aus `SuggestionSchema` und `SteerScoreSchema` aus se-engine zusammen. Das interface `GraphSuggestResult` und die Typen `SuggestVerdict` und `RankedSuggestion` werden aus dem Schema abgeleitet. Der Handler parst seine Antwort.
4. Neues `SCHEMA-shim-request` bindet `ShimRequestSchema` aus graphcode-client (external). `FLOW-dashboard-call` hängt daran statt an `SCHEMA-query-params`. Der Host parst jede Zeile mit `ShimRequestSchema`.
5. Je ein Vertragstest aus `graphcode vertragstest`, je eine TEST-Knoten mit `verify`.

## Abnahme

- R-26 und R-32 nennen audit-record und suggest-answer nicht mehr.
- RC-04 nennt keines der drei SCHEMA.
- Je Vertragstest wird mindestens ein Fall rot, wenn das Schema geschwächt wird.
- verify:code ist grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1584, Tiefe 1, Wurzeln: `SCHEMA-audit-record`, `SCHEMA-suggest-answer`, `FLOW-dashboard-call`._

Reichweite: 10 Elemente (FLOW 10); Blackbox-Rand 12, nicht geoeffnet.

Dateien (realRef, 1):
- src/surface/tool-context.ts

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
