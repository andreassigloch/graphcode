# CR-GC-596: Abbruchregel in der Maschine: zweimal derselbe Fokus nach angewandter Mutation -> Fund-Set zurueckstellen (Sitzungsgedaechtnis im Server, nicht im Graphen); nur noch zurueckgestellte Funde -> Endzustand stalled (nicht done), Uebergabe an den Menschen

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-447 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-447.json (Lane: graph)

---

## 1 Befund (Lauf 11, opus5-11)

R-04 stand sechsmal hintereinander im Fokus; der Vektor der Steuerterme blieb von Zug 18 bis 28
identisch (BW-02 0,25 · CR-01 0,50 · R-04 0,25). Sieben Zuege verbrannt. `generationStep` ist rein;
nach einem erfolglosen Zug liefert es denselben Fokus. Der Executor zaehlte fuer sich (CR-GC-281),
ein MCP-Host hatte nichts — `defer` haette er selbst fuehren muessen. Und war alles zurueckgestellt,
hiess die Antwort "ignorieren, wiederholen": dort entstand die Schleife.

## 2 Umsetzung

- `src/loop/stagnation.ts`: Sitzungsgedaechtnis je Harness (WeakMap, Prozesslebensdauer, nicht im
  Graphen). Regel: kommt nach einem Zug (Graph-Version gestiegen) derselbe Fokus wieder → Fund-Set
  zurueckstellen, naechster Kandidat derselben Rangfolge. Ohne Zug kein Abbruch (Determinismus).
- `generate.ts`: neuer Endzustand `stalled` (nicht done, kein Fokus, Liste der zurueckgestellten
  Funde, "nicht weiter mutieren, uebergib an den Menschen"). "defer ignorieren" ist weg.
- `graph_generate` (Host) und `next` teilen das Gedaechtnis; der Executor haelt an `stalled` an und
  behaelt vorerst seine gemessene Zaehlung (ITEM-2026-449, benannte Ausnahme).
- Register-Satz `stalled`, woertlich in `se:generate` (Schritt 5).

## 3 Tests

`tests/stagnation.test.ts` (echtes Gate): zweites gleiches Feedback → anderer Fokus; zweimal
generate ohne Zug → gleich; Treiber unberuehrt; genug Zuege ohne Wirkung → `stalled`, nie done,
fuer `next` und `graph_generate`. Der alte Test "alles deferred → Fallback ohne Dead-End" ist auf
`stalled` umgestellt — er hatte genau das Schleifenverhalten festgehalten.

**Kongruenz:** benannte Ausnahme. Bestaetigung: Rewind-Lauf (CR-GC-597).
