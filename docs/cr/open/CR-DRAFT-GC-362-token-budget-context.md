# CR-GC-362 — Token-budgetierter Subgraph (`graph_context(budget)`)

**Status:** draft
**Datum:** 2026-08-18
**Kontext:** `docs/LANDSCAPE.md` L2 (graphify-mcp: „token-budgeted subgraph
extraction"). Schärft R7 (`pruneToFit(maxTokens)`) und R13 (progressive
Expansion) — R7 war als Context-Primitive empfohlen, ist aber nie verdrahtet
worden. Der Local-LLM-Pfad (`graphcode run`) ist der Nutznießer: dort ist das
Fenster hart, und eine feste Tiefe liefert entweder zu wenig oder Überlauf.

## Ziel

`graph_context` (und `graph_impact`) nehmen ein optionales `budget: number`
(Token). Statt fixer Tiefe wird die **größte kohärente Scheibe unter dem Budget**
zurückgegeben — Tiefe wird ergebnisgetrieben gewählt, nicht vorgegeben. Bleibt
etwas draußen, sagt das Ergebnis das **explizit** (Handle für `graph_expand`,
plus Anzahl der weggelassenen Knoten) — kein stilles Abschneiden.

Kein Post-hoc-Kompressor: das ist genau der von R12 verworfene Weg. Budget
steuert die **Traversierung**, nicht eine Nachbearbeitung des Ergebnisses.

## Dateien (≤6)

- `src/tools/read.ts`
- `src/tool-context.ts`
- `tests/mcp.context.test.ts`
- `tests/mcp.read-format.test.ts`

## Akzeptanzkriterien

- [ ] `budget` weggelassen → heutiges Verhalten bit-identisch (Regressionstest)
- [ ] `budget` gesetzt → Ergebnis ≤ Budget, deterministisch bei gleichem Graph
- [ ] Weggelassene Knoten sind gezählt + über `graph_expand`-Handle erreichbar;
      Test greift den nächsten Ring tatsächlich ab
- [ ] Zu kleines Budget (< Wurzelknoten) → klarer Fehler, kein leeres Ergebnis
- [ ] Ausgabe bleibt Format-E (CR-GC-210), nicht JSON
- [ ] `npm run build` + Tests grün
