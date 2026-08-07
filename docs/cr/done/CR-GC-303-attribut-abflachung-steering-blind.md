# CR-GC-303 — Attribut-Abflachung macht den Steering-Pfad regelblind

**Status:** done · **Angelegt:** 2026-08-05 · **Geschlossen:** 2026-08-07
**Absorbiert:** [CR-GC-299](CR-GC-299-exporter-attributes-flattening.md)
(2026-08-07 geschlossen als superseded)

> ## Abschluss 2026-08-07 — die Root Cause lag eine Ebene tiefer
>
> Der Fix ist wie geplant umgesetzt (`toOntologyGraph` aus `conformance.ts` exportiert,
> `takeSteeringSnapshot` mappt direkt statt über `JSON.parse(exportGraphJson(...))`).
> Beim Grün-Machen der vollen Suite kippte aber **SRR** von 26/26 auf 24/26 mit
> `missing: [UC-05, UC-06]` — ein Fehlschlag, der den eigentlichen Defekt zeigte:
>
> **`OntologyElement` ist weder ein flacher Bag noch ein rein verschachtelter.** Das
> Schema deklariert **typisierte Top-Level-Felder** — `kinds`, `asil`, `method` —
> *neben* dem freien `attributes`-Record, und die Regeln lesen jeweils das, was das
> Schema sagt: UC-05/UC-06 lesen `e.kinds?.includes(…)` **top-level**, R-19/R-20/
> AF-01..05 lesen aus `attributes`. graphcode legt alles in *einen* `node.attributes`-Bag.
>
> Damit war **jeder** der beiden Mapper unvollständig, nicht nur einer:
>
> | Pfad | Encoding | funktioniert | blind |
> |---|---|---|---|
> | Export-Roundtrip (Steering, vorher) | alles flach | UC-05/06 | R-19/R-20/VR-01/AF-01..05 |
> | `toOntologyGraph` (Conformance, seit je) | alles verschachtelt | R-19/R-20/AF | **UC-05/UC-06** |
>
> Der naive Umbau hätte den Fehler also nur umgedreht. `toOntologyGraph` **hebt** die
> drei typisierten Felder jetzt aus dem Bag heraus **und behält den Bag** — die einzige
> Abbildung, die beide Regel-Stile bedient, weil sie genau das ist, was das Schema
> als OntologyElement definiert.
>
> **Nebenbefund, mitgefixt:** UC-05/UC-06 waren dadurch auf dem **Conformance-Pfad**
> seit jeher still deaktiviert — nie aufgefallen, weil die Generate-Tests den anderen
> Pfad benutzten. Ein Beispiel für den Grund, zwei Encodings nicht nebeneinander zu
> führen.
>
> **Ergebnis:** PDR ist aus **Modellinhalt** erreichbar statt vom Encoding blockiert
> (`tests/generate.test.ts`: die Known-Gap-Erwartung `missing: [AF-01, AF-02, AF-03]`
> ist ersatzlos weg, das Fixture trägt jetzt echte Stamps und deckt PDR voll ab; das
> aktuelle offene Gate ist CDR — aus fehlendem Inhalt, nicht aus Encoding).
> `npm run build` grün, **73 Testdateien / 480 Tests grün**.
>
> **Neu:** `tests/steering-snapshot.test.ts` (8 Tests) — die Reproduktion war vor dem
> Fix rot mit exakt den 8 dauerfeuernden Regeln, plus zwei Gegenrichtungs-Tests
> (eine *fehlende* Bindung muss weiterhin gemeldet werden; `exportGraphJson` bleibt
> byte-identisch).

> **Übernommen aus CR-GC-299** — CR-299 beschrieb denselben Defekt einen Tag früher, bot
> aber als Option 1 an, `exportGraphJson` das Flattening abzugewöhnen. Das ist hier
> bewusst verworfen (der Export-Encoding ist committete SSOT-/Format-E-Konvention). Zwei
> Punkte aus CR-299 gelten trotzdem und sind unten in Scope + AC eingearbeitet:
>
> 1. **R-20 ist mitbetroffen** (`realRef`/`codeRef`), nicht nur R-19/VR-01/SC-04/AF-01..05.
> 2. **`graph_readiness` muss unverändert bleiben** — der L2-Pfad
>    (`harness.evaluateRules()`) liest direkt vom Graph und war nie betroffen. Ein
>    Ergebnis-Shift dort wäre eine Regression, kein Fortschritt.

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
- [ ] **R-20 mit im Beweis** (aus CR-GC-299): FUNC mit `realRef`/`codeRef` → R-20
      still über denselben Pfad. R-19 allein zu prüfen ließe die zweite
      Bindungsregel ungetestet durchrutschen
- [ ] **`graph_readiness` unverändert** (aus CR-GC-299): Regressionstest, dass der
      L2-Pfad (`harness.evaluateRules()`) vor und nach dem Fix dasselbe Ergebnis
      liefert — er war nie betroffen, ein Shift dort wäre eine Regression
- [ ] `exportGraphJson`-Output byte-identisch zu vorher (kein Encoding-Change)
- [ ] Known-Gap-Kommentare in tests/generate.test.ts entfernt, kein
      dauerhaft-offenes Gate mehr durch Encoding statt Modell-Inhalt
- [ ] `npm test && npm run build` grün

## Kontext

Gefunden 2026-08-05 beim contracts-3.1.0-Bump (AF-Regeln machten die Lücke von
CDR/TRR-Randfall zu PDR-Blocker). Zusammenhang: CR-GC-302 (Auto-SYS-Anker),
Stamp-Writer-Folge-Punkt in den Analyse-Skills (claude-plugin).
