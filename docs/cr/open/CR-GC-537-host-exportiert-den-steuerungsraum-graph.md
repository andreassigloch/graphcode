# CR-GC-537: Host exportiert den Steuerungsraum: graph_readiness (oder graph_metrics) liefert steer = SteerScore (worst, worstAt, mean, score, measured) plus die vier STEER_RULES-Terme je Element (value, threshold, normiert) aus se-engine steerScore. Heute nur als verdict.steer.improvement je Suggestion sichtbar; GVE-Dashboard (ITEM-2026-018 Punkt 1) darf nicht selbst rechnen

**Status:** 🟠 Open
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
