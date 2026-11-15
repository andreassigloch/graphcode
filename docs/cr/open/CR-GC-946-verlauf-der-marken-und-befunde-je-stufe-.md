# CR-GC-946: Verlauf der Marken und Befunde je Stufe beim Host rechnen: graph_readiness liefert ihn, der Import aus dem Viewer entfaellt

**Typ:** aus Item ITEM-2026-1374 (idea)
**Erstellt:** 2026-11-15
**Item:** bok/items/ITEM-2026-1374.json (Lane: code)

---

**Status:** Freigegeben 2026-11-15; nicht umgesetzt.

## Anlass

Die Frage „Kommt die Arbeit am Modell voran?" beantwortet heute keine Anzeige. Der Verlauf über die
committeten Stände von `docs/graph/*.graph.json` wird an drei Stellen gerechnet:

| Stelle | Rechnet |
|---|---|
| graph-view-edit, `measureGraphHistory` (`vite.config.js`) | Elemente, Befunde gesamt, Fehler, Warnungen, sechs Architekturwerte |
| graphcode, `scripts/retro-kpi.mjs --verlauf` | importiert die Funktion aus dem Viewer (CR-GC-914) |
| graphcode, `scripts/spike-nachweis-history.mjs` | Verstöße je Element (T-M3) |

Keine der drei nennt Marken oder Befunde je Stufe. „Verstöße je Element" und die Summe „offen" sind verzerrt:
540 von 1417 Elementen sind CR-Knoten, und jeder CR erzeugt einen Hinweis MS-03.

Probe vom 2026-11-15, ein Stand je Woche, heutige Regeln, ohne Code-Abgleich:

| Stand | Marken erreicht | Befunde ohne Stufe Plan | Befunde Stufe Plan |
|---|---|---|---|
| 2026-07-26 | keine | 364 | 38 |
| 2026-09-27 | SRR | 228 | 166 |
| 2026-10-25 | SRR, PDR, CDR | 129 | 323 |
| 2026-10-29 | SRR, PDR, CDR | 119 | 356 |
| 2026-11-15 | SRR, PDR, CDR | 118 | 410 |

Seit 2026-10-29 steht das Modell (119 → 118), die Summe steigt trotzdem von 475 auf 528.

## Zielbild

- graphcode rechnet den Verlauf, an einer Stelle. Je committetem Stand: Datum, Commit, erreichte Marken,
  Befunde je Stufe (Plan als eigene Stufe), Fehler, Steuerwert mit Überschreitungen je Steuerregel,
  Testergebnisse (bestanden, rot, nie gelaufen), Zahl der bewertbaren Ketten.
- Je Stand rechnen dieselben Funktionen wie für den Live-Stand (`computeMarks`, `countByStage`, der
  Steuerwert, der Testbericht, `chainMetrics`). Der CR legt keine neue Rechnung an.
- Der Verlauf rechnet ohne die Regeln des Code-Abgleichs (RC): zu einem alten Stand fehlen die Code-Fakten.
  Die Antwort nennt das als Feld.
- `graph_readiness` nimmt `verlauf` (Zahl der jüngsten Stände) und liefert die Reihe. Ohne den Parameter
  bleibt die Antwort, wie sie ist.
- Ein Zwischenspeicher auf Platte unter `.graphcode/` hält das Ergebnis je Stand. Schlüssel: Commit,
  Regelversion, Herkunft der Policy. Alle 564 Stände kosten kalt 50 s.

## Vorgehen

1. Rechnung als reine Funktion über (Git-Lesefunktion, Policy, Zwischenspeicher); Test an einem Wegwerf-Repo.
2. `graph_readiness`: Parameter `verlauf`, Feld `verlauf`. Das Budget der Werkzeugliste
   (`tests/mcp.agent-agnostic.test.ts`) bleibt eingehalten.
3. `scripts/retro-kpi.mjs --verlauf` liest die neue Rechnung. Der Import aus `@sigloch/graph-view-edit` entfällt.
4. `scripts/spike-nachweis-history.mjs` löschen, samt Verweisen (`scripts/messung.mjs`, Skill `se-retro`).
5. Modell: Knoten und Bindung der neuen Funktion, Test mit `testRefs`.

## Abnahme

- [ ] Drei Stände in einem Wegwerf-Repo: je Stand Marken und Befunde je Stufe; der jüngste Stand gleicht der
      Antwort von `graph_readiness` ohne RC (Test, vorher rot).
- [ ] Der zweite Aufruf misst keinen Stand neu; eine andere Policy misst neu (Test).
- [ ] Ein unlesbarer Stand zählt unter `skipped`, der Lauf bricht nicht ab (Test).
- [ ] `scripts/` importiert nichts mehr aus `@sigloch/graph-view-edit` (Test).
- [ ] Am eigenen Repo: `graph_readiness({verlauf: 24})` antwortet, der jüngste Stand trägt SRR, PDR, CDR.
- [ ] `npm run verify:full CR-GC-946` grün.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|
| Wer rechnet den Verlauf? | Der Host (graphcode). Der Viewer zeigt ihn. Das löst die Festlegung aus CR-GVE-402 und CR-GC-914 ab, nach der die Messung im Viewer lag. | FAQ `viewer-rechnet-nicht-nach`. graphcode hing für seinen einzigen Verlauf am Viewer. |
| Wie lautet T-M3? | Fehler bleiben 0; eine erreichte Marke fällt nicht zurück; die Befunde je Stufe ohne Plan fallen oder sind abgenommen (Autor, 2026-11-15). | „Verstöße je Element" fällt durch CR-Knoten, ohne dass am Modell gearbeitet wird. Die Leitlinie ändert der Autor; der Diff steht in CR-GC-948. |

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1199, Tiefe 1, Wurzeln: `FUNC-graph-readiness`._

Reichweite: 12 Elemente (FLOW 10, FUNC 2); Blackbox-Rand 11, nicht geoeffnet.

Dateien (realRef, 2):
- src/projections/report.ts
- src/surface/host-shim.ts

Tests (`graph_tests`, 3):
- tests/harness.import-rejected-traces.test.ts
- tests/mutate.schema-guard.test.ts
- tests/target-profile.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
