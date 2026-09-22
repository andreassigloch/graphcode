# CR-GC-587: Entscheidungs-Register + Widerspruchstest: jede Entscheidung, die als Text zum Agenten geht (Rangfolge, Probe-Regel, Freigabe-Bedingung), hat EINE Konstante; ein Test prueft Skills/GRAPHCODE.md/Vorlagen/Protokoll gegen sie (Serie 564-583: 7 Widersprueche, 4 davon Text gegen Code)

**Status:** ✅ Umgesetzt
**Typ:** aus Item ITEM-2026-436 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-436.json (Lane: graph)

---

**Reihenfolge:** zuerst — 588, 589 und 590 aendern agentenseitige Texte und sollen gegen das Register laufen.

## 1 Befund

Serie CR-GC-564 bis 583: sieben Widersprueche, die erst ein Lauf fand. Vier davon waren **Text gegen
Code** — dieselbe Entscheidung stand im Code und zusaetzlich als Freitext in Protokoll, Skill,
Vorlage oder Doku, und die Texte liefen auseinander. Die Rangfolge der Verdicts stand an vier
Stellen (`rankCandidates`, `GATE_PROTOCOL.host`, `se:generate` zweimal, alloc-Vorlage); drei waren
falsch, bis CR-GC-583 sie nachzog. Tests pruefen den Code, niemand die Texte gegen den Code.

## 2 Zielbild

- Ein **Entscheidungs-Register** (`src/loop/decisions.ts`): je agentenseitig formulierter
  Entscheidung EINE Konstante mit ihrem Wortlaut-Baustein — mindestens Verdict-Rangfolge
  (abgeleitet aus der Sortierung von `rankCandidates`), Probe-Regel (CR-GC-577),
  Freigabe-Bedingung (CR-GC-582). Protokoll und Vorlagen setzen den Baustein ein, statt ihn zu
  wiederholen.
- Ein **Widerspruchstest** (`tests/decision-texts.test.ts`): liest alle ausgelieferten Texte
  (`.claude/commands/**`, Scaffold-`GRAPHCODE.md`, `GENERATION_TEMPLATE`, `RULE_CLAUSE`,
  `GATE_PROTOCOL`) und verbietet je Entscheidung die widersprechenden Formulierungen (z.B.
  „Δm-Vergleich entscheidet“, „vergleiche tier und fitAdvisory“), verlangt den Baustein dort, wo
  die Entscheidung erwaehnt wird.

## 3 Umfang (≤ 6 Dateien)

`src/loop/decisions.ts` (neu), `src/loop/generate.ts`, `.claude/commands/se/generate.md`,
`tests/decision-texts.test.ts` (neu), dieser CR.

## 4 Kriterien

1. Rangfolge, Probe-Regel, Freigabe-Bedingung stehen je einmal; Texte setzen ein.
2. Der Test ist gegen den Stand VOR CR-GC-583 rot (Gegenprobe per `git stash`/altem Wortlaut) und heute gruen.
3. Kein Lauf noetig — reine Konsistenz.

## 5 Ergebnis (2026-09-22)

- `src/loop/decisions.ts`: `VERDICT_ORDER` (die Ordnung von `rankCandidates` als Daten),
  `DECISIONS.probe / verdictRank / handoff` mit je einem Satz und den verbotenen Formulierungen.
  Das Host-Protokoll setzt die Saetze ein; `se:generate` und `se:top-level` sind nachgezogen.
- `tests/decision-texts.test.ts`: liest alle `.claude/commands/**/*.md`, `generate.ts`,
  `executor-prompt.ts`, `scaffold-docs.ts`; verbietet die Widersprueche; pinnt `VERDICT_ORDER`
  gegen den Komparator mit zwei Kandidaten.
- **Der Test fand sofort zwei Fehler:** CR-GC-583s eigene Prosa nannte den Steuerwert VOR dem
  tier (`rankCandidates` sortiert tier vor Steuerwert — der 8. Widerspruch der Serie, von mir
  gestern gesetzt), und `se:top-level` verlangte "every batch dryRun first" gegen CR-GC-577.
  Beides korrigiert. Kriterium 2 ist damit am echten Fehler erfuellt, nicht per `git stash`.

**Kongruenz:** RC-* nicht aus dieser Session geprueft — benannte Ausnahme.