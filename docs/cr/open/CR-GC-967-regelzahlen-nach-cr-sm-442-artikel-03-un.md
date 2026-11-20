# CR-GC-967: Regelzahlen nach CR-SM-442: Artikel 03 und 04, Bildseite und Kanarienvogel auf 68 Regeln und Ontologie 14.0.0

**Typ:** aus Item ITEM-2026-1486 (finding)
**Erstellt:** 2026-11-20
**Item:** bok/items/ITEM-2026-1486.json (Lane: code)

---

## Befund

CR-SM-442 (contracts 12.16.0) streicht CL-01. Gegen 12.16.0 waren am 2026-11-19 zwei Tests rot, die veröffentlichte Zahlen
gegen den Katalog prüfen:

- `tests/claims.conformance.test.ts`: Artikel 03 und 04 nennen 69 Engine-Regeln, der Katalog hat 68.
- `tests/systemmodell-in-bildern.katalog.test.ts`: Die Bildseite nennt Ontologie 13.0.0, Regelkatalog 54.0.0 und 82 Regeln;
  der Katalog hat 14.0.0, 54.1.0 und 81.

Abgespalten aus CR-GC-960, damit dieser unter 10 Dateien bleibt.

## Zielbild

- `docs/articles/03-graphcode-harness-goal-and-concept.md`, `docs/articles/04-the-graphcode-story.md`: 68 Engine-Regeln.
- `docs/project/systemmodell-in-bildern.html`: Ontologie 14.0.0, Regelkatalog 54.1.0, 81 Regeln (zwei Stellen).
- `tests/claims.conformance.test.ts`: Kanarienvogel `engine rules=68` mit Herkunftszeile.

## Abnahme

- [x] Beide Tests waren gegen contracts 12.16.0 rot (69 statt 68; 13.0.0 statt 14.0.0; 82 statt 81) und sind danach grün.
- [x] Der Volllauf im Zug gegen den contracts-Tarball 12.16.0 ist grün (aise release prepare, 2026-11-20).

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

keine.


---

## Umfang laut `graph_impact`

Kein Schnitt aus dem Modell: nur Prosa und ein Zähltest. Dateien: die drei Dokumente aus dem Zielbild und `tests/claims.conformance.test.ts`.
