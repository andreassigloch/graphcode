# CR-GC-993: se-bau Schritt 7: Vertrag ohne z.custom, refine, superRefine; bricht das Verb ab, ändert der Umsetzer den Vertrag

**Typ:** aus Item ITEM-2026-1561 (idea)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1561.json (Lane: code)

---

## Befund

Entscheidung des Autors vom 2026-11-21: In einem Vertrag gibt es kein `z.custom`, kein `refine`, kein `superRefine`; bricht der Generator ab, ändert der Umsetzer den Vertrag. Der Skill se-bau, Schritt 7, sagte das Gegenteil: „Für dieses SCHEMA beauftragst du einen Umsetzer mit dem Vertragstest von Hand.“

Gemessen am Generator (vor diesem CR), an fünf Schemas: `z.custom` brach ab (`Typ custom nicht unterstuetzt`, ohne Ausweg). `refine` und `superRefine` brachen nur ab, wenn die Bedingung das Beispiel ablehnte („kein angenommenes Beispiel“); lehnte sie es nicht ab (`.refine((i) => i.a !== 'x')`), erzeugte der Generator 6 Fälle und die Bedingung blieb ungeprüft. Ein Unit-Test für den Abbruch fehlte.

## Änderung

- `src/projections/vertragstest.ts`: `beispiel()` wirft bei jedem Schema mit einer `custom`-Prüfung (so legt zod 4 `refine` und `superRefine` ab) und bei `z.custom`. Der Bericht nennt Grund und Ausweg (Varianten, `z.function()`, Umsetzer ändert den Vertrag). Das Verb endet damit wie bisher mit Exit 1.
- `tests/vertragstest.test.ts`: 7 Fälle, rot ohne die Änderung (gemessen): `refine` am Objekt, am Feld, in einer Variante, `superRefine`, `z.custom` (Erzeuger wirft); Verb gegen ein Temp-Repo (Bericht nennt SCHEMA und Grund, keine Datei entsteht); Aufruf `graphcode vertragstest` (Exit 1, SCHEMA und Grund auf stderr). Der Test „findet kein Beispiel bei einer Querbedingung“ erwartet jetzt den Abbruch.
- `.claude/commands/se-bau.md` (Version 5 auf 6), Schritt 7: zwei Punkte ersetzt, siehe unten. Es gibt nur diese Fassung; die OpenCode-Fassung erzeugt `scaffold.ts` beim Ausliefern aus derselben Datei, kein Skript und keine zweite Datei im Repo.
- `tests/skill-bau.test.ts`: Konformanztest (FAQ `skill-konformanz-test`) schreibt die Regel fest, Version 6; rot mit dem alten Text (gemessen).

Gezählt: 2 Quell- und Skilldateien, 2 Testdateien.

## Folge für den Bestand

Der Generator lehnt jetzt jedes SCHEMA mit `refine`, `superRefine` oder `z.custom` ab, auch wenn die Bedingung aus einem Paket kommt. Gemessen an `graphcode vertragstest` über alle SCHEMA (Ziel außerhalb des Repos, 70 SCHEMA): 10 Berichte mit Fehler. Seit diesem CR neu sind sieben: vier mit der Bedingung im Paket `@sigloch/contracts` (`SCHEMA-mutate-command`, `SCHEMA-real-ref`, `SCHEMA-test-refs`, `SCHEMA-metric-policy`) und drei eigene SCHEMA, die solche Schemas einbetten (`SCHEMA-branch-merge-report`, `SCHEMA-metrics-answer`, `SCHEMA-test-selection`). Keines davon hat eine eingecheckte Vertragstest-Datei; vorher hätte der Generator sie ohne die Bedingung erzeugt. Drei Fehler bestanden schon: `SCHEMA-format-e` (`z.custom` im Paket graph-api-core), `SCHEMA-completeness` und `SCHEMA-readiness-report` (Symbol ist kein Zod-Schema). Die Änderung der Pakete ist Familie-Sache (Review, Version-Bump); dieser CR fasst sie nicht an.

## Skill-Text, Schritt 7 (neu)

- Ein Vertrag enthält kein `z.custom`, kein `refine`, kein `superRefine`. Eine Bedingung über mehrere Felder wird zu Varianten des Vertrags. Beispiel: Statt `.refine` „höchstens eines von report und results, mindestens eines von beiden“ steht `z.discriminatedUnion('art', [{ art: 'report', report }, { art: 'results', results }])`, je Variante ein Pflichtfeld. Ein Mitglied, das eine Funktion ist, ist `z.function()`. Die Rückgabe einer Funktion prüft ein gewöhnlicher Test, nicht der Vertrag.
- Endet das Verb mit Exit 1, nennt der Bericht das SCHEMA und den Grund, z. B. `refine` oder `z.custom`. Dann ändert der Umsetzer den Vertrag, bis das Verb durchläuft. Einen Vertragstest von Hand für ein SCHEMA mit Zod-Symbol gibt es nicht.

Unverändert: der Punkt zur Vertragsdatei `.md` mit `tool: "manuell"` (physische Flüsse).

## Überschneidung mit CR-GC-977

CR-GC-977 (offen, nicht angefasst) ändert in `se-bau.md` den Koordinator (Rückfragen, Entscheidungen durchsuchen) und Umsetzer Punkt 5, in `skill-bau.test.ts` die zugehörigen Fälle. Schritt 7 berührt er nicht: kein inhaltlicher Widerspruch. Zwei Stellen treffen sich: (1) `version:` im Kopf und die Zeile `version: 6` in `tests/skill-bau.test.ts`: wer zweiter schließt, setzt 7. (2) Seine Bedingung „die Summe der vier Skills wächst nicht“: se-bau wächst durch diesen CR um 581 Byte (8.984 auf 9.565).

## Akzeptanz

- [x] Neue Tests rot ohne, grün mit der Änderung (Generator: 7 von 7; Skill: 2 von 2 rot mit dem alten Text).
- [x] `npm run build` grün.

---

## Entscheidungen

Keine: der CR wendet die Entscheidung des Autors vom 2026-11-21 an.

## Umfang laut `graph_impact`

Wurzeln: `FUNC-se-bau`, `FUNC-erzeuge-vertragstests`. Tests: `tests/skill-bau.test.ts`, `tests/vertragstest.test.ts`.
