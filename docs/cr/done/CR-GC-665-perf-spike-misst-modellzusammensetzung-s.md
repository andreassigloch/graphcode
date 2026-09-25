# CR-GC-665: Perf-Spike misst Modellzusammensetzung statt Engine — fester Eingang wird aus dem lebenden Modell geschnitten

**Status:** ✅ Done (2026-09-25)
**Typ:** aus Item ITEM-2026-568 (bug)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-568.json (Lane: code)

---

## Befund

`tests/perf.advisory-roundtrip.spike.test.ts` wurde in der Voll-Spur rot: Wachstumsfaktor 500→2000
Knoten 3,4–3,6, Schwelle 3. **Derselbe Code ist mit dem Modell vom Stand 3fe69fd gruen** (geprueft auf
einer Test-Kopie mit umgelenktem Pfad). Bisektion ueber die 18 Modell-Commits seither: gruen bis
`a6db7a0`, rot ab `f6fcc25` — einziger Unterschied ein kantenloser CR-Knoten (CR-GC-657), angelegt
von `aise dispatch prepare`. Wiederholungen bestaetigen beide Seiten.

Ursache: der „feste" Eingang ② wurde aus Kopien des LEBENDEN Modells gebaut und bei N Knoten
abgeschnitten. Fest war nur die Knotenzahl; welche Elemente in der angeschnittenen Kopie landen und
welche Regeln feuern, haengt an jedem Modell-Commit. Der Test versprach „Same input every run, so a
regression is the engine's" und hielt das nicht.

## Umsetzung

Die Basis der Messungen mit Schwelle (② fester Eingang, Skalierung 500→2000) ist eine Fixture —
`tests/fixtures/perf-basis.graph.json`, das SSOT vom Stand 3fe69fd (letzter Stand, auf dem die volle
Suite gruen war). ① (lebendes Modell, nur berichten) bleibt am aktuellen Modell. Schwellen unveraendert.

## Dateien (3)

`tests/perf.advisory-roundtrip.spike.test.ts`, `tests/fixtures/perf-basis.graph.json` (neu), diese Datei.

## Akzeptanzkriterien

- [x] Gruen mit fester Basis, zweimal hintereinander; Schwellen unveraendert.
- [x] Die Ursache ist belegt (Bisektion, Gegenprobe mit altem Modell), nicht vermutet.
