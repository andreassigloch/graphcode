# CR-GC-279 — `graphcode run "<intent>"` + lokale Validierung (Weg C, Teil 2)

**Status:** done (2026-07-31)
**Datum:** 2026-07-31

**Validierungs-Ergebnis (v6, devstral-small-2-2512):** durable Expand ÜBER
Seed-Größe erreicht — 14 Elemente / 18 Traces (1 SYS, 2 ACTOR, 6 UC, 4 FCHAIN,
1 FUNC), 5 applied / 3 rejected, exit 0, Export + Lock-Freigabe sauber.
`repairedAfterRejection = 0`: Konvergenz kam aus frischen generate-Runden
(deterministischer Re-Fokus), nicht aus In-Step-Repair — Details + offene Hebel
in `docs/executor-harness-analysis.md`, Nachtrag 2.
**Branch:** feat/embedded-executor
**Abhängigkeit:** CR-GC-278 (Executor-Kern)

## Ziel

Der Executor-Kern wird als CLI-Verb nutzbar: `graphcode run "<intent>"` autoriert
den Graphen des aktuellen Repos generativ (Seed → Expand → Handoff) gegen ein
konfiguriertes Modell — lokal (LM Studio) oder Anthropic-BYOK. Kein opencode,
kein Claude Code nötig.

## Bedienung

```
GRAPHCODE_LLM_BASE_URL=http://192.168.78.89:1234 \
GRAPHCODE_LLM_MODEL=devstral-small-2507-mlx \
graphcode run "Multiuser-fähige Web-App aus dem graphcode harness"
```

Env-Variablen (explizit, keine stillen Fallbacks):
- `GRAPHCODE_LLM_BASE_URL` — Pflicht
- `GRAPHCODE_LLM_MODEL` — Pflicht
- `GRAPHCODE_LLM_BACKEND` — `openai` (default) | `anthropic`
- `GRAPHCODE_LLM_API_KEY` — optional (LM Studio braucht keinen)

Verhalten: Harness auf cwd (gleiche Election wie `graphcode mcp`; Store belegt →
klare Fehlermeldung), Executor-Loop bis `done` oder Rundenlimit, danach
`graph_export` + Readiness-Summary auf stderr. stdout bleibt leer (Transport-Regel).
Leerer Graph ohne Intent-Argument → Usage-Fehler (headless, niemand kann rückfragen).

## Scope (max 6 Dateien)

1. `docs/cr/open/CR-GC-279-run-verb.md` (dieses Dokument)
2. `src/run-verb.ts` — `parseExecutorEnv()` + `executeRun()` (Harness-Election,
   seed-on-empty-Parität zu `graphcode mcp`, Executor-Loop, Export + Readiness,
   Lock-Freigabe im finally). Eigenes Modul, weil cli.ts beim Import `main()`
   startet — so testet der Test exakt den Produktions-Pfad
3. `src/cli.ts` — `run`-Case: Env-Config, `executeRun()`, Summary auf stderr,
   StoreOwnershipError mit klarer Meldung
4. `tests/cli.run.test.ts` — Config-Parsing (Pflicht-Env fehlt → Fehler),
   End-to-End gegen realen Disk-Store mit gescriptetem `callModel`,
   Lock-Freigabe auch im Fehlerfall
5. `README.md` — Verb dokumentieren

## Akzeptanzkriterien

- [ ] `graphcode run` ohne Pflicht-Env → klarer Fehler, Exit ≠ 0
- [ ] Lauf endet mit Export + Readiness-Summary; Store-Lock wird freigegeben
- [ ] `npm run build` + `npm test` grün
- [ ] **Validierungslauf (die eigentliche Wette):** devstral via LM Studio,
      Intent → Seed → Expand; Erfolgskriterium = durable FUNC/MOD/REQ-Elemente
      über Seed-Größe hinaus, `repairedAfterRejection > 0` belegt den
      Repair-Loop-Effekt. Ergebnis (auch ein negatives) wird im Nachtrag von
      `docs/executor-harness-analysis.md` festgehalten → Entscheidungsvorlage

## Nicht-Ziele

- Keine SSOT-Änderung (OpenCode-Lock) — Entscheidung erst nach Validierung
- Kein Streaming/TUI — ein headless Lauf mit stderr-Trace
- Keine Erweiterung über den generativen Authoring-Loop hinaus
