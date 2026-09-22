# CR-GC-604: Abbruchregel stellt Eintrittspunkte zurueck; stalled nennt Mensch statt Task; next.skill null am Eintritt (opus5-14)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-457 (bug)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-457.json (Lane: graph)

---

## Befund (opus5-14)

- AF-03 (Eintritt IRR) stand im Fokus, der Agent arbeitete anderes ab; beim zweiten gleichen Fokus stellte
  die Abbruchregel AF-03 zurueck. Am Ende `stalled`: "Uebergib an den Menschen" — offen war nur der Task.
- Im Plan-Task endete CR-R03 `stalled` mit derselben Ansage "Mensch", obwohl Task-Regeln Warnungen sind.
- `next.skill` war bei AF-04/AF-05 `null` (Dimensionen ver/ms haben keinen Autorier-Skill).

## Aenderung (5 Dateien + Tests)

- `stagnation.ts`: Eintrittspunkte (TASK_ENTRY) sind von der Wiederholungs-Zurueckstellung ausgenommen —
  sie loest nur ihr Task oder eine Abnahme. Ein ausdrueckliches `defer` des Hosts gilt weiter.
- `generate.ts`: `stalled` sagt, wohin: im Task "zurueck in den Kern"; im Kern mit offenem Eintritt
  "starte graph_generate {task}"; erst sonst der Mensch. `skill` am Eintritt = Skill des Tasks.
- `decisions.ts` + `se:generate`: der stalled-Satz wortgleich nachgezogen.

## Test

`tests/stagnation.test.ts` (Eintritt bleibt stehen, next.skill = Task-Skill; Task festgefahren → Kern),
`tests/generate.test.ts` (Ansage bei zurueckgestellten Eintritten).

