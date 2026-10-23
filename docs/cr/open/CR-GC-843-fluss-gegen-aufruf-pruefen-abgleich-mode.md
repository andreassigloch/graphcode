# CR-GC-843: Fluss gegen Aufruf pruefen: Abgleich Modell und Code

**Status:** 🟠 Open
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

Vier Lücken der Call Hierarchy schließt das Skript selbst, jede mit Test:

- eine FUNC steht für alles Aufrufbare in ihrer Deklaration (Klasse mit Methoden, `bindReadTools` mit seinen Handlern),
- ein Aufruf über ein Interface geht an die Implementierung; erfüllt eine Klasse es nur strukturell, an die eine Deklaration gleichen Namens,
- der Aufruf eines destrukturierten Namens (`const { recordAudit } = ctx`) geht über den Typ des Objekts,
- eine Eigenschaft eines Zod-Vertrags (`tool-context-contract.ts`) zählt wie eine Signatur.

## Stand (2026-10-23)

`npm run abgleich:fluss` über `docs/graph/graphcode.graph.json`:

| Ergebnis | Paare |
|---|---|
| Aufruf | 76 |
| Aufruf über Zwischenschritte (höchstens 3) | 51 |
| kein Aufruf | 30 |
| ungeprüft: ohne Bindung | 75 |
| ungeprüft: keine TS-Datei (Skills, Skripte) | 42 |
| ungeprüft: außerhalb des Repos (Nachbarpakete) | 10 |
| asynchron, nicht geprüft | 14 |

Prüfbar sind 157 von 284 synchronen Paaren (graphify: 52 von 298).

**Behoben in diesem CR:** `FUNC-check-code-conformance` zeigte auf `conformanceViolations`, einen Wrapper, den nur `tests/conformance.test.ts` ruft. Der Weg geht über `conformanceEvaluation` (`evaluateAll` ruft sie). `realRef`, Name und Beschreibung angepasst; die Beschreibung nannte die mit CR-GC-489 gelöschte `scoreReadinessWithConformance`.

**Die 30 Paare ohne Aufruf, am Code geprüft:**

| Gruppe | Paare | Modell |
|---|---|---|
| registrierter Rückruf oder übergebene Funktion (Gate-Hooks, Shutdown-Liste, Fabrik an `ownKuzu`) | 9 | richtig |
| Socket zwischen zwei Prozessen (host.sock, Proxy) | 10 | richtig |
| Werkzeug über die Registry (`registry['graph_mutate'].handler`) | 3 | richtig |
| `FLOW-marker-clear`: `graph_export` ruft `clearExportPending`, `FUNC-export-marker` zeigt auf `setExportPending` | 1 | offen: eine FUNC für zwei Funktionen |
| `FLOW-graph-state`: `GraphStore` liefert an 7 Funktionen, die den Graphen vom Harness als Argument bekommen oder den Kuzu-Adapter selbst lesen | 7 | offen: Regel 3 aus `se:top-level` sagt, der Speicher liefert nur an den, der ihn liest |

## Offen

1. **Wie hält das Modell einen geprüften Fluss ohne Aufruf fest?** Die 22 richtigen Paare kommen bei jedem Lauf wieder. Vorschlag: das Attribut `realRef` am FLOW, mit Datei und Symbol der Übergabe (Registrierung, Socket, Registry). Das Skript zählt einen FLOW mit `realRef` als belegt. `attributes` ist ein freier Record, das Speichern braucht keinen contracts-Bump; eine Regel darüber schon.
2. `FLOW-marker-clear`: `FUNC-export-marker` teilen (setzen, löschen) oder die Bindung auf die Datei legen.
3. `FLOW-graph-state`: wer ist der Speicher im Modell, `GraphStore`, der Harness oder der Kuzu-Adapter?
4. Code-Befund: `conformanceViolations` hat im Produkt keinen Aufrufer mehr, nur einen Test.

## Akzeptanz

- Das Skript läuft ohne Host und ohne LLM, gleicher Repo-Stand ergibt dieselbe Ausgabe. ✅ (Test „gleicher Stand, gleiche Ausgabe")
- Jeder handgeschriebene `sync`-Fluss zwischen zwei FUNCs steht in genau einem Ergebnis; die `async`-Flüsse stehen als Zahl daneben. ✅
- „ungeprüft" nennt den Grund je Paar. ✅
- Ein Test mit einem Wegwerf-Repo je Ergebnis. ✅ `tests/fluss-aufruf.test.ts`, 9 Fälle, rot gesehen ohne die Auflösung über Interface und Destrukturierung.
- Die 22 richtigen Paare ohne Aufruf sind belegt (Offen 1), die 8 offenen entschieden (Offen 2, 3).

## Umfang

- Skript: `scripts/fluss-aufruf.mjs`, `npm run abgleich:fluss`. Kein Modellknoten: Entwicklungswerkzeug außerhalb des Produkts, wie die Mess-Skripte (CR-GC-760, CR-GC-844).
- relation-Kante: `FUNC-check-code-conformance`.
