# CR-GC-341 — Steuerungsnachweis II: Regel-Korrektheit und Prozess-Ratsche

**Status:** done · **Abgeschlossen:** 2026-08-15 · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **3**)
**Ziel:** Claim a) („Regeln machen den Graphen korrekt") und Claim b) („wir steuern den Kunden
durch den SE-Prozess") sind kausal belegt.
**Vorbedingung:** CR-GC-340 — dort steht das **vollständige Testkonzept** (§2) und dort entsteht
die geteilte Fixture-Datei `tests/fixtures/steering-graphs.ts`. Ohne sie messen beide CRs
unterschiedliche Welten.

---

## 1. Problem

Claim a) ist heute über [`harness.gate.test.ts`](../../../tests/harness.gate.test.ts),
[`mcp.mutate-violations.test.ts`](../../../tests/mcp.mutate-violations.test.ts) und
[`export-graph-guard.test.ts`](../../../tests/export-graph-guard.test.ts) verteilt belegt — es
fehlt der **eine** Test, den man einem Skeptiker zeigt.

Claim b) hat Momentaufnahmen (`readiness.model.test.ts`: 27 Fälle über Gate-Reihenfolge,
Disjunktheit, Vollständigkeit) und einen starken Einzelnachweis
([`generate.test.ts:228`](../../../tests/generate.test.ts) — Schwelle erreicht, aber PDR-Lücke ⇒
kein `done`). Was fehlt, ist der **Regelkreis**: dass wiederholtes Anwenden der Steuerung einen
leeren Graphen tatsächlich zu einem prozesskonformen macht, ohne zu kreisen und ohne zurückzufallen.

---

## 2. Umfang

### T-A1 · „Die eine Tür" (Claim a, ein Beispiel — mehr braucht es nicht)

Ein Test, drei Assertions, echtes Disk-Kuzu:

1. **legale Mutation** → persistiert; nach `loadGraph()` wieder lesbar, Attribute intakt.
2. **dieselbe Mutation minus die Pflichtkante** (REQ ohne `verify`-TEST, R-01) → `tier: block`,
   `success: false`, und der Graph auf Disk ist **unverändert** (Vergleich über den
   deterministischen Export, nicht über eine Stichprobe).
3. **der Umgehungspfad ist zu** — ein direkter Schreibversuch am SSOT vorbei wird vom PreToolUse-Hook
   `.claude/hooks/deny-graph-write.sh` abgewiesen (Exit-Code + Meldung geprüft).

Punkt 3 ist der eigentliche Beweis: „Regeln machen korrekt" gilt nur, wenn es keinen zweiten Weg
hinein gibt. Punkt 1+2 ohne Punkt 3 belegen nur, dass **eine** Tür bewacht ist.

### T-B1 · Leiter (tabellengetrieben)

Vier Fixtures auf SRR- / PDR- / CDR- / TRR-Reife. Je Fixture:

- `currentPhaseGate()` liefert genau das erwartete Gate,
- `generationStep(...).phase` ist der erwartete Zustand (`seed` | `expand` | `handoff`),
- `focusTypes` sind genau die `DIMENSION_FOCUS_TYPES` der erwarteten Fokus-Dimension.

Beweist: die Prozessreihenfolge steht in der **Messung**, nicht in Prosa. Ergänzt
`readiness.model.test.ts`, das die Reihenfolge nur auf Regel-ID-Ebene prüft, ohne echten Graphen.

### T-B3 · Ratsche — **der Regelkreis-Beweis**

Schleife: `generationStep` → **skriptierter** Aktor wendet den kanonischen Batch der
Fokus-Dimension über `harness.mutate()` an → nächste Runde. Kein LLM (Begründung: CR-GC-340 §2.1).

Assertions über die **Sequenz**, nicht über einen Endzustand:

- `phaseReadiness` ist monoton nicht-fallend — nie SRR→PDR→SRR zurück,
- `blockingErrors` fällt monoton oder bleibt gleich,
- die Schleife terminiert in ≤ N Runden in `phase: 'handoff'` (N im Test benannt und begründet),
- kein `focusKey` wiederholt sich — der Treiber kreist nicht.

Aus einem leeren Graphen wird durch **reine Steuerung** ein prozesskonformer. Das ist Claim b),
deterministisch bewiesen.

Der skriptierte Aktor gehört in die Fixture-Datei, nicht in den Test: er ist ein Mini-Katalog
`Fokus-Dimension → kanonischer Batch` (uc → ACTOR+UC+io; req → REQ+TEST+verify im selben Batch;
arch → FUNC+FLOW+satisfy+allocate; …). Die Batch-Invarianten stehen schon in den
`GENERATION_TEMPLATE`-Texten in [`src/generate.ts`](../../../src/generate.ts) — der Aktor setzt
genau die um, mehr nicht. Er ist bewusst dumm: er darf nichts „reparieren", sonst testet er sich
selbst statt den Regler.

### T-B4 · Artefakt-Kopplung

Je Phase-Gate die zugehörige View (`se-view:rtm` / `:arch` / `:icd` / `:testmatrix`) auf dem Fixture
**vor** und **nach** Erreichen des Gates rendern:

- vorher: Lücke ist im Dokument ausgewiesen (nicht: Dokument fehlt),
- nachher: vollständig.

Beweist, dass die Artefakte **Prozessausgabe** sind und nicht Dekoration — und dass „Gate offen"
und „Dokument unvollständig" dieselbe Ursache haben.

### T-B5 · Negativkontrolle

`defer` eines Fund-Sets verschiebt den `focusKey` und den Prompt, verändert aber `phaseReadiness`,
`blockingErrors` und `readiness` **nicht**. Eine Steuergröße, die die Reihenfolge ändert, darf den
Zustand nicht ändern. Ohne diesen Test ist T-B3 nicht interpretierbar.

---

## 3. Akzeptanzkriterien

- [ ] **T-A1**: legale Mutation landet, illegale lässt die Disk byte-identisch, der Hook weist den
      Direktschreibversuch ab — in **einer** Testdatei, als zusammenhängender Nachweis lesbar.
- [ ] **T-B1**: vier Reifegrade, je erwartetes Gate + Phase + Fokus-Typen.
- [ ] **T-B3**: aus leerem Graphen erreicht die Schleife `handoff`; `phaseReadiness` monoton,
      `blockingErrors` monoton fallend, kein `focusKey` doppelt.
      > **Nachtrag 2026-08-15 (CR-GC-353): die `handoff`-Hälfte ist ZURÜCKGEZOGEN.** Belegt und
      > gültig bleiben Monotonie und Nicht-Kreisen über einen beschränkten Lauf
      > ([`tests/steering.process-ratchet.test.ts`](../../../tests/steering.process-ratchet.test.ts)).
      > `handoff` verlangt zusätzlich, dass **alle vier** Phase-Gates regel-vollständig sind — also
      > einen Aktor mit kanonischer Reparatur für praktisch jede Katalogregel. Das ist eine
      > Eigenschaft des **Aktors**, nicht des Reglers unter Test; ein Aktor, der das kann, würde die
      > eigene Fixture messen. Die ehrliche Aussage ist damit „die Steuerung fällt nicht zurück und
      > kreist nicht", **nicht** „die Steuerung führt zum Ziel". Der CR bleibt in `done/` — er ist
      > geliefert, nur nicht im ursprünglich versprochenen Umfang.
- [ ] **T-B4**: je Gate ein Vorher/Nachher-Paar; das Vorher weist die Lücke aus.
      > **Nachtrag 2026-08-15: nachgeliefert in CR-GC-353** —
      > [`tests/steering.artifact-coupling.test.ts`](../../../tests/steering.artifact-coupling.test.ts).
      > Statt der hier geplanten Gate→View-Zuordnung (`rtm`/`arch`/`icd`/`testmatrix`) trägt der
      > Nachweis vier **Regel→View**-Tripel: nur eine View, die die Lücke ihrer Regel auch
      > **markiert**, kann „das Vorher weist die Lücke aus" belegen. `arch` existiert ausserdem
      > nicht — die View heisst `architecture`, und sie markierte gar nichts, bis CR-GC-353 ihr die
      > R-22-Fehlmarkierung gab.
- [ ] **T-B5**: `defer` ändert Fokus, nicht Zustand.
- [ ] Alle Tests **red-first** nachgewiesen (`se-test`).
- [ ] Disk-Kuzu, keine Mocks, kein `:memory:`.
- [ ] `npm run build` + `npm test` grün.

---

## 4. Betroffene Dateien (3)

| Datei | Inhalt |
|---|---|
| `tests/gate.single-door.test.ts` | T-A1 |
| `tests/steering.process-ratchet.test.ts` | T-B1 · T-B3 · T-B4 · T-B5 |
| `tests/fixtures/steering-graphs.ts` | **erweitern** (aus CR-GC-340): 4 Reifegrad-Fixtures + skriptierter Aktor |

---

## 5. Reihenfolge

1. **T-B5** zuerst — billig, und ohne die Negativkontrolle ist T-B3 nicht lesbar.
2. **T-B3** — der eigentliche Beweis; der skriptierte Aktor ist die Arbeit, nicht die Assertions.
3. T-B1 / T-B4 / T-A1 — mechanisch, sobald die Fixtures stehen.

## 6. Nicht in diesem CR

Das LLM-in-the-loop-E2E (zwei gegenläufige Zielprofile, gleicher Seed, ℝ⁶-Divergenz über M Läufe).
Begründung in CR-GC-340 §2.4: nicht-deterministisch, nicht zuordenbar, gehört nicht ins Gate.
Wenn es kommt, dann als eigene, manuell gestartete Suite.

@author andreas@siglochconsulting
