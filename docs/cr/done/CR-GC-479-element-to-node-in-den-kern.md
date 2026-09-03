# CR-GC-479 — `elementToNode` gehört dem Kern

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467; der letzte Nicht-Typ-Eintrag
der Altlast, nach CR-GC-478

## Root Cause

`kernel/harness-import.ts` — der Import-Pfad des Kerns (`seedFromJson`, `reseed`,
`importGraph`) — wandelt jedes SSOT-Element mit `elementToNode` in einen `GraphNode` und
importiert die Funktion aus `projections/exporter.ts`. Der Kern kennt den Exporter. Die Funktion ist
aber kein Export, sondern die **Umkehrung** des Exports: JSON-Element → Store-Knoten, mit dem
Flachziehen der verschachtelten `attributes` (CR-GC-219). Ihr Kommentar nennt sie „the single import
mapping — shared by `harness.importGraph` and `scripts/export-graph.mjs`". Ein Import-Mapping, das der
Kern braucht, liegt im Kern; der Exporter importiert die Gegenrichtung von unten.

## Änderung

- `src/kernel/element-node.ts` (neu): `elementToNode` und der Helfer `flattenNestedAttributes`,
  verbatim aus `exporter.ts`. Der Exporter importiert, was er davon braucht, aus dem Kern — nach unten.
- `harness-import.ts`: `./element-node.js`. `index.ts`: Re-Export aus `./kernel/element-node.js`
  (Paket-Oberfläche unverändert). Drei Tests folgen dem Pfad.
- Ratchet **14 → 13** — damit besteht die Altlast nur noch aus den 13 Typ-Importen des
  Tool-Interfaces (Strang A).
- Gate: kein Knoten trägt einen `realRef` auf `elementToNode` (Exporter-`realRef`s: `exportMarkdown`,
  `MarkdownViewSchema`) — kein Batch, SSOT unverändert.

## Akzeptanzkriterien

- [x] `harness-import.ts` importiert nichts aus `projections/`; Build grün.
- [x] `codec.roundtrip`, `conformance`, `export-graph-guard`, `harness.import*`, Ratchet grün;
      volle Suite im Pre-Commit grün.
- [x] Ratchet-Liste enthält ausschließlich `[type]`-Einträge auf `surface/mcp-tools` und
      `surface/tool-context`.

## Dateien

1. `src/kernel/element-node.ts` (neu)
2. `src/projections/exporter.ts`
3. `src/kernel/harness-import.ts`
4. `src/index.ts`

Folgen: drei Tests, `tests/import-boundaries.test.ts`, ggf. SSOT-Export, dieser CR.
