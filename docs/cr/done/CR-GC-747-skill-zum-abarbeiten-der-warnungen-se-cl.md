# CR-GC-747: Skill zum Abarbeiten der Warnungen: se:close-violations deckt heute nur Fehler (R-01, RD-01); erweitern auf alle offenen Befunde, Regel fuer Regel, mit den drei Auswegen beheben, abnehmen mit Grund, fragen - Vorlage ist der in 8 Rig-Laeufen gemessene Auftrag der Stufe warnungsfrei

**Status:** ✅ Done (2026-10-06)
**Typ:** aus Item ITEM-2026-760 (idea)
**Erstellt:** 2026-10-06
**Item:** bok/items/ITEM-2026-760.json (Lane: code)

---

## Befund

`se:close-violations` arbeitete nur Fehler ab (R-01, RD-01). Für Warnungen gab es keinen Skill: In den Rig-Läufen der
Stufe „warnungsfrei" stand das Verfahren im handgeschriebenen Auftrag der Aufgabe. Der Autor hat entschieden
(2026-10-06): Der Skill zum Abarbeiten hat Vorrang; ob ein Wächter ihn auslöst oder der Nutzer aus dem Cockpit, wird
später festgelegt (`docs/graphcode_regelmatrix_entwurf.md` §6). Im Cockpit hängt der Skill bereits am Feld
„Empfehlungen".

## Umsetzung

- `.claude/commands/se/close-violations.md`, Version 2: alle offenen Befunde, Fehler zuerst, dann Warnungen von vorn
  nach hinten im Modell, eine Regel je Batch. Drei Auswege je Befund: im Modell beheben, mit Begründung abnehmen,
  den Nutzer fragen. Kein `concept`, keine Bindung in einem Modell-Auftrag (die erste Bindung startet den Bau).
- Zwei Rig-Aufgaben, die den Skilltext wörtlich als Auftrag tragen: `todo-skill-warnungsfrei` (Referenzlauf) und
  `todo-hand-skill-wf` (Handlauf). Ein Test hält fest, dass Auftrag und Skill übereinstimmen.
- `rig/simulator.mjs`: Eine Frage nach dem Entfernen oder Behalten eines benannten Elements ist eine Entscheidung
  am Modell. Vorher antwortete der Simulator „als offen führen", und der Lauf endete im Stillstand.

## Messung (Stand 1a2502f+dirty, Regelsatz 37.0.0)

| Startmodell | Arm | Auftrag von Hand (2026-10-05) | Auftrag = Skill |
|---|---|---|---|
| Referenzlauf | Opus | 1 Zug, warnungsfrei | 2 Züge, warnungsfrei |
| Handlauf | Opus | 2 Züge, warnungsfrei | 1 Zug, warnungsfrei |
| Referenzlauf | qwen | 3 Züge, 26 min, warnungsfrei | 2 Züge, 20 min, warnungsfrei |
| Handlauf | qwen | 2 Züge, 24 min, warnungsfrei | 2 Züge, 23 min, warnungsfrei |

Der Unterschied am Referenzlauf: Mit dem Skill fragt Opus, bevor er einen verwaisten Datenfluss löscht („Never: delete
an element because a rule complains about it"), statt selbst zu entscheiden. Das kostet einen Zug und ist für den
interaktiven Betrieb das gewollte Verhalten.

Zwei Läufe sind verworfen: einer wegen des Simulators (oben), einer, weil der Host nicht startete — der Pfad des
Host-Sockets war mit dem ersten Aufgabennamen 113 Zeichen lang und wurde vom System still gekürzt (ITEM-2026-761).

## Nicht in diesem CR

- Der Auslöser (Wächter oder Cockpit) und sein Maß.
- Die Reihenfolge „von vorn nach hinten" steht im Skill als Prosa. Sobald die Matrix die Stufe je Regel trägt,
  liefert `rules_evaluate` die Ordnung, und der Absatz entfällt.
- Der Skill nennt `rules_get_violations` und `graph_export`; im Rig sind beide nicht freigegeben. Die Läufe zeigen,
  dass der Agent ohne sie auskommt und es meldet.

---

## Umfang

Ein Skilltext, zwei Rig-Aufgaben, eine Wortliste im Simulator, ein Testblock. Kein Modellknoten ändert sich: Der Skill
ist an `FUNC-test` und die Hilfe gebunden, beide unberührt. Spur VOLL, weil `.claude/commands` keinen Modellknoten hat.
