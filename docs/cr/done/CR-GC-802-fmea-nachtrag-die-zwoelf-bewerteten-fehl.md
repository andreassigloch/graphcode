# CR-GC-802: FMEA-Nachtrag: die zwoelf bewerteten Fehlerarten als Risiken ins Modell

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-874 (idea)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-874.json (Lane: graph)

**Freigabe:** Autor, 2026-10-12 („GO"). Nachtrag zu den Analysen CR-GC-779, CR-GC-795 und CR-GC-798.

---

## Anlass

Die drei Analysen bewerteten 20 Fehlerarten und schrieben sieben als Risiko ins Modell. Die übrigen
standen mit Bewertung und Begründung nur im Text der Analyse-CRs. Entscheidung des Autors: Was eine
Bewertung trägt, gehört ins Modell; ein Risiko mit S/O/D genügt, die Ontologie bleibt unverändert.

## Geschrieben (graphVersion 737 auf 739)

Zwölf Risiken. FM-09 (Fehlerzahl aus zwei Katalogen) ist nicht dabei: am Code als nicht bestehend
widerlegt (CR-GC-795).

| FM | Risiko | S/O/D | Gegenmaßnahme | Nachweis |
|---|---|---|---|---|
| 02 | `REQ-risk-stale-measurement` | 7/3/6 | `REQ-single-measurement-path` (Bestand) | `TEST-single-measurement-path` |
| 13 | `REQ-risk-partial-store-after-reseed` | 6/2/3 | `REQ-export-no-clobber` (Bestand) | `TEST-export-graph-guard` |
| 15 | `REQ-risk-audit-evaluation-unowned` | 5/3/6 | `REQ-audit-trail` (Bestand) | `TEST-audit-trail-projection` |
| 16 | `REQ-risk-auto-export-fails-silently` | 4/3/4 | `REQ-graph-snapshot-per-commit` (Bestand) | `TEST-auto-export` |
| 18 | `REQ-risk-edge-vanishes-silently` | 7/2/3 | `REQ-held-back-traces-named` (Bestand) | `TEST-import-rejected-traces` |
| 19 | `REQ-risk-owner-ends-with-docked-sessions` | 7/2/3 | `REQ-store-owner-lifecycle` (Bestand) | `TEST-host-shim` |
| 20 | `REQ-risk-selection-misses-red-test` | 7/3/3 | `REQ-full-run-on-probation` (Bestand) | `TEST-test-schlupf` |
| 06 | `REQ-risk-measurement-vector-contract-unbound` | 6/3/7 | `REQ-measurement-vector-contract-tested` (neu, an `FUNC-take-steering-snapshot`) | `TEST-measurement-vector-contract` (ungebunden) |
| 07 | `REQ-risk-steering-delta-missing` | 5/3/5 | `REQ-steering-delta-in-answer-tested` (neu, an `FUNC-compute-steering-delta`) | `TEST-steering-delta-in-answer` (ungebunden) |
| 10 | `REQ-risk-stage-name-free-text` | 5/3/6 | `REQ-stage-names-enumerated` (neu, an `FUNC-take-steering-snapshot`) | `TEST-stage-names-enumerated` (ungebunden) |
| 14 | `REQ-risk-client-holds-stale-tool-list` | 4/3/6 | keine (gelassen, ITEM-2026-862) | `TEST-tool-list-change-announced` (ungebunden) |
| 17 | `REQ-risk-skill-instructs-rejected-move` | 4/4/2 | keine (gelassen, ITEM-2026-856) | `TEST-skill-moves-are-legal` (ungebunden) |

- Die sieben bestehenden Zusagen tragen jetzt `role: mitigation`; Wortlaut, Art und Erfüller sind unverändert.
- Die Entscheidung je Fehlerart steht im Feld `rationale` des Risikos.
- **Urteil des Skills, nicht des Autors:** die drei neuen Gegenmaßnahmen und ihre Träger (FM-06, 07, 10).
- Jede Anforderung braucht einen Test (R-01); für die zwei gelassenen Risiken steht deshalb je ein
  ungebundener Test, der sagt, was ein Nachweis wäre.
- Stempel der Analyse am System: `fmea` auf graphVersion 738.

## Stand des Modells danach

- 19 Risiken, 8 mit hoher Priorität, 8 verifiziert, 2 Gegenmaßnahmen ohne Funktion (`docs/views/fmea.md`).
- Der Katalog meldet: FM-02 an den zwei gelassenen Risiken (kein Gegenmaßnahme, so gewollt), FM-03 an
  sechs Risiken mit hoher Priorität ohne bestandenen Nachweis.
- **Die Fläche wächst von 5 auf 30 Funktionen.** Ursache sind bestehende Zusagen, die an einem Modul
  oder einer Kette hängen (`REQ-single-measurement-path` und `REQ-export-no-clobber` an
  `MOD-projections`, `REQ-graph-snapshot-per-commit` an `FCHAIN-snapshot-freshness`), und zwei Zusagen mit
  vier und fünf Erfüllern. Arbeit für `se-vorbereitung`: ITEM-2026-875.

## Sicht

`renderFmea` nennt in der Übersicht bis zu drei Träger beim Namen, darüber die Zahl; die Liste steht im
Abschnitt des Risikos. Test: `tests/view-fmea.test.ts`, ein Fall dazu.

## Verifikation

`npm run verify:full CR-GC-802`: 190 Dateien, 1597 Tests grün, Schlupf 0; 138 Ergebnisse zurückgemeldet.
