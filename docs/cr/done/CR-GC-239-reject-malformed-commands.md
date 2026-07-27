# CR-GC-239 — graph_mutate: malformed Commands hart ablehnen (kein stilles No-op)

**Status:** done · 2026-07-05
**Paket:** `@sigloch/graphcode` (MCP-Server + Harness-applyCommands)
**Quelle:** graph-view-edit CR-Closeout-Session 2026-07-05 (Live-Befund, reproduzierbar im Audit-Log)

## Problem (Befund)

`graph_mutate` akzeptierte einen Batch mit falschen Command-Shapes (`op:"add_node"` mit flachen Feldern statt kanonisch `op:"add-node"` + `node:{}`) und meldete `success:true, appliedCommands:21, tier:"auto-apply"` — bumpte graphVersion, schrieb den Audit-Eintrag mit `result:"applied"` — **persistierte aber nichts** (`mutations:0`; Folge-Query: Knoten nicht vorhanden). Sechs Batches einer Session waren so stille No-ops; entdeckt erst durch den Refuse-Guard des Exports.

Verstöße:
1. **Kein Zod-Parse pro Command** am MCP-Eingang (`commands: items {}`) noch in `applyCommands` — `MutateCommandSchema` (contracts) existiert genau dafür.
2. **Audit lügt:** `result:"applied"` + graphVersion-Bump für einen No-op; die Command-Shapes landen verbatim im Log.
3. **`mutations:0` ist das einzige Signal** und wird von keinem Tier/Success-Feld reflektiert.

## Änderung

1. Jeden eingehenden Command gegen `MutateCommandSchema` parsen; Parse-Fehler ⇒ ganzer Batch `tier:"block"`, `success:false`, Violation `SCHEMA-01` mit Zod-Pfad + erwarteter Shape pro fehlerhaftem Command. Kein graphVersion-Bump, kein `result:"applied"`-Audit-Eintrag (stattdessen `result:"rejected"`).
2. Invariante: `success && appliedCommands>0 ⇒ mutations>0` — sonst interner Fehler (assert + Log).

**Umsetzung:** Parse im Gate (`harness.applyMutation` Step 0), nicht am MCP-Eingang — ein
Enforcement-Punkt für MCP- UND in-process-Aufrufer (keine parallelen Pfade). graphVersion-Bump und
`result:"applied"` hängen bereits an `success` (recordAudit, CR-233) — mit `success:false` aus dem
Gate sind (2)/(3) automatisch korrekt. Invariante als stderr-Warnung, nicht als hartes Assert:
nach dem Schema-Guard sind verbleibende 0-Mutation-Batches legitime No-ops (idempotentes
delete-edge, update-edge auf verschwundene Kante — CR-238).

## Akzeptanz

- [x] `{op:"add_node", uid:…}` (Underscore/flach) ⇒ block + SCHEMA-01 mit fixHint auf kanonische Shape
- [x] Audit-Eintrag `result:"rejected"`, graphVersion unverändert
- [x] Kanonische Batches regressionsfrei (Suite 269/269 grün)
