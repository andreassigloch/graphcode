# Benchmark des Rigs

> GENERIERT von `node auswertung/auswerten.mjs` — nicht von Hand bearbeiten. Datensätze: [`benchmark.jsonl`](benchmark.jsonl)
> (eine Zeile je Lauf, Rohdaten entbehrlich, sobald die Zeile steht). Rig: [`rig/README.md`](../../rig/README.md), Analysen:
> [`auswertung/README.md`](../../auswertung/README.md). Ein Lauf endet, wenn die Readiness SRR und PDR als bestanden meldet.
> Die Deutung (T-E3 erfüllt oder nicht) steht in der Leitlinie, nicht hier.

## Stand — je Aufgabe × Arm die jüngste Serie

| Aufgabe | Arm | Modell | Stand (code · vorlage) | N | Züge | Sitzungen | Dauer je Zug Median (min) | Fragen Zug 1 | Mutationen + / − | PDR nach Zug | Dubletten | Blindurteil P ✓ · ~ · ✗ / O offen / erfunden / Dubl. / Noten |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| todo-hand-warnungsfrei | frontier | claude-opus-5-5 | 1e67ea6 · 511714e | 1 | 2 | 1 | 0.9 | 1 | 3 / 0 | 1 | 2 | — |
| todo-hand-warnungsfrei | lokal | ollama/qwen3.8:27b-nvfp4 | 1e67ea6 · 511714e | 1 | 3 | 1 | 12.7 | 0 | 3 / 0 | 1 | 0 | — |
| todo-warnungsfrei | frontier | claude-opus-5-5 | 1e67ea6 · 511714e | 1 | 1 | 1 | 0.9 | 0 | 2 / 0 | 1 | 0 | — |
| todo-warnungsfrei | lokal | ollama/qwen3.8:27b-nvfp4 | 1e67ea6 · 511714e | 1 | 2 | 1 | 13.0 | 2 | 3 / 2 | 1 | 0 | — |
| todo | frontier | claude-opus-5-5 | 533dc29 · 511714e | 3 | 10–12 | 4–7 | 0.5–0.6 | 7 | 10–12 / 1 | 10–12 | 0–4 | 11 · 0 · 0 / 1–4 / 2–9 / 3–6 / 16–18 |
| todo | lokal | ollama/qwen3.8:27b-nvfp4 | 533dc29 · 511714e | 3 | 5–10 | 1–3 | 1.1–2.4 | 4–6 | 4–17 / 2–6 | 2–10 | 0–2 | 9–10 · 1–2 · 0 / 0 / 2–7 / 0–4 / 15–17 |

## Verlauf — ein Lauf je Zeile

| Datum | Aufgabe | Arm | Lauf | Modell | Stand | Ende | Züge · Sitzungen | Dauer Median / Max (min) | Fragen Zug 1 | Schritte Median / Max | Mutationen + / − | Abbrüche L / F | SRR / PDR nach Zug | Elemente · Kanten | Dubletten | Gate-Fehler je Regel | Schatten: Vorschlag getroffen / verpasst | Blindurteil |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-05 | todo-hand-warnungsfrei | frontier | 1 | claude-opus-5-5 | 1e67ea6 · 511714e | warnungsfrei | 2 · 1 | 0.9 / 1.5 | 1 | 11 / 20 | 3 / 0 | 0 / 0 | 1 / 1 | 64 · 127 | 2 | — | 0/0 / 0 | — |
| 2026-10-05 | todo-hand-warnungsfrei | lokal | 1 | ollama/qwen3.8:27b-nvfp4 | 1e67ea6 · 511714e | warnungsfrei | 3 · 1 | 12.7 / 33.9 | 0 | 7 / 8 | 3 / 0 | 3 / 0 | 1 / 1 | 59 · 105 | 0 | — | 0/0 / 0 | — |
| 2026-10-05 | todo-warnungsfrei | frontier | 1 | claude-opus-5-5 | 0164699+dirty · 511714e | freigabe | 8 · 7 | 0.9 / 1.7 | 1 | 10 / 14 | 10 / 0 | 0 / 0 | 1 / 1 | 68 · 154 | 13 | — | 0/0 / 0 | — |
| 2026-10-05 | todo-warnungsfrei | frontier | 2 | claude-opus-5-5 | 1e67ea6 · 511714e | warnungsfrei | 1 · 1 | 0.9 / 0.9 | 0 | 20 / 20 | 2 / 0 | 0 / 0 | 1 / 1 | 38 · 59 | 0 | — | 0/0 / 0 | — |
| 2026-10-05 | todo-warnungsfrei | lokal | 1 | ollama/qwen3.8:27b-nvfp4 | b4c6733+dirty · 511714e | freigabe | 4 · 1 | 13.3 / 21.0 | 1 | 9.5 / 26 | 2 / 2 | 1 / 0 | 1 / 1 | 38 · 57 | 0 | R-18×2 IO-02×1 | 0/0 / 0 | — |
| 2026-10-05 | todo-warnungsfrei | lokal | 2 | ollama/qwen3.8:27b-nvfp4 | 1e67ea6 · 511714e | warnungsfrei | 2 · 1 | 13.0 / 15.2 | 2 | 15.5 / 16 | 3 / 2 | 1 / 0 | 1 / 1 | 38 · 57 | 0 | R-18×2 STRUCT×1 | 0/0 / 0 | — |
| 2026-10-05 | todo | frontier | 4 | claude-opus-5-5 | 8c498e8 · 511714e | srr+pdr | 11 · 6 | 0.7 / 1.7 | 5 | 7 / 14 | 11 / 1 | 0 / 0 | 4 / 11 | 71 · 121 | 5 | R-18×6 | 0/0 / 0 | 11 · 0 · 0 / 3 / 6 / 8 / 14 |
| 2026-10-05 | todo | frontier | 5 | claude-opus-5-5 | 8c498e8 · 511714e | srr+pdr | 11 · 7 | 0.8 / 1.8 | 6 | 5 / 20 | 12 / 1 | 0 / 0 | 4 / 11 | 61 · 109 | 1 | R-18×6 | 0/0 / 0 | 11 · 0 · 0 / 4 / 5 / 3 / 19 |
| 2026-10-05 | todo | frontier | 6 | claude-opus-5-5 | 8c498e8 · 511714e | srr+pdr | 11 · 6 | 0.7 / 2.6 | 7 | 5 / 16 | 11 / 1 | 0 / 0 | 4 / 11 | 70 · 126 | 3 | R-18×6 | 0/0 / 0 | 11 · 0 · 0 / 5 / 6 / 7 / 18 |
| 2026-10-05 | todo | frontier | 7 | claude-opus-5-5 | 533dc29 · 511714e | srr+pdr | 11 · 6 | 0.6 / 3.1 | 7 | 6 / 28 | 12 / 1 | 0 / 0 | 4 / 11 | 62 · 124 | 2 | R-18×6 | 0/0 / 0 | 11 · 0 · 0 / 1 / 7 / 4 / 16 |
| 2026-10-05 | todo | frontier | 8 | claude-opus-5-5 | 533dc29 · 511714e | srr+pdr | 12 · 7 | 0.6 / 3.8 | 7 | 5.5 / 21 | 10 / 1 | 0 / 0 | 4 / 12 | 76 · 141 | 0 | R-18×6 | 0/0 / 0 | 11 · 0 · 0 / 3 / 9 / 6 / 17 |
| 2026-10-05 | todo | frontier | 9 | claude-opus-5-5 | 533dc29 · 511714e | srr+pdr | 10 · 4 | 0.5 / 1.2 | 7 | 3 / 15 | 10 / 1 | 0 / 0 | 4 / 10 | 51 · 85 | 4 | R-18×6 | 0/0 / 0 | 11 · 0 · 0 / 4 / 2 / 3 / 18 |
| 2026-10-05 | todo | lokal | 4 | ollama/qwen3.8:27b-nvfp4 | 8c498e8 · 511714e | srr+pdr | 18 · 6 | 2.8 / 8.8 | 6 | 5 / 36 | 14 / 5 | 0 / 0 | 4 / 18 | 58 · 86 | 9 | R-18×8 STRUCT×3 | 0/0 / 0 | 11 · 0 · 0 / 1 / 6 / 3 / 14 |
| 2026-10-05 | todo | lokal | 5 | ollama/qwen3.8:27b-nvfp4 | 8c498e8 · 511714e | srr+pdr | 12 · 3 | 2.0 / 11.4 | 5 | 2.5 / 18 | 8 / 2 | 1 / 0 | 4 / 12 | 40 · 73 | 0 | R-18×9 | 0/0 / 0 | 10 · 1 · 0 / 0 / 2 / 4 / 15 |
| 2026-10-05 | todo | lokal | 6 | ollama/qwen3.8:27b-nvfp4 | 8c498e8 · 511714e | srr+pdr | 5 · 1 | 2.8 / 3.6 | 5 | 4 / 6 | 4 / 2 | 0 / 0 | 5 / 2 | 39 · 57 | 1 | R-18×2 IO-02×1 | 0/0 / 0 | 10 · 1 · 0 / 0 / 0 / 2 / 19 |
| 2026-10-05 | todo | lokal | 7 | ollama/qwen3.8:27b-nvfp4 | 533dc29 · 511714e | srr+pdr | 5 · 1 | 1.1 / 11.4 | 4 | 4 / 8 | 6 / 2 | 0 / 0 | 5 / 2 | 54 · 92 | 2 | R-18×6 IO-02×3 | 0/0 / 0 | 10 · 1 · 0 / 0 / 4 / 4 / 15 |
| 2026-10-05 | todo | lokal | 8 | ollama/qwen3.8:27b-nvfp4 | 533dc29 · 511714e | srr+pdr | 5 · 1 | 1.9 / 12.4 | 6 | 2 / 10 | 4 / 2 | 0 / 0 | 5 / 2 | 44 · 77 | 0 | R-18×2 IO-02×1 | 0/0 / 0 | 9 · 2 · 0 / 0 / 2 / 0 / 17 |
| 2026-10-05 | todo | lokal | 9 | ollama/qwen3.8:27b-nvfp4 | 533dc29 · 511714e | srr+pdr | 10 · 3 | 2.4 / 21.0 | 6 | 6 / 41 | 17 / 6 | 0 / 0 | 5 / 10 | 71 · 119 | 0 | R-18×12 IO-02×1 STRUCT×1 R-01×1 | 0/0 / 0 | 10 · 1 · 0 / 0 / 7 / 3 / 16 |

Reihe vom 2026-10-04 mit der alten Ende-Regel (Schnitt am ersten Analyse-Vorschlag): [messung-interaktiv-2026-10-04.md](../../docs/archive/messung-interaktiv-2026-10-04.md).
