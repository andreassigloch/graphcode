# CR-GC-641: Format-E bekommt eine Zod-Tuer, SCHEMA-format-e bindet sie

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-530 (idea)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-530.json (Lane: code)

---

Zweiter Schnitt aus ITEM-2026-528. Format-E bekommt eine Zod-Tuer: FormatEInputSchema = z.object({text, bestand}).transform(...) in src/surface/format-e-commands.ts, der Codec-Parse laeuft darin, Parse-Fehler werden Zod-Issues (Meldungen wortgleich). formatEToCommands parst ueber die Tuer. SCHEMA-format-e bindet FormatEInputSchema statt des Typs FormatEDiff (graph-api-core). Danach sieht RC-09 jeden zweiten Format-E-Leser (Klasse P6/CR-GC-627); Positivkontrolle am echten Baum.

---

## Umsetzung (2026-09-24)

- `src/surface/format-e-commands.ts`: `FormatEInputSchema = z.object({ text, bestand }).transform(…)`.
  Der Codec-Parse laeuft in der Tuer, jeder Codec-Fehler wird ein Zod-Issue (wortgleich).
  `formatEToCommands` parst ueber die Tuer, die Fehlermeldung ist unveraendert
  (`Format-E parse errors: …`). Tuer und Uebersetzer teilen **einen** Typ-Aufloeser (`typeResolver`).
- Modell: `SCHEMA-format-e` bindet `FormatEInputSchema` statt des Typs `FormatEDiff` aus
  graph-api-core. `external` ist false, weil Format-E jetzt ein Vertrag ist, den graphcode selbst
  verantwortet (`graph_impact` vorher: FUNC-decode liest, FUNC-read-tools erzeugt).
- Tests: `mutate.formate-ops` um 4 Faelle (Diff, Issues wortgleich, Meldung unveraendert, Bestand typisiert).

## Positivkontrolle am echten Baum

Eine eingeschleuste Datei `src/surface/zz-positivkontrolle.ts`, die `FormatEInputSchema.parse(…)`
selbst ruft, also P6/CR-GC-627 in echt:

    graphcode: RC-09 1 — SCHEMA-format-e schema 'FormatEInputSchema' is parsed in 1 file(s) the model
    does not know as its producer or translator: src/surface/zz-positivkontrolle.ts

Ohne sie: RC-09 0. Die Datei ist wieder entfernt. **Die Kontrolle fand zuerst einen Fehler in der
Regel:** Die Schnittstellendatei ist hier zugleich die Definitionsdatei, sie importiert ihr Schema
nicht, und RC-04/RC-09 verlangten einen Import. Behoben in contracts (`parsesAt`, CR-SM-358-Nachtrag).
RC-04 in graphcode sank dadurch von 16 auf 14.

VOLL 1538/1540; rot ist nur das Paar aus dem Link-Modus (`distribution`, `lockfile-sync`).

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
