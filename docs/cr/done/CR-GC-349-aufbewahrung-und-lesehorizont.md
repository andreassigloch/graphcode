# CR-GC-349 — Aufbewahrung und Lesehorizont des Trails

**Status:** done 2026-08-16 · **Angelegt:** 2026-08-16 · **Max Files:** 6 (dieser CR: **5**, **zwei Repos**)
**Vorbedingung:** CR-GC-347 (die Aggregation, die von diesem Befund als Erste getroffen wird).
**Ziel:** entscheiden, was aufbewahrt wird — und reparieren, was der Trail heute **hergibt**,
obwohl er es hat.

---

## 1. Die Annahme in CR-GC-346 F4 war falsch

CR-GC-346 F4 stand so:

> *„`FileAuditLog` komprimiert automatisch ab 10 MB … wenn der Trail die Evidenzbasis für
> Kalibrierung ist, ist Compaction irgendwann Beweisvernichtung."*

**Nachgemessen 2026-08-16, ist das nicht der Fall.** `compact()` ruft `renameSync` — die alte Datei
wird nach `audit-<stamp>.jsonl` **archiviert**, nicht gelöscht, und ein Checkpoint verankert die
Version. Kein Byte geht verloren.

Der echte Befund liegt eine Ebene daneben und ist schärfer.

---

## 2. Befund — der Lesehorizont fällt auf null, die Daten bleiben liegen

Probe gegen die echte Implementierung (`maxBytes: 1024`, 20 Records):

```
vor  compact: query = 20 Records
archiviert nach: audit-2026-08-16T02-35-54-665Z.jsonl | checkpointVersion 19
nach compact: query =  0 Records
latestVersion ueberlebt: 19
Dateien: [ audit-...jsonl, audit.jsonl ]
```

`query()` liest **nur die aktive Datei**. Nach der ersten Compaction sehen `audit_trail` und —
seit CR-GC-347 — `audit_stats` einen fast leeren Trail, während die vollständige Evidenz
unberührt danebenliegt.

**Warum das schlimmer ist als Datenverlust:** die Kalibriertabelle aus CR-GC-347 würde am Tag nach
der Compaction `byRule` über eine Handvoll Records melden und sich lesen wie *„R-01 blockt kaum
noch"*. Das ist kein fehlender Messwert, das ist ein **falscher**, und er sieht aus wie ein
Ergebnis. Genau die Verwechslung, gegen die dieselbe Datei an drei Stellen antritt
(`passed: null` heisst nicht aufgezeichnet, `topBlockingRule: null` bei Gleichstand,
Abwesenheit ≠ leerer Prompt).

**Nicht betroffen:** OCC und Replay-Merge. `latestVersion()` überlebt die Compaction über den
Checkpoint (oben: 19), und beide brauchen nur die Batches seit einem Fork-Punkt. Der
Schreibpfad ist gesund; nur die Auswertung ist blind.

### 2.1 Nachbefund: die Archiv-Namen kollidieren — echter Datenverlust

Beim Bauen des Tests aufgeschlagen und nachgemessen: 30 Records geschrieben, **14 auf Platte**.

```
audit-2026-08-16T02-39-01-329Z.jsonl -> 4 Records
audit-2026-08-16T02-39-01-330Z.jsonl -> 4 Records
audit-2026-08-16T02-39-01-331Z.jsonl -> 4 Records
audit.jsonl                          -> 2 Records
Summe auf Platte: 14 von 30 geschrieben
```

Der Stempel löst auf **Millisekunden** auf, und `renameSync` überschreibt sein Ziel schweigend.
Zwei Compactions innerhalb derselben Millisekunde zerstören also das ältere Archiv — Datenverlust
in genau der Funktion, deren Zusage „löscht nichts" lautet, und unsichtbar, weil die Zusage sich
gehalten liest.

Am 10-MB-Default ist das unerreichbar (nach der ersten Rotation ist die aktive Datei klein). Mit
kleinem `maxBytes`, in Tests oder bei zwei gleichzeitig bindenden Prozessen ist es erreichbar — und
das ist dieselbe Form wie CR-GC-255: ein Pfad, den niemand fährt, bis ihn jemand fährt.

**Fix:** Kollisions-Guard beim Archivieren (Zähler-Suffix, solange das Ziel existiert). Zweiter,
davon ausgelöster Fix: `archives()` sortiert nach **(Stempel, Zähler)**, nicht lexikalisch — `-`
(0x2D) sortiert vor `.` (0x2E), ein `…-329Z-1.jsonl` käme also VOR dem `…-329Z.jsonl`, dem es
folgte, und drehte die Replay-Reihenfolge zweier benachbarter Segmente still um.

---

## 3. Aufbewahrung — die Entscheidung, und warum sie klein ausfällt

Gemessen am echten Trail (2026-08-16):

| | |
|---|---|
| Umfang | 130 Records, 838 KB in 43 Tagen |
| Rate | **19,5 KB/Tag** |
| 10-MB-Schwelle erreicht in | **~482 Tagen** |
| Archive bisher angelegt | **0** — im ganzen Entwicklungsbaum existiert kein einziges |

**Entscheidung: es wird nichts gelöscht.** Nicht als Versäumnis, sondern ausgeschrieben:

- Der Trail ist die Evidenzbasis für Schwellen-Kalibrierung (`REQ-rule-calibration`) und die
  einzige Aufzeichnung von Prompt und Urheber für die Pfade ohne Fremd-Transkript
  (`REQ-prompt-provenance`). Beides ist per Konstruktion **nicht rekonstruierbar**.
- Der Preis ist 19,5 KB/Tag, also rund 7 MB/Jahr. Eine Löschregel für 7 MB/Jahr zu bauen wäre
  Arbeit gegen ein Problem, das es nicht gibt — und sie würde genau den Korpus treffen, den
  CR-GC-346 zur Evidenzbasis erklärt hat.
- Compaction bleibt, wie sie ist: sie hält die **aktive** Datei klein (der Schreibpfad hängt an
  ihrer Größe), ohne etwas wegzuwerfen. Das ist Rotation, nicht Aufbewahrungspolitik.

Was hier NICHT entschieden wird: ob Archive irgendwann verdichtet oder ausgelagert gehören. Bei
7 MB/Jahr ist das keine Frage dieses Jahrzehnts, und eine Regel ohne Anlass ist eine Setzung.

---

## 4. Umfang

1. **`FileOperationsLog.query()` bekommt einen Horizont-Schalter** (`includeArchived`), der die
   Archive in Log-Reihenfolge mitliest. `graph-api-core` 3.1.0 → **3.2.0** (additiv, optional).
   Der Default bleibt „nur aktiv" — OCC ruft `query({})` auf dem **Schreibpfad** auf, und dem
   dort Archive unterzuschieben wäre eine Verlangsamung ohne Nutzen (er braucht nur die Batches
   seit dem Fork).
2. **`archives()`** listet die vorhandenen Archivdateien — damit eine Antwort sagen kann, was sie
   nicht gelesen hat, statt es zu verschweigen.
3. **`audit_trail` / `audit_stats` lesen mit Archiven** und melden den Horizont: `window` trägt
   `archives` (Anzahl) und `checkpointVersion`. Eine Auswertung, die den halben Trail sieht, muss
   das **sagen** — das ist dieselbe Regel wie „kein stiller Cap" aus CR-GC-346/347.
4. **Test rot zuerst**: eine Aggregation über einen kompaktierten Log liefert dieselben Zahlen wie
   vorher; ohne den Fix liefert sie null.

**Nicht-Ziele:** keine Löschregel (§3), keine Änderung an Compaction-Schwelle oder -Zeitpunkt,
keine Änderung am Schreibpfad.

---

## 5. Akzeptanzkriterien

- [x] `compact()` archiviert per Rename und löscht nichts, `latestVersion()` identisch vor und
      nach — als Test festgehalten, damit die Prämisse aus §1 nicht wieder driftet.
- [x] **(§2.1)** 30 geschriebene Records sind nach mehrfacher Rotation **30** auf Platte, nicht 14;
      `archives()` liefert sie in Schreibreihenfolge, auch mit Kollisions-Suffix.
- [x] `query({ includeArchived: true })` über einen kompaktierten Log liefert **alle** Records in
      Log-Reihenfolge; `query({})` liefert weiter nur die aktiven — red-first für beide Richtungen.
- [x] `aggregateAuditEntries` über den kompaktierten Log ergibt **exakt** dieselben `byRule`-Zahlen
      wie über denselben Datensatz vor der Compaction.
- [x] `audit_stats().window` trägt `archives` und `checkpointVersion`; auf einem nie kompaktierten
      Log sind das `0` bzw. `0` — nicht `null`, denn hier ist die Null eine Messung, keine Lücke.
- [x] `since`/`consumerId` filtern über den Gesamthorizont, nicht nur über die aktive Datei.
- [x] Ein torn/unlesbares Archiv lässt die Abfrage **gelingen** (übersprungene Zeile, wie beim
      aktiven Log) — eine Auswertung darf nicht an einem alten Archiv sterben.
- [x] `@sigloch/graph-api-core` 3.2.0 publiziert, `package-lock.json` weist sie aus.
- [x] `npm run build` + `npm test` grün.

---

## 6. Betroffene Dateien (5, zwei Repos)

| Repo | Datei | Änderung |
|---|---|---|
| sigloch-modules | `packages/graph-api-core/src/audit.ts` | `includeArchived` in `query`, `archives()`, Kollisions-Guard + chronologische Sortierung (§2.1) |
| sigloch-modules | `packages/graph-api-core/package.json` | 3.1.0 → 3.2.0 |
| graphcode | `src/tools/audit.ts` | beide Werkzeuge lesen mit Archiven, `window` meldet den Horizont |
| graphcode | `tests/audit.retention.test.ts` | **neu** — Compaction-Invariante, Horizont, Aggregations-Gleichheit, torn archive |
| graphcode | `docs/cr/open/CR-GC-349-aufbewahrung-und-lesehorizont.md` | dieser CR |

@author andreas@siglochconsulting
