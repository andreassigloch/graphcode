# CR-GC-258: Audit-Remainder — Dependency-Fixes + Dead-Code

**Status:** done (2026-07-26) · **Max Files:** 5 (graphcode)
**Kontext:** Restposten aus dem Audit 2026-07-26 (Session „dead code / stubs / vulnerabilities").
CR-GC-255 nahm die zwei Sicherheitslücken, CR-GC-256 den mcp-tools-Schnitt; hier liegt alles,
was keine Design-Entscheidung braucht.

## Problem (Why)

### P1 — `npm audit`: 4 Findings erreichen Konsumenten, davon 1 non-breaking behebbar

Ausgangslage: **4** im publizierten Paket (1 high, 3 moderate), **12** insgesamt (dev inkl. 1
critical). Alle 4 kommen transitiv über `@modelcontextprotocol/sdk` → hono/fast-uri und sind in
graphcode **nicht erreichbar** (nur `StdioServerTransport` wird importiert; hono ist der
HTTP-Transport des SDK). Trotzdem: `fast-uri` (high) und ein hono-moderate sind per Lockfile-Bump
ohne Breaking Change weg — ein nicht behobenes high im Manifest ist ein Audit-Signal, das jeder
Konsument sieht.

### P2 — `test:ui` und `test:coverage` sind tote Scripts, und `test:ui` trug das critical

Das einzige critical der Auswertung (vitest ≤3.2.5, arbitrary file read+execute) gilt **nur wenn
der Vitest-UI-Server lauscht**. `npm run test:ui` ist hier aber gar nicht lauffähig:
`@vitest/ui` ist weder deklariert noch installiert, der Lauf bricht mit
`MISSING DEPENDENCY Cannot find dependency '@vitest/ui'` ab. Gleiches Bild bei `test:coverage`
(`@vitest/coverage-v8` fehlt). Zwei Scripts, die niemand ausführen kann — und einer davon ist der
einzige Pfad zum critical.

### P3 — `scripts/gate-session.mjs` hat null Referenzen

Kein CLI-Case, kein Doc, kein Test, kein Graph-Knoten verweist darauf; der Scope ist hart auf
`graphcode`/`graphcode` verdrahtet. Funktionsfähig, aber verwaist — und damit ein stiller
Zweitpfad zum Gate, den niemand pflegt oder testet.

### P4 — Stale Kommentar + unnötiger Export im Renderer

`src/exporter-views.ts` behauptete im Header, `nodesOfTypes` werde aus `exporter.ts` importiert —
die Import-Zeile darunter listet nur `generatedHeader, byUid, cell`. `nodesOfTypes` ist
ausschließlich innerhalb von `exporter.ts` benutzt, war aber exportiert: öffentliche Oberfläche
ohne Konsumenten.

## Decision

1. **`npm audit fix`** (nur Lockfile, kein `--force`, `package.json` unberührt). Ergebnis
   verifiziert: Konsumenten-Findings **4 → 2** (beide moderate, beide der unerreichbare
   hono/sdk-Pfad). `fast-uri` (high), `hono`, `js-yaml`, `postcss` sind weg.
2. **`test:ui` + `test:coverage` löschen.** Das ist der Fix für das critical im Sinne von
   „enforce, don't document": der Vektor verschwindet strukturell, statt in einer Doku zu stehen.
   Wer Coverage/UI zurückwill, deklariert die fehlende Dev-Dependency bewusst — das ist dann eine
   Entscheidung mit Audit-Folge, kein stiller Zustand.
3. **`scripts/gate-session.mjs` löschen** (`git rm`), nicht dokumentieren: „Unused Code löschen".
   Der Nutzen (Gate-Ops ohne MCP-Server) ist über `graph_reseed`/`graph_mutate` am laufenden Server
   abgedeckt.
4. **Kommentar korrigieren, `nodesOfTypes` zu `function` machen** (+ Doc-Zeile). Kein Verhalten
   geändert — `exporter.ts` nutzt sie an zwei Stellen weiter.

## Nicht behoben — und warum (bewusste Entscheidung, kein Versehen)

Alles Restliche verlangt einen **semver-major-Bump**, jeweils dev-only oder unerreichbar:

| Paket | Sev | Fix wäre | Bewertung |
|---|---|---|---|
| `vitest` (+vite, mocker, vite-node) | critical | `vitest@4` (von 2.x) | Vektor durch P2 geschlossen; zwei Majors über 308 Tests = eigener CR |
| `eslint` (+config-array, eslintrc, brace-expansion, minimatch) | high | `eslint@10` (von 9) | dev-only Lint, Breaking Config-Migration |
| `esbuild` | moderate | `esbuild@0.28` | betrifft nur `esbuild serve` (nie benutzt); `npm run bundle` unberührt |
| `@modelcontextprotocol/sdk` / `@hono/node-server` | moderate | sdk **1.24.3** | wäre ein **Downgrade** von 1.29.0, um einen unerreichbaren HTTP-Pfad zu entschärfen — falscher Handel |

Empfehlung für einen Folge-CR: `vitest@4` zuerst (Test-Runner-Migration ist gut messbar), `eslint@10`
danach. Der sdk-„Fix" bleibt liegen, bis das SDK die Advisory nach vorn behebt.

## Betroffene Dateien (5)

1. `package.json` — `test:ui` + `test:coverage` entfernt
2. `package-lock.json` — `npm audit fix`
3. `scripts/gate-session.mjs` — gelöscht
4. `src/exporter.ts` — `nodesOfTypes` nicht mehr exportiert (+ Doc-Zeile)
5. `src/exporter-views.ts` — Header-Kommentar korrigiert

## Akzeptanz

- [x] `npm audit --omit=dev`: 2 moderate (vorher 4 / 1 high + 3 moderate); kein high mehr im
      Konsumenten-Pfad.
- [x] `npm run test:ui` existiert nicht mehr (vorher: Startup-Error) — kein Pfad zum
      vitest-UI-critical.
- [x] Null Referenzen auf `gate-session` im Repo nach dem Löschen.
- [x] `npm run type-check` + `npm run build` grün; `npm test` grün (308 Tests / 58 Dateien).
- [x] `package.json` `dependencies` unverändert: `@modelcontextprotocol/sdk`, `kuzu-wasm`,
      `typescript`, `zod` (pinnt `tests/distribution.test.ts`).

## Abschlussnotizen

Der Audit-Report nannte das vitest-critical zunächst „reachable if used" — falsch: `test:ui` war
schon vorher nicht ausführbar. Die Korrektur ändert die Bewertung des einzigen critical von
„vorhanden, nutzbar" auf „strukturell unerreichbar", und P2 macht das dauerhaft.

Nebenbefund während der Umsetzung: eine **parallele Instanz** arbeitete im selben Working-Tree
(`src/mcp-tools.ts`, `src/viewer/host.ts`, ST-2/ST-5-Steering, dazu die Implementierung von
CR-GC-255). Ein voller Testlauf schlug einmal transient fehl (`mcp.agent-agnostic`, Registry-Liste),
weil deren `mcp-tools.ts` mitten im Edit war; isoliert und im nächsten Volllauf grün.

**Geteilter Index — Konsequenz für die History:** das `git rm scripts/gate-session.mjs` dieses CRs
lag im Index, als die parallele Instanz ihren ST-5-Commit machte; sie committete den gesamten Index,
also landete Punkt 3 in **`755c363` „feat: graph_next_step steering module + test (ST-5)"** statt im
CR-Commit. Inhaltlich korrekt (die Datei ist weg), aber die Zuordnung ist verschoben — bei zwei
Agenten auf einem Working-Tree gehört selektives Staging auf BEIDEN Seiten dazu, sonst adoptiert der
schnellere Commit die fremden Änderungen. Die restlichen 4 Dateien wurden selektiv committet; die
Änderungen der parallelen Instanz blieben unangetastet.
