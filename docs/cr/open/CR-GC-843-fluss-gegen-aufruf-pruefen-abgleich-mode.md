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

## Reihenfolge

1. **graphify (ITEM-2026-1027):** Methoden und Eigenschaften von Objektliteralen, die eine Funktion tragen, als FUNC extrahieren, mit ihren Aufrufen. Ziel: die 127 nicht extrahierten Symbole sinken unter 20.
2. **graphcode, dieser CR:** ein Prüfskript in `MOD-dev-scripts`. Es schreibt nichts ins Modell und gibt je Fluss eines von vier Ergebnissen aus: Aufruf, Aufruf über Zwischenschritte, kein Aufruf, ungeprüft (mit Grund). Die Liste „kein Aufruf" ist der Eingang für `se-vorbereitung` Schritt 4.
3. **Die 12 Paare oben** am Code prüfen; Modellfehler in diesem CR beheben.
4. **Erst nach der Messung aus Schritt 2:** mit Smeagol klären, ob daraus eine Regel in contracts wird. Eine Regel braucht den Aufrufgraphen als Eingabe, und die Regeln lesen heute nur das Modell. Vorher die Frage stellen, ob das Skript allein reicht.

## Akzeptanz

- Das Skript läuft ohne Host und ohne LLM, gleicher Repo-Stand ergibt dieselbe Ausgabe.
- Jeder handgeschriebene Fluss zwischen zwei FUNCs steht in genau einem Ergebnis.
- „ungeprüft" nennt den Grund je Paar (Symbol nicht extrahiert, ohne Bindung).
- Ein Test mit einem Wegwerf-Repo: ein Fluss mit direktem Aufruf, einer über einen Zwischenschritt, einer ohne Aufruf, einer mit ungebundener Seite.

## Umfang

Noch keine relation-Kanten: die FUNC des Skripts entsteht mit Schritt 2.
