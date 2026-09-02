# CR-GC-456 — FLOW: der eine Merge, den die Messung trägt

**Status:** done
**Abgeschlossen:** 2026-09-02
**Angelegt:** 2026-09-02

## Root Cause — und die Korrektur an CR-GC-455's Begleitanalyse

Die Ausgangsvermutung war: 39 FLOWs enthalten ~19 Payload-Aliase, thematisch bündelbar auf ~20.
**Die Topologie widerlegt das.** Aggregiert man jede io-Kante auf den Wurzel-FUNC ihres
Kompositionsbaums und vergleicht die Kanäle (Produzentenmenge → Konsumentenmenge):

- **35 distinkte Kanäle bei 39 FLOWs.** Nur zwei Kanäle tragen mehr als einen FLOW:
  `Messwerk → Autopilot` (4) und `Antrieb → Antrieb` (2).
- Kein einziges FLOW-Paar hat eine identische Signatur aus Produzent, Konsument **und** Vertrag.

Thematisch ähnliche Namen sind keine Redundanz. Die Flows verbinden verschiedene Funktionen.

`graph_suggest` (Ziel: coherence 1,0 · flowEfficiency 0,8 · modifiability 0,5) findet drei
`OP-MERGE`-Kandidaten und bewertet **zwei davon negativ**:

| Merge | score | Urteil |
|---|---:|---|
| `impact-subgraph` → `formatE-artifact` | **+0,0042** | trägt |
| `markdown-docs` → `skill-report` | −0,024 | verschlechtert |
| `skill-request` → `query-request` | −0,085 | verschlechtert deutlich |

Der letzte ist genau der Bündel-Merge, der oben vorgeschlagen war (vier FLOWs auf `QueryParams`).
Er ist der schlechteste Zug im Feld: er baut aus zwei mittleren Flows einen Hub, und Hubs sind das
Problem, nicht die Anzahl der Knoten.

## Umfang — genau ein Merge

`FLOW-impact-subgraph` geht in `FLOW-formatE-artifact` auf. Begründung über den Score hinaus: ein
Impact-Subgraph **ist** ein Format-E-Artefakt — `graph_impact`/`graph_expand` liefern seit
CR-GC-210 ausschließlich Format-E-Slices. Zwei Knoten für dieselbe Sache.

Δ modifiability +0,0053 · coherence +0,0031; viability/scalability −0,0001/−0,0011 (Rauschen).
Gate-Urteil `suggest` — die einzige Violation (CR-01, MOD-kernel ↔ MOD-surface, 7 kreuzende
Verträge) bestand vorher und ist nicht gating.

## Was NICHT gemacht wird, und warum

Die restlichen 34 Kanäle bleiben. Die Flow-Anzahl folgt dem **Blockschnitt**, nicht der
Namensähnlichkeit: liegen zwei Wurzel-FUNCs in einem Block, wird ihr Kanal intern und verschwindet.
Deshalb ist der Blockschnitt (10 Wurzel-FUNCs gegen die eigene `se:top-level`-Regel „max 5") die
Ursache und die Flow-Zahl die Wirkung — nicht umgekehrt. Diese Reihenfolge kehrt die ursprüngliche
Planung um; sie steht als offene Entscheidung, nicht als CR.

## Acceptance

- [x] 38 FLOW, `SCHEMA-format-e` von genau einem FLOW getragen (R-18: 1..1)
- [x] `rules_evaluate` blockingErrors unverändert (1)
- [x] Suite ohne neue Rote gegenüber der HEAD-Baseline (10 Dateien / 16 Tests)
