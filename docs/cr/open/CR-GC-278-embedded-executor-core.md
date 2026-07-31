# CR-GC-278 — Embedded Executor Core (Weg C, Teil 1)

**Status:** open
**Datum:** 2026-07-31
**Branch:** feat/embedded-executor

## Ziel

Der minimale Modell-Treiber aus dem Greenfield-System-Test
(`rig/greenfield-systemtest/driver.mjs`) wird Produkt-Code: `src/executor.ts`.
graphcode fährt damit ein lokales LLM (LM Studio) oder Anthropic-BYOK **ohne
Fremd-Harness** (kein opencode, kein Claude Code): ~2–3k Token Grundlast statt
~16k, Loop in Code statt Prompt, `graph_generate` entscheidet deterministisch
"was als nächstes", das Modell emittiert nur.

## Root Cause des Rig-Befunds (der behobene Denkfehler)

Der Rig-Treiber brach den Step-Loop nach dem **ersten** `graph_mutate` ab —
egal ob das Gate applied oder rejected hatte. Devstrals Decomposition-Batches
(bis 14 Commands) wurden atomar zurückgerollt, und das Modell erfuhr nie warum.
Gemessen wurde damit *Near-Miss × atomares Gate ohne Repair-Loop*, nicht
Modell-Fähigkeit. Der Executor-Kern behebt das: **Repair-Loop** — bei
`success:false` gehen `violations[]` inkl. `fixHint` als Feedback zurück ans
Modell, der Step läuft weiter bis applied oder Step-Cap.

## Scope (max 6 Dateien)

1. `docs/cr/open/CR-GC-278-embedded-executor-core.md` (dieses Dokument)
2. `src/executor.ts` — Executor-Kern:
   - `runExecutor()` — generate-getriebener Loop (Port von driver.mjs, TypeScript)
   - **Repair-Loop**: break nur bei `success:true`; Rejection → Gate-Result
     (violations + fixHint, kompakt) als Feedback, weiter bis Step-Cap
   - Recovery-Pfad (Mutate als Prosa) gleichbehandelt: rejected → Feedback, kein
     stiller Trace-Drop
   - Backends: `openai` (LM Studio `/v1/chat/completions`) + `anthropic`
     (`/v1/messages`); `callModel` injizierbar für Tests
   - Tool-Schemas aus der Registry via `z.toJSONSchema` (Zod v4), normalisiert
     für LM Studios strikten Validator
   - 3 Read-Tools (list_dir/read_file/grep), auf den Workspace gescoped
   - `ExecutorConfigSchema` (Zod, lokal — Promotion nach `@sigloch/contracts`
     ist eine Folge-Entscheidung, siehe Governance)
3. `tests/executor.test.ts` — reale Persistenz (Disk-Kuzu, temp repoRoot),
   Modell-Backend gescriptet (injizierter `callModel`):
   - Repair-Loop: Rejection → Feedback enthält fixHint → korrigierter Batch landet
   - Recovery aus Prosa + Repair
   - Schema-Konvertierung: jedes Registry-Tool ergibt ein valides
     `{type:'object', properties}`-Schema

## Akzeptanzkriterien

- [ ] `runExecutor()` bricht einen Step **nie** vor `success:true` ab, solange
      Step-Budget da ist; jede Rejection erzeugt sichtbares Modell-Feedback
- [ ] Stats unterscheiden `mutatesApplied` / `mutatesRejected` /
      `repairedAfterRejection` (die Entscheidungs-Metrik für die Expand-Wette)
- [ ] `npm run build` + `npm test` grün; kein Verweis mehr auf `rig/` aus `src/`
- [ ] Kein zweiter Store-Handle: Executor läuft in-process gegen die übergebene
      Registry (Single-Writer bleibt)

## Governance-Flagge

Die SSOT verriegelt "OpenCode-executed / OpenCode-Sidecar". Dieser CR baut den
Ersatz, **öffnet die Entscheidung aber nicht** — das passiert erst nach der
CR-GC-279-Validierung per explizitem Review (der Greenfield-Test + der
Validierungslauf sind die geforderte Messung). `ExecutorConfig` bleibt bis dahin
lokal; contracts-Bump (D1) erst mit der SSOT-Entscheidung.
