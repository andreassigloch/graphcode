# CR-GC-739: auswertung/: konfigurierbarer Runner über Lauf-Artefakte, benchmark.jsonl als Gedächtnis, benchmark.md generiert

**Status:** ✅ Done (2026-10-05)
**Typ:** aus Item ITEM-2026-742 (idea)
**Erstellt:** 2026-10-05
**Item:** bok/items/ITEM-2026-742.json (Lane: code)

---

CR 3 von 5 des Konzepts [`docs/graphcode_messaufbau_konzept.md`](../../graphcode_messaufbau_konzept.md).

## Befund

Gerechnet wurde an drei Stellen mit drei Ausgängen: `rig/interaktiv/auswertung.mjs` schrieb Kennzahlen als
Markdown-Zeile direkt in `docs/messung/interaktiv.md` (Spalten fest, alte Zeilen nicht nachrechenbar);
`rig/greenfield-systemtest/{verhalten,schatten-suggest,blindurteil}.mjs` rechneten über Executor-Artefakte
(`run-raw.log`, `results.json`, fest verdrahtetes sigllm-Raster) und hingen am gelöschten Rig; der Treiber
rechnete selbst (Nachbau, Zeile). Ein Lauf ohne Zeile war nicht gemessen, eine neue Spalte brach die Tabelle.

## Umsetzung

- `auswertung/` mit einem Modul je Analyse (`Lauf → Teil-Datensatz`): `kennzahlen` (+ Zug, in dem SRR/PDR fiel,
  Sitzungen), `verhalten` (Ablehnungen je Regel, Warnungen, Dubletten, Struktur gegen den Referenzlauf der Aufgabe,
  REQ-Prüfungen — ohne Executor-Eingänge), `schatten-suggest` (über `nachspielen`/`openMeasured` statt
  `createHarness`), `blindurteil` + `spec-render` (Raster und Auftrag aus der Aufgabe; `blindurteilFuer` findet das
  Gutachten eines Laufs), `nachspielen` (Grundlage; auch das Ende-Urteil des Treibers).
- Runner `auswerten.mjs [lauf-dir …] [--analysen=…] [--nur-md]`: ohne Angabe alle Läufe mit Stand, alle Analysen
  (Entscheid: im Zweifel alles). Ein Datensatz je Lauf → `docs/messung/benchmark.jsonl` (Upsert nach `aufgabe/arm-nr`),
  daraus `benchmark.md` generiert: je Aufgabe × Arm die jüngste Serie mit Spannen, darunter der Verlauf.
- Treiber: rechnet nur noch das Ende (`nachspielen`, `auditDelta` aus `auswertung/`), schreibt keine Zeile mehr;
  `serie` wertet am Ende selbst aus. `normieren`/`bisErsteAnalyse` (Einmal-Code der Reihe 2026-10-04) gelöscht.
- `docs/messung/interaktiv.md` → `docs/archive/messung-interaktiv-2026-10-04.md` (andere Ende-Regel, nicht
  vergleichbar; Löschkonzept Regel 2), aus `benchmark.md` verlinkt.
- Referenzläufe `rig/aufgaben/todo/referenz/{lokal,frontier}/` aus der ersten Serie nach CR-GC-738 (2026-10-05,
  Stand 8c498e8 · 511714e, je Arm N = 3): **lokal-6** (5 Züge, 1 Sitzung, 39 Elemente, Blindurteil 10 · 1 · 0,
  0 erfundene Werte, Notensumme 19) und **frontier-5** (11 Züge, 7 Sitzungen, 61 Elemente, 11 · 0 · 0,
  3 Dubletten, Notensumme 19) — je Arm der Lauf mit der besten Notensumme; der Autor tauscht per
  `treiber.mjs referenz`. Ergebnis der Serie in `docs/messung/benchmark.md`.
- Stand der sechs Läufe in `lauf.json` von Hand auf `8c498e8 · 511714e` gesetzt: der Treiber lud diesen Code,
  `+dirty` kam von parallelen, nicht geladenen Änderungen an `auswertung/` (seit 8c498e8 zählen nur verfolgte Dateien)
  und von `docs/graph/` der Vorlage (seit CR-GC-739 ignoriert `vorlageStand` den Export).

## Verifikation

- `tests/auswertung.test.ts`: Kennzahlen, Verhalten (Ablehnungen, Dubletten, Struktur, Prüfungen), Blindurteil
  (vorbereiten/auswerten/finden), Schatten-Bilanz, Datensatz/Upsert/jüngste Serie/Dokument, **nachspielen** der beiden
  Referenzläufe durchs echte Gate (gleiche Element- und Kantenzahl wie `graph.json`, SRR und PDR bestanden).
- `tests/rig-interaktiv.test.ts`: `fehlendeLaeufe`, `referenzSetzen`, `aufgabeLaden`, `STUFEN`.
- Serie 2026-10-05 (3 × lokal, 3 × frontier) durchgefahren; alle sechs enden mit SRR+PDR; Auswertung über alle vier
  Analysen in `benchmark.jsonl` / `benchmark.md`; Blindurteil-Runde `rig/runs/todo/blind-serie-738` (6 Gutachter).
- `npm run verify:full CR-GC-739` (2026-10-05): 204 Dateien, 1826 Tests grün; Spur CODE, Auswahl 2/204, Schlupf 0
  (Folge ohne Schlupf 1/10). Kongruenz: kein Modellknoten für `auswertung/` — die Modellierung von Rig und Auswertung
  kommt mit dem Lösch-CR (ITEM-2026-743), der die Systemtest-Knoten ersetzt; bis dahin bewusst offen.
