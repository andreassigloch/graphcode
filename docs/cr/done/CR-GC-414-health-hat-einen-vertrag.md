# CR-GC-414 — Health bekommt seinen Datenvertrag

**Status:** done — 2026-08-25 (graphVersion 195)
**Herkunft:** CR-GC-409 §A, Paket „Health".
**Ziel:** R-31 für `FUNC-health-endpoint` schließen — mit dem FLOW, den der
Endpunkt real bedient, und einem echten Zod-Symbol dahinter.

## Befund

`GET /health` ist die einzige Fläche, an der ein Viewer erfährt, ob Store und Gate
wirklich arbeiten. Im Modell hängt `FUNC-health-endpoint` an keiner einzigen
`io`-Kante (R-31: „missing: input + output"), und im Code verlässt die Antwort den
Host als nacktes TS-Interface — ein Feld weniger fällt erst im Dashboard auf, und
dort als „degraded", nicht als Fehler.

Zwei reale Übergaben:

1. `health()` fährt `harness.evaluateRules()` — der Regelstrom ist der Beweis, dass
   das Gate arbeitet (`gate: 'functional'`). Das ist `FLOW-violations`, produziert
   von `FUNC-evaluate-rules` in derselben Kette (`FCHAIN-live-update`).
2. Die Antwort geht an den Viewer: `FLOW-health-report → ACTOR-dashboard`.

## Umfang

**Code**
- `src/viewer/health.ts` (neu): `HealthPayloadSchema` als Zod + daraus abgeleiteter
  `HealthPayload`-Typ. Eigene Datei, weil `host.ts` das Symbol IMPORTIEREN muss —
  RC-04 zählt eine Deklaration im selben File nicht als Bindung.
- `src/viewer/host.ts`: das bisherige `interface HealthPayload` entfällt (kein
  Parallelpfad), `health()` parst die Antwort, bevor sie den Host verlässt.
- `src/index.ts`: Re-Export folgt der neuen Herkunft.

**Modell (gate-only, `graph_mutate`)**
- `FLOW-health-report` + `SCHEMA-health-report` (realRef `HealthPayloadSchema`)
- io: `FLOW-violations → FUNC-health-endpoint → FLOW-health-report → ACTOR-dashboard`

`FLOW-violations` als Eingang hält `FUNC-health-endpoint` in derselben
io-Komponente wie der Rest von `FCHAIN-live-update` — ohne ihn entstünde ein IO-01.

## Regel-Delta (gemessen)

| Regel | vorher | nachher |
|---|---|---|
| R-31 | 11 | 10 |
| Summe | 50 | 49 |

Kein neues R-21: das Kettenpaar `evaluate-rules → health-endpoint` teilt
`FCHAIN-live-update`, und die trägt einen Integrationstest (`TEST-live-view`,
`TEST-create-harness-smoke`).

## Abnahme

`tests/host.bridge.test.ts` prüft gegen die laufende Bridge (echter Disk-Kuzu,
echter HTTP-Aufruf), dass die Antwort von `GET /health` `HealthPayloadSchema`
erfüllt und eine formfremde Antwort den Vertrag NICHT passiert.
