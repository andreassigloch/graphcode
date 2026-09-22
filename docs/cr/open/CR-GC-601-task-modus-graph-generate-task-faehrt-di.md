# CR-GC-601: Task-Modus: graph_generate {task} faehrt dieselbe Maschine mit dem detaillierten Regelset des Tasks — Task-Regeln zunaechst als Warnung, nie blockierend; Abnahme je Task (fmea: FM-03, plan: CR-R01, realisierung: Praesenzregeln); Skill-Verweis des Tasks

**Status:** ✅ Umgesetzt
**Typ:** aus Item ITEM-2026-454 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-454.json (Lane: graph)

---

## Umsetzung (2026-09-22)

- `generationStep(…, task)` / `graph_generate {task}`: dieselbe Maschine, Fokusmenge = das Regelset
  des Tasks, als Warnung (Entscheidung: "verschaerft" heisst detailliert, nicht blockierend).
  Schritt nennt den Task-Skill (`TASK_SKILL`: conops/trade/irr/fmea/plan → se-*, anforderungs-
  qualitaet → `se:author-req`, realisierung → `se-test`); Prompt beginnt mit "Task x (Skill y):".
- Task ohne offenen Fund → `handoff` des Tasks: "Artefakt mit dem Skill abschliessen (Stempel), dann
  graph_generate ohne task". Tasks ohne eigene Regeln (trade, irr) sind damit sofort am Ausgang.
- Kern: steht ein Eintrittspunkt im Fokus, nennt der Prompt den Task und seinen Skill — oder die
  Abnahme, wenn das Artefakt im schlanken Umfang nicht noetig ist.
- Sitzung merkt sich den Task (`FocusMemory.task`): `next` bleibt im Task, bis `graph_generate` ohne
  `task` in den Kern zurueckholt. Der Executor (driver) bleibt im Kern.
- `se:generate` beschreibt den Ablauf.

Tests `tests/generate.task.test.ts` (Golden: fmea-/plan-Fokus, trade sofort durch, Eintritts-Hinweis
im Kern; echtes Gate: next bleibt im Task). **Kongruenz:** benannte Ausnahme.
