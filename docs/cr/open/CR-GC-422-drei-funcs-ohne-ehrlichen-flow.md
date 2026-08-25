# CR-GC-422 — Drei FUNCs ohne ehrlichen FLOW

**Status:** open — Befund, keine Umsetzung. Braucht eine Entscheidung, keinen Code.
**Herkunft:** CR-GC-409 §A, Rest nach CR-GC-412/414/415/416/417/418/419/421.

Nach dem Abarbeiten von Gruppe A bleiben drei R-31 stehen. Für keinen der drei
gibt es einen FLOW, den man ohne Erfindung ziehen kann. Der Befund steht hier,
damit niemand die Kante „zur Sicherheit" doch zieht.

## 1 · `FUNC-bind-tools` — durch eine Kompositionswurzel fließen keine Daten

`bindToolsToHarness(harness, auditLog)` erzeugt den Werkzeugkontext und mischt die
acht Werkzeuggruppen zu einer Registry. Was sie liefert, ist ein
`Record<string, MCPTool>` — Name, Beschreibung, Input-Schema und **eine Funktion**.
Ein SCHEMA darüber wäre ein Vertrag über Verhalten, kein Datenformat.

Ihr Eingang ist ebenso keiner: der Harness und der Audit-Log sind Objekte mit
Lebenszyklus, keine Nachricht.

§A hatte diesen Ausgang vorgesehen („oder Entscheidung: Infrastruktur-FUNCs ohne
io akzeptieren"). Die Entscheidung ist eine Familie-Frage, keine Repo-Frage:
**soll R-31 eine Grundgesamtheit ohne Kompositionswurzeln bekommen** — analog zu
CR-SM-256, das die Rollup-Blöcke ausgenommen hat, weil durch einen Blackbox-Block
ebenfalls nichts fließt? Dagegen spricht die Reihenschaltung aus CR-SM-257: jede
Ausnahme in R-31 kappt das erste Glied, und dann verlangt SC-04 an dieser Stelle
nie ein SCHEMA. Ohne Messung an mehreren Selbstmodellen ist das nicht zu
entscheiden.

Ein echter, aber ANDERER Vertrag liegt eine Ebene weiter: das MCP-Tool-Manifest
(Name + JSON-Schema je Werkzeug), das `bindRegistryToMcpServer` an den Client
veröffentlicht. Das ist der Ausgang von `FUNC-serve-stdio`, nicht der von
`bind-tools` — es zu `bind-tools` zu ziehen wäre die bequeme Lüge.

## 2 · `FUNC-export-marker` — die Existenz IST das Signal

`setExportPending` schreibt `.graphcode/EXPORT_PENDING`. Der Inhalt ist im Code
ausdrücklich kein Datum: „Existence is the signal; the text is for a human running
`cat` on the marker." Der pre-commit-Hook prüft nur, ob die Datei da ist.

Der Eingang wäre ehrlich (`FLOW-committed-graph → FUNC-export-marker`: nach dem
Persistieren wird markiert). Für den Ausgang gibt es zwei Wege, und beide sind
Entscheidungen:

- **a)** Ein concept-SCHEMA („kein Wire-Format, die Existenz ist der Vertrag") —
  formal zulässig (Vorbild `SCHEMA-measurement-vector`), aber ein Modellknoten
  ohne Code-Gegenstück.
- **b)** Dem Marker einen echten Inhalt geben (`{ since, graphVersion }`), damit
  der Hook sagen kann, WIE WEIT der Snapshot zurückhängt. Rückwärtskompatibel
  (der Hook testet nur Existenz) und nützlich — aber das ist eine neue
  Anforderung, kein Regel-Fix.

## 3 · `FUNC-extract-mutate` — der Eingang ist unstrukturierter Text

`extractMutateFromText(text: string)` ist Prosa-Recovery: sie holt ein
Kommando-Objekt aus einer Modellantwort, die statt eines Tool-Calls Text geliefert
hat. Der Ausgang ist verdrahtet (`FLOW-mutate-cmd`); es fehlt der Eingang.

Der Eingang ist die rohe Antwort des Modells. Für sie existiert in `executor.ts`
kein Zod-Symbol — die Provider-Antwort wird ad hoc gelesen. Ein
`FLOW-model-answer` mit `SCHEMA = z.string()` wäre ein Vertrag ohne Inhalt, und
genau das ist der Punkt dieser Funktion: sie existiert, WEIL an dieser Stelle
kein Vertrag gilt.

Ehrlicher Weg, falls das geschlossen werden soll: die Provider-Antwort in
`executor.ts` bekommt ein Zod-Schema (Text + Tool-Calls + Stop-Grund). Das ist
ein eigener CR mit eigenem Nutzen (heute fällt ein abweichendes Backend erst im
Parser auf), nicht ein Nebeneffekt der Verdrahtung.

## Kein Regel-Tausch

Alle drei würden sich mit einer Kante schließen lassen, die entweder ein SCHEMA
ohne Code-Gegenstück (→ RC-04) oder ein SCHEMA ohne Inhalt erzeugt. Beides tauscht
eine Regel gegen eine andere. Deshalb bleibt dieser CR offen.
