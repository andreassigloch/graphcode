# CR-GC-840: bootstrap() löschen — der Kaltstart fährt graph_mutate

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1023 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1023.json (Lane: code)

---

## Befund

`bootstrap()` (`src/surface/bootstrap.ts`, CR-GC-122) füllte ein leeres Modell aus fremdem Format-E durch das Gate.

- **Kein Aufrufer:** In der Produktion und in der Familie ruft es niemand. Es gibt nur den Export in `src/index.ts` und zwei Tests. FUNC-bootstrap lag deshalb in keiner Kette (R-30).
- **Zweiter Schreibweg:** Es rief `harness.mutate` direkt, an der Werkzeugschicht vorbei. Ein Kaltstart darüber hatte keinen Audit-Eintrag und keine Trajektorie (CLAUDE.md: rohe Mutation = kein Feed).
- **Ersetzt:** Die Aufgabe übernehmen heute graph_mutate (se:generate, Agent) und import-code (ruft graph_mutate).

Entscheidung des Autors 2026-10-22: löschen.

## Änderung

**Code:**
- `src/surface/bootstrap.ts` gelöscht.
- Export aus `src/index.ts` entfernt (`bootstrap`, `TEMPLATE_FORMAT_E`, `BootstrapResultSchema`, Typen). Das ist ein Bruch der Paket-API.
- Kommentare in `format-e-commands.ts`, `harness-import.ts` und `mcp-server.ts` nachgezogen.

**Tests:**
- `tests/bootstrap.test.ts` fährt den Kaltstart über das Werkzeug graph_mutate.
- Neu geprüft: Der Kaltstart selbst steht im Audit-Log.
- Ein Lesefehler ist ein Block-Urteil (STRUCT), kein Wurf.
- `tests/mvp-e2e.test.ts`, Schritt 2, ebenfalls über graph_mutate.

**Modell:**
- FUNC-bootstrap und FLOW-mutate-cmd-bootstrap gelöscht.
- REQ-bootstrap-through-gate erfüllt jetzt auch FUNC-graph-mutate-tool; der Text ist nach dem Code.
- Die Beschreibung von FLOW-gate-verdict ist nach dem Code.

**Beifang aus dem Volllauf:**
- `tests/arch.optimization-dry-run.spike.test.ts` hält die Züge des Autopiloten am echten Repo-Graphen fest und verlangt „neu messen“, wenn das Modell sich ändert. Nach CR-GC-832..839 ist es neu gemessen:
  - Der eine Zug ist jetzt „Bedienung nimmt graph_test_ingest auf“. Das ist fachlich falsch und steht als Messwert da (ITEM-2026-798).
  - Der Engpass ist wieder BW-02 an Grounding.
- Ein Vorschlag des Operators war richtig: FLOW-viewer-stop (CR-GC-834) hatte denselben Erzeuger, Abnehmer und Vertrag wie FLOW-viewer-start. Beide sind zusammengelegt zu „Viewer steuern“.
- Die Modell-Spur führt diesen Test nicht, deshalb fiel er erst im Volllauf auf.

## Nachweis

- `npm run build` grün.
- `vitest run tests/bootstrap.test.ts tests/mvp-e2e.test.ts`: 16/16.
- `vitest run tests/arch.optimization-dry-run.spike.test.ts`: grün nach dem Neumessen.
- Erster `npm run verify:full CR-GC-840`: 1 rot (der Spike oben), Schlupf 0.
- Zweiter `npm run verify:full CR-GC-840`: 1612/1612 grün, Schlupf 0.

## Release

Die Paket-API verliert `bootstrap`, `TEMPLATE_FORMAT_E`, `BootstrapResultSchema`, `BootstrapResult` und `BootstrapMode`. Kein Abnehmer in der Familie (gesucht über alle Repos unter `dev/`). Die Versionsstufe bestimmt der Release-Zug.
