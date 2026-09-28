# CR-GC-709: Kennzahlverlauf je S2-Runde mitschreiben

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-638 (idea)
**Erstellt:** 2026-09-28
**Item:** bok/items/ITEM-2026-638.json (Lane: code)

---

## Befund

Die Wirkung jeder Executor-Änderung stand bisher nur im CR-Text der jeweiligen Änderung, in
uneinheitlicher Form, und über Runden hinweg nicht vergleichbar. Ob eine Änderung etwas verbessert
hat, war nur aus der Erinnerung zu beantworten.

## Umsetzung

- `rig/greenfield-systemtest/verlauf.mjs` (neu): `node verlauf.mjs <results-….json> "<Anlass>" [Datum]`
  hängt eine Zeile an `docs/messung/verlauf.md` an — je Lauf ein Wert: Elemente, Gate-Durchgang,
  Dubletten ÷ Elemente, Wirkketten mit 1 FUNC, Ähnlichkeit Golden, Fokusfunde am Ende,
  Lösungsquote der Fokusrunden (Nachspiel, CR-GC-708), MOD.
- `zuege.mjs`: ein Lauf mit Werten, die das heutige Schema verbietet, ist „nicht nachspielbar"
  (Schemabefund als Grund) statt eines Abbruchs des Berichts.
- `docs/messung/verlauf.md`: rückwirkend sechs S2-Runden (2026-09-24 … 27).
- `tests/rig-zuege.test.ts`: Zeile, Anhängen mit Kopf, Kennzahlen eines echten Laufverzeichnisses,
  Schemafall.
- README des Rigs, `docs/messung/kennzahlen.md`: Schritt „nach jeder S2-Runde".

## Akzeptanz

- Tests grün; `verlauf.md` enthält die sechs Runden.
- Die Lösungsquote steht nur für Läufe, die gegen den heutigen Code nachspielbar sind (sonst „—").
