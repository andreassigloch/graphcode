# CR-GC-702: arch-Phase fordert 2 alternative Zerlegungen, bei candidates=1 landen beide: decompose-n-altM-Kaskade

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-610 (bug)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-610.json (Lane: code)

---

Gemessen 2026-09-27 (CR-GC-682-Verhaltensanalyse): der Phasenauftrag 'arch' in src/loop/generate.ts:285 sagt 'Schlage je Fund 2 alternative FUNC/FCHAIN-Zerlegungen vor ... Lass das Gate waehlen.' Das Gate waehlt nur im Best-of-N-Pfad (candidates>1, dryRun-Proben). Mit candidates=1 (Default, alle Rig-Laeufe) wendet das Modell beide Alternativen direkt an und im naechsten Zug Alternativen der Alternativen: gcrun-310 legt FUNC-offline-operation-accept-decompose-1..7, dann -alt1..alt6, dann -alt2-alt1 an; 35 von 49 REQ sind Dubletten. Der Preflight-Hinweis 'aehnlich vorhanden 78 %' blockiert nicht und wird ignoriert. Dasselbe Muster in 'alloc' (generate.ts:286: '2 Alternativen, der Steuerwert entscheidet'). Fix-Richtung: Phasentext haengt an config.candidates — bei 1 genau EINE Zerlegung verlangen.

---

## Umfang

`FUNC-generation-step` (`src/loop/generate.ts`); `graph_tests` waehlt 4 Dateien (34/34 gruen).
Die Datei, die die Vorschlagstexte prueft (`tests/generate.test.ts`), ist NICHT an den Knoten
gebunden — die Auswahl haette die Aenderung nicht getestet. 2 Dateien: `src/loop/generate.ts`,
`tests/generate.test.ts`.

## Ergebnis

Die Ursache liegt tiefer als `candidates`: im Treiber-Modus wendet der Treiber den GANZEN Batch
an, Alternativen entstehen dort nur ueber N Stichproben (Best-of-N). „2 Alternativen" in einem
Batch ist im Treiber also immer falsch, auch bei candidates > 1. Neu: `EIN_BATCH` (Treiber-Fassung
fuer `arch`, `alloc`) und `vorschlagsText(dimension, selection)`; der Host-Text bleibt — dort probt
das Modell selbst per dryRun.

## Akzeptanz

- [x] Rot zuerst: „'driver' verlangt je Dimension EINE Loesung" — ueber ALLE Dimensionen, kein
      Treiber-Text nennt Alternativen.
- [x] `generate`, `channel-rank`, `skill-rule-ids` 84/84; graph-Auswahl 34/34; `tsc` sauber.
- [x] Fokus-Typen-Waechter prueft auch die Treiber-Texte.
- [ ] Wirkung im Lauf (Dubletten-Rate arch) — mit der naechsten S2-Runde (T-SYS/Messwelle).
- Befund nebenbei: `tests/generate.test.ts` traegt keinen testRef an `FUNC-generation-step`.
