# Mutanten an HarnessHandle und ToolContext (CR-GC-991)

Gemessen am 2026-11-21. Je Mutante eine Änderung am eigenen Quelltext (`src/kernel/harness-handle-contract.ts`, `src/surface/tool-context-contract.ts`; nie in `node_modules`), danach die Tests, dann zurückgesetzt.

- **alt:** Stand vor CR-GC-991 (`z.custom`, `superRefine`), Handtests `tests/contract.harness-handle.test.ts`, `tests/contract.tool-context.test.ts`, `tests/tool-contract.test.ts` (Arbeitskopie von HEAD vor CR-GC-990).
- **neu:** Stand nach dem CR (`z.function()`, `z.looseObject`, `z.strictObject`), erzeugte Tests `tests/vertrag/SCHEMA-harness-handle.vertrag.test.ts`, `SCHEMA-tool-context.vertrag.test.ts` (dazu die beiden Tests des Vertrags `MCPToolSchema`).
- Zahl = rote Tests der Läufe; „grün" heißt: die Mutante blieb unentdeckt.

| Nr | Mutante | alt (Handtest) | neu (erzeugt) |
|---|---|---|---|
| H1 | Harness: Mitglied `mutate` aus dem Vertrag entfernt | 2 rot | 2 rot |
| H2 | Harness: `mutate` ist `z.number()` | 6 rot | 2 rot |
| H3 | Harness: `close` optional | 1 rot | 1 rot |
| H4 | Harness: offenes Objekt wird strikt | 2 rot | 1 rot |
| T1 | Kontext: `serializeToolWrite` entfernt | 2 rot | 4 rot |
| T2 | Kontext: `recordAudit` ist `z.number()` | 1 rot | 3 rot |
| T3 | Kontext: `strictObject` wird `looseObject` | 1 rot | 1 rot |
| T4 | Kontext: `auditLog` ohne `query` | grün | 2 rot |
| T5 | Kontext: `harness` optional | 1 rot | 1 rot |

## Prüfungen, die der Vertrag nicht mehr trägt

Diese zwei Mutanten gab es nur im alten Vertrag (Datenprüfung in `superRefine`). Das neue Gegenstück ist eine Mutante an der Funktion selbst, gefangen vom gewöhnlichen Test.

| Nr | Mutante | alt (Vertrag, Handtest) | neu (Test der Funktion) |
|---|---|---|---|
| H5 | alt: Prüfung `getRepoRoot` nicht leer aus dem Vertrag entfernt; neu: `getRepoRoot()` liefert `''` | 1 rot | 1 rot (`tests/harness-handle.test.ts`) |
| T6 | alt: Prüfung `sessionId` nicht leer aus dem Vertrag entfernt; neu: `sessionId()` liefert `''` | 1 rot | 1 rot (`tests/tool-context.test.ts`) |

Befund: Der erzeugte Test fängt alle neun Mutanten am Vertrag; der Handtest übersah T4. Beide Datenprüfungen fängt der Test der Funktion.

## Beleg: der Harness im Kontext ist ein loses Objekt, nicht der Harness-Vertrag

`buildProxyRegistry` (`src/surface/host-shim.ts`) bindet die Werkzeug-Vorlage an einen Stand-in, dessen Zugriff wirft. Gemessen: `HarnessHandle.safeParse(<Proxy mit werfendem get>)` wirft (`accessed …`), denn der Vertrag liest die Mitglieder. Der Kontext-Vertrag darf `harness` also nicht mit `HarnessHandle` prüfen; er prüft `z.looseObject({})`.
