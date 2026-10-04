# CR-GC-712: T-UC als Paket: Block-Zug je UC (REQ/TEST/FCHAIN/FUNC/FLOW), SCHEMA als markierter Stub statt Schablonentext; top-level in T-SYS/T-UC schneiden

**Status:** ⏸ Geparkt (2026-10-04, Entscheid Autor) — Abnehmer war der Executor, der seit dem Leitlinien-Entscheid 2026-10-03 eingefroren ist. Wieder aufnehmen nur, wenn die Vorschlagsfolge im interaktiven Rig (CR-GC-715) dieselben Muster zeigt (Ebenensprünge, halbe UCs, Module unter Inhalts-Fokus); dann 711 für den Vorschlag neu schneiden.
**Typ:** aus Item ITEM-2026-642 (idea)
**Erstellt:** 2026-09-28
**Item:** bok/items/ITEM-2026-642.json (Lane: code)

---

## Befund

Ein UC entsteht heute in Stücken über viele Runden (UC-01 → REQ, RD-01 → FUNC, UC-02 → Skelett …);
jede Stufe hinterlässt die Befunde der nächsten (256 neue Fokusfunde in 91 Runden, 2026-09-28). Die
Skelette schreiben Platzhalter („«Feld A» und «Feld B»"), die als Inhalt übernommen werden: 11–14
Elemente je Lauf, vor allem SCHEMA.

## Ziel

**T-UC** als ein Paket je UC, ein Block-Zug: REQ mit `kinds` + TEST, eine FCHAIN mit FUNCs als
Blackbox, FLOWs Akteur→…→Akteur, satisfy/verify. SCHEMA entsteht als **markierter Stub** (Attribut,
kein Schablonentext) — die Felder füllt T-VERTRAG. Der Skill `top-level` wird in T-SYS und T-UC
geschnitten; der Skill trägt Arbeitsauftrag und Form-Vorbild (Platzhalter aus fremder Domäne), der Code
Kontext, Rahmen und Abnahme.

Hängt an CR-GC-710/711.

## Akzeptanz

- Abnahme je T-UC-Paket nach k ≤ 2 Reparaturen; Schablone in `verhalten.dubletten` = 0.
- S2-Runde, Zeile in `verlauf.md`: Anteil Block-Vervollständigungsrunden, Dubletten, Ketten mit 1 FUNC (T-V5).
