# CR-GC-353 — Steuerungsnachweis III: die Lücken aus CR-GC-340/341 schließen

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **4**)
**Ziel:** die drei Aussagen, die CR-GC-340/341 versprochen und **nicht** belegt haben, sind entweder
belegt oder ausdrücklich als nicht-belegt dokumentiert — kein stiller Rest.
**Herkunft:** Abgleich der Akzeptanzkriterien von CR-GC-340/341 gegen den Commit `5285b40`
(2026-08-15). Beide CRs liegen in `done/`, ihre Checklisten sind ungehakt, drei Punkte sind offen.

---

## 1. Root Cause

Die beiden CRs wurden geschlossen, sobald `npm test` grün war. Grün war aber ein **kleinerer**
Testumfang als der beschlossene: der Umfang wurde beim Bau an das angepasst, was der skriptierte
Aktor und die Fixtures hergaben, und die Anpassung wurde im Testkommentar dokumentiert statt im CR.
Damit steht in `done/` ein Nachweis-Versprechen, das der Code nicht einlöst.

| # | Versprochen | Ist | Wo dokumentiert |
|---|---|---|---|
| A | **T-B4** Artefakt-Kopplung: je Phase-Gate die View vorher/nachher rendern | **fehlt vollständig** — keine Testdatei, kein Folge-CR | nirgends |
| B | **T-B3**: „aus leerem Graphen erreicht die Schleife `handoff`" | nur Monotonie + Nicht-Kreisen über beschränkten Lauf | [`steering.process-ratchet.test.ts:18-24`](../../../tests/steering.process-ratchet.test.ts) |
| C | **T-B1**: vier Reifegrad-Fixtures, je `currentPhaseGate` + `generationStep().phase` + `focusTypes` | tabellengetrieben über `RULE_TO_PHASE`, ohne echten Graphen; `phase` je Reifegrad ungeprüft | [`steering.process-ratchet.test.ts:61-63`](../../../tests/steering.process-ratchet.test.ts) |

Nicht in diesem CR, aber derselben Herkunft und bereits getrackt: die kanonische Sortierung in
[`src/conformance.ts`](../../../src/conformance.ts) (Produktionscode-Änderung in einem Test-CR) ist
ein Consumer-Pflaster; Root Cause = **CR-GC-351**, Anwendbarkeit der Arch-Suggestions = **CR-GC-352**.

---

## 2. Impact

- **A** ist der einzige Beleg dafür, dass die Artefakte **Prozessausgabe** sind und nicht Dekoration.
  Ohne ihn steht die Aussage „Gate offen und Dokument unvollständig haben dieselbe Ursache" nur in
  Prosa — und genau diese Klasse hat CR-GC-308 schon einmal als „compliance 1.0 auf leerer View"
  erwischt.
- **B** schwächt Claim b): bewiesen ist „die Steuerung fällt nicht zurück und kreist nicht",
  **nicht** „die Steuerung führt zum Ziel". Das ist eine ehrliche, aber kleinere Aussage als die in
  den Artikeln.
- **C** ist der geringste Schaden: die Leiter ist bewiesen, nur eine Ebene abstrakter als geplant.
  Was fehlt, ist die Kopplung Reifegrad → `generationStep().phase` auf einem **echten** Graphen.

---

## 3. Umfang

### T-B4 · Artefakt-Kopplung (der eigentliche Inhalt dieses CR)

Je Phase-Gate die zugehörige View über `exportMarkdown(graph, view, name)`
([`src/exporter.ts:312`](../../../src/exporter.ts)) auf demselben Graphen **vor** und **nach**
Schließen des Gates rendern:

| Gate | View |
|---|---|
| SRR | `rtm` |
| PDR | `arch` |
| CDR | `icd` |
| TRR | `testmatrix` |

Assertions je Paar:

- **vorher**: die Lücke ist im Dokument **ausgewiesen** — die betroffene Zeile existiert und trägt
  die Fehlmarkierung. Nicht: „das Dokument fehlt", nicht: „die Zeile fehlt". Eine fehlende Zeile ist
  genau der stille Fehler aus CR-GC-308.
- **nachher**: dieselbe Zeile ist vollständig, die Fehlmarkierung ist weg.
- **Kopplung**: die Elemente, die in der Vorher-View als Lücke stehen, sind genau die
  `element_id` der offenen Violations des Gates — dieselbe Ursache, nicht zwei Meinungen.

Der Zustandswechsel entsteht über `harness.mutate()` (der Batch aus `scriptedActor`), nicht durch
Fixture-Austausch — sonst vergleicht der Test zwei Welten statt eines Fortschritts.

### T-B1-Nachzug (billig, fällt in derselben Datei ab)

Auf den beiden Zuständen des T-B4-Graphen zusätzlich `generationStep(...).phase` und `focusTypes`
prüfen. Damit ist die Leiter einmal auf einem echten Graphen belegt, nicht nur über `RULE_TO_PHASE`.

### T-B3 · Grenze festschreiben statt nachbessern

Kein neuer Test. Der `handoff`-Nachweis wird **ausdrücklich zurückgezogen**: er ist eine Eigenschaft
des Aktors (kanonischer Repair für praktisch jede Katalogregel), nicht des Reglers, und ein Aktor,
der das kann, würde die eigene Fixture messen. Zu tun:

1. CR-GC-341 §3 bekommt eine **Nachtrags-Zeile** an der Stelle des Kriteriums: zurückgezogen, mit
   Begründung und Verweis hierher. Die Datei bleibt in `done/` (der CR ist geliefert, nur nicht im
   versprochenen Umfang) — kein Wieder-Öffnen, keine Parallelversion.
2. Der Testkommentar behält seine Scope-Aussage; sie ist der Beleg, nicht das Problem.

### Doku-Nachzug · Richtung steuert, Betrag nicht

`suggestEdits` normalisiert den Zielvektor L2 (`@sigloch/se-optimizer/dist/suggest.js:33-34`), das
Ergebnis echot aber den **rohen** Input zurück. Belegt in
[`steering.architecture-causality.test.ts:292`](../../../tests/steering.architecture-causality.test.ts).
Zwei Stellen, die das heute nicht sagen:

- die `describe()`-Beschreibung des `target`-Felds in [`src/tools/suggest.ts:38`](../../../src/tools/suggest.ts),
- die Elicitation in [`.claude/commands/se/target-profile.md`](../../../.claude/commands/se/target-profile.md) §1
  („weight in `[-1,1]`") — die Zahl liest sich wie eine Intensität, wirkt aber nur im **Verhältnis**
  zu den anderen Dimensionen.

Nur Text. Kein Verhaltens-Änderung am Echo: `target` bleibt der rohe Input (T-C1/T-C4 hängen daran).

---

## 4. Akzeptanzkriterien

- [ ] **T-B4**: vier Gate/View-Paare, je vorher/nachher, Zustandswechsel über `mutate()`; das
      Vorher weist die Lücke als Zeile mit Fehlmarkierung aus.
- [ ] **T-B4-Kopplung**: die Lücken-Elemente der Vorher-View = die `element_id` der offenen
      Violations des Gates.
- [ ] **T-B1-Nachzug**: `generationStep().phase` und `focusTypes` auf beiden Zuständen des echten
      Graphen geprüft.
- [ ] **T-B3**: Nachtrags-Zeile in CR-GC-341 §3; das Kriterium ist nicht mehr offen, sondern
      zurückgezogen-mit-Begründung.
- [ ] **Doku**: Tool-Beschreibung und Skill sagen „Richtung, nicht Betrag"; die Aussage hängt am
      bestehenden Test (Verweis auf T-C4), nicht an neuer Prosa.
- [ ] Alle Tests **red-first** nachgewiesen (`se-test`) — je Assertion einmal aus dem *richtigen*
      Grund rot gesehen.
- [ ] Disk-Kuzu, keine Mocks, kein `:memory:`.
- [ ] `npm run build` + `npm test` grün.

---

## 5. Betroffene Dateien (4)

| Datei | Inhalt |
|---|---|
| `tests/steering.artifact-coupling.test.ts` | **neu** — T-B4 + T-B1-Nachzug |
| `tests/fixtures/steering-graphs.ts` | erweitern: der Graph, der die vier Gates nacheinander schließt |
| `src/tools/suggest.ts` | `target`-Feldbeschreibung: Richtung, nicht Betrag |
| `.claude/commands/se/target-profile.md` | §1: Gewichte wirken relativ zueinander |

Plus die Nachtrags-Zeile in `docs/cr/done/CR-GC-341-…md` (Doku, kein Code).

---

## 6. Reihenfolge

1. **Doku-Nachzug** — 10 Minuten, entfernt eine irreführende Zahl aus der Elicitation.
2. **T-B4** — die Arbeit steckt in der Fixture, die alle vier Gates nacheinander schließt.
3. **T-B1-Nachzug** + Nachtrags-Zeile — mechanisch.

@author andreas@siglochconsulting
