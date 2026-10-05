# CR-GC-745: Nachzug graphcode-client 1.6.1 — der Zustand des Gates auf beiden Achsen und am Werkzeug

**Status:** ✅ Done (2026-10-05)
**Typ:** aus Item ITEM-2026-757 (finding)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-757.json (Lane: code)
**Deckt:** sigloch-modules CR-SM-394 (Commit 6dff232, unveröffentlicht) — `ReadinessGate.state`
`'passed' | 'open' | 'not-reached'`, `GATE_STATE_LABELS`, `unposedLegs`.
**Schnitt:** Teil 1 von 2. Dieser CR trägt Messung und Werkzeug-Ausgabe; die Hilfetexte, der öffentliche
Export und der Rig-Beleg stehen in CR-GC-746 (zusammen über der 10er-Grenze). Kein roter Zwischenstand: Teil 2 liest nur, was
Teil 1 liefert. Dieser Teil: 3 Quell- und 6 Testdateien, dazu diese CR und die Messzeile.

---

## Befund

Gegen die Arbeitskopie `@sigloch/graphcode-client` 1.6.1 (Link-Modus):

- **Achse 1 — `phaseGates` (Vollständigkeit):** kommt fertig aus dem Client. Ein Entwurf liest an TRR
  `passed: false, state: 'not-reached'`. Hier war nichts zu rechnen, nur der Anzeigetext fehlte am Ergebnis.
- **Achse 2 — `phase_readiness` (Regelabdeckung, CR-GC-296):** gemessen an einem Entwurf ohne Befund
  (SYS, TEST, FUNC, keine Bindung, kein Bauplan-Stempel):
  `{"gate":"TRR","total":8,"covered":8,"missing":[]}`, `currentPhaseGate(...) === null`.
  Von den 11 TRR-Regeln sind R-19, R-20, R-26 nicht gestellt; die übrigen 8 schweigen. Die Zeile liest
  „TRR voll gedeckt", `null` heißt laut Feldkommentar „alle vier durch". Das ist derselbe Fehler, den
  CR-SM-394 an Achse 1 behoben hat — die Achse führt in die Irre, also wird sie nachgezogen.
- `currentPhaseGate` hat seit CR-GC-593 keinen Rufer in `src/` mehr (Freigabe folgt allein dem Fokus);
  es entscheidet nichts. `phase_readiness` selbst reist aber in `graph_readiness` und in jedem
  `GenerationStep` zum Agenten und wird dort gelesen.

## Umsetzung

- `src/kernel/measure/readiness.ts`
  - Re-Export-Shim: `GATE_STATES`, `GATE_STATE_LABELS`, `unposedLegs`, `type GateState` — durchgereicht,
    keine lokale Definition.
  - `PhaseGateReadiness` (Zod) trägt `state` im Vokabular des Clients (`z.enum(GATE_STATES)`):
    `open` = `missing` nicht leer · `not-reached` = nichts offen, aber `unposedLegs(gate, graph)` nicht
    leer · `passed` sonst. Die Bedingung „nicht gestellt" wird aus `unposedLegs` GELESEN — dieselbe
    Funktion, aus der der Client `phaseGates[].state` bildet. Kein zweiter Katalog, kein Nachbau.
  - `computePhaseReadiness(violations, graph)` nimmt den Graphen in der Form des Stores
    (`CGraph`) statt `OntologyGraph`: das ist die Form, die `unposedLegs` liest. Die Wandlung für
    `ruleApplies` macht die Funktion selbst (`toOntologyGraph`, derselbe Mapper wie zuvor bei den Rufern).
  - `currentPhaseGate`: erstes Gate mit `state !== 'passed'` statt `covered < total`. Im Entwurf ohne
    Befund ist das TRR, nicht `null`.
- Rufer: `src/kernel/measure/steering-snapshot.ts` (reicht `graph`), `src/projections/report.ts`
  (reicht `harness.getGraph()`; der `toOntologyGraph`-Import entfällt dort).
- `src/projections/report.ts`, `graph_readiness`: jedes Gate in `phaseGates` und `implGates` trägt neben
  `state` das Feld `stateLabel` — der Anzeigetext aus `GATE_STATE_LABELS`, gelesen, nicht formuliert.
  Grund: der Agent gibt dem Nutzer wieder, was am Ergebnis steht; `not-reached` ist nicht sein Wort.

### Was unterscheidet die Achsen weiterhin

`open` heißt an Achse 1 „ein error, eine nicht aktuelle Creation oder ein unvollständiges Bein", an
Achse 2 „eine gestellte Regel mit offenem Befund, jede Schwere" (CR-GC-296, bewusst strenger). Ein Gate
kann deshalb an Achse 1 `passed` und an Achse 2 `open` lesen. `not-reached` bedeutet an beiden dasselbe
und kommt aus derselben Funktion.

## Tests

| Datei | Fall |
|---|---|
| `readiness.model` | **neu**, vier Fälle: Entwurf ohne Befund → TRR `not-reached` bei `covered === total`, `currentPhaseGate` = TRR · Befund hat Vorrang (`open`) · mit Bindung `passed` bzw. `open` · `open ⇔ missing` an jedem Gate. Fixtures in Store-Form. |
| `readiness.completeness` | Entwurf TRR 0/0 prüft `state: 'not-reached'`, `passed: false`, `blocking: []`; SRR/PDR/CDR nicht `not-reached`; Positivkontrolle mit Stempel und zwei Befunden `open`. |
| `mcp.readiness` | **neu**, zwei Fälle über das Werkzeug auf einem Kuzu-Store auf Platte: Entwurf → TRR `not-reached`, `passed: false`, `stateLabel` „nicht durchschritten", SRR `passed`, beide Achsen; mit einer `testRefs`-Bindung (durch `graph_mutate`) und einer FUNC ohne `realRef` → `open`, `blocking` nennt `FUNC.realRef`. |
| `steering.process-ratchet`, `steering-snapshot` | Fixture bzw. Aufruf in Store-Form (neue Signatur). |
| `generate` | die zwei `toEqual` auf eine `phaseReadiness`-Zeile tragen `state`; das aktuelle Gate (CDR) liest `open`. |

Rot zuerst: die Messung im Befund ist der Stand davor (`8/8`, `null`). Die zwei `mcp.readiness`-Fälle
gegen den Quelltext von `26ee706` gefahren: beide rot — allerdings schon am fehlenden Export
`GATE_STATE_LABELS`, nicht erst an der Zusicherung zur zweiten Achse.

## Geprüft, nichts geändert

- `src/kernel/evaluation.ts`, Feldliste `catalogs.gate.fields`: nennt Blöcke (`phaseGates`, `implGates`,
  `phase_readiness`), nicht deren Felder; `state` reist in den Blöcken mit.
- `src/projections/panels.ts`: Re-Export von `type GatePanel` — der Typ trägt `state` seit 1.6.1.
- `src/loop/generate.ts`: reicht `phaseReadiness` durch, liest es nicht.
- Modell: `SCHEMA-phase-readiness` beschreibt den Vertrag; das neue Feld `state` ist dort nicht
  nachgetragen (laufender Host tabu) — beim nächsten Modell-Zug nachziehen.

## Umfang laut `graph_impact`

Nicht gelaufen: der laufende Host war für diesen Nachzug tabu. Umfang aus `grep` über
`computePhaseReadiness|currentPhaseGate|phaseReadiness|phaseGates` (3 Quelldateien, 6 Testdateien).

## Verifikation

- `npm run build` / `type-check` grün gegen die verlinkte Arbeitskopie (graphcode-client 1.6.1, Stand 6dff232).
- `npm run verify:code`: 31 Dateien, 315 Tests grün.
- `npm run verify:full CR-GC-745`, zwei Läufe (beide Zeilen stehen in `docs/messung/testauswahl.jsonl`):
  1. 202 Dateien, 3 rot. **Schlupf: `tests/generate.test.ts`** — zwei `toEqual` auf die ganze
     `phaseReadiness`-Zeile, die das neue Feld nicht kannten. Die Datei lag nicht in der Auswahl von
     `verify:code` (31/202), obwohl `generate.ts` den geänderten Snapshot liest: die Auswahl folgt dem
     direkten Import und den `testRefs`, nicht dem transitiven Import. Erwartung nachgezogen (s. Tests).
  2. 202 Dateien, 1778 Tests grün, 2 rot — `tests/lockfile-sync.test.ts` und `tests/distribution.test.ts`,
     beide im Link-Modus erwartet (contracts 10.15 / client 1.6.1 stehen nicht in der Registry). Spur CODE,
     Auswahl 32/202; die Spur zählt die zwei erwarteten als Schlupf, weil sie außerhalb der Auswahl liegen.
  Folge ohne Schlupf: 0/10.
- CR von Hand angelegt, nicht über `aise dispatch prepare`: prepare hätte über den laufenden Host einen
  CR-Knoten geschrieben. `crRefs` im Item und der CR-Knoten im Modell fehlen — nachzuziehen.
