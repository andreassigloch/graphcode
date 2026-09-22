# CR-GC-593: Zustandsmaschine der Generierung als Invariante: done = kein Fokus; Fokusmenge = Gate-Katalog minus abgenommene Funde; Schwelle, Phasen-Gate und die zwei 'pruefe manuell'-Zweige fallen als Waechter; Eigenschaftstest ueber den Korpus (Golden ist done mit benannten Abnahmen); Maschine als FUNC + FCHAIN im Modell

**Status:** 🟠 Open — Body ausgearbeitet
**Typ:** aus Item ITEM-2026-444 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-444.json (Lane: graph)

---

**Phase 2, Zug 2 von 2** (nach CR-SM-349). Ersetzt CR-GC-582s `handoffGate`.

## 1 Befund — die ungepruefte Zustandsmaschine

`generationStep` ist eine Zustandsmaschine (seed:sys → seed:uc → seed:actor → expand → handoff),
aber nirgends als solche getestet: `tests/generate.test.ts` prueft 0 Phasenfolgen. Ihre
Handoff-Wächter kommen aus drei Quellen (Schwelle aus der Config; `blockingErrors` aus dem
74-Regel-Steuerungsstrom, also auch Fehler von Regeln, die das Gate nie durchsetzt; Phasen-Gate
aus `RULE_TO_PHASE` ueber 67 Regeln jeder Schwere), der Fokus dagegen aus den Dimensions-Scores.
Folge: die Maschine kann gleichzeitig "nichts zu tun" (kein Fokus) und "nicht fertig" (Gate
offen) sagen — die zwei "pruefe manuell"-Zweige sind das Eingestaendnis im Prompt. Gemessen in
5 Laeufen: nie `handoff`, nie "manuell" — ein Livelock in `expand`, weil der Waechter verlangt,
was der Fokus nie zeigt (BQ-02 `skipped` und `notInGate`, aber in `missing`).

## 2 Die Invariante

**`done ⇔ es gibt keinen Fokus`** (in `expand`; `seed` bleibt, wie sie ist). Kein Zustand kann
"offen, aber nichts zu tun" sein — per Konstruktion.

Fokusmenge = Funde der Regeln, die **das Gate auswertet** (Katalog `SE_DESCRIPTOR.rules`, 60),
**minus** abgenommene Funde (`acceptedFindings`, CR-SM-349). Steuerungs-only-Regeln (BQ, ND, RC)
laufen als Bericht in `graph_readiness` mit — nicht als Fokus, nicht als Waechter. Praesenzregeln
brauchen keinen eigenen Filter: sie honorieren `concept: true`.

Was faellt: Schwelle und Phasen-Gate als Waechter (bleiben Bericht), `handoffGate` (CR-GC-582),
die zwei "manuell"-Zweige, `phaseReadiness` aus der `graph_generate`-Antwort (~300 Zeichen,
steht in `graph_readiness`). Was bleibt: `blockingErrors` als Gate-Wahrheit je Mutation, `defer`,
Stagnation, der Handoff-Prompt mit Zielprofil.

## 3 Die Maschine im Modell

`FUNC-generation-step` bekommt die Zustaende als Wirkkette: `FCHAIN-generation-states` mit den
Schritten seed:sys → seed:uc → seed:actor → expand → handoff, die Invariante als REQ
(`REQ-done-iff-no-focus`) mit TEST auf den Eigenschaftstest. Durchs Gate, wie CR-GC-591.

## 4 Tests — Eigenschaften, keine Beispiele

1. `done === (focusKey === null)` fuer jeden Graphen des Korpus: 5 Auto-Graphen, Golden, jeder
   Zwischenstand des Hand-Trails (`trajektorie.spieleNach`).
2. Jede Regel der Fokusmenge ist im Gate-Katalog.
3. Nach `defer` und nach erschoepftem `defer` aendert sich der Prompt.
4. Das Golden ist `done` mit genau den benannten Abnahmen {FM-03, RD-05, MS-01, AF-05} — und
   NICHT `done` ohne sie.

## 5 Umfang (≤ 6)

`src/loop/generate.ts`, `src/kernel/measure/readiness.ts` (`handoffGate` weg), `src/loop/decisions.ts`
(Freigabe-Satz), `tests/generate.statemachine.test.ts` (neu), Modellzug, dieser CR.
