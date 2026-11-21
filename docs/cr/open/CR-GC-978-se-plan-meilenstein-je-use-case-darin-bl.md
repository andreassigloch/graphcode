# CR-GC-978: se-plan: Meilenstein je Use Case, darin Blätter aufwärts (ändert CR-GC-892)

**Typ:** aus Item ITEM-2026-1527 (idea)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1527.json (Lane: code)

---

Quelle: immo-infra CR-INF-198 (Auswertung von 47 Rückfragen im Bau 2026-11-10 bis 11-21). Vom Autor am 2026-11-21 freigegeben. Größe: Die vier Skills haben zusammen 33,6 KB (se-plan 11,4, se-bau 8,9, se-conops 7,2, se-cdr 6,1). Bedingung: Die Summe wächst durch diesen Auftrag nicht; neuer Text ersetzt oder kürzt bestehenden.

se-plan §4 (ändert CR-GC-892; Entscheidung des Autors 2026-11-21): Ein Meilenstein je Use Case statt je Integrationsebene. Innerhalb des Use Case bleibt die Reihenfolge von den Blättern aufwärts, damit kein Modul vor seinen Blattfunktionen steht. Stufe 0 (Umgebung, Zugänge) und die Umschaltung bleiben eigene Meilensteine. Beleg: Beim Bau nach Ebenen lief ein Use Case erst am Ende ganz durch; auf 70 geplante CRs kamen in 15 Tagen 80 ungeplante.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1386, Tiefe 1, Wurzeln: `FUNC-se-plan`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se-plan.md

Tests (`graph_tests`, 2):
- tests/se-plan.groups.test.ts
- tests/skill-zugangsliste.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
