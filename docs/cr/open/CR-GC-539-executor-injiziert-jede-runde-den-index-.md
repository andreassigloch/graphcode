# CR-GC-539: Executor injiziert jede Runde den Index aller Knoten — Zod-Default limit:100 umgangen

**Status:** 🟠 Open
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
