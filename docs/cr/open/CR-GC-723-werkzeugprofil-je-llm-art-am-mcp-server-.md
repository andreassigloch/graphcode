# CR-GC-723: Werkzeugprofil je LLM-Art am MCP-Server: Variable GRAPHCODE_LLM=local|cloud (Scaffold schreibt local in opencode.json, cloud in .mcp.json). local = graph_delegate + Leser graph_elements, graph_get_node, graph_context, Leser-Beschreibung auf den ersten Satz; kein graph_mutate (ein Schreibweg: der Executor im Host). cloud = volle Liste. Entscheid Autor 2026-10-01, Messung in ITEM-2026-687 (Liste heute 32.029 Zeichen, OpenCode laedt sie je Anfrage). Abnahme: A/B-Lauf OpenCode gegen qwen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-688 (idea)
**Erstellt:** 2026-10-01
**Item:** bok/items/ITEM-2026-688.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
