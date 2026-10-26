# CR-GC-852: Constraints Teil 2: Skill se-constraints und se-vorbereitung Abschnitt 2 fuer Constraints

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1059 (idea)
**Erstellt:** 2026-10-25, umgeschrieben 2026-10-26 (Konzept vom Auftraggeber freigegeben)
**Item:** bok/items/ITEM-2026-1059.json (Lane: code)

---

Teil 2 von CR-GC-804. Die Mechanik steht dort unverändert; die Prüffunktionen bringt CR-GC-851.

Der Titel nennt noch `se-vorbereitung` §2. Dieser Teil ist am 2026-10-26 in einen eigenen CR gewandert
(CR-GC-857, geschlossen am selben Tag).

## Ziel

Der Skill `se:target-profile` wird an seinem Platz zu `se:constraints` umgeschrieben. Es gibt keinen zweiten
Skill daneben. Die Fragen je Dimension bleiben; die Antwort ist ein Constraint statt eines Gewichts.

Beispiel: die Frage zu `coherence` lautete „wie stark soll der Zusammenhalt der Module zählen?" und ergab ein
Gewicht. Jetzt fragt der Skill, welches Modul zusammenhalten muss, und schreibt eine nicht-funktionale REQ an
dieses Modul mit einem TEST, der die passende Prüffunktion aus `@sigloch/graphcode/constraints` ruft.

Der Skill schreibt REQ und TEST durch das Gate (`se:author-req`). Er nimmt nur Constraints auf, die ein Zug
am Modell brechen kann, ohne dass sich Code-Verhalten ändert (Konzept in CR-GC-851). Fehlt für eine Antwort
die Prüffunktion, nennt der Skill das als neuen CR, statt die Prüfung in den Test zu schreiben.

## Voraussetzung

CR-GC-853 ist geschlossen: dort fallen die Abschnitte 1, 2 und 4 des Skills (Gewichte, Zielwerte,
Zielkonflikte). Der Rest ist die Grundlage, auf der dieser CR umschreibt.

## Abweichung vom Text oben (Auftraggeber, 2026-10-26)

Fehlt für eine Antwort die Prüffunktion, legt der Skill über `se:author-req` REQ und TEST an, und der Test
schreibt die Prüfung. Kein neuer CR je fehlender Prüffunktion; erst wenn ein zweites Repo dieselbe Prüfung
braucht, wird sie ein Item für `@sigloch/graphcode/constraints`. Die Fragen je Dimension, die Antwortformen
und die drei Konfliktpaare hat der Auftraggeber vorgegeben; der Skill trägt sie als Tabelle.

## Wohin die Themen gehen: nach `se:generate`

grep nach `intentAnchors`, `intentCoverage` und „Noch nirgends beschrieben" in `.claude/commands`, `src/loop`,
`src/projections` und `src/surface`: Die Themen setzt und liest nur `graph_generate`
(`persistIntentAnchors` in `suggest.ts`, `generate.ts`), gemeldet werden sie in `graph_readiness`
(`report.ts`). Kein Skill außer dem alten `target-profile.md` nannte sie. Ein Thema ist kein Constraint:
es hat keinen Adressaten und keinen Test. Deshalb steht der Abschnitt jetzt in `se:generate`, dem Skill, der
`graph_generate` führt, und nicht in `se:constraints`. Die Datei `.graphcode/target-profile.json` und ihr
Loader bleiben (CR-GC-853).

## Umfang (Dateien)

1. `.claude/commands/se/target-profile.md` → `git mv` nach `.claude/commands/se/constraints.md`, umgeschrieben
   (Version 4): Tabelle der Fragen mit Prüffunktion, Kriterium, Konfliktpaare, Vorbild REQ + TEST
2. `tests/skill-constraints.test.ts` (neu) — bindet den Skill an Prüffunktionen, Regelkatalog, Felder von
   `graph_metrics` und Attribute der Ontologie; R-18 am Gate-Katalog geprüft; Positivkontrolle
3. `src/projections/help.ts` — `graph_help` einer Dimension verweist auf `se:constraints`
4. `tests/help-content.test.ts`
5. `src/surface/scaffold-docs.ts` — GRAPHCODE-STEERING.md: Hebel 4 sind Constraints, kein Zielprofil
6. `tests/cli.scaffold.test.ts`
7. `.claude/commands/se/top-level.md` (Version 4) — Phase 2 über `se:constraints`, kein `fitAdvisory`
8. `.claude/commands/se/generate.md` (Version 3) — Handoff ohne Gewichte, Abschnitt „Themen der Intention"
9. `src/loop/suggest.ts` — Beschreibung von `graph_suggest`: rankt nach dem Abstand zu den Regelschwellen
10. `tests/helpers/witness.ts` — eigener Typ statt `TargetWeights` (offen aus CR-GC-861)

Unverändert, mit Grund: `beispielgraphen/graphcode.graph.json` und `tests/fixtures/perf-basis.graph.json`
nennen den alten Skill als eingefrorene Stände; die Tests in `generate.test.ts` und `skills.mcp-conformance`
prüfen, dass `se:target-profile` nicht vorkommt.

Modell per `graph_mutate` (graphVersion 943): `FUNC-target-profile` in `FUNC-se-constraints` gemergt (alle
Kanten wandern, `realRef` auf `constraints.md`), ebenso `FLOW-anleitung-target-profile` in
`FLOW-anleitung-se-constraints`; neu `REQ-constraints-skill-vertrag` mit `TEST-skill-constraints`.

## Akzeptanzkriterien

- Es gibt einen Skill, `se:constraints`; `se:target-profile` ist weg, kein Verweis zeigt mehr darauf.
- Der Skill nennt nur Prüffunktionen, die `@sigloch/graphcode/constraints` exportiert; der Text-Test ist rot,
  wenn er eine nennt, die es nicht gibt.
- Je Dimension fragt der Skill nach einem Element und einer Eigenschaft und schreibt REQ + TEST, nie ein Gewicht.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 890, Tiefe 1, Wurzeln: `FUNC-se-vorbereitung`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 1, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se-vorbereitung.md

Tests (`graph_tests`, 2):
- tests/skill-authoring-gate.test.ts
- tests/skill-vorbereitung-felder.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

Dieser Schnitt gehört zu `se-vorbereitung` §2 und gilt seit dem 2026-10-26 für CR-GC-857.

## Nachweis (2026-10-26)

- Rot zuerst: `tests/skill-constraints.test.ts` (8 rot, Skill fehlt), `tests/help-content.test.ts` und
  `tests/cli.scaffold.test.ts` (je 1 rot), `tests/skill-authoring-gate.test.ts` nach dem `git mv` rot
  (`realRef` zeigte ins Leere) bis zum Merge im Modell.
- `verify:code`: Spur VOLL (eine Datei ohne Knoten), 199 Dateien grün. `verify:full CR-GC-852`: 199/199,
  1636 Tests, Schlupf 0.
- Smoke: Host neu gestartet; `graph_help({token:"coherence"})` nennt `prompt: "se:constraints"`.
