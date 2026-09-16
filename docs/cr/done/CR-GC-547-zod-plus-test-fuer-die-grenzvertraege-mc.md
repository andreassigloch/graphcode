# CR-GC-547: Zod plus Test fuer die Grenzvertraege: MCPTool/MCPToolRegistry als Laufzeitvertrag, parse im einen Bauplatz der Registry, Vertrags-TEST gegen die echte Registry - R-32 und RC-04 erfuellen statt abschwaechen

**Status:** ✅ Done (2026-09-16)
**Typ:** aus Item ITEM-2026-224 (idea)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-224.json (Lane: code)

---

Antwort auf die Frage „was spricht dagegen, es einfach zu machen?" — **nichts.** Die Vorgabe
Zod-plus-Test war richtig, meine Verteidigung der Ausnahme war es nicht.

## Was ich zuerst falsch gemacht habe

Nach CR-GC-546 habe ich R-32 (kein Vertrags-TEST) und RC-04 (kein `parse` an der Schnittstelle)
als Regel-PROBLEM dargestellt: die drei Vertraege seien TS-Interfaces mit Funktionsmitgliedern,
fuer die Zod nicht gemacht sei. Das war eine Verteidigung des Bestands, keine Messung. Beide
Regeln hatten recht: ein realisierter SCHEMA ohne Test und ohne Pruefstelle ist eine Behauptung.

## Was der Zug tut

**1. Zwei Laufzeitvertraege statt zweier Behauptungen.** `MCPToolSchema` und
`MCPToolRegistrySchema` in `tool-contract.ts`. Fuer Funktionsmitglieder prueft `z.custom`, was
pruefbar ist — dass das Member da und eine Funktion ist. Das faengt genau den Fehler, der an
dieser Grenze vorkommt: eine Fabrik, die ein Member vergisst oder falsch benennt.

**2. Die Pruefstelle dort, wo der Vertrag zuschnappt.** `bindToolsWithContext` parst das
Register, das acht Fabriken gemeinsam fuellen. Nicht als eigene `pruefeRegistry()`-Funktion,
die ein Aufrufer vergessen koennte — im einen Bauplatz, unumgehbar. `parse`, nicht `safeParse`:
ein kaputtes Register ist kein Zustand, in dem der Host weiterlaufen soll. Bis hierher hielt den
Vertrag nur der Compiler, und der sieht nichts, was durch `Record<string, MCPTool<any, any>>`
kommt — ein Werkzeug ohne `handler` fiel erst beim Aufruf auf, im Agenten.

**3. Der Vertrags-TEST gegen die ECHTE Registry.** `tests/tool-contract.test.ts` baut einen
echten Harness, laesst die acht Fabriken laufen und parst das Ergebnis. Eine handgebaute
Attrappe haette bewiesen, dass das Schema zu sich selbst passt. Dazu drei Gegenproben, die je
das Member im Fehlertext verlangen.

## Der Fund, der den Zug fast verdorben haette

Mein erster Anlauf hat auch ein `ToolPortSchema` gebaut. **Das war innerhalb von Minuten ein
Duplikat** — `tool-context-contract.ts` traegt laengst denselben `member()`-Helfer, prueft
`harness`, `auditLog` und die Funktions-Member, wird in `createToolContext` mit
`ToolContext.parse` wirklich ausgefuehrt, und `_portCheck` erzwingt beim Kompilieren, dass der
Kontext den Port erfuellt. Ein zweites Schema fuer eine Teilmenge davon ist genau der parallele
Pfad, gegen den dieser ganze Zug laeuft.

Entfernt. Und im Modell dieselbe Bewegung: `SCHEMA-tool-port` und `FLOW-tool-port` (beide aus
CR-GC-546, wenige Stunden alt) sind geloescht — der Port ist die segregierte SICHT auf denselben
Vertrag, den `SCHEMA-tool-context` traegt. Der wiederum war `concept: true` und ungebunden; seit
es ein Zod-Schema gibt, das wirklich geparst wird, ist das ueberholt. Jetzt gebunden an
`tool-context-contract.ts#ToolContext`.

## Eine Kennzahl, die den richtigen Schritt bestraft hat

`grenzmenge.mjs` zaehlte `MCPTool` (Typ) und `MCPToolSchema` (Laufzeit) als ZWEI Grenzsymbole.
Die Pflichtmenge waere durch Zod-first von 49 auf 50 gestiegen und die Deckung gefallen — die
Kennzahl haette genau den Schritt bestraft, den R-32 und RC-04 verlangen. `X` und `XSchema` aus
derselben Datei werden jetzt gefaltet: ein Vertrag, zwei Gesichter.

## Ergebnis

| | v287 | v289 | Δ |
|---|---:|---:|---:|
| R-32 (kein Vertrags-TEST) | 36 | **33** | −3, fuer alle drei erfuellt |
| RC-04 (keine parse-Stelle) | 23 | **22** | −1 |
| warning gesamt | 151 | 147 | −4 |
| error | 4 | 4 | 0 |
| Knoten | 768 | 767 | −1 (ein Duplikat weniger) |
| SCHEMA-Grenzdeckung (gefaltet) | — | **9/48 = 18,8 %** | |

**R-32 ist fuer die drei Vertraege erfuellt, nicht abgeschwaecht.** Die Regel stand seit je auf
33 von 34 realisierten SCHEMA; dieser Zug hat die Zahl nicht erhoeht, sondern gezeigt, dass sie
erfuellbar ist.

## Nachtrag — RC-04 hatte einen Modellierungsfehler von mir gefunden

Ich hatte RC-04s Befund an `MCPToolSchema` als Regel-Luecke erklaert („folgt der Zod-Komposition
nicht"). Nachgesehen, was die Regel wirklich prueft:

    f.importedSymbols.includes(ref.symbol) && f.parsedSymbols.includes(ref.symbol)

Sie nimmt die FUNCs an der MODELLIERTEN Schnittstelle des SCHEMA — die ueber seinen FLOW
io-verbundenen — und fragt in deren Code-Dateien nach Import und `.parse(`. Und damit zeigte
sie auf meinen Schnitt: ich hatte BEIDE FLOWs an dieselben zwei Enden gehaengt,

    FUNC-bind-tools -> FLOW-mcp-tool          -> FUNC-serve-stdio
    FUNC-bind-tools -> FLOW-mcp-tool-registry -> FUNC-serve-stdio

Zwischen `bindToolsToHarness` und `serveStdio` fliesst aber nur das REGISTER. Ein einzelnes
Werkzeug ist dessen Bestandteil, kein eigener Strom — eine Schnittstelle, zweimal modelliert,
derselbe Doppelpfad wie beim geloeschten `ToolPortSchema`, nur eine Ebene hoeher.

Richtiggestellt: `MCPTool` kreuzt von der Fabrik zur Oberflaeche —
`FUNC-graph-suggest` (`src/loop/suggest.ts#bindSuggestTools`, MOD-loop) erzeugt Werkzeuge,
`FUNC-bind-tools` sammelt sie ein. Das ist die Grenze, die `grenzmenge.mjs` gemessen hat.

**Danach feuert RC-04 immer noch** — es war also nicht NUR mein Fehler. Die Ursache liegt eine
Ebene tiefer, und sie ist belegt: `SCHEMA -compose-> SCHEMA` ist grammatikwidrig (R-18, am Gate
probiert, `tier: block`). Die Ontologie kann nicht ausdruecken, dass `MCPToolRegistrySchema`
den `MCPToolSchema` ENTHAELT — obwohl `z.record(z.string(), MCPToolSchema)` genau das ist.
Ohne diese Kante kann keine Regel der Komposition folgen; RC-04 muss ein zweites, direktes
`parse` verlangen, das dieselbe Pruefung ein zweites Mal faehrt.

Die eine Warnung bleibt stehen und ist hiermit BENANNT statt weggeraeumt — verboten ist nicht
die Differenz, verboten ist die unbenannte. Die Ontologie-Luecke liegt als ITEM-2026-225.

## Abnahme

- `tests/tool-contract.test.ts` gruen (4 Faelle), volle Suite gruen.
- `grep -rn ToolPortSchema src tests` leer.
- Kennzahlen-Zeile in `docs/kennzahlen.md`.
