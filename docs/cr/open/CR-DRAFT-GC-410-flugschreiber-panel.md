# CR-DRAFT-GC-410 — Flugschreiber: Spiderweb + Konvergenz-Zeuge im Dashboard

**Status:** DRAFT — **CR-GC-407: No-Go (2026-08-25)**, Teil 1 entfällt, vor Start neu schneiden · **Angelegt:** 2026-08-25
**Herkunft:** Dashboard-Review 2026-08-25 („die Arbeit des Autopilot sichtbar machen —
Kernfeature, ich kann es weder sehen noch beweisen")
**Mockup:** https://claude.ai/code/artifact/fadb2183-75ec-47ae-a72c-d0d0c1dd5e5c

## Problem

Das Scoreboard (gve CR-GVE-257) zeigt, DASS der Autopilot arbeitet — aus der vorhandenen
trajectory.jsonl. Ob die Arbeit **Fortschritt** ist (Optimierung vs. Kreisverkehr) und
**wohin** sie zieht (Gummiband Richtung Zielprofil), ist weiterhin unsichtbar: die Trajektorie
trägt keinen Zustands-Messwert je Mutation — alles rechnet quer (Zustand vs. Zustand),
nichts längs (CR-GC-407 §4).

## Änderung (zwei Teile, ein Schnitt)

1. **Stempel je applied Mutation** in trajectory.jsonl: die 8 `dimension_readiness`-Scores
   + der skalarisierte ℝ⁶-Zeuge `w·m(G)` (target-profile-Gewichte, leer ⇒ Gleichgewichtung)
   + Export-Hash für das Zustands-Archiv. Berechnung ausschließlich über den vorhandenen
   Mapper/Snapshot-Pfad (`toOntologyGraph` + se-engine `metrics` — kein zweiter Messpfad,
   CR-GC-303/324-Lehre). Erweiterung in `recordAudit`/Trajectory-Projektion.
2. **gve-Panel** (Folge im gve-Repo): Spiderweb der 8 Dimensionen — Ist (live), Session-Start
   (aus dem ersten Stempel der Session), Ziel-Ring — plus Zeugen-Linie über den Mutationen
   mit Plateau-/Wiederbesuch-Markierung. Layout nach Mockup.

## Warum gated

Der Spike CR-GC-407 validiert genau diesen Zeugen (Trennschärfe, Totzone, Fehlalarm).
Vor dem Spike-Ergebnis wäre der Stempel eine ungeprüfte 7. Metrik-Dimension — bei No-Go
entfällt Teil 1, und das Spiderweb bleibt auf Live-Ist ohne Verlauf (dann neu schneiden).

**Spike-Ergebnis (2026-08-25): No-Go.** Totzone 100 % — der ℝ⁶-Zeuge w·m(G) bewegt sich auf
16/16 realen Violation-schließenden Mutationen nicht (verify/satisfy liegen außerhalb layer
'arch'); echte Konvergenz ist vom Stillstand ununterscheidbar (CR-GC-407 §Ergebnis). Damit gilt
der No-Go-Fall: **Teil 1 (Zeugen-/Hash-Stempel je Mutation) entfällt; das Spiderweb zeigt nur
Live-Ist ohne Verlauf.** Der CR ist vor dem Start auf diesen Schnitt zu reduzieren (Teil 2 ohne
Zeugen-Linie/Wiederbesuch-Markierung; Start-Ring nur, wenn er ohne Stempel aus einer anderen
Quelle kommt). Nebenbefund aus dem Spike, falls je ein Verlaufs-Stempel neu erwogen wird: das
Zustands-Archiv (Export-Hash) allein war zuverlässig (Zyklus erkannt, null Fehlalarme); ein
tragfähiger Fortschritts-Zeuge bräuchte eine andere Messgröße als m(G, layer 'arch') — das wäre
ein neuer Spike, nicht dieser CR.

## Akzeptanzkriterien (bei Go zu präzisieren)

- [ ] Jede applied Mutation stempelt Dimension-Scores + Zeuge + Hash; raw-mutate-Pfad ohne
      Feed bleibt dokumentierte Lücke (CR-GC-252-Verhalten).
- [ ] Kein zweiter Messpfad (Diff berührt keine eigene Metrik-Berechnung).
- [ ] gve zeichnet Start-Ring und Zeugen-Linie aus echten Stempeln (Fixture-Test).
- [ ] Mehraufwand pro mutate gemessen und im CR genannt.

## Dateien (Schätzung, bei Go schneiden)

graphcode: Trajectory-Schema/`recordAudit` + Test · gve: Panel + Test (eigener CR dort).
