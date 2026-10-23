# CR-GC-843: Fluss gegen Aufruf pruefen: Abgleich Modell und Code

**Status:** ✅ Done (2026-10-23)
**Typ:** aus Item ITEM-2026-1026 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1026.json (Lane: code)

---

## Befund

Keine Regel vergleicht einen Fluss mit einem Aufruf im Code. Das Gate prüft die Grammatik, die RC-Regeln prüfen, dass eine `realRef` existiert. Ein Fluss zwischen dem falschen Paar Funktionen besteht alle. CR-GC-832..838 fanden diese Fehler nur, weil Agenten den Code hinter jedem Fluss lasen (etwa 600k Token für 25 Ketten).

graphify liefert den Aufrufgraphen schon: `extractCodeRepo` gibt einen FLOW je aufgelöstem Aufruf zurück, ohne LLM.

## Messung (2026-10-22, Probe gegen `docs/graph/graphcode.graph.json`)

`extractCodeRepo` über `src/`: 372 FUNC, 540 Aufrufe. Die 298 Paare (Erzeuger-FUNC, Abnehmer-FUNC) der handgeschriebenen Flüsse:

| Ergebnis | Paare |
|---|---|
| direkter Aufruf in einer der beiden Richtungen | 30 |
| Aufruf über höchstens 3 Schritte | 10 |
| kein Aufruf gefunden | 12 |
| Symbol nicht extrahiert (Werkzeug-Handler im Objektliteral, Klassenmethode, Nachbarpaket) | 127 |
| eine Seite ohne `.ts`-Bindung (Skill, Akteur-Funktion, extern) | 119 |

Prüfbar sind damit 52 von 298 Paaren. Die größte Lücke liegt in graphify: Werkzeug-Handler wie `graph_mutate` in `src/surface/write.ts` und Methoden wie `GraphCodeHarness.mutate` sind keine extrahierten Funktionen. Das ist ITEM-2026-1027 (graphify).

Die 12 Paare ohne Aufruf sind nicht alle Modellfehler. `FLOW-proxy-call` (host-proxy → host-socket) geht über einen Socket, also über eine Prozessgrenze, nicht über einen Aufruf. „Kein Aufruf" ist deshalb ein Prüfauftrag an den Autor, kein Urteil.

Paare ohne gefundenen Aufruf:

- `FLOW-audit-record`: tool-context → audit-stats, tool-context → audit-trail
- `FLOW-element-slice`: list-elements → read-tools
- `FLOW-harness-handle`: create-harness → own-kuzu-host
- `FLOW-harness-handle-host`: own-kuzu-host → serve-sse
- `FLOW-harness-request-own-kuzu`: own-kuzu-host → create-harness
- `FLOW-own-kuzu-request`: serve-sse → own-kuzu-host
- `FLOW-proxy-answer`, `FLOW-proxy-call`: host-socket ↔ host-proxy
- `FLOW-read-request`: read-tools → list-elements
- `FLOW-seed-request`: serve-stdio → seed-from-json
- `FLOW-seed-request-import-code`: import-code-verb → seed-from-json

**Am Code geprüft (2026-10-22): alle 12 sind echte Wege, kein Modellfehler.** Der Extraktor sieht sie nicht:

| Weg im Code | Paare |
|---|---|
| Aufruf über eine Methode (`harness.listElements`, `harness.seedFromJson`) | `FLOW-element-slice`, `FLOW-read-request`, `FLOW-seed-request`, `FLOW-seed-request-import-code` |
| Fabrik als Parameter (`ownKuzu` bekommt `createHarness`) | `FLOW-harness-handle`, `FLOW-harness-request-own-kuzu` |
| Aufruf aus einer Klasse in `src/surface/host.ts` | `FLOW-own-kuzu-request`, `FLOW-harness-handle-host` |
| Socket zwischen zwei Prozessen | `FLOW-proxy-call`, `FLOW-proxy-answer` |
| Datei, später gelesen (`async`) | `FLOW-audit-record` (2 Paare) |

Folge für das Skript: nur Flüsse mit `sync` sind ein Aufruf. Ein `async`-Fluss geht über Speicher, Datei, Ereignis oder Socket. Das Skript prüft ihn nicht und zählt ihn getrennt.

## Werkzeug: TypeScripts LanguageService statt graphify (Entscheidung 2026-10-23)

Der Sprachserver (cclsp, Probe am 2026-10-23) löst genau, was graphify fehlt: `harness.seedFromJson` (Methode) zeigt auf `bootHost` und `executeImportCode`, der `graph_mutate`-Handler im Objektliteral liefert 22 Aufrufe samt Rückruf. Von Hand über cclsp wären es etwa 3 Aufrufe je Paar, rund 900 für 298 Paare.

Das Skript nutzt deshalb TypeScripts eigenen LanguageService (dieselbe Maschine hinter dem Sprachserver), ohne laufenden Server, in unter 1 s. graphify kann diesen Weg nicht gehen: sein Extraktor liest keine Funktionsrümpfe (FM-11). ITEM-2026-1027 ist damit für graphcode nicht mehr nötig; ob graphify es für andere Zwecke braucht, entscheidet sein Owner.

Fünf Lücken der Call Hierarchy schließt das Skript selbst, jede mit Test (rot gesehen ohne die Auflösung):

- eine FUNC steht für alles Aufrufbare in ihrer Deklaration (Klasse mit Methoden, `bindReadTools` mit seinen Handlern),
- ein Aufruf über ein Interface geht an die Implementierung; erfüllt eine Klasse es nur strukturell, an die eine Deklaration gleichen Namens,
- ein Methodenaufruf über einen abgeleiteten Typ (`Pick<ConformanceHarness, 'getGraph'>`) fehlt in der Call Hierarchy ganz; das Skript löst ihn über das Symbol auf,
- der Aufruf eines destrukturierten Namens (`const { recordAudit } = ctx`) geht über den Typ des Objekts,
- eine Eigenschaft eines Zod-Vertrags (`tool-context-contract.ts`) zählt wie eine Signatur.

Eine Grenze zieht es bewusst: hat eine Signatur mehr als eine Implementierung, folgt es ihr nicht. `tool.handler()` über die Werkzeug-Registry erreichte sonst jedes Werkzeug, und jeder Fluss am Registry-Aufruf galt als belegt (gesehen an `FLOW-gate-verdict`).

## Fluss-Bindung (Entscheidung 2026-10-23)

Ein Fluss, hinter dem kein Aufruf steht, den eine Typanalyse sieht, trägt seine Übergabe als `realRef` (Datei und Symbol der Stelle). Das Skript sucht zuerst den Aufruf; findet es keinen, zählt die Bindung als `belegt`, solange das Symbol existiert, sonst `beleg-kaputt`. RC-01 prüft `realRef` nur an FUNC; am FLOW meldet keine Regel etwas.

## Stand (2026-10-23)

`npm run abgleich:fluss` über `docs/graph/graphcode.graph.json`:

| Ergebnis | Paare |
|---|---|
| Aufruf | 79 |
| Aufruf über Zwischenschritte (höchstens 3) | 52 |
| belegt (Bindung am Fluss) | 27 |
| kein Aufruf | 0 |
| ungeprüft: ohne Bindung | 75 |
| ungeprüft: keine TS-Datei (Skills, Skripte) | 42 |
| ungeprüft: außerhalb des Repos (Nachbarpakete) | 10 |
| asynchron, nicht geprüft | 14 |

Prüfbar sind 158 von 285 synchronen Paaren (graphify: 52 von 298), alle 158 haben einen Aufruf oder eine Bindung.

## Modelländerungen

| Befund | Änderung |
|---|---|
| `FUNC-check-code-conformance` zeigte auf `conformanceViolations`, einen Wrapper, den nur ein Test ruft | `realRef` auf `conformanceEvaluation` (`evaluateAll` ruft sie); Name und Beschreibung nachgezogen, die gelöschte `scoreReadinessWithConformance` aus dem Text |
| 22 Paare ohne sichtbaren Aufruf: registrierter Rückruf (Gate-Hooks, Shutdown-Liste), übergebene Fabrik (`ownKuzu`), Socket (host.sock, Proxy), Registry (`registry['graph_mutate'].handler`) | `realRef` am FLOW: `hooks.ts#runPostApplyHooks`, `host.ts#start`, `mcp-server.ts#serveStdio`, `own-kuzu.ts#ownKuzu`, `host-shim.ts#handleLine`, `host-shim.ts#dispatch`, `import-code-verb.ts#executeImportCode` |
| `FLOW-mutate-answer` ging an drei Aufrufer mit drei Übergaben | je Aufrufer ein Fluss, wie auf der Anfrageseite: `FLOW-mutate-answer` (Agent, `bindRegistryToMcpServer`), `FLOW-mutate-answer-host-socket`, `FLOW-mutate-answer-import-code-verb` |
| `FUNC-export-marker` stand für setzen und löschen, gebunden nur an `setExportPending` | geteilt: `FUNC-export-marker` (setzen), neu `FUNC-export-marker-clear` (`clearExportPending`) mit Kette, Block, Modul, Anforderung. Neu `FLOW-marker-clear-reseed` (`applyReseed` löscht den Marker ebenfalls, im Modell fehlte das) und `FLOW-export-cleared` (async, an den Auftraggeber) |
| `FLOW-graph-state` ging an 7 Funktionen, die den Graphen nicht von `GraphStore` lesen | `decode` bekommt ihn vom `graph_mutate`-Handler (`FLOW-formatE-tool`, Beschreibung nachgezogen; `graph-state` jetzt an `graph-mutate-tool`). `evaluate-rules` bekommt ihn als Argument: neu `FLOW-graph-state-eval`, Übergabe `harness.ts#evaluateRules`. `graph-impact`, `graph-expand`, `list-elements`, `resolve-tests-from-code` lesen den Kuzu-Adapter direkt: neu `FLOW-store-query`, Übergabe `create-harness.ts#createHarness`. `check-code-conformance` bleibt (liest über `harness.getGraph`) |

## Offen

- Code-Befund: `conformanceViolations` hat im Produkt keinen Aufrufer mehr, nur `tests/conformance.test.ts`. Löschen und den Test auf `conformanceEvaluation` umstellen ist ein eigener CR.
- 127 ungeprüfte Paare: 75 haben eine Seite ohne Bindung (Akteur-Funktionen, extern), 42 binden an Skills oder Skripte, 10 an Nachbarpakete. Das Skript kann sie nicht prüfen.
- Ob aus der Prüfung eine Regel in contracts wird, ist mit Smeagol zu klären. Eine Regel braucht den Aufrufgraphen als Eingabe; die Regeln lesen heute nur das Modell.

## Akzeptanz

- Das Skript läuft ohne Host und ohne LLM, gleicher Repo-Stand ergibt dieselbe Ausgabe. ✅
- Jeder handgeschriebene `sync`-Fluss zwischen zwei FUNCs steht in genau einem Ergebnis; die `async`-Flüsse stehen als Zahl daneben. ✅
- „ungeprüft" und „beleg-kaputt" nennen den Grund je Paar. ✅
- Ein Test mit einem Wegwerf-Repo je Ergebnis und je aufgelöster Lücke. ✅ `tests/fluss-aufruf.test.ts`, 13 Fälle.
- Jedes prüfbare Paar hat einen Aufruf oder eine Bindung. ✅ 0 Paare ohne Aufruf.

## Umfang

- Skript: `scripts/fluss-aufruf.mjs`, `npm run abgleich:fluss`. Kein Modellknoten: Entwicklungswerkzeug außerhalb des Produkts, wie die Mess-Skripte (CR-GC-760, CR-GC-844).
- relation-Kanten: `FUNC-check-code-conformance`, `FUNC-export-marker`, `FUNC-export-marker-clear`, `FUNC-graph-store`.
