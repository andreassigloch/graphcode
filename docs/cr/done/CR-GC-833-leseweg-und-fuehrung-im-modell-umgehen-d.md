# CR-GC-833: Leseweg und Führung im Modell über die MCP-Werkzeuge

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-1012 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1012.json (Lane: graph)

---

## Befund

Modell-Audit gegen den Code, 2026-10-22, Gruppen B, C und E. Entscheidungen des Autors wie in CR-GC-832: Flüsse über das Werkzeug, je Auslöser eine Kette.

- **Leseweg:** Der Agent ruft graph_impact, graph_expand und graph_elements (`src/surface/read.ts`). Das Modell führte ihn direkt an `harness.impact`, `subgraph` und `listElements`, und listElements antwortete direkt dem Agenten.
- **graph_generate** hatte keine FUNC. `bindSuggestTools` stand als realRef von FUNC-graph-suggest und deckte zwei Werkzeuge ab. Daraus entstand der falsche Fluss Zielprofil → graph_suggest; `graph_suggest` liest das Profil nicht (`suggest.ts:215`).
- **Learning-Engine:** Sie ist geplant (CR-GC-465), aber nicht gebaut. FLOW-learning-query und FLOW-learning-advice waren der einzige Weg in graph_suggest. Daher kamen die zwei Auslöser in advisory-roundtrip und steering-loop.
- **Messung:**
  - `takeSteeringSnapshot` ruft computeReadiness nicht.
  - generationStep, graph_mutate und graph_readiness geben ihm Graph und Politik als Argument.
  - computeSteeringDelta bekommt die zwei Snapshots von graph_mutate.
- **Readiness:**
  - Der realRef von FUNC-compute-readiness zeigte auf eine nicht vorhandene Datei.
  - `readinessOf` bekommt die Befunde von graph_readiness, nicht den Graphen.

## Änderung (Modell)

- **Leseweg:**
  - Agent → read-tools → FLOW-read-request → impact, subgraph, listElements → read-tools → Agent.
  - graph-state → graph-impact und graph-expand.
  - FUNC-view-fmea von agent-query nach doc-export verschoben.
- **graph_suggest:**
  - Agent → graph_suggest (query-request-agent).
  - graph_suggest → Agent (FLOW-suggest-answer, SCHEMA-suggest-answer).
  - realRef `graph_suggest`.
  - Zielprofil-Fluss und Glied target-profile-load aus advisory-roundtrip entfernt.
  - rules-tool und zug-bericht sind Glieder.
- **Learning-Engine:** FLOW-learning-query, FLOW-learning-advice und die zwei SCHEMAs gelöscht.
- **graph_generate:**
  - neue FUNC-graph-generate-tool.
  - Agent → Werkzeug → generationStep → Werkzeug → Agent bzw. Dashboard (FLOW-generate-answer).
  - Das Zielprofil geht an das Werkzeug.
  - Die Kanäle handoff, next-step und skill-reference kommen vom Werkzeug.
- **Snapshot:**
  - Je Aufrufer eine Messanfrage (generationStep, graph_mutate, graph_readiness).
  - graph-state → snapshot und dimension-readiness → snapshot gelöscht.
  - Snapshot-Paar graph_mutate → computeSteeringDelta.
- **Readiness:**
  - realRef `src/kernel/evaluation.ts#readinessOf`.
  - Regel- und Konformanzbefunde → graph_readiness → readinessOf → Vollständigkeit.
- **steering-loop:** load-config (Start) und der Skill target-profile sind keine Glieder mehr; graph_generate und decode sind Glieder. Der Skill steht in skill-authoring.

## Messung

v821 → v822, 0 neue Fehler. Neue Warnungen:
- R-26 und R-32 an SCHEMA-suggest-answer: Code-Befund, siehe unten.
- R-30 an FUNC-load-config: Startglied, bis die Host-Start-Kette steht (Folge-CR).

## Code-Befunde (nicht in diesem CR)

- **graph_suggest:**
  - Die Antwort hat kein Zod-Schema.
  - Die Probeläufe werden nicht auditiert, weil `recordPreview` fehlt (`suggest.ts:240`).
  - REQ-target-shifts-ranking verlangt, was der Code seit CR-GC-483 nicht mehr tut.
- **graph_generate:** Die Beschreibung sagt „Read-only“. Das Werkzeug schreibt aber Intent-Anker nach `target-profile.json` (`suggest.ts:382`).
- **graph_elements** setzt Knoten vom Kuzu-Store und Kanten aus der Arbeitskopie zusammen (`read.ts:398/406`). graph_impact und graph_expand lesen ebenfalls Kuzu (`harness.ts:261/272`). Nach einem Probelauf weichen beide von dem Stand ab, den das Gate beurteilt.
- **Kommentare:** Der Kopfkommentar von `steering-snapshot.ts:6` nennt computeReadiness. Der Kommentar `report.ts:540` nennt `buildRoundChannels`, das es nicht mehr gibt.
