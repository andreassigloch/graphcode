# CR-GC-480 — Der Tool-Vertrag gehört dem Kern (Strang A, Rest)

**Status:** done · **Angelegt:** 2026-09-03 · **Abgeschlossen:** 2026-09-03 · **Herkunft:** CR-GC-467, Strang A; die letzten 13
Einträge der Altlast — alle `import type`

## Root Cause

`loop` und `projections` bauen ihre MCP-Tools selbst (`bind*Tools(ctx)`), und importieren dafür
`MCPTool`, `MCPToolRegistry` und `ToolContext` aus `surface`. Die Schicht kennt das Werkzeug-
Interface ihrer Oberfläche — 13 Inversionen, alle Typen, keine Laufzeitkopplung, aber dieselbe
Richtung. `MCPTool`/`MCPToolRegistry` sind neun Zeilen mit einer Abhängigkeit (`zod`);
`ToolContext` ist der volle Host-Kontext (Codec, Audit-Origin, Session, OCC…), von dem jede
Fabrik genau **fünf** Member destrukturiert: `harness`, `auditLog`, `graphVersion`,
`recordAudit` (drei Argumente, nie `stamps`), `serializeToolWrite`.

## Änderung — Interface Segregation, ein Zug

- `src/kernel/tool-contract.ts` (neu): `MCPTool`, `MCPToolRegistry` verbatim; **`ToolPort`** mit
  genau den fünf Membern. Keine Projections-Typen: `recordAudit` im Port ohne den optionalen
  `stamps`-Parameter (den nur die Oberfläche kennt) — ein `ToolContext` mit dem zusätzlichen
  optionalen Parameter bleibt dem Port zuweisbar.
- `surface/tool-context.ts`: `ToolContext extends ToolPort`. `surface/mcp-tools.ts`: importiert die
  Typen aus dem Kern, definiert sie nicht mehr.
- Die acht Fabriken/Konsumenten in `loop` und `projections`: Typen aus `../kernel/tool-contract`;
  die fünf `bind*Tools(ctx: ToolContext)` werden `(ctx: ToolPort)` — die Signatur sagt jetzt, was
  die Fabrik braucht.
- Fünf `surface`-Importeure und das Barrel: Typen aus dem Kern. Tests folgen dem Pfad.
- Ratchet **13 → 0**: `DEBT` ist leer, der Test ist ab jetzt ein reines Verbot.

**Schnitt, bewusst:** 17 Dateien (1 neu, 2 Definitionen, 13 Importeure, Barrel) in einem Zug —
Auftraggeber-Entscheidung 2026-09-03 („wie vorgeschlagen"). Jeder Zwischenstand ohne Re-Export am
alten Ort wäre rot; ein Re-Export wäre der parallele Pfad. Rein mechanisch: kein Laufzeitpfad
ändert sich, `tsc` + Ratchet + volle Suite sichern ab.

## Akzeptanzkriterien

- [x] `grep -rn "surface/mcp-tools\|surface/tool-context" src/loop src/projections` leer; Build grün.
- [x] `DEBT = []`; der Ratchet-Test bleibt grün; ein künstlich eingefügter Import nach oben macht
      ihn rot (Gegenprobe, einmalig).
- [x] MCP-Tool-Tests (`mcp.*`, `schema-parse-at-interface`, `auto-export`, `metrics`, `testreport`,
      `generate`, `target-profile`, `host-shim`) grün; volle Suite im Pre-Commit grün.
- [x] Modell: `FUNC-bind-tools` und `FUNC-tool-context` behalten ihre `realRef`s (die Funktionen
      bleiben, nur die Typen wandern) — kein Batch.

## Dateien

1. `src/kernel/tool-contract.ts` (neu) · 2. `src/surface/mcp-tools.ts` · 3. `src/surface/tool-context.ts`
4–6. `src/loop/executor-prompt.ts`, `executor.ts`, `suggest.ts`
7–11. `src/projections/auto-export.ts`, `export.ts`, `metrics.ts`, `report.ts`, `testreport.ts`
12–16. `src/surface/audit.ts`, `host-shim.ts`, `mcp-server.ts`, `read.ts`, `write.ts`
17. `src/index.ts`

Folgen: Test-Pfade, `tests/import-boundaries.test.ts`, dieser CR.
