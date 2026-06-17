---
name: se-view:implplan
description: Show implementation plan structure and milestone status
---

Read `docs/project/implementation-plan.md` and present a structured summary:

## 1. Meilenstein-Status (Gate Reviews)

For each milestone (M0-M8):
- Entry: vorheriger Meilenstein
- CRs: zugeordnete Change Requests mit Reihenfolge-Constraints
- Nachweis: IT-Testdatei(en) + verifizierte RQs (aus test-concept.md §3)
- Status: OFFEN / IN ARBEIT / GRUEN (basierend auf CR-Status in docs/cr/)

## 2. Abhaengigkeitsgraph

Render the mermaid graph showing CR-Dependencies AND milestone gate chain.

## 3. Abdeckung

Summarize coverage tables: FN/MD/FL/SC/UC → Meilenstein + CR.
Highlight gaps (elements without milestone assignment).

## Dokumentaufbau (normativ)

| Sektion | Inhalt | Normativ? |
|---------|--------|-----------|
| 1. Meilensteine (Gate Reviews) | M0-M8 Tabelle + CR-Details pro Meilenstein | Ja (Single Source of Truth fuer Meilensteine) |
| 2. Abhaengigkeitsgraph | Mermaid: CR-Abhaengigkeiten + Milestone-Gate-Kette | Ja |
| 3. Abdeckungscheck | FN/MD/FL/SC/UC → Meilenstein/CR Zuordnung | Ja (Vollstaendigkeitspruefung) |

**Regeln:**
- Verifikationskriterien leben NUR im test-concept.md (keine Doppelpflege)
- Risiken/Mitigationen gehoeren in die einzelnen CRs oder ins test-concept, nicht hierher
- Prosa nur als HTML-Kommentare (Lesehilfe, nicht normativ)
- Jeder Meilenstein verweist auf IT-Tests + RQs im test-concept
- Neue CRs muessen einem Meilenstein zugeordnet werden
- Neue Meilensteine brauchen einen IT-Test-Block im test-concept
- Phasen existieren nicht als eigenstaendiges Konzept — die Meilensteine SIND die Phasen
