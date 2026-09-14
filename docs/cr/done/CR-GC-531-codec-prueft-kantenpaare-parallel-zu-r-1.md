# CR-GC-531: Codec prüft keine Kantenpaare mehr — eine Routine (R-18)

**Status:** ✅ Done (2026-09-14, 4b8144d)
**Typ:** aus Item ITEM-2026-144 (finding)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-144.json (Lane: code)
**Auftrag:** Auftraggeber 2026-09-14 — eine Prüfroutine, geprüft nur, wo Daten in den Store gelangen
**Hängt an:** CR-GC-530 (Seed hält musterfremde Kanten zurück)

---

## 1. Root Cause

`GraphCodeCodec.validate` prüft jede Kante gegen `SE_DESCRIPTOR.edgeTypes[…].validPairs`
(src/projections/codec.ts:441–452), `encode` wirft bei jedem Befund (codec.ts:121). Das ist eine
eigene, schwächere Implementierung der Kantenlegalität neben contracts `traceRejection` (R-18): sie
kennt weder `where` (kinds) noch `label`. CR-GC-205 hat die Paarprüfung schon in R-18 gehoben und
das Gate vom Codec gelöst (gate.ts:134); die Prüfung im Codec blieb als paralleler Pfad stehen.

## 2. Impact

Seit CR-GC-530 gelangt keine musterfremde Kante mehr in den Store — Gate (R-18) und Seed
(`traceRejection`) prüfen mit derselben Routine. Die Codec-Prüfung urteilt über Daten, die schon
geprüft sind; bei einer Musteränderung zwischen Store und Lesen würde sie jedes Format-E-Lesewerkzeug
am ganzen Graphen scheitern lassen, statt R-18 den Fehler zeigen zu lassen.

## 3. Fix

Paarprüfung in `validate` löschen (Zeilen 441–452 und die beiden Doku-Stellen codec.ts:22, :389).
Unbekannter Knoten-/Kantentyp, doppelte uid und hängende Kante bleiben Fehler — die kann der Store
nicht halten bzw. keine Regel deckt sie.

## 4. Akzeptanzkriterien

- [x] Test (b) rot gegen heute („Invalid edge pair REQ -compose-> SYS“): `validate` eines Graphen mit
      musterfremder Kante liefert `valid:true`; `encode` gibt die Kante aus.
- [x] Test (a)/(d) grün: unbekannter Typ bleibt Fehler.
- [x] grep `validPairs` in src/projections: kein Treffer.
- [x] Suite 1124/1124 grün, tsc grün; Smoke: Format-E-Lesepfad am gebauten Host.

## 5. Dateien

`src/projections/codec.ts` · `tests/codec.validation.test.ts` · dieser CR
