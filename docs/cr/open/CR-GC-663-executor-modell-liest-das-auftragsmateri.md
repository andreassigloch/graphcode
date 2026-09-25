# CR-GC-663: Executor: Modell liest das Auftragsmaterial jede Runde neu — der Treiber vergisst gelesenes Material

**Status:** ⛔ Zurueckgenommen nach Messung
**Typ:** aus Item ITEM-2026-566 (finding)
**Erstellt:** 2026-09-25
**Item:** bok/items/ITEM-2026-566.json (Lane: code)

---

## Befund

Argument-Trace gcrun-120..122: qwen3-coder liest `material/auftrag.md` (4.844 Zeichen) in 11–12 von
12 Runden neu, je als eigener Aufruf. Die Runde wird absichtlich frisch aufgebaut (CR-GC-614), der
Zugvermerk traegt nur Zuege. Die meisten Runden brauchen deshalb 3 Aufrufe.

## Umsetzung

`materialvermerk` in `zugvermerk.ts`: was das Modell per `read_file` gelesen hat, reicht der Treiber in
jede folgende Runde mit — benannt („BEREITS GELESENES MATERIAL"), gedeckelt (6.000 Zeichen, Kopf und
Hinweise eingerechnet), Kuerzung angesagt. `executor.ts` merkt sich erfolgreiche `read_file`-Ergebnisse
(Werkzeugaufruf und geborgener Text-Aufruf). Eine bewusste, begrenzte Ausnahme von „zwischen zwei Zuegen
reist nichts mit" — der uebrige Verlauf reist weiter nicht (im selben Test geprueft).

## Dateien (4)

`src/loop/zugvermerk.ts`, `src/loop/executor.ts`, `tests/zugvermerk.test.ts`, diese Datei.

## Akzeptanzkriterien

- [x] Leer ohne Gelesenes; Kopf/Pfad/Inhalt; Grenze gehalten und angesagt.
- [x] Am echten Loop: Runde 1 gelesen → Runde 2 im Auftrag; der uebrige Verlauf nicht.
- [x] Rig — Ziel verfehlt, zurueckgenommen: (gcrun, N=3) gegen gcrun-120..122: `read_file` je Lauf deutlich unter 11, Aufrufe je Runde
      sinken, Elemente/Readiness nicht schlechter. Gemeinsam mit CR-GC-664 (anderer Zaehler).

## Rig-Messung und Entscheidung (2026-09-25, `results-runde19-gcrun-663-664.json`, gcrun-140..142)

Gemeinsam gemessen mit CR-GC-664:

| | 660+661 | 663+664 |
|---|---:|---:|
| `read_file material/auftrag.md` (3 Laeufe) | 35 | 32 |
| `graph_elements {type:UC}` (3 Laeufe) | 32 | 33 |
| Aufrufe je Runde | 3,3–4,0 | 3,3–3,8 |
| Tokens ein / Laufzeit | 197k / 215 s | **272k / 305 s** |
| Readiness req / uc | .83 / .80 | .89 / .88 |

**Ziel verfehlt, zurueckgenommen.** Das Modell liest den Auftrag und fragt die UCs auch dann ab, wenn
beides im Prompt steht — kein Informationsmangel, eine Gewohnheit (vgl. CR-GC-653: Hinweise aendern
das Verhalten nicht). Der mitgegebene Auftrag kostet dafuer 4,8k Zeichen in jedem Aufruf (+38 %
Eingabe). Die hoehere Readiness liegt im Bereich, den schon 658/659 erreichte (.89/.85), und ist
diesen CRs nicht zuzuschreiben. Code auf den Stand vor `8b7ea5a` zurueckgesetzt.
