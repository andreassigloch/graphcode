# CR-GC-256: `mcp-tools.ts` aufteilen (ToolContext + Tool-Gruppen)

**Status:** done (2026-07-26) · **Max Files:** 6 (graphcode)
**Abhängigkeit:** **nach CR-GC-255** — dieser CR verschiebt Code, jener ändert Verhalten in
denselben Sinks. Umgekehrte Reihenfolge macht aus einem 8-Zeilen-Guard einen Merge-Konflikt.
**Kontext:** Audit-Befund 2026-07-26. `src/mcp-tools.ts` hat **1273 Zeilen** — 2,5× die
500-Zeilen-Grenze aus `CLAUDE.md` und die größte Datei im Repo (`src/` gesamt: 8543 Zeilen, also
15% davon in einer Datei).

## Problem (Why)

Nicht Ästhetik, drei konkrete Kosten:

1. **Die Datei ist ein einziger Closure.** `bindToolsToHarness` läuft von Zeile 352 bis 1273; alle
   19 Tools sind darin definiert und schließen über gemeinsamen Zustand. Jede Tool-Änderung lädt
   das komplette Registry in den Kontext — teuer für kleinere Modelle und für gefüllte
   Context-Windows genau der Fall, den die 6-Dateien-Regel vermeiden soll.
2. **Der geteilte Zustand ist unsichtbar, aber invariant-tragend.** `_graphVersion` (monoton, aus
   dem durablen Log fortgesetzt, CR-GC-232/233) und `toolWriteChain` (Serialisierung von
   Check+Gate+Record als eine Einheit) sind lokale `let`s. Wer die Datei naiv aufteilt und pro
   Modul eine eigene `bindX(harness)`-Factory baut, erzeugt **mehrere** `_graphVersion`/
   `toolWriteChain` — also Parallelpfade, die die OCC-Invariante still brechen. Das Risiko wächst
   mit jeder weiteren Zeile in der Datei.
3. **Tool-Gruppen sind schon sauber getrennt, nur nicht physisch.** Die Section-Banner markieren
   bereits read / write / rules / audit / query-precision / export / readiness / tests / authoring.
   Der Schnitt existiert konzeptionell; er ist nur nicht als Datei geführt.

## Decision

1. **`ToolContext` als *einmalig* erzeugter Träger des geteilten Zustands.** Neu:
   `src/tool-context.ts` — eine Factory `createToolContext(harness, auditLog)` liefert
   `{ harness, auditLog, codec, gcCodec, graphVersion(), recordAudit, serializeToolWrite,
   occReject, batchUids }`. `_graphVersion` und `toolWriteChain` leben **nur** hier, hinter der
   Factory gekapselt; `graphVersion()` ist der Lese-Accessor, `recordAudit` der einzige Schreiber.
   Damit ist „genau eine Instanz" strukturell erzwungen statt kommentiert.
2. **Tool-Gruppen als Module, die `ctx` bekommen** — jedes exportiert
   `bindXTools(ctx: ToolContext): Partial<MCPToolRegistry>`:
   - `src/tools/read.ts` — `graph_elements`, `graph_get_node`, `graph_get_edges`, `graph_impact`,
     `graph_expand`, `graph_context` (Read + Query-Precision, R12/R13 gehören zusammen)
   - `src/tools/write.ts` — `graph_mutate`, `graph_realize`, `graph_merge`, `graph_reseed`
   - `src/tools/report.ts` — `rules_evaluate`, `rules_get_violations`, `audit_trail`,
     `audit_stats`, `graph_readiness`, `graph_tests`, `graph_help`, `graph_authoring_guide`
   - `src/tools/export.ts` — `graph_export` (+ der `assertInRepo`-Guard aus CR-GC-255 zieht
     hierher, Decision §6 dort)
3. **`mcp-tools.ts` bleibt der Kompositions-Root und der öffentliche Einstieg.** Es behält
   `bindToolsToHarness` (gleiche Signatur, gleiche 19 Schlüssel, gleiche Reihenfolge) und
   komponiert nur noch: `ctx` erzeugen, die vier `bindXTools(ctx)` mergen, Registry zurückgeben.
   `package.json` exportiert `./mcp` → `dist/mcp-tools.js`; dieser Pfad darf sich nicht ändern.
   Kein Re-Export-Shim für verschobene Symbole — verschobenes Zeug ist verschoben (keine
   parallelen Pfade).
4. **Input-Schemas wandern mit ihrer Gruppe**, nicht in eine Sammel-Datei. Ein Schema neben dem
   einzigen Tool, das es benutzt, ist der Punkt der Übung.
5. **Reines Verschieben, kein Verhaltens-Refactor.** Keine Signatur-, Beschreibungs- oder
   Semantik-Änderung an irgendeinem Tool in diesem CR. Beschreibungen sind Agent-Oberfläche
   (`graph_authoring_guide`, Skills, `mcp.symmetry`) — ein Wort dort ist eine Verhaltensänderung
   und gehört nicht in einen Struktur-CR.
6. **Ziel-Größen:** `mcp-tools.ts` < 120 Zeilen, jedes `tools/*.ts` < 500. Kein Modul wird
   nachträglich zum neuen 1000-Zeiler: `report.ts` ist mit 8 Tools der Kandidat und wird beim
   nächsten Tool dort gesplittet, nicht erweitert.

## Betroffene Dateien (6, graphcode)

1. `src/tool-context.ts` — neu (geteilter Zustand + Write-Primitive)
2. `src/tools/read.ts` — neu
3. `src/tools/write.ts` — neu
4. `src/tools/report.ts` — neu
5. `src/tools/export.ts` — neu
6. `src/mcp-tools.ts` — auf Kompositions-Root reduziert

Keine Test-Datei in der Liste: der Umbau ist verhaltensneutral und durch die **19 bestehenden
`mcp.*`-Testdateien** abgedeckt, die alle über `bindToolsToHarness` gehen. Bleiben sie unverändert
grün, ist das der Beweis. Muss eine angefasst werden, ist Decision §5 verletzt — dann stoppen.

## Akzeptanz

- [ ] `bindToolsToHarness` liefert exakt dieselben 19 Schlüssel; `tests/mcp.symmetry.test.ts` und
      `tests/skills.mcp-conformance.test.ts` (Counts aus dem Live-Registry abgeleitet, CR-GC-205)
      bleiben unverändert grün.
- [ ] **Kein `mcp.*`/`host*`/`operations-log`-Test wurde editiert** (`git diff --stat tests/` leer).
      Das ist das eigentliche Akzeptanzkriterium für „reines Verschieben".
- [ ] OCC-Invariante: `tests/mcp.occ.test.ts` grün — und `grep -c "toolWriteChain\|_graphVersion"`
      über `src/` ergibt Treffer in **genau einer** Datei (`tool-context.ts`).
- [ ] Host-Shim-Proxy-Invariante (CR-GC-235) hält: `getRepoRoot()` wird weiterhin erst im
      Write-Pfad gelesen, nie zur Bind-Zeit — `tests/host-shim.test.ts` + `host.bridge-attach`
      grün.
- [ ] `npm run build` + `npm run bundle` grün; `tests/distribution.test.ts` grün (die vier
      neuen Module müssen im Self-contained-Bundle landen, nicht extern werden).
- [ ] `src/mcp-tools.ts` < 120 Zeilen, kein `src/tools/*.ts` ≥ 500 Zeilen.
- [ ] `npm test` vollständig grün (Basislinie 2026-07-26: 300 Tests / 56 Dateien).

## Nicht in diesem CR

Die übrigen vier Dateien über der 500-Zeilen-Grenze — `exporter-views.ts` (996), `harness.ts`
(745), `scaffold.ts` (624), `readiness.ts` (608). Eigene CRs, andere Schnitte; `harness.ts` trägt
das Gate und wird nicht nebenbei angefasst.
