# CR-GC-825: FUNC-decode von loop nach kernel: einzige Grounding-FUNC in loop, Geschwister import/reseed/merge liegen in kernel; Linie loop-surface 2 -> 1 Flow

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-984 (idea)
**Erstellt:** 2026-10-21
**Item:** bok/items/ITEM-2026-984.json (Lane: code)

---

## Befund (Sitzung 2026-10-21)

Die Linie loop–surface war die dünnste der obersten Ebene. Einer ihrer Verträge war `FLOW-formatE-tool`
(graph_mutate → decode). `FUNC-decode` war die einzige Grounding-Funktion in `loop`; ihre Geschwister im
Funktionsbaum (`import`, `reseed`, `merge-nodes`, `own-kuzu-host`) liegen in `kernel`.

CR-GC-649 hatte `decode` nach `loop` gelegt, weil der Executor-Preflight in `src/loop/preflight.ts` es
brauchte. Seit CR-GC-775 läuft der Executor im Host; heute importieren nur `src/surface/write.ts` und
`src/surface/bootstrap.ts` die Datei. Die Datei selbst importiert nur `@sigloch/graph-api-core` und
`@sigloch/contracts` — `kernel` kennt damit weiter keinen Client.

## Probe beider Ziele (Trockenlauf, v795)

| Ziel | Kohäsion Zielmodul | Kohäsion loop | R-04 kernel | Steuerwert |
|---|---|---|---|---|
| kernel | 0,216 → 0,239 | 0,235 → 0,267 | 22 → 23 | +0,000003 |
| surface | 0,367 → 0,365 | 0,235 → 0,267 | 22 | −0,000017 |

Die Zahlen entscheiden nicht. Den Ausschlag geben Funktionsbaum (Geschwister in kernel) und die Beschreibung
von `surface` („Adapter ohne eigene Logik"; decode trägt Präfix-Abbildung, Vierphasen-Ordnung, Typprüfung).

## Umsetzung

- `git mv src/loop/format-e-commands.ts src/kernel/format-e-commands.ts`, kein Verhaltenswechsel.
- Importe: `src/surface/write.ts`, `src/surface/bootstrap.ts`, `tests/bootstrap.test.ts`,
  `tests/audit.trail-projection.test.ts`, `tests/mutate.formate-ops.test.ts`, `tests/helpers/format-e.ts`;
  Pfad in `tests/engpass-ein-leser.test.ts` und `tests/test-selection.audit.test.ts`.
  `scripts/spike-engpass-known-answer.mjs` bleibt: es liest die Datei an gepinnten Commits.
- Modell: `allocate` MOD-loop → MOD-kernel, `realRef` auf den neuen Pfad.
- 12 betroffene Testdateien grün (138 Tests), `import-boundaries` grün.

## Kennzahlen (v800 → v803)

| Kennzahl | vorher | nachher |
|---|---|---|
| Linie loop–surface (Flows) | 3 | 2 |
| Linie loop–kernel (Flows) | 7 | 6 |
| Linie kernel–surface (Flows) | 14 | 15 |
| R-04 kernel / loop | 22 / 11 | 23 / 10 |
| Kohäsion kernel / loop | 0,216 / 0,235 | 0,239 / 0,267 |
| Steuerwert | 5,7517 | 5,7517 |

## Volllauf

`npm run verify:full CR-GC-825`: 1608 von 1609 grün. Rot war die Messmarke in
`tests/arch.optimization-dry-run.spike.test.ts` („bitte neu messen"): nach dem einen Zug des Autopiloten steht
jetzt `R-04 @ MOD-kernel` (23 Verträge, Überschuss 4,75) vorn statt `BW-02 @ FUNC-block-grounding`. Neu gemessen
und mit Begründung gesetzt; die Datei danach einzeln grün.
