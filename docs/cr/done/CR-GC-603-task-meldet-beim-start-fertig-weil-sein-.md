# CR-GC-603: Task meldet beim Start fertig, weil sein Regelset ohne Artefakt leer ist (opus5-14)

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-456 (bug)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-456.json (Lane: graph)

---

## Befund (opus5-14)

Alle fuenf Artefakt-Tasks (conops, fmea, trade, plan, irr) antworteten auf `graph_generate {task}` sofort
mit `handoff`/`done: true` — "kein offener Fund mehr in seinem Regelset". Root Cause: die Task-Regeln
pruefen nur Elemente, die schon existieren; ohne Artefakt gibt es keinen Fund. Der Agent arbeitete nur
weiter, weil der Skill es verlangt. Ein Treiber, der der Maschine folgt (Executor), haette jeden Task
leer uebersprungen.

## Aenderung

- `focus-set.ts`: die Task-Fokusmenge enthaelt den eigenen Eintrittspunkt (`TASK_ENTRY[task]`); ein im
  Kern abgenommener Eintritt gilt auch im Task. Die Invariante bleibt: fertig ⇔ kein Fokus.
- `generate.ts`: steht der eigene Eintritt im Task-Fokus, sagt der Prompt "Artefakt fehlt noch" mit dem
  Skill; der Task-Handoff behauptet keinen offenen Abschluss mehr (Stempel steht dann schon).
- `se:generate`: "Er ist erst fertig, wenn sein Artefakt steht und sein Regelset keinen Fund mehr hat."

## Test

`tests/generate.task.test.ts`: ohne trade-Stempel → Fokus AF-02, nicht fertig; mit Abnahme → fertig;
plan am Golden → zuerst AF-05, danach Plan-Regeln.

