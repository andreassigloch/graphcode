# CR-GC-852: Constraints Teil 2: Skill se-constraints und se-vorbereitung Abschnitt 2 fuer Constraints

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1059 (idea)
**Erstellt:** 2026-10-25, umgeschrieben 2026-10-26 (Konzept vom Auftraggeber freigegeben)
**Item:** bok/items/ITEM-2026-1059.json (Lane: code)

---

Teil 2 von CR-GC-804. Die Mechanik steht dort unverändert; die Prüffunktionen bringt CR-GC-851.

Der Titel nennt noch `se-vorbereitung` §2. Dieser Teil ist am 2026-10-26 in einen eigenen CR gewandert
(CR-GC-857): er braucht `constraintCarriers` aus contracts 12.8.0 (CR-SM-418), und das ist noch nicht
veröffentlicht. Dieser CR wartet nicht darauf.

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

## Umfang (Dateien)

1. `.claude/commands/se/target-profile.md` → per `git mv` nach `.claude/commands/se/constraints.md`, umgeschrieben
2. `tests/skill-constraints.test.ts` (neu) — bindet den Skill-Text an die Prüffunktionen, die er nennt
   (Muster `tests/skill-vorbereitung-felder.test.ts`)
3. jede Datei, die den Skill-Namen `se:target-profile` nennt — vor dem Bau per `graph_impact` auf die
   Skill-FUNC zählen; mehr als 10 Dateien insgesamt → schneiden
4. dieser CR

Modell: die FUNC des Skills bekommt den neuen `realRef`, REQ + TEST am Skill, per `graph_mutate`.

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
