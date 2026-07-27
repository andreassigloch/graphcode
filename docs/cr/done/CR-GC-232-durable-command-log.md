# CR-GC-232: Durables Command-Log (append-only Audit-Persistenz)

**Status:** Open (2026-07-02) · **Milestone:** `MS-7-concurrency` (neu, mit CR-233/234/235) · **Max Files:** 4
**Graph (SSOT):** geseedet (gate-only) `CR-GC-232`; REQ/FUNC/TEST bei Pick-up. Pointer, nicht autoritativ.
**Kontext:** Enterprise-Merge-Ladder Stufe 1 (232→233→234→235); Analyse siehe `docs/CONCURRENCY.md` + Chat 2026-07-02.

## Problem (Why)

`bindToolsToHarness` defaultet auf `InMemoryAuditLog` — das Command-Log **stirbt mit dem Prozess**.
Damit ist `audit_trail` nur session-lokal, und die beiden Enterprise-Bausteine, die darauf aufbauen,
sind unmöglich: der **OCC-Delta-Report** („was hat sich seit deinem Read geändert", CR-233) und der
**Replay-Merge** („spiele das Branch-Log durchs Gate auf der neuen Base ab", CR-234). Event-Sourcing-
Prinzip: das durable Operations-Log ist die Konvergenz-Grundlage — State wird abgeleitet, nie gemerged.

## Decision

- **`src/audit-file.ts`**: `FileAuditLog implements AuditLog` (Interface aus `@sigloch/graph-api-core`,
  kein Fork) — append-only **JSONL** unter `.graphcode/audit.jsonl` (gitignored, per Store/Worktree —
  wie der Store selbst). Jede Zeile = ein `AuditEntry` **inkl. des `MutateCommand[]`-Batches** (lokale
  additive Erweiterung `GraphcodeAuditEntry.commands` — ohne Commands ist der 234-Replay unmöglich;
  Contracts-Promotion später). **Append-only**: nie rewrite, nie delete; Korruptions-tolerant lesen
  (defekte Schlusszeile eines Crashs überspringen, warnen).
- **Log-Handling gleich mit (User-Entscheid 2026-07-03 — sonst Technical Debt):**
  - **Checkpoint-Record** als Versions-Anker: die erste Zeile eines kompaktierten Logs ist
    `{checkpoint, version, timestamp, reason}`; `latestVersion() = checkpoint.version + applied-Einträge
    danach`. Damit übersteht die **monotone `graphVersion` (CR-233) jede Compaction** — genau die
    Semantik, die nachträglich nicht mehr einbaubar wäre.
  - **Compaction** (`compact(reason)`): aktives Log → Archiv `.graphcode/audit-<ts>.jsonl` (gitignored,
    frei löschbar), neues Log beginnt mit dem Checkpoint. **Auto-Compaction** beim Bind, wenn das Log
    einen Size-Threshold übersteigt (Default 10 MB, injizierbar); zusätzlich explizit aufrufbar (234-Workflow).
  - **Version-Kontinuität:** der Tool-Layer-Counter `_graphVersion` initialisiert sich aus
    `FileAuditLog.latestVersion()` statt aus 0 — Versionen laufen über Session-Grenzen weiter.
- **Audit-Bypass schließen:** `graph_realize` (CR-216) schreibt heute **am Audit vorbei** (nur
  `graph_mutate` ruft `recordAudit`) — mit durablem Log ein Korrektheitsloch. Realize-Writes werden
  identisch auditiert (inkl. Commands, `consumerId` analog `graph_mutate`).
- **Wiring:** `bindToolsToHarness` default auf `FileAuditLog(harness.getRepoRoot())`; Tests dürfen
  weiterhin `InMemoryAuditLog` **injizieren** (Dependency-Injection, kein Parallelpfad).
- `audit_trail`/`audit_stats` lesen damit **über Session-Grenzen** — der heutige Tool-Vertrag bleibt
  (Query-Semantik spiegelt `InMemoryAuditLog`: `since` inklusiv, `limit` = letzte N).

## Akzeptanz

- Mutate-Batches landen als JSONL-Zeilen **mit Commands**; ein **neuer** Prozess auf demselben repoRoot
  liest die Einträge der vorigen Session (`audit_trail` sessionübergreifend).
- **Version-Kontinuität:** neue Session startet bei `latestVersion()` des Logs, nicht bei 0
  (`audit_stats.graphVersion` überlebt Restart).
- **Compaction:** archiviert + Checkpoint; `latestVersion()` vor/nach Compaction identisch; Folge-Writes
  zählen korrekt weiter. Auto-Compaction greift oberhalb des Thresholds.
- `graph_realize`-Writes erscheinen im Audit-Log (Bypass geschlossen).
- Append-only verifiziert (Datei wächst monoton; kein Rewrite außer Compaction-Archivierung).
- Crash-Toleranz: eine abgeschnittene letzte Zeile bricht das Lesen nicht.
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- `baseVersion`-Check am Gate + Delta-Report → **CR-GC-233**. Replay → **CR-GC-234**.
- Dokumentierte Kante für 234: ein `reseed` verwirft un-exportierte Mutationen — ein Replay-Log, das
  über einen Reseed hinwegläuft, ist Fork-Punkt-Sache von CR-234 (dort behandeln).

## Dependencies

`@sigloch/graph-api-core` (`AuditLog`/`AuditEntry`-Interface). Unabhängig implementierbar; Fundament für 233/234.
