# CR-GC-652: Element-Liste aus dem Fund-Kontext statt Typfilter — gerichteter Weg zum Besitzer und seiner Realisierung

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-550 (finding)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-550.json (Lane: code)

---

## Befund

Die Element-Liste des Executors (Kanal `inventory`) filterte nur nach Typ: die ersten 100 je
Fokus-Typ, reihum, gedeckelt. Ob der gesuchte Partner der fehlenden Kante darin stand, entschied
das Alphabet. Gemessen an fuenf RD-01-Funden des eigenen Modells (REQ ohne Erfueller):

| Zuschnitt | Knoten | Zeichen | trifft den Erfueller? |
|---|---:|---:|---|
| Typfilter (bis hier) | ~100 | 6.244 | zufaellig |
| Nachbarschaft Tiefe 2, ungerichtet (Blast-Radius-Prinzip) | 90 | 5.837 | nein — 77 REQ, Hub-Fan-out ueber SYS/UC |
| Nachbarschaft Tiefe 3 | 284 | 17.146 | nur weil fast alles drin ist |
| `candidate_targets` der Engine | 155 je Fund | 8.024 | kein Schnitt — alle legalen Quellen, lexikalisch sortiert |
| **gerichtet entlang der Ontologie** | **39** | **1.986** | **ja, wo ein Besitzer existiert** |

Warum nicht der Blast-Radius: `graph_impact` beantwortet „wer haengt an X". Ein Fund ist fast
immer eine FEHLENDE Kante — gefragt ist, wer an X haengen SOLLTE. Der gesuchte Partner steht per
Definition nicht in der Nachbarschaft.

Rig-Grundlinie (3 Laeufe gcrun, Stand vor CR-GC-649): das Modell ruft trotz Liste im Prompt
`graph_elements` 85–355-mal je Lauf, `graph_get_node` 11–44-mal.

## Umsetzung

- `src/loop/fund-kontext.ts` (neu, rein): vom Fund ueber `compose` HINAUF bis zum Besitzer (UC oder
  SYS; ist der Fund selbst einer, nicht weiter), dann HINUNTER durch den Realisierungsbaum
  (`compose`/`allocate` nur zu FCHAIN/FUNC/MOD/SYS — nie zu UC/REQ, das waere der Hub-Fan-out).
  Gefiltert auf die Fokus-Typen der Runde.
- **Kein Rueckfall** (Entscheidung Auftraggeber 2026-09-24): ein Fund ohne Besitzer bekommt keine
  Ersatzliste, sondern den Satz „Kein Besitzer im Modell fuer: …" — der fehlende Besitzer ist selbst
  ein Befund.
- `GenerationStep.focusElements` (neu, optional): die Fund-uids als Feld, statt sie aus dem
  `focusKey` zu schneiden. Nur in expand gesetzt; der Host-`next` traegt es nicht.
- `src/loop/executor-inventory.ts` (neu): der Inventar-Kanal, aus `executor-prompt.ts` geschnitten
  (die Datei laege sonst ueber 500 Zeilen). Mit Fund → Fund-Kontext; ohne Fund (seed, Task-Einstieg)
  → der bisherige Typ-Pfad, unveraendert. Beide teilen EINE Kappe.

## Nachgemessen (dieselbe Runde)

Element-Liste 6.244 → **2.657 Zeichen**; erster Turn gesamt 13.836 → ~10.250 (nach CR-GC-651).
Inhalt: die FCHAINs und FUNCs der Szenarien, unter denen die REQs haengen, und die Module.

## Umfang laut Graph

`CR-GC-652 -relation-> FUNC-build-round-injection, FUNC-generation-step, SCHEMA-generation-step`,
neuer Knoten `FUNC-fund-kontext`.

## Dateien (9)

`src/loop/fund-kontext.ts` (neu), `src/loop/executor-inventory.ts` (neu), `src/loop/executor-prompt.ts`,
`src/loop/generate.ts`, `tests/fund-kontext.test.ts` (neu), `tests/executor.test.ts`, plus Modell
(`docs/graph`, Sichten) und diese Datei.

## Akzeptanzkriterien

- [x] Weg-Faelle: REQ unter UC, REQ am SYS (Modulbaum, kein UC), REQ unter REQ, Fund = Besitzer
      (kein Aufstieg), Waise (`ohneBesitzer`, keine Ersatzliste), Vereinigung, Typfilter (7 Faelle).
- [x] Echter Store: Fund am SYS bekommt MOD/SYS, keinen UC; Waise → „Kein Besitzer im Modell".
- [x] Seed ohne Fund: Typ-Pfad unveraendert (bestehende Budget-Tests gruen).
- [ ] **Rig-Abnahme — NICHT bestanden (2026-09-24).** `results-runde19-gcrun-652.json` gegen
      `-nach` (CR-GC-650/651), gcrun, sigllm-gcrun, qwen3-coder-30b, N=3:

      | Mittel je Lauf | nachher (650+651) | + CR-GC-652 |
      |---|---:|---:|
      | Elemente | 50,7 | 44,0 (51/35/46) |
      | Gate-Ablehnungen | 3,0 | 3,0 |
      | Tokens ein / aus | 210k / 9,1k | 174k / 8,2k |
      | Laufzeit | 186 s | 202 s |
      | Lese-Aufrufe des Modells | 106 | **127 (+20 %)** |
      | davon graph_elements / get_node / Guide | 59 / 44 / 3 | 63 / 50 / 5 |

      Nach dem vorher festgelegten Kipp-Kriterium verfehlt: die Liste spart Prompt (−17 % Eingabe),
      senkt die Nachfragen des Modells aber nicht — `graph_elements` bleibt bei ~60 je Lauf, gleich
      ob die Liste nach Typ oder nach Kontext geschnitten ist. Die Nachfragen haengen damit offenbar
      nicht am Inhalt der Liste. WAS das Modell sucht, ist nicht messbar: die Trace protokolliert
      Werkzeugnamen, keine Argumente. N=3 ist fuer die Elementzahl zu klein.

      **Stand:** Code und Modell sind auf master (vorgespult vor Ende der Messung). Der CR bleibt
      offen bis zur Entscheidung: Argumente in die Trace, erneut messen — oder zuruecknehmen.

## Nicht in diesem CR

ITEM-2026-551: bei UC-01 liefert der Skill-Kanal `se:author-uc`, die Klausel verlangt REQs.

## Nachmessung mit Argumenten (2026-09-24, `results-runde19-gcrun-652-args.json`, gcrun-40..42)

Seit `1bfa8b6` schreibt der Executor je Lese-Aufruf Werkzeug, Argumente, Antwortgroesse und Art in
die Trace. Drei Laeufe, 416 Lese-Aufrufe (Elemente 26/51/64, Ablehnungen 1/1/5):

| Was das Modell nachschlaegt | Aufrufe | Antwort |
|---|---:|---|
| `graph_elements {type, search:<Begriff>}` — Duplikat-Pruefung vor dem Anlegen | ~90 | fast alle leer |
| `graph_elements {type}` — Uebersicht je Typ (SYS 27, REQ 27, FCHAIN 22, UC 20, FUNC 11, MOD 8, ACTOR 6) | 121 | gefuellt |
| `graph_elements {type:"SCHEMA"}` — Jargon-Pruefung, woertlich vom Skill `author-uc` verlangt | 22 | **alle 22 leer** |
| `graph_get_node` — 52 verschiedene uids, v. a. SYS (17×) und eben selbst angelegte UC/FCHAIN | 127 | gefuellt |
| `read_file` (Auftrag), `graph_authoring_guide`, `list_dir`, `grep` | 61 | — |

Keine Antwort war ein Fehler oder gekappt. Das Modell fragt also nicht nach, weil eine Antwort
unbrauchbar war, sondern aus drei Gewohnheiten, die der Prompt selbst erzeugt:

1. **Duplikat-Vorpruefung.** SYSTEM und Liste sagen „keine Duplikate anlegen" — das Modell sucht
   deshalb vor jedem Anlegen per Stichwort. Dieselbe Pruefung macht der Treiber ohnehin beim
   Einreichen (`duplicateHits`, CR-GC-287) und meldet sie im Feedback. Moeglicher Zusammenhang mit
   dieser CR: die Fund-Liste zeigt nur den Kontext, nicht mehr alle REQs — wer den Rest nicht sieht,
   sucht. Belegbar ist das nicht: die Laeufe davor haben keine Argumente protokolliert.
2. **Der injizierte Skill `author-uc`** verlangt die SCHEMA-Abfrage fuer die Jargon-Regel — im
   Greenfield-Korpus gibt es keine SCHEMAs, 22 von 22 leer.
3. **Wiederlesen** des SYS (die Intention steht schon im Auftrag) und eigener, eben angelegter Knoten.

