# CR-GC-696B: Rig-Korpus sigllm-v98 auf zwei REQ-kinds migriert

**Status:** 🟠 Open
**Typ:** Teil von CR-GC-696 (Teil 6), aus Item ITEM-2026-614
**Erstellt:** 2026-09-27

---

## Root Cause

`rig/sigllm-spezifikation/golden/sigllm-v98.graph.json` und der Hand-Trail daneben
(`referenz-trail.jsonl`) trugen die Altwerte `risk`/`mitigation`/`precondition`/`postcondition` in
`kinds`. Seit dem Ontologie-Major (CR-SM-365/366) parst `kinds` nur `functional|non-functional` —
jeder Leser, der das Golden in einen Store saet oder `toOntologyGraph` darauf ruft, bricht mit
ZodError (960 Meldungen). Rot dadurch: `read-tools.scope` (3), `working-set.spezlauf` (Datei),
`generate.statemachine` (Korpus-Teile, 7).

## Vorgehen

1. `scripts/migrate-req-kinds.mjs propose` auf einer Kopie: 40 REQ betroffen, alle heuristisch
   (16 risk, 18 mitigation, 6 pre/post an FCHAIN; keine satisfy-Kante betroffen ausser als Traeger).
2. Je REQ entschieden nach den Regeln von CR-GC-670 → `CR-GC-696B-entscheidungen.sigllm-v98.json`
   (decidedBy `CR-GC-696B`):
   - 18 mitigation, Erfueller MOD/SYS → `role: mitigation`, `kinds: [non-functional]`, Kante bleibt.
   - 6 pre/post an FCHAIN → `non-functional` an der Kette (wie CR-GC-670); Aufloesen in
     Eingangs-FLOW/UC-Ziel bleibt offen — ein Golden ist Messbasis, kein Umbau.
   - 16 risk ohne Erfueller → `role: risk`, **`kinds: [non-functional]`** — Abweichung vom Vorschlag
     (leeres kinds): se-fmea verlangt Rolle UND kind an jeder FMEA-REQ; eine Gefaehrdung ist eine
     Eigenschaft, keine Faehigkeit.
3. `apply` auf der Kopie ueber den Tool-Layer (graph_mutate + graph_export): **success, tier suggest**,
   14 Verdict-Warnungen, kein error — die migrierten Werte sind gate-legal.
4. Das Golden selbst per Skript byte-genau gepatcht (nur `kinds` oben und in `attributes`, `role`
   direkt dahinter), NICHT durch den Export ersetzt: der Export aendert das Format (`graphVersion`
   98 → 1, `attributes` flach). Geprueft: je Element `kinds`/`role` == Export der Gate-Kopie;
   Kanten und Reihenfolge unveraendert.
5. Hand-Trail: 66 Kommandos (add-node/update-node der 40 REQ, dazu zwei Probe-Knoten der
   abgelehnten validate-Zeile 104: Rolle aus dem Altwert, kind aus dem Erfueller im Batch).
   Nachspiel geprueft: 99 Zuege, Endstand 255 Elemente, kinds/role aller 80 REQ == Golden.

## Messbasis — was sich aendert

| Datei | sha256 alt | sha256 neu |
|---|---|---|
| `sigllm-v98.graph.json` | `2db8179edf8c…ae24` | `a2d01827f4a9…c65` |
| `referenz-trail.jsonl` | `154b76b5bcf7…a45c` | `abc2ee1d373c…dea3` |

- `rig/greenfield-systemtest/run.mjs` stempelt `golden.sha256` (erste 12 Stellen) in jede
  Ergebniszeile; `report.mjs` zeigt ihn. 58 Zeilen in `results-*.json` tragen `2db8179edf8c`, neue
  Laeufe `a2d01827f4a9` — ein Vergleich ueber diese Grenze ist damit sichtbar, nicht still.
- Inhaltlich aendert sich nur die REQ-Klassifikation (40 REQ); Elemente, Kanten, Beschreibungen,
  S/O/D bleiben. Profilwerte gegen das Golden (Fehler, Steuerwert, Anker) werden live gerechnet
  und verschieben sich ohnehin durch die neuen Regeln (CR-R05, FC-05, RC-10), nicht durch die Migration.
- `rig/graphs/*.graph.json` (eingefrorene Fremd-Repos) und `tests/fixtures/perf-basis.graph.json`
  tragen ebenfalls Altwerte, sind aber nicht rot durch kinds (`randbreiten`, `policy-herkunft`,
  `systemtest-rig` gruen) — nicht angefasst.

## Rest — nicht hier (Eigentuemer CR-GC-672)

`tests/generate.statemachine.test.ts` 3 Faelle bleiben rot, jetzt aus einem ANDEREN Grund: am
migrierten Golden steht die neue Regel **CR-R05** (Blatt-REQ ohne Bauauftrag) im Kern-Fokus;
erwartet ist `['AF-05','BW-02','RD-05']`, gemessen `['AF-05','BW-02','CR-R05','RD-05']`. Die Frage, ob
CR-R05 wie MS-01 dem Bauplan gehoert (CR-GC-600) und aus dem Kern-Fokus faellt, ist eine
generate.ts-Entscheidung.

## Tests

`read-tools.scope` (17), `working-set.spezlauf` (2) gruen; `generate.statemachine` Korpus-Faelle
gruen bis auf die drei CR-R05-Faelle oben; `randbreiten`, `policy-herkunft`, `systemtest-rig` gruen.
