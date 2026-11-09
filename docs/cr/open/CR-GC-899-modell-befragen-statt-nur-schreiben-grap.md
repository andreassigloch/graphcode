# CR-GC-899: Modell befragen statt nur schreiben: graph_tests vor jedem Testlauf, se-retro misst Fragen zu Schreibzügen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1276 (finding)
**Erstellt:** 2026-11-09
**Item:** bok/items/ITEM-2026-1276.json (Lane: code)

---

Befund aus immo-infra, Bauphase 2026-11-04 17:42..11-09: Das Modell wurde geschrieben, aber kaum befragt. 124 graph_mutate stehen 31 Fragen gegenüber (graph_tests 11, graph_context 17, graph_impact 3). Gleichzeitig 167 Züge mit Testläufen (11,3 % der Token) und 287 Züge Ausrollen/Tests auf dem VPS (18,3 %). Der Nutzer hatte am 2026-11-04 ausdrücklich verlangt, den Graph zur Verringerung der Testläufe zu nutzen.

Root Cause: Nichts im Ablauf führt vor einem Testlauf zu graph_tests. GRAPHCODE.md nennt das Werkzeug in der Tabelle „Ask the graph“, aber die Sitzung startete die Suite oder einzelne Dateien nach eigenem Ermessen. se-retro misst das Verhältnis nicht, also fällt es nicht auf.

## Änderung
1. GRAPHCODE.md-Vorlage (`src/surface/scaffold-templates.ts`) und se-plan §7 (Prosa des CR): vor jedem Testlauf `graph_tests({changeSet})`; gefahren werden die dort genannten Tests, die volle Suite nur vor dem Abschluss eines CR.
2. Optional im Host: `graph_tests` liefert den fertigen Befehl (z. B. `npx vitest run <dateien>`), damit der Agent ihn ohne Umweg ausführt.
3. se-retro: neue Kennzahl „Modell befragt“ — Verhältnis Fragen (graph_tests, graph_context, graph_impact, graph_expand) zu Schreibzügen (graph_mutate), und Anteil der Testläufe, denen ein graph_tests vorausging.

## Akzeptanzkriterien
- Vorlage und se-plan nennen die Regel; Scaffold-Test prüft sie.
- se-retro meldet beide Kennzahlen für immo-infra mit den Werten dieses Befunds als Ausgangswert (31:124, Anteil Testläufe mit graph_tests).

---

## Umfang laut Modell

- Schnitt bei `dispatch prepare` (unten): `FUNC-select-tests`, `FUNC-se-retro`. Dazu `FUNC-harness-cli`
  (GRAPHCODE.md-Vorlage) und `FUNC-se-plan` (§7).
- `REQ-modell-befragen` (neu, unter `UC-loop-closure`), verify durch `TEST-sitzung-kpi`.

## Ergebnis

- Punkt 1: GRAPHCODE.md „Which tests to run" — vor jedem Testlauf den Graphen nach der Auswahl der
  Aenderung fragen und genau diese fahren (ohne Werkzeugnamen, CR-GC-612; Vorlage 5.874 Zeichen).
  se-plan Version 10, §7: vor jedem Testlauf `graph_tests({changeSet})`, die genannten Tests, die volle
  Suite nur vor dem Abschluss des CR.
- Punkt 2 war schon erfuellt: `graph_tests` gibt den fertigen `vitest run`-Befehl aus (Werkzeugbeschreibung,
  `tests/mcp.tests-operational.test.ts`). Keine Aenderung am Host.
- Punkt 3: `modellBefragt()` in `scripts/retro-kpi.mjs` — Fragen (graph_tests, graph_context, graph_impact,
  graph_expand) zu Schreibzuegen (graph_mutate), Testlaeufe (`npm test`, `npx vitest run`,
  `npm run verify:code|full`) und der Anteil mit graph_tests seit dem vorigen Lauf; `verify:code` zaehlt
  als befragt. Text in einem Heredoc zaehlt nicht als Lauf. se-retro Version 5 nennt die Kennzahl.
- Test: 3 neue Faelle in `tests/sitzung-kpi.test.ts`; gegen den alten Code alle 3 rot.
- Ausgangswert immo-infra, groesste Sitzung ueber ihre ganze Dauer: 57 Fragen zu 240 Schreibzuegen,
  10 von 270 Testlaeufen mit Auswahl (4 %). Der Befund (31:124) zaehlte nur die Bauphase ab 2026-11-04.
  Grenze: Tests, die ueber ssh auf dem VPS laufen, erkennt die Zaehlung nicht als Testlauf.

- `verify:full CR-GC-899`: 1735/1735 gruen (211 Dateien), Schlupf 0.

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1006, Tiefe 1, Wurzeln: `FUNC-select-tests`, `FUNC-se-retro`._

Reichweite: 7 Elemente (FLOW 3, FUNC 4); Blackbox-Rand 5, nicht geoeffnet.

Dateien (realRef, 2):
- .claude/commands/se-retro.md
- src/kernel/measure/test-selection.ts

Tests (`graph_tests`, 4):
- tests/mcp.tests-operational.test.ts
- tests/mvp-e2e.test.ts
- tests/skill-report-measured.test.ts
- tests/test-selection.audit.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
