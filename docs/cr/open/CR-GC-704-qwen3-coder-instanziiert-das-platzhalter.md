# CR-GC-704: qwen3-coder instanziiert das Platzhalter-Vorbild von UC-02 nicht: S2 gcrun-333..335 (nach CR-GC-703) uebernimmt FLOW/SCHEMA/FUNC-beispiel-* woertlich 4-8x je Lauf, Preflight blockt jedes Mal, die Runden verfallen; Kandidat: Skelett-uids aus dem UC des Funds vorbelegen, Modell schreibt nur Texte

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-625 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-625.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Umfang

`FUNC-generation-step` (`src/loop/generate.ts`: `RULE_CLAUSE` UC-02, Aufruf in `stepCore`),
`tests/generate.test.ts`. 2 Dateien.

## Ergebnis

- Klauseln bekommen den Bestand (`og`) mit. UC-02 rendert je UC ein Skelett mit festen uids aus dem
  UC-Namen (`FLOW-<uc>-eingabe`, `SCHEMA-<uc>-eingabe`, `FUNC-<uc>-annehmen`); FCHAIN und ACTOR aus dem
  Bestand (UC compose FCHAIN; vorhandene ACTORs, bei mehreren zur Wahl), fehlt die FCHAIN, wird sie
  angelegt und an den UC gehaengt. Das Modell ersetzt nur die Platzhalter «… A» in den Texten —
  uebernommen blockt sie der Preflight weiter (CR-GC-672).
- Der Waechter aus CR-GC-703 erlaubt neben `beispiel` die aus dem Fund abgeleiteten uids.

## Akzeptanz

- [x] Rot zuerst: „UC-02 gibt die Skelett-uids je UC vor".
- [x] Betroffene Tests 153/153 (generate, rig-verhalten, preflight, channel-rank, skill-rule-ids,
      graph-Auswahl); `tsc` sauber.
- [ ] Im Lauf: PREFLIGHT-VORBILD-Blocks je Lauf (vorher 5–8) — S2-Runde mit 40 Runden, gleich im Anschluss.
