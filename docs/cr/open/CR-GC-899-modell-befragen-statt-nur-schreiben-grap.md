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
