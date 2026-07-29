# CR-GC-273 — graph_suggest: se-optimizer-Binding mit dryRun-Verdict

**Status:** ✅ Done (2026-07-29)
**Typ:** Feature (aimpro-Fahrplan-Schritt 3, graphcode-Hälfte; Paket-Hälfte = sigloch-modules CR-SM-225)

## Beschreibung

Neues read-only MCP-Tool `graph_suggest` (eigene Gruppe `tools/suggest.ts` —
report.ts-Size-Guard): dünnes Binding auf `@sigloch/se-optimizer@0.3.0`
(`targetFor`/`suggestEdits`). Gegeben eine Zielrichtung im ℝ⁶-Metrikraum
(Gewichte je Dimension), ranke die feuernden Operator-Regeln nach `Δm·t̂`.

Spike-2-Design (aimpro `docs/spike/revisit_suggestions.md`): ausgeliefert wird
die **Fund-Ebene** (Violation + Richtung + Δm, Default-Messebene `layer:'arch'`);
ein konkreter Edit nur, wenn ein rule-spezifisches Fix-Template ihn
deterministisch herleitet (CR-R01/CR-R04/MS-03/UC-02). Jeder Template-Edit
läuft als `dryRun` (CR-GC-234) durchs volle Gate und kommt mit 3-Tier-Verdict
zurück; nach jedem Preview restauriert `loadGraph()` die In-Memory-Kopie.
**Nie auto-apply** — anwenden geht nur über `graph_mutate`. Previews laufen auf
der Tool-Schreibkette (`serializeToolWrite`), kein Interleaving mit echten Writes.

## Akzeptanzkriterien

- [x] `graph_suggest` im Registry beider MCP-Clients (agent-agnostic-Test erweitert)
- [x] Fund-Ebene für jede feuernde Operator-Regel, score-absteigend, deterministisch
- [x] Template-Edit trägt dryRun-Gate-Verdict (tier/success/violations); Fund-only ohne verdict
- [x] Read-only: Graph nach Aufruf byte-identisch (Kanten-/Knotenzahl unverändert)
- [x] `npm run build` grün; Suite 321/321 bis auf `distribution.test.ts`

## Offener Blocker

`distribution.test.ts` rot, solange `@sigloch/se-optimizer@0.3.0` nicht auf npm
publiziert ist (E404 beim Tarball-Install in Fremd-Repo). Lokal via `npm link`
(in `link:siblings` aufgenommen). **Nächste Aktion:** `npm publish` in
sigloch-modules/packages/se-optimizer, dann Test grün ohne Code-Änderung.

**Dateien:** `src/tools/suggest.ts`, `src/mcp-tools.ts` (Registry + Header),
`package.json` (dep + link:siblings), `tests/mcp.suggest.test.ts`,
`tests/mcp.agent-agnostic.test.ts` (Tool-Liste), dieses Doc.
