# CR-GC-846: Aufrufkanten für RC-12 liefern

**Status:** ✅ Done (2026-10-25)
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
- RC-13 (Aufruf ohne Fluss, dieselben `callEdges`) meldet am Selbstmodell 0 Paare, sobald CR-GC-849 durch ist; vorher 36.
- Ein absichtlich falscher Abnehmer im Testrepo erzeugt eine RC-12-Warnung.
- Die Dauer einer vollen Auswertung vorher und nachher steht im CR.
- Antwortlänge: `rules_evaluate`, `rules_get_violations` und `graph_readiness` wachsen am Selbstmodell um höchstens eine Zeile (die Abdeckung als Zahlen je Grund, kein Text je Paar). Gemessen vorher und nachher, Zeichen je Antwort im CR.

## Ergebnis

Umgesetzt am 2026-10-25 gegen contracts 12.7.0 (Arbeitskopie, CR-SM-415). Die Mindestversion `>=12.7 <13` und die übrigen Folgen von 12.7.0 zieht CR-GC-850 vorab nach; `lockfile-sync` und `distribution` bleiben rot bis zum Publish von contracts 12.7.0.

- `src/kernel/call-edges.ts` liefert `callEdges` und `callScope`. Das Symbol eines Knotens ist der Pfad der Deklaration (`GraphStore.open`, `eins.handler`), wie CR-SM-415 ihn liest.
- Die Lücken-Ergänzungen aus CR-GC-843 sind übernommen. Ein Versand über eine Signatur mit mehr als einer Implementierung erzeugt keine Kante.
- `callScope` sind die Dateien der `tsconfig.json`. Ohne `tsconfig.json` fehlen beide Felder, und RC-12/RC-13 schweigen.
- `callCoverage` steht in `rules_evaluate` und `graph_readiness` neben `importCoverage`.
- `scripts/fluss-aufruf.mjs` und `npm run abgleich:fluss` sind gelöscht. Der Test heißt jetzt `tests/call-edges.test.ts` und prüft die Kanten; dazu je ein Fall, dass RC-12 und RC-13 in graphcode ankommen.
- se-vorbereitung Schritt 4 liest RC-12, RC-13 und `callCoverage` aus `rules_evaluate`.

**Selbstmodell:** RC-12 meldet 0 Befunde bei 190 beurteilten Paaren, RC-13 meldet 0. `callCoverage`: `{"checked":190,"unbound":117,"outOfScope":10,"async":15,"syncUnknown":0,"anchored":71}`. Das Skript zählte am selben Stand 190 prüfbare Paare ohne „kein Aufruf". Die Zahl 158 in der Akzeptanz stammt vom 2026-10-23, vor den Flüssen aus CR-GC-849.

**Testrepo:** Ein absichtlich falscher Abnehmer (`FLOW-falsch`) gibt RC-12, ein Aufruf ohne Fluss gibt RC-13 (`tests/call-edges.test.ts`).

**Dauer einer vollen Auswertung** am Selbstmodell, je drei Aufrufe in einem Prozess:

| Werkzeug | vorher | nachher |
|---|---|---|
| `rules_evaluate` | 435 · 341 · 317 ms | 1647 · 380 · 346 ms |
| `rules_get_violations` | 316 · 321 · 306 ms | 344 · 340 · 350 ms |
| `graph_readiness` | 372 · 386 · 363 ms | 407 · 396 · 409 ms |

Die erste Auswertung eines Prozesses baut den LanguageService, etwa 1,2 s. Danach rechnet der Host die Kanten nur neu, wenn sich der Inhalt einer Datei der tsconfig ändert; der Abgleich des Stands kostet etwa 30 ms. Ohne dieses Merken kostete jede Auswertung etwa 1 s mehr (gemessen 1279–1339 ms).

**Antwortlänge** am Selbstmodell, Zeichen je Antwort:

| Werkzeug | vorher | nachher |
|---|---|---|
| `rules_evaluate` | 633 943 | 634 045 (+102, das Feld `callCoverage`) |
| `rules_get_violations` | 633 938 | 633 938 |
| `graph_readiness` | 6 626 | 6 728 (+102, das Feld `callCoverage`) |

Die Vorher-Werte sind mit contracts 12.7.0 gemessen, ohne Aufrufkanten. Mit 12.6.0 waren es 650 703 / 650 698 / 6 604 Zeichen.
