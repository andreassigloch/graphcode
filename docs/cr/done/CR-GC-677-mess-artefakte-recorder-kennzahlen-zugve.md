# CR-GC-677: Mess-Artefakte: Recorder kennzahlen/zugverlauf und erledigte Spikes löschen

**Status:** ✅ Done (2026-09-26)
**Typ:** aus Item ITEM-2026-590 (finding)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-590.json (Lane: code)

---

## Befund

Zwei Recorder und drei erledigte Spikes stehen im Bestand, ohne dass jemand nach ihnen handelt:
- `scripts/kennzahlen.mjs` → `docs/kennzahlen.md`: ℝ⁶-Verlauf, seit 2026-09-16 nicht gepflegt; ℝ⁶ „taugt nicht als Fortschrittsanzeige" (T-O4).
- `scripts/zugverlauf.mjs` → `docs/zugverlauf.md/.json`: eigene Selbstprüfung seit 2026-09-18 „ABWEICHUNG" (Replay ≠ Snapshot).
- `spike-hint-konformanz` (nicht messbar), `spike-blackbox-regeln` (GO, in der Engine umgesetzt), `spike-repository-style` (M2 abgeleitet).

## Umfang (erledigt)

- Gelöscht: die fünf Skripte, `docs/kennzahlen.md`, `docs/zugverlauf.md`, `docs/zugverlauf.json` (ungetrackt), `tests/zugverlauf.replay.test.ts`.
- Bleibt: `tests/repository-style.spike.test.ts` — hängt nicht am Skript, hält in der Modell-Lane die Invariante „jeder Produzent von FLOW-graph-state hat einen Schreibpfad".
- Nachgezogen: `.gitignore` (Zugverlauf-Block, Kommentar), Leitlinie T-M2 (Aufbau), §9.5.

## Umfang laut `graph_impact`

Keine Graph-Bindung (0 `realRef`/`testRef`); nur historische CR-Beschreibungen (CR-GC-546, CR-GC-549) nennen die Pfade.

## Verifikation

`npm run type-check` grün; `verify-model.completeness` grün (kein gelöschter Test stand im Modell-Set).
