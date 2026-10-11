# CR-GC-786: graph_readiness bricht an Anforderungen mit Art-Werten vor contracts 10 ab (siconizer)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-823 (bug)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-823.json (Lane: code)

---

**Bezug:** Hygiene; aufgefallen im Spike Gesamt-Impact, Fall 3 (graphanalyze
`docs/messung/gesamt-impact-fall3-2026-10-10/verworfen-siconizer/`).

## Befund

`graph_readiness` bricht am siconizer-Modell mit einem Schemafehler ab, statt zu berichten.

- Stelle: `takeSteeringSnapshot` (`dist/kernel/measure/steering-snapshot.js`), `SteeringSnapshotSchema.parse`.
- Meldung: an 12 Elementen `kinds[0]` außerhalb von funktional und nicht-funktional.
- Ursache der Daten: das Modell trägt Art-Werte aus der Zeit vor contracts 10 (CR-SM-366 hat die Werte auf zwei
  verkürzt).
- `graph_metrics` und `rules_evaluate` laufen am selben Modell durch; `rules_evaluate` meldet 88 Fehler.

## Offene Frage vor dem Bau

Wo gehört die Meldung hin? Zwei Lesarten, zu entscheiden an der Ursache und nicht am Symptom:

1. Der Stand ist ein Datenfehler, den eine Regel als Befund nennen muss; `graph_readiness` berichtet dann mit
   diesem Befund und rechnet, was rechenbar ist.
2. Der Stand darf gar nicht geladen werden; dann fehlt die Ablehnung beim Laden mit benanntem Grund.

Kein Abfangen der Ausnahme ohne diese Entscheidung.

## Umfang

Reproduktion als Test (kleines Modell mit einem alten Art-Wert, auf Disk), dann die Ursache nach der
Entscheidung oben. Voraussichtlich `src/kernel/measure/steering-snapshot.ts`, der Lader und ein Test.

## Abnahme

- Der Test bildet den Abbruch nach und ist danach grün.
- Am siconizer-Modell antwortet `graph_readiness` mit einem benannten Befund oder lehnt mit benanntem Grund ab.
