# CR-GC-798: FMEA aller Wirkketten des Modells (se-fmea v9)

**Status:** ✅ Done (2026-10-12)
**Typ:** Analyse (Skill `se-fmea`, Version 9) aus Item ITEM-2026-861
**Erstellt:** 2026-10-12
**Stand:** 2026-10-12 · **Methodik:** AIAG-VDA 7-Step, Action Priority
**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10; FMEA der Steuerungsschleife
CR-GC-795 (FM-01 bis FM-10, hier zitiert, nicht wiederholt); Vorbereitung CR-GC-797

---

## 1. Zusammenfassung

Analysiert sind 24 der 25 Wirkketten des Modells; `FCHAIN-schema-migration` ist nicht bewertbar und
nicht analysiert. Zusammen mit CR-GC-795 stehen 20 Fehlerarten im Dokument (FM-01 bis FM-20), sieben
Risiken im Modell. Dieser Lauf ergänzt FM-11 bis FM-20 und schreibt zwei Risiken.

Die drei Risiken mit der höchsten Priorität im ganzen Modell:

1. **Ein veraltetes grünes Testergebnis gilt weiter** (FM-11, S 8, O 5, D 7; neu). Das Ergebnis trägt
   einen Zeitstempel, den kein Leser auswertet. Betroffen ist der Nachweis jedes anderen Risikos.
2. **Ein falscher Regelbefund läuft im Kreislauf um** (FM-03, S 8, O 3, D 7; CR-GC-795). Die
   Gegenmaßnahme hat keine Funktion.
3. **Eine Schnittstelle wird ohne Eskalation geändert** (FM-12, S 7, O 4, D 5; neu). Die Zusage hängt
   nur an der Kette, keine Funktion führt sie aus.

Was der Lauf über das ganze Modell zeigt:

- **13 Ketten haben keine eigene Fehlerart.** Zehn davon erben FM-04 über den Store, drei bestehen
  aus einem Glied ohne Store.
- **Die Fläche bleibt klein:** vier Funktionen tragen ein Risiko (`riskCarriers.surface`).
- **Zwei Gegenmaßnahmen haben keine Funktion** (`REQ-loop-convergence-monitor`,
  `REQ-interface-change-names-dependents`); beide stehen als Architekturvorschlag in Abschnitt 6.
- **Kein Risiko ist verifiziert.** Die Regel FM-03 des Katalogs meldet sechs der sieben.

## 2. Kettenprofil (aus `graph_metrics`, graphVersion 721)

| Kette | Glieder | Länge | Kreisläufe | geteilt | Importe | Übergaben | Modulgrenzen (Verträge) | Akteursgrenze | Umfang (Anforderungen) |
|---|---|---|---|---|---|---|---|---|---|
| `FCHAIN-advisory-roundtrip` | 7 | 3 | 1 | 7 | 0 | 0 | 5 Kanten (4) | ✓ | 74 |
| `FCHAIN-agent-query` | 6 | 2 | 0 | 3 | 0 | 0 | 5 Kanten (3) | ✓ | 65 |
| `FCHAIN-apply-gate` | 13 | 5 | 2 | 11 | 0 | 0 | 9 Kanten (4) | ✓ | 85 |
| `FCHAIN-capture` | 3 | 2 | 1 | 3 | 0 | 0 | 1 Kanten (1) | ✓ | 62 |
| `FCHAIN-codec-roundtrip` | 1 | 1 | 0 | 1 | 0 | 0 | 0 Kanten (0) | ✗ | 13 |
| `FCHAIN-dashboard-metrics` | 6 | 3 | 1 | 4 | 0 | 0 | 3 Kanten (1) | ✓ | 68 |
| `FCHAIN-doc-export` | 7 | 2 | 0 | 1 | 0 | 0 | 6 Kanten (1) | ✓ | 17 |
| `FCHAIN-generation-states` | 4 | 4 | 0 | 4 | 0 | 0 | 3 Kanten (3) | ✓ | 61 |
| `FCHAIN-grammar-query` | 1 | 1 | 0 | 0 | 0 | 0 | 0 Kanten (0) | ✓ | 13 |
| `FCHAIN-impact-testing` | 4 | 2 | 0 | 0 | 0 | 0 | 3 Kanten (1) | ✓ | 35 |
| `FCHAIN-interface-escalation` | 4 | 2 | 1 | 4 | 0 | 0 | 2 Kanten (2) | ✓ | 69 |
| `FCHAIN-live-update` | 9 | 4 | 1 | 5 | 0 | 0 | 3 Kanten (3) | ✓ | 73 |
| `FCHAIN-loop-closure` | 5 | 3 | 1 | 3 | 0 | 0 | 5 Kanten (2) | ✓ | 68 |
| `FCHAIN-merge-branches` | 3 | 1 | 1 | 2 | 0 | 0 | 0 Kanten (0) | ✓ | 59 |
| `FCHAIN-model-import` | 7 | 4 | 1 | 4 | 0 | 0 | 4 Kanten (3) | ✓ | 68 |
| `FCHAIN-modelfree-gate` | 3 | 1 | 1 | 3 | 0 | 0 | 0 Kanten (0) | ✓ | 58 |
| `FCHAIN-recall` | 9 | 7 | 1 | 4 | 0 | 0 | 1 Kanten (1) | ✓ | 67 |
| `FCHAIN-repo-lifecycle` | 15 | 6 | 3 | 8 | 2 | 0 | 7 Kanten (4) | ✓ | 77 |
| `FCHAIN-schema-migration` | nicht bewertbar (loose-member) | | | | | | | ✗ | 22 |
| `FCHAIN-skill-authoring` | 16 | 2 | 1 | 3 | 0 | 0 | 18 Kanten (3) | ✓ | 74 |
| `FCHAIN-skill-help` | 1 | 1 | 0 | 0 | 0 | 0 | 0 Kanten (0) | ✓ | 5 |
| `FCHAIN-skill-report` | 11 | 4 | 0 | 5 | 0 | 0 | 14 Kanten (5) | ✓ | 69 |
| `FCHAIN-snapshot-freshness` | 8 | 3 | 1 | 5 | 0 | 0 | 3 Kanten (2) | ✓ | 71 |
| `FCHAIN-steering-loop` | 17 | 4 | 1 | 12 | 0 | 1 | 14 Kanten (10) | ✓ | 83 |
| `FCHAIN-test-ingest` | 3 | 1 | 1 | 2 | 0 | 0 | 3 Kanten (3) | ✓ | 67 |
**Verdrahtung nach der Vorbereitung (CR-GC-797):** offen sind R-21 an `FUNC-compute-steering-delta`
(vom Autor in CR-GC-779 nicht als Hindernis gewertet), FC-04 an `FCHAIN-codec-roundtrip` und alles an
`FCHAIN-schema-migration` (R-31, R-20, FC-04). Der Autor ließ die Vorbereitung vor diesem Lauf fahren.

**Ketten aus einem Glied** haben keine Orte und stehen nur mit Profil: `FCHAIN-codec-roundtrip`,
`FCHAIN-grammar-query`, `FCHAIN-skill-help`.

**Kreisläufe** (dieselbe Kennung in mehreren Ketten ist derselbe Kreislauf):

| Mitglieder | Ketten |
|---|---|
| `FUNC-evaluate-rules`, `FUNC-graph-store`, `FUNC-graph-suggest`, `FUNC-mutate` | advisory-roundtrip |
| `FUNC-claim-store-lock`, `FUNC-session-shutdown` | apply-gate, repo-lifecycle |
| `FUNC-evaluate-rules`, `FUNC-graph-store`, `FUNC-mutate` | apply-gate, live-update, modelfree-gate, snapshot-freshness |
| `FUNC-graph-store`, `FUNC-mutate` | capture, dashboard-metrics, interface-escalation, loop-closure |
| `FUNC-graph-store`, `FUNC-merge-nodes`, `FUNC-mutate` | merge-branches |
| `FUNC-graph-store`, `FUNC-import-code-verb`, `FUNC-mutate` | model-import |
| `FUNC-graph-store`, `FUNC-import`, `FUNC-seed-from-json` | recall |
| `FUNC-bootstrap`, `FUNC-graph-store`, `FUNC-mutate` | repo-lifecycle |
| `FUNC-gve-sessions`, `FUNC-gve-supervise` | repo-lifecycle |
| `FUNC-chain-metrics`, `FUNC-graph-store`, `FUNC-mutate`, `FUNC-se-fmea`, `FUNC-se-laufzeit`, `FUNC-se-optimize`, `FUNC-se-vorbereitung` | skill-authoring |
| `FUNC-arch-fitness`, `FUNC-compute-readiness`, `FUNC-evaluate-rules`, `FUNC-fit-advisory`, `FUNC-generation-step`, `FUNC-graph-store`, `FUNC-graph-suggest`, `FUNC-mutate`, `FUNC-take-steering-snapshot`, `FUNC-zug-bericht` | steering-loop |
| `FUNC-graph-store`, `FUNC-mutate`, `FUNC-test-ingest` | test-ingest |
**Geteilte Funktionen nach Reichweite (Ketten, Anwendungsfälle):**
`FUNC-graph-store` (19, 9), `FUNC-mutate` (15, 9), `FUNC-evaluate-rules` (7, 5), `FUNC-create-harness` (4, 4), `FUNC-cli-dispatch` (3, 3), `FUNC-graph-impact` (3, 2), `FUNC-graph-suggest` (3, 2), `FUNC-held-back-traces` (3, 2), `FUNC-read-tools` (3, 2), `FUNC-arch-fitness` (2, 2), `FUNC-chain-metrics` (2, 2), `FUNC-claim-store-lock` (2, 2), `FUNC-export-markdown` (2, 2), `FUNC-fit-advisory` (2, 2), `FUNC-module-metrics` (2, 2), `FUNC-own-kuzu-host` (2, 2), `FUNC-se-retro` (2, 2), `FUNC-serve-stdio` (2, 2), `FUNC-session-shutdown` (2, 2), `FUNC-target-profile-load` (2, 2), `FUNC-tool-context` (2, 2), `FUNC-zug-bericht` (2, 2), `FUNC-compute-readiness` (2, 1), `FUNC-decode` (2, 1), `FUNC-generation-step` (2, 1), `FUNC-take-steering-snapshot` (2, 1)
**Importe:** nur in `FCHAIN-repo-lifecycle`, beide an `FUNC-bind-tools`: `FLOW-mcp-tool` (asynchron,
beim Start geliefert) und `FLOW-steering-delta`. **Übergabe:** nur `FLOW-steering-delta` aus
`FCHAIN-steering-loop`.

**Betrachtungsumfang:** die Vereinigung der `requirements` aller 25 Abfragen
`graph_metrics({ scope: [<Kette>] })`, 153 Anforderungen. Die Zahl je Kette steht in der Tabelle.

`REQ-advisory-roundtrip-latency`, `REQ-agent-agnostic`, `REQ-analyse-artefakt-vor-stempel`, `REQ-applied-suggestion-moves-target`, `REQ-audit-trail`, `REQ-auto-persist-merge`, `REQ-batch-seed-performance`, `REQ-bericht-ist-kein-urteil`, `REQ-bootstrap-through-gate`, `REQ-buildable-standalone`, `REQ-cache-layering`, `REQ-chain-metrics`, `REQ-code-governed-quality`, `REQ-codec-validation`, `REQ-completeness-actor-bounded`, `REQ-completeness-single-value`, `REQ-confidence-tier`, `REQ-conflict-free-merge`, `REQ-deterministic-serialization`, `REQ-disk-persistence`, `REQ-doc-export`, `REQ-docs-taxonomy`, `REQ-done-iff-no-focus`, `REQ-element-contract-finding`, `REQ-export-no-clobber`, `REQ-fmea-checks-entry`, `REQ-fmea-reads-places`, `REQ-formatE-diff-dialect`, `REQ-formatE-parity`, `REQ-frame-binding`, `REQ-full-run-on-probation`, `REQ-gate-judges-and-stores`, `REQ-gate-only-writes`, `REQ-gate-survives-rule-failure`, `REQ-graceful-degradation`, `REQ-graph-code-conformance`, `REQ-graph-context-replaces-reading`, `REQ-graph-integrity`, `REQ-graph-snapshot-per-commit`, `REQ-graph-state-recall`, `REQ-graph-tests-operational`, `REQ-harness-schema-in-contracts`, `REQ-held-back-traces-named`, `REQ-hook-extension-points`, `REQ-hook-order-deterministic`, `REQ-impact-based-testing`, `REQ-import-se-ontology`, `REQ-install-idempotent`, `REQ-interactive-capture-suggest`, `REQ-interface-change-escalation`, `REQ-interface-schema`, `REQ-laufzeit-reads-answer-path`, `REQ-live-event-in-contracts`, `REQ-loop-round-log`, `REQ-mcp-gate-symmetry`, `REQ-mcp-tool-registry`, `REQ-metrics-risk-scope`, `REQ-model-exchange-post`, `REQ-model-exchange-pre`, `REQ-monotone-convergence`, `REQ-mutation-emits-event`, `REQ-near-duplicate-detection`, `REQ-no-extraction`, `REQ-npx-distribution`, `REQ-open-point-asked`, `REQ-optimize-probes-and-presents`, `REQ-phase-gate-not-skippable`, `REQ-post-agent-query`, `REQ-post-apply-gate`, `REQ-post-capture`, `REQ-post-codec-roundtrip`, `REQ-post-emit-trajectory`, `REQ-post-emit-update-event`, `REQ-post-export-markdown`, `REQ-post-harness-cli`, `REQ-post-impact-testing`, `REQ-post-import`, `REQ-post-interface-escalation`, `REQ-post-merge-nodes`, `REQ-post-migrate-schema`, `REQ-post-modelfree-gate`, `REQ-pre-agent-query`, `REQ-pre-apply-gate`, `REQ-pre-capture`, `REQ-pre-codec-roundtrip`, `REQ-pre-emit-trajectory`, `REQ-pre-emit-update-event`, `REQ-pre-export-markdown`, `REQ-pre-harness-cli`, `REQ-pre-impact-testing`, `REQ-pre-import`, `REQ-pre-interface-escalation`, `REQ-pre-merge-nodes`, `REQ-pre-migrate-schema`, `REQ-pre-modelfree-gate`, `REQ-precise-context`, `REQ-precommit-timeout`, `REQ-progressive-expansion`, `REQ-prompt-provenance`, `REQ-quality-metric`, `REQ-query-precision`, `REQ-readiness-completeness`, `REQ-readiness-model`, `REQ-readonly-bridge`, `REQ-real-health-check`, `REQ-recommend-next-step`, `REQ-repo-install`, `REQ-repo-uninstall`, `REQ-repo-update`, `REQ-responsiveness`, `REQ-risk-gate-rule-eval-fails`, `REQ-risk-interface-change-unescalated`, `REQ-risk-loop-degradation`, `REQ-risk-loop-oscillation`, `REQ-risk-shared-steering-promise`, `REQ-risk-stale-test-result`, `REQ-risk-store-unreadable`, `REQ-roundtrip-conformance`, `REQ-rule-calibration`, `REQ-rule-enforcement`, `REQ-schema-version-migration`, `REQ-selective-code-lane`, `REQ-self-contained-dist`, `REQ-session-leaves-nothing-behind`, `REQ-single-kuzu-owner`, `REQ-single-measurement-path`, `REQ-single-store`, `REQ-single-transport`, `REQ-single-write-door`, `REQ-skill-authors-through-gate`, `REQ-skill-reads-only`, `REQ-small-model-viable`, `REQ-steering-from-metrics`, `REQ-steering-post`, `REQ-steering-pre`, `REQ-steering-promise-one-owner`, `REQ-store-owner-lifecycle`, `REQ-store-recovery`, `REQ-structural-rule-shared`, `REQ-structure-driven`, `REQ-subgraph-slicing`, `REQ-target-shifts-ranking`, `REQ-test-result-withdrawn-on-change`, `REQ-test-runnable-binding`, `REQ-test-skill-red-first`, `REQ-testref-materialized`, `REQ-thresholds-from-config`, `REQ-trajectory-emit`, `REQ-versioned-broadcast`, `REQ-versioned-cache`, `REQ-viewer-owned-by-repo`, `REQ-vorbereitung-reads-metrics`, `REQ-zug-zeigt-kennzahlen-danach`
## 3. Träger und Fläche

| Risiko | S/O/D | Gegenmaßnahme | Erfüller | Träger |
|---|---|---|---|---|
| `REQ-risk-stale-test-result` (neu) | 8/5/7 | `REQ-test-result-withdrawn-on-change` | `FUNC-test-ingest` | 1 |
| `REQ-risk-interface-change-unescalated` (neu) | 7/4/5 | `REQ-interface-change-names-dependents` | keiner (RD-01) | 0 |
| `REQ-risk-loop-degradation` | 8/3/7 | `REQ-loop-convergence-monitor` | keiner (RD-01) | 0 |
| `REQ-risk-store-unreadable` | 9/3/3 | `REQ-store-recovery` | `FUNC-graph-store` | 1 |
| `REQ-risk-gate-rule-eval-fails` | 8/2/2 | `REQ-gate-survives-rule-failure` | `FUNC-mutate` | 1 |
| `REQ-risk-loop-oscillation` | 6/4/5 | `REQ-loop-round-log` | `FUNC-generation-step` | 1 |
| `REQ-risk-shared-steering-promise` | 6/3/6 | `REQ-steering-promise-one-owner` | `FUNC-generation-step` | 1 |

**Fläche** (`riskCarriers.surface`): vier Funktionen. `FUNC-generation-step` trägt zwei Risiken
(2 Ketten), `FUNC-graph-store` eines (19 Ketten), `FUNC-mutate` eines (15 Ketten), `FUNC-test-ingest`
eines (1 Kette). **Sockel:** keine Gegenmaßnahme am System. Keine Gegenmaßnahme hängt an einem Modul.

**An `se-vorbereitung` verwiesen und vor der Analyse erledigt (CR-GC-797):** acht Züge, R-21 von 8 auf 1,
FC-04 von 4 auf 2, Importe und Übergaben in sechs Ketten geschlossen, `REQ-audit-trail` an die beiden
Auswertungsfunktionen. Benannt offen geblieben: `FCHAIN-schema-migration`, `FCHAIN-codec-roundtrip`,
drei Funktionen ohne Anforderung, Zusagen mit mehreren Erfüllern.

## 4. Fehlerarten im Detail

FM-01 bis FM-10: siehe CR-GC-795, unverändert. Bewertung von FM-11 bis FM-20: Vorschlag des Skills, vom
Autor am 2026-10-12 bestätigt; FM-13 danach vom Skill nach unten korrigiert (siehe unten).

| # | Quelle | Kette, Ort | Fehlerart | Ursache | Wirkung am Nutzer | S | O | D |
|---|---|---|---|---|---|---|---|---|
| FM-11 | E Kreislauf | `FCHAIN-test-ingest`: `FUNC-graph-store`, `FUNC-mutate`, `FUNC-test-ingest` | ein bestandenes Ergebnis gilt weiter, nachdem Test oder geprüfter Code geändert wurden | der Eintrag in `testRefs` trägt `ranAt`, kein Leser wertet es aus (`src/projections/testreport.ts:119`; in `@sigloch/contracts/se` nur ein Hinweistext); nichts nimmt ein Ergebnis zurück | ein Risiko oder eine Abnahme steht als nachgewiesen da, obwohl der Nachweis nicht mehr gilt | 8 | 5 | 7 |
| FM-12 | Step 3, Zusage ohne Funktion | `FCHAIN-interface-escalation`, `REQ-interface-change-escalation` | ein FLOW oder SCHEMA wird geändert, ohne dass Abhängige benannt und neu zugeschnitten werden | die Zusage erfüllt nur die Kette; keine Funktion führt die Eskalation aus, kein Quellcode, `TEST-interface-escalation` ungebunden | eine andere Funktion arbeitet gegen einen Vertrag, der nicht mehr gilt | 7 | 4 | 5 |
| FM-13 | E Kreislauf | `FCHAIN-recall`: `FUNC-graph-store`, `FUNC-import`, `FUNC-seed-from-json` | ein abgebrochenes Wiederherstellen hinterlässt einen teilweise gefüllten Store | `applyReseed` leert und füllt in zwei Schritten (`src/kernel/harness-import.ts:245`); der Start vergleicht Store und Datei nicht (Entscheidung CR-GC-392) | Modell unvollständig, bis erneut wiederhergestellt wird | 6 | 2 | 3 |
| FM-14 | A Import | `FCHAIN-repo-lifecycle`, `FLOW-mcp-tool` an `FUNC-bind-tools` | der Client arbeitet mit der Werkzeugliste vom Sitzungsstart | der Host meldet keine Änderung der Liste (kein `list_changed` in `src/`) | eine neue Eingabe eines Werkzeugs ist in der laufenden Sitzung nicht erreichbar | 4 | 3 | 6 |
| FM-15 | Step 3 | `FCHAIN-loop-closure`, `FUNC-audit-trail`, `FUNC-audit-stats` | die Auswertung der Gate-Entscheidungen hat keinen Verantwortlichen | `REQ-audit-trail` hing an `FUNC-graph-impact`; `SCHEMA-audit-record` ohne Bindung | Schwellen werden an einer Zahl justiert, die niemand verantwortet | 5 | 3 | 6 |
| FM-16 | F geteilt | `FCHAIN-snapshot-freshness`, `FCHAIN-doc-export`: `FUNC-export-markdown`, `FUNC-auto-export` | der automatische Export scheitert, Dateien und Sichten bleiben alt | Fehler geht nur auf die Fehlerausgabe (`src/projections/auto-export.ts`) | Viewer und Leser der Dateien sehen den alten Stand | 4 | 3 | 4 |
| FM-17 | E Kreislauf | `FCHAIN-skill-authoring`: Analyse-Skills, `FUNC-chain-metrics`, `FUNC-mutate` | ein Skill weist einen Zug an, den das Gate ablehnt | Skilltext und Grammatik laufen auseinander (ITEM-2026-856; `se-trade`) | der Lauf stockt, der Nutzer muss eingreifen | 4 | 4 | 2 |
| FM-18 | F geteilt | `FUNC-held-back-traces` (3 Ketten) | eine Kante verschwindet nach einer Grammatikänderung still | ein Muster entfällt; der Seed hält die Kante zurück | Modell verliert Bezüge | 7 | 2 | 3 |
| FM-19 | E Kreislauf | `FUNC-claim-store-lock`, `FUNC-session-shutdown` (`FCHAIN-apply-gate`, `FCHAIN-repo-lifecycle`) | der Besitzer des Stores endet, während andere Sitzungen angedockt sind | genau ein Neuwahlversuch (`src/surface/host-shim.ts:181`); `REQ-store-owner-lifecycle` hat fünf Erfüller | eine angedockte Sitzung verliert das Schreiben | 7 | 2 | 3 |
| FM-20 | frei abgeleitet | `FCHAIN-impact-testing`, `FUNC-deduce-tests` | die Auswahl lässt einen roten Test aus | Test ohne Bindung oder Quelldatei ohne Knoten | ein Fehler erreicht den Commit | 7 | 3 | 3 |

**Am Code geprüft, Stand der Deckung:**

- **FM-13:** der nächste Export verweigert, wenn im Store Elemente fehlen, die in der Datei stehen
  (`REQ-export-no-clobber`, zwei Tests bestanden). Der erste Vorschlag (9/2/5, Erweiterung von
  CR-GC-796) war zu hoch und ist zurückgenommen. Die Beschreibung von `FUNC-apply-reseed` nennt eine
  Sicherung vor dem Neuaufsetzen; im Kern ist keine zu finden, die Sicherung liegt im Verb
  `import-code` (`src/surface/import-code-verb.ts:134`).
- **FM-15:** Zuordnung in CR-GC-797 gerichtet. Offen bleibt `SCHEMA-audit-record` ohne Bindung (R-26).
- **FM-16:** die Marke `.graphcode/EXPORT_PENDING` bleibt stehen und blockt den Commit
  (`REQ-graph-snapshot-per-commit`, Tests bestanden).
- **FM-18:** `REQ-held-back-traces-named` ist gebaut; `TEST-import-rejected-traces` ist gebunden und
  trägt kein Ergebnis (VR-01).
- **FM-19:** `REQ-store-owner-lifecycle` und `REQ-session-leaves-nothing-behind`, Tests bestanden.
- **FM-20:** `REQ-full-run-on-probation` misst den Schlupf je CR.

**Geprüft und gedeckt, keine Fehlerart:** Host mit altem Code nach einem Upgrade (`judgeVersions`,
`src/surface/status.ts:276`), abgeschnittene Leseantwort (`total` in jeder Liste, `src/surface/read.ts`),
Import ohne Sicherung des Vorzustands, Export über fremde Löschungen.

**Quellen C und D** (doppelt geführte Größen, Größen ohne Wertebereich) sind in diesem Lauf nicht je
Kette neu gelesen. Für die neun Verträge ohne Bindung gilt Quelle D pauschal (FM-10): `SCHEMA-action`,
`SCHEMA-audit-record`, `SCHEMA-harness-handle`, `SCHEMA-learning-advice`, `SCHEMA-learning-query`,
`SCHEMA-measurement-vector`, `SCHEMA-query-params`, `SCHEMA-steering-channel`, `SCHEMA-tool-registry`.

## 5. Risikomatrix

High nach der Übergangsregel des Katalogs (`rpn-interim`, FM-03): RPN über 100 oder Schwere 9 bis 10.
Darunter ordnet dieses Dokument: Medium ab Schwere 7 oder RPN ab 60, sonst Low.

| # | Fehlerart | S | O | D | RPN | AP | Entscheidung des Autors |
|---|---|---|---|---|---|---|---|
| FM-11 | veraltetes Testergebnis | 8 | 5 | 7 | 280 | High | **geschrieben**, Träger `FUNC-test-ingest` |
| FM-03 | falscher Befund läuft um | 8 | 3 | 7 | 168 | High | CR-GC-795 |
| FM-12 | Schnittstelle ohne Eskalation | 7 | 4 | 5 | 140 | High | **geschrieben**, Gegenmaßnahme ohne Funktion |
| FM-02 | Glied rechnet auf altem Stand | 7 | 3 | 6 | 126 | High | CR-GC-795, gedeckt |
| FM-06 | Vertrag des Messvektors ungebunden | 6 | 3 | 7 | 126 | High | CR-GC-795, Regelbefund |
| FM-01 | Schleife pendelt | 6 | 4 | 5 | 120 | High | CR-GC-795 |
| FM-08 | geteilte Zusage | 6 | 3 | 6 | 108 | High | CR-GC-795 |
| FM-04 | Store nicht lesbar | 9 | 3 | 3 | 81 | High (S 9) | CR-GC-795, Bau CR-GC-796 |
| FM-09 | Fehlerzahl aus zwei Katalogen | 6 | 3 | 5 | 90 | Medium | CR-GC-795, gedeckt |
| FM-10 | Größe ohne Wertebereich | 5 | 3 | 6 | 90 | Medium | CR-GC-795, Regelbefund |
| FM-15 | Auswertung ohne Verantwortlichen | 5 | 3 | 6 | 90 | Medium | gelassen; Zuordnung in CR-GC-797 gerichtet |
| FM-07 | Delta fehlt in der Antwort | 5 | 3 | 5 | 75 | Medium | CR-GC-795, Regelbefund |
| FM-14 | Werkzeugliste vom Sitzungsstart | 4 | 3 | 6 | 72 | Medium | gelassen, Item |
| FM-20 | Auswahl lässt roten Test aus | 7 | 3 | 3 | 63 | Medium | gelassen, gedeckt |
| FM-18 | Kante verschwindet still | 7 | 2 | 3 | 42 | Medium | gelassen, Regelbefund VR-01 |
| FM-19 | Besitzer endet bei angedockten Sitzungen | 7 | 2 | 3 | 42 | Medium | gelassen; Zerlegen der Zusage offen |
| FM-05 | Regelauswertung fällt im Gate aus | 8 | 2 | 2 | 32 | Medium | CR-GC-795 |
| FM-16 | Export scheitert still | 4 | 3 | 4 | 48 | Low | gelassen, gedeckt |
| FM-13 | halb gefüllter Store nach Abbruch | 6 | 2 | 3 | 36 | Low | gelassen, gedeckt |
| FM-17 | Skill weist abgelehnten Zug an | 4 | 4 | 2 | 32 | Low | gelassen, ITEM-2026-856 |

## 6. Handlungsempfehlungen

### Software

| # | Maßnahme | Betroffene FMs | Wirkt auf | Stand |
|---|---|---|---|---|
| 1 | Ergebnis an `testRefs` zurücknehmen, wenn eine gemeldete Änderung den Test betrifft (`REQ-test-result-withdrawn-on-change`) | FM-11 | D | nicht gebaut, Test ungebunden |
| 2 | Beschädigte Store-Datei beim Öffnen neu aufbauen | FM-04 | O | CR-GC-796, offen |
| 3 | Rundenprotokoll von der Schleifenseite | FM-01 | D | nicht gebaut (CR-GC-795) |
| 4 | `TEST-import-rejected-traces` laufen lassen und zurückmelden | FM-18 | D | Ergebnis fehlt |
| 5 | Skilltext `se-fmea` und `se-trade` an die Grammatik angleichen | FM-17 | O | ITEM-2026-856 |

Zu Maßnahme 1: Ein Eintrag ohne Ergebnis gilt schon heute als nicht bestanden (FM-03, VR-01). Die
Maßnahme braucht deshalb keine neue Regel im Katalog. Preis: nach jeder Änderung stehen die betroffenen
Risiken als unverifiziert, bis der Lauf zurückgemeldet ist.

### Architekturvorschläge (nicht angewandt; Eingang von `se:optimize`)

| Zweck | Kette | Ort | Handlungsklasse | Prognose | Preis |
|---|---|---|---|---|---|
| `REQ-interface-change-escalation` (über `REQ-interface-change-names-dependents`) | `FCHAIN-interface-escalation` | zwischen `FUNC-mutate` und der Antwort an den Agenten | Aufteilen: eine eigene Funktion liest zu einer angenommenen Änderung an FLOW oder SCHEMA die Abhängigen (dieselbe Abfrage wie `FUNC-graph-impact`) und legt sie in die Antwort | besser: Entdeckung von FM-12 (D sinkt). Gleich bleibt: das Gate urteilt weiter nur nach Regeln und lehnt nichts zusätzlich ab | eine Funktion, ein Feld im Vertrag der Antwort, ein Zufluss mehr an der Berichtsseite; die Kette bekommt ein fünftes Glied |
| `REQ-monotone-convergence` (über `REQ-loop-convergence-monitor`) | `FCHAIN-steering-loop` | der Kreislauf | Aufteilen | unverändert aus CR-GC-795 | unverändert aus CR-GC-795 |

### Konflikte an Kreuzungspunkten

| Kreuzungspunkt | Ketten | Was gegeneinander steht |
|---|---|---|
| `FUNC-mutate` (15 Ketten, trägt 1 Risiko) | `FCHAIN-interface-escalation` gegen die übrigen | Läge das Nennen der Abhängigen im Gate, zahlte jeder Schreibvorgang die Impact-Abfrage. Der Vorschlag legt es deshalb auf die Berichtsseite (wie in CR-GC-778 für jede Messung entschieden). |
| `FUNC-test-ingest` (1 Kette, trägt jetzt 1 Risiko) | `FCHAIN-test-ingest`, `FCHAIN-impact-testing` | Die Rücknahme braucht die Menge der betroffenen Tests aus der Auswahl; die beiden Ketten teilen heute keinen Fluss (CR-GC-768). Der Bau verbindet sie wieder oder führt die Menge über den Agenten. |

## 7. Auswirkung auf das Modell (graphVersion 719 auf 721)

- Neu: `REQ-risk-stale-test-result` (Risiko, an `FCHAIN-test-ingest` und `UC-efficient-testing`),
  `REQ-test-result-withdrawn-on-change` (Gegenmaßnahme, funktional, erfüllt von `FUNC-test-ingest`),
  `TEST-test-result-withdrawn-on-change` (ungebunden, R-19).
- Neu: `REQ-risk-interface-change-unescalated` (Risiko, an `FCHAIN-interface-escalation` und
  `UC-code-quality`), `REQ-interface-change-names-dependents` (Gegenmaßnahme, funktional, ohne Erfüller,
  RD-01), `TEST-interface-change-names-dependents` (ungebunden). `TEST-interface-escalation` prüft
  zusätzlich das Risiko.
- Stempel der Analyse am System: `fmea` auf graphVersion 720.
- **Benannt offen:** FM-03 des Katalogs meldet sechs Risiken mit hoher Priorität als unverifiziert:
  `REQ-risk-stale-test-result`, `REQ-risk-interface-change-unescalated`, `REQ-risk-loop-degradation`,
  `REQ-risk-loop-oscillation`, `REQ-risk-store-unreadable`, `REQ-risk-shared-steering-promise`. RD-01
  meldet die zwei Gegenmaßnahmen ohne Erfüller.

## 8. Grenzen und Quellen

- **`FCHAIN-schema-migration` ist nicht analysiert** (nicht bewertbar; `FUNC-migrate-schema` nicht gebaut).
- **Auftreten und Entdeckung** sind Schätzungen; keine Betriebsmessung liegt zugrunde. FM-14 ist einmal
  beobachtet (2026-10-12, Eingabe `scope` an `graph_metrics`).
- **FM-13:** der fehlende Abgleich beim Start ist an `src/surface/mcp-server.ts:136-143` gelesen; ob Kuzu
  Leeren und Füllen in einer Transaktion fasst, ist nicht geprüft.
- **Quellen C und D** nicht je Kette neu gelesen (Abschnitt 4).
- **Befund am Skill:** `se-fmea` Version 9 verlangt eine Kante vom CR auf jeden TEST; die Grammatik lässt
  sie nicht zu (R-18, ITEM-2026-856). Der CR-Knoten zeigt nur auf die vier Anforderungen.
- Quellen: das Modell (`graph_metrics` mit `scope`, `rules_evaluate`, graphVersion 716 bis 721), der Code
  an den genannten Stellen, CR-GC-779, CR-GC-795, CR-GC-797.
