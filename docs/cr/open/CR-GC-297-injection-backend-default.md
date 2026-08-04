# CR-GC-297 — Injection-Default backend-abhängig

**Status:** open
**Datum:** 2026-08-04
**Kontext:** CR-GC-293 (done) — zweifach belegte Messlage: Guide/Index-
Injektion (CR-285) nützt Frontier (Opus: 60 El/12 Rd.) und kostet Local
Ausbeute + Breite (v15 22 vs. v9 38; v20-noinject 40 El inkl. MOD/FLOW vs.
v19 31). Der Mess-Schalter `injection` (Config + `GRAPHCODE_LLM_INJECTION`)
existiert seit CR-293 mit Default `true`.

## Ziel

Default backend-abhängig, exakt nach dem maxTokens-Muster in
`parseExecutorEnv` (run-verb.ts): explizite Env gewinnt; ohne Env gilt
`anthropic → injection:true`, `openai → injection:false`. Kommentar mit
Messbeleg (v19/v20, v15/v9, opus-v2).

## Dateien (≤6)

- `src/run-verb.ts`
- `tests/cli.run.test.ts`

## Akzeptanzkriterien

- [ ] Unit-Test: openai-Backend ohne Env → injection false; anthropic → true;
      `GRAPHCODE_LLM_INJECTION` überschreibt beide Richtungen
- [ ] `npm run build` + Tests grün
