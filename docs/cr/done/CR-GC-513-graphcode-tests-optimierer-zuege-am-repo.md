# CR-GC-513: graphcode-Tests: Optimierer-Zuege am Repo-Graphen nach IO-02-Gate

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-050 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-050.json (Lane: code)

---

## Problem

Mit CR-SM-309 blockt IO-02 am Gate. Drei graphcode-Tests verlangten am Repo-Graphen einen anwendbaren
Optimierer-Zug und wurden rot:

| Test | Forderung | gemessen v261 |
|---|---|---|
| `suggest.merge` (CR-GC-444) | ≥ 1 Merge-Vorschlag `applicable` | 11 geliefert, 0 anwendbar — alle an IO-02 abgewiesen |
| `suggest.rehang` (CR-GC-435) | ≥ 1 Architektur-Vorschlag `applicable` | 0 — die anwendbaren waren nur Merges |
| `arch.optimization-dry-run` Lauf A | Aktionsraum nicht leer, gepinnte Plateau-Kette | 0 Zuege |

Ursache und Umsetzung im Operator: CR-SM-309 (OP-MERGE nur noch fuer echte Duplikate). Danach liefert
`graph_suggest` am Repo-Graphen **keinen** Merge mehr — das Modell traegt kein Duplikat.

## Umsetzung (Tests, kein Produktcode)

- `tests/gate.io02-blocks.test.ts` (neu): am echten Gate mit Disk-Kuzu — ein zweiter Produzent wird abgewiesen,
  einziger Sperrgrund IO-02, nichts erreicht den Store; ein weiterer Leser und der IO-02-Fix (eigener FLOW,
  geteiltes SCHEMA) gehen durch.
- `tests/suggest.merge.test.ts`: Anwendbarkeit an einer Duplikat-Fixture belegt (genau ein Merge
  `FLOW-b→FLOW-a`, `applicable: true`). Am Repo-Graphen gilt jetzt die Invariante „jeder gelieferte Merge ist
  anwendbar" — Operator und Gate urteilen gleich; die Anzahl wird berichtet.
- `tests/suggest.rehang.test.ts`: Am Repo-Graphen wird die Anwendbarkeit berichtet statt gefordert; gefordert
  bleibt: kein OP-MERGE scheitert am Gate, jeder anwendbare retire-Edit ist ein Verbund. Die Anwendbarkeit des
  Umhaengens belegt weiterhin Nachweis 1 an der Fixture.
- `tests/arch.optimization-dry-run.spike.test.ts`: Befund neu gemessen und gepinnt — 0 Zuege, 0 Reste, kein
  `worstAt` (die verbleibenden Vorschlaege tragen keinen Edit, also kein Verdict). `dominant` wird jetzt aus allen
  beurteilten Vorschlaegen gelesen, nicht nur aus anwendbaren. Kommt ein Zug dazu, wird der Test rot.

## Messung

- Volle Suite: **137 Dateien / 1092 Tests gruen** — erstmals heute ohne rote Datei.
- `tests/perf.advisory-roundtrip.spike.test.ts` (ITEM-2026-037) ist dabei gruen geworden, nachgemessen:

  | | vorher (heute, 3 Laeufe) | nachher |
  |---|---|---|
  | Wachstumsfaktor 500 → 2000 Knoten | 4,61 / 5,05 / 5,31 | **1,84** (Schranke < 3) |
  | ms/Knoten bei 2000 | 4,76 | 2,09 |
  | propose bei 2000 Knoten | 8507 ms | 3076 ms |

  Die elf Merge-Vorschlaege wurden je einzeln per Δm-Sonde und Gate-dryRun beurteilt — das war der
  ueberlineare Anteil.
- `npm run type-check` und `npm run lint` gruen.
- Kongruenz: kein Modellzug, kein `src/`-Symbol beruehrt.

## Bewusst offen

- Der Optimierer hat am Repo-Graphen keinen anwendbaren Architektur-Zug. Ein Operator, der zur Entscheidung
  „ein FLOW je Verbindung" passt, existiert nicht.
- Laufender MCP-Host und gve-Viewer halten den alten Code bis zum Neustart.
