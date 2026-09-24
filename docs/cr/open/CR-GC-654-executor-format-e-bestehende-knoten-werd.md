# CR-GC-654: Executor Format-E: bestehende Knoten werden fuer Kanten neu deklariert (Upsert) — Beispiel ohne reinen Kanten-Batch

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-555 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-555.json (Lane: code)

---

## Befund

Audit-Trail der Rig-Laeufe (gcrun, qwen3-coder-30b, je N=3): seit CR-GC-650 deklariert das Modell
bestehende Knoten erneut mit `+`, um eine Kante anzuhaengen — 5 je Lauf (vorher) → 16 (650/651) →
15 (653); neue Kanten je Lauf 58 → 50 → 44. `+` auf eine bestehende uid ist ein Upsert: er kann
Beschreibung und Namen ueberschreiben. Das Format-E-Beispiel im SYSTEM zeigte nur Knoten samt
Kanten, nie einen reinen Kanten-Batch — der ist seit CR-GC-310 legal.

## Umsetzung

Zweites Formvorbild im SYSTEM: ein reiner Kanten-Batch (`## Edges` / `+ FUNC-… -satisfy-> REQ-…`),
dazu der Hinweis, dass `+` auf eine bestehende uid sie ueberschreibt. Kein Verbot — Verbote wirkten
gemessen nicht (CR-GC-653).

## Dateien (3)

`src/loop/executor-prompt.ts`, `tests/executor.test.ts`, diese Datei.

## Akzeptanzkriterien

- [x] SYSTEM enthaelt den reinen Kanten-Batch; dieselbe Form geht am echten Store durchs Gate.
- [ ] Rig (gcrun, N=3) gegen gcrun-50..52: wiederholte Deklarationen je Lauf deutlich unter 15,
      neue Kanten nicht weniger als 44, Elemente und Readiness nicht schlechter.
