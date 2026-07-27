# CR-GC-255: Path-Containment für graph-getriebene Writes + Bridge-Bind auf Loopback

**Status:** done (2026-07-26) · **Max Files:** 6 (contracts 3 + graphcode 3)
**Kontext:** Audit-Befund 2026-07-26 (Session „dead code / stubs / vulnerabilities"). Zwei
unabhängig reproduzierte Lücken in genau den Invarianten, die graphcode als *erzwungen* (nicht
dokumentiert) führt: Gate-only-writes und die Read-only-Grenze der Viewer-Bridge.

## Problem (Why)

### P1 — `graph_export` schreibt außerhalb `repoRoot` (reproduziert, 2 Sinks)

Graph- bzw. Agent-gelieferte Pfade werden ohne Containment-Check auf `repoRoot` gejoint. Ein
`grep` nach `startsWith(repoRoot` / `relative(repoRoot` über `src/` liefert **null** Treffer —
einen solchen Guard gibt es nirgends.

| Sink | Ort | Quelle des Pfads | Schema |
|---|---|---|---|
| Test-Stub-Materialisierung | `src/mcp-tools.ts:845` (`join(repoRoot, stub.file)`) | `testRef.file` aus dem Graph | `TestRefSchema.file` = blankes `z.string()` |
| Graph-JSON-Export | `src/mcp-tools.ts:797-799` | `input.name` des Tools | `GraphExportInputSchema.name` = blankes `z.string()` |

Beides mit einem Wegwerf-Test gegen echtes Disk-Kuzu verifiziert (danach gelöscht):

```
testRef.file '../../ESCAPED-BY-EXPORT.test.ts'
  → schrieb /var/.../gc-audit-L8zrPX/ESCAPED-BY-EXPORT.test.ts   (2 Ebenen über repoRoot)
name '../../../ESCAPED-NAME'
  → Rückgabe-Pfad '../ESCAPED-NAME.graph.json', Datei in .../outer/ESCAPED-NAME.graph.json
```

**Impact:** Ein Agent durch das Gate — oder ein präpariertes `GRAPHCODE_SEED_JSON` — legt Dateien
überall an, wo der Prozess-User schreiben darf. Stub-Writes sind existenz-geprüft (nur neue
Dateien); der `name`-Sink **überschreibt**, weil der Refuse-to-clobber-Guard nur das Ziel prüft,
auf das er gezeigt wird.

Die Governance-Folge ist die schärfere: eine JSON außerhalb `docs/graph/` entgeht *sowohl* dem Glob
von `.claude/hooks/deny-graph-write.sh` (`*docs/graph/*.graph.json`) *als auch* dem Pre-Commit-
Freshness-Guard — während `clearExportPending()` in `src/mcp-tools.ts:856` trotzdem feuert. Der
Drift-Marker wird gelöscht, der echte SSOT bleibt still veraltet. Das widerspricht
REQ-gate-only-writes direkt.

### P2 — SSE-Bridge lauscht auf allen Interfaces, Log behauptet Loopback

`src/viewer/host.ts:153` ruft `listen(port)` ohne Host-Argument. Verifiziert: Node bindet damit an
`::` (Dual-Stack, alle Interfaces, damit auch alle IPv4). `src/viewer/host.ts:339` schreibt
`[graphcode host] read-only bridge on http://127.0.0.1:${port}`.

**Impact:** `/elements`, `/subgraph/:root` und `/health` (mit Ontologie-/Rules-/Meta-Model-Version)
sind ohne Auth und ohne Origin-Check aus dem LAN lesbar — das komplette governte Modell. Der
Datei-Header nennt die Route-Tabelle „the whole attack surface"; die Bind-Adresse steht nicht drin.
Read-only bleibt strukturell wahr, die *Reichweite* war unbeabsichtigt.

## Decision

Nachhaltig heißt hier: der Fix sitzt an der Datenvertrags-Wurzel in `@sigloch/contracts`, nicht als
Wenn-Abfrage am Sink. Der lokale Guard bleibt nur für das, was **kein** Ontologie-Feld ist.

1. **Pfad-Format in contracts verriegeln (Wurzel-Fix, L1-Bump).** Neues
   `RepoRelativePathSchema` in `src/se/ontology.ts` — pure Zod, **kein** `node:fs`/`node:path`
   (contracts bleibt I/O-frei und browser-bundlebar, Entscheid CR-GC-253 §2): verbietet absolute
   Pfade (`/…`, `~…`, Windows-Laufwerk), `..`-Segmente und Backslashes. Verwendet in
   `TestRefSchema.file`, `CodeRefSchema.file`, `SchemaRefSchema.file` — alle drei, damit der
   Vertrag nicht asymmetrisch wird.

2. **Der Bump neutralisiert Sink 1 ohne Zusatzcode.** `renderTestStubs`
   (`src/exporter.ts:412`) und R-19 (`contracts se/rules.ts:649`) prüfen beide per
   `TestRefSchema.safeParse`. Ein `../`-Pfad scheitert damit am Parse → der Stub wird
   **übersprungen** und R-19 meldet das Binding als ungültig. Kein neuer Codepfad, keine zweite
   Prüfstelle — genau das ist der nachhaltige Teil.

3. **Migration: keine.** Alle realen Graph-JSONs der Familie geprüft
   (`docs/graph/graphcode.graph.json`, beide `rig/dummy-slicer`-Modelle): **0 unsichere Pfade**.
   Der Bump bricht keine existierenden Bindings.

4. **`ONTOLOGY_VERSION` 3.7.0 → 3.8.0** (`contracts src/se/index.ts`). `RULES_VERSION` bleibt —
   es kommt keine Regel hinzu, R-19/R-20 werden nur strenger *im Schema*. In graphcode ist die
   Version nirgends hart gepinnt (nur dynamisch via `host.ts`/`host.bridge.test.ts`), der Bump
   ist dort schnittfrei.

5. **Lokaler Containment-Guard für den Nicht-Ontologie-Sink.** `input.name` ist kein
   `codeRef`/`testRef`, sondern Tool-Input — contracts kann es nicht abdecken. Also in
   `src/mcp-tools.ts`: `GraphExportInputSchema.name` auf ein Basename-Muster einengen
   (`/^[A-Za-z0-9._-]+$/`, kein Separator) **plus** ein `assertInRepo(repoRoot, rel)` unmittelbar
   vor *jedem* Write des Tools (`resolve` + `relative`; Ablehnung wenn das Ergebnis mit `..`
   beginnt oder absolut ist). Doppelt, absichtlich: das Schema erklärt dem Agenten den Fehler
   früh, die Assertion ist die Sperre, die auch einen künftigen dritten Sink erwischt.

6. **Guard-Helfer bleibt vorerst in `mcp-tools.ts`** (~8 Zeilen, beide Sinks liegen dort). Das hält
   diesen CR bei 6 Dateien; CR-GC-256 verschiebt ihn beim Aufteilen in ein eigenes Modul. Kein
   Parallelpfad — es gibt zu jedem Zeitpunkt genau eine Guard-Implementierung.

7. **Bridge an Loopback binden.** `listen(port, '127.0.0.1')` in `src/viewer/host.ts:153`. Die
   Log-Zeile stimmt danach von selbst. Kein Config-Flag, kein Opt-out: eine Remote-Freigabe wäre
   eine eigene Entscheidung (Auth + Origin-Check) und ist nicht Teil dieses CRs.

## Betroffene Dateien

**sigloch-modules/packages/contracts** (danach `npm run build` + `npm install` in den Konsumenten —
kein `npm publish`, `file:`-Deps):
1. `src/se/ontology.ts` — `RepoRelativePathSchema` + Einsatz in TestRef/CodeRef/SchemaRef
2. `src/se/index.ts` — `ONTOLOGY_VERSION` → 3.8.0
3. `tests/unit/se-ref-paths.test.ts` — neu

**graphcode:**
4. `src/mcp-tools.ts` — `assertInRepo` + beide Sinks + `name`-Schema
5. `src/viewer/host.ts` — Loopback-Bind
6. `tests/security.path-containment.test.ts` — neu

## Akzeptanz

- [ ] contracts-Unit (ohne fs): `../`-, absoluter, `~`- und Backslash-Pfad ⇒ `TestRefSchema`/
      `CodeRefSchema`/`SchemaRefSchema` lehnen ab; `tests/foo.test.ts` und `src/a/b.ts` passieren.
- [ ] graphcode-Regression: `testRef.file = '../../X.test.ts'` durchs Gate ⇒ `graph_export`
      schreibt **nichts** außerhalb `repoRoot`, `stubs` ist leer, R-19 meldet das Binding.
- [ ] graphcode-Regression: `graph_export({ name: '../../../X' })` ⇒ Fehler, keine Datei außerhalb
      `repoRoot`, und `clearExportPending` wurde **nicht** aufgerufen (Drift-Marker steht noch).
- [ ] Bind-Assertion: `bridge.start()` ⇒ `server.address().address` ist `127.0.0.1`, nicht `::`.
- [ ] Alle 3 realen Graph-JSONs re-importieren unverändert (kein Migrationsbedarf, Decision §3).
- [ ] `npm run build` + `npm test` grün in contracts *und* graphcode; `graph_export` auf dem
      eigenen SSOT erzeugt keinen Diff außer erwartetem.

## Nicht in diesem CR

- Read-Seite: `extractCodeFacts` liest `join(repoRoot, ref.file)` (`src/conformance.ts`). Nach
  Decision §1 kann `ref.file` kein `..` mehr enthalten, damit ist der Lesepfad mit-geschlossen —
  ohne zusätzliche Zeile. Kein Restrisiko offen, daher kein Folge-CR.
- Auth/Origin für die Bridge (wäre eine Reichweiten-*Erweiterung*, nicht dieser Fix).
- `npm audit`: 4 Findings erreichen Konsumenten, alle transitiv über
  `@modelcontextprotocol/sdk` → hono/fast-uri und **nicht erreichbar** (graphcode importiert nur
  `StdioServerTransport`). Separat, kein Sicherheitsfix an eigenem Code → eigener CR/Chore.
