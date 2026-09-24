# CR-GC-661: UC-01: qwen schreibt je Batch 1 REQ fuer 1 UC (9 von 11) — das Beispiel setzt die Menge

**Status:** 🟠 Open
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
- [ ] Rig (gcrun, N=3) gegen gcrun-100..102: REQs und geloeste UCs je UC-01-Batch deutlich mehr,
      Readiness nicht schlechter.
