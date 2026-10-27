# CR-GC-870: tsc-Fehler in tests/ beheben, Teil 2 (Teil 4 von ITEM-2026-1094)

**Status:** ✅ Done (2026-10-27)
**Typ:** aus Item ITEM-2026-1099 (idea)
**Erstellt:** 2026-10-27
**Item:** bok/items/ITEM-2026-1099.json (Lane: code)

---

Teil 4 von ITEM-2026-1094: die verbleibenden tsc-Fehler in tests/, zweite Haelfte der Dateien.

---

## Befund

Zwei der Fehler waren Defekte, die zur Laufzeit niemand bemerkte:

- `skill-authoring-gate` und `skill-report-measured` rufen `harness?.shutdown?.()`. Die Methode gibt
  es nicht; der optionale Aufruf schluckt das, und der Harness wird nie geschlossen. Jetzt `close()`.
- `nd-similarity` ruft `generationStep` ohne `threshold`; zur Laufzeit war er `undefined`. Jetzt `0.8`,
  derselbe Wert wie im Rest der Datei.

Übrige Ursachen:

| Ursache | Dateien | Lösung |
|---|---|---|
| `@ts-expect-error` vor `.mjs`-Import | generate.statemachine, whitebox-messung, messung | entfällt (`allowJs`) |
| Batch aus einem `.mjs`-Werkzeug ohne Typ | generate.statemachine | geht durch `MutateCommandSchema.array().parse` |
| `SE_DESCRIPTOR.rules` kann fehlen | generate.statemachine | Abbruch mit Meldung statt leerer Gate-Menge |
| Default `ohne = []` wird als `never[]` erkannt | `scripts/whitebox-messung.mjs` | JSDoc-Typ an `aenderungen` (Erzeuger, nicht Test) |
| handgeschriebener Ergebnistyp, falsch annotierte Audit-Einträge | bootstrap | entfallen, der echte Typ fließt |
| Kommando ohne `attributes`, Fixture als `unknown[]` | work-order, mcp.mutate-violations | `attributes: {}`, Fixture mit dem Typ von `importGraph` |

`mcp.symmetry` zieht in den nächsten Teil, damit dieser bei 10 Dateien bleibt.

## Akzeptanzkriterien

- `tsc -p tsconfig.tests.json` meldet in den 10 Dateien 0 Fehler (gesamt 25 → 11).
- Die 9 Testdateien laufen grün; `verify:code` grün.

## Nachweis (2026-10-27)

- Rot zuerst: `tsc -p tsconfig.tests.json` meldete in den 10 Dateien 14 Fehler, danach 0 (gesamt 25 → 11).
- Grün: die 9 Testdateien (87 Tests), `verify:code` (Spur VOLL, 202 Dateien).
