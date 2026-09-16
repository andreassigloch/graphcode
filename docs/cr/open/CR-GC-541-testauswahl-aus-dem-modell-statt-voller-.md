# CR-GC-541: Testauswahl aus dem Modell statt voller Suite: graph_tests liefert fuer jedes Changeset genau die betroffenen Dateien (4 von 4 CRs bitgenau nachgemessen) — die Iteration faehrt trotzdem 141 Dateien

**Status:** 🟠 Open
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
