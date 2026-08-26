# CR-DRAFT-GC-410 — Flugschreiber: „Wirkt die Arbeit?" — Zustands-Pfad im Dashboard

**Status:** DRAFT — neu geschnitten 2026-08-26 (No-Go CR-GC-407 eingearbeitet) · **Angelegt:** 2026-08-25
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

- [ ] gve rendert Karte 1 aus echten Graph-Ständen (Fixture: bekannte Commit-Serie →
      erwarteter Pfad + Referenzlinie).
- [ ] Kein zweiter Messpfad: jeder Stand über Mapper + Engine-Regeln bewertet.
- [ ] Kein Schreibpfad: Diff berührt weder trajectory.jsonl noch `recordAudit`.
- [ ] Rechenzeit der History-Messung gemessen und im CR genannt; Cache je Commit-Hash.

## Dateien (Schätzung, beim Start schneiden)

gve: Panel + Fixture-Test (eigener CR dort) · graphcode: nur falls die Stand-Bewertung
serverseitig bereitgestellt wird (History-Auswertung an der SSE-Bridge), sonst 0.
