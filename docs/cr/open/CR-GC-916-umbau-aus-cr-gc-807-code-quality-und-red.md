# CR-GC-916: Umbau aus CR-GC-807: code-quality und reduced-llm zu REQ am Kern-UC, deterministic-steering umbenennen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1315 (finding)
**Erstellt:** 2026-11-12
**Item:** bok/items/ITEM-2026-1315.json (Lane: graph)

---

**Bezug:** Messung und Vorschlag in CR-GC-807 (done), freigegeben vom Auftraggeber am 2026-11-12.

## Befund

Drei UC beschreiben eine Eigenschaft des Kern-UC `UC-intent-to-code` (CR-GC-806), kein eigenes
Nutzerziel. Der Kern-UC selbst hat noch keine REQ (UC-01).

## Zielbild

1. `UC-code-quality` wird `REQ-code-quality` (funktional) unter `UC-intent-to-code`. Seine 41 REQ hängen
   unter der neuen REQ, CR- und MS-Kanten zeigen auf sie. `TEST-code-quality` prüft sie.
2. `UC-reduced-llm` wird `REQ-reduced-llm` (nicht-funktional, Achse Modellgröße) unter
   `UC-intent-to-code`. Seine 10 REQ hängen darunter, die Ketten advisory-roundtrip und grammar-query
   wandern an den Kern-UC. `TEST-reduced-llm` prüft sie.
3. `UC-deterministic-steering` bleibt UC — er ist ein eigenes Nutzerziel — und heißt
   „Modell gegen ein Zielprofil verbessern“.

## Akzeptanz

- [x] `graph_elements({type:'UC'})` nennt weder `UC-code-quality` noch `UC-reduced-llm`.
- [x] UC-01 meldet `UC-intent-to-code` nicht mehr.
- [x] `rules_evaluate` meldet keinen Fehler.
- [x] Kommentare in `tests/mvp-e2e.test.ts` nennen die REQ statt der UC.
- [x] Modell und Sichten re-exportiert und mit dem CR committet.

## Nicht Ziel

- `TEST-code-quality` und `TEST-reduced-llm` an Testdateien binden (R-19 meldet beide schon vorher).

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1098, Tiefe 1, Wurzeln: `UC-code-quality`, `UC-reduced-llm`, `UC-deterministic-steering`._

Reichweite: 0 Elemente (); Blackbox-Rand 0, nicht geoeffnet.

Dateien (realRef, 0):
- (keine)

Tests (`graph_tests`, 0):
- (keine)

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

---

## Ergebnis (2026-11-12)

- Modell v1100, ein Batch mit 158 Befehlen, ohne Befund. Danach v1104 nach den CR-Abschlüssen.
- `UC-intent-to-code` trägt `REQ-code-quality` (funktional, 41 REQ darunter) und `REQ-reduced-llm`
  (nicht-funktional, 10 REQ darunter). Die Ketten advisory-roundtrip und grammar-query hängen jetzt am
  Kern-UC. `TEST-code-quality` und `TEST-reduced-llm` prüfen die neuen REQ.
- `UC-deterministic-steering` heißt „Modell gegen ein Zielprofil verbessern“.
- `tests/mvp-e2e.test.ts`: Kommentare und Testtitel nennen die REQ, 8/8 grün.
- Offen, wie im CR ausgenommen: `TEST-code-quality` und `TEST-reduced-llm` haben keine
  `testRefs` (R-19).
- `verify:full CR-GC-916`: 214/214 Dateien grün, Schlupf 0 (Folge 2/10).
