# CR-GC-787: graph_metrics reicht Betrachtungsumfang und Risikotraeger durch

**Status:** 🟠 Open
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
