# CR-GC-549: Zugverlauf — die Messbasis aus dem Log rekonstruieren

**Status:** ✅ Done (2026-09-18)
**Erstellt:** 2026-09-18
**Item:** ITEM-2026-226 (Kennzahlen-Recorder), erweitert um den gemessenen Befund aus dem ersten Fremdlauf

---

## Befund

`kennzahlen.mjs` (CR-GC-546/548) ist repo-portabel — die Null-Zeile eines fremden Projekts lässt
sich ziehen. Es fehlt nicht die Portabilität, es fehlt der Auslöser: das Skript braucht einen
Menschen, der es aufruft. Gemessen am ersten Fremdlauf (sigllm, 2026-09-17/18): **138
Graphversionen, eine Zeile.** Ein Verlauf, den jemand von Hand auslösen muss, ist keiner.

Zweiter Befund aus demselben Log: die `violations` am Audit-Datensatz sind **stapelbezogen**, nicht
graphbezogen. Sie nennen, was dieser Stapel auslöste — nicht, was der Graph trägt. Gemessen bei
sigllm v101: letzter Gate-Befund E1/W0, voller Katalog **16 error / 219 warning**. In **53 von 129**
angewendeten Zügen meldete das Gate E=0, während das Modell durchgehend 16 FM-03-Fehler trug.

## Was gebaut wird

`scripts/zugverlauf.mjs` rekonstruiert den Verlauf aus `.graphcode/audit.jsonl`. Möglich ist das,
weil CR-GC-234 jeden Stapel MIT seinen Kommandos schreibt — der Graph ist an jeder Version
wiederherstellbar. Kein zweiter Rechenweg: derselbe Applier wie im Gate (`applyCommands`), dieselbe
Projektion wie in der Konformanz (`toOntologyGraph`), derselbe Katalog wie `rules_evaluate`
(`evaluateAllRules`), dieselbe Metrik wie im Optimizer (`metrics`).

Je Zug: Knoten/Kanten, ℝ⁶(arch), Steuerung + dominanter Term, **Stand-E/W** (voller Katalog nach dem
Zug) neben **Gate-E/W** (was das Gate zum Stapel sagte), Konsultation, editSource, Auslöser.
Über den Lauf: Waste, Sichtbarkeit, Nutzungsraten, Architekturweg.

**Die Selbstprüfung läuft im Schreibpfad mit, nicht nur auf `--verify`.** Ein Versionszähler, der bei
0 weiterläuft, obwohl der Graph schon Knoten hatte, macht jede Vorzustands-Schranke zu einem falschen
Grün. Das Ergebnis steht deshalb im Kopf der erzeugten Datei — geprüft, nicht prüfbar oder Abweichung.

## Abgrenzung zu `kennzahlen.md`

Kein Parallelpfad. `kennzahlen.md` trägt Meilensteinzeilen MIT Quellcode-Bindung (Reichweite,
Grenzmenge) — die braucht den laufenden Host und den Quellbaum zum Zeitpunkt der Messung.
`zugverlauf.md` trägt den Modellweg, den das Log allein hergibt, ohne Host und rückwirkend.
Der Kopf beider Dateien nennt die Grenze.

## Umfang

| Datei | Zug |
|---|---|
| `scripts/zugverlauf.mjs` | neu — Rechenkern (exportiert) + CLI |
| `tests/zugverlauf.replay.test.ts` | neu — Replay, Stand-vs-Gate-Trennung, Nutzungsraten, Schranke, Abweichungserkennung |
| `docs/cr/open/CR-GC-549-…md` | diese CR |

## Akzeptanzkriterien

- [x] Replay gegen einen echten Snapshot beweisbar identisch — sigllm v101: 278 Knoten / 559 Kanten, keine Abweichung
- [x] Abgelehnte Stapel bewegen den Zustand nicht (Test: Geisterknoten entsteht nie)
- [x] Stand des Graphen und Gate-Befund getrennt ausgewiesen
- [x] `[]` (gemessen leer) und `null` (nicht erfasst) bleiben unterscheidbar
- [x] Ein Log, das nicht auf dem leeren Graphen aufsetzt, wird abgewiesen statt geraten
- [x] Abweichung gegen den Snapshot wird im Kopf der Datei benannt, nicht geschönt (graphcode selbst: 682 statt 773 Knoten, ausgewiesen)
- [x] Tests grün (5/5), Feldprüfung an zwei Repos gelaufen

## Folgebefunde (gehen als Items, nicht in diese CR)

1. `evaluateAllRules` liefert `rule_id`/`element_id`, das Gate `ruleId`/`elementId` — zwei Formen für dasselbe Feld.
2. `fixFor` traf über den ganzen sigllm-Lauf **2 von 1069** Gate-Befunden (0,2 %); am Endstand **0 von 246**.
3. R-18 trägt zwei Befundquellen unter einer Kennung: 8 aus dem Katalog (mit `candidate_targets`, vorlagenfähig), 48 aus der Schreibpfad-Grammatik (ohne `context`, per Konstruktion vorlagenblind) — und genau die 48 verursachten die Ablehnungen.
4. ℝ⁶(arch) bewegte sich in **22 von 130** angewendeten Zügen; ab v93 gar nicht mehr, weil die Arch-Schicht bei 94 Knoten stehenblieb, während das Modell auf 284 wuchs.
5. Die Steuerung (`STEER_RULES`, 5 Regeln) änderte sich in 129 Zügen **einmal**.
