# CR-GC-326 — Modulkennzahlen je MOD herausgeben, nicht nur Regelverstöße

**Status:** done (2026-08-12) · **Datum:** 2026-08-12
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert**
**Bezug:** CR-165/CR-171 (MT-01/MT-02), CR-SM-221 (FLOW-transitive Verbindungspaare),
CR-SM-223 (MT-03 → `allocationCohesion` als Messung), [CR-GC-325](CR-GC-325-dimension-readiness-ueber-mcp.md) (Dimensionsscores)
**Vorbedingung:** CR-SM-232 (`sigloch-modules/docs/cr/open/CR-SM-232-modulkennzahlen-als-messung.md`) —
contracts exportiert `moduleMetrics()`; ohne das gäbe es die Kennzahl hier ein zweites Mal.

---

## 1. Problem

Architektursteuerung braucht Kennzahlen **je Modul**. graphcode gibt heute nur Regelverstöße heraus:

- **MT-01 (Instabilität)** meldet ausschließlich die Verletzer über 70 %. Auf graph-view-edit sind
  das 2 von 5 Modulen; für `MOD-command-bridge`, `MOD-view-registry` und `MOD-se-dashboard` ist über
  MCP **kein Wert** zu bekommen — nicht „gut", sondern gar nichts. Ein Trend („war 62 %, ist 68 %")
  ist damit unmöglich, obwohl genau das die Steuerungsgröße wäre.
- Die Bestandteile der Kennzahl stehen nur als Fließtext im `message`:
  `"Edit-Surface has instability 71% (>70%). fan_in=12, fan_out=29"`. Ein Konsument müsste den Satz
  parsen, um `fanIn`/`fanOut` zu bekommen.
- **MT-02 (LCOM4)** meldet erst ab 4 Komponenten. „Kein Verstoß" heißt LCOM4 ∈ {1,2,3} — welcher
  Wert, steht nirgends.
- **`allocationCohesion()`** ist in contracts exportiert, worst-first sortiert und ausdrücklich als
  **Messung ohne Schwellwert** angelegt (der 80-%-Schwellwert MT-03 traf 4 von 4 Modulen auf
  graph-view-edit, 6 von 7 auf graphcode, 10 von 11 auf dem Familiengraphen und wurde deshalb
  zurückgezogen — „a measurement must not masquerade as a defect"). **Kein Tool exponiert sie.**
  Damit ist die eine Zahl unerreichbar, die der Architekt beurteilen soll.

**Folge:** ein Dashboard kann die Architektur-Achse nur als Verstoßliste zeigen — rot oder gar nichts.
Eine Kennzahl mit Ziel- oder Vorwert braucht den Wert auch dann, wenn keine Regel feuert.

---

## 2. Ziel

Für jedes MOD sind Instabilität, LCOM4 und Allokationskohäsion als **Zahlen** abrufbar — unabhängig
davon, ob eine Regel darauf feuert.

---

## 3. Nicht-Ziele

- **Keine neue Metrik.** Alle drei Rechnungen liegen in `@sigloch/contracts/se/metric-rules`. Dieser
  CR exponiert, was da ist — er erfindet keine Kennzahl und kalibriert keine Schwelle.
- **Kein Schwellwert für die Kohäsion.** Sie bleibt schwellenlos (CR-SM-223). Wer sie doch ampeln
  will, tut das im Konsumenten, nicht hier.
- **Keine Änderung an MT-01/MT-02 als Regel.** Die Verstöße bleiben, wie sie sind; die Kennzahl
  kommt daneben, nicht statt dessen.
- **Keine Zeitreihe.** Ein Verlauf braucht Persistenz und ist ein eigener CR — hier entsteht nur der
  abrufbare Momentanwert.

---

## 4. Anforderungen

1. Read-only-Ausgabe mit einer Zeile je MOD. **Empfohlen analog der Entscheidung in CR-GC-325:**
   ein Feld `modules` an `graph_readiness` statt eines eigenen `graph_metrics` — ein Aufruf, ein
   Zeitstempel für Gates, Dimensionen und Modulkennzahlen. Zeilenform:
   `{ moduleId, moduleName, allocatedFuncs, fanIn, fanOut, instability, lcom4, cohesion: {internal, external, ratio} | null }`
2. Die Werte kommen aus `moduleMetrics()` in `@sigloch/contracts/se` (CR-SM-232) — graphcode
   rechnet nichts und parst keinen `message`-String. Dieser CR startet erst, wenn CR-SM-232
   ausgeliefert ist (contracts ≥ 3.3.0); vorher gäbe es die Formel zweimal.
3. `cohesion` ist `null` für Module, die contracts bewusst auslässt (< 2 allokierte FUNCs oder keine
   externe Verbindung) — kein 0-Wert, der eine Messung vortäuscht.
4. Sortierung: schlechteste Kohäsion zuerst, wie `allocationCohesion` sie liefert — die Rangfolge
   IST das Signal.
5. Test auf einem Modul **ohne** Regelverstoß: es erscheint mit Werten in der Ausgabe.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/tools/report.ts` | `graph_metrics` registrieren + Beschreibung |
| `src/metrics.ts` (neu) | dünner Adapter: `Graph` → `OntologyGraph` (via `toOntologyGraph`) → `moduleMetrics()` |
| `tests/metrics.test.ts` (neu) | Modul ohne Verstoß hat Werte; `cohesion: null` bei < 2 FUNCs; Sortierung |
| `src/index.ts` | Export, falls das Tool von außen typisiert konsumiert wird |

4 Dateien. Der contracts-Export ist kein Teil dieses CRs, sondern seine Vorbedingung (CR-SM-232).

---

## 6. Akzeptanzkriterien

- [x] Das Tool liefert **eine Zeile je MOD**, auch für ein Modul, über das weder MT-01 noch MT-02
      etwas meldet (`tests/metrics.test.ts`, Fixture-Annahme im Test selbst geprüft). Nicht auf
      graph-view-edit nachgemessen — der Fremdrepo-Stand bewegt sich; der Test misst denselben
      Mechanismus deterministisch.
- [x] `instability` ist exakt der Wert aus der MT-01-Meldung (der Test vergleicht Prozentzahl,
      `fan_in` und `fan_out` gegen den Meldungstext) — eine Rechnung, zwei Ausgaben.
- [x] Ein MOD mit einer allokierten FUNC liefert `cohesion: null` und `lcom4: null`, nicht `0`.
- [x] `npm run build` + volle Suite grün.

**Umsetzung, abweichend von §5:** die Vorbedingung war real — `mt01Instability` gab die Zahl nur
im Meldungstext heraus. Sie ist als **CR-SM-232** in `@sigloch/contracts` umgesetzt und als
**3.3.0** publiziert: `moduleMetrics()` ist die eine Rechnung, MT-01/MT-02 schwellen sie nur noch,
`allocationCohesion` ist ihre Projektion. graphcode hängt auf `^3.3.0`.

Dateien: `src/tools/metrics.ts` (neu — eigene Tool-Gruppe statt `report.ts`: dessen Größen-Guard
CR-GC-256 §6 sagt, der nächste Reporting-Tool splittet die Datei), `src/mcp-tools.ts` (Wiring),
`tests/metrics.test.ts`. Ein `src/metrics.ts`-Adapter wurde nicht gebraucht — der einzige Adapter
ist die Graph→OntologyGraph-Abbildung, und das ist die EINE aus `conformance.ts` (CR-GC-324).

---

## 7. Folgen

Zusammen mit CR-GC-325 ist die Architektur-Achse dann vollständig aus graphcode bedienbar:
Dimensionsscore als Aggregat, Modulkennzahl als Drill-down. Der Renderer zeigt nur noch.

@author andreas@siglochconsulting
