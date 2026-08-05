# CR-GC-298 — `se:import-code`-Skill + `graphcode import-code`-CLI-Verb (graphify Code-Repo-Extraktor anschließen)

**Status:** done (2026-08-05)
**Datum:** 2026-08-04
**Kontext:** `@sigloch/graphify` hat mit CR-GF-133/134/135 einen deterministischen Code-Repo-Extraktor
(Tree-sitter, kein LLM): TS-Repo → FUNC/MOD/FLOW+SCHEMA/TEST, über `extractCodeRepoPipeline()` bis zu
einem `ApprovalMatrix.finalGraph` durchgereicht — die Konsumentenseite (`ConsumerGate`) ist bewusst
injizierbar (`McpConsumerGate` spricht bereits das graphcode-Mutate-Format), aber **niemand ruft das
bisher auf**. Es gibt kein CLI/Skill-Wiring — ein Nutzer müsste den Import händisch scripten. Das
gehört in den Harness, nicht in Claude Code selbst: der Harness besitzt den Store und das Gate, die
Skill soll ein Agent im graphcode-Kontext genauso selbstverständlich aufrufen können wie `se:generate`
oder `se:author-req`.

## Import-Semantik: Reseed, nie Merge (Entscheidung 2026-08-05)

`import-code` **ersetzt** den Graph-Inhalt vollständig — kein Upsert-Merge in einen bestehenden
Graph (Gate-`add-node` ist Upsert per uid; ein Merge würde bei Re-Import stille Überschreibungen
und Leichen erzeugen). Ablauf:

1. **Automatisches Backup:** vor jeder Änderung wird der aktuelle Graph als
   `.graphcode/backup/graph-v<graphVersion>-<timestamp>.json` gesichert (gleiche Serialisierung
   wie das committete SSOT-JSON). Das ist der Recovery-Pfad — der Wipe trifft **auch
   hand-autorisierte UC/REQ/ACTOR**, bewusst akzeptiert.
2. **Wipe + Fill durchs Gate:** ein `mutate()`-Batch — `delete-node` für alle bestehenden Knoten,
   dann die `add-node`/`add-edge`-Kommandos des `McpConsumerGate`. **Nicht** `harness.reseed()`
   (dessen Kontrakt ist „Store ← committetes SSOT", am Gate vorbei); die verriegelte
   Gate-only-writes-Constraint gilt auch hier.
3. Ergebnis: Import ist deterministisch und idempotent — gleicher Repo-Stand → gleicher Graph,
   Re-Import räumt gelöschte/umbenannte Funktionen automatisch mit ab.

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
Kante, keine UC/REQ/ACTOR/SYS — das bleibt der generative Pfad `se:generate`). Die Skill muss den
Reseed-Charakter explizit machen: der Import **ersetzt** den bestehenden Graph (Backup automatisch)
— bei einem hand-gepflegten Graph ist das der falsche Zug, außer der Nutzer will genau das.

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
- [x] `graphcode import-code <dir>` auf einer echten kleinen TS-Fixture: FUNC/MOD/FLOW/SCHEMA landen im
      Store (Kuzu, nicht `:memory:`), Report auf stderr.
- [x] Reseed-Semantik: Import über einen bereits gefüllten Store ersetzt den Inhalt vollständig —
      keine Duplikate, keine Stale-Knoten (Test: 2. Import nach Löschen einer Fixture-Funktion →
      deren FUNC/FLOW-Knoten sind weg).
- [x] Backup: vor dem Wipe liegt `.graphcode/backup/graph-<ts>.json` mit dem vorherigen
      Graph-Stand; bei leerem Graph (Erstlauf) wird kein Backup geschrieben.
- [x] `StoreOwnershipError` verhält sich identisch zu `run`/`host` (gleiche Meldung, Exit-Code).
- [x] `harness.close()` läuft auch im Fehlerfall (kein hängender Lock — Regressionstest: Lock nach
      Verb-Ende frei).
- [x] `se:import-code`-Skill vorhanden, wird von `npx @sigloch/graphcode skills sync` mit ausgeliefert.
- [x] `npm run build` + Tests grün (72 Files / 472 Tests).

## Umsetzungsnotizen (2026-08-05)
- Reseed als EIN Gate-Batch, aber nur echte Stale-Knoten/-Kanten als delete: `persist()` schreibt
  deletes LAST — delete+add derselben uid in einem Batch würde den Store-Knoten nach dem Upsert
  wieder entfernen. Wiederkehrende uids werden upsertet (Topologie == Extraktion; codeRef-Bindings
  auf unveränderten FUNCs überleben den Re-Import).
- Gate-Warnings (R-20/R-21/R-26) nach Import sind der erwartete Arbeitsvorrat der Absichtsebene,
  kein Fehler.
- `@sigloch/graphify` wurde dafür erstmals publiziert (v0.1.0, npm) — Registry-Range `^0.1.0`,
  keine file:-Dep (Distribution-Guard CR-GC-262).
- Beifang: CR-GC-300-Regression gefixt — der graphVersion-Stamp schrieb die committete SSOT
  einzeilig um (kanonische Form + Stamp-Strip in Round-Trip-Test und Startup-Drift-Vergleich).

## Out of scope
- UC/REQ/ACTOR/SYS-Inferenz aus Code — bleibt `se:generate` (generativer Pfad); `import-code` ist rein
  deterministisch (graphify-Scope-Grenze aus CR-GF-133).
- Andere Sprachen als TypeScript — folgt graphifys eigener Sprach-Roadmap (neue Tree-sitter-Grammatik
  dort, keine Änderung an diesem Verb nötig, wenn graphify die Sprache liefert).
- Watch-Mode / inkrementeller Re-Import bei Datei-Änderungen — eigener CR, falls gebraucht
  (Re-Import heute = voller Reseed, siehe Import-Semantik).
- **Graph-Union zweier bestehender Graphen** (z.B. Monorepo-Konsolidierung mehrerer Komponenten-
  Repos) — eigener CR mit Review-Schritt, wenn die Migration konkret ansteht. `graph_merge` ist
  das NICHT (Replay-Reintegration eines Branch-Stores desselben Repos, CR-GC-234).
- **Cross-Repo-Verknüpfung** (z.B. graphcode ↔ sigloch-modules) — läuft über die beiden
  MCP-Server (eine Session mountet beide Stores); persistente Verweise ggf. als Attribut-Referenz
  (analog `codeRef`), nie als Kante zwischen Stores („ein Store pro Repo" ist verriegelt).
