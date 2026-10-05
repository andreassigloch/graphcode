# Messung: FMEA über den Executor, qwen3-coder gegen qwen3.8 medium

Stempel: code graphcode `f427c58` (CR-GC-724) plus Stempel-Filter aus CR-GC-725, contracts-Arbeitskopie `6a3b525` ·
2026-10-01 · je Modell **ein** Lauf.
Aufbau: `graphcode run --task fmea` auf dem Kern von `local-1` (43 Elemente, 3 Wirkketten) ohne Analyse-Stempel,
über das sigllm-Gateway, höchstens 5 Runden, 4096 Antwort-Token. Daten: Scratchpad `arme/` (nicht im Repo).

| | qwen3-coder-30b | qwen3.8-27b, `reasoning_effort: medium` |
|---|---:|---:|
| Laufzeit | 81 s | 437 s |
| Modell-Aufrufe · abgelehnte Züge | 17 · 1 | 5 · 0 |
| Token ein · aus | 78,9 k · 5,7 k | 12,4 k · 7,1 k |
| Risiko-REQ mit Gegenmaßnahme und Test | 3 (je Kette eine) | 3 (je Kette eine) |
| Stempel vom Executor | nach Runde 1 | nach Runde 1 |

## Inhalt

- **qwen3-coder** füllt das Vorbild aus: „Fehler bei Commit-Analyse“, „Fehler bei täglicher Zusammenfassung“,
  „Fehler bei Notes-Export“; Gegenmaßnahme jeweils „Fehlerbehandlung bei …“. Die Guillemets des Vorbilds stehen im Text.
  Kein Fehlermodus sagt, was schiefgeht.
- **qwen3.8 medium** nennt Fehlermodi mit Wirkung: Commits landen durch Zeitzonen-Versatz am falschen Kalendertag;
  die Zusammenfassung nennt Tätigkeiten, die kein Commit belegt; aus Commit-Abständen wird eine unrealistische
  Arbeitszeit. Gegenmaßnahmen und Tests sind konkret (Konversion in die lokale Zeitzone; jede Aussage an einen
  Commit-Hash binden; Test mit Commit in UTC und UTC+2).

## Befunde

1. **Der Weg trägt.** Beide Modelle bringen die FMEA in einer Runde ins Modell; der Executor stempelt erst danach.
2. **Vier von fünf Runden waren Leerlauf.** Nach dem Stempel steht FM-03 im Fokus (Risiko mit hoher Priorität ohne
   bestandenen Testlauf). Das lässt sich im Modell nicht lösen; beide Modelle legten weitere TESTs an. Bei qwen3.8
   sind das rund 350 der 437 s.
3. **Je Runde:** qwen3.8 medium rund 85 s, qwen3-coder rund 15 s.
4. **`reasoning_effort: high` gibt es nicht** — das Modell kennt `xhigh`, `medium`, `low`; `high` endet als HTTP 500.
   In einer Einzelmessung am selben Prompt lagen `low` (73 s) und `medium` (84 s) dicht beieinander.

Nicht gemessen: `xhigh` auf diesem Aufbau, andere Analysen als die FMEA, der Kern-Aufbau mit medium, N > 1.
Befunde 2 und 4 und die Platzhalter-Übernahme: ITEM-2026-696.
