# CR-GC-1027: Typbindung in die CI: erzeugte bindungen.ts, Altlast 41 FUNC, Gleichstand-Test, Modellknoten (Teil 2 aus CR-GC-1026)

**Typ:** aus Item ITEM-2026-1669 (idea)
**Erstellt:** 2026-11-24
**Item:** bok/items/ITEM-2026-1669.json (Lane: code)
**Vorgänger:** CR-GC-1026 (Spike mit Go, Teil 1: Generator und Verb)

---

## Ziel

Die Typbindung aus CR-GC-1026 läuft in der CI: `npm run type-check` prüft `tests/typbindung/bindungen.ts`. Jede Blatt-FUNC, deren Signatur vom Anfrage- oder Antwort-SCHEMA abweicht und nicht in der Altlast steht, macht den Lauf rot. Ebenso jede FUNC der Altlast, die nicht mehr abweicht (Ratsche, Entscheidung des Autors 2026-11-24, Variante A).

## Zug

1. `tests/typbindung/bindungen.ts` aus `graphcode typbindung`: 8 FUNC gebunden, 41 in der Altlast, 41 nicht prüfbar mit Grund.
2. `tests/typbindung/altlast.json`: die 41 FUNC, deren Bindung beim ersten Lauf rot war. Erhoben aus den Meldungen des Typprüfers, nicht von Hand ausgewählt.
3. Test auf Gleichstand in `tests/typbindung.test.ts`: Die committete Datei entspricht der aus Snapshot, Code und Altlast neu erzeugten. Ändert sich eines davon ohne neuen Lauf des Verbs, wird der Test rot.
4. **Eigener Aufrufvertrag statt Callback:** Der Erzeuger bekam in Teil 1 die Richtung als Funktion übergeben. Ein Callback lässt sich nicht als Zod-Vertrag beschreiben, und die eigene FUNC wäre in ihrer Prüfung nicht prüfbar gewesen. Jetzt nimmt `typbindungen` reine Daten (`TypbindungEingabeSchema`: Graph, Aufrufe aus `funcCalls`, Abstände aus `ChainRoles.depth`, Quelltexte, Altlast, Ziel). Die Regel „Code vor Kette“ (`aufruferAus`) liegt im Erzeuger.
5. **Das Verb hat einen eigenen Aufrufvertrag** (`TypbindungOptionenSchema`) und gibt das Ergebnis zurück. Mit `FLOW-cli-command` als Anfrage wäre es sofort Drift gewesen, wie die anderen CLI-Verben in der Altlast.
6. Modell durch das Gate: `FUNC-typbindung-verb`, `FUNC-erzeuge-typbindung`, `FCHAIN-typbindung` (mit `FUNC-cli-dispatch`, wie `FCHAIN-contract-test-generation`), FLOW für Aufruf, Bericht, Eingabe, Ergebnis und CLI-Ausgabe, drei SCHEMA mit Vertragstest, `REQ-typbindung` und `REQ-typbindung-regeln` mit `TEST-typbindung`.

## Dateien (10)

`src/projections/typbindung.ts`, `src/surface/typbindung-verb.ts`, `src/cli.ts`, `tests/typbindung.test.ts`, `tests/typbindung/bindungen.ts`, `tests/typbindung/altlast.json`, `tests/vertrag/SCHEMA-typbindung-eingabe.vertrag.test.ts`, `tests/vertrag/SCHEMA-typbindung-ergebnis.vertrag.test.ts`, `tests/vertrag/SCHEMA-typbindung-optionen.vertrag.test.ts`, diese Datei. Die README-Zeile für das Verb fällt der Dateigrenze zum Opfer; die Hilfe der CLI nennt es.

## Abnahme

- `npm run type-check`: 0 Fehler.
- Gegenprobe der Ratsche: `FUNC-schema-guard` aus der Altlast genommen → 1 Fehler; die grüne `FUNC-cr-groups` in die Altlast gesetzt → „Unused '@ts-expect-error' directive“. Beides zurückgenommen → 0 Fehler.
- Gegenprobe Gleichstand: Altlast ohne ihren ersten Eintrag → Test rot; zurück → grün.
- Die zwei eigenen FUNC sind gebunden und grün.
- `verify:code` grün bis auf `distribution` (contracts 12.18.0 nicht veröffentlicht, FAQ `peer-floor-wann`).

## Offen und benannt

- **Release:** contracts 12.18.0 (CR-SM-459) ist nicht veröffentlicht. Bis zum Release-Zug bleibt `distribution` rot; die CI braucht das veröffentlichte Paket. Den Zug fährt der Agent nur mit Freigabe des Auftraggebers.
- **Modell-Spur:** Ein reiner Modellzug kann die Bindungsdatei veralten lassen. Die Modell-Spur (`verify:model`) fährt den Test auf Gleichstand nicht; die volle Suite in der CI fängt es.
- **Bekannte Grenze des Erzeugers:** Ein FLOW an einen Akteur gilt als Rückgabe (Artefakt bei `FUNC-serve-sse`, das in der Altlast steht).

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang laut `graph_impact`

Neue Knoten: `FUNC-typbindung-verb`, `FUNC-erzeuge-typbindung`, `FCHAIN-typbindung`, `SCHEMA-typbindung-eingabe`, `SCHEMA-typbindung-ergebnis`, `SCHEMA-typbindung-optionen`, `REQ-typbindung`, `REQ-typbindung-regeln`, `TEST-typbindung` und drei Vertragstests. Bestehend berührt: `FUNC-cli-dispatch` (zwei FLOW mehr), `UC-intent-to-code` (eine Kette mehr).
