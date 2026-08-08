# CR-GC-319 — `audit_trail` liefert eine schlanke Projektion statt roher Records

**Status:** Vorschlag · **Datum:** 2026-08-08
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

1. Ein Default-`audit_trail` über den Repo-eigenen Trail (74 Records) liegt unter 10 % der heutigen
   Bytezahl.
2. `includeCommands: true` liefert byte-identisch die heutigen Batches.
3. `graph_merge` / Replay über denselben Log erzeugt denselben Graphen wie vor dem CR.
4. Kein Feld verschwindet aus `.graphcode/audit.jsonl`.
