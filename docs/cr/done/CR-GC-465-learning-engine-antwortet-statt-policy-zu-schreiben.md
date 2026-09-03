# CR-GC-465 — Die Learning-Engine antwortet, statt die Policy zu schreiben

**Status:** done (2026-09-03) · **Angelegt:** 2026-09-03 · **Herkunft:** Review Funktionsnetzwerk 2026-09-03 (Andockpunkt des Nachbarsystems)

## Problem

Im Modell schreibt `ACTOR-learning-engine` die **Urteils-Policy**
(`FLOW-metric-policy`). Dieser Vertrag ist aber die Repo-Konfiguration: „wie der
Mensch die Schwellen in `graphcode.config.jsonc` schreibt und wie sie nach dem
Auffuellen mit `DEFAULT_METRIC_POLICY` gelten". Die Learning-Engine steht damit
als zweiter Autor auf der Konfiguration des Menschen.

Folge — die Engine dockt genau dort an, wo ihr Wissen nicht hingehoert
(gemessen, `graphVersion` 231):

| Was die Engine tut | Gegenseite | Block |
|---|---|---|
| liest `FLOW-trajectory` | `materializeTrajectory()`, `createToolContext` | Grounding, Betrieb |
| schreibt `FLOW-metric-policy` | `evaluateRules()`, `takeSteeringSnapshot()` | Grounding |
| | `loadGraphcodeConfig` | Betrieb |

`FUNC-block-optimierung` hat **null** io mit der Learning-Engine. `graph_suggest`
zieht seine Richtung aus dem **Zielprofil**, `nextStep` aus demselben Snapshot —
das Gelernte erreicht beide bestenfalls indirekt ueber den Steering-Snapshot.
Die Wirkkette, die die Engine schliessen soll, ist im Modell nicht verdrahtet.

## Änderung

Die Schleife ist: **Log rein → Frage rein → Antwort raus.** Die Engine haengt am
Log und beantwortet eine Frage; sie schreibt keine Konfiguration.

**Entfaellt**
- `ACTOR-learning-engine -io-> FLOW-metric-policy`
- die Beschreibung des ACTOR, soweit sie das Zurueckschreiben der Urteils-Policy
  als Zweck fuehrt

**Bleibt**
- `FLOW-trajectory -io-> ACTOR-learning-engine` — der Log-Eingang, unveraendert

**Neu** (zwei Vertraege, beide `status:draft`, `external:true` wie
`SCHEMA-trajectory` — sie gehoeren dem Nachbarsystem)

| FLOW | Richtung | Inhalt |
|---|---|---|
| `FLOW-learning-query` | `FUNC-graph-suggest`, `FUNC-next-step` → Engine | die Lage (Metrikvektor + Zielrichtung) und die Kandidaten, die der Fragende bereits gebildet hat |
| `FLOW-learning-advice` | Engine → `FUNC-graph-suggest`, `FUNC-next-step` | je Kandidat: `score`, `confidence`, Evidenz-Pointer auf Log-Eintraege |

Beide Fragesteller nutzen **einen** Frage- und **einen** Antwort-Vertrag: es ist
dieselbe Frage an dasselbe Nachbarsystem, und zwei Vertraege mit gleicher Form
waeren ein paralleler Pfad.

Damit behaelt graphcode die **Kandidatenbildung**, die Engine liefert das
**Urteil**. Wie ein `score` in die vorhandene Rangfolge eingeht, ist Sache des
Konsumenten und wird nicht modelliert — es aendert den Vertrag nicht.

## Abgrenzung

- **Nichts davon ist implementiert.** Alle neuen Knoten sind `status:draft`, es
  entsteht kein `realRef` und kein REQ/TEST. Der CR verdrahtet das Konzept,
  damit das Bild die Absicht zeigt; die Realisierung ist ein eigener CR.
- **Vor der Implementierung ist der Antwort-Vertrag erneut zu entscheiden.**
  Offen ist ausdruecklich, ob die Antwort neben dem Score auch **inhaltliche
  Vorschlaege** traegt (ein Zug, den graphcode selbst nicht als Kandidat
  gebildet hat). Das ist keine Luecke im jetzigen Vertrag, sondern eine
  Erweiterung, die dann einen eigenen Vertrag oder ein weiteres Feld braucht —
  entschieden wird sie am realen Nachbarsystem, nicht hier.
- **`FLOW-metric-policy` bleibt unveraendert der Vertrag des Menschen.**
  `FUNC-load-config` steht dort weiterhin auf BEIDEN Seiten (roh gelesen,
  aufgefuellt geliefert) — das ist kein Selbstbezug-Fehler, sondern die im
  Vertrag selbst dokumentierte „gleiche Form in zwei Fassungen".
- **Kein Auto-Apply.** Die Antwort ist Advisory wie `graph_suggest` selbst; sie
  fuehrt zu keiner Mutation ohne Gate.
- **Keine Contracts-Aenderung.** Es entsteht kein neuer ElementType, TraceType
  oder TRACE_PATTERN — nur Instanzen bestehender Muster
  (`FUNC-io->FLOW`, `FLOW-io->ACTOR`, `ACTOR-io->FLOW`, `FLOW-io->FUNC`,
  `FLOW-relation->SCHEMA`). Kein Familie-Review noetig.

## Akzeptanzkriterien

- [x] `graph_impact(ACTOR-learning-engine)` zeigt genau drei Vertraege:
      `FLOW-trajectory` (rein), `FLOW-learning-query` (rein),
      `FLOW-learning-advice` (raus).
- [x] Kein `io` mehr zwischen `ACTOR-learning-engine` und `FLOW-metric-policy`;
      `FLOW-metric-policy` behaelt `ACTOR-owner` und `FUNC-load-config`.
- [x] `FUNC-graph-suggest` und `FUNC-next-step` haengen beide an Frage UND
      Antwort — im Funktionsnetzwerk dockt die Engine am Block Optimierung an
      (heute: null io mit diesem Block).
- [x] Beide neuen FLOW tragen ein SCHEMA (Vollstaendigkeit: heute 40 von 40).
- [x] `rules_evaluate` bringt keine neuen Error-Violations; Warnungen aus
      `status:draft` sind erwartet und benannt.
- [x] Alle Mutationen ueber `graph_mutate` (Tool-Layer, Gate + Audit-Provenienz);
      danach `scripts/export-graph.mjs` + Views.

## Dateien

1. `docs/cr/open/CR-GC-465-…md` — dieser CR
2. `docs/graph/graphcode.graph.json` — Export nach der Gate-Mutation
3. `docs/views/*` — Re-Render der betroffenen Sichten

## Abhängigkeiten

Keine. Die Realisierung (Aufruf-Pfad, Verrechnung des Score, Vertrag in
`@sigloch/learning-core`) ist ein Folge-CR.
