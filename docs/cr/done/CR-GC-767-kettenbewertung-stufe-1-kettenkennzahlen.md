# CR-GC-767: Kettenbewertung Stufe 1: Kettenkennzahlen und Bewertbarkeitsquote als Messwerk in graph_metrics

**Status:** ✅ Done (2026-10-09)
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

- [x] Je FCHAIN die fünf heute rechenbaren Kennzahlen: Gesamtlänge, Verzweigungsgrad, Modulgrenzen, Rückkopplungen,
      geteilte Knoten (dazu Engstellen als obere Schranke).
- [x] Eine nicht bewertbare Kette liefert **keine Zahl, sondern den Grund**: FC-05, loses Glied, kein Eingang, kein
      Ausgang.
- [x] Die **Bewertbarkeitsquote** (bewertbare Ketten / alle Ketten) steht neben den Werten — wie die Bindungsquote
      bei RC-*.
- [x] Synchrone Tiefe und Fehlerpfad-Tiefe stehen als `null` mit dem Grund „braucht FLOW-Attribut" (CR-SM-364).
- [x] Der Spike rechnet nicht mehr selbst, er ruft dieselbe Funktion (kein paralleler Pfad).

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

- [x] Referenzkette „Zahlung auslösen": Länge 6, Verzweigung 1, 2 Modulgrenzen, 0 Rückkopplungen, 1 geteilter Knoten.
- [x] Gegenprobe (Schleife und Ast): Rückkopplungen und Verzweigung schlagen um.
- [x] Eine Kette ohne Eingang ist nicht bewertbar und nennt den Grund; die Quote zählt sie im Nenner.
- [x] `graph_metrics` auf graphcode selbst zeigt 21 Ketten mit Quote; der Wert stimmt mit dem Spike überein.
- [x] `npm run build`, die ausgewählten Tests und `verify:full CR-GC-767` grün; RC-* kongruent oder benannt.

## Ergebnis (2026-10-09)

`graph_metrics` traegt die Bloecke `chains` und `measurability` aus `chainMetrics` (`@sigloch/contracts` 11.1.0,
CR-SM-404). Auf graphcodes eigenem Modell (Graph v649): **24 Ketten, 22 bewertbar (92 %)** — am laufenden Werkzeug
und im Spike gleich. Die Zahl „21 Ketten / 4 bewertbar" oben ist der Stand vor CR-GC-768.

- Zielbild: alle fuenf Punkte erfuellt. Der Spike rechnet nicht mehr selbst; alt gegen neu ueber den Korpus verglichen:
  0 Abweichungen an 79 Ketten (Kennzahlen, Bewertbarkeit, Diagnose).
- Familie-Korpus (10 Graphen): 49 von 79 Ketten bewertbar (62 %). T-O1 steht in `docs/messung/stand.md` als
  „nicht bestanden" (Kriterium >= 90 %).
- Rot gesehen: die vier Tests am Werkzeug und der Eigenmodell-Test fielen vor dem Einbau am fehlenden Block.
- `verify:full CR-GC-767`: 199 von 201 Dateien gruen, Schlupf 0. Rot sind `lockfile-sync` und `distribution`, beide
  am Peer-Floor `>=11.1`: contracts 11.1.0 ist nicht veroeffentlicht, das Lock traegt noch `>=11` (Link-Modus).
- Modell: `FUNC-chain-metrics`, `FLOW-chain-metrics`, `SCHEMA-chain-metrics`, `REQ-chain-metrics`; RC-* ohne neuen
  Befund am Gate.

**Abweichungen vom Auftrag oben**

- Feldnamen englisch (`measurability` statt `bewertbarkeit`), Entscheidung D aus CR-SM-404.
- Kein eigener TEST-Knoten: R-29 laesst eine Testdatei nur an EINER Abnahme zu. `TEST-graph-metrics` verifiziert
  jetzt zusaetzlich `REQ-chain-metrics` und `SCHEMA-chain-metrics`. Die CR-Kante auf einen TEST ist nach R-18 illegal.
- `tool-contract.ts` und `help-content.ts` unberuehrt: der Ergebnisvertrag von `graph_metrics` steht in `metrics.ts`,
  sein Hilfetext in `tool-help.ts`. Die Werkzeugbeschreibung nennt den Block nur mit vier Woertern — das
  `tools/list`-Budget (28 300 Zeichen, Ratsche) liess 30 Zeichen.
- `scripts/model-test-set.mjs` dazu: `tests/metrics.test.ts` liest jetzt die SSOT und gehoert in die Modell-Spur.
- T-O1 steht in `messung.mjs` unter `WEITERE`, nicht in `S1`: die S1-Zeile der Leitlinie §9.4 nennt T-O1 nicht, und
  `tests/messung.test.ts` haelt `S1` wortgleich mit ihr.

**Offen:** Veroeffentlichung von contracts 11.1.0, danach `npm install` fuer das Lock; T-O1 in die S1-Zeile der
Leitlinie aufnehmen (dann entfaellt `WEITERE`); `syncDepth` und `errorPathDepth` bleiben `null`.

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
