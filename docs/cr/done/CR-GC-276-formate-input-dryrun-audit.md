# CR-GC-276 — graph_mutate: Format-E-Input, dryRun, Preview-Audit

**Status:** ✅ Done (2026-07-29)
**Typ:** Feature + Bugfix (Befund aus dem Greenfield-Trial 2026-07-29)

## Befund (Trial)

133k Output-Tokens, dominiert von 6 `graph_mutate`-Batches mit 356 Kommandos
als JSON. Gemessen am Trial-Graphen (104 Knoten/207 Kanten): Format-E 24.300
Zeichen vs. 50.715 (kompaktes JSON) — Faktor 2,1–2,8. Dazu ein echter Bug:
der `se:generate`-Skill verwies auf `graph_mutate {dryRun:true}`, das Tool
hatte aber **keinen** dryRun-Parameter — Zod strippte das Feld stillschweigend,
alle „Previews" wurden real angewendet.

## Änderungen (eine Schreib-Grenze, ein Gate — kein zweiter Schreibweg)

1. **`formatE`-Input:** alternativ zu `commands` nimmt `graph_mutate` einen
   Format-E-v2-Block (dasselbe Dialekt wie die Read-Slices). Decode via
   `GraphCodeCodec` → add-node/add-edge-Kommandos → **dasselbe** Gate.
   Upsert-Semantik; deletes/updates/merges weiterhin nur als `commands`.
   Codec-Fehler = Block-Verdict (STRUCT), kein Transport-Crash.
2. **`dryRun` am Tool:** volles Gate-Verdict (tier/violations/`fitAdvisory`),
   nichts persistiert (CR-GC-234); Working Copy via `loadGraph()` restauriert,
   `graphVersion` unbewegt.
3. **Preview-Audit (F2-Evidenz-Lücke zu):** jeder dryRun landet als
   `operation:'validate'`-Eintrag im Audit-Log — Vorschlag (commands) +
   Verdict (applied/rejected + Violations), **auch verworfene Kandidaten**.
   `readBranchLog` filtert jetzt auf `operation:'mutate'` — validate-Einträge
   werden nie mitgereplayt; die Version bewegt sich nicht (kein OCC-Stale
   für andere Writer).

Skill `se:generate` angepasst: Batches bevorzugt als `formatE`, Previews
explizit als Evidenz benannt.

## Akzeptanzkriterien

- [x] formatE-Batch mutiert identisch zu commands (Gate, Mutations, Version)
- [x] Ungültiger Format-E-Block → Block-Verdict mit Codec-Meldung
- [x] dryRun: Verdict + fitAdvisory, Graph unverändert, Version unbewegt
- [x] Preview-Audit: applied- UND rejected-Preview im Log inkl. commands; Merge-Replay überspringt beide
- [x] Schema erzwingt genau eins von commands|formatE
- [x] Volle Suite 336/336 grün

**Dateien:** `src/tools/write.ts`, `src/tool-context.ts` (recordPreview),
`src/merge.ts` (Replay-Guard), `.claude/skills/se-generate.md`,
`tests/mcp.mutate-input.test.ts`, dieses Doc.
