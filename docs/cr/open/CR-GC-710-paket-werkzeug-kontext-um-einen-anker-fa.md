# CR-GC-710: Paket-Werkzeug: Kontext um einen Anker (Faltung + nummerierter Auftragsausschnitt), Vorschlagsrahmen aus TRACE_PATTERNS, Abnahmestand je Anker

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-640 (idea)
**Erstellt:** 2026-09-28
**Item:** bok/items/ITEM-2026-640.json (Lane: code)

---

## Befund

Der Kontext einer Runde entsteht heute aus dem Fundfenster einer Regel über den ganzen Graphen
(`fund-kontext.ts`, `executor-inventory.ts`). Er folgt nur compose/allocate — FLOW, REQ und SCHEMA
fehlen (Analyse 2026-09-28), und der Auftrag steht als Ganzes oder gar nicht darin.

## Ziel (Konzept `graphcode_arbeitspakete_konzept.md`, Abschnitte „Kontext eines Pakets", „Ebenenzyklus")

Ein Werkzeug, das zu **einem Anker** und einer Schnittgröße liefert:
- **Kontext nach Rezept:** Anker offen mit Teilbaum, Geschwister als Box, Rest als Index
  (`uid · type · name`), dazu die Flüsse/REQ/SCHEMA am Rand des Ankers;
- **Auftragsausschnitt:** der Auftrag deterministisch nummeriert (`[A1]`…`[An]`, Überschrift vorangestellt),
  je Anker nur die ihm zugeordneten Absätze;
- **Vorschlagsrahmen:** die legalen Typen/Kanten eine Ebene tief aus `TRACE_PATTERNS`;
- **Abnahmestand:** die Regeln, deren Geltungsbereich im Paket liegt, mit ihrem Stand.

Ein Werkzeug für alle Ausführenden: Executor, Frontier-Agent (MCP), Mensch.

## Umfang (vor Beginn mit `graph_impact` prüfen)

Neu `src/loop/paket.ts` (Kontext, Rahmen, Abnahme) und die MCP-Oberfläche des Werkzeugs; Wiederverwendung
von `faltung.ts`. Ersetzt `fund-kontext.ts`/Inventar-Teile, sobald CR-GC-711 den Planer umstellt — bis
dahin kein paralleler Pfad im Treiber (das Werkzeug wird erst in 711 verdrahtet).

## Akzeptanz

- Unit-Tests je Rezeptteil gegen echte Graphen (sigllm-Golden, graphcode selbst).
- Kontextgröße je Paket gemessen (Token) — Leitlinie T-E12, Stufe „ein Anker, eine Ebene".
