# CR-GC-955: contracts 12.15.0 übernehmen: RD-07 Level jump (CR-SM-436), Regelzahl 82, Regelmatrix, Systemmodell-Seite

**Status:** ✅ Done (2026-11-17)
**Typ:** aus Item ITEM-2026-1423 (finding)
**Erstellt:** 2026-11-17
**Item:** bok/items/ITEM-2026-1423.json (Lane: code)

---

## Befund

contracts 12.15.0 (Regelkatalog 54.0.0, se-engine 3.0.7) bringt RD-07 „Level jump“ (CR-SM-436). Die Regel meldet
eine REQ, die unter SYS oder UC haengt, keine Kind-REQ hat und von einer tiefen FUNC oder einem tiefen MOD erfuellt
wird. Gegen diesen Stand waren 5 Tests in 3 Dateien rot: die Zahl der Engine-Regeln, das Golden von sigllm und die
Seite „Systemmodell in Bildern“.

## Root Cause

Zaehlungen in Artikeln, Seite und Test standen auf Katalog 53.0.0.

## Zielbild

- `package.json`: `@sigloch/contracts ^12.15.0`, `@sigloch/se-engine ^3.0.7`.
- Engine-Regeln 68 → 69 in zwei Artikeln und in `claims.conformance`. Alle Regeln 81 → 82, Katalog 54.0.0,
  hoechstens 13 Regeln je Stufe (Stufe 7) auf der Seite. Regelmatrix neu erzeugt.
- Das Golden von sigllm bekommt RD-07 als offene Regel; es wird nicht gerichtet.
- MCP-Host neu gestartet, er bootet mit 12.15.0.

## Abnahme

- RD-07 meldet am graphcode-Modell 39 Befunde, gleich der Messung in CR-GC-919.
- `npm run build`, `type-check` gruen, `npm run verify:full CR-GC-955` gruen.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | – | Der CR wendet CR-SM-436 an. |

---

## Umfang laut `graph_impact`

- `FUNC-evaluate-rules` (Kante `relation` vom CR): bewertet mit dem neuen Katalog. Kein Quellcode geaendert.

## Dateien

1. `package.json`
2. `package-lock.json`
3. `tests/claims.conformance.test.ts`
4. `tests/generate.statemachine.test.ts`
5. `docs/articles/03-graphcode-harness-goal-and-concept.md`
6. `docs/articles/04-the-graphcode-story.md`
7. `docs/project/systemmodell-in-bildern.html`
8. `docs/views/regel-matrix.{md,csv}` (erzeugt)

## Ergebnis

`npm run verify:full CR-GC-955` am 2026-11-17 gegen contracts 12.15.0 aus der Registry: 231 von 231 Dateien,
1914 von 1914 Tests gruen, Schlupf 0. RD-07 meldet am lebenden Modell 39 Befunde, gleich der Messung in CR-GC-919.
Der MCP-Host wurde neu gestartet und bootet mit contracts 12.15.0.
