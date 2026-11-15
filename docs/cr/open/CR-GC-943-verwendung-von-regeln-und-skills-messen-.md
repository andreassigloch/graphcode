# CR-GC-943: Verwendung von Regeln und Skills messen: Skill-Name am Zug, Ablehnungsquote und Feuerbild je Regel

**Typ:** aus Item ITEM-2026-1370 (idea)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1370.json (Lane: code)

---

**Status:** Freigegeben 2026-11-15; nicht umgesetzt.

## Anlass

Die Ablehnungsquote ist seit 2026-11-15 KPI 5 in `docs/messung/kennzahlen.md`. Sie soll die Güte von Regeln und
Skills zeigen, für beide nach derselben Lesart. Zwei Dinge fehlen dafür.

**1. Je Skill ist nichts messbar.** Ein Zug trägt `consumerId`, ein frei gewähltes Etikett. `audit_stats` nennt
am 2026-11-15 über 170 verschiedene Etiketten (`cr-gc-857`, `claude-code-CR-GC-876`, …). Nur zwei davon sind
Skill-Namen (`se-fmea`, `se-vorbereitung`), und nur, weil der Agent sie zufällig so gewählt hat.

**2. Je Regel fehlt das Feuerbild.** `audit_stats` liefert je Regel `blocked`, `occurrences` und `passed`, aber
nicht, in wie vielen Zügen die Regel gefeuert hat. Stand 2026-11-15 über 1613 Züge (1474 angewandt, 139 abgelehnt):

| Bild | Regeln | Befund |
|---|---|---|
| Nie gefeuert | 27 von 86, z. B. AF-01, CL-01, MT-01, NFR-01, R-17, UC-04 | Regel prüft etwas, das hier nie vorkommt, oder sie ist abgeschaltet (MT-01: Schwelle `null`) |
| Blockt am häufigsten | R-18 in 56 von 139 Ablehnungen, dann OCC 23, SCHEMA-01 22 | Die erlaubten Kantenpaare sind dem Schreibenden nicht bekannt |
| Viele Funde, nie abgearbeitet | BW-02 532, MS-03 458, R-04 379, CR-R01 368 | Warnung ohne Wirkung: Schwelle falsch oder niemand handelt |
| Je geblockt haben nur | 10 von 86 Regeln | — |

„Nie gefeuert" gilt für dieses eine Repo. Ob eine Regel überall stumm ist, zeigt erst derselbe Blick über
mehrere Repos.

## Zielbild

- Jeder Zug trägt den Namen des Skills, den der Schreiber nennt. Ein Zug ohne Angabe zählt als „nicht erfasst".
- `audit_stats` liefert `bySkill` in derselben Form wie `byRule` und `byConsumer`: angewandt, abgelehnt,
  häufigste blockende Regel.
- `audit_stats` liefert je Regel zusätzlich die Zahl der Züge, in denen sie gefeuert hat (`firedIn`), neben der
  Zahl der Züge, in denen sie ausgewertet wurde (`evaluatedIn`). Mit `since` ergibt das den Verlauf.
- Die Messung urteilt nicht (FAQ `messung-urteilt-nicht`): „nie" und „dauernd" liest der Leser aus den zwei
  Zahlen, die Lesart steht in `kennzahlen.md`.

## Vorgehen

1. `graph_mutate` bekommt den optionalen Parameter `skill`. Der Wert wird gegen die Skill-Namen in
   `.claude/commands` geprüft; ein unbekannter Name ist ein Fehler, kein stilles Etikett.
2. Audit-Satz und `trajectory.jsonl` tragen das Feld `skill`. Alte Sätze ohne das Feld zählen als „nicht
   erfasst", nicht als „kein Skill" (`null` statt 0, wie bei `passed`).
3. `audit_stats`: `bySkill` und je Regel `firedIn`.
4. Jeder Skill, der `graph_mutate` aufruft, nennt den Parameter in seinem Text; ein Test prüft das je Skill.
   **Abgetrennt in einen Folge-CR** (siehe „Schnitt").
5. `kennzahlen.md`: KPI 5 verliert den Satz „je Skill fehlt die Grundlage"; das Feuerbild je Regel kommt als
   Lesart dazu.

## Abnahme

- [ ] Ein Zug mit `skill: "se-fmea"` steht mit diesem Feld im Audit-Satz und in `trajectory.jsonl` (Test, vorher rot).
- [ ] Ein Zug mit unbekanntem Skill-Namen wird abgelehnt (Test).
- [ ] `audit_stats` liefert `bySkill`; ein alter Satz ohne Feld zählt unter „nicht erfasst" (Test).
- [ ] `audit_stats` liefert je Regel `firedIn`; eine Regel ohne Fund hat 0, eine nicht ausgewertete `null` (Test).
- [ ] `npm run verify:full CR-GC-943` grün.

## Schnitt

17 Skill-Dateien nennen `graph_mutate`. Mit ihnen berührte der CR 30 Dateien statt 10. Der Schnitt bleibt
grün (FAQ `cr-dateigrenze-ausnahme`, Punkt 1): das Werkzeug nimmt den Parameter an, auch wenn noch kein Skill
ihn nennt. Dieser CR liefert Werkzeug, Auswertung und Lesart; der Folge-CR trägt den Satz in die 17 Skills
und den Test dazu.

`src/surface/audit.ts` stand bei 503 Zeilen. Die Auswertung liegt jetzt in `src/surface/audit-stats.ts`
(Ankündigung im Dateikopf seit CR-GC-347). Fünf Testdateien ändern dafür je eine Importzeile.

| Art | Dateien |
|---|---|
| Entwurf (8) | `src/surface/audit-stats.ts` (neu), `audit.ts`, `write.ts`, `tool-context.ts`, `tool-context-contract.ts`, `scaffold-templates.ts`, `src/projections/trajectory.ts`, `tests/audit.skill-und-feuerbild.test.ts` (neu) |
| Doku (1) | `docs/messung/kennzahlen.md` |
| Importzeile (5) | `tests/audit.stats.test.ts`, `audit.retention.test.ts`, `audit.trail-projection.test.ts`, `contracts.surface.test.ts`, `operations-log.integration.test.ts` |

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Woher kommt der Skill-Name am Zug? | Der Agent nennt ihn als Parameter `skill` von `graph_mutate` (Autor, 2026-11-15). | Geht in jedem Client. Das Sitzungsprotokoll gibt es nur in Claude Code. Die Angabe ist keine Messung: ein Zug ohne Parameter zählt als „nicht erfasst". |
| Wie zählt eine Regel, die nie lief? | `firedIn: null`. `audit_stats` nennt jede Regel des Katalogs (`ALL_RULE_DEFS`), auch die, die in keinem Satz steht. | Ohne die Zeile wäre „nie gelaufen" nur durch Abgleich mit dem Katalog von Hand sichtbar. 0 hieße „lief, kein Fund" (FAQ `null-statt-null`). |
| Bleibt `consumerId`? | Es bleibt. Der Autor: raus, wenn es keiner mehr liest (2026-11-15). Geprüft am selben Tag: drei Leser. | (1) Die festen Namen der Werkzeuge trennen Buchhaltung von Modellarbeit: `aise-dispatch` 353, `verify-lane` 136, `aise-cr-close` 40 Züge. (2) graph-view-edit zeigt den Wert je Knoten als Urheber der letzten Änderung (`authorsSince`). (3) `audit_stats` und `audit_trail` filtern danach. Ungelesen ist nur das freie Etikett der Agenten (`cr-gc-857`). |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1179, Tiefe 1, Wurzeln: `FUNC-audit-stats`, `FUNC-tool-context`._

Reichweite: 12 Elemente (FLOW 8, FUNC 4); Blackbox-Rand 9, nicht geoeffnet.

Dateien (realRef, 2):
- src/surface/audit.ts
- src/surface/tool-context.ts

Tests (`graph_tests`, 13):
- tests/audit.code-state.test.ts
- tests/audit.retention.test.ts
- tests/audit.rules-passed.test.ts
- tests/audit.trail-projection.test.ts
- tests/contracts.surface.test.ts
- tests/mcp.help.test.ts
- tests/mcp.readiness.test.ts
- tests/mcp.stdio-server.test.ts
- tests/mutate.formate-ops.test.ts
- tests/mutate.schema-guard.test.ts
- tests/operations-log.integration.test.ts
- tests/testreport.test.ts
- tests/tool-contract.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
