# graphcode — Entwicklungs-Guardrails (Familie-Perspektive)

**Vor dem Coden lesen:** `docs/SPEC.md` (Impl) · `README.md` (Carve-Out). Diese Datei = die
**verbindlichen Familie-Requirements & Constraints**; Inhalte sind SSOT in **bok** (nur verlinkt).

## Was graphcode ist / nicht ist

- **IST:** governtes **Graph-Substrat** (Bridge + Store + MCP-Surface), Prio 1a — **agent-agnostisch**,
  **OpenCode-executed**, Claude Code = *ein* Client. Headless.
- **NICHT:** Generator (→ aimprove) · Learning-Engine (→ learning-core) · Dashboard/Viewer
  (→ aimprove / graph-view-edit) · Extraktion/Slicer (→ graphify). **Harness-only.**

## Verbindliche Constraints (verriegelt — `bok/docs/research/2-Year-Review/2yR-SSOT-stand-und-ziel.md`)

- **Ein Store = Kuzu** embedded, single-writer, **genau ein Owner-Prozess/Repo** — nie ein 2. DB-Handle.
- **Ein Transport = MCP-stdio** (Agent) + **SSE/WS-Bridge** (Live-Viewer). **Kein Express-REST im Core.**
- **Ein Apply-Gate = `mutate()`** — jede Edit (Mensch *oder* KI) durch dasselbe Gate, Autor nur geloggt.
- **SE-Ontologie + `V3_RULES` aus `@sigloch/contracts/se`** — **importieren, NIE forken.** Neuer
  ElementType/TraceType/TRACE_PATTERN/Rule = **Familie-Review + Version-Bump** (Drift-Lock L1/L2);
  kein lokaler Rule-Parser.
- OpenCode-Sidecar · BYOK · TypeScript · Zod.

**Drift-Locks L1–L4:** `bok/docs/governance/graphcode-governance.md` §3 + `aise-family/DRIFT-LOCKS.md`.
**Schnittstellen-Verträge (Consumer):** `bok/docs/governance/USAGE-MATRIX.md`.
**Abgrenzung zu aise-Nachfolger / Modul-Sharing:** `bok/docs/konzept/aise-family-architecture.md` §5c
+ `bok/docs/konzept/shared-vs-specific-modules.md`.

## Schema-First

Alle Schnittstellen = Zod. Harness-Schemas (`HarnessConfig`/`MutateCommand`/`MutateResult`) gehören
nach `@sigloch/contracts` (D1) — **nicht lokal neu definieren** (keine parallelen Pfade).

## Dev-Reihenfolge (Carve-Out aus aimprove)

1. **Build-Setup zuerst — BLOCKER (D5):** `workspace:*`-Deps auflösen (Monorepo-Package in
   sigloch-modules **oder** versionierte/file-Deps), `npm install` + `tsc --noEmit` grün **vor** Code.
2. CRs in Reihenfolge: **CR-GC-100** (Harness+Gate, inkl. D1) → **101** (MCP + Query-Precision-Tools)
   → **102** (Hooks) → **103** (Codec). Siehe `docs/cr/open/`.
3. Pro CR: **max 5 Dateien**, in einem Zug implementier-/test-/debug-bar.
4. Carve-Out: alte Harness-Funktion nach Extraktion in aimprove **löschen** — keine Parallelpfade.

## Test-Disziplin (verifiziert + validiert = „fertig")

- Nach **jeder** `.ts`-Änderung: `npm run build` / `type-check`. **Keine ungeprüften TS-Commits.**
- **Reale Tests, keine Mocks.** Persistenz = **Disk, nie `:memory:`**.
- Unit (Gate/Rule-Eval) · Integration (MCP + lokaler Kuzu) · **Conformance** (Format-E round-trip,
  rasentraktor-Fixture, L3).
- Root-Cause statt Symptom-Fix: 5×WHY → Unit-Test der den Bug reproduziert → fixen.

## Effizienz (Query-Precision, Local-LLM)

**Präzise Query statt Result-Kompression** (R12): `graph_impact()` liefert exakt den Blast-Radius;
`graph_expand()` vertieft on-demand (R13). Details: `docs/RECOMMENDATIONS.md` R5–R14 +
`bok/docs/research/graphengine-efficiency.md` / `headroom-ai-evaluation.md`.

## Erzwungen, nicht dokumentiert (CR-GC-205 — „enforce, don't document")

Diese Invarianten sind **erzwungen** — kein Prosa-Vertrauen, kein Re-Dokumentieren als Regel:

- **Gate-only-writes** (jede Modell-Edit durch `mutate()`, kein Hand-Edit des SSOT) → PreToolUse-Hook
  `.claude/hooks/deny-graph-write.sh` + Apply-Gate.
- **Strukturelle Validität** (Trace-Pair-Legalität gegen `TRACE_PATTERNS`) → Engine-Regel **R-18**
  (`@sigloch/contracts/se`); das Gate ruft **kein** separates `codec.validate()` mehr (R-08 = referenz.
  Integrität, slim Unknown-Type-Guard nur fürs Kuzu-DDL).
- **Bindungs-Vollständigkeit**: lauffähiger TEST trägt `testRef` (**R-19**), realisierte FUNC trägt
  `codeRef` (**R-20**) — warning, sichtbar in `rules_evaluate`/`readiness`; Export materialisiert fehlende
  testRef-Stubs (`it.todo`, kein Phantom-Pfad).
- **Keine Binär-/NUL-Korruption in Source** → PreToolUse-Hook `.claude/hooks/deny-binary-source.sh`.
- **Shared-Package vor Integration gebaut** (kein Stale-Dist-False-Green) → `scripts/ensure-siblings-built.sh`
  als `pretest`.
- **Read-vor-Edit** → Harness-Built-in (Edit verlangt vorheriges Read; kein Zusatz-Hook = kein Parallelpfad).
