# CR-GC-298 — `se:import-code`-Skill + `graphcode import-code`-CLI-Verb (graphify Code-Repo-Extraktor anschließen)

**Status:** open
**Datum:** 2026-08-04
**Kontext:** `@sigloch/graphify` hat mit CR-GF-133/134/135 einen deterministischen Code-Repo-Extraktor
(Tree-sitter, kein LLM): TS-Repo → FUNC/MOD/FLOW+SCHEMA/TEST, über `extractCodeRepoPipeline()` bis zu
einem `ApprovalMatrix.finalGraph` durchgereicht — die Konsumentenseite (`ConsumerGate`) ist bewusst
injizierbar (`McpConsumerGate` spricht bereits das graphcode-Mutate-Format), aber **niemand ruft das
bisher auf**. Es gibt kein CLI/Skill-Wiring — ein Nutzer müsste den Import händisch scripten. Das
gehört in den Harness, nicht in Claude Code selbst: der Harness besitzt den Store und das Gate, die
Skill soll ein Agent im graphcode-Kontext genauso selbstverständlich aufrufen können wie `se:generate`
oder `se:author-req`.

## Ziel

Ein neuer CLI-Verb `graphcode import-code [dir]` (Default `dir` = `process.cwd()`), der:
1. Alle `.ts`/`.tsx`-Dateien unter `dir` einliest (node_modules/dist/.graphcode ausgeschlossen,
   injizierbare Dateiliste für Tests — analog zum `read`-Injection-Pattern in `src/ports/cli.ts` von
   graphify selbst).
2. `@sigloch/graphify`s `extractCodeRepoPipeline(files, { gate })` aufruft, `gate` = ein
   `McpConsumerGate`, dessen Transport **in-process** gegen die bereits offene Harness geht
   (`bindToolsToHarness(harness).graph_mutate.handler({ commands })`) — kein MCP-Stdio-Umweg nötig,
   gleicher Prozess, gleiches Muster wie `run-verb.ts`s `registry`-Aufbau.
3. Store-Election/Lock, `seedFromJson`-Parität und `harness.close()` im `finally` **exakt wie
   `executeRun`** (`src/run-verb.ts`) — kein Parallelweg, gleiche Fehlerbehandlung
   (`StoreOwnershipError` → dieselbe Nutzermeldung wie bei `run`/`host`).
4. Ergebnis (angewandte Knoten/Kanten, Violations, welche Dateien/Funktionen gefunden wurden) auf
   `stderr` reportet — `stdout` bleibt für MCP-Transporte reserviert (bestehende Konvention).

Dazu die Skill `se:import-code` (`.claude/commands/se/`), die einem Agenten sagt, **wann** das der
richtige Zug ist (bestehende Codebasis reverse-engineeren statt UC/REQ von Hand zu erfinden) und was
das Ergebnis bedeutet (deterministisch, nur FUNC/MOD/FLOW+SCHEMA aus TS, TEST-Knoten isoliert ohne
Kante, keine UC/REQ/ACTOR/SYS — das bleibt der generative Pfad `se:generate`).

**Neue Abhängigkeit:** `@sigloch/graphify` als `dependency` (nicht `devDependency`) in graphcode —
bewusst, `McpConsumerGate` wurde genau für diesen Zweck exportiert (siehe graphify README
§"Code-repo input"); kein Bruch der L2-Grenze (graphify emittiert weiterhin nur, graphcode entscheidet
über `harness.mutate()`/das Gate — hier läuft es nur im selben Prozess statt über MCP-Stdio).

## Dateien (≤5)

- `src/import-code-verb.ts` (neu) — `executeImportCode(opts)`, Datei-Discovery + Pipeline-Aufruf,
  Harness-Lifecycle wie `run-verb.ts`.
- `src/cli.ts` — neuer `case 'import-code':`, analog zu `case 'run':`.
- `package.json` — `@sigloch/graphify` als dependency.
- `.claude/commands/se/import-code.md` (neu) — die Skill (wird über `files` bereits als Teil von
  `.claude/commands` ausgeliefert, kein Packaging-Change nötig).
- `tests/import-code-verb.test.ts` (neu) — 2-Datei-TS-Fixture (gleiche Form wie graphifys eigener
  CR-GF-133-Test) gegen einen Temp-Store: `executeImportCode` liefert die erwarteten FUNC/MOD/FLOW/
  SCHEMA-Knoten in `harness.getGraph()`, 0 Violations.

## Akzeptanzkriterien
- [ ] `graphcode import-code <dir>` auf einer echten kleinen TS-Fixture: FUNC/MOD/FLOW/SCHEMA landen im
      Store (Kuzu, nicht `:memory:`), Report auf stderr.
- [ ] `StoreOwnershipError` verhält sich identisch zu `run`/`host` (gleiche Meldung, Exit-Code).
- [ ] `harness.close()` läuft auch im Fehlerfall (kein hängender Lock — Regressionstest: Lock nach
      Verb-Ende frei).
- [ ] `se:import-code`-Skill vorhanden, wird von `npx @sigloch/graphcode skills sync` mit ausgeliefert.
- [ ] `npm run build` + Tests grün.

## Out of scope
- UC/REQ/ACTOR/SYS-Inferenz aus Code — bleibt `se:generate` (generativer Pfad); `import-code` ist rein
  deterministisch (graphify-Scope-Grenze aus CR-GF-133).
- Andere Sprachen als TypeScript — folgt graphifys eigener Sprach-Roadmap (neue Tree-sitter-Grammatik
  dort, keine Änderung an diesem Verb nötig, wenn graphify die Sprache liefert).
- Watch-Mode / inkrementeller Re-Import bei Datei-Änderungen — eigener CR, falls gebraucht.
