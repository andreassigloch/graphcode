# CR-GC-623: Werkzeugbeschreibungen nennen einen Parameter, den es nicht gibt — graph_help({id:...}) statt {token:...}, und der Fehlaufruf wird still geschluckt

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-496 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-496.json (Lane: code)

---

## Befund

Der Testlauf 2026-09-22 hat die Verschiebung gemessen, die CR-GC-612 erzeugt hat:
**Nachschlage-Aufrufe 3 → 11**, `graph_help` 3 → 7, Bytes 1.319 → 11.002 — *„sieben `graph_help`
hintereinander, direkt nachdem der Agent die gedünnten Beschreibungen gelesen hat."* Die
Information war verschoben, nicht gespart.

Die Ursache steht im Quelltext, nicht im Modell des Agenten. **Vier Beschreibungen nennen einen
Parameter, den `graph_help` nicht hat:**

| Ort | Text |
|---|---|
| `report.ts:175` (`rules_evaluate`) | `graph_help({id:"rules_evaluate"})` |
| `report.ts:334` (`graph_readiness`) | `graph_help({id:"graph_readiness"})` |
| `metrics.ts:112` (`graph_metrics`) | `graph_help({id:"graph_metrics"})` |
| `suggest.ts:186` (`graph_suggest`) | `graph_help({id:"graph_suggest"})` |

Der Parameter heißt `token`. Die Beschreibung von `graph_help` selbst sagt ebenfalls „Without an
**id** …".

**Und der Fehlaufruf schlägt nicht fehl.** `mcp-server.ts` ruft `tool.inputSchema.parse(args)`;
ein Zod-Objekt ist per Default nicht `strict`, also fällt `id` stillschweigend weg und `token` ist
`undefined` — das ist genau der Zweig „ohne Token": der Agent fragt *„was bedeutet graph_metrics"*
und bekommt die kontextuelle **Maßnahmenliste des ganzen Projekts**. Richtig geantwortet, falsche
Frage, volle Länge. Danach fragt er nochmal.

## Zielbild

1. Die vier Stellen nennen `token` — der Parameter, den es gibt.
2. **Ein unbekannter Argumentname ist ein Fehler, keine leere Eingabe.** Der MCP-Server meldet
   jedes Werkzeug mit dem **strengen** Eingabeschema an (`z.object(...).strict()`). Ein Fehlaufruf
   korrigiert sich damit in einem Turn statt in sieben, und die veröffentlichte JSON-Schema-Zusage
   trägt `additionalProperties: false` — ein Client kann den Fehlgriff selbst abfangen.

   **Korrektur gegenüber dem ersten Entwurf:** dieser CR wollte zuerst im Callback des Servers
   prüfen. Das geht nicht, und zwar gemessen: das SDK parst die Argumente, **bevor** unser
   Callback sie sieht — der Prüfer bekam bereits `{}` und der Testfall über den echten
   MCP-Client kam mit `{"measures":[]}` zurück, also genau mit dem Fehler, den er finden sollte.
   Die Strenge muss im angemeldeten Schema stehen, nicht dahinter.

   Der Preis: die Meldung ist Zods (`Unrecognized key: "id"`) — sie benennt den Fehlgriff, nicht
   die Alternative. Die trägt die Beschreibung (Punkt 1) und das Schema in der Werkzeugliste.

   Die in-process-Aufrufe der Registry (Executor, Skills, Tests) laufen weiter über `handler()`
   und bleiben unberührt.
3. **Erzwungen statt dokumentiert:** ein Test liest jede Beschreibung der gebundenen Registry,
   sammelt daraus die Aufruf-Schnipsel `<werkzeug>({<schlüssel>: …})` und prüft jeden Schlüssel
   gegen die Shape genau dieses Werkzeugs. Eine Beschreibung, die einen Parameter erfindet, macht
   die Suite rot.

Damit trägt die Beschreibung den einen Satz, der die häufigste Fehllesung verhindert — und der
Satz ist nachweisbar wahr, nicht nur gut gemeint.

## Akzeptanzkriterien

- [x] Kein `({id:` mehr in einer Werkzeugbeschreibung; `graph_help` selbst spricht von `token`
- [x] `graph_help({id:'graph_metrics'})` über den echten MCP-Client scheitert und nennt `id`
      (`tests/mcp.stdio-server.test.ts`); kein Werkzeug der Registry lässt einen Fremdschlüssel durch
- [x] `graph_help({token:'graph_metrics'})` liefert weiter den Werkzeug-Eintrag,
      `graph_help({})` weiter die Maßnahmenliste
- [x] Der Registry-weite Test findet die vier heutigen Stellen, wenn man den Fix zurücknimmt
      (Positivkontrolle im Test-Kommentar benannt)
- [ ] Testsuite grün

## Umfang

`src/projections/report.ts`, `src/projections/metrics.ts`, `src/loop/suggest.ts`,
`src/surface/mcp-server.ts`, `tests/tool-description-params.test.ts` (neu),
`tests/mcp.stdio-server.test.ts` — 6 Dateien.
