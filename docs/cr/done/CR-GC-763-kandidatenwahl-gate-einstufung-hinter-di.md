# CR-GC-763: Kandidatenwahl: Gate-Einstufung hinter die Zahl angelegter Elemente stellen

**Status:** ✅ Done (2026-10-08)
**Typ:** aus Item ITEM-2026-789 (finding)
**Erstellt:** 2026-10-08
**Item:** bok/items/ITEM-2026-789.json (Lane: code)

---

## Entscheidung des Autors (2026-10-08)

Auf die Frage „Einstufung durch das Gate hinter die Zahl der angelegten Elemente stellen?": „1. ja".

## Befund

Legt das lokale Modell mehrere Kandidaten für einen Schritt vor, gewann ein Zug, der nichts ändert, gegen einen,
der Elemente anlegt. Das Gate stuft „ändert nichts" als `auto-apply` ein; ein aufbauender Zug bringt Warnungen
mit und wird `suggest`. Die Einstufung stand in `rankCandidates` vor dem Steuerwert und vor der Zahl angelegter
Elemente. Gemessen am echten Gate (CR-GC-758): Aufbau mit 4 Mutationen verlor gegen Nichtstun mit 1.

Wirksam nur mit mehr als einem Kandidaten je Runde; Vorgabe ist einer.

## Änderung

Die Einstufung ist das letzte Kriterium vor dem Kandidaten-Index:

block verwerfen → Befund-Delta der Fokus-Stufe → kein Anstieg blockierender Fehler → kein Entfernen →
Steuerwert → Zahl angelegter Elemente → Einstufung → Index.

- `src/loop/executor-rank.ts` — Komparator.
- `src/loop/decisions.ts` — `VERDICT_ORDER` (daraus der Satz im Host-Protokoll); verbotene Formulierung umgedreht.
- Tests: `executor.bestofn`, `decision-texts`, `generate` — vier Fälle schrieben die alte Reihenfolge fest.
- Modell: Beschreibung von `FUNC-rank-candidates`.

## Umfang laut Modell

`CR-GC-763 → FUNC-rank-candidates`; Test `TEST-executor-bestofn`.
