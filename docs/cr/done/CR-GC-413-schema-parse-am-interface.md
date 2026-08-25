# CR-GC-413 — SCHEMAs am modellierten Interface parsen (RC-04)

**Status:** done — 2026-08-25
**Herkunft:** CR-DRAFT-GC-409 §B (Warnings-Abbau). Reine Code-Arbeit, **keine Modell-Mutation**.
**Betrifft:** RC-04 ×6 — FitAdvisory, GenerationStep, LockOwner, PhaseGateReadiness,
SteeringDelta, SteeringSnapshot.

## 1 · Root Cause

§B las sich als „sechs Zod-Schemas werden nicht geparst". Der Befund im Code ist ein
anderer: **alle sechs waren gar keine Zod-Schemas**, sondern TypeScript-`interface`.
Ein `interface` hat kein `.parse()` — RC-04 hat nicht ein vergessenes Aufrufsymbol
gemeldet, sondern dass ein modellierter Datenvertrag im Code nur compile-time existiert.

Das ist an drei Stellen ein echter Fehler, nicht nur ein Regelfund: dort überqueren die
Daten eine Laufzeitgrenze und wurden am Empfang **blank gecastet**.

| Stelle | vorher | Folge |
|---|---|---|
| `executor.ts` (Runden-Loop) | `(await registry['graph_generate'].handler(…)) as GenerationStep` | eine gewanderte/kaputte Tool-Antwort lief still weiter: `phase`/`focusKey` undefined, `done` falsy → der Executor fuhr die volle Rundenzahl gegen eine Antwort ohne Instruktion |
| `executor-rank.deltaSum` | `(verdict?.fitAdvisory?.delta ?? []).reduce(…)` | `delta` kein Zahlen-Array ⇒ `reduce` wirft und reißt den Best-of-N-Schritt mit; `?? []` erfindet ersatzweise eine Null-Messung |
| `executor-rank.focusDelta/totalDelta/blockingRise` | `verdict?.steeringDelta?.…` | ein Delta **ohne** `blockingErrors`, aber mit `dimensions` rankte als sauberer Fortschritt — ein Kandidat, der Gate-Fehler einführt, konnte gewinnen |

Beide Werte stammen aus `MutateOutcome`, das `runExecutor` selbst aus einem
Registry-Ergebnis castet. Fremddaten, ungeprüft, mit `??`-Fallbacks abgefedert statt
validiert.

## 2 · Fix

Vertrag als Zod dort, wo die `realRef` ihn verortet; Parse dort, wo die Daten die
Grenze überqueren.

| SCHEMA | Zod-Definition | Parse am Interface |
|---|---|---|
| SCHEMA-generation-step | `src/generate.ts` `GenerationStep` | `GenerationStep.parse(...)` in `runExecutor` (`src/executor.ts`) |
| SCHEMA-fit-advisory | `src/fit-advisory.ts` `FitAdvisory` | `FitAdvisory.safeParse` in `fitAdvisoryOf` (`src/executor-rank.ts`) |
| SCHEMA-steering-delta | `src/steering-snapshot.ts` `SteeringDelta` | `SteeringDelta.safeParse` in `steeringDeltaOf` (`src/executor-rank.ts`) |
| SCHEMA-phase-readiness | `src/readiness.ts` `PhaseGateReadiness` | genestet in `GenerationStep.phaseReadiness` — mitgeprüft, aber nicht als eigenes Symbol (s. §3) |

`CandidateProbe.verdict.fitAdvisory/steeringDelta` sind jetzt `unknown` statt einer
abgekürzten Teilform. Das ist die Wahrheit über die Herkunft: Registry-Cast. Wer den
Wert benutzen will, muss ihn durch `fitAdvisoryOf`/`steeringDeltaOf` holen — kein
Ranking-Kriterium liest mehr ungeprüft. Was den Vertrag nicht erfüllt, ist **keine
Messung** (rankt als „nicht gemessen"), nicht eine 0-Messung.

## 3 · Nicht erzwungen — Befunde statt Dekoration

Drei RC-04 bleiben offen. Bei allen dreien wäre der einzige Weg zum grünen Regelfund
ein `.parse()` in einer toten Ecke gewesen. Das ist unterlassen.

**Strukturelle Ursache (contracts-Befund):** RC-04 verlangt
`importedSymbols.includes(symbol) && parsedSymbols.includes(symbol)` in der Datei einer
io-verbundenen FUNC. Ein Parse in der **deklarierenden** Datei zählt also nie — genau
dort liegt aber bei zwei der drei die einzige ehrliche Prüfstelle. Die Regel ist an
dieser Stelle unerfüllbar, ohne den Vertrag aus seiner Datei zu ziehen (= `realRef`
ändern = Modell-Mutation).

1. **SCHEMA-lock-owner** — echte Grenze vorhanden, aber unerreichbar für die Regel.
   `StoreLock.readOwner()` (`src/store-lock.ts:177`) liest
   `JSON.parse(readFileSync(lockPath)) as LockOwner` — JSON eines **fremden Prozesses**,
   blind gecastet. Prüfstellen laut Modell: `harness.ts`, `viewer/host.ts`,
   `session-lifecycle.ts`, `index.ts`, `store-lock.ts`; keine davon außer der
   deklarierenden hat einen sachlichen Grund, einen LockOwner zu parsen.
   **Zwei offene Folgebefunde (eigener CR):**
   - Ein halb geschriebenes Lockfile mit fehlender `pid` führt über
     `pidAlive(undefined)` → `process.kill` wirft (nicht `EPERM`) → `false` → der Lock
     eines *lebenden* Owners wird als stale zurückgeholt.
   - `src/status.ts:122–143` liest dieselbe Datei ein **zweites Mal** mit eigenem Cast
     und handgeschriebener `typeof`-Prüfung — ein Parallelpfad zum LockOwner-Vertrag.
   Fix beider: `LockOwner` als Zod, `safeParse` in `readOwner`, `status.ts` auf
   denselben Leser umstellen. RC-04 bleibt davon unberührt — es ist eine Modellfrage
   (`readHostStatus` ist nicht als io-verbunden zu FLOW-store-ownership modelliert).

2. **SCHEMA-steering-snapshot** — sachlich nicht parsbar. `SteeringSnapshot` trägt
   `og: OntologyGraph` (voller Graph), den Violation-Strom und den Readiness-Report.
   Er entsteht und stirbt in-process (`takeSteeringSnapshot` → `nextStep`/`generationStep`),
   wird nie serialisiert, überquert keine Vertrauensgrenze. Ein Zod-Schema dafür hieße,
   bei jeder Messung mehrere hundert Elemente erneut zu validieren — Kosten ohne
   Information. Reine Typ-Projektion; als solche zu behandeln.

3. **SCHEMA-phase-readiness** — als Vertrag umgesetzt, als Symbol nicht geparst.
   Prüfstellen sind `generate.ts` (Konsument) und `readiness.ts` (Produzent, deklariert).
   Zwischen beiden liegt ein gewöhnlicher, compile-time gesicherter Funktionsaufruf —
   ein isolierter `PhaseGateReadiness.parse()` dort prüfte nichts. Die Liste wird real
   geprüft, aber genestet: als `GenerationStep.phaseReadiness` beim Executor-Parse.

## 4 · Geänderte Dateien

Implementierung (6):
`src/generate.ts` · `src/executor.ts` · `src/fit-advisory.ts` · `src/steering-snapshot.ts`
· `src/executor-rank.ts` · `src/readiness.ts`

Tests (2): `tests/schema-parse-at-interface.test.ts` (neu) ·
`tests/executor.bestofn.test.ts` (Fixture: `fitAdvisory: {delta}` war nie die reale
Vertragsform — jetzt vollständig).

## 5 · Akzeptanzkriterien

- [x] RC-04 6 → 3; die drei verbleibenden sind in §3 mit Grund benannt, keiner davon
      per `external`-Flag stillgelegt (es sind graphcode-eigene Schemas).
- [x] Jeder Parse sitzt an der Stelle, an der die Daten die Grenze überqueren —
      kein Aufruf ohne Konsument.
- [x] Je geschlossenem SCHEMA eine Test-Assertion, die den Parse-Pfad ausübt
      (nicht nur den Import).
- [x] Red-first gesehen: mit den alten Cast-Stellen scheitern 7/9 der neuen Tests,
      davon zwei verhaltensbelegend — der Garbage-Kandidat **gewinnt** das Ranking,
      und `runExecutor` **resolved** statt zu rejecten.
- [x] `npm run type-check` grün, `npm test` grün.
- [x] Keine parallelen Pfade: die `interface`-Fassungen sind gelöscht, nicht neben
      den Schemas stehengelassen.
- [x] Kein Graph-Mutate in diesem CR.
