# SPIKE-GC-selective-tests — Kann der Graph sagen, welche Tests laufen müssen?

**Status:** ABGESCHLOSSEN 2026-08-21 (Messung + Befunde, keine Verdrahtung)
**Herkunft:** Betreiberfrage 2026-08-20 — „warum läuft jedes Mal die volle Suite, obwohl wir sicher
reduzieren könnten? Der Graph sagt es doch."
**Typ:** Messung am eigenen und an sieben Familien-Graphen. Kein Produktionscode in diesem Spike.

---

## 1. Frage und Ausgangslage

`npm test` = `vitest run`, der CI-Step ruft genau das, `fileParallelism: false` (vitest.config.ts)
macht die Kosten linear in der Dateizahl: **106 Testdateien, CI-Lauf 9–12 min**. Die Auswahl-Fähigkeit
existiert seit CR-GC-134/204 — `graph_tests` löst über `harness.testImpact()` einen ChangeSet
gerichtet zu `TEST`-Knoten auf und emittiert `vitest run <nur betroffene Dateien>`. Sie ist **nirgends
verdrahtet**: kein npm-Script, kein Hook, kein CI-Step ruft sie. `.claude`-Hooks und der pre-commit-Hook
prüfen ausschließlich die Snapshot-Frische (CR-GC-217).

Gefragt ist damit zweierlei: **darf** man reduzieren (trifft die Auswahl?), und **was bringt es**?

## 2. Leitsatz (Betreiberentscheidung 2026-08-21)

> Der TEST-Knoten **IST** die Repräsentation des Testobjektes im Graphen. Erscheint die Granularität
> zu grob: neues Testobjekt, neuer Knoten — keine feinere Adresse im Attribut.
> Entscheidend ist **Nachweisbarkeit, nicht Detailtiefe**.

Daraus folgt die Bewertungsgrundlage dieses Spikes:

- **TEST = Testobjekt** — das Ding, das ein Ergebnis liefert. Software: eine Testdatei (oder ein Satz
  zusammengehöriger Läufe, wenn ein Objekt real mehrere Runner mischt — CR-SM-231). Nicht-Software:
  Prüfaufbau, Messung, Inspektion, Review; `tool` steht pro Eintrag, `file` ist repo-relativ erzwungen,
  der Nachweis liegt also in der History.
- **`testRefs[]` = die Adressen genau dieses Objekts**, jede mit eigenem `result`/`ranAt`.
- **R-29 (Exklusivität) ist unter diesem Leitsatz richtig, wie er ist:** eine Adresse gehört genau
  einem Objekt, sonst fällt ein Ergebnis zwei Abnahmen zu und das TRR-Gate zählt dieselbe Evidenz doppelt.
- **`verify` bleibt n:m:** ein Objekt kann n REQ nachweisen, eine REQ von n Objekten. R-01 (error)
  verlangt nur, dass jede REQ verifiziert ist — nicht, dass sie ihr eigenes Objekt hat.
- **Wer je REQ ein eigenes Ergebnis will, teilt die Testdatei.** Das ist eine Realitäts-, keine
  Modellentscheidung.

## 3. Methode

Alle Zahlen stammen aus dem committeten Snapshot `docs/graph/graphcode.graph.json`
(556 Knoten / 1239 Kanten) und den Snapshots der sieben anderen Familien-Repos — kein zweites
Kuzu-Handle, Single-Writer bleibt gewahrt. Regelbefunde aus dem **echten** Evaluator
(`V3_RULES` / `CODE_CONFORMANCE_RULES` aus `@sigloch/contracts/se`, RULES_VERSION 6.0.0), nicht
nachgebaut. Die Auswahl-Simulation repliziert die Kantensemantik aus
[harness.ts:305](../../src/harness.ts#L305) (`satisfy` out, `allocate` in, `verify` in, max. 4 Hops).

**Vergleichsmaßstab (Orakel):** die Menge der Testdateien, die die geänderte Quelldatei **direkt
importieren**. Bewusst nicht die transitive Hülle — über die Hub-Module (`index.ts`, `harness.ts`)
importiert nahezu jeder Test nahezu alles, damit wäre jede Auswahl trivial „unvollständig".
Der direkte Import unterschätzt eher (ein Test kann eine FUNC über die CLI treiben, ohne sie zu
importieren); die gemessene Lücke ist damit eine **untere** Schranke.

## 4. Ergebnisse

### M1 — Der Graph kennt den Code nicht

19 von 63 Quelldateien tragen einen Knoten (`realRef`), 44 keinen. 18 Dateien liefern überhaupt eine
Auswahl; `src/upgrade.ts` hat einen Knoten, aber keinen Pfad zu einem Test.

### M2 — Was er auswählt, trifft kaum

Über die 19 gebundenen Dateien: Auswahl **35** Testdateien, direkt gekoppelt **128**, Schnittmenge
**17** → **Recall 13 %**.

| geänderte Datei | Graph wählt | direkt gekoppelt |
|---|---|---|
| `src/rewind.ts` | `tests/graph-timetravel.test.ts` | `tests/rewind.test.ts` — die falsche Datei |
| `src/upgrade.ts` | (leer ⇒ `vitest run --passWithNoTests`) | `tests/upgrade.test.ts` |
| `src/codec.ts` | 2 | 7, u. a. `tests/codec.validation.test.ts` |
| `src/harness.ts` | 8 | 66 |

Der zweite Fall ist der gefährliche: eine leere Auswahl wird heute zu einem grünen Lauf ohne einen
einzigen Test.

### M3 — Die Testseite ist zur Hälfte unverankert

48 von 106 Testdateien hängen an einem TEST-Knoten, **58 an keinem**. 58 Testobjekte existieren real,
aber nicht im Modell — durch keine Query erreichbar, also nie auswählbar.

### M4 — Die Bindungs-KPI misst am Knoten, nicht am Objekt

R-19 = 0 und R-20 = 0 Befunde ⇒ KPI 6 (`docs/KPI.md`, Ziel 100 %) liest **100 %**, während objektseitig
45 % (48/106 Testdateien) und quellseitig 30 % (19/63) erreicht sind. Eine Pro-Element-Regel kann nicht
sehen, was gar nicht modelliert ist — die KPI misst die Vollständigkeit der vorhandenen Knoten, nicht
die Abdeckung der Realität.

### M5 — Paralleler Pfad in den Daten: `codeRef` neben `realRef`

36 FUNC tragen das seit CR-228 abgelöste `codeRef` zusätzlich zu `realRef` (29 beides, 7 nur `codeRef`),
**13 davon widersprüchlich**:

| FUNC | `realRef` (gültig) | `codeRef` (veraltet) |
|---|---|---|
| `FUNC-deduce-tests` | `src/tools/report.ts#graph_tests` | `src/mcp-tools.ts#bindToolsToHarness` |
| `FUNC-broadcast-diff` | `src/viewer/host.ts#broadcast` | `src/viewer/host.ts#HostBridge` |
| `FUNC-evaluate-rules` | `src/harness.ts#evaluateRules` | `src/harness.ts#runRules` |

Eine Auswahl, die auf `codeRef` aufsetzte, führte in genau diesen 13 Fällen zur falschen Datei.

### M6 — R-29 ist im eigenen Graphen 16× verletzt

Sieben Testdateien werden von je 2–3 Knoten beansprucht (error-Severity; über die Delta-Semantik des
Gates konserviert, weil sie beim Anlegen nicht neu waren):
`panels.test.ts` (3), `readiness.completeness.test.ts` (3), `cli.scaffold.test.ts`, `mvp-e2e.test.ts`,
`mcp.tests-deduction.test.ts`, `harness.gate.test.ts`, `host.bridge.test.ts`.

Unter dem Leitsatz sind das echte Befunde: dort stehen mehr Knoten als Testobjekte — je REQ einer
statt je Objekt einer.

### M7 — Familienbild (8 Graphen)

| Graph | FUNC | TEST | R-19 | R-20 | R-29 | Code-Bindung |
|---|---|---|---|---|---|---|
| graphcode | 83 | 71 | 0 | 0 | **16** | 59 `realRef` (+36 `codeRef`) |
| siconizer | 27 | 41 | 0 | 0 | **39** | keine |
| graphify | 13 | 30 | 25 | 13 | 0 | 13, noch als `codeRef` |
| graph-view-edit | 13 | 14 | 14 | 12 | 0 | 12 |
| moneyflow (`import-code`) | 306 | 425 | 425 | 306 | 0 | keine |
| sirail | 24 | 43 | 43 | 24 | 0 | keine |
| sigloch-modules | 11 | 11 | 11 | 0 | 0 | keine |
| graphcodedemo | 23 | 33 | 0 | 0 | 0 | keine (Konzeptmodell) |

Nur zwei Graphen der Familie tragen überhaupt Evidenz-Adressen. Die selektive Auswahl ist damit heute
nirgendwo lauffähig, auch nicht dort, wo sie entwickelt wurde.

### M8 — Das Potenzial

Über die letzten 60 Commits, Auswahl = geänderte Testdateien ∪ direkt importierende Tests
∪ Graph-Auswahl, mit ehrlichem Fallback (nicht auflösbare Datei oder Abhängigkeits-/Build-Änderung
⇒ Volllauf):

| | Dateiläufe über 60 Commits | gegenüber Volllauf |
|---|---|---|
| heutiges Modell, mit Fallback | 2975 | **53 % weniger** |
| Decke: jede geänderte Datei hätte einen Knoten | 1639 | **74 % weniger** |
| Volllauf (Ist-Zustand) | 6360 | — |

Die Differenz zwischen 53 % und 74 % ist exakt der Preis der 46 unmodellierten Quelldateien.
Median 0 — 36 der 60 Commits waren doc-/CR-only. Typischer Code-Commit: **3–8 von 106** Dateien.
Zahlen reproduzierbar via `node scripts/test-selection-audit.mjs --commits 60` (CR-GC-381).

Von 60 Commits berührten 21 `src/`; davon änderten **2** ausschließlich gebundene Dateien. Mit reiner
Graph-Auswahl und ehrlichem Fallback griffe die Selektion heute also bei 2 von 21 Code-Commits.

### M9 — Die billige Vervollständigung liegt brach

Kein einziger der 11 MOD trägt `path` oder `realRef`. Dabei ist die MOD-Ebene grob genug und trotzdem
nützlich — Testdateien, die je MOD erreichbar sind:

| MOD | Testdateien | MOD | Testdateien |
|---|---|---|---|
| `MOD-mcp-tools` | 13 | `MOD-docs` / `MOD-skills` | 5 |
| `MOD-harness` | 9 | `MOD-cli` / `MOD-dashboard` / `MOD-hooks` / `MOD-host-bridge` | 3 |
| `MOD-codec` | 4 | `MOD-steering` | 1 |

`Datei → MOD → FUNC → REQ → TEST` deckt mit **11 Gate-Mutationen** den ganzen Baum ab — gegenüber
44 neuen FUNC, die je vier Pflichten erfüllen müssten (CR-GC-366: REQ erfüllen, io-verdrahtet sein,
in einer Wirkkette hängen, in einem MOD wohnen).

### M10 — `case` ist halb eingebaut

12 von 58 `testRefs`-Einträgen tragen ein `case`. Genutzt wird es von **einer** Stelle:

| Konsument | nutzt `case` |
|---|---|
| RC-02 (Auflösung) | ja — der Name muss in einem deklarierten `it`/`describe` vorkommen |
| R-29 (Exklusivität) | nein — Schlüssel ist nur `file` |
| `graph_test_ingest` | nein — `parseVitestJson` verwirft die Fallnamen, ein Ergebnis je Datei |
| `graph_tests` (Auswahl) | nein — Kommando ist `vitest run <dateien>` |

Unter dem Leitsatz ist `case` ein zweiter Adressweg neben der Objektidentität — ein paralleler Pfad,
der ersatzlos entfällt. Die Auswahl bleibt dateiweise, was ohnehin der Granularität des Runners
entspricht: `vitest -t` filtert Fälle, lädt die Datei aber trotzdem — unterhalb der Datei ist keine
Laufzeit zu holen.

## 5. Befund

Die Auswahl **darf** heute nicht scharf geschaltet werden, und zwar nicht wegen eines Fehlers in
`graph_tests`, sondern weil das Modell die Realität nicht abdeckt: 70 % der Quelldateien haben keinen
Knoten, 55 % der Testobjekte keinen. Der Traversal tut, was er soll; er hat nur zu wenig, worüber er
laufen kann. Der **Hebel** ist mit 74 % weniger Dateiläufen bei vollständigem Modell (53 % schon
mit dem heutigen) groß genug, um die Modellarbeit zu
rechtfertigen — bei linearer Laufzeit (`fileParallelism: false`) ist das direkt Wartezeit.

## 6. Falsifikationskriterium für die Verdrahtung

Nach der Modellvertiefung wird dieselbe Messung wiederholt (`scripts/test-selection-audit.mjs`,
CR-GC-381). **Erreicht der Graph-Anteil allein keinen Recall ≥ 60 % gegen das Direkt-Import-Orakel,
trägt die Graph-Auswahl nicht** — dann ist entweder die Modellierung noch zu grob oder der Weg
`Datei → REQ → TEST` die falsche Kante, und die Verdrahtung unterbleibt.

Unabhängig davon gilt für jede spätere Verdrahtung (Betreiberentscheidung):
Orakel = **Graph ∪ Direkt-Import-Netz**; eine geänderte Datei ohne Knoten oder eine Config-Änderung
⇒ **Volllauf**; eine leere Auswahl ist **nie** `--passWithNoTests`; CI auf master bleibt voll.

## 7. Folgearbeiten

| CR | Inhalt |
|---|---|
| CR-GC-380 | dieser Spike + KPI-Präzisierung + Rückmeldung an CR-DRAFT-GC-357 |
| CR-GC-381 | Messinstrument (`scripts/test-selection-audit.mjs`), Traversal als reine Funktion |
| CR-GC-382 | Modellbereinigung: `codeRef`-Grabsteine, `case` raus, R-29 auf 0, `path` je MOD |
| CR-GC-383 | 58 fehlende Testobjekte verankern |
| CR-SM-xxx | contracts: `case` ersatzlos streichen (Familie-Review + Bump) |

@author andreas@siglochconsulting
