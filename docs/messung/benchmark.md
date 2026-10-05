# Benchmark des Rigs

> GENERIERT von `node auswertung/auswerten.mjs` — nicht von Hand bearbeiten. Datensätze: [`benchmark.jsonl`](benchmark.jsonl)
> (eine Zeile je Lauf, Rohdaten entbehrlich, sobald die Zeile steht). Rig: [`rig/README.md`](../../rig/README.md), Analysen:
> [`auswertung/README.md`](../../auswertung/README.md). Ein Lauf endet, wenn die Readiness SRR und PDR als bestanden meldet.
> Die Deutung (T-E3 erfüllt oder nicht) steht in der Leitlinie, nicht hier.

## Stand — je Aufgabe × Arm die jüngste Serie

| Aufgabe | Arm | Modell | Stand (code · vorlage) | N | Züge | Sitzungen | Dauer je Zug Median (min) | Fragen Zug 1 | Mutationen + / − | PDR nach Zug | Dubletten | Blindurteil P ✓ · ~ · ✗ / O offen / erfunden / Dubl. / Noten |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| todo | frontier | claude-opus-5-5 | 8c498e8 · 511714e | 3 | 11 | 6–7 | 0.7–0.8 | 5–7 | 11–12 / 1 | 11 | 1–5 | 11 · 0 · 0 / 3–5 / 5–6 / 3–8 / 14–19 |
| todo | lokal | ollama/qwen3.8:27b-nvfp4 | 8c498e8 · 511714e | 3 | 5–18 | 1–6 | 2.0–2.8 | 5–6 | 4–14 / 2–5 | 2–18 | 0–9 | 10–11 · 0–1 · 0 / 0–1 / 0–6 / 2–4 / 14–19 |

## Verlauf — ein Lauf je Zeile

| Datum | Aufgabe | Arm | Lauf | Modell | Stand | Ende | Züge · Sitzungen | Dauer Median / Max (min) | Fragen Zug 1 | Schritte Median / Max | Mutationen + / − | Abbrüche L / F | SRR / PDR nach Zug | Elemente · Kanten | Dubletten | Gate-Fehler je Regel | Schatten: Vorschlag getroffen / verpasst | Blindurteil |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-05 | todo | frontier | 4 | claude-opus-5-5 | 8c498e8 · 511714e | srr+pdr | 11 · 6 | 0.7 / 1.7 | 5 | 7 / 14 | 11 / 1 | 0 / 0 | 4 / 11 | 71 · 121 | 5 | R-18×6 | 0/0 / 0 | 11 · 0 · 0 / 3 / 6 / 8 / 14 |
| 2026-10-05 | todo | frontier | 5 | claude-opus-5-5 | 8c498e8 · 511714e | srr+pdr | 11 · 7 | 0.8 / 1.8 | 6 | 5 / 20 | 12 / 1 | 0 / 0 | 4 / 11 | 61 · 109 | 1 | R-18×6 | 0/0 / 0 | 11 · 0 · 0 / 4 / 5 / 3 / 19 |
| 2026-10-05 | todo | frontier | 6 | claude-opus-5-5 | 8c498e8 · 511714e | srr+pdr | 11 · 6 | 0.7 / 2.6 | 7 | 5 / 16 | 11 / 1 | 0 / 0 | 4 / 11 | 70 · 126 | 3 | R-18×6 | 0/0 / 0 | 11 · 0 · 0 / 5 / 6 / 7 / 18 |
| 2026-10-05 | todo | lokal | 4 | ollama/qwen3.8:27b-nvfp4 | 8c498e8 · 511714e | srr+pdr | 18 · 6 | 2.8 / 8.8 | 6 | 5 / 36 | 14 / 5 | 0 / 0 | 4 / 18 | 58 · 86 | 9 | R-18×8 STRUCT×3 | 0/0 / 0 | 11 · 0 · 0 / 1 / 6 / 3 / 14 |
| 2026-10-05 | todo | lokal | 5 | ollama/qwen3.8:27b-nvfp4 | 8c498e8 · 511714e | srr+pdr | 12 · 3 | 2.0 / 11.4 | 5 | 2.5 / 18 | 8 / 2 | 1 / 0 | 4 / 12 | 40 · 73 | 0 | R-18×9 | 0/0 / 0 | 10 · 1 · 0 / 0 / 2 / 4 / 15 |
| 2026-10-05 | todo | lokal | 6 | ollama/qwen3.8:27b-nvfp4 | 8c498e8 · 511714e | srr+pdr | 5 · 1 | 2.8 / 3.6 | 5 | 4 / 6 | 4 / 2 | 0 / 0 | 5 / 2 | 39 · 57 | 1 | R-18×2 IO-02×1 | 0/0 / 0 | 10 · 1 · 0 / 0 / 0 / 2 / 19 |

Reihe vom 2026-10-04 mit der alten Ende-Regel (Schnitt am ersten Analyse-Vorschlag): [messung-interaktiv-2026-10-04.md](../../docs/archive/messung-interaktiv-2026-10-04.md).
