# CR-GC-324 — `graph_next_step` ist noch regelblind: der Rest von CR-GC-303

**Status:** done (2026-08-12) · **Datum:** 2026-08-12
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert**
**Bezug:** [CR-GC-303](../done/CR-GC-303-attribut-abflachung-steering-blind.md) (Attribut-Abflachung,
done 2026-08-07), CR-GC-299 (superseded), CR-GC-219 (flaches Export-Encoding als Konvention),
CR-GC-223/ST-5 (`nextStep`), CR-GC-287 (ND-Injektion)

---

## 1. Problem

CR-GC-303 hat den abgeflachten Export aus dem Steering-Pfad entfernt: `takeSteeringSnapshot`
mappt seit 2026-08-07 über `toOntologyGraph` aus `conformance.ts` (typisierte Felder aus dem Bag
gehoben, Bag behalten). **`nextStep` hat den alten Pfad behalten.** `src/steering.ts:49` trägt
weiterhin eine eigene, private Kopie:

```ts
function toOntologyGraph(graph: Graph): OntologyGraph {
  return JSON.parse(exportGraphJson(graph)) as OntologyGraph;   // src/steering.ts:49
}
```

Damit steht genau die parallele Abbildung wieder da, deren Beseitigung CR-GC-303 war — nur eine
Datei weiter. `graph_next_step` ist das **einzige** Tool, das die volle contracts-Regelbasis nach
außen gibt; es tut das über ein Encoding, in dem jede `attributes.*`-lesende Regel ins Leere greift.

**Gemessen am laufenden Host** (graph-view-edit, graphVersion 1064, 2026-08-12 18:18):

| Regel | `rules_evaluate` (Gate, liest den Graph) | `graph_next_step` (flacher Export) | wahr |
|---|---|---|---|
| R-19 TEST.testRef | **0** | **14** | 0 — `graph_get_node TEST-dashboard` liefert `testRef {file: tests/dashboard.test.mjs, tool: vitest}` |
| R-20 FUNC.realRef | 12 | 13 | 12 — ein FUNC trägt realRef, der flache Pfad sieht ihn nicht |

Dasselbe Muster trifft VR-01 (`attributes.testResult`), AF-01..05 (`analysisFreshness`), R-26
(`realRef`) und die `concept`/`external`-Ausnahmen von R-19/R-20 — also genau die acht dauerfeuernden
Regeln, die `tests/steering-snapshot.test.ts` für den Snapshot-Pfad bereits absichert.

**Warum das mehr ist als eine falsche Zahl:** `nextStep` priorisiert. Eine Regel, die 14-mal
scheinfeuert, verschiebt das Ranking der Dimensionen und damit die eine Handlungsempfehlung, die das
Tool ausgibt. Ein Konsument (Agent, Dashboard) kann die Fehlmessung nicht erkennen — die Antwort
sieht genauso aus wie eine echte.

---

## 2. Ziel

`nextStep` benutzt dieselbe Abbildung wie `takeSteeringSnapshot`. Danach existiert in graphcode
**eine** Graph→OntologyGraph-Abbildung, nicht zwei.

---

## 3. Nicht-Ziele

- **Kein Format-Wechsel.** `exportGraphJson` bleibt flach (CR-GC-219/CR-GC-201: das Encoding ist
  committete SSOT-Konvention, die Provenienzprüfung hängt daran). Geändert wird der Konsument,
  nicht die Datei.
- **`graph_readiness` bleibt unverändert.** Der L2-Gate-Pfad liest direkt vom Graph und war nie
  betroffen; ein Ergebnis-Shift dort wäre eine Regression (CR-GC-303, Punkt 2).
- **Keine neue Priorisierungslogik.** Dieser CR korrigiert die Eingabe von `nextStep`, nicht seine
  Gewichtung. Dass sich die ausgegebene Empfehlung dadurch ändert, ist das erwartete Ergebnis,
  kein Umbau.

---

## 4. Anforderungen

1. `src/steering.ts` löscht seine lokale `toOntologyGraph`-Funktion und den `exportGraphJson`-Import.
2. `nextStep` bezieht `og`, `violations` und `report` aus `takeSteeringSnapshot(graph)` — dieselbe
   Quelle, die `generate.ts` und `tools/write.ts` schon nutzen. Die ND-Injektion (CR-GC-287) darf
   dabei nicht verloren gehen: sie gehört in den Snapshot, nicht in einen zweiten Aufrufer.
3. Ein Test, der ROT ist, solange die zweite Abbildung existiert: ein Fixture mit gesetztem
   `testRef`/`realRef`/`testResult` muss über `nextStep` **null** R-19/R-20/VR-01-Funde ergeben.
4. Gegenrichtung: eine **fehlende** Bindung wird weiterhin gemeldet (kein Blindmachen durch den Fix).
5. Grep-Nachweis im Abschluss: keine zweite `JSON.parse(exportGraphJson(...))`-Stelle mehr in `src/`.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/steering.ts` | lokale `toOntologyGraph` + `exportGraphJson`-Import raus; `nextStep` über `takeSteeringSnapshot` |
| `src/steering-snapshot.ts` | ND-Injektion aufnehmen, falls sie heute nur in `steering.ts` sitzt |
| `tests/steering.test.ts` | neuer Regressionstest (gebundenes Fixture → 0 Funde; ungebundenes → Funde) |

3 Dateien.

---

## 6. Akzeptanzkriterien

- [x] `rules_evaluate` und `graph_next_step` melden auf demselben Graphen für R-19/R-20/R-26/VR-01
      **dieselben** Zählwerte — als Regressionstest in `tests/steering.test.ts`: ein Fixture mit
      gesetztem `testRef`/`realRef`/`testResult` ergibt über `nextStep` **null** Funde dieser vier
      Regeln, ein ungebundenes weiterhin Funde (Gegenrichtung, kein Blindmachen).
- [ ] ~~Auf graph-view-edit (graphVersion 1064)~~ — nicht nachgemessen: der Fremdrepo-Stand hat sich
      seit dem 2026-08-12 18:18 bewegt, die Zahl wäre nicht mehr dieselbe Messung. Der
      Regressionstest oben deckt denselben Mechanismus deterministisch ab.
- [x] `graph_readiness` liefert unverändert dieselben Gates/Scores wie vor der Änderung
      (`tests/mcp.readiness.test.ts` unverändert grün; der L2-Gate-Pfad wurde nicht angefasst).
- [x] `npm run build` + volle Suite grün.
- [x] `grep -rn "JSON.parse(exportGraphJson" src/` zeigt keine Stelle mehr. Dafür sind über den
      geplanten Umfang hinaus auch `src/fit-advisory.ts` und `src/tools/suggest.ts` auf den einen
      Mapper umgestellt worden — sonst wäre das CR-Ziel („danach existiert **eine**
      Graph→OntologyGraph-Abbildung") nicht erreicht, sondern nur die lauteste der drei Kopien
      beseitigt. `exportGraphJson` selbst bleibt unangetastet (Export/Provenienz).

**Mutationsprobe:** `src/steering.ts` auf den alten Pfad zurückgesetzt → der neue Test schlägt mit
„R-19 fired although the binding is present" fehl; mit dem Fix grün.

---

## 7. Folgen

Ist dieser CR zu, ist `graph_next_step` die belastbare Quelle für die volle Regelbasis — die
Voraussetzung dafür, dass [CR-GC-325](CR-GC-325-dimension-readiness-ueber-mcp.md) die
Dimensionsscores herausgibt, ohne falsche Zahlen zu exportieren.

@author andreas@siglochconsulting
