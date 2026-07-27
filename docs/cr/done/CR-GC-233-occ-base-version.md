# CR-GC-233: OCC — graphVersion + baseVersion-Check am Gate (stale-write rejection)

**Status:** Open (2026-07-02) · **Milestone:** `MS-7-concurrency` · **Max Files:** 4
**Graph (SSOT):** geseedet (gate-only) `CR-GC-233`; REQ/FUNC/TEST bei Pick-up. Pointer, nicht autoritativ.
**Kontext:** Enterprise-Merge-Ladder Stufe 2; realisiert R5s `base_snapshot@version` (RECOMMENDATIONS).

## Problem (Why)

User-Anforderung (2026-07-02): *„if someone writes to a database changes from his last read access,
a conflict mitigation starts."* Heute akzeptiert das Gate jeden strukturell gültigen Write — auch wenn
das Modell sich seit dem Read des Schreibers geändert hat (lost-update-Fenster, sobald mehrere Clients
eine Write-Channel teilen, CR-235). Enterprise-Muster: **Optimistic Concurrency Control** (DynamoDB
conditional writes, ES `if_seq_no`) — Write trägt die Basis-Version; veraltet → Reject + Retry, nie Merge.

## Decision

- **`graphVersion`**: monotoner Counter pro Store, +1 pro **applied** Mutate-Batch; **persistiert**
  (abgeleitet aus dem durablen Command-Log von CR-232: Version = Anzahl applied Einträge — kein zweiter
  Persistenz-Pfad). Reseed setzt die Version NICHT zurück (Log läuft weiter).
- **Read-Seite:** `graph_readiness`/`graph_elements`/`graph_get_node`/`graph_get_edges`/`graph_context`/
  `graph_impact` geben `graphVersion` im Result mit (additives Feld).
- **Write-Seite:** `graph_mutate` (+ `graph_realize`) akzeptiert optionales `baseVersion`.
  `baseVersion < graphVersion` → **Reject** (`success:false`, `tier:'block'`) mit **Delta-Report**: die
  Audit-Einträge zwischen `baseVersion` und jetzt (aus CR-232) — der Agent sieht *was* sich geändert hat,
  re-read, retry. Ohne `baseVersion` → Warnung im Result, kein Block (sanfte Migration; Pflicht wird mit
  CR-235 evaluiert).
- **Kein Contracts-Bump:** `baseVersion`/`graphVersion` sind Felder der **MCP-Tool-Schemas** (lokal),
  nicht der `MutateCommand`/`MutateResult`-Contracts. Promotion nach `@sigloch/contracts` = späterer
  Family-Review (Drift-Lock greift nicht).

## Akzeptanz

- Write mit aktueller `baseVersion` → applied; Version inkrementiert; Read liefert die neue Version.
- Write mit veralteter `baseVersion` → Reject + Delta-Report (die zwischenzeitlichen Einträge, nicht nur „stale").
- Version übersteht Prozess-Restart (aus dem Log rekonstruiert).
- `GRAPHCODE.md`-Scaffold dokumentiert den Read→Mutate-Retry-Loop (eine Zeile im Graph-first-Abschnitt).
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- Per-Node-Versionen (feingranulare OCC) — erst falls Batch-Level-OCC zu viele False-Conflicts erzeugt.
- `baseVersion` als Pflichtfeld — Entscheidung in CR-235.

## Dependencies

**CR-GC-232** (durables Log = Versions- + Delta-Quelle).
