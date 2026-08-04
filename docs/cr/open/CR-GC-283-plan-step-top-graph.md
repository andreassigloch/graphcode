# CR-GC-283 — Planungs-Step auf dem Top-Graphen (Folgechat-Input)

**Status:** open — Schritte 1+2 weitgehend erledigt, Rest offen (Prüf-Nachtrag
2026-08-04, verifiziert gegen `rig/plan-step/`):
- ✅ Arbeits-Repo `rig/plan-step/` steht (graphcode init komplett: Hooks,
  Commands, Kuzu-Store, Graph committed) — der Scratchpad-Hinweis unten ist
  damit obsolet
- ✅ Duplikat-REQs gemerged (26→21 REQ, 0 Namens-Duplikate)
- ✅ se-plan gelaufen: 4 MS + 11 CR im Graphen (11× CR→MS, 3× MS→MS relation)
- ✅ (2026-08-04) 5 UC-01-Errors durchs Gate aufgelöst — alle 5 waren
  Beinahe-Duplikate REQ-verbundener Basis-UCs → 5× merge-nodes, 0 Errors
- ✅ (2026-08-04) Build-Reihenfolge ableitbar gemacht: CR→CR ist im Meta-Modell
  NICHT legal — stattdessen FLOW-Ebene ergänzt (9 FLOWs, 21 io-Kanten); der
  DAG folgt jetzt aus den FLOWs: 001→006→002→003→004→005→{007 | 008→009 |
  010→011}
- ✅ (2026-08-04) alle 16 Views exportiert (implplan, testconcept, testmatrix …)
- ✅ (2026-08-04) Testpyramide substanziell: E2E-Durchstich ergänzt
  (REQ-e2e-collaboration-journey + TEST-e2e-multiuser-journey), 6 semantisch
  falsch gepaarte verify-Kanten auf 3 neue fachliche TESTs umverdrahtet
  (auth-session, live-updates, export-roundtrip); Restlücke = 6/11
  FUNC↔FUNC-Integrationsverbindungen (R-21, sichtbar in testconcept) — per
  se-plan-Disziplin DoD der jeweiligen CRs, kein Graph-Defekt
- ❌ Vergleichsmessung Opus-Plan vs. devstral-Plan: weiterhin offen (einziger
  Restpunkt dieses CRs)
**Datum:** 2026-08-01
**Kontext:** `docs/executor-abschlussbericht.md` — Abschluss des Executor-
Programms (CR-GC-278…282). Dieser CR ist der erste Schritt des dort benannten
Rest-Programms: Planungs-Step, danach (separater CR) autonomes Coding.

## Ausgangslage

Der Greenfield-Vergleich hat vier valide Systemgraphen erzeugt; **Top-Graph
nach Algo (Readiness/Violations) und Semantik-Audit: Haiku 4.5** — 86 Elemente
/ 154 Traces, 5 Error-Violations, REQs mit messbaren Kriterien. Quelle:
`scratchpad/gc-run-haiku45/docs/graph/gc-run-haiku45.graph.json` (Scratchpad
ist flüchtig — als ERSTES in ein Arbeits-Repo übernehmen).

## Ziel dieses CRs (ein Chat, ≤5 Dateien)

Aus dem Top-Graphen den Implementierungsplan erzeugen — graph-first, nicht
Prosa-first:

1. **Arbeits-Repo aufsetzen:** frisches Repo (oder `rig/`-Workspace),
   `graphcode init`, Top-Graph als `docs/graph/*.graph.json` committen,
   Store per seed-on-empty laden. Vorher die 5 Error-Violations durchs Gate
   auflösen (`se:close-violations`) und die bekannten Duplikat-REQs mergen.
2. **se-plan fahren** (Skill existiert): CR-Build-Reihenfolge aus dem
   depends-on-DAG, CRs ≤5 Dateien, CR-Inhalt = `graph_context`-Slice,
   MS/CR/relation-Kanten durchs Gate schreiben.
3. **Vergleichsmessung (die eigentliche Frage):** denselben Plan-Step einmal
   von Opus 5 und einmal von devstral ausführen lassen — beide über den
   embedded Treiber (`GRAPHCODE_LLM_BACKEND`) — und die Pläne vergleichen
   (DAG-Konsistenz, CR-Schnittgröße, Abdeckung der FUNC/REQ-Menge).

## Danach (separater CR, nicht hier)

**Autonomes Coding auf Graph-Basis:** CRs des Plans abarbeiten,
`graph_realize` bindet FUNC→codeRef und TEST→testRef, R-19/R-20 messen die
Bindungs-Vollständigkeit. Wieder Opus 5 vs. local über denselben Treiber.

## Offene Design-Punkte aus dem Abschlussbericht (bei Bedarf hier mitziehen)

- Zielprofil als Runde-1-Input (Gewichte je Dimension) — beeinflusst den Plan
- Prompt-Caching im anthropic-Backend (Kosten des Opus-Arms)
- Duplikat-Erkennung vor add-node

## Akzeptanzkriterien

- [ ] Top-Graph in einem Arbeits-Repo, 0 Error-Violations, Duplikate gemerged
- [ ] Plan im Graphen (MS/CR/depends-on), exportiert via `se-view:implplan`
- [ ] Vergleich Opus-Plan vs. local-Plan dokumentiert (auch ein klarer
      Qualitätsunterschied ist ein Ergebnis)
