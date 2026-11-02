# CR-GC-886: graphcode init --help fuehrt init aus (2026-10-01, im graphcode-Repo selbst): unbekannte Flags werden verworfen; init schrieb .mcp.json auf node_modules/@sigloch/graphcode um, trug graphcode als eigene Abhaengigkeit in package.json ein und legte opencode.json, GRAPHCODE.md, GRAPHCODE-STEERING.md, .opencode/skills an. Ein unbekanntes Flag muss abbrechen, --help muss Hilfe zeigen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-702 (bug)
**Erstellt:** 2026-11-02
**Item:** bok/items/ITEM-2026-702.json (Lane: graph)

---


---

## Befund

`cli.ts` las je Verb nur die Flags, die es kannte, und warf den Rest weg. `--help` fuehrte das Verb
deshalb wirklich aus:

- 2026-10-01: `init --help` im graphcode-Repo (ITEM-2026-702).
- 2026-10-23: `init --help` in siglochimmo (ITEM-2026-1045, Dublette).
- 2026-11-02: `upgrade --help` in graph-view-edit: Artefakte geschrieben, `dependencies` veraendert, Host beendet.

## Umsetzung

- `src/surface/cli-args.ts`: `checkVerbArgs` kennt je Verb Flags, Wert-Flags und Positionsargumente.
- `src/cli.ts`: die Pruefung laeuft vor jedem Verb. `--help` und `-h` zeigen die Hilfe, alles Unbekannte endet mit Exit 1.

## Akzeptanz

- [x] `--help` und `-h` zeigen bei jedem Verb die Hilfe und fuehren nichts aus.
- [x] Ein unbekanntes Flag, ein ueberzaehliges Argument oder ein Flag ohne Wert bricht mit Exit 1 ab.
- [x] Die dokumentierten Aufrufe laufen weiter, auch `upgrade --refresh-only` aus dem Re-Exec.
- [x] Der gebaute Einstieg legt bei `init --help` in einem Temp-Repo keine Datei an.

Test: `tests/cli-args.test.ts`.
