# CR-GC-751: `rules_evaluate {detail:'grouped'}` liefert die Arbeitsreihenfolge — Fehler zuerst, dann nach Stufe; der Skill `se:close-violations` liest sie, statt sie als Prosa zu führen

**Status:** ✅ Done (2026-10-06)
**Typ:** aus Item ITEM-2026-762 (idea)
**Erstellt:** 2026-10-06
**Item:** bok/items/ITEM-2026-762.json (Lane: code)
**Deckt:** sigloch-modules CR-SM-395 §6 („die Reihenfolge steht dort als Prosa und entfällt, sobald die Stufe
mitgeliefert wird"), Entwurf `docs/graphcode_regelmatrix_entwurf.md` §6.
**Schnitt:** Teil 3b des Nachzugs (3a: CR-GC-750, 3c: CR-GC-752). 8 Dateien: 2 Quelldateien, 1 Skill, 4 Dateien
zweier Rig-Aufgaben, 1 Testdatei.

---

## Befund

`se:close-violations` (CR-GC-747) nannte die Reihenfolge der Warnungen als Satz: „upstream before downstream:
system, use cases, requirements and chains before functions, flows and modules, those before schemas and tests".
Das ist die Stufe der Regel in Worten — eine zweite Fassung dessen, was der Katalog seit contracts 11 an jeder
Regel trägt. Das Werkzeug lieferte die Gruppen nach Häufigkeit; die Reihenfolge musste der Agent aus dem Satz
und den Regel-IDs erraten.

## Umsetzung

- `src/projections/report.ts`: `detail:'grouped'` (an `rules_evaluate` und `rules_get_violations`) gibt je
  Gruppe `stage` mit — 1–12 oder `immer`, aus `ALL_RULE_DEFS` — und sortiert: Fehler zuerst, dann die früheste
  Stufe (derselbe Rang wie beim Schritt, `stufenRang`), in einer Stufe die häufigste Regel. Die Aggregation
  bleibt `groupViolations` aus graphcode-client; hier wird nur angereichert und geordnet. `full` und `summary`
  unverändert.
- Parametertext von `detail` und `tool-help.ts` (`rules_evaluate`) nennen `stage` und die Reihenfolge.
- `.claude/commands/se/close-violations.md` (Version 3): der Absatz „Order" lautet jetzt „die Gruppen kommen in
  ihr: Fehler, dann nach `stage`, in einer Stufe die häufigste"; die Feldliste nennt `stage`. Sonst kein Wort
  geändert.
- `rig/aufgaben/todo-skill-warnungsfrei/start.md`, `rig/aufgaben/todo-hand-skill-wf/start.md`: der Skilltext
  darin durch den neuen ersetzt (Vorspann unverändert); `aufgabe.json` nennt als Quelle v3 / diesen CR. Beide
  Aufgaben messen damit einen anderen Auftrag als ihre bisherigen Läufe — die eingefrorenen Läufe sind nicht
  angefasst.

## Tests

**Rot zuerst:** der neue Fall in `tests/evaluation.reconciliation.test.ts` gegen den Stand davor:
„MS-03: expected undefined to be 10" — die Gruppe trug keine Stufe.

| Datei | |
|---|---|
| `evaluation.reconciliation` | **neu:** jede Gruppe trägt die Stufe ihrer Regel (gegen `ALL_RULE_DEFS`), die Folge ist Fehler → Stufe → Häufigkeit, über mindestens drei Stufen; `summary` trägt keine Stufe. Geändert: der Vergleich mit `groupViolations` läuft ohne `stage` und ohne Reihenfolge; die Zusage „absteigend nach count" ist gestrichen (sie gilt nur noch innerhalb einer Stufe und steht im neuen Fall). |
| `rig-interaktiv` | unverändert grün: `start.md` trägt den Skill wörtlich. |

## Umfang laut `graph_impact`

Nicht gelaufen (laufender Host tabu). Leser von `detail:'grouped'` über `git grep`: der Skill, die beiden
Rig-Aufgaben, `tests/evaluation.reconciliation.test.ts`. graph-view-edit gruppiert selbst über
`groupViolations` und ist nicht betroffen.

## Verifikation

- `npm run build` grün; `mcp.agent-agnostic` (Budget von tools/list) und `tool-description-params` grün.
- `npm run verify:full CR-GC-751` (Zeile in `docs/messung/testauswahl.jsonl`): Spur CODE, Auswahl 44/203, 3 rot —
  `tests/lockfile-sync.test.ts`, `tests/distribution.test.ts` (Link-Modus, erwartet), `tests/conformance.test.ts`
  (1 Fall, Modell-Zug aus CR-GC-748). Alle drei liegen außerhalb der Auswahl und zählen als **Schlupf**; keiner
  rührt von diesem CR her. Folge ohne Schlupf: 0/10.
