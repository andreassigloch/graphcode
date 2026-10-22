# CR-GC-836: Test-Ketten nach Auslöser getrennt — graph_tests, graph_test_ingest, npm-Spuren

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1015 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1015.json (Lane: graph)

---

## Befund

Modell-Audit gegen den Code, 2026-10-22, Gruppen A und C. Entscheidung des Autors: je Auslöser eine Kette.

- **FCHAIN-impact-testing** und **FCHAIN-test-ingest** mischten drei Auslöser: den Agenten mit graph_tests bzw. graph_test_ingest, `npm run verify:code` und `npm run verify:full`.
- **planCodeLane** ruft die reine Funktion `impactedTests()` über den committeten Snapshot (`test-selection-audit.ts:218/382`), nicht `harness.testImpact`.
- **Laufbericht und Schlupf-Zeile** erzeugen die Skripte (`verify-code.mjs`, `verify-full.mjs`, `meldeZurueck`), nicht planCodeLane bzw. schlupfVon.
- **Der Agent** ruft graph_tests, nicht testImpact.

## Änderung (Modell)

- **Neue FUNCs:**
  - FUNC-select-tests (`impactedTests`).
  - FUNC-verify-lane-code (`scripts/verify-code.mjs`).
  - FUNC-verify-lane-full (`scripts/verify-full.mjs`).
- **FCHAIN-impact-testing**, jetzt „Tests zu einer Änderung wählen“: Agent → graph_tests → testImpact (liest den Store) → impactedTests → zurück → Agent.
- **FCHAIN-test-ingest:**
  - Agent → graph_test_ingest → testImpact → Gate → Protokoll → Antwort an den Agenten.
  - plan-code-lane und schlupf sind keine Glieder mehr.
- **Neue FCHAIN-verify-lane:**
  - npm-Spur → planCodeLane (liest die committete Datei) → impactedTests → Plan → Spur.
  - Spur → Laufbericht → graph_test_ingest → Antwort → Spur.
  - verify:full → schlupfVon → Schlupf → Spur → Schlupf-Zeile.
  - Je Spur eine Ausgabe an den Auftraggeber.
- REQ-risk-selection-misses-red-test erfüllt jetzt FCHAIN-verify-lane.

## Messung

v827 → v828, 0 neue Fehler. Neue Warnungen:
- R-22 an FUNC-verify-lane-code und FUNC-verify-lane-full: `scripts/` liegt in keinem MOD. Ob die Spur-Skripte ein MOD bekommen oder als Werkzeug außerhalb des Systems gelten, entscheidet der Autor.
- RD-04 an FUNC-block-bedienung (12 Kinder) und FUNC-block-messwerk (10 Kinder).

## Code-Befunde (nicht in diesem CR)

- **graph_test_ingest:**
  - Der Plan entsteht außerhalb von `serializeToolWrite` (`testreport.ts:112`), `nodes.find(...)!` steht innerhalb (`:149`). Ein Knoten, der dazwischen gelöscht wird, führt zu einem TypeError.
  - `dryRun` antwortet `success:true` ohne Gate (`testreport.ts:115-126`).
- **`meldeZurueck`** startet den Host mit `stderr:'ignore'` (`aenderung-melden.mjs:24`). Meldungen des Hosts, zum Beispiel der Store-Neuaufbau, sieht die Spur nie.
