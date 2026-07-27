# CR-GC-267: `@sigloch/graphcode-client` — Host-Socket + View-Katalog extrahieren

> **Umnummeriert von CR-GC-264 (2026-07-26):** die Nummer war doppelt vergeben — parallel lief
> `CR-GC-264-public-repo-doc-hygiene` (Belege rein, Entstehungsgeschichte raus), das bereits im
> Graph-SSOT und in `docs/cr/done/` steht. Commits, die „CR-GC-264" für die Client-Extraktion
> nennen (`4a6f2a1` in graphcode, `3b8907f` in sigloch-modules), meinen diesen CR hier.

**Status:** Done (2026-07-26) · **Max Files:** 8 (User-Freigabe: 6 wären ohne
Package-Boilerplate erreicht — `package.json`/`tsconfig.json`/`index.ts` sind Gerüst, keine Logik)
**Herkunft:** Publish-Audit `graph-view-edit` 2026-07-26. GVE ist technisch fertig integriert
(Views client-seitig, Dashboard server-seitig, Edit-Pfad über `host.sock` durchs EINE Gate), aber
nicht auslieferbar.

## Problem (Why)

Ein Clean-Room-Install des gepackten GVE-Tarballs zieht **152 MB**. Die Aufschlüsselung:

| Brocken | Größe | Kommt über | Von GVE benutzt? |
|---|---|---|---|
| `kuzu-wasm` | **70 MB** | `@sigloch/graphcode` | **Nein** — GVE öffnet per Governance §8 nie ein Kuzu-Handle |
| `@modelcontextprotocol/sdk` | 5,8 MB | `@sigloch/graphcode` | **Nein** |
| `@babel` + `@esbuild` + `caniuse-lite` | ~24 MB | `vite` + `@vitejs/plugin-react` | nur zum *Servieren* eines fertigen Bundles |

GVE importiert aus graphcode **acht** Symbole: `computeReadiness` + die vier Panel-Funktionen (reine
Projektionen über Graph-JSON), `VIEW_FILENAMES` (eine Konstante), `callHost` + `HOST_SOCK_BASENAME`
(ein `node:net`-Socket-Client). **Keines davon berührt Kuzu oder MCP.** Sie kommen mit, weil
graphcode *ein* Package mit *einer* Dependency-Liste ist.

**Ein Subpath-Export (`@sigloch/graphcode/client`) löst das NICHT** — npm installiert Dependencies
pro Package, nicht pro Entry-Point. Die 70 MB kämen weiterhin mit. Es muss ein eigenes Package sein.

## Design

Neues Package `@sigloch/graphcode-client` in `sigloch-modules/packages/` — **null Runtime-Deps**.

1. **`src/host-client.ts`** — `HOST_SOCK_BASENAME`, `ShimRequest`/`ShimResponse`, `callHost`
   (+ private `connectOnce`/`connectWithRetry`). Einziger Import: `node:net`.
   Die **Server**-Hälfte (`startHostSocket`, `buildProxyRegistry`, `HostGoneError`, `isDeadSocket`)
   bleibt in graphcodes `host-shim.ts` und importiert die Wire-Typen von hier — beide Hälften können
   nicht auseinanderdriften.
2. **`src/view-catalog.ts`** — `MARKDOWN_VIEWS` (const-Tuple), `MarkdownView` (Union), `VIEW_FILENAMES`.
   **Bewusst ohne Zod:** eine Library, die ein `ZodEnum` herausgibt, zwingt jeden Consumer auf exakt
   dieselbe zod-Instanz; sobald zwei Kopien existieren (gelinkter Sibling, nicht-dedupter Install)
   sind die Schema-Typen nicht mehr assignable und der Fehler liest sich als unzusammenhängender
   Type-Error. Genau das ist bei der Implementierung aufgetreten (zod 4.4.3 vs 4.3.6,
   `_zod.version.minor` 3 ≠ 4). **Die Liste ist die geteilte Wahrheit** — graphcode baut
   `MarkdownViewSchema = z.enum(MARKDOWN_VIEWS)` mit seinem EIGENEN zod. Eine Definition, kein
   Parallelpfad, und das Package bleibt dependency-frei.
3. **Keine Parallelpfade:** graphcode löscht seine lokalen Kopien und **re-exportiert** aus dem
   Client-Package (`host-shim.ts`, `exporter.ts`). Jeder bestehende Importpfad
   (`from './host-shim.js'`, `from './exporter.js'`) löst unverändert auf — die öffentliche
   graphcode-API ändert sich nicht, `graphcode-gov`/`graphify` brechen nicht.

## Dateien (8)

**Neu** (`sigloch-modules/packages/graphcode-client/`): `package.json`, `tsconfig.json`,
`src/index.ts`, `src/host-client.ts`, `src/view-catalog.ts`
**Geändert** (graphcode): `src/host-shim.ts`, `src/exporter.ts`, `package.json`

## Akzeptanzkriterien

- [x] `npm run type-check` (graphcode) grün
- [x] Client-Package baut (`npx tsc`), `dependencies` leer
- [x] graphcode-Testsuite **313/314 grün** — die 10 vorbestehenden Fehler sind gefixt (s. u.);
      Baseline gegen HEAD per `git stash` verifiziert, bevor irgendwas zugeordnet wurde
- [ ] `tests/distribution.test.ts` grün — **blockiert:** verlangt
      `@sigloch/graphcode-client@^0.1.0` in der Registry. `npm publish` wurde vom
      Permission-Classifier abgelehnt; muss vom User ausgeführt werden.

## Nicht Teil dieses CRs

- **CR-GC-265:** `readiness.ts` + `readiness-completeness.ts` + `viewer/panels.ts` nachziehen (6 Dateien).
  Erst danach kann GVE `@sigloch/graphcode` vollständig ersetzen.
- **CR-GVE-xxx:** GVE tauscht die Dependency (2 Dateien).
- Der `vite`-Anteil (~24 MB): `bin/gve.mjs` auf einen `node:http`-Static-Server umstellen — dasselbe
  Muster, das graphcodes eigene Host-Bridge dep-frei benutzt. Separates CR.

## Vorbefunde — Root Cause + Fix (separat committen, CR-228 C)

Die 10 auf HEAD roten Tests hatten **zwei** Ursachen, beide behoben (danach 313/314 grün):

1. **Stale Global-Link.** `.npm-global/lib/node_modules/@sigloch/contracts` war eine **Kopie**
   (RULES_VERSION 2.17.0, 24 Regeln, kein R-27), kein Symlink auf die Source (2.18.0, 25 Regeln).
   graphcode kompilierte gegen einen eingefrorenen Contracts-Stand. Fix: `npm link` **im**
   contracts-/graph-api-core-Verzeichnis ausführen (erzeugt den echten Symlink), dann im Consumer
   `npm link @sigloch/<pkg>`. → `readiness.model`, `mcp.occ` grün.
2. **CR-228 C war unvollständig.** contracts hat `codeRef` + `schemaRef` zu **einem** `realRef`
   (`RealRefSchema`, `symbol` optional) vereinigt; `src/conformance.ts` las weiter
   `CodeRefSchema`/`SchemaRefSchema` → `tsc` rot, RC-01/03/04 rot. Fix: eine `realRef`-Auflösung
   statt zwei getrennter Scans, Kommentare nachgezogen. → `conformance`, `mcp.realize` grün.

**Zusatzbefund — NUL-Byte im Source.** `src/conformance.ts` enthielt ein **rohes NUL-Byte** als
Key-Separator im Template-Literal zwischen `from` und `to` (seit 531c637 committet). `file(1)`
klassifizierte die Datei damit als `data`, wodurch **jedes grep-basierte Tooling sie stillschweigend
übersprang** — die Suche nach `CodeRefSchema` lieferte 0 Treffer, obwohl der Import dastand. Genau
die Klasse Korruption, gegen die `.claude/hooks/deny-binary-source.sh` existiert; der Hook greift bei
Writes, nicht bei Altbestand. Fix: die Unicode-Escape-Sequenz (Backslash + `u0000`) statt des rohen
Bytes — identischer Laufzeitwert, Datei wieder Text.

**Offen (nicht gefixt):** `CLAUDE.local.md` nennt `scripts/ensure-siblings-built.sh` als `pretest` —
Skript und Hook existieren nicht mehr.

## Close-Befund (2026-07-26)

Umgesetzt und ausgeliefert: `@sigloch/graphcode-client@0.1.0` liegt auf npm (null Runtime-Deps),
`@sigloch/graphcode@0.5.0` konsumiert es und re-exportiert `callHost`/`HOST_SOCK_BASENAME`, GVE
zieht es über graphcode mit. Beweis statt Behauptung: die beiden Browser-E2E-Specs in GVE
(`customer-journey`, `workbench-edit`) laufen gegen einen echten `graphcode mcp`-Host über
`.graphcode/host.sock` grün — 506 Tests, 0 rot.

Nachgezogen beim Publish (CR-214): das Paket hatte kein `LICENSE` in `files` und ein
`prepublishOnly` ohne Tests. Beides ist gefixt, inklusive `tests/unit/host-client.test.ts` — das
Socket-Protokoll ist der Vertrag zwischen zwei Hälften, die nicht auseinanderdriften dürfen, also
fährt der Test einen echten `node:net`-Server über eine echte Socket-Datei (Request-Form,
Fehlerdurchreichung, eigene Request-ID pro Aufruf, Reject statt Hänger) plus die Konsistenz von
`MARKDOWN_VIEWS` gegen `VIEW_FILENAMES`.

Die 152-MB-Rechnung aus dem Problem-Abschnitt ist damit für GVE eingelöst: der Viewer kann den
Host-Pfad nutzen, ohne `kuzu-wasm` und das MCP-SDK zu installieren.
