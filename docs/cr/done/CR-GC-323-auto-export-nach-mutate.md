# CR-GC-323 — Der Export folgt der Mutation (entprellt, single-flight, atomar geschrieben)

**Status:** done (2026-08-12) · **Datum:** 2026-08-12
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert**
**Bezug:** CR-GC-113 (Export als einziger Sync-Pfad), CR-GC-296 (export-after-own-mutate),
CR-GC-217 (export-pending-Marker), CR-GC-235 (Host-Election), CR-GVE-139 (SSE-Live-Refresh in GVE)

---

## 1. Problem

`graph_mutate` schreibt nur den Store. `docs/graph/*.graph.json` und `docs/views/*.md` ändern sich
erst, wenn jemand `graph_export` ruft (`src/tools/write.ts` hat keinen Export-Pfad — bewusst, seit
CR-GC-113 ist Export „der eine Sync-Weg", aber eben ein manuell ausgelöster).

Jeder Konsument, der die committete SSOT liest, sieht deshalb nach einer Agent-Mutation weiter den
alten Stand. Gemessen an GVE: dessen Live-Refresh hängt an einem fs-Watcher auf
`docs/graph/*.graph.json` (`vite.config.js:437`) — das ist der EINZIGE Invalidate-Trigger. Kein
Export ⇒ keine Dateiänderung ⇒ kein SSE-Invalidate ⇒ die Ansicht bleibt stehen, ohne dass irgendwo
etwas rot wird. GVE-eigene Edits sind unauffällig, weil GVE nach jedem `/api/mutate` selbst
exportiert (`vite.config.js:304-310`); genau die Sessions, die am meisten mutieren — Agenten über
MCP — tun das nicht.

Zweiter, bislang latenter Befund im selben Pfad: `graph_export` schreibt mit `writeFileSync`, also
truncate-dann-schreiben. Ein paralleler Leser (der Datei-Watcher weckt genau so einen) kann in
diesem Fenster eine abgeschnittene JSON lesen. Bei manuellem Export ist das Fenster selten genug,
um nie aufgefallen zu sein; ein Export nach jeder Mutation macht es wahrscheinlich.

**Kosten des Exports (gemessen, damit die Häufigkeitsfrage nicht geraten wird):** Graph-JSON +
alle 16 Markdown-Views, komplett neu gerendert aus dem In-Memory-Graphen — 8–10 ms warm für 455
Elemente / 956 Traces (graphcode selbst, 427 KB JSON + 541 KB Markdown), 23 ms beim ersten Aufruf.
Der Export ist billig genug, um ihn an jede Mutation zu hängen; er ist zu schreiblastig, um ihn N-mal
pro Agent-Batch zu fahren.

---

## 2. Ziel

1. Eine erfolgreiche Mutation zieht den Export nach sich — ohne dass ein Agent daran denken muss.
2. Ein Batch aus N Mutationen schreibt EINEN Export, nicht N.
3. Ein Leser sieht die exportierte Datei nie halbfertig.

---

## 3. Nicht-Ziele

- **Kein zweiter Schreibweg.** Der Auto-Export ruft das gebundene `graph_export`-Tool derselben
  Registry — derselbe Refuse-to-Clobber-Guard, dieselbe Provenienzprüfung (CR-GC-296), dieselben
  Pfade. Kein Export-Code neben dem Export-Code.
- **Kein `force`.** Der Auto-Export exportiert mit `force:false`. Eigene, auditierte Löschungen
  lässt der Guard über die Provenienz durch; eine fremde/stale Löschung soll auch hier abbrechen.
- **Keine Registry-weite Aktivierung.** Registriert wird ausschließlich im gewählten HOST
  (`bootHost`). Ein Proxy (CR-GC-235) oder eine Test-Registry bindet dieselben Tools und darf davon
  nichts ins Repo schreiben.
- **Keine Serialisierung des Exports gegen laufende Mutationen.** `graph_export` liest
  `harness.getGraph()` und hat vor dem Schreiben ein `await` (Audit-Query im Drop-Fall) — dieselbe
  Interleaving-Lage wie beim manuellen Export heute. Dieser CR macht sie nicht schlimmer und nicht
  besser; eine Einreihung in die Write-Chain wäre ein eigener CR.
- **Kein Flush beim Shutdown.** Stirbt der Host im Debounce-Fenster, fehlt der Export — der
  `export-pending`-Marker (CR-GC-217) bleibt gesetzt und der pre-commit-Freshness-Guard sieht es.

---

## 4. Anforderungen

| REQ | Kind | Anforderung | Verification |
|---|---|---|---|
| REQ-A01 | functional | Nach einem erfolgreichen `graph_mutate` schreibt der Host Graph-JSON **und** Views, ohne dass `graph_export` gerufen wurde. | test |
| REQ-A02 | functional | N Mutationen innerhalb des Debounce-Fensters erzeugen genau EINEN Export, und der trägt den letzten Stand. | test |
| REQ-A03 | functional | Trifft eine Mutation ein, während ein Export läuft, wird genau EIN Nachlauf gefahren — nie zwei Exporte gleichzeitig. | test |
| REQ-A04 | negative | Ein geblockter Batch und ein no-op-Batch (`mutations === 0`) lösen keinen Export aus. | test |
| REQ-A05 | negative | Ein scheiternder Export ändert `success` der Mutation nicht und wirft nicht in den Aufrufer; der Fehler geht nach stderr. | test |
| REQ-A06 | non-functional | Der Hook blockiert `mutate()` nicht (er stellt nur den Timer) und hält den Prozess nicht am Leben (`timer.unref()`). | review + test (Suite terminiert) |
| REQ-A07 | functional | `graph_export` schreibt Graph-JSON und Views atomar (Temp-Datei im Zielverzeichnis + `rename`), ohne Temp-Reste. | test |

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/auto-export.ts` | neu — `registerAutoExport(harness, graphExport, opts)`: post-apply-Hook, trailing Debounce (250 ms), Single-Flight, Fehlerisolation |
| `src/mcp-server.ts` | `bootHost`: nach `bindToolsToHarness` den Auto-Export registrieren |
| `src/tools/export.ts` | `writeFileAtomic()` + Einsatz für Graph-JSON und Views (Stubs bleiben `writeFileSync`: sie werden nur angelegt, nie überschrieben) |
| `tests/auto-export.test.ts` | neu — REQ-A01..A07, echtes Disk-Kuzu im tmp-Repo |

Vier Dateien, unter dem 6-Datei-Limit.

---

## 6. Akzeptanzkriterien

1. [x] `graph_mutate` gegen einen frischen tmp-Store schreibt ~250 ms später `docs/graph/<sys>.graph.json`
   inkl. `docs/views/srs.md`, ohne Export-Aufruf.
2. [x] Drei Mutationen in Folge = ein Export, der alle drei enthält.
3. [x] Export-Fehler → Mutation bleibt `success: true`, Knoten liegt im Store.
4. [x] `writeFileAtomic` ersetzt die Datei per rename (Inode wechselt) und lässt kein Temp zurück.
5. [x] Mutationsprobe: `schedule()` im Hook deaktiviert → REQ-A01/A02/A03/A05 rot, REQ-A04/A07 grün
   (die Negativ-Tests laufen gegenläufig, also messen sie wirklich etwas).
6. [x] `npm run build` + volle Suite grün (86 Dateien / 636 Tests, 2026-08-12).

---

## 7. Folgen

- **GVE:** der explizite Export in `handleMutateRequest`/`handleRealizeRequest`
  (`vite.config.js:304-310`, `321-331`) wird nach dem Rollout redundant — er bleibt vorerst, weil er
  synchron VOR der HTTP-Antwort schreibt, während der Auto-Export ~250 ms später kommt. Aufräumen
  ist ein GVE-CR, kein Teil hiervon.
- **Session-Hook als Alternative entfällt.** Der zwischenzeitlich erwogene `PostToolUse`-Hook auf
  `mcp__graphcode__graph_mutate` in `.claude/settings.json` wäre pro Repo zu konfigurieren gewesen
  und hätte nur Claude-Sessions abgedeckt — nicht jeden Konsumenten des Hosts.
