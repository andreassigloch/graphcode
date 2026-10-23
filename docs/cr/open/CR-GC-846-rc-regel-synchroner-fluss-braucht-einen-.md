# CR-GC-846: Aufrufkanten für RC-12 liefern

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1037 (finding)
**Erstellt:** 2026-10-23
**Item:** bok/items/ITEM-2026-1037.json (Lane: code)
**Hängt an:** sigloch-modules CR-SM-415 (RC-12 und das Feld `callEdges`). Start erst nach dem contracts-Bump.

---

## Befund

CR-GC-843 prüft Fluss gegen Aufruf als Skript (`scripts/fluss-aufruf.mjs`). Die Prüfung läuft nur, wenn jemand `npm run abgleich:fluss` startet. CR-SM-415 macht daraus die Warnregel RC-12; graphcode muss ihr die Aufrufkanten liefern.

## Änderung

- Die Aufrufsuche aus `scripts/fluss-aufruf.mjs` zieht nach `src/kernel/` und füllt `callEdges` und `callScope` in `extractCodeFacts`. Das Urteil fällt RC-12 in contracts, nicht graphcode.
- Die Lücken-Ergänzungen aus CR-GC-843 bleiben: Interface-Fallback, `Pick<>`, destrukturierte Namen, Zod-Vertragseigenschaften, keine Verfolgung bei mehr als einer Implementierung.
- `callScope`: alle TS-Dateien unter der tsconfig. Skills, Skripte und Nachbarpakete fallen heraus und zählen als ungeprüft.
- `scripts/fluss-aufruf.mjs` und `npm run abgleich:fluss` werden gelöscht; se-vorbereitung Schritt 4 liest RC-12 und `callCoverage` aus `rules_evaluate`. Keine zwei Pfade.
- `tests/fluss-aufruf.test.ts` wird zum Test des Lieferanten (welche Kanten entstehen), das Urteil testet contracts.

## Kosten

Gemessen am 2026-10-23: ein Durchlauf im Prozess etwa 1 s, auch beim zweiten Mal, weil das Skript jedes Mal einen neuen LanguageService baut. Volle Auswertungen gab es vom 23.09. bis 23.10. 255 in 33 Sitzungen (`rules_evaluate` 123, `graph_readiness` 67, `rules_get_violations` 54, `graph_help` 11). Schreibzüge lösen keine aus. Ziel: den LanguageService im Host offen halten und nur bei geänderten Dateien neu rechnen; der Gewinn ist vor dem Bau zu messen, nicht anzunehmen.

## Umfang

`src/kernel/conformance.ts`, neue Datei für die Aufrufsuche in `src/kernel/`, `scripts/fluss-aufruf.mjs` (löschen), `package.json`, `tests/fluss-aufruf.test.ts`, `.claude/commands/se-vorbereitung.md`, Modellzug an FUNC-check-code-conformance.

## Akzeptanz

- `rules_evaluate` meldet RC-12 am graphcode-Selbstmodell mit 0 Warnungen und eine Abdeckung von 158 geprüften Paaren.
- Ein absichtlich falscher Abnehmer im Testrepo erzeugt eine RC-12-Warnung.
- Die Dauer einer vollen Auswertung vorher und nachher steht im CR.
- Antwortlänge: `rules_evaluate`, `rules_get_violations` und `graph_readiness` wachsen am Selbstmodell um höchstens eine Zeile (die Abdeckung als Zahlen je Grund, kein Text je Paar). Gemessen vorher und nachher, Zeichen je Antwort im CR.
