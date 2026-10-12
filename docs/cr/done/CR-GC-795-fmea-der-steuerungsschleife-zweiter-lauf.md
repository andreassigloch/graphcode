# CR-GC-795: FMEA der Steuerungsschleife, zweiter Lauf (se-fmea v9)

**Status:** ✅ Done (2026-10-12)
**Typ:** Analyse (Skill `se-fmea`, Version 9) aus Item ITEM-2026-854
**Erstellt:** 2026-10-12
**Stand:** 2026-10-12 · **Methodik:** AIAG-VDA 7-Step, Action Priority
**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10 (Sicht Wirkkette, Dimension Sicherheit);
erster Lauf CR-GC-779; Vorbereitung CR-GC-792, CR-GC-793, CR-GC-794

---

## 1. Zusammenfassung

Analysiert ist eine Wirkkette: `FCHAIN-steering-loop` (Use Case `UC-deterministic-steering`). Der Lauf baut
auf dem ersten (CR-GC-779, sieben Fehlerarten) auf und ergänzt, was der neue Skill liest: den
Betrachtungsumfang, die Träger je Risiko und die Quellen C und D. Zehn Fehlerarten, fünf Risiken im Modell.

Die drei Risiken mit der höchsten Priorität:

1. **Ein falscher Regelbefund läuft im Kreislauf um** (S 8, O 3, D 7). Die Gegenmaßnahme hat weiter keine
   Funktion, die sie ausführt.
2. **Der Store ist nach einem Abbruch nicht lesbar** (S 9, O 3, D 3). Auftreten von 2 auf 3: ein Fall der
   Gegenmaßnahme ist nicht gebaut (beschädigte Datei bei passendem Schema).
3. **Die Schleife pendelt über Sitzungen hinweg** (S 6, O 4, D 5), unverändert.

Was dieser Lauf gegenüber dem ersten zeigt:

- **Die Fläche war ein Zuordnungsfehler, kein Sicherheitsproblem.** Vor der Vorbereitung trugen 27 Funktionen
  ein Risiko, 26 davon nur, weil die Gegenmaßnahme „Store-Recovery" am Modul `MOD-kernel` hing. Nach dem
  Tieferlegen (CR-GC-794) sind es drei.
- **Eine Zusage ohne Träger.** `REQ-steering-from-metrics` wird von acht Funktionen erfüllt. Neu als Risiko
  geführt, mit dem Generierungsschritt als Verantwortlichem.
- **Eine Gegenmaßnahme sagt mehr zu, als der Code tut** (Store, beschädigte Datei). Bau-CR: CR-GC-796.

## 2. Kettenprofil (aus `graph_metrics`, graphVersion 716)

**Verdrahtung:** `measurable: true`. Ein offener Befund an einem Glied: R-21 an
`FUNC-compute-steering-delta` (die eine Übergabe der Kette), wie im ersten Lauf vom Autor nicht als Hindernis
gewertet.

| Kette | Glieder | Kreisläufe | geteilte Funktionen | Importe | Übergaben | Modulgrenzen (Verträge) | Akteursgrenze |
|---|---|---|---|---|---|---|---|
| `FCHAIN-steering-loop` | 17 | 1 (10 Glieder) | 12 | 0 | 1 | 14 Kanten über 7 Modulpaare (12 Verträge) | ✓ |

- **Länge 4, Verzweigung 7, Zulauf 5.**
- **Geteilte Funktionen nach Reichweite (Ketten, Anwendungsfälle):** `FUNC-graph-store` (17, 8),
  `FUNC-mutate` (13, 8), `FUNC-evaluate-rules` (7, 5), `FUNC-graph-suggest` und `FUNC-held-back-traces`
  (je 3, 2), sieben weitere mit je 2. Der Store stand im ersten Lauf bei 8 Ketten; seit CR-GC-792 ist er Glied
  jeder Kette, die auf ihn wartet.
- **Kreislauf:** `FUNC-arch-fitness`, `FUNC-compute-readiness`, `FUNC-evaluate-rules`, `FUNC-fit-advisory`,
  `FUNC-generation-step`, `FUNC-graph-store`, `FUNC-graph-suggest`, `FUNC-mutate`,
  `FUNC-take-steering-snapshot`, `FUNC-zug-bericht`.
- **Übergabe:** `FLOW-steering-delta` von `FUNC-compute-steering-delta`.
- **Antwortweg:** nicht lesbar (`answerPath: null`, 25 hindernde Flüsse, 20 davon Befehle an das Gate). Für
  diese Analyse ohne Belang; für die Laufzeitanalyse offen (ITEM-2026-843).

**Betrachtungsumfang:** 5 Module (`MOD-agent-surface`, `MOD-kernel`, `MOD-kernel-measure`, `MOD-loop`,
`MOD-projections`), 17 Ketten durch die Glieder, 81 Anforderungen:

`REQ-advisory-roundtrip-latency`, `REQ-analyse-artefakt-vor-stempel`, `REQ-applied-suggestion-moves-target`, `REQ-auto-persist-merge`, `REQ-batch-seed-performance`, `REQ-bericht-ist-kein-urteil`, `REQ-code-governed-quality`, `REQ-completeness-single-value`, `REQ-confidence-tier`, `REQ-deterministic-serialization`, `REQ-disk-persistence`, `REQ-docs-taxonomy`, `REQ-done-iff-no-focus`, `REQ-element-contract-finding`, `REQ-export-no-clobber`, `REQ-formatE-parity`, `REQ-frame-binding`, `REQ-gate-judges-and-stores`, `REQ-gate-only-writes`, `REQ-gate-survives-rule-failure`, `REQ-graceful-degradation`, `REQ-graph-integrity`, `REQ-graph-snapshot-per-commit`, `REQ-harness-schema-in-contracts`, `REQ-held-back-traces-named`, `REQ-hook-extension-points`, `REQ-hook-order-deterministic`, `REQ-import-se-ontology`, `REQ-interactive-capture-suggest`, `REQ-interface-change-escalation`, `REQ-interface-schema`, `REQ-loop-round-log`, `REQ-mcp-gate-symmetry`, `REQ-model-exchange-post`, `REQ-monotone-convergence`, `REQ-mutation-emits-event`, `REQ-near-duplicate-detection`, `REQ-no-extraction`, `REQ-phase-gate-not-skippable`, `REQ-post-agent-query`, `REQ-post-apply-gate`, `REQ-post-capture`, `REQ-post-interface-escalation`, `REQ-post-modelfree-gate`, `REQ-pre-agent-query`, `REQ-pre-apply-gate`, `REQ-pre-capture`, `REQ-pre-interface-escalation`, `REQ-pre-modelfree-gate`, `REQ-precise-context`, `REQ-precommit-timeout`, `REQ-prompt-provenance`, `REQ-quality-metric`, `REQ-readiness-model`, `REQ-recommend-next-step`, `REQ-responsiveness`, `REQ-risk-gate-rule-eval-fails`, `REQ-risk-loop-degradation`, `REQ-risk-loop-oscillation`, `REQ-risk-shared-steering-promise`, `REQ-risk-store-unreadable`, `REQ-rule-calibration`, `REQ-rule-enforcement`, `REQ-single-kuzu-owner`, `REQ-single-measurement-path`, `REQ-single-store`, `REQ-single-write-door`, `REQ-skill-authors-through-gate`, `REQ-small-model-viable`, `REQ-steering-from-metrics`, `REQ-steering-post`, `REQ-steering-pre`, `REQ-steering-promise-one-owner`, `REQ-store-owner-lifecycle`, `REQ-store-recovery`, `REQ-structural-rule-shared`, `REQ-structure-driven`, `REQ-target-shifts-ranking`, `REQ-testref-materialized`, `REQ-thresholds-from-config`, `REQ-zug-zeigt-kennzahlen-danach`

## 3. Träger und Fläche

| Risiko | S/O/D | Gegenmaßnahme | Erfüller | Träger |
|---|---|---|---|---|
| `REQ-risk-store-unreadable` | 9/3/3 | `REQ-store-recovery` | `FUNC-graph-store` | 1 |
| `REQ-risk-gate-rule-eval-fails` | 8/2/2 | `REQ-gate-survives-rule-failure` | `FUNC-mutate` | 1 |
| `REQ-risk-loop-oscillation` | 6/4/5 | `REQ-loop-round-log` | `FUNC-generation-step` | 1 |
| `REQ-risk-shared-steering-promise` (neu) | 6/3/6 | `REQ-steering-promise-one-owner` | `FUNC-generation-step` | 1 |
| `REQ-risk-loop-degradation` | 8/3/7 | `REQ-loop-convergence-monitor` | keiner (RD-01) | 0 |

**Fläche** (`riskCarriers.surface`): drei Funktionen. `FUNC-generation-step` trägt zwei Risiken (2 Ketten),
`FUNC-graph-store` eines (17 Ketten), `FUNC-mutate` eines (13 Ketten). **Sockel:** keine Gegenmaßnahme am System.

**Eingangsprüfung, an `se-vorbereitung` verwiesen und vor der Analyse erledigt:**

- `REQ-store-recovery` hing am Modul `MOD-kernel` (26 Träger). CR-GC-794: jetzt funktional und am Store; alle
  drei Fälle liegen in `GraphStore.open()` (`src/kernel/graph-store.ts:72`, `:86-103`;
  `src/kernel/store-lock.ts:118`). Fläche 27 auf 3.
- `REQ-loop-convergence-monitor` ohne Erfüller: nicht tieferlegbar, die Funktion fehlt. Vom Autor als
  bewusst offen geführt; Architekturvorschlag in Abschnitt 6.

## 4. Fehlerarten im Detail

Bewertung: Vorschlag des Skills, vom Autor am 2026-10-12 bestätigt. FM-01 bis FM-07 stammen aus CR-GC-779 und
gelten unverändert, außer FM-04.

| # | Quelle | Ort | Fehlerart | Ursache | Wirkung am Nutzer | S | O | D |
|---|---|---|---|---|---|---|---|---|
| FM-01 | E Kreislauf | der Kreislauf | Schleife pendelt über Sitzungen | Abbruchgedächtnis lebt im Prozess | Runden ohne Fortschritt | 6 | 4 | 5 |
| FM-02 | E Kreislauf | der Kreislauf | ein Glied rechnet auf dem Stand vor dem letzten Zug | zweiter Messpfad oder zwischengespeicherter Stand | Empfehlung passt nicht zum Modell | 7 | 3 | 6 |
| FM-03 | E Kreislauf | der Kreislauf | ein falscher Regelbefund läuft um | Regel oder Schwelle falsch; Fokus, Vorschlag und Zug folgen ihr | Modell wird schlechter, jede Runde meldet Fortschritt | 8 | 3 | 7 |
| FM-04 | F geteilt | `FUNC-graph-store` (17 Ketten) | Store nicht lesbar oder beschädigt nach Abbruch | Prozess endet während des Schreibens; Sperre eines toten Besitzers; **beschädigte Datei bei passendem Schema wird nicht neu aufgebaut** (`graph-store.ts:99-107`) | keine der 17 Ketten erreicht ihr Ergebnis | 9 | **3** | 3 |
| FM-05 | F geteilt | `FUNC-mutate`, `FUNC-evaluate-rules` | Regelauswertung wirft oder hängt im Gate | Fehler in einer Regel | kein Schreiben mehr, in 13 Ketten | 8 | 2 | 2 |
| FM-06 | Modulgrenze | `MOD-kernel-measure` → `MOD-loop` | Vertrag des Messvektors nicht an Code gebunden, ohne Test | `SCHEMA-measurement-vector` ohne Bindung (R-26) und Vertragstest (R-32) | Schleife liest ein Feld, das die Messung anders liefert | 6 | 3 | 7 |
| FM-07 | B Übergabe | `FLOW-steering-delta` | Delta fehlt oder ist falsch in der Antwort | Übergabe ohne gemeinsame Kette (R-21) | der Agent sieht einen falschen Fortschritt | 5 | 3 | 5 |
| FM-08 | Step 3, geteilte Zusage | `REQ-steering-from-metrics` | Zusage verletzt, ohne dass eine Funktion ausfällt | acht Funktionen erfüllen dieselbe Anforderung (`FUNC-arch-fitness`, `FUNC-compute-readiness`, `FUNC-compute-steering-delta`, `FUNC-fit-advisory`, `FUNC-function-criticality`, `FUNC-generation-step`, `FUNC-module-metrics`, `FUNC-take-steering-snapshot`); keine trägt sie allein | die Empfehlung folgt einer Kennzahl, die niemand verantwortet | 6 | 3 | 6 |
| FM-09 | C doppelt geführte Größe | `SCHEMA-steering-snapshot`, `SCHEMA-steering-delta`, `SCHEMA-generation-step`, `SCHEMA-mutate-result` | die Zahl der blockierenden Fehler steht in vier Verträgen und könnte aus zwei Regelkatalogen stammen | Vollkatalog in der Steuerung, Gate-Katalog am Gate | der Schritt meldet Blocker, die das Gate nie hält | 6 | 3 | 5 |
| FM-10 | D Größe ohne Wertebereich | `SCHEMA-steering-snapshot` (`stages[].name`), sechs Verträge ohne Bindung | Stufenname ist freier Text; `SCHEMA-steering-channel` (8 Flüsse), `SCHEMA-measurement-vector`, `SCHEMA-query-params`, `SCHEMA-learning-query`, `SCHEMA-learning-advice`, `SCHEMA-audit-record` ohne `realRef` | kein aufgezählter Wertebereich, kein Vertragstest | ein umbenannter Stufenname fällt still aus dem Delta | 5 | 3 | 6 |

**Am Code geprüft zu FM-09: gedeckt.** `blockingErrors` zählt seit CR-GC-598 nur die Fehler der Fokusmenge,
die am Gate blocken (`src/kernel/measure/steering-snapshot.ts`, `blockingOf(focus)`); die Regeln außerhalb des
Gates (BQ, ND, RC) sind Warnungen. Die vier Verträge führen die Zahl aus einem Messpunkt je Aufruf. Kein Risiko
geschrieben.

Weitere Zusagen mit mehr als einem Erfüller unter den Gliedern (Step 3), nicht als Fehlerart bewertet:
`REQ-store-owner-lifecycle` (5), `REQ-held-back-traces-named` (4), `REQ-auto-persist-merge` (3),
`REQ-applied-suggestion-moves-target`, `REQ-target-shifts-ranking`, `REQ-element-contract-finding`,
`REQ-analyse-artefakt-vor-stempel` (je 2). Sie gehören in die Vorbereitung (Zuordnung richten).

Quelle A (Importe): keine.

## 5. Risikomatrix

Einstufung nach der Übergangsregel des Regelkatalogs (`rpn-interim`, FM-03): High bei RPN über 100 oder
Schwere 9 bis 10.

| # | Fehlerart | S | O | D | RPN | AP | Entscheidung des Autors |
|---|---|---|---|---|---|---|---|
| FM-03 | falscher Befund läuft um | 8 | 3 | 7 | 168 | High | Risiko besteht; Gegenmaßnahme ohne Funktion, Architekturvorschlag |
| FM-02 | Glied rechnet auf altem Stand | 7 | 3 | 6 | 126 | High | gedeckt (`REQ-single-measurement-path`) |
| FM-06 | Vertrag des Messvektors ungebunden | 6 | 3 | 7 | 126 | High | bestehender Regelbefund (R-26, R-32), keine Anforderung |
| FM-01 | Schleife pendelt | 6 | 4 | 5 | 120 | High | Risiko besteht |
| FM-08 | geteilte Zusage | 6 | 3 | 6 | 108 | High | **geschrieben** |
| FM-09 | Fehlerzahl aus zwei Katalogen | 6 | 3 | 5 | 90 | Medium | am Code geprüft, gedeckt; nicht geschrieben |
| FM-10 | Stufenname ohne Wertebereich | 5 | 3 | 6 | 90 | Medium | bestehende Regelbefunde (R-26, R-32), keine Anforderung |
| FM-04 | Store nicht lesbar | 9 | 3 | 3 | 81 | High (S 9) | Bewertung nachgezogen; Bau-CR CR-GC-796 |
| FM-07 | Delta fehlt in der Antwort | 5 | 3 | 5 | 75 | Medium | bestehender Regelbefund (R-21) |
| FM-05 | Regelauswertung fällt im Gate aus | 8 | 2 | 2 | 32 | Medium | Risiko besteht |

## 6. Handlungsempfehlungen

### Software

| # | Maßnahme | Betroffene FMs | Wirkt auf | Stand |
|---|---|---|---|---|
| 1 | Beschädigte Store-Datei beim Öffnen aus dem Snapshot neu aufbauen, mit Test | FM-04 | O | CR-GC-796, offen |
| 2 | Rundenprotokoll, geschrieben von der Schleifenseite (`REQ-loop-round-log`) | FM-01 | D | nicht gebaut |
| 3 | Gate lehnt bei Fehler der Regelauswertung mit Grund ab (`REQ-gate-survives-rule-failure`) | FM-05 | O | kein Test |
| 4 | Zuordnung von `REQ-steering-from-metrics` richten: ein Verantwortlicher, je Zulieferer eine eigene Anforderung (`REQ-steering-promise-one-owner`) | FM-08 | O | Arbeit für `se-vorbereitung`; Test ungebunden |

### Architekturvorschläge (nicht angewandt; Eingang von `se:optimize`)

| Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis |
|---|---|---|---|---|---|
| `REQ-monotone-convergence` (über `REQ-loop-convergence-monitor`) | `FCHAIN-steering-loop` | der Kreislauf | Aufteilen: die Entdeckung wird eine eigene Funktion außerhalb des Kreislaufs, die nur das Rundenprotokoll liest und an den Nutzer liefert | besser: Entdeckung von FM-01 und FM-03 (D sinkt). Gleich bleibt: Zahl und Glieder des Kreislaufs, kein neuer Zufluss am Gate | eine Funktion mehr, ein Ausgang mehr in der Kette, ein Vertrag (Rundenprotokoll) an einer Modulgrenze, an der R-04 schon meldet |

Unverändert aus CR-GC-779. Läge die Entdeckung im Kreislauf, träfe sie der Fehler, den sie entdecken soll.

### Konflikte an Kreuzungspunkten

| Kreuzungspunkt | Ketten | Was gegeneinander steht |
|---|---|---|
| `FUNC-mutate` (13 Ketten, trägt 1 Risiko) | `FCHAIN-steering-loop` gegen die zwölf übrigen | Das Rundenprotokoll will bei jedem Zug schreiben; im Gate geschrieben, trüge jeder Schreibvorgang aller Ketten die Last der Schleife. Auflösung in `REQ-loop-round-log`: die Schleifenseite schreibt. |
| `FUNC-generation-step` (2 Ketten, trägt jetzt 2 Risiken) | `FCHAIN-steering-loop`, `FCHAIN-generation-states` | Der Schritt wird Verantwortlicher der Steuerungszusage und trägt schon das Pendeln. Vom Autor so gewählt; ein Zielwert besteht nicht. |

## 7. Auswirkung auf das Modell

- Neu: `REQ-risk-shared-steering-promise` (Risiko), `REQ-steering-promise-one-owner` (Gegenmaßnahme, erfüllt von
  `FUNC-generation-step`), `TEST-steering-promise-one-owner` (ungebunden, R-19).
- Geändert: `REQ-risk-store-unreadable` Auftreten 2 auf 3.
- Stempel der Analyse am System: `fmea` auf graphVersion 715.
- **Benannt offen:** `REQ-loop-convergence-monitor` ohne Erfüller (RD-01). Die Regel FM-03 des Katalogs meldet
  vier Risiken mit hoher Priorität als unverifiziert, bis ihre Tests gebunden und grün sind:
  `REQ-risk-loop-oscillation`, `REQ-risk-loop-degradation`, `REQ-risk-store-unreadable`,
  `REQ-risk-shared-steering-promise`.
- Die sieben weiteren Erfüller von `REQ-steering-from-metrics` sind nicht umgehängt; das ist Maßnahme 4.

## 8. Grenzen und Quellen

- **Eine Kette von 25.** Gate, Store und Regelauswertung sind hier mit analysiert und werden in späteren
  Läufen zitiert.
- **Quellen C und D** sind an den Verträgen mit Bindung gelesen (Feldlisten in
  `src/kernel/measure/steering-snapshot.ts`, `src/kernel/measure/zug-bericht.ts`, `src/loop/generate.ts`),
  nicht an allen 27. Für die sechs Verträge ohne Bindung gilt Quelle D pauschal.
- **Auftreten und Entdeckung** sind Schätzungen; keine Betriebsmessung liegt zugrunde.
- **Befund am Skill:** `se-fmea` Version 9 verlangt eine `relation`-Kante vom CR auf jeden TEST; das Gate lehnt
  sie ab (R-18, CR auf TEST ist kein Muster). Der CR-Knoten zeigt deshalb nur auf die Anforderungen.
- Quellen: das Modell (`graph_metrics` mit `scope`, `rules_get_violations`, graphVersion 710 bis 716), der Code
  an den genannten Stellen, CR-GC-779, CR-GC-792 bis CR-GC-794.
