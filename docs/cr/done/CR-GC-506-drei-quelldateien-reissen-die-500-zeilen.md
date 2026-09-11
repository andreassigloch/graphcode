# CR-GC-506: Drei Quelldateien reissen die 500-Zeilen-Grenze: executor.ts 1185, harness.ts 816, scaffold-templates.ts 669

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-027 (finding)
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-027.json (Lane: code)

---

CLAUDE.md: "Einfach, lesbar, explizit. Dateien unter 500 Zeilen." Gemessen 2026-09-10:

  src/loop/executor.ts             1185 Zeilen   52.387 B
  src/kernel/harness.ts             816 Zeilen   38.043 B
  src/surface/scaffold-templates.ts 669 Zeilen   36.617 B

Alle anderen 80 .ts-Dateien liegen darunter.

UNABHAENGIG VON JEDER GRAPH-DISKUSSION — aber es gibt einen messbaren Nebeneffekt: exakt
diese drei sind die Dateien, an denen graphify frueher abbrach (>32 KB, CR-GF-148, inzwischen
gefixt). Sie tragen 13 der 64 code-realisierten Modell-FUNC, und zwar die zentralen:
mutate (das Apply-Gate), load-graph, save-graph, open-store, close-store, reseed,
seed-from-json, import, evaluate-rules, graph-impact, graph-expand, run-executor,
resolve-tests-from-code. Gross UND zentral ist die schlechtere Kombination.

harness.ts ist eine Klasse (GraphCodeHarness) mit 41 Zugriffen auf this.graph/store/db.
Ein Schnitt muss den Zustand mitnehmen, nicht nur Funktionen verschieben — das ist der
Grund, warum die Datei gewachsen ist, und der Grund, warum ein naiver Split scheitert.

VORARBEIT, die den Schnitt entscheidbar macht: graph_impact auf die betroffenen FUNC,
dann sehen, welche Gruppen wirklich getrennt sind. MT-02 meldet fuer MOD-surface bereits
LCOM4=7 (26 FUNCs in 7 unverbundenen Gruppen) — dieselbe Frage eine Ebene hoeher.

NICHT: blind an der 500 schneiden. Erst die Gruppen messen, dann schneiden.


=== STAND 2026-09-11 ===
harness.ts ERLEDIGT: 816 -> 395 Zeilen (CR-GC-503 GraphStore als Besitzer des Graph-Zustands, CR-GC-504 Gate-Ablauf
nach gate.ts). Offen bleiben src/loop/executor.ts und src/surface/scaffold-templates.ts — Zeilenzahl vor einem Schnitt
neu messen. Hinweis aus dem Suchlauf (ITEM-2026-028): in executor.ts laeuft die Kette Parser -> Preflight -> Gate ->
Rangfolge; im Modell stehen drei ihrer Stufen faelschlich als Produzenten von FLOW-mutate-cmd. Ein Schnitt von
executor.ts entlang dieser Kette waere zugleich die Modellkorrektur.
