# CR-GC-693: Backend 'sigllm' in graphcode run spricht das entfernte sigllm-Format (/v1/inference, Profile, keine temperature) — löschen; sigllm = backend openai|anthropic + GRAPHCODE_LLM_API_KEY + NODE_EXTRA_CA_CERTS

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-588 (finding)
**Erstellt:** 2026-09-27
**Item:** bok/items/ITEM-2026-588.json (Lane: code)

---

_(kein Body im Item — Befund/Zielbild hier ausarbeiten, BEVOR die Lane startet)_

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
