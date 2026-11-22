# CR-GC-1000: Generator liest refine in drei festen Formen

**Typ:** aus Item ITEM-2026-1579 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1579.json (Lane: code)

---

Der Generator bricht bei jedem refine ab. Entscheidung des Autors (2026-11-22): refine ist erlaubt, wenn der Ausdruck eine von zwei festen Formen hat: Vergleich zweier Zahlfelder desselben Objekts, mindestens eines von N optionalen Feldern. superRefine, z.custom und transform bleiben Abbruch. Der Leser liefert eine Datenform, die Fallbildung kennt keinen Quelltext.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Welche `refine` liest der Generator? | Drei feste Formen: Vergleich zweier Zahlfelder desselben Objekts, mindestens eines von N optionalen Feldern, Text ohne Muster (Regex-Literal ohne Flags). Alles andere bricht ab und nennt SCHEMA und gelesenen Ausdruck. | Entscheidung des Autors am 2026-11-22. |
| `transform`? | Zählt als freie Prüfung: der Generator bricht bei `transform` und `pipe` mit `transform` ab. | Entscheidung des Autors am 2026-11-22. |
| Wer kennt den Quelltext? | Nur der Leser (`vertrag-ausdruck.ts`) liefert eine Datenform; die Fallbildung kennt keinen Quelltext. | Entscheidung des Autors am 2026-11-22. |

---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1489, Tiefe 1, Wurzeln: `FUNC-erzeuge-vertragstests`, `FUNC-vertragstest-verb`, `FUNC-se-bau`._

Reichweite: 10 Elemente (FLOW 4, FUNC 6); Blackbox-Rand 4, nicht geoeffnet.

Dateien (realRef, 3):
- .claude/commands/se-bau.md
- src/projections/vertragstest.ts
- src/surface/vertragstest-verb.ts

Tests (`graph_tests`, 6):
- tests/cli.scaffold.test.ts
- tests/knowledge-binding.test.ts
- tests/skill-bau.test.ts
- tests/vertrag/SCHEMA-vertragstest-bericht.vertrag.test.ts
- tests/vertrag/SCHEMA-vertragstest-satz.vertrag.test.ts
- tests/vertragstest.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Änderung

**Code (2 Dateien).** Neu `src/projections/vertrag-ausdruck.ts` (100 Zeilen): `liesAusdruck(quelltext, felder)` liefert `vergleich`, `mindestensEines` oder `textOhneMuster`, sonst `AusdruckFehler` mit dem gelesenen Ausdruck; Parametername frei, Klammern und Leerraum egal, Pfeil- und `function`-Schreibweise, `undefined` oder `void 0`; kein `eval`. Geändert `src/projections/vertragstest.ts` (805 auf 959 Zeilen; Grenze 500 schon vorher verletzt, der Schnitt der Fallbildung ist nicht Teil dieses CR): Beispiel erfüllt die Bedingung, Fälle je Grenze, `transform` bricht ab, Meldungen nennen die Formen nach ihrer Bedeutung.

**Skill (2 Dateien).** `.claude/commands/se-bau.md` Schritt 7, Version 7 auf 8, 1484 auf 1487 Wörter; `tests/skill-bau.test.ts`.

**Tests (1 Datei von Hand, 4 erzeugt).** `tests/vertrag-ausdruck.test.ts` (53 Fälle: Leser, Fallbildung, Abbrüche, Mutanten); für die Formen 1 und 2 rot zuerst gesehen (21 von 36 rot gegen den Stand vor der Änderung); die Tests der Form 3 entstanden nach dem Code, ihr Nachweis sind die Mutanten. Erzeugt (Fan-out): `tests/vertrag/SCHEMA-metric-policy`, `-metrics-answer`, `-mutate-command`, `-branch-merge-report`. Zusammen: 5 Quell- und Testdateien von Hand plus 1 Messdatei `docs/messung/vertragstest-ausdruck-mutanten-cr-gc-1000.md`, 4 erzeugt.

**Modell.** Vier TEST mit `verify` auf die vier SCHEMA, `TEST-vertrag-ausdruck` mit `verify` auf `REQ-contract-test-cases`.

## Messung

Mutanten: siehe `docs/messung/vertragstest-ausdruck-mutanten-cr-gc-1000.md`, 9 von 9 rot. Die vier Verträge sind erzeugt und grün (1257 Fälle). `SCHEMA-real-ref`, `SCHEMA-test-refs`, `SCHEMA-test-selection` brechen weiter ab am Ausdruck `!p.includes('\\')` (Methodenaufruf, eingebettetes `RepoRelativePathSchema`); `SCHEMA-format-e` bricht ab an `transform`. Fünf Muster der Pfadprüfung: alle von `ausRegex` gebildet, siehe Messdatei.
