# Mutanten am Vertrag MCPToolSchema (CR-GC-990)

Gemessen am 2026-11-21. Je Mutante eine Änderung am eigenen Quelltext `src/kernel/tool-contract.ts` (nie in `node_modules`), danach die Tests, dann zurückgesetzt.

- **alt:** Stand vor dem CR (`z.custom`), Handtests `tests/tool-contract.test.ts`, `tests/contract.harness-handle.test.ts`, `tests/contract.tool-context.test.ts` (Arbeitskopie von HEAD).
- **neu:** Stand nach dem CR (`z.function()`, `z.looseObject`), erzeugte Tests `tests/vertrag/SCHEMA-mcp-tool.vertrag.test.ts` und `SCHEMA-mcp-tool-registry.vertrag.test.ts`.
- Zahl = rote Tests der Läufe; „grün" heißt: die Mutante blieb unentdeckt.

| Nr | Mutante | alt (Handtest) | neu (erzeugt) |
|---|---|---|---|
| M1 | `handler` aus dem Schema entfernt | 1 rot | 12 rot |
| M2 | `handler` ist `z.number()` | 1 rot | 8 rot |
| M3 | `name` optional | grün | 2 rot |
| M4 | `inputSchema` verlangt kein `safeParse` mehr | 1 rot | 4 rot |
| M5 | `description` ohne `min(1)` | grün | 2 rot |

Befund: Der erzeugte Test fängt alle fünf Mutanten. Der Handtest übersah zwei (M3, M5), weil er nur fehlenden `handler` und falsches `inputSchema` kannte.
