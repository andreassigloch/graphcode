# CR-GC-394 — Drei Verhaltensweisen waren gebaut, getestet und nie gefordert

**Status:** done 2026-08-22 · **Angelegt:** 2026-08-22 · **Basis:** graphVersion 171 → **175**
**Umsetzung:** dieses Repo (reine Modellarbeit durchs Gate, kein Code)
**Herkunft:** Folgebefund aus CR-GC-393

## Problem

Beim Modellieren des Executors meldeten drei neue FUNC sofort `R-02` — sie erfüllen keine
Anforderung. Die Prüfung ergab: es gibt keine. Rundeninjektion (CR-GC-285/291/293), Prosa-Recovery
(CR-GC-280/320) und Near-Duplicate-Erkennung (CR-GC-287) sind gebaut, laufen produktiv und sind mit
benannten Testfällen abgesichert — aber niemand hat je geschrieben, was sie leisten sollen.

Die naheliegende Abkürzung wäre eine `satisfy`-Kante auf `REQ-small-model-viable` gewesen. Die passt
nicht: jene REQ fordert *deterministische, modellfreie Gates und Query-Precision*, nicht die
Zubereitung eines Prompts. Eine Kante dorthin hätte die Zahl gesenkt und die Aussage verfälscht.

## Änderung

Drei REQ, jede nach der REQ-with-test-Invariante in einem Gate-Batch mit ihrer Abnahme und ihrem
Erfüller:

| REQ | verifiziert durch | erfüllt von | unter UC |
|---|---|---|---|
| `REQ-round-prompt-injection` | `TEST-one-driver-local-and-frontier` | `FUNC-build-round-injection` | `UC-reduced-llm` |
| `REQ-prose-recovery` | `TEST-one-driver-local-and-frontier` | `FUNC-extract-mutate` | `UC-reduced-llm` |
| `REQ-near-duplicate-detection` | `TEST-nd-similarity` | `FUNC-nd-similarity` | `UC-deterministic-steering` |

Jede Formulierung ist an einem existierenden, benannten Testfall entlang geschrieben und damit
falsifizierbar — Budget-Filterung des Index (`executor.test.ts:601`), Abschaltbarkeit der Injektion
(`:573`), Reparatur statt stillem Verwerfen (`:224`), ND meldet genau das Duplikat-Paar und ohne
Injektion nichts (`nd-similarity.test.ts:97/106`).

## Warum keine neuen TEST-Knoten

`R-29` (Testdatei-Exklusivität, severity **error**) weist jede Testdatei genau **einer** Abnahme zu;
der Schlüssel ist der Dateipfad, nicht der Fall. Zwei neue TEST-Knoten auf `tests/executor.test.ts`
hätten das Gate blockiert. Also tragen die bestehenden Abnahmen die zusätzlichen `verify`-Kanten.

Damit die Beschriftung nicht lügt, wurde `TEST-one-driver-local-and-frontier` umbenannt: aus
*„Treiber gegen zwei Backends ohne Verzweigung"* wird *„Executor-Abnahme: ein Treiber, Injektion,
Prosa-Recovery"*. Die uid bleibt — sie ist an anderer Stelle referenziert, und R-29 bindet die Datei
ohnehin an genau diesen Knoten.

## Ergebnis

- `R-02` 22 → **19**, Findings gesamt 144 → **141**.
- Fehler 0, Compliance 1,000. Keine neue Verletzung: alle drei REQ haben Elternteil, Abnahme und
  Erfüller im selben Batch.
- Dimension `req` 0,812 → 0,814 bei gewachsenem Nenner (1290 → 1320 anwendbare Prüfungen).

## Akzeptanzkriterien

- [x] Jede neue REQ hat genau eine `verify`- und mindestens eine `satisfy`-Kante.
- [x] Keine Testdatei wird doppelt beansprucht (`R-29` = 0).
- [x] `R-02` fällt um 3, keine Regel steigt.
- [x] Graph-abhängige Tests grün: codec-roundtrip, conformance, exporter, claims-conformance,
      nd-similarity (71 Fälle).
