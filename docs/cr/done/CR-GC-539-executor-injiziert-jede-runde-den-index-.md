# CR-GC-539: Executor injiziert jede Runde den Index aller Knoten — Zod-Default limit:100 umgangen

**Status:** ✅ Done (2026-09-16) — AK3 offen, benannt
**Typ:** aus Item ITEM-2026-075 (finding)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-075.json (Lane: code)

---

BEFUND (Leitlinie Satz 6: need-to-know-Whitebox). src/loop/executor-prompt.ts:171 ruft registry['graph_elements'].handler({}) ROH auf - also am inputSchema.parse vorbei, das der MCP-Server sonst davorschaltet (mcp-server.ts:59). Damit greift der Zod-Default limit:100 nicht: surface/read.ts:265 fuehrt nodes.slice(0, undefined) aus und liefert den GANZEN Graphen. Gebremst wird das nur durch einen 8000-Zeichen-Deckel, und der Fokus-Typ-Filter greift erst bei Ueberlauf.

WIRKUNG: der Executor injiziert jede Runde den Index aller Knoten in den Prompt. Das ist genau das Gegenteil des Kern-Claims - der Agent soll auf einer Whitebox gefuehrt werden, nicht auf dem ganzen Repo raten. Auf dem graphcode-Modell sind das 757 Knoten je Runde.

FIX: den Handler ueber dasselbe inputSchema aufrufen, das der MCP-Server benutzt, statt roh. Dann gilt der deklarierte Default, und der Fokus-Filter wirkt ab der ersten Runde statt erst am Deckel. Kein neuer Parameter, kein zweiter Pfad - die Schema-Schicht existiert bereits, sie wird nur umgangen.

DATEIEN (an der Modell-Reichweite gemessen, FUNC-build-round-injection, 3 Dateien):
1. src/loop/executor-prompt.ts - Aufruf ueber inputSchema.parse
2. src/loop/executor.ts - Konsument von FLOW-round-prompt, falls die Injektionsgroesse dort zugesichert wird
3. tests/executor.test.ts - TEST-one-driver-local-and-frontier deckt diese FUNC ab

AKZEPTANZKRITERIEN:
1. Rot zuerst: ein Test misst die Zahl der injizierten Knoten auf einem Graphen mit mehr als 100 Knoten. Vor dem Fix sind es alle, danach hoechstens der deklarierte Default.
2. Der Fokus-Typ-Filter wirkt ab Runde 1, nicht erst bei Zeichenueberlauf - im Test belegt.
3. Die Executor-Suite bleibt gruen; die Rundenzahl bis zum Handoff verschlechtert sich nicht (Gegenprobe auf dem rig, Zahl im CR).

---

## UMSETZUNG (2026-09-16)

### Der Befund ist schaerfer, als der CR ihn beschrieben hat

Der CR sagt "der Executor injiziert jede Runde den Index ALLER Knoten ... auf dem
graphcode-Modell sind das 757 Knoten je Runde". Gemessen stimmt das fuer den HANDLER, nicht
fuer den Prompt: `nodes.slice(0, undefined)` gab tatsaechlich alle 757 heraus, aber der
8000-Zeichen-Deckel kappte davor schon auf ~100 Zeilen. Die Zahl im Prompt war also nie 757.

Der Schaden liegt woanders — und er ist groesser. Gemessen am echten
`docs/graph/graphcode.graph.json`, beide Builds, dieselbe Funktion:

| Fokus-Typen | ALT: Knoten / davon Fremdtyp | NEU: Knoten / davon Fremdtyp | Zeichen alt -> neu |
|---|---|---|---|
| (keine) | 100 / 0 | 100 / 0 | 6699 -> 6012 |
| UC, FCHAIN | 100 / **100** | 29 / **0** | 7097 -> 2498 |
| REQ | 100 / **100** | 100 / 0 | 7099 -> 7717 |

**Bei Fokus UC/FCHAIN war KEINER der 100 injizierten Knoten ein UC oder FCHAIN.** Der Deckel
schnitt die ersten 100 uid-sortierten des GANZEN Graphen ab — ACTOR-*, CR-*, ... Der Agent
bekam jede Runde eine Liste, in der genau das fehlte, woran er arbeitete. Nicht "zu viel",
sondern "die falschen": das Gegenteil der need-to-know-Whitebox (Leitlinie Satz 6). Der
Fokus-Filter existierte, war aber an den Zeichenueberlauf gebunden und lief nie an.

### Der Fix

`registry['graph_elements'].handler(...)` laeuft jetzt durch DASSELBE `inputSchema.parse`,
das der MCP-Server davorschaltet. Damit greift der deklarierte `limit`-Default — und zwar
als GELESENER Wert (`inputSchema.parse({}).limit`), nicht als zweite Zahl an dieser Stelle.

Mit Fokus-Typen wird je Typ abgefragt (`type` ist der deklarierte Parameter des Tools).
Nachtraeglich zu filtern waere wirkungslos: die ersten `limit` uid-sortierten Knoten des
ganzen Graphen enthalten von einem Fokus-Typ womoeglich keinen einzigen — genau die Lage
oben. Die Gesamtkappe bleibt der deklarierte Default; verteilt wird REIHUM, sonst bekaeme
bei zwei Typen der alphabetisch fruehere alles. Der Rest-Hinweis zaehlt mit `total` (der
Zahl VOR dem Zuschnitt), sonst untertreibt er, sobald ein Typ mehr als `limit` Knoten hat.

### Rot zuerst

Mit dem alten Aufruf (roh, ein Call) fallen:

    x element index with uid · type · name rides in the prompt
      -> expected not to contain 'SYS-app · SYS · Test App'
    x index budget: oversized index filtered to the focus types
      -> expected not to contain 'UC-bulk-007'

Neu gepinnt in `tests/executor.test.ts`: die Zahl der Index-Zeilen gegen
`inputSchema.parse({}).limit` (ohne UND mit Fokus), kein Fremdtyp im Fokus-Index, und beide
Fokus-Typen vertreten (Reihum-Nachweis).

### Was dabei bewusst wegfaellt — benannt, nicht verschwiegen

Knoten von NICHT-Fokus-Typen stehen nicht mehr im Index. Im bestehenden Testfall heisst das
konkret: `SYS-app` fehlt, obwohl die Grammatik darueber `SYS compose→ UC` nennt. Der TYP
bleibt also sichtbar, die konkrete uid nicht; der Index-Block nennt `graph_elements` als
Weg dorthin. Das ist die Konsequenz aus "need-to-know", und ob sie den Agenten Runden
kostet, misst genau AK3 — die unten offen bleibt.

### AK-Bilanz

1. ERFUELLT — Zahl der injizierten Knoten auf einem >100-Knoten-Graphen: hoechstens der
   deklarierte Default, als Test gepinnt; vorher der ganze (gedeckelte) Graph.
2. ERFUELLT — der Fokus wirkt ab Runde 1: gemessen 100 Fremdtypen -> 0.
3. **NICHT ERFUELLT, und zwar nicht "gleich geblieben", sondern NICHT GEMESSEN.** Die
   Executor-Suite ist gruen (26/26), die volle Suite auch (141 Dateien / 1146 Tests). Die
   Runden-Gegenprobe auf dem Rig ist ausgefallen:

       alt: genRounds 12, modelTurns 24, mutatesApplied 0, tokensIn 37495, done false
       neu: genRounds 12, modelTurns 24, mutatesApplied 0, tokensIn 37495, done false

   Bitweise identisch — aus zwei Gruenden, die beide neben der Sache liegen: (a) LM Studio
   weist in JEDEM zweiten Turn das `messages`-Array nach einem Tool-Ergebnis ab, kein Lauf
   erreicht einen Handoff (ITEM-2026-200); (b) der Lauf startet auf einem LEEREN Graphen,
   wo der Element-Index in beiden Builds leer ist — der geaenderte Pfad laeuft gar nicht.
   Die Gleichheit ist also kein Beleg fuer "keine Verschlechterung", sondern die Signatur
   einer Messung, die nichts gemessen hat.

   OFFEN BLEIBT DAMIT: ob die Beschraenkung auf Fokus-Typen den Agenten Runden kostet, weil
   ihm eine anzuhaengende uid fremden Typs fehlt. Wieder aufzunehmen, sobald ITEM-2026-200
   behoben ist — dann gegen einen VORBEFUELLTEN Graphen, nicht gegen einen leeren.
