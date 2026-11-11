# CR-GC-911: Tests reichen die Warnung zum fehlenden Lern-Protokoll nach stderr durch statt sie zu pruefen

**Status:** ✅ Done (2026-11-11)
**Typ:** aus Item ITEM-2026-1299 (finding)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1299.json (Lane: code)

---

## Befund

Die Ausgabe von `verify:model` zeigte 11-mal die Warnung „applied gate mutation(s) have no entry in the
repo's learning feed". Gemessen am 2026-11-11: das Protokoll des echten Repos ist vollständig, alle
Schreibvorgänge des Tages stehen in `.graphcode/trajectory.jsonl`. Die Warnungen kamen aus Tests in
Wegwerf-Repos, aus zwei Ursachen.

**1. Wettlauf, echter Fehler.** `graph_export` lief nicht in der Schreib-Warteschlange
(`serializeToolWrite`). Der Auto-Export (`post-apply`-Hook, Entprellung 250 ms) konnte deshalb zwischen
Gate und Feed-Eintrag laufen: die Marke `EXPORT_PENDING` war schon gezählt, der Feed-Eintrag von
`graph_mutate` noch nicht geschrieben. Ergebnis: eine gemeldete Mutation ohne Feed-Eintrag, die es nicht
gab. Unter Last trat das in `tests/auto-export.test.ts` auf; im Betrieb genauso, sobald ein Schreibzug
länger als die Entprellung braucht (Leitlinie T-E8: Median 4041 ms bei 2000 Knoten).

**2. Rohes `harness.mutate()` in Tests.** Fünf Testdateien bereiteten ihr Modell am Tool-Layer vorbei
vor, einer setzte die Marke von Hand. Dort war die Warnung korrekt; die Tests verstießen gegen die
Regel „jede Modelländerung über `graph_mutate`".

## Änderung

- `src/projections/export.ts`: der Handler von `graph_export` läuft in `ctx.serializeToolWrite`, in
  derselben Form wie `graph_mutate` (`async handler` → `return ctx.serializeToolWrite(…)`). Ein Export
  wartet damit auf jeden laufenden Schreibzug samt Feed-Eintrag. Die Commit-Prüfung bestätigt die Form:
  ausgelagert in eine eigene Funktion fand RC-12 die Aufrufe unter dem Symbol `graph_export` nicht mehr.
- Modell: neuer Fluss `FLOW-export-write-slot` (`FUNC-graph-export-snapshot` → `FUNC-tool-context`,
  Vertrag `SCHEMA-export-answer`), nach dem Vorbild von `FLOW-write-slot` aus `graph_suggest`; ohne ihn
  meldet RC-13 einen Aufruf ohne Fluss.
- `tests/auto-export.test.ts`: neuer Test, der einen Export mitten im Schreibzug startet (aus dem
  `post-apply`-Hook). Vor dem Fix rot (`expected 1 to be undefined`), danach grün.
- Testvorbereitung über `graph_mutate` statt `harness.mutate()`: `tests/auto-export.shutdown-flush.test.ts`,
  `tests/graph-timetravel.test.ts`, `tests/mcp.export-guard.test.ts`, `tests/mcp.export.test.ts`,
  `tests/security.path-containment.test.ts` (dort zusätzlich die Handmarke durch die Prüfung der echten
  Marke ersetzt).

## Nachweis

- Die sechs Testdateien: 26 Tests grün, 0 Warnungen (vorher 11).
- `npm run build` grün; `verify:code`: 55 Dateien, 469 Tests grün.
- Smoke: MCP-Host mit dem neuen Build neu gestartet (15:20, Build 15:15), `graph_export` über ihn ohne
  `unfedMutations`.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
- `verify:full CR-GC-911`: 1741 von 1742 Tests grün, Schlupf 0. Rot: `tests/arch.optimization-dry-run.spike.test.ts`
  (Prüfsumme der Repo-SSOT während des Laufs geändert). Ursache: mein eigener `graph_mutate` (CR-Kante,
  graphVersion 1060) während des Laufs, den der Auto-Export in `docs/graph/` schrieb. Einzeln wiederholt: grün.
