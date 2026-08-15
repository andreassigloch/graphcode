# CR-GC-353 — Steuerungsnachweis III: die Lücken aus CR-GC-340/341 schließen

**Status:** done · **Angelegt:** 2026-08-15 · **Abgeschlossen:** 2026-08-15 · **Max Files:** 6 (dieser CR: **5**)
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
Schließen des Gates rendern.

**Korrigiert beim Bau — die geplante Zuordnung ging nicht auf.** Sie war Gate→View gedacht; eine
View kann aber nur die Lücke einer **Regel** markieren, die sie überhaupt kennt. Ein Gate bündelt
26–29 Regeln, von denen keine einzige View mehr als eine oder zwei markiert — die
Vorher-Assertion („die Lücke ist als Zeile ausgewiesen") wäre entweder falsch oder auf eine
Teilmenge verwässert worden. Der Nachweis läuft deshalb über vier **Regel→View**-Tripel, je eines
pro Gate; zusätzlich hiess die geplante View `arch` gar nicht so:

| Gate | Regel | View | Fehlmarkierung im Dokument |
|---|---|---|---|
| SRR | R-16 (ACTOR ohne io→UC) | `conops` §3 | `keine UC-Kopplung im Graph` |
| PDR | R-22 (FUNC ohne allocate) | `architecture` | `⚠ nicht alloziert (R-22)` |
| CDR | R-26 (SCHEMA ohne realRef) | `icd` | `⚠ kein realRef (R-26)` |
| TRR | R-01 (REQ ohne verify) | `rtm` + `testmatrix` | `⚠ R-01 no verify` / `✗` |

**Ein Produktions-Fix wurde dabei nötig** (deshalb 5 statt 4 Dateien): `architecture` markierte
**nichts**. Die Allokationstabelle iterierte über die `allocate`-**Kanten**, also verschwand eine
nicht allozierte FUNC ersatzlos aus dem Dokument — exakt die stille Klasse aus CR-GC-308. Sie
iteriert jetzt über die FUNC (R-22s Domäne); `allocate` hat genau ein legales TRACE_PATTERN
(FUNC→MOD), es geht also keine Kante verloren. Wirkung im echten Graphen: drei bis dahin unsichtbare
R-22-Funde stehen jetzt in `docs/views/architecture.md`.

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

**Grenze, beim Bau gemessen und im Test benannt:** der Gate-**Zeiger** bewegt sich dabei *nicht* —
`GATE_FIXTURE` trägt weitere offene SRR-Regeln (UC-03/UC-05/UC-06/FC-02/MS-01/…), also bleibt SRR
per Definition von `currentPhaseGate` aktuell. Belegt ist die Kopplung eine Ebene tiefer: die
`missing`-Regelliste jedes Gates verliert genau die reparierte Regel und gewinnt **keine** neue.
Nicht „genau eine weniger": das Schliessen von R-22 hat gemessen auch **MT-01** geschlossen, weil
die Instabilität von `MOD-parsing` unter die Urteilsschwelle fiel. Ein zweiter Effekt eines
strukturellen Edits ist real — „nur die Zielregel bewegt sich" zu behaupten wäre eine falsche
Aussage über das Modell.

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

- [x] **T-B4**: vier Regel/View-Paare (statt Gate/View, §3), je vorher/nachher, Zustandswechsel über
      `harness.mutate()` mit dem Batch des skriptierten Aktors; das Vorher weist die Lücke als Zeile
      mit Fehlmarkierung aus — **und** die Zeile existiert nachher noch, nur ohne Markierung.
- [x] **T-B4-Kopplung**: die Lücken-Elemente der Vorher-View = die `elementId` der offenen
      Violations der Regel — Gleichheit, keine Teilmenge. Ein eigener Test hält fest, dass jede der
      vier Regeln in der Fixture **genau einen** Fund hat, sonst wäre die Gleichheit Zufall.
- [x] **T-B1-Nachzug**: `generationStep().phase`/`focusTypes` und die `missing`-Listen aller vier
      Gates auf beiden Zuständen des echten Graphen geprüft (Grenze in §3 benannt).
- [x] **T-B3**: Nachtrags-Zeile in CR-GC-341 §3; das Kriterium ist zurückgezogen-mit-Begründung,
      die Datei bleibt in `done/`.
- [x] **Doku**: `src/tools/suggest.ts` und `se:target-profile` §1 sagen „Richtung, nicht Betrag",
      mit Verweis auf den bestehenden T-C4-Test — kein neuer Test, keine neue Prosa-Behauptung.
- [x] Alle tragenden Assertions **red-first** nachgewiesen — je einmal aus dem *richtigen* Grund
      rot gesehen: Markierung entfernt → `does not mark … as a gap`; Reparatur zum No-Op → `openFor`
      bleibt gefüllt; View markiert zu viel → `marks something the gate does not`; Zeile
      weggelassen (CR-GC-308-Klasse) → `does not mention … at all`.
- [x] Disk-Kuzu (temp dir), keine Mocks, kein `:memory:`.
- [x] `npm run build` grün · `npm test`: **719/720**. Der eine Fehlschlag
      (`tests/audit.trail-projection.test.ts`, 76,3 KB von 575,8 KB statt ≤ 11 %) ist **vorbestehend
      und fremd** — er gehört zu CR-GC-346 §3 F3, ist dort als „heute rot" dokumentiert und fällt
      mit `git stash` auf identische Zahl.

---

## 5. Betroffene Dateien (5)

| Datei | Inhalt |
|---|---|
| `tests/steering.artifact-coupling.test.ts` | **neu** — T-B4 + T-B1-Nachzug |
| `tests/fixtures/steering-graphs.ts` | `GATE_FIXTURE`/`GATE_FINDINGS` (ein Fund je Gate) + `testRefFor` |
| `src/exporter.ts` | `renderArchitecture`: pro FUNC statt pro Kante, mit R-22-Fehlmarkierung (§3) |
| `src/tools/suggest.ts` | `target`-Feldbeschreibung: Richtung, nicht Betrag |
| `.claude/commands/se/target-profile.md` | §1: Gewichte wirken relativ zueinander |

Plus die Nachtrags-Zeile in `docs/cr/done/CR-GC-341-…md` und `docs/views/architecture.md`
(generiert, zieht per `scripts/export-graph.mjs` nach — kein Hand-Edit).

**Zweiter Fund beim Bau, hier mitgefixt:** `scriptedActor` gab **jedem** erzeugten TEST dieselbe
`testRefs`-Datei. R-29 („eine Testdatei gehört höchstens einem TEST", **error**) liess das Gate den
R-01-Reparaturbatch deshalb ab — `TEST-parse` beanspruchte `steering-graphs.ts` bereits. Das war
eine Eigenschaft des Aktors, nicht ein Befund über den Regler: ein dummer Aktor darf langweilige
Bindungen schreiben, aber keine illegalen. Jeder erzeugte TEST bekommt jetzt eine eigene Datei.

---

## 6. Reihenfolge

1. **Doku-Nachzug** — 10 Minuten, entfernt eine irreführende Zahl aus der Elicitation.
2. **T-B4** — die Arbeit steckt in der Fixture, die alle vier Gates nacheinander schließt.
3. **T-B1-Nachzug** + Nachtrags-Zeile — mechanisch.

@author andreas@siglochconsulting
