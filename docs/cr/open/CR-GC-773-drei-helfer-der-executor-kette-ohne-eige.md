# CR-GC-773: Drei Helfer der Executor-Kette ohne eigenen Vertrag: Faltung, Fund-Kontext, Dublettensuche

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-803 (finding)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-803.json (Lane: code)

---

## Befund

CR-GC-770 hat die drei Helfer nicht sauber gelöst:

- **Faltung und Fund-Kontext** gingen im Inventar-Kanal auf. Preis: `src/loop/faltung.ts` und
  `src/loop/fund-kontext.ts` waren an keine Funktion mehr gebunden; eine Änderung dort ließ die
  Code-Testspur auf den Volllauf zurückfallen.
- **Die Dublettensuche** blieb ein Knoten ohne Fluss zu ihrem Aufrufer. Die Executor-Kette war deshalb
  nicht bewertbar.

Wurzel in allen drei Fällen: Das Ergebnis des Helfers war im Code nur ein TypeScript-Typ. Ohne Vertrag
gibt es im Modell keinen Fluss, ohne Fluss kein Glied einer Kette.

## Lösung

Jeder Helfer bekommt seinen Vertrag — im Code und im Modell.

| Helfer | Vertrag im Code | Fluss im Modell | Abnehmer |
|---|---|---|---|
| Faltung | `Faltung` in `src/loop/faltung.ts` | `FLOW-faltung` | Inventar-Kanal |
| Fund-Kontext | `FundKontext` in `src/loop/fund-kontext.ts` | `FLOW-fund-kontext` | Inventar-Kanal |
| Dublettensuche | `DuplicateHit` in `src/kernel/measure/nd-similarity.ts` | `FLOW-duplicate-hits` | Gate-Zugang des Executors |

- Die drei Typen sind jetzt Zod-Schemata; der TypeScript-Typ wird daraus abgeleitet.
- `FUNC-compose-faltung` und `FUNC-fund-kontext` sind wieder eigene Funktionen, gebunden an ihre Datei.
- Neuer Block `FUNC-block-rundenprompt` unter dem geparkten Antrieb: Runden-Injektion, Inventar-Kanal und
  die zwei Helfer. Ohne ihn hätte der Antrieb elf Kinder auf einer Ebene (Grenze neun).
- Die Dublettensuche liest nicht mehr den ganzen Graph-Zustand, sondern das, was der Code ihr gibt:
  den Entwurf und den Element-Index.

## Mitgefunden und behoben

Die Dublettensuche erfüllte im Modell eine Anforderung, die sie nicht erfüllt: `REQ-near-duplicate-detection`
beschrieb die Ähnlichkeitsmatrizen der Regeln ND-01/ND-02. Die rechnen seit CR-SM-286 die Contracts selbst.

- `REQ-near-duplicate-detection` neu gefasst, erfüllt von der Regelauswertung.
- Neu `REQ-duplicate-hint` für den Hinweis vor dem Schreiben, erfüllt von der Dublettensuche.

## Tests

- Rot zuerst: `tests/helfer-vertraege.test.ts` — je Helfer kommt das echte Ergebnis durch sein Schema, ein
  Ergebnis mit fehlendem Feld wird abgewiesen.
- Im Modell `TEST-helfer-vertraege`, prüft die drei Verträge.

## Ergebnis

| | vorher | nachher |
|---|---|---|
| Bewertbare Wirkketten | 23 von 25 | 24 von 25 |
| Befunde Stufe Datenfluss | 6 | 5 |
| Neue Regelbefunde | — | 0 |

Offen bleibt `FCHAIN-schema-migration` (ein loses Glied), nicht Teil dieser CR.

## Volllauf

`npm run verify:full CR-GC-773`: 199 von 202 Dateien grün. Rot:

- `tests/arch.optimization-dry-run.spike.test.ts` — **Schlupf**, außerhalb der Auswahl. Die festgeschriebene
  Autopilot-Messung hat sich durch den Modellzug verschoben: der Autopilot hängt einen zweiten falschen Zug an
  (Regelauswertung nach `MOD-agent-surface`). Neu gemessen und festgeschrieben; der Befund bleibt ITEM-2026-798.
- `tests/distribution.test.ts`, `tests/lockfile-sync.test.ts` — erwartet im Link-Modus (contracts 11.1 unveröffentlicht).

Der erste Volllauf hing 20 Minuten ohne Last und wurde abgebrochen; der zweite lief durch. Ursache des Hängers
nicht gefunden.
