# CR-GC-767: Kettenbewertung Stufe 1: Kettenkennzahlen und Bewertbarkeitsquote als Messwerk in graph_metrics

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-794 (idea)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-794.json (Lane: code)

---

## Befund

Die Leitlinie §5 verlangt, dass die Realisierungsarchitektur **auf der Wirkkette** bewertet wird (T-O1, T-O2).
Heute gibt es dafür nur den Spike `scripts/spike-kettenkennzahlen.mjs`: fünf der acht Kennzahlen sind rechenbar,
31 von 76 Ketten des Familie-Korpus sind messbar (2026-10-09; graphcode selbst 4 von 21). Kein Werkzeug liefert die
Zahlen, kein Test hält sie, und die Kettenrechnung des Spikes steht neben der Modulrechnung statt bei ihr.

## Zielbild Stufe 1

`graph_metrics` beantwortet neben „welches Modul koppelt" auch **„wie läuft jede Wirkkette, und ist sie überhaupt
bewertbar"** — deterministisch, mit der Reichweite daneben.

- [ ] Je FCHAIN die fünf heute rechenbaren Kennzahlen: Gesamtlänge, Verzweigungsgrad, Modulgrenzen, Rückkopplungen,
      geteilte Knoten (dazu Engstellen als obere Schranke).
- [ ] Eine nicht bewertbare Kette liefert **keine Zahl, sondern den Grund**: FC-05, loses Glied, kein Eingang, kein
      Ausgang.
- [ ] Die **Bewertbarkeitsquote** (bewertbare Ketten / alle Ketten) steht neben den Werten — wie die Bindungsquote
      bei RC-*.
- [ ] Synchrone Tiefe und Fehlerpfad-Tiefe stehen als `null` mit dem Grund „braucht FLOW-Attribut" (CR-SM-364).
- [ ] Der Spike rechnet nicht mehr selbst, er ruft dieselbe Funktion (kein paralleler Pfad).

**Nicht in dieser Stufe:** Profil und Schwellen als NFR-REQ, Diagnose und Handlungsklassen (T-O2), Degradationsschutz
(T-O3), sync/async am FLOW (CR-SM-364), Reduktion von ℝ⁶, Umstellung von `graph_suggest`.

## Offene Entscheidung vor dem Start: wo lebt die Rechnung?

`moduleMetrics` und `fc05ChainConnected` leben in `@sigloch/contracts/se` (`metric-rules.ts`); graphcode zeigt sie nur
an (`FUNC-module-metrics` ist `external`). Die Kettenrechnung gehört nach derselben Logik dorthin:

| Weg | Was | Folge |
|---|---|---|
| **A — contracts (empfohlen)** | `chainMetrics(graph)` neben `moduleMetrics`, eigene CR-SM, Version-Bump | Familie-Review; graphcode zieht nach (Peer-Floor, Link-Modus bis zum Publish); eine Rechnung für Regel FC-05, Messwerk und spätere Profilregel |
| B — graphcode-Kernel | `src/kernel/measure/chain-metrics.ts` | sofort baubar, aber zweite Heimat neben `metric-rules.ts`; die spätere Profilregel in contracts bräuchte die Rechnung noch einmal |

## Umfang (Weg A)

sigloch-modules (eigene CR-SM, über den Hüter des Regelkatalogs):
- `packages/contracts/src/se/metric-rules.ts` — `chainMetrics`, `ChainMetrics` (Zod), Bewertbarkeit
- Test mit der Referenzkette und der Gegenprobe; Version-Bump

graphcode (diese CR):
- `src/projections/metrics.ts` — Block `chains` und `bewertbarkeit` im Ergebnis von `graph_metrics`
- `src/kernel/tool-contract.ts`, `src/projections/help-content.ts` — Vertrag und Hilfetext
- `tests/metrics.test.ts` — der Block am echten Werkzeug
- `scripts/spike-kettenkennzahlen.mjs` — ruft die contracts-Funktion
- `scripts/messung.mjs` — T-O1 als Zeile im Messstand
- `package.json` — Peer-Floor
- Modell: FUNC, REQ, TEST über `graph_mutate`; Kanten des CR-Knotens

## Akzeptanzkriterien

- [ ] Referenzkette „Zahlung auslösen": Länge 6, Verzweigung 1, 2 Modulgrenzen, 0 Rückkopplungen, 1 geteilter Knoten.
- [ ] Gegenprobe (Schleife und Ast): Rückkopplungen und Verzweigung schlagen um.
- [ ] Eine Kette ohne Eingang ist nicht bewertbar und nennt den Grund; die Quote zählt sie im Nenner.
- [ ] `graph_metrics` auf graphcode selbst zeigt 21 Ketten mit Quote; der Wert stimmt mit dem Spike überein.
- [ ] `npm run build`, die ausgewählten Tests und `verify:full CR-GC-767` grün; RC-* kongruent oder benannt.

## Arbeitsweise

Gebaut wird in einem eigenen Worktree (`~/.aise-lanes/graphcode-ITEM-2026-794`): im Hauptbaum messen seit
2026-10-08/09 zwei Rig-Läufe (graphanalyze, Aufgabe energymanager) die gebaute Arbeitskopie; ein Build dort würde den
gemessenen Stand mitten im Lauf ändern.

---

## Umfang laut `graph_impact`

`graph_impact(FUNC-module-metrics)` (2026-10-09, Graph v644): die Modulrechnung hängt an `FUNC-block-messwerk`
(compose), liest `FLOW-graph-state` und liegt auf `FCHAIN-skill-report`; Rand: `UC-deterministic-steering`,
`FUNC-block-grounding`, `FUNC-graph-store`. Die Kettenrechnung kommt als Geschwister unter `FUNC-block-messwerk`
dazu; an Bestehendem ändert sich nur das Ergebnis von `graph_metrics` (TEST-graph-metrics, `tests/metrics.test.ts`).
