# CR-GC-787: graph_metrics reicht Betrachtungsumfang und Risikotraeger durch

**Status:** ✅ Done (2026-10-12, veröffentlicht mit graphcode 0.31.0, contracts 12.6.0)
**Typ:** aus Item ITEM-2026-830 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-830.json (Lane: code)

---

**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10 und Plan in Abschnitt 9. Sicht Anforderung
und Wirkkette. Voraussetzung für CR-GC-784, CR-GC-782 und CR-GC-785; setzt auf sigloch-modules CR-SM-407
(contracts 12.1.0, gebaut, nicht veröffentlicht).

## Anlass

contracts rechnet seit 12.1.0 zwei Ableitungen: `requirementScope(graph, seeds)` und `riskCarriers(graph)`. Kein
Werkzeug von graphcode reicht sie durch. Die drei Skills sollen sie lesen und dürfen sie nicht selbst rechnen.

## Umfang

`graph_metrics` bleibt das eine Werkzeug für Kennzahlen; kein neues Werkzeug.

| Teil | Wie | Warum so |
|---|---|---|
| Risikoträger | immer in der Antwort, als Block `riskCarriers` mit den zwei Listen aus contracts | klein: je Risiko eine Zeile; ohne Risiken zwei leere Listen |
| Betrachtungsumfang | nur auf Anfrage: Eingabe `scope: string[]` (Kennungen von Funktionen oder Ketten), Antwortblock `scope` | als festes Feld je Kette wären es am eigenen Modell rund 35 700 Zeichen je Aufruf (Review zu CR-SM-407) |

Dazu:

- Hilfetext in `src/projections/tool-help.ts`: was die zwei Blöcke bedeuten, dass ein Träger eine Blattfunktion
  ist, dass eine Gegenmaßnahme am System als quer geltend zählt und nicht in den Trägern steht.
- `tests/metrics.test.ts`: Durchreichen beider Blöcke an einem Modell auf Disk; unbekannte Kennung in `scope`
  ergibt eine benannte Ablehnung, kein leeres Ergebnis.
- Floor im selben Commit: `@sigloch/contracts` auf `>=12.1 <13` (der Floor folgt den Imports; die zwei Ableitungen
  gibt es seit 12.1.0). Gebaut und geprüft wird gegen die Arbeitskopie 12.2.0. Bis zum Publish
  ist das Repo im Link-Modus; `distribution` und `lockfile-sync` sind dann erwartet rot.
- Modell: der Fluss `FLOW-chain-metrics` und sein Schema tragen die zwei neuen Blöcke in der Beschreibung.
  Befund beim Anlegen dieses CR: das Werkzeug `graph_metrics` (`src/projections/metrics.ts`) hat keinen eigenen
  Knoten im Modell; gebunden sind nur `FUNC-chain-metrics` und `FUNC-module-metrics` in contracts. Der Knoten
  wird hier angelegt, mit Anforderung und Test für das Durchreichen.

Dateien: `src/projections/metrics.ts`, `src/projections/tool-help.ts`, `tests/metrics.test.ts`, `package.json`,
`package-lock.json`, Modell und Sichten.

## Nachzug zu sigloch-modules CR-SM-409 (im selben Zug, weil derselbe Stand von contracts)

contracts 12.2.0 lässt die Regel FC-05 (Kette hängt zusammen) die Marke PDR halten; der Regelkatalog steht auf
45.0.0. Am eigenen Modell meldet FC-05 nichts, keine Marke ändert sich. Nachzuziehen:

- die erzeugte Sicht `docs/views/regel-matrix.md` (`scripts/regel-matrix.mjs`);
- der Satz zu den Verdrahtungsregeln in `.claude/commands/se-fmea.md` und im Konzept, Abschnitt 7 („sind Warnungen,
  kein Fehler" bleibt richtig; neu: FC-05 hält PDR);
- prüfen, nicht ändern, solange sie grün sind: `tests/generate.stufen.test.ts`,
  `tests/steering.process-ratchet.test.ts`, `tests/help.test.ts`, `tests/bootstrap.test.ts`,
  `tests/readiness.completeness.test.ts` lesen die Rolle allgemein.

## Nicht im Umfang

Der Antwortweg (wartet auf CR-SM-408). Eine Anzeige im Dashboard.

## Abnahme

- Am eigenen Modell: `riskCarriers.risks` hat vier Zeilen, zwei davon mit genau einem Träger; `scope` für
  `FCHAIN-steering-loop` nennt 74 Anforderungen (Zahlen aus CR-SM-407, Stand graphVersion 686; weicht der Stand
  ab, steht die Abweichung mit Ursache im CR).
- `verify:code` grün, `verify:full CR-GC-787` gelaufen und der Schlupf vermerkt.
- Kongruenz: `rules_evaluate` meldet keinen neuen RC-Befund, oder die Ausnahme ist hier benannt.

## Danach

Release-Zug contracts 12.1.0 und graphcode (Peers zuerst, Trockenlauf beim Planen), dann Rollout.

## Ergebnis

Gebaut am 2026-10-11 gegen die Arbeitskopie contracts 12.2.0 (Link-Modus), CR bleibt offen bis zum Release-Zug.

**Werkzeug.** `graph_metrics` trägt `riskCarriers` in jeder Antwort und `scope` nur mit der Eingabe
`scope: string[]`. Beide Blöcke sind der unveränderte Rückgabewert von `riskCarriers(graph)` und
`requirementScope(graph, seeds)` aus contracts. Hilfetext ergänzt, Floor auf `>=12.1 <13`.

**Abnahme am eigenen Modell, über das Werkzeug am laufenden Host.**

| Größe | Soll | Ist |
|---|---|---|
| `riskCarriers.risks` | 4 Zeilen | 4 |
| davon mit genau einem Träger | 2 | 2 (`REQ-risk-gate-rule-eval-fails`, `REQ-risk-loop-oscillation`) |
| `scope` für `FCHAIN-steering-loop`, Anforderungen | 74 | 74 |

Gemessen bei graphVersion 688 (vor dem Modellzug) und 689 (danach), nicht 686; die Liste der 74
Anforderungen ist an beiden Ständen dieselbe. Die übrigen zwei Risiken: `REQ-risk-loop-degradation`
ohne Träger und ohne Erfüller, `REQ-risk-store-unreadable` mit 26 Trägern (Gegenmaßnahme an `MOD-kernel`).

**Tests.** `verify:code` fiel wegen `package.json` im Diff auf den Volllauf zurück. `verify:full CR-GC-787`:
182 Dateien, 1505 Tests, 1503 grün, rot 2, Schlupf 0. Rot sind `tests/distribution.test.ts` und
`tests/lockfile-sync.test.ts`, beide erwartet im Link-Modus (Lock nennt noch `>=12 <13`). Die fünf Tests
aus dem Nachzug zu CR-SM-409 sind grün und unverändert.

**Modell (graphVersion 689).** Neu: `FUNC-graph-metrics` (gebunden an `src/projections/metrics.ts`, Block
`FUNC-block-abfrage`, Modul `MOD-projections`, Kette `FCHAIN-dashboard-metrics`), `REQ-metrics-risk-scope`
(funktional, unter `UC-live-graph-view`, geprüft von `TEST-graph-metrics`), `FLOW-metrics-answer`. Geändert:
die Beschreibungen von `FLOW-chain-metrics`, `SCHEMA-chain-metrics`, `TEST-graph-metrics`. `CR-GC-787` zeigt
auf Funktion und Anforderung.

**Abweichungen vom Text oben.**

1. *Eigener Fluss.* Der CR sah nur die Beschreibung von `FLOW-chain-metrics` vor. Das Gate lässt je Fluss
   genau einen Erzeuger zu (IO-02), und den hat `FLOW-chain-metrics` in `FUNC-chain-metrics`. Das Werkzeug
   liest deshalb die drei Kennzahl-Flüsse und gibt `FLOW-metrics-answer` an den Agenten ab. Kein neues Schema:
   der Fluss hängt an `SCHEMA-chain-metrics`, dessen Beschreibung sagt, dass `riskCarriers` und `scope` eigene
   Verträge aus contracts haben und nicht zum Symbol `ChainMetrics` gehören.
2. *Ablehnung weiter gefasst.* Abgelehnt wird jede Kennung, die keine Funktion oder Kette des Modells ist,
   also auch eine vorhandene Kennung anderen Typs (etwa ein Modul), mit Namen und Typ. contracts lässt einen
   solchen Seed still fallen; der Umfang nennte dann nur die Systemanforderungen und sähe aus wie eine Antwort.
3. *Skill unter `.opencode/`* gibt es in diesem Repo nicht; geändert ist nur `.claude/commands/se-fmea.md`.
4. *Abnahme mit `scope` über einen eigenen MCP-Client.* Die laufende Claude-Code-Sitzung hält das
   Eingabeschema des Werkzeugs vom Sitzungsstart und kann kein Feld `scope` senden. Der Aufruf lief über einen
   stdio-Client am selben Host (Proxy auf `host.sock`); `riskCarriers` kam zusätzlich direkt über die Sitzung.

**Benannte Ausnahme, Kongruenz.** `rules_evaluate` meldet einen neuen RC-Befund: RC-04 an
`SCHEMA-function-criticality` (RC-04 gesamt 17 auf 18). Ursache: das Werkzeug ist jetzt als Abnehmer von
`FLOW-function-criticality` modelliert, und `metrics.ts` ruft `FunctionCriticality.parse()` nicht selbst auf;
den Vertrag prüft der Erzeuger in contracts. Dieselbe Lage besteht schon für `SCHEMA-chain-metrics` und
`SCHEMA-module-metrics`. Offen gelassen, weil ein zweites Parsen im Durchreicher nichts prüft, was der
Erzeuger nicht schon geprüft hat. Sonst kein neuer Befund; vier bestehende Befunde tragen höhere Zahlen
(RD-04 an `FUNC-block-abfrage` 11 auf 12 und an `MOD-projections` auf 15, BW-02 an `FUNC-block-abfrage` 9 auf
12 und an `FUNC-block-messwerk` auf 11). `importCoverage` unverändert: 88 von 89 Endpunkten zugeordnet, offen `src/index.ts`.
