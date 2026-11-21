# CR-GC-976: Skills: Umzug eines Altbestands — Aufnahme, Zugangsliste, Durchlauf vor dem Schnitt (se-conops, se-cdr, se-plan)

**Typ:** aus Item ITEM-2026-1525 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1525.json (Lane: code)

---

Quelle: immo-infra CR-INF-198 (Auswertung von 47 Rückfragen im Bau 2026-11-10 bis 11-21). Vom Autor am 2026-11-21 freigegeben. Größe: Die vier Skills haben zusammen 33,6 KB (se-plan 11,4, se-bau 8,9, se-conops 7,2, se-cdr 6,1). Bedingung: Die Summe wächst durch diesen Auftrag nicht; neuer Text ersetzt oder kürzt bestehenden.

1. se-conops: Bei einem Umzug ist der Altbestand Eingabe der Spezifikation. Heute fragt der Skill nur, ob der Altbestand weiterlaufen muss. Neu: je Use Case aufnehmen, wie er heute läuft (Skript, Schlüssel, Takt, Format). Beleg: 13 Rückfragen hatten ihre Antwort im Altbestand; der Plan deckte 2 von 22 Skills des Altbestands ab.
2. se-conops, se-plan: Die Zugangsliste nimmt zusätzlich den Altbestand als Quelle (.env, Skripte); se-plan liest sie bei jedem Schnitt neu. Beleg: 12 Rückfragen zu Schlüsseln und Benutzern kamen nach dem Lauf von se-conops.
3. se-cdr: Ein Durchlauf je Use Case mit echten Daten auf der Zielumgebung ist fester Schritt vor dem Schnitt, nicht nur eine Messung je Einzelfrage (§4). Beleg: 11 Widersprüche zeigten sich erst an echten Daten, z. B. 85 Objekte mit Adresse im Feld name.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1384, Tiefe 1, Wurzeln: `FUNC-se-conops`, `FUNC-se-cdr`, `FUNC-se-plan`._

Reichweite: 5 Elemente (FLOW 1, FUNC 4); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 3):
- .claude/commands/se-cdr.md
- .claude/commands/se-conops.md
- .claude/commands/se-plan.md

Tests (`graph_tests`, 3):
- tests/se-plan.groups.test.ts
- tests/skill-cdr.test.ts
- tests/skill-zugangsliste.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
