# CR-GC-526: Best-of-N wendet einen zweiten graph_mutate im selben Modell-Turn ohne Probe und Ranking an

**Status:** ✅ erledigt (2026-09-14)
**Typ:** aus Item ITEM-2026-041 (bug)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-041.json (Lane: code)
**Commit:** 89f4764

---

## 1. Root Cause

`collectCandidateBatch` (src/loop/executor-bestofn.ts) sammelt nur den ERSTEN
`graphcode_graph_mutate` eines Modell-Turns ein; jeder weitere fiel in den `else`-Zweig der
Read-Tools und ging ueber `execReadOrGraphTool` direkt an `registry['graph_mutate']` —
ohne Preflight, ohne dryRun-Probe, ohne Ranking, persistiert. Der Funktionskommentar
("der Batch geht NICHT ans Gate") stimmte nur fuer den ersten Aufruf.

## 2. Impact

Ein Kandidat konnte Knoten am Ranking vorbei in den Store schreiben; die Proben der anderen
Kandidaten sahen sie danach als Duplikate (`dupes=1`) — die Auswahl war verfaelscht und der
Store trug ungewaehlte Zuege. Nur Best-of-N (`candidates > 1`); der N=1-Pfad in executor.ts
fuehrt jeden graph_mutate bewusst ueber `gate.runMutate`.

## 3. Aenderung

Im Tool-Call-Loop wird `graphcode_graph_mutate` zuerst erkannt: der erste Batch wird
eingesammelt, jeder weitere im selben Turn mit `{collected:false, note}` beantwortet und
per Trace gemeldet — nie ausgefuehrt. Ein Kandidat ist EIN Batch. Bewusst nicht gewaehlt:
Batches zu verketten (aendert die Kandidaten-Semantik, Index bleibt Anker) oder als weitere
Kandidaten zu zaehlen (aendert N). ITEM-078 (ND-Rabatt im Ranking) bleibt eigener CR.

## 4. Dateien (2 + CR)

- `src/loop/executor-bestofn.ts`
- `tests/executor.bestofn.test.ts` (TEST-executor-bestofn, +1 Fall = der Repro aus dem Item)

## 5. Test-Nachweis

Rot zuerst: Repro (Kandidat 1 liefert zwei graph_mutate in einem Turn, Kandidat 2 einen;
candidates:2, echter Disk-Store) — `UC-b` stand im Store. Nach dem Fix:
`npx vitest run tests/executor.bestofn.test.ts` 23/23 gruen (vorher 22); dryRunProbes 2,
mutatesApplied 1, genau ein Gewinner im Store, kein `dupes=1`. `npm run build` gruen.

## 6. Modell

Keine neuen Symbole, keine neue Testdatei. Bewusst offen: RC-*/readiness nicht per MCP
geprueft (Host dieser Session an bok gebunden), nur Symbolpraesenz.
