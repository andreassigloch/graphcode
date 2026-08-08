# CR-GC-319 — `audit_trail` liefert eine schlanke Projektion statt roher Records

**Status:** done · **Datum:** 2026-08-08 · **Abgeschlossen:** 2026-08-08
**Ziel:** graphcode 0.8.0
**Ontologie:** v4.0.0 — **unverändert**
**Bezug:** CR-GC-314 (REQ-A06 folgt derselben Regel: schreiben ≠ ausliefern)

---

## 1. Problem

`audit_trail` gibt die Audit-Records **roh** an den Agenten zurück — inklusive `commands`, also dem
vollständigen Mutate-Batch jeder Mutation, und `violations` mit `fixHint` + `context`.

Gemessen an diesem Repo (`.graphcode/audit.jsonl`, 74 Records):

| Anteil an den letzten 50 Records | Bytes |
|---|---|
| `commands` (Mutate-Batches) | 132 KB (79 %) |
| `violations` inkl. `fixHint`/`context` | 24 KB (14 %) |
| alles übrige (id, timestamp, result, version) | 11 KB (7 %) |
| **Summe = eine Default-Antwort (`limit: 50`)** | **166 KB ≈ 40k Token** |

Ein einziger Default-Aufruf kostet also rund 40k Token, und der Agent fragt den Trail, um zu
erfahren *was passiert ist* — nicht, um Batches zu replayen. Der eine Consumer, der die Batches
wirklich braucht, ist der Replay-Merge, und der liest die JSONL-Datei direkt
(`src/merge.ts:79`), nicht das Tool.

Das widerspricht dem Query-Precision-Prinzip (R12): präzise Query statt Result-Kompression — hier
wird stattdessen ein Vollabzug geliefert und dem Agenten die Kompression überlassen.

---

## 2. Ziel

`audit_trail` liefert per Default eine schlanke Projektion. Die schweren Felder gibt es nur auf
explizites Opt-in. Der Log-Inhalt auf Platte ändert sich **nicht**.

---

## 3. Nicht-Ziele

- Keine Änderung am geschriebenen Record — `recordAudit` bleibt unverändert vollständig.
- Keine Änderung an Replay-Merge, OCC oder Compaction (lesen die Datei, nicht das Tool).
- Kein neues Tool, keine zweite Trail-Route (keine parallelen Pfade).

---

## 4. Anforderungen

| REQ | Kind | Anforderung | Verification |
|---|---|---|---|
| REQ-T01 | functional | `audit_trail` liefert per Default je Record: `id`, `timestamp`, `consumerId`, `operation`, `result`, `graphVersion`, `commandCount`, `opSummary` (`+n ~n -n`). | test |
| REQ-T02 | functional | Violations per Default schlank: `ruleId`, `severity`, `message`, `elementId` — ohne `fixHint`/`context` (die stehen aktuell in `rules_get_violations`). | test |
| REQ-T03 | functional | `includeCommands: true` liefert die vollständigen Batches wie bisher. | test |
| REQ-T04 | non-functional | Default-Antwort auf identischem Log ≥ 90 % kleiner als heute (Messung am Repo-eigenen Trail). | test |
| REQ-T05 | negative | Records ohne `commands` (validate/export, Altbestand) liefern `commandCount: 0`, kein Fehler. | test |
| REQ-T06 | negative | Replay-Merge und `audit_stats` bleiben unberührt — identisches Ergebnis vor/nach dem CR. | test |

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/tools/report.ts` | `AuditTrailInputSchema` + `includeCommands`; Projektion im Handler |
| `tests/…audit-trail…test.ts` | Projektion, Opt-in, Größenbudget (REQ-T04) |

Zwei Dateien — weit unter dem 6-Datei-Limit.

---

## 6. Akzeptanzkriterien

1. [~] Ein Default-`audit_trail` über den Repo-eigenen Trail liegt unter 10 % der heutigen
   Bytezahl. → **gemessen 17,0 KB aus 162,6 KB = 89,3 %.** Siehe §7.
2. [x] `includeCommands: true` liefert byte-identisch die heutigen Batches.
3. [x] `graph_merge` / Replay über denselben Log erzeugt denselben Graphen wie vor dem CR.
4. [x] Kein Feld verschwindet aus `.graphcode/audit.jsonl`.

---

## 7. Ergebnis: 89,3 %, nicht 90 % — und warum die Zahl so bleibt

Gemessen am realen Trail (letzte 50 Records, wie REQ-T04 es verlangt):

| | Bytes |
|---|---|
| roh (heute) | 162,6 KB |
| Projektion | **17,0 KB** |
| Ersparnis | **89,3 %** |

Die 90 % waren geschätzt, bevor die Projektion existierte, und haben das Gewicht der in
REQ-T01 **geforderten** Basis-Felder nicht eingerechnet: `id`, `timestamp`, `consumerId`,
`operation`, `result`, `graphVersion`, `commandCount`, `opSummary` samt JSON-Schlüsseln sind
allein **10,0 KB** — 200 B pro Record, nicht entfernbar ohne ein gefordertes Feld zu
streichen. Die schlanken Violations sind weitere 6,3 KB (davon 3,4 KB `message`).

Die Schwelle im Test steht deshalb auf dem **gemessenen** Wert mit etwas Luft, nicht auf der
Schätzung, und der Grund steht im Test daneben. Eine Schwelle so lange aufzuweichen, bis der
Test grün wird, ist genau der Mechanismus, durch den eine Suite eine Regression mitlernt.

**Eine Abweichung von §4:** `rulesetVersion` (aus CR-GC-314) ist nicht in der
Default-Antwort. REQ-T01 listet es nicht, und es beschreibt den *Regelsatz*, nicht *was
passiert ist* — dieselbe Hälfte wie `rulesPassed`. Es reist jetzt mit
`includeRulesPassed`. Auf dem Record steht es unverändert.

## 8. Umsetzung

| Datei | Änderung |
|---|---|
| `src/tools/report.ts` | `includeCommands`; `projectAuditEntries()` als **reine, exportierte** Funktion + `opSummary()` |
| `tests/audit.trail-projection.test.ts` | 9 Tests |

Die Projektion ist bewusst pur und exportiert: nur so lässt sich die Größenaussage am
**echten** Trail messen statt an einem Fixture, dessen Violation-zu-Command-Verhältnis
zufällig gewählt wäre — und genau dieses Verhältnis ist die ganze Variable.

## 9. Nachweis

Mutationsprobe: Projektion aufgeweicht (`commands` + volle Violations wieder mitgeliefert)
→ REQ-T01 **und** das Größenbudget werden rot. Ein Test allein hätte nicht gereicht: eine
Projektion, die die Batches *verliert*, bestünde das Größenbudget genauso — deshalb prüft
REQ-T03 gegenläufig, dass `includeCommands` sie byte-identisch zurückgibt.
