# CR-GC-303 — Attribut-Abflachung macht den Steering-Pfad regelblind

**Status:** open · **Angelegt:** 2026-08-05

## Problem

graphcode hat **zwei** Regel-Eval-Pfade mit unterschiedlicher Attribut-Sicht:

1. **Harness/Readiness-Pfad** (`conformance.ts` → `toOntologyGraph`): mappt
   `element.attributes = node.attributes` — Regeln sehen `attributes.testRef`,
   `attributes.analysisFreshness` etc. korrekt.
2. **Steering-/Generate-Pfad** (`steering-snapshot.ts` → `takeSteeringSnapshot`):
   baut den OntologyGraph über den Umweg `JSON.parse(exportGraphJson(graph))`.
   `exportGraphJson` flacht `node.attributes` per Konvention (CR-216/228) auf
   **Top-Level** ab — `element.attributes` existiert dort nicht.

Contracts-Regeln lesen `element.attributes?.x` (rules.ts). Im Steering-Pfad sind
damit **R-19, VR-01, SC-04 und seit contracts 3.1.0 AF-01..05 dauerhaft blind
bzw. dauerhaft feuernd**: gesetzte testRef/analysisFreshness-Werte werden nie
gesehen. Konkrete Folgen:

- `graph_generate` kann PDR/CDR/TRR nie regel-vollständig erreichen (Handoff-
  Gating), egal was im Graph steht — dokumentierte Known-Gap in
  `tests/generate.test.ts` (PDR trägt AF-01..03 als akzeptierte Lücke).
- `graph_suggest`/dryRun-`steeringDelta` bewerten Kandidaten gegen einen
  verfälschten Readiness-Raum (AF-Dimension immer offen).

### Architektur-Entscheidung (Vorschlag)

**Der Export-Encoding bleibt unangetastet** (committete SSOT-Konvention, Format-E-/
Roundtrip-/Consumer-sensibel). Der Bug ist, das *Export-Encoding als Rule-Eval-
Input* zu benutzen. Fix: `takeSteeringSnapshot` baut den OntologyGraph **direkt
aus dem Graph** über dieselbe Abbildung wie der Harness-Pfad —
`toOntologyGraph` aus `conformance.ts` exportieren und wiederverwenden
(ein Mapper, kein Parallelpfad, kein Serialisierungs-Umweg).

## Scope (≤ 6 Dateien)

1. `src/conformance.ts` — `toOntologyGraph` exportieren (bisher modul-privat)
2. `src/steering-snapshot.ts` — `JSON.parse(exportGraphJson(...))` durch
   `toOntologyGraph(graph)` ersetzen; ND-Injektion/`computeReadiness` prüfen
   (erwarten beide nur die OntologyGraph-Shape)
3. `tests/generate.test.ts` — Known-Gap-Kommentar + AF-01..03-Ausnahme
   entfernen: PDR mit gestampter Fixture wieder `missing: []`; Handoff-Test
   für CDR/TRR-Erreichbarkeit nachziehen
4. `tests/executor.bestofn.test.ts` — Fokus-/Total-Pins neu messen (Readiness-
   Raum ändert sich, Semantik der Assertions bleibt)
5. ggf. `tests/steering*.test.ts` — Snapshot-Erwartungen

## Akzeptanzkriterien

- [ ] `takeSteeringSnapshot(graph)`: Regeln sehen `element.attributes.x`
      (Beweis: SYS mit `analysisFreshness`-Stamps → AF-01..05 still; TEST mit
      `testRef` → R-19 still) — Unit-Test, der die Blindheit vorher reproduziert
- [ ] `exportGraphJson`-Output byte-identisch zu vorher (kein Encoding-Change)
- [ ] Known-Gap-Kommentare in tests/generate.test.ts entfernt, kein
      dauerhaft-offenes Gate mehr durch Encoding statt Modell-Inhalt
- [ ] `npm test && npm run build` grün

## Kontext

Gefunden 2026-08-05 beim contracts-3.1.0-Bump (AF-Regeln machten die Lücke von
CDR/TRR-Randfall zu PDR-Blocker). Zusammenhang: CR-GC-302 (Auto-SYS-Anker),
Stamp-Writer-Folge-Punkt in den Analyse-Skills (claude-plugin).
