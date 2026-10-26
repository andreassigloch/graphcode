# CR-GC-854: verify:full schreibt rot 0, obwohl vitest ohne Bericht endet

**Status:** ✅ Done (2026-10-26)
**Typ:** aus Item ITEM-2026-1075 (bug)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1075.json (Lane: code)

---

## Befund

Am 2026-10-25 schlief der Mac während `npm run verify:full CR-GC-796`. vitest zeigte
`tests/import-code-verb.test.ts` rot (Test-Timeout nach 306 s Wanduhr), lief 46 von 194 Dateien
und endete dann mit exit 0 — ohne Zusammenfassung und ohne JSON-Bericht (Log:
`scratchpad/full-796.log` der Sitzung 6b890fa1). `verify:full` schrieb „rot 0" in
`docs/messung/testauswahl.jsonl` und endete mit exit 0.

## Root Cause (5× Warum)

1. Warum „rot 0"? `rot` war `[]`. 2. Warum? `verify-full.mjs` las `rot` nur aus dem Bericht und
ließ `rot = []`, wenn es keinen Bericht gab; `gesamt` fiel auf `ctx.allTests.length` zurück.
3. Warum kein Bericht? vitest schreibt ihn erst am Laufende; der Lauf endete vorher.
4. Warum exit 0? Das Skript übernahm den Exit von vitest, und vitest endete mit 0. Warum vitest
nach dem Ruhezustand ohne Abschluss mit 0 endete, ist nicht geklärt (nicht reproduziert:
Signal → `status null`, Worker-Absturz → exit 1 mit Bericht).
5. Warum fiel das nicht auf? Das Urteil hing an einer Quelle, nicht an Bericht und Exit zusammen.
Am Code gefunden, zweite Lücke derselben Art: ein Fehler außerhalb eines Tests (Unhandled Error)
gibt exit 1, im Bericht steht jede Datei `passed` — `verify:full` schrieb auch dann „rot 0".

Nicht betroffen: Test-Timeout, Hook-Timeout, Fehler beim Import. Der Bericht nennt die Datei als
`failed` (Positivkontrollen im Test).

## Änderung

- `laufUrteil` (`src/projections/test-schlupf.ts`): Beleg nur mit Bericht; vitest rot ohne rote
  Datei ist kein Beleg. Grün = Beleg ohne rote Datei.
- `scripts/verify-full.mjs`: kein Beleg → rot, keine Messzeile; die Rückmeldung an
  `graph_test_ingest` läuft weiter (betroffene Tests verlieren ihr Ergebnis). Exit aus dem Urteil.
- `scripts/verify-code.mjs`: derselbe Weg für den Exit.
- Test: `tests/test-schlupf.test.ts` fährt echtes vitest auf einer Wegwerf-Suite.
- Modell: `REQ-lane-red-without-report` (satisfy von beiden Spuren, verify von
  `TEST-test-schlupf`).

## Alte Messzeilen

Keine Zeile geändert. Geprüft an den erhaltenen Logs der Sitzung 6b890fa1 (seit 2026-10-22):

- CR-GC-796, 2026-10-25T20:57Z: aus dem Nachlauf, Log mit „194 passed" und „JSON report
  written". Die falsche Zeile des ersten Laufs hat der Agent per `git checkout` verworfen; sie
  war nie committet.
- Die übrigen 15 Zeilen seit 2026-10-22T13:36Z: jede hat ein Log mit vitest-Zusammenfassung
  oder „JSON report written"; die Zahl roter Dateien stimmt mit dem Log überein. CR-GC-841 vom
  2026-10-23T00:37Z (7 rot + 1 Unhandled Error) ist schon mit a3c7c6f7 entfernt.
- Nicht prüfbar: die 85 Zeilen vor 2026-10-22T13Z, davon 28 mit leerem `rot` (24 der Spur
  CODE). Für sie gibt es kein Log mehr; die Zeile selbst unterscheidet „kein Bericht" nicht
  von „grün".


## Umfang laut `graph_impact`

- `FUNC-verify-lane-full`, `FUNC-verify-lane-code`, `FUNC-measure-test-schlupf`,
  `REQ-lane-red-without-report` (relation-Kanten gesetzt).
- `graph_tests`: `tests/test-schlupf.test.ts`.
