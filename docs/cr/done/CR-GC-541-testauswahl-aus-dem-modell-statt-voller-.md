# CR-GC-541: Testauswahl aus dem Modell statt voller Suite: graph_tests liefert fuer jedes Changeset genau die betroffenen Dateien (4 von 4 CRs bitgenau nachgemessen) — die Iteration faehrt trotzdem 141 Dateien

**Status:** ✅ Done (2026-09-17)
**Typ:** aus Item ITEM-2026-207 (idea)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-207.json (Lane: code)

---

BEFUND, nachgemessen am Zug 2026-09-16. `graph_tests` liefert fuer jedes der vier
graphcode-Changesets dieses Zuges GENAU die Dateien, die im jeweiligen CR von Hand als
Testmenge stehen — bitgenau, vier von vier:

    CR-GC-536 (codec.ts)            -> codec.roundtrip, codec.validation,
                                       mutate.edge-only-batch, mutate.formate-name
    CR-GC-537 (report.ts)           -> harness.import-rejected-traces
    CR-GC-538 (upgrade.ts)          -> cli.scaffold, upgrade
    CR-GC-539 (executor-prompt.ts)  -> executor.test

Gefahren wurde trotzdem jedes Mal `npm test`: 141 Dateien, ~280 s. Viermal beim Umsetzen und
noch einmal viermal durch den pre-commit-Hook — rund **40 Minuten Wanduhr** fuer Testmengen,
die das Modell in Millisekunden benennt.

DER MECHANISMUS EXISTIERT SCHON, ER GREIFT NUR EINSEITIG. `scripts/githooks/pre-commit`
unterscheidet seit CR-GC-535 zwei Spuren: liegt nur `docs/` im Diff, faehrt `verify:model`
eine AUSGEWAEHLTE Menge (46 statt 141 Dateien, `scripts/model-test-set.mjs`). Fuer
Code-Commits gibt es keine Auswahl — obwohl `graph_tests` (FUNC-deduce-tests, CR-GC-134 +
CR-GC-204) genau dafuer gebaut ist und die Ableitung `code → REQ → TEST` schon faehrt.

ZIEL: eine dritte Spur „CODE" neben MODELL und VOLL. Nicht als Ersatz der vollen Suite — die
bleibt vor dem Publish und in CI —, sondern fuer die ITERATION, wo heute die Verbrennung
sitzt.

DIE HONIGFALLE, die der CR benennen muss: eine abgeleitete Testmenge ist nur so gut wie die
Bindung, aus der sie kommt. `graph_tests` meldet TESTs ohne aufloesbares `testRefs` unter
`unresolved` — die duerfen NICHT stillschweigend wegfallen, sonst ist die Spur gruen, weil sie
weniger gesehen hat. Die Bindungsquote gehoert in die Ausgabe, wie ueberall sonst
(CR-GC-489-Muster: „nicht geprueft" darf nie wie „in Ordnung" aussehen).

DATEIEN (<= 6):
1. scripts/githooks/pre-commit — dritte Spur: geaenderte Quelldateien → uids → graph_tests
2. ein Skript analog scripts/verify-model.mjs (z. B. scripts/verify-code.mjs) — die Ableitung
   und der vitest-Aufruf; nennt unresolved und die Bindungsquote
3. package.json — das Verb
4. tests/ — Faelle: bekannte Datei → erwartete Menge; unbekannte Datei → VOLLE Spur, nie leer
5. README/GRAPHCODE.md — die drei Spuren dokumentieren

AKZEPTANZKRITERIEN:
1. Rot zuerst: eine Aenderung an `src/projections/codec.ts` waehlt genau die vier Dateien aus,
   die `graph_tests` nennt — gemessen gegen den heutigen Handschnitt im CR-GC-536.
2. Eine Quelldatei OHNE Bindung im Modell faellt auf die VOLLE Spur zurueck, nie auf eine
   leere. Ein Gate, das ohne Bindung gruen meldet, ist schlimmer als keins.
3. `unresolved` und die Bindungsquote stehen in der Ausgabe, nicht nur das Urteil.
4. Die volle Suite bleibt der Publish-Riegel — `aise release prepare` faehrt sie unveraendert.

---

## Aenderung

Dritte Spur CODE neben MODELL und VOLL.

`planCodeLane()` (`src/projections/test-selection-audit.ts`) entscheidet fuer einen
ChangeSet zwischen CODE, VOLL und KEINE, baut das Laufkommando und den Bericht. Die
Ableitung kommt unveraendert aus `impactedTests()` — derselben Funktion, die `graph_tests`
benutzt; kein zweiter Pfad. Quelle ist der committete Snapshot, nie der Kuzu-Store.

`selectForChange()` liefert jetzt zusaetzlich `unresolvedTests` (betroffene TESTs ohne
`testRefs`) und `binding` (Quelldateien mit Knoten ÷ betrachtete Quelldateien) und faellt
auf die volle Suite zurueck, sobald die Auswahl bei geaenderten Quelldateien LEER bliebe —
der zweite Weg ins falsche Gruen neben der ungebundenen Datei.

`scripts/verify-code.mjs` (`npm run verify:code`) ist der duenne Runner: ChangeSet aus
`git status --porcelain` (oder `--staged`, oder explizit genannte Dateien), Plan ausgeben,
vitest fahren. `--plan` sagt nur an. Der pre-commit-Hook ruft genau das mit `--plan
--staged` auf und sagt die Testmenge an, statt pauschal `npm test` zu nennen; ohne `dist/`
faellt er auf die volle Spur zurueck. Gefahren wird im Hook weiterhin nichts ausser der
Modell-Spur (CR-GC-399 unveraendert).

Der Plan ueberquert eine echte Modulgrenze — Runner und Hook lesen ihn aus `dist/` ohne
Typpruefung —, also hat er einen Vertrag: `CodeLanePlanSchema` in
`src/kernel/measure/test-selection.ts`, neben `TestImpactResultSchema` und
`TestSelectionSchema`; `planCodeLane` parst seine eigene Antwort.

Modell: `FUNC-plan-code-lane` (realRef) satisfy `REQ-selective-code-lane`, io
`FLOW-code-lane-plan` relation `SCHEMA-code-lane-plan`, alloziert an `MOD-projections`,
compose in `FCHAIN-impact-testing`; `TEST-selective-test-audit` verifiziert REQ und SCHEMA
(der Knoten hing vorher ohne verify-Kante). CR-Knoten traegt seinen Umfang.

## Nachweis

`tests/test-selection.audit.test.ts` (27/27), sechs neue Faelle:

1. `src/projections/codec.ts` waehlt aus dem Graphen GENAU den Handschnitt aus CR-GC-536:
   codec.roundtrip, codec.validation, mutate.edge-only-batch, mutate.formate-name.
2. Bindungsquote: ein ChangeSet aus einer gebundenen und einer ungebundenen Datei meldet
   `{sources: 2, bound: 1}` und faellt auf VOLL.
3. Ein betroffener TEST ohne `testRefs` steht in `unresolvedTests` und im Bericht, statt
   still herauszufallen.
4. Eine Auswahl, die leer bliebe, faellt auf die volle Spur — nie auf `--passWithNoTests`.
5. Der Plan: CODE/VOLL/KEINE, nie ein Befehl ohne Dateien.
6. Der Plan erfuellt `SCHEMA-code-lane-plan`; eine Antwort ohne `binding`/`unresolvedTests`
   passiert den Vertrag nicht.

Gemessen an dieser CR selbst: `src/projections/test-selection-audit.ts` waehlt 39 von 142
Dateien, 42 s statt ~280 s. Am Handschnitt-Fall `codec.ts` sind es 7 Dateien (4 aus dem
Graphen, 3 ueber den direkten Import).

Kongruenz: RC-04 21 (vorher 21 — der neue SCHEMA-Knoten ist gebunden und geparst), RC-07 7
(unveraendert, alle sieben sind CR-Knoten aus `done/` ohne Status, nicht aus diesem Zug).
Bindungsquote der Quellseite: 90 von 91 Endpunkten zugeordnet.

## Offen (nicht in diesem CR)

Die CODE-Spur laeuft seriell: die Parallelitaet der Modell-Spur ist per Test bewiesen (kein
Test der Menge oeffnet den Repo-Store), fuer eine BELIEBIGE Auswahl gilt dieser Beweis
nicht. Wer das will, braucht dieselbe Zusicherung je ausgewaehlter Datei.

27 von 93 Quelldateien ziehen mindestens einen TEST ohne `testRefs` in ihre Auswahl. Die
Spur nennt sie, faehrt sie aber nicht — das ist eine Bindungsluecke im Modell, kein Defekt
der Spur.
