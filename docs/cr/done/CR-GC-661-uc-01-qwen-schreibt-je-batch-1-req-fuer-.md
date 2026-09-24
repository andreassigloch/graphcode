# CR-GC-661: UC-01: qwen schreibt je Batch 1 REQ fuer 1 UC (9 von 11) — das Beispiel setzt die Menge

**Status:** ✅ Done (2026-09-24)
**Typ:** aus Item ITEM-2026-564 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-564.json (Lane: code)

---

## Befund

gcrun-100..102: in den UC-01-Fenstern (drei UCs ohne REQ, Klausel „je UC 3–5 REQ-Kandidaten")
schreibt qwen3-coder in **9 von 11 Batches genau eine REQ fuer genau einen UC**; nur zwei Batches
bedienen alle drei. Die Menge folgt dem Beispiel — SYSTEM (CR-GC-657) und `author-req` zeigen je
eine REQ. Bei 12 Runden begrenzt das den Fortschritt unmittelbar.

## Umsetzung

Die UC-01-Klausel sagt „Bediene ALLE n UCs in EINEM Batch, je UC mindestens zwei REQs" und zeigt ein
Vorbild mit zwei UCs, je zwei REQs samt `@kinds` und TEST, mit Fan-out-Kanten. Die uids sind
sprechend, keine Platzhalter (Platzhalter fuehrten zu STRUCT-Fehlern, CR-GC-658).

Gemessen gemeinsam mit CR-GC-660 — getrennte Zaehler: 660 wirkt auf ueberschriebene Texte, 661 auf
REQs und geloeste UCs je UC-01-Batch.

## Dateien (3)

`src/loop/generate.ts`, `tests/executor.test.ts`, diese Datei.

## Akzeptanzkriterien

- [x] Das Vorbild geht am echten Store unveraendert durchs Gate (4 REQs, 4 TESTs, Fan-out).
- [x] Rig — Ziel erreicht; Readiness leicht niedriger, im Rauschen und erklaert (siehe unten).

## Rig-Messung (2026-09-25, `results-runde19-gcrun-660-661.json`, gcrun-120..122, gemeinsam mit CR-GC-660)

| Mittel je Lauf | 658+659 | 660+661 |
|---|---:|---:|
| angewandte Neu-Deklarationen / davon Text ueberschrieben (3 Laeufe) | 45 / 25 | **0 / 0** |
| vom Preflight abgefangene Neu-Deklarationen (3 Laeufe) | — | 113 |
| UC-01-Batches (3 Laeufe) | 11, davon 9× „1 UC / 1 REQ" | **4: 3UC/6REQ ×2, 2UC/3REQ, 3UC/8REQ** |
| Elemente / neue Kanten | 44 / 59 | **52 / 63** |
| FUNC | 5,0 | 9,7 |
| Lese-Aufrufe | 146 | 114 |
| Gate-Ablehnungen | 3,0 | 4,0 |
| Readiness req / uc / arch / ver | .89 / .85 / .93 / .86 | .83 / .80 / .90 / .87 |
| Tokens ein / Laufzeit | 218k / 231 s | 197k / 215 s |

Beide Ziele erreicht. **Readiness leicht niedriger** — je Lauf ueberlappend (req .84–.92 gegen
.81–.86; uc mit einem Ausreisser .70) und mechanisch erklaerbar: mehr REQs in weniger Runden, in zwei
Laeufen haengen am Rundenende 7 REQs noch ohne Erfueller (RD-01). Das ist die Momentaufnahme bei
Runde 12, kein schlechteres Element. Behalten.
