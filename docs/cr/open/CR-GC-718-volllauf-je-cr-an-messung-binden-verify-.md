# CR-GC-718: Volllauf je CR an Messung binden: verify:full protokolliert je CR, ob ein roter Test ausserhalb der Graph-Auswahl lag (Schlupf); nach 10 CRs ohne Schlupf entfaellt der Volllauf je CR (CI + Publish bleiben). Zusage: Blackbox- und Schnittstellentests 100 % gebunden, Unit-Tests innerhalb kennt die Blackbox

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-667 (idea)
**Erstellt:** 2026-09-30
**Item:** bok/items/ITEM-2026-667.json (Lane: code)

---

## Befund

Die Regel „volle Suite vor jedem CR-Abschluss“ stand neben der Graph-Auswahl, ohne dass je gemessen
wurde, ob die Auswahl reicht. Zwei grüne Läufe nebeneinander beweisen nichts. CR-GC-714: `verify:code`
wählte 115 von 193 Testdateien, davon 39 aus dem Graphen und 76 über den direkten Import.

## Entscheid des Autors (2026-09-30)

- Der Volllauf je CR ist an eine Messung gebunden; nach **10** CRs der CODE-Spur ohne Schlupf entfällt er.
  CI und Publish fahren ihn weiter.
- **Zusage:** Die Tests aller Blackboxen und ihrer Schnittstellen sind zu 100 % gebunden. Was innerhalb
  einer Blackbox an Unit-Tests läuft, kennt die Blackbox selbst (in der Auswahl: der direkte Import).

## Umsetzung

- `src/projections/test-schlupf.ts`: `schlupfVon` (rote Dateien außerhalb der Auswahl, getrennt nach
  Graph-Anteil), `schlupfFreieFolge` (rückwärts, VOLL neutral, Schlupf bricht ab, je CR die jüngste
  Zeile), `blackboxBindung` (TESTs an REQs von MOD/SYS/FCHAIN/Wurzel-FUNC; je Vertrag an einem FLOW
  ein gebundener TEST), `SchlupfZeileSchema` (Zod, geprüft beim Schreiben und Lesen).
- `scripts/verify-full.mjs` (`npm run verify:full <CR-ID>`): Änderung = Commits mit der CR-ID +
  Arbeitsbaum; Auswahl aus `selectForChange`/`planCodeLane` (derselbe Pfad wie `verify:code`);
  Volllauf mit JSON-Reporter; Zeile nach `docs/messung/testauswahl.jsonl`; Folge `k/10`.
- `CLAUDE.md`: Zusage und Bewährungsregel in der Testdisziplin.
- Modell: `FUNC-measure-test-schlupf`, `REQ-full-run-on-probation`, `TEST-test-schlupf`,
  `FLOW-schlupf-zeile`, `SCHEMA-schlupf-zeile` (graphVersion 546).

## Grenze

Eine VOLL-Spur (ungebundene Quelldatei, `package.json` im Diff) ist kein Beleg — sie wählt ohnehin
alles; sie zählt nicht und bricht die Folge nicht. Dieser CR selbst ist VOLL (`package.json`).
