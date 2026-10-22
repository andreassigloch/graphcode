# CR-GC-835: Export-, Import- und Snapshot-Ketten nach dem Code

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-1014 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1014.json (Lane: graph)

---

## Befund

Modell-Audit gegen den Code, 2026-10-22, Gruppen D und E.

- **Drift-Marker:** Er liest den Graphen nicht. Das Gate setzt ihn (`gate.ts:184`), graph_export löscht ihn (`export.ts`, clearExportPending).
- **Auto-Export:** Er hängt am Post-Apply-Hook des Gates (`auto-export.ts:103`) und ruft graph_export entprellt, also asynchron. Den Graphen liest er nicht.
- **Zurückgehaltene Kanten:** `heldBackTraces` bekommt den Graphen von graph_export bzw. graph_readiness als Argument.
- **exportMarkdown** gibt einen Text zurück. Die Datei schreibt graph_export.
- **graph_reseed** hatte keine FUNC. Der Rückweg Datei → Store hatte darum keinen Auslöser.
- **import-code:**
  - Das Urteil erreicht das Verb als Antwort von graph_mutate.
  - Erstbefüllung, Export und Zusammenfassung fehlten.

## Änderung (Modell)

- **Drift-Marker:** mutate → Marker setzen → export-marker; graph_export → Marker löschen → export-marker. graph-state → export-marker gelöscht.
- **Auto-Export:** Gate-Urteil → Auto-Export (Hook); Aufruf an graph_export `async`. graph-state → auto-export gelöscht.
- **Zurückgehaltene Kanten:** je Aufrufer eine Anfrage (graph_export, graph_readiness). graph-state → held-back-traces gelöscht.
- **Markdown:** exportMarkdown → Text → graph_export; graph_export schreibt markdown-docs und antwortet dem Agenten (FLOW-export-answer, SCHEMA-export-answer).
- **graph_reseed:** neue FUNC-graph-reseed-tool. Agent → Werkzeug → reseed → applyReseed → Seed → Import → Store; die Antwort geht an den Agenten. Damit hat snapshot-roundtrip einen Auslöser für den Rückweg.
- **import-code:**
  - Antwort von graph_mutate → Verb (gate-verdict → Verb gelöscht).
  - Verb → Erstbefüllung, Verb → Export, Verb → Zusammenfassung → CLI.
  - Glieder für das Öffnen des Stores, Seed, Import und Export.
- **snapshot-freshness:** graph_mutate und decode sind Glieder.
- **doc-export:** graph-store ist Glied.
- **Beschreibungen** der vier Ketten nach dem Code.

## Messung

v825 → v826, 0 neue Fehler. Neue Warnungen:
- R-26 und R-32 an SCHEMA-export-answer (Code-Befund).
- RD-04 an FUNC-block-bedienung: 10 Kinder, Grenze 9. Der Block trägt jetzt jedes MCP-Werkzeug als eigene FUNC.
- Der Steuerwert steigt um 0,25.

## Code-Befunde (nicht in diesem CR)

- **graph_export:**
  - Die Antwort hat kein Zod-Schema.
  - Jeder Aufruf schreibt `docs/graph/*.graph.json`, auch wenn ein Skill nur eine Sicht will (`export.ts:240` vor `:247`). Ein Sicht-Export ist nie nur-lesend, und die Clobber-Sperre kann ihn verweigern.
- **Auto-Export:** Verweigert die Clobber-Sperre, steht das nur auf stderr (`auto-export.ts:60`). Der Agent sieht es nie.
- **import-doc** fährt ein Node-Skript mit eigenem Harness (`import-doc.md`). Der Ablauf ist im Modell kein eigener Pfad.
