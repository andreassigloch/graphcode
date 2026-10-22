# CR-GC-828: graph_mutate empfängt die Regelbefunde

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-1006 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1006.json (Lane: graph)

---

## Befund

`src/surface/write.ts:380` und `:417`: graph_mutate ruft `harness.evaluateRules()` vor dem Gate und nach einer
Annahme; `harness.ts:363` liest dafür den Zustand aus dem GraphStore. Mit beiden Befundlisten stempelt
graph_mutate im Audit, welche Alt-Befunde der Zug schloss (`respondsTo`, CR-GC-434). Im Modell lief
FLOW-rule-findings an mutate, Health, Regelwerkzeug und computeMarks — graph_mutate fehlte als Empfänger.
In der Animation von FCHAIN-apply-gate las evaluateRules den Store deshalb ohne erkennbaren Grund.

## Änderung (Modell)

`FLOW-rule-findings -io-> FUNC-graph-mutate-tool`.

## Messung

v809 → v810: neue Warnung BW-02 an FUNC-block-bedienung (11 Verträge an der Blockgrenze) — der Vertrag
SCHEMA-rule-violation kreuzt jetzt die Grenze, an der graph_mutate liegt; das ist der Code. Steuerwert
5,751744 → 5,751751.
