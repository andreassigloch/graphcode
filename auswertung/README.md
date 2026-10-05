# auswertung/ — rechnet über die Artefakte eines Laufs

Das Rig (`rig/`) fährt Läufe und hinterlässt je Lauf ein Verzeichnis; hier wird daraus gerechnet. Jede Analyse
ist ein Modul mit einer Funktion `Lauf → Teil-Datensatz`; der Runner fügt die Teile zu **einem** Datensatz je
Lauf, hängt ihn an [`docs/messung/benchmark.jsonl`](../docs/messung/benchmark.jsonl) (Schlüssel `aufgabe/arm-nr`,
erneutes Auswerten ersetzt die Zeile) und erzeugt [`docs/messung/benchmark.md`](../docs/messung/benchmark.md)
neu. Konzept: [`docs/graphcode_messaufbau_konzept.md`](../docs/graphcode_messaufbau_konzept.md).

```
node auswertung/auswerten.mjs [lauf-dir …] [--analysen=kennzahlen,verhalten,schatten,blindurteil] [--nur-md]
node auswertung/blindurteil.mjs vorbereiten <ziel-dir> <lauf-dir> …   ·   auswerten <ziel-dir>
```

Ohne Lauf-Verzeichnisse: alle abgeschlossenen Läufe mit Stand unter `rig/runs/`. Ohne `--analysen`: **alle**
(im Zweifel alles). Deterministisch bis auf das Blindurteil, das einen Gutachter braucht.

| Analyse | Frage | Eingang | Test |
|---|---|---|---|
| `kennzahlen` | Wie lief es: Züge, Sitzungen, Dauer je Zug, Fragen in Zug 1, Schritte, Mutationen + / −, Abbrüche, Zug an dem SRR bzw. PDR fiel, Umfang | `lauf.json` | T-E3 |
| `verhalten` | Gate-Ablehnungen je Regel, mitgenommene Warnungen, Dubletten, Struktur gegen den Referenzlauf der Aufgabe, REQ-Prüfungen | `audit.jsonl`, `graph.json`, `rig/aufgaben/<name>/referenz/<arm>/graph.json` | T-E11, T-V5 |
| `schatten` | Was hätte `graph_suggest` je Zug vorgeschlagen — und traf der Agent es? | `audit.jsonl`, nachgespielt | T-M5 |
| `blindurteil` | Deckt die Spec den Auftrag, ohne offene Werte zu erfinden? (ein Gutachter je Spec) | `graph.json`, Raster und Auftrag der Aufgabe | T-E10 |
| `nachspielen` | Graph und Readiness nach n Mutationen, durchs echte Gate eines Wegwerf-Stores | `audit.jsonl` | Grundlage (auch für das Ende-Urteil des Treibers) |

**Blindurteil in zwei Schritten.** `vorbereiten` legt je Lauf eine anonyme Spec (`spec-<K>.md`), die
Gutachter-Vorgabe (`gutachter-<K>.txt`), Raster und Auftrag der Aufgabe ins Ziel (`rig/runs/<aufgabe>/blind-<name>/`
ist der Ort, dann findet `auswerten.mjs` sie). Je Spec startet ein Gutachter (eine Claude-Sitzung mit der Vorgabe);
`auswerten` liest die Gutachten. Der Runner nimmt das jüngste Gutachten eines Laufs in seinen Datensatz.

**Was nicht gerechnet wird:** Bedarfsanalyse (T-E9) und Turn-Bilanz (T-E5) — der Treiber speichert den rohen
Strom je Zug nicht (ITEM-2026-745). Die Auswertungen der Executor-Zeit stehen unter `docs/archive/`.

Herkunft: `rig/interaktiv/auswertung.mjs` (CR-GC-715) und `rig/greenfield-systemtest/{verhalten,schatten-suggest,
blindurteil,spec-render}.mjs` (CR-GC-609/682), hierher mit CR-GC-739; Executor-Eingänge entfallen.
