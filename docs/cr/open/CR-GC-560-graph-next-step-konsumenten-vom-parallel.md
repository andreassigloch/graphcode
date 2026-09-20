# CR-GC-560: Die Konsumenten vom zweiten Steuerungspfad lösen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-380 (idea)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-380.json (Lane: graph)

---

## 1 Befund

`graph_next_step` und `graph_generate` sind zwei Steuerungswerkzeuge auf **einer**
Messung. Der Snapshot ist geteilt (CR-GC-324 hat die doppelte Graph-Abbildung schon
beseitigt), die Rangwahl darüber ist es nicht:

```
.filter(s => s.applicable > 0 && s.violations > 0)
.sort((a,b) => (a.score ?? -1) - (b.score ?? -1) || b.violations - a.violations)
```

steht wörtlich in `steering.ts` und in `generate.ts`. Dazu zwei Textsätze je Dimension —
`DIMENSION_ACTION` gegen `GENERATION_TEMPLATE`, im Quelltext selbst als
„die Schreib-Zwillinge der `graph_next_step`-Aktionen" bezeichnet.

`graph_generate` ist die Obermenge: Phasen, Fund-Fenster, defer-Rotation, Fokus-Typen,
Fokus-Dimension, Gate-Protokoll, Regel-Klauseln. `graph_next_step` hat genau zwei eigene
Felder — `advisory` und `blocking.ruleIds` — und **beide haben keinen Konsumenten**.
Sie werden nicht übernommen, sie fallen weg; ein Feld ohne Leser ist kein Vertrag.

Gemessen an der Wirkung: die drei Kaltstart-Stufen aus CR-GC-559 stehen nur in
`graph_generate`. Der Pfad, auf den der `claude -p`-Arm des Rigs zeigt, kennt sie nicht.

## 2 Zielbild

Dieses CR ist der **erste von drei** Schritten und ändert das Produkt noch nicht: es löst
die Konsumenten, damit der eigentliche Löschzug (CR-GC-561/562) keinen roten
Zwischenstand erzeugt.

- Der Rig-Prompt des Claude-Arms zeigt auf `graph_generate` statt `graph_next_step` —
  damit misst das Rig denselben Steuerungspfad wie der Executor.
- `se:optimize` verweist nicht mehr auf ein Werkzeug, das verschwindet.
- Die zwei Tests, die `graph_next_step` nur als Vehikel benutzen, benutzen ein anderes.
- Die Invariante „EINE Rechnung, nicht zwei" bleibt geprüft — jetzt zwischen
  `graph_generate` und `graph_readiness`, wo sie nach dem Schnitt hingehört.

## 3 Umfang

- `rig/greenfield-systemtest/run.mjs` — `buildPrompt()` auf `graph_generate`
- `rig/greenfield-systemtest/driver.mjs` — Kommentar + `withheld`-Menge
- `.claude/commands/se/optimize.md` — Verweis
- `tests/mcp.readiness.test.ts` — Invariante gegen `graph_generate`
- `tests/trajectory-stamps.test.ts` — anderes Read-Tool als Vehikel

Fünf Dateien.

## 4 Abnahme

1. Der Rig-Prompt nennt `graph_next_step` nicht mehr.
2. Die Invariante „eine Rechnung": die Readiness-Scores aus `graph_generate` sind
   dieselben wie `dimension_readiness` aus `graph_readiness` — gleicher Snapshot.
3. `consultedTools` wird weiter belegt, ohne `graph_next_step`.
4. Suite grün.

## 5 Was bewusst offen bleibt

Das Werkzeug existiert nach diesem CR noch. Es zu entfernen ist CR-GC-561 (Registry),
es zu löschen CR-GC-562 (`src/loop/steering.ts`). Drei Schritte, weil eine Löschung über
zwölf Dateien sich nicht unter die 6-Dateien-Grenze teilen lässt, ohne einen roten
Zwischenstand zu hinterlassen — und der wäre schlimmer als der dritte Commit.
