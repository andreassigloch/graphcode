# CR-GC-977: Skills: Rückfragen im Bau — Regel statt Einzelfall, Entscheidungen durchsuchen, Stoppen nach Rang (se-cdr, se-bau)

**Typ:** aus Item ITEM-2026-1526 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1526.json (Lane: code)

---

Quelle: immo-infra CR-INF-198 (Auswertung von 47 Rückfragen im Bau 2026-11-10 bis 11-21). Vom Autor am 2026-11-21 freigegeben. Größe: Die vier Skills haben zusammen 33,6 KB (se-plan 11,4, se-bau 8,9, se-conops 7,2, se-cdr 6,1). Bedingung: Die Summe wächst durch diesen Auftrag nicht; neuer Text ersetzt oder kürzt bestehenden.

1. se-cdr §5: Fragen nach Art bündeln; bei zwei Fragen derselben Art die Regel erfragen, nicht den Einzelfall. Beleg: sechs Einzelfragen zu Schlüsseln, dann am 2026-11-19 eine Regel für alle Läufe.
2. se-bau, Koordinator: Vor jeder Rückfrage an den Auftraggeber die Abschnitte „Entscheidungen“ der CRs des Repos durchsuchen. Beleg: eine Frage wurde am 18.11. und 21.11. gestellt; bei CR-INF-174 hielten zwei Sitzungen Verschiedenes fest.
3. se-bau, Umsetzer Punkt 5 (ändert die Regel „stoppe und melde, nimm nichts an“; Entscheidung des Autors 2026-11-21): Der Rang aus se-cdr entscheidet. Ändert die Antwort das Verhalten (behaviour), stoppt der Agent. Sonst (detail) baut er mit der engeren Annahme weiter und nennt sie im Abschlussbericht.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1385, Tiefe 1, Wurzeln: `FUNC-se-cdr`, `FUNC-se-bau`._

Reichweite: 4 Elemente (FLOW 1, FUNC 3); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 2):
- .claude/commands/se-bau.md
- .claude/commands/se-cdr.md

Tests (`graph_tests`, 2):
- tests/skill-bau.test.ts
- tests/skill-cdr.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
