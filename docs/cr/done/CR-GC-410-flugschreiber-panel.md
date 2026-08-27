# CR-GC-410 — Flugschreiber: „Wirkt die Arbeit?" — Zustands-Pfad im Dashboard

**Status:** DONE 2026-08-27 — umgesetzt als gve-Karte (graph-view-edit `beed9f6`,
`feat: wirkt-die-arbeit karte (CR-GC-410)`); graphcode-seitig 0 Dateien (Auswertung
läuft komplett in gves vite.config.js, kein Bridge-Anteil nötig) ·
**Angelegt:** 2026-08-25 · neu geschnitten 2026-08-26 (No-Go CR-GC-407 eingearbeitet)
**Herkunft:** Dashboard-Review 2026-08-25 („die Arbeit des Autopilot sichtbar machen —
Kernfeature, ich kann es weder sehen noch beweisen")
**Entwurf (final, Karte 1):** https://claude.ai/code/artifact/e555fc68-f3de-412c-96d1-4d807131f1fa
**Mockup (alt, überholt durch No-Go):** https://claude.ai/code/artifact/fadb2183-75ec-47ae-a72c-d0d0c1dd5e5c

## Problem

Das Scoreboard (gve CR-GVE-257) zeigt, DASS der Autopilot arbeitet — aus der vorhandenen
trajectory.jsonl. Ob die Arbeit **Fortschritt** ist (Optimierung vs. Kreisverkehr) und
**wohin** sie zieht (Gummiband Richtung Zielprofil), ist weiterhin unsichtbar: die Trajektorie
trägt keinen Zustands-Messwert je Mutation — alles rechnet quer (Zustand vs. Zustand),
nichts längs (CR-GC-407 §4).

## Änderung (Neuschnitt 2026-08-26 nach No-Go)

Kein Stempel je Mutation, kein ℝ⁶-Zeuge, kein Spiderweb-Verlauf. Stattdessen die Quer-Messung,
die der Spike als zuverlässig auswies (Zustands-Archiv): **Karte „Wirkt die Arbeit?"** im
gve-Dashboard, Layout nach Entwurf (Karte 1):

- **Pfad in Commit-Reihenfolge:** je exportiertem Graph-Stand (Git-History von
  `docs/graph/*.graph.json`, heute 73 Stände) Elemente gegen offene Regelverstöße; nach rechts
  = gebaut, nach unten = gebunden. Referenzlinie „wenn jedes neue Element seine Verstöße
  mitbrächte".
- **Bewertung je Stand über den vorhandenen Messpfad** (Mapper + Engine-Regeln — kein zweiter
  Messpfad, CR-GC-303/324-Lehre); Ergebnis je Commit-Hash cachebar, da Stände unveränderlich.
- **Sekundärbefund:** error-freie Stände als Gate-Wirkungs-Nachweis („23 der letzten 24 ohne
  error").

Reine Lese-/Render-Funktion: trajectory.jsonl und `recordAudit` bleiben unberührt. Das
Spiderweb entfällt; „Wo steht die Architektur?" (Karte 2 des Entwurfs) läuft unter
CR-DRAFT-GC-433, nicht hier.

## Historie: warum der ursprüngliche Schnitt fiel

Der Spike CR-GC-407 sollte den ℝ⁶-Zeugen validieren (Trennschärfe, Totzone, Fehlalarm).
**Ergebnis (2026-08-25): No-Go.** Totzone 100 % — w·m(G) bewegt sich auf 16/16 realen
Violation-schließenden Mutationen nicht (verify/satisfy liegen außerhalb layer 'arch'); echte
Konvergenz ist vom Stillstand ununterscheidbar (CR-GC-407 §Ergebnis). Nebenbefund, der den
Neuschnitt trägt: das Zustands-Archiv (Export-Hash) allein war zuverlässig — Zyklus erkannt,
null Fehlalarme. Ein Längs-Zeuge bräuchte eine andere Messgröße; das wäre ein neuer Spike,
nicht dieser CR.

## Akzeptanzkriterien

- [x] gve rendert Karte 1 aus echten Graph-Ständen (Fixture: bekannte Commit-Serie →
      erwarteter Pfad + Referenzlinie). — `tests/vite-config-flightrecorder.test.mjs`
      (Wegwerf-Git-Repo, 3 committete Stände) + `tests/dashboard-flightrecorder.test.mjs`
      (jsdom-Render: Pfadpunkte, Referenzlinie, Sekundärbefund); Pixel-Verifikation
      per Screenshot gegen den graphcode-Graphen (78 Stände, Pfad + Endspurt sichtbar).
- [x] Kein zweiter Messpfad: jeder Stand über `fromOntologyGraph` +
      `DefaultRuleEngine(SE_DESCRIPTOR)` — dieselbe `createRuleEngine()`-Konstruktion,
      die auch der Live-Stand (buildDashboard) nutzt; die Test-Erwartungen sind aus
      derselben Referenz gerechnet, nicht hart codiert.
- [x] Kein Schreibpfad: reine `git log`/`git show`-Lesung; trajectory.jsonl und
      `recordAudit` unberührt (Diff: vite.config.js, Dashboard.jsx, dashboard.css,
      2 Testdateien).
- [x] Rechenzeit gemessen: **graphcode, 78 Stände, kalt ≈ 3,1 s (~40 ms/Stand);
      warm (Cache je Commit-Hash) ≈ 70 ms** — nur `git log`, 78/78 aus dem Cache.
      Wegen der kalten Sekunden eigener Endpoint `GET /api/flightrecorder` statt
      Huckepack auf `/api/dashboard`; die Karte zeigt die Messwerte selbst an.

## Ergebnis (2026-08-27)

Karte „Wirkt die Arbeit?" im gve-Dashboard: Pfad über 78 committete Stände
(nach rechts = gebaut, nach unten = gebunden), gestrichelte Referenzlinie
(Verstoß-Dichte des ersten Standes, graphcode: 1,12 Verstöße/Element),
Endstand 691 Elemente / 30 offene Verstöße (1 error). Sekundärbefund ehrlich:
**0 der letzten 24 Stände ohne error** — der Gate-Wirkungs-Nachweis aus dem
CR-Beispiel („23 von 24") ist am echten Repo (noch) nicht erreicht. Nicht
messbare Stände werden übersprungen und angesagt, nie als 0 gezeichnet
(CR-GC-326-Regel). graphcode-Anteil: 0 Dateien.
