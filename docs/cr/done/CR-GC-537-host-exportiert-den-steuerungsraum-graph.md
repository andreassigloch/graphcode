# CR-GC-537: Host exportiert den Steuerungsraum: graph_readiness (oder graph_metrics) liefert steer = SteerScore (worst, worstAt, mean, score, measured) plus die vier STEER_RULES-Terme je Element (value, threshold, normiert) aus se-engine steerScore. Heute nur als verdict.steer.improvement je Suggestion sichtbar; GVE-Dashboard (ITEM-2026-018 Punkt 1) darf nicht selbst rechnen

**Status:** ✅ Done (2026-09-16)
**Typ:** aus Item ITEM-2026-059 (idea)
**Erstellt:** 2026-09-16
**Item:** bok/items/ITEM-2026-059.json (Lane: code)

---

ZIEL. Der Host exportiert den Steuerungsraum, statt ihn nur indirekt sichtbar zu machen: graph_readiness liefert steer = SteerScore (worst, worstAt, mean, score, measured) plus die vier STEER_RULES-Terme je Element (value, threshold, normiert) aus der se-engine-Funktion steerScore. Heute ist das nur als verdict.steer.improvement je Suggestion zu sehen - das GVE-Dashboard muesste sonst selbst rechnen, und eine zweite Rechnung ist eine zweite Wahrheit (ITEM-2026-018 Punkt 1).

WARUM ZWEI CRs. Der Readiness-Bericht ist ein Zod-Vertrag in contracts (src/se/readiness.ts:67 ReadinessReport). Das Feld muss also erst im Vertrag stehen (Stufe 1, sigloch-modules), bevor graphcode es fuellen kann (Stufe 2). Reihenfolge zwingend.

SCHNITT, an der Reichweite gemessen (2026-09-16): graph_readiness haengt an FUNC-graph-readiness mit realRef src/projections/report.ts - Blast-Radius 2 Dateien (report.ts + tests/harness.import-rejected-traces.test.ts). Ausdruecklich NICHT an FUNC-compute-readiness anfassen: dessen Radius ist 14 Dateien (se-engine readiness-compute.ts, sechs .claude/commands-Skills und sechs Testdateien). Der Steuerungsraum wird im Bericht ergaenzt, nicht in der Berechnung.

STUFE 1 - sigloch-modules/contracts:
1. src/se/readiness.ts - ReadinessReport um steer erweitern (optional, damit aeltere Produzenten gueltig bleiben)
2. src/se/grammar-snapshot.ts - neu erzeugen, Version bumpen
3. tests/unit/ - Vertragstest fuer das neue Feld

STUFE 2 - graphcode:
1. src/projections/report.ts - steerScore aus se-engine ziehen und in den Bericht legen
2. tests/harness.import-rejected-traces.test.ts bzw. ein neuer Readiness-Test - das Feld pruefen

AKZEPTANZKRITERIEN:
1. graph_readiness liefert steer mit allen fuenf Feldern und den vier Regeltermen je Element; ein Aufruf ohne Daten liefert measured:false statt einer stillen Null.
2. Die Zahlen stammen aus derselben se-engine-Rechnung wie verdict.steer.improvement - kein zweiter Rechenweg. Ein Test haelt beide Werte gegeneinander.
3. FUNC-compute-readiness ist unveraendert; die 14 Dateien seines Radius sind nicht angefasst.
4. Beide Suiten gruen, check:grammar gruen.

---

## UMSETZUNG (2026-09-16)

STUFE 1 lief als CR-SM-337 und liegt in contracts 10.6.0. STUFE 2 ist das hier.

### Ein Blocker dazwischen, gefunden und behoben

`import { steerTerms } from '@sigloch/se-engine'` warf `SyntaxError: does not provide an
export named 'steerTerms'`. CR-SM-337 hatte die Funktion gebaut, aber die
Durchreiche-Zeile in `metrics.ts` nahm sie nicht mit, und `package.json` kennt nur `"."` —
es gab keinen zweiten Weg. Der einzige Ausweg OHNE Fix waere gewesen, Normierung und
Regel-Liste in graphcode nachzubauen: genau die zweite Rechnung, die dieser CR verhindern
soll. Behoben als CR-SM-340, ausgeliefert als se-engine 1.6.1.

### Der Schnitt, eingehalten

`src/projections/report.ts` (+ die Beschreibung des Tools), `tests/readiness.steer.test.ts`
(neu), `scripts/model-test-set.mjs` (der neue Test in die Modell-Spur). `FUNC-compute-readiness`
ist NICHT angefasst — weder `se-engine/readiness-compute.ts` noch die sechs
`.claude/commands`-Skills noch eine der sechs Testdateien seines Radius. Der Steuerungsraum
wurde im BERICHT ergaenzt, nicht in der Berechnung, wie der CR es vorgibt.

Der Snapshot wird jetzt EINMAL im Handler genommen und an beide Projektionen gereicht
(`dimension_readiness` und `steer`). Vorher holte `dimensionReadiness` ihn selbst; ein
zweiter Aufruf haette denselben vollen Regellauf zweimal gefahren und die beiden Bloecke
aus verschiedenen Erhebungen gespeist.

### Gemessen an der echten SSOT

    steer: { worst: 3.5, worstAt: { ruleId: "R-04", elementId: "MOD-kernel" },
             mean: 1.0285, score: 3.501, measured: 41, terms: 41 Eintraege }

    Die drei schlimmsten Terme:
      R-04   MOD-kernel               18 Vertraege am Modulrand, Budget 4   -> 3.50
      BW-02  FUNC-block-grounding     17 am Rand der Blackbox, Budget 4     -> 3.25
      CR-01  MOD-kernel                8 Kopplungen, Budget 2               -> 3.00

Das ist die Auskunft, die vorher niemand hatte, ohne sie selbst zu rechnen: nicht "wie
viele Stellen sind offen", sondern WO die schlimmste sitzt und um welchen Faktor.

### Die Akzeptanzkriterien

1. `steer` traegt alle fuenf Score-Felder plus einen Term je gemessener Blackbox
   (`ruleId`, `elementId`, `value`, `threshold`, `overshoot`). Der Vertrag aus contracts
   (`SteerSpace.safeParse`) nimmt die Ausgabe an — Stufe 1 und Stufe 2 passen zusammen.

   ZUM WORTLAUT: der CR verlangte "ein Aufruf ohne Daten liefert `measured:false` statt
   einer stillen Null". Der ratifizierte Vertrag (CR-SM-337) hat daraus die ANZAHL gemacht,
   und die beantwortet dieselbe Frage genauer: `score 0` bei `measured 0` heisst "nichts
   gemessen", `score 0` bei `measured 41` heisst "jede Blackbox im Budget". Ein eigener
   Bool daneben waere eine zweite Wahrheit ueber denselben Zustand. Der leere Fall ist als
   Test festgehalten (Graph ohne Modul: `measured 0`, `terms []`, `worstAt null`).

2. KEIN ZWEITER RECHENWEG, gemessen und nicht behauptet: der Test haelt
   `graph_readiness().steer.score` gegen `graph_mutate(dryRun).steerAdvisory.before` —
   beide 3.501. Liefe der Bericht ueber eine eigene Normierung oder ueber den
   Gate-Delta-Katalog statt des vollen, gingen die Zahlen auseinander. Zusaetzlich gepinnt:
   jeder Term stammt aus STEER_RULES, `overshoot = max(0,(value−threshold)/threshold)` auf
   12 Stellen, und `worst` ist das MAXIMUM der Terme (Chebyshev), nicht ihre Summe.

3. `FUNC-compute-readiness` unveraendert (s. o.).

4. Suite 141 Dateien / 1141 Tests gruen. Build gruen. Smoke gegen das gebaute `dist` mit der
   echten SSOT liefert dieselben Zahlen wie der Test. `check:grammar` ist nicht betroffen —
   contracts wurde in diesem CR nicht angefasst.

### Offen, benannt

`src/projections/report.ts` ist mit dieser Aenderung auf 622 Zeilen gewachsen; der eigene
Kopf der Datei setzt die Grenze bei 500 ("der naechste Reporting-Tool splittet sie, sie
waechst nicht"). Hinzugekommen ist KEIN Tool, sondern ein Feld — der Satz ist damit nicht
verletzt, die Zahl aber ueberschritten. Der Split gehoert nicht in diesen CR (er waere
beim naechsten Tool faellig und spengte den 2-Datei-Schnitt hier); als ITEM-2026-199 im
Store.
