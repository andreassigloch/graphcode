# CR-GC-822: Dashboard-Wege rules_evaluate und graph_suggest ueber host.sock fehlen im Modell

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-971 (finding)
**Erstellt:** 2026-10-20
**Item:** bok/items/ITEM-2026-971.json (Lane: graph)
**Art:** Modellzug, kein Code

---

## Befund

Der Item-Titel trifft nicht ganz: graph-view-edit ruft `rules_evaluate` nicht auf, die Verstöße kommen über
`graph_readiness` mit `detail:true` (`graph-view-edit/vite.config.js:681`). Gemessen an `vite.config.js`
nutzt der Viewer über `host.sock`:

| Werkzeug | Zweck | im Modell vorher |
|---|---|---|
| `graph_metrics` | Kennzahlen | ja (CR-GC-817) |
| `graph_readiness` (detail) | Report + Verstöße | Fluss da, nur an `FUNC-agent-loop` |
| `graph_generate` (peek) | nächster Schritt | Fluss da, nur an `FUNC-agent-loop` |
| `graph_suggest`, `graph_help`, `graph_get_node` | Vorschläge, Hilfe, Knoten | kein Antwort-Fluss, kein Zod-Vertrag |
| `graph_mutate`, `graph_export` | Edit-Modus | Schreibweg, Sache von CR-GC-808 |

Dazu: `FLOW-sse-frame` und `FLOW-health-report` führen ans Dashboard, aber der Viewer liest weder `/events`
noch `/health` — er beobachtet die Snapshot-Datei und rechnet den Zustand selbst. Das Abo ist Ziel von
CR-GC-809; die Differenz war unbenannt.

## Änderung

- `FLOW-readiness-report -io-> ACTOR-dashboard`, `FLOW-next-step-advice -io-> ACTOR-dashboard`; Beschreibungen
  auf beide Empfänger.
- `ACTOR-dashboard` beschreibt die tatsächlichen Wege (Lesen über host.sock, Schreiben im Edit-Modus mit
  Verweis auf CR-GC-808, Live/Health mit Verweis auf CR-GC-809) statt „SSE/WS read-only".
- `FLOW-sse-frame`, `FLOW-health-report`: offene Differenz benannt (Modell voraus, Ziel CR-GC-809).

## Nicht enthalten

Antwort-Flüsse für `graph_suggest`, `graph_help`, `graph_get_node` — sie fehlen auch zur Ablaufsteuerung, und
jeder braucht erst einen Zod-Vertrag im Code (RC-08), wie CR-GC-821 für `graph_metrics`. ITEM-2026-982.
