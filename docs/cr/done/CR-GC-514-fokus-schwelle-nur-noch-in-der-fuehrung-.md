# CR-GC-514: Fokus-Schwelle nur noch in der Führung (ready-Folge)

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-061 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-061.json (Lane: code)
**Voraussetzung:** sigloch-modules CR-SM-310 (`computeReadiness` ohne Schwelle, `ReadinessScore` ohne `ready`)

---

## Befund

`takeSteeringSnapshot` und `nextStep` nahmen die Fokus-Schwelle nur, um sie an `computeReadiness`
durchzureichen, das daraus `ready` bildete. Das Urteil „zu schwach" fällt aber in der Führung:
`generationStep` (`generate.ts`, `belowThreshold`) vergleicht selbst. Zwei Tests riefen den Snapshot
schon mit zwei Argumenten (`steering-snapshot.test.ts`, `harness.import-sys-anchor.test.ts`) — dort
war `ready` stets falsch, ohne dass es jemand bemerkte. Der Tool-Text von `graph_readiness` nannte
`ready` eine „contracts threshold, not a graphcode policy"; es war die Fokus-Schwelle aus der Config.

## Umsetzung

| Datei | Änderung |
|---|---|
| `src/kernel/measure/steering-snapshot.ts` | `takeSteeringSnapshot(graph, policy)` |
| `src/loop/steering.ts` | `nextStep(graph, policy)` |
| `src/projections/report.ts` | beide Aufrufe; `dimension_readiness` ohne `ready`; Tool-Text korrigiert |
| `src/surface/write.ts` | beide Snapshot-Aufrufe im dryRun-Zweig |
| `src/loop/generate.ts` | Snapshot ohne Schwelle; das Urteil `belowThreshold` bleibt hier |
| Modell (Gate, v263) | `SCHEMA-readiness-report` ohne `ready`; `REQ-thresholds-from-config`: die Fokus-Schwelle verschiebt das Fokus-Urteil, nicht die Messung |

Mechanischer Nachzug in Tests (Argument entfällt): `evaluation.near-duplicate`, `steering.measurement-path`,
`steering`, `steering-snapshot`. Inhaltlich geändert: `mcp.readiness` (Ergebnis trägt kein `ready`) und
`steering.steer-causality` (die Schwelle lässt Funde UND Scores unverändert und kommt nur im Fokus-Urteil
an; dass das Urteil mit ihr kippt, belegt `generate.test.ts` am realen Fixture mit Schwelle 0).

## Verifikation

- Build grün; betroffene Testdateien 61/61 und `steering.steer-causality`.
- Type-Check und Lint grün; volle Suite 1092/1092.
- Kongruenz: rules_evaluate nach dem Zug — RC-01/02/03/05/06 still, RC-04 unverändert 5 (Altbestand, ITEM-2026-057), importCoverage 88/89.
