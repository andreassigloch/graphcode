# CR-GC-994: Vertragstest-Generator: Werteliste eines z.literal einfrieren (Art-Feld einer Variante)

**Typ:** aus Item ITEM-2026-1563 (idea)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1563.json (Lane: code)

---

## Befund

Eine Variante einer `z.discriminatedUnion` trägt ihr Art-Feld als `z.literal`. Der Erzeuger prüfte dort nur den Typ (`art mit falschem Typ`). Er fror die Werteliste nicht ein und prüfte keinen Fremdwert. Ein Literal, das einen Wert dazubekommt (`z.literal(['report', 'x'])`), blieb im erzeugten Test grün. Beim Enum friert der Erzeuger die Werteliste ein (`Werteliste unverändert`); beim Literal fehlte das. Anlass: `GraphTestIngestInputSchema` (CR-GC-992) trägt drei Varianten über `art`.

## Änderung

- `src/projections/vertragstest.ts`: ein Literal an einem Objektfeld bekommt den Fall `lehnt ab: <feld> außerhalb des Enums` und einen Fall `Werteliste unverändert`. Der zweite liest `_zod.def.values` statt `entries` (Feld `feld: 'values'` am Fall).
- `tests/vertragstest.test.ts`: Unit-Test. Rot ohne die Änderung (gemessen), grün mit ihr.
- Fan-out: `tests/vertrag/SCHEMA-mutate-answer.vertrag.test.ts` neu erzeugt (504 statt 492 Fälle; zwei Varianten mit Literal `measurable`). Alle anderen SCHEMA mit Zod-Symbol erzeugen keine Änderung (`graphcode vertragstest` ohne uid, danach `git status`).

Gezählt: 2 Quell- und Testdateien, 1 erzeugte, 1 CR.

## Akzeptanz

- [x] Unit-Test rot ohne, grün mit der Änderung.
- [x] Erzeugte Datei `SCHEMA-mutate-answer` grün.

---

## Entscheidungen

Keine: der CR wendet FAQ `schema-vertragstest-pflicht` an.

## Umfang laut `graph_impact`

Wurzeln: `FUNC-erzeuge-vertragstests`, `TEST-vertragstest-generator`, `TEST-vertrag-mutate-answer`.
