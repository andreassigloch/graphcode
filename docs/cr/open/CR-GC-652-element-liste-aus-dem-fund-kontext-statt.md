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
- [ ] **Rig-Abnahme** `results-runde19-gcrun-652.json` gegen `-nach` (CR-GC-650/651) und `-vor`.
      Kipp: mehr Lese-Aufrufe des Modells als in `-nach` = die Liste enthaelt das Falsche.

## Nicht in diesem CR

ITEM-2026-551: bei UC-01 liefert der Skill-Kanal `se:author-uc`, die Klausel verlangt REQs.
