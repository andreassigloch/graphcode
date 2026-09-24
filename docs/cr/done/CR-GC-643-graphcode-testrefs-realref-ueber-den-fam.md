# CR-GC-643: graphcode: testRefs/realRef ueber den Familienleser, Vertraege als SCHEMA im Modell

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-534 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-534.json (Lane: code)

---

Gegenstueck zu CR-SM-360: die 9 eigenen Leser von testRefs/realRef in graphcode (write.ts, report.ts, verification-report.ts 2x, testreport.ts, exporter.ts 2x, conformance.ts 2x, work-order.ts 2x) gehen ueber readTestRefs/readRealRef der Familie. Die Vertraege bekommen SCHEMA-Knoten (extern, contracts ontology.ts) - erst modellieren, dann muss RC-09 die Leser melden, dann umstellen und RC-09 faellt auf 0. report.ts behaelt die Meldung ungueltiger testRefs ausdruecklich (state invalid), die anderen entscheiden sichtbar.

---

## Umsetzung (2026-09-24)

**Zuerst modelliert, dann gemessen, dann umgestellt:**
1. `SCHEMA-test-refs` und `SCHEMA-real-ref` (extern, contracts `ontology.ts`) sind ins Modell gekommen.
   Danach meldete RC-09 am echten Modell **2** Befunde: `TestRefsSchema` in 6 Dateien selbst geparst,
   `RealRefSchema` in 3.
2. Die 9 Leser gehen ueber `readTestRefs` / `readRealRef` (CR-SM-360): `write.ts`, `report.ts`,
   `verification-report.ts` (2x), `testreport.ts`, `exporter.ts` (2x), `conformance.ts` (2x),
   `work-order.ts` (2x). RC-09 = 0.
3. `report.ts` behaelt die Unterscheidung jetzt ueber den Leser statt ueber eigenes Parsen:
   `absent` wird zu „no testRefs attribute“ bzw. „concept-only“, `invalid` zu „invalid testRefs: …“.
   Die anderen Leser behandeln „kaputt“ wie „fehlt“, und zwar **sichtbar** (`state !== 'bound'`).

**Tests:**
- `tests/attributvertraege.test.ts` (TEST-attributvertraege, verify auf beide SCHEMA, loest R-32):
  graph_tests unterscheidet gebunden/kaputt/fehlt, der Verifikationsbericht wertet nur gueltige
  Bindungen, und eine kaputte Bindung erzeugt keine Code-Fakten. Das Leseverhalten ist gleich
  geblieben, die Faelle sind deshalb gegen den alten Code ebenfalls gruen.
- RC-09 am committeten Modell steht in `conformance.test.ts` (Modell-Spur, `RC-09 = []`). Gegen
  den alten Code rot (6 bzw. 3 Leser), gegen den neuen gruen, am selben Modell geprueft.
- Die neue Testdatei ist in der Modell-Spur ausgeschlossen, mit Grund: Sie prueft Code auf einem
  Wegwerf-Store.

VOLL 1538/1540; rot ist nur das Paar aus dem Link-Modus.

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
