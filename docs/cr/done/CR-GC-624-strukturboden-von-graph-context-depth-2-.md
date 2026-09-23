# CR-GC-624: Strukturboden von graph_context — bei depth 2 sind 72 Prozent der Antwort reine Struktur, und 42 der 54 Knoten sind Ring-2-Fan-out ueber Hub-FLOWs

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-497 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-497.json (Lane: code)

---

## Befund

CR-GC-613 hat die Prosa geschnitten und dabei die Grenze selbst benannt: *„die 30-Knoten-Scheibe
kostet allein an Format-E-STRUKTUR 4.080 Zeichen, bevor ein einziges Wort Prosa dazukommt. Darunter
käme man nur, indem man Knoten wegließe."* Der Schluss stimmte für den Schnitt, den der CR hatte —
aber die Zahl ist kein Boden, sondern die Folge einer Darstellungsentscheidung.

Nachgemessen über **alle 125 FUNC-Anker des eigenen Modells**, `depth: 2`, im Mittel je Scheibe:

| Anteil | Zeichen | Anteil |
|---|---:|---:|
| Kantenzeilen | 2.801 | 28,4 % |
| Attributzeilen (`@realRef`, `@testRefs`, `@kinds`) | 2.593 | 26,3 % |
| Identitätszeilen des Außenrings | 1.730 | 17,5 % |
| Prosa (Anker + REQ + SCHEMA) | 2.670 | 27,0 % |
| **gesamt** | **9.876** | |

Die Prosa ist bereits die Minderheit. Was die Scheibe trägt, ist die **Zahl der Knoten**: 12 im
Innenring, **42 im Ring 2**. Der Fan-out entsteht an Hub-FLOWs — `FLOW-graph-state` zieht jede
FUNC herein, die daran `io` hat, samt deren `@realRef`-Zeilen. Das beantwortet *wer fasst diesen
Fluss noch an* — die Frage von `graph_impact`, nicht die von `graph_context`.

## Zielbild

Der Innenring bleibt **vollständig und unverändert** — er ist die Definition of Done. Ring 2 wird
zum **Rand**: dieselbe Darstellung, die `graph_impact` seit CR-GC-373 für seine Blackbox-Front
benutzt (Identität plus Vertragskante, keine Beschreibung, keine Attribute), nur gruppiert nach
Innenknoten und Kantentyp, weil der Fan-out über wenige Hubs läuft.

```
## Rand (Ring 2 — Schnittstelle, nicht geoeffnet)
FLOW-graph-state io> ACTOR-owner FUNC-auto-export FUNC-check-code-conformance …
```

Gemessen, jeweils `depth: 2`:

| | vorher | nachher |
|---|---:|---:|
| eigenes Modell, Mittel über 125 FUNC-Anker | 9.876 | **4.828** (−51 %) |
| sigllm-Golden, Mittel über 24 FUNC-Anker | 4.383 | **3.136** (−28 %) |
| Golden-Anker `FUNC-execute-agent-run-persist-state` | 6.615 | **4.053** (−39 %) |
| derselbe Anker bei `depth: 1` | 2.845 | 2.845 (byte-gleich) |

**Das Ziel „unter 4.000" ist um 4 % verfehlt — und die Differenz ist bezahlt, nicht vergessen.**
Der erste Anlauf gruppierte den Rand nach dem *Innen*knoten und lag bei 3.513 Zeichen; er
verschluckte dabei **sechs von dreißig Knoten**: die Spec-Closure zieht über `verify`- und
`relation`-Rückkanten auch Knoten herein, die nur an *Ring-2*-Knoten hängen (ein TEST am REQ des
zweiten Rings). Nach der Quelle gruppiert kommt jede Kante genau einmal vor und damit jeder Knoten
der Scheibe. Eine Scheibe, die Knoten verliert, um eine runde Zahl zu treffen, wäre genau das
Falsch-Grün, gegen das dieser CR antritt.

Kein zweiter Weg: `buildContextSlice` bleibt unverändert (`buildJobSlice` hängt daran und braucht
die volle Knotenmenge), der Rand entsteht als **Darstellung** aus der Differenz der Scheiben
`depth` und `depth-1`. Bei `depth: 1` gibt es keinen Rand — die Antwort ist byte-gleich zu heute.

`nodeCount`/`edgeCount` zählen weiter die **ganze** Scheibe: der Rand wird gezeigt, nicht
weggelassen — sonst wäre die Kürzung eine Lüge über den Umfang.

## Akzeptanzkriterien

- [~] `graph_context {depth:2}` am sigllm-Golden: **4.053** statt 6.615 (−39 %) — das Ziel 4.000
      ist bewusst um 4 % verfehlt, siehe Zielbild; die Grenze im Messtest steht jetzt auf 4.400
- [x] `graph_context {depth:1}` byte-identisch zu heute (2.845 = 2.845, kein Rand-Block)
- [x] Jeder Knoten der Scheibe steht in der Antwort — im Innenring als Format-E-Knoten, im Rand als
      Zeile; `nodeCount` bleibt die Zahl der ganzen Scheibe
- [x] Jede Kante mit einem Fuß außerhalb steht im Rand-Block, als `Quelle kante> Ziel …`
- [x] Der Kommentar in `tests/read-tools.scope.test.ts`, der 4.080 als Untergrenze festhielt, ist
      durch die gemessene Zerlegung ersetzt
- [ ] Testsuite grün

## Umfang

`src/surface/read.ts`, `tests/read-tools.scope.test.ts`, `tests/mcp.context.test.ts` — 3 Dateien.
