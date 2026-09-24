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
- [x] Rig (gcrun, N=3) gegen gcrun-50..52 — **Ziel verfehlt, Aenderung behalten** (siehe unten).

## Rig-Messung (2026-09-24, `results-runde19-gcrun-654.json`, gcrun-60..62)

| Mittel je Lauf | 653 | 654 |
|---|---:|---:|
| Elemente | 48 (45/40/58) | 60 (64/58/59) |
| neue Kanten | 44 | 59 |
| Ablehnungen | 3,3 | 2,0 |
| wiederholt deklarierte Knoten | 15 | **20** |
| reine Kanten-Batches | 0 von 34 | **0 von 45** |
| Readiness req / uc / ver | .67/.66/.85 | .62/.64/.85 |

**Das Vorbild hat sein Ziel nicht erreicht:** kein einziger reiner Kanten-Batch, und die
Neu-Deklarationen stiegen. Die hoehere Element- und Kantenzahl ist deshalb NICHT dieser CR
zuzuschreiben — bei der Streuung dieser Laeufe ist sie im Rauschen.

**Die eigentliche Ursache der Neu-Deklarationen** zeigt der Audit-Trail: in gcrun-60/62 schreiben
die Batches b11–b14 dieselben drei UCs neu (teils mit neuer Beschreibung und neuem Namen) und
loesen keinen Fund. Das Fenster war UC-02 (UC ohne ACTOR-Pfad); die Klausel verlangt
ACTOR io→FLOW io→FUNC, der injizierte Skill `author-uc` (Dimension uc) zeigt als Beispiel
`SYS -compose-> UC` / `UC -compose-> FCHAIN` — genau das schreibt das Modell ab, drei Runden lang
bis zum Zurueckstellen. Das ist ITEM-2026-551, weiter in CR-GC-655.

**Behalten**, weil der Hinweis sachlich stimmt (`+` auf eine bestehende uid ueberschreibt) und
~150 Zeichen kostet — aber ohne belegte Wirkung.

