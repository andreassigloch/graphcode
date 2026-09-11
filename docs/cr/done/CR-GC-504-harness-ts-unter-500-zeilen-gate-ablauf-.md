# CR-GC-504: harness.ts unter 500 Zeilen: Gate-Ablauf herausloesen

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-038 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-038.json (Lane: code)

---

BEFUND (2026-09-11, nach CR-GC-503): src/kernel/harness.ts hat 607 Zeilen (vorher 816), Ziel der Familie < 500. Der Graph-Zustand liegt jetzt in graph-store.ts, applyCommands in apply-commands.ts. Groesster verbleibender Block ist der Gate-Ablauf applyMutation (~170 Zeilen: Schema-Pruefung, Hooks, Delta-Regeln, Typ-Guard, Advisories). VORSCHLAG: das Gate in src/kernel/gate.ts herausloesen, harness.ts bleibt Fassade (Konfiguration, Lese-Abfragen, Serialisierung O3). Eigene CR, weil CR-GC-503 sonst die 6-Dateien-Grenze reisst. Verwandt ITEM-2026-027 (grosse Dateien).

---

## Umsetzung (2026-09-11)

Code:
- `src/kernel/gate.ts` (neu, 256 Zeilen): `Gate.apply` (bisher `applyMutation`), `Gate.evaluate` (bisher `runRules`), der Typ-Guard vor dem Persistieren, `GatedViolation`, `violationKey`. Das Gate hält keinen Zustand; es liest die Arbeitskopie beim GraphStore und übergibt ihm angenommene Kandidaten.
- `src/kernel/harness.ts`: Fassade — Konfiguration, Lese-Abfragen, Schreib-Serialisierung (O3), `mutate` → `gate.apply`, `evaluateRules` → `gate.evaluate`. **607 → 395 Zeilen.**

Umgesetzt per Skript mit exakten Ankern: die drei Blöcke wurden wörtlich verschoben, nur die Verweise auf Abhängigkeiten umgestellt (`this.hooks` → `this.deps.hooks` usw.); ein unaufgelöster Verweis hätte abgebrochen. Keine Verhaltensänderung.

Modell: `FUNC-mutate` realRef → `gate.ts::apply`, `FUNC-evaluate-rules` → `gate.ts::evaluate`.
- Veraltete Verweise nachgezogen: Kommentare in `src/loop/suggest.ts`, `src/kernel/harness-import.ts` und `scripts/spike-nachweis-history.mjs` nennen `Gate.apply` bzw. `gate.ts` statt `applyMutation`/`runRules`.

## Tests

- Build grün.
- Auswahl (Gate, eine Schreibtür, Store, Import-Grenzen, Fit-Advisory, Mutate-Eingabe, OCC, Merge, Bootstrap, Import-Invariante, Reseed, Rewind, Store-Lock, Host-Shim, import-code-Verb): 15 Dateien, 98 von 98 grün.
- Ganze Suite: 1074 von 1080 grün. Die 6 roten sind dieselben wie vor dieser CR und auch ohne sie rot (CR-GC-502: contracts 20 → ITEM-2026-036, Zählwerte, Perf-Spike → ITEM-2026-037).
- Kongruenz (`graph_readiness`): 0 Fehler, Befunde unverändert gegenüber CR-GC-503, Importabdeckung 83/84 (`gate.ts` zugeordnet, `src/index.ts` offen wie zuvor).
