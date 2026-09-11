# CR-GC-503: harness.ts: der Graph-Zustand hat viele Schreiber in einer Klasse

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-035 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-035.json (Lane: code)

---

BEFUND: FLOW-graph-state hat 9 Produzenten, 7 davon in src/kernel/harness.ts (816 Zeilen): loadGraph, persist, reseed, seedFromJson, mutate, close, open. Verwandt: ITEM-2026-027 (grosse Dateien).
ZIEL: Zustand und Lebenszyklus bei EINEM Besitzer, Gate und Abfrage davon getrennt, harness.ts unter 500 Zeilen. Modell: graph-state hat einen Produzenten.

---

## Umsetzung (2026-09-11)

Code (6 Dateien):
- `src/kernel/graph-store.ts` (neu): `GraphStore` besitzt Arbeitskopie und Kuzu-Store — `open` (Lock O2, Schema-Guard CR-GC-249, Laden), `load`, `current`, `commit(candidate, delta)` (erst Platte, dann Speicher; ohne Delta nur Speicher für den dryRun), `importTarget()` mit `replace`/`clear`, `close`.
- `src/kernel/apply-commands.ts` (neu): `applyCommands` als reine Funktion auf einem Kandidaten-Graphen, dazu `cloneGraph`.
- `src/kernel/harness.ts`: das Gate rechnet auf dem Kandidaten und übergibt ihn dem Store. Ein Block hat nichts mehr zurückzurollen. `graph`, `storePath`, `storeLock`, `persist`, `applyCommands` und `importTarget` sind entfernt. 816 → 607 Zeilen.
- `src/kernel/harness-import.ts`: `ImportTarget` ohne Store-Handle und ohne Setter, nur noch `replace` und `clear`.
- `scripts/spike-archetype-eigenvector.mjs`: die Kernel-Liste nennt `FUNC-graph-store` statt der vier zusammengelegten Store-FUNCs — das Skript liest das aktuelle Modell und hätte sie sonst still verloren.
- `tests/graph-store.test.ts` (neu): geblockter Batch lässt Speicher und Platte unberührt; dryRun ändert nur den Speicher; nur `graph-store.ts` schreibt den Store. Der dritte Test war gegen den alten Code rot (`harness.ts`, `harness-import.ts`).

Verhaltensänderung, bewusst: Beim Übernehmen wird erst geschrieben, dann die Arbeitskopie gesetzt. Scheitert das Schreiben, läuft der Speicher dem Store nicht mehr voraus.

Modell (Graph-Version 250 → 252):
- `FUNC-graph-store` neu; `open-store`, `load-graph`, `save-graph`, `close-store` gehen darin auf (Kanten, REQs und Ketten übernommen).
- Ein erster Zug hatte auch `reseed` in `apply-reseed` gelegt. `rewind.test.ts` (CR-GC-311) verlangt `FUNC-reseed` mit Code-Bindung, und `harness.reseed()` ist weiter ein eigener, serialisierter Einstieg: der Knoten ist mit seinen alten Kanten wiederhergestellt, nur ohne Ausgabe an `graph-state`.
- `FLOW-graph-state` hat einen Produzenten: `graph-store`.
- Neue Flüsse zum Store: `FLOW-graph-delta` (mutate), `FLOW-imported-graph` (import). `FLOW-ontology-json` (seed-from-json → import) ersetzt den falschen Eingang `formatE-artifact` am Import.
- `merge-nodes` liefert Mutationsbefehle (`replayBranchLog` ruft `harness.mutate`).

## Messung

- IO-02 (Rig): 7 → 6. `graph-state` 10 → 1 Produzent. `mutate-cmd` 21 → 22 (merge-nodes, code-treu).
- Speicherwerk 10 → 8 Kinder, RD-04 2 → 1.
- GVE, Grounding offen, FLOW sichtbar: 21 Knoten · 94 Kanten → 20 · 88.
- Kongruenz (`graph_readiness`): 0 Fehler, Importabdeckung 82/83 (`src/index.ts`).

## Bewusst offen

- RC-04 3 → 5: `SCHEMA-graph-delta` und `SCHEMA-ontology-json` zeigen auf TS-Interfaces, die nirgends per Zod geparst werden — dieselbe Klasse wie die schon gemeldeten `SteeringSnapshot` und `PhaseGateReadiness`.
- R-31 `FUNC-apply-reseed` und `FUNC-reseed` ohne Ausgang: Leeren und Nachladen sind Befehle an den Store ohne eigene Nutzlast.
- FC-04 `FCHAIN-recall`: kein ACTOR-Auslöser am Eingang der Kette.
- `harness.ts` hat 607 Zeilen, Ziel < 500 → Gate-Ablauf herauslösen, ITEM-2026-038.
- `FUNC-seed-from-json` liest laut Modell `graph-state`, liest aber die Datei — nicht angefasst.

## Tests

- Build grün. Der neue Store-Test war gegen den alten Code rot.
- Auswahl (`graph_tests` für mutate, import, seed, reseed und die Store-FUNCs, plus Store-, Gate-, Fit-Advisory- und Snapshot-Tests): grün.
- Ganze Suite (Code final, Modell 251): 1073 von 1080 grün, 7 rot. Sechs davon sind die bekannten, auch ohne diese CR roten (CR-GC-502: contracts 20 → ITEM-2026-036, Zählwerte, Perf-Spike → ITEM-2026-037). Der siebte war `rewind.test.ts`, verursacht durch das Zusammenlegen von `reseed` — behoben (Modell 252), danach `rewind.test` und `graph-store.test` 18 von 18 grün. Die ganze Suite lief nach dieser Korrektur nicht erneut.
