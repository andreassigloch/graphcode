# CR-GC-727: D2 auf einer GPU: der wartende Client nimmt dem Executor die Rechenzeit. Probe todo 2026-10-02: jede graph_delegate({})-Abfrage des Clients kostet eine Inferenz mit 14-19 k Token ohne Cache; Executor-Runden dauern 2-5 min statt 15-85 s, qwen3.8 im Executor reisst den 300-s-Aufruf-Timeout. Das Warte-Budget muss je Repo einstellbar sein (executor.wartenSek), gepaart mit dem Abbruch des Clients (OpenCode experimental.mcp_timeout); die Obergrenze 55 s aus CR-GC-726 verhindert das

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-706 (finding)
**Erstellt:** 2026-10-02
**Item:** bok/items/ITEM-2026-706.json (Lane: code)

---

## Befund

Probe `todo` (2026-10-02, OpenCode 1.18.34, ein Rechner, eine GPU), je ein Lauf, Warte-Budget 45 s (CR-GC-726):

| | Client | Executor | Beobachtung |
|---|---|---|---|
| B | qwen3.8 medium | qwen3-coder | 16 Abfragen `graph_delegate({})` in 38 min, je 19 k Token ohne Cache; Executor-Runden 2–5 min statt rund 15 s |
| A | qwen3-coder | qwen3.8 medium | 6 Abfragen in 17 min; eine Executor-Runde riss den Aufruf-Timeout von 300 s, die nächste brauchte 296 s (ohne Client gemessen: rund 85 s) |

Der Client wartet nicht, er rechnet: jede Abfrage ist eine Inferenz über seinen ganzen Kontext, auf derselben
GPU, auf der der Executor arbeitet. Die Obergrenze von 55 s aus CR-GC-726 schreibt dieses Abfragen fest.

## Umsetzung

`src/surface/delegate.ts`:

- `executor.wartenSek` in `graphcode.config.jsonc` (1–3600 s, optional): das Warte-Budget dieses Repos. Der
  Executor bekommt das Feld nicht.
- `wartenSek` am Werkzeug ist optional; ohne Wert gilt die Config, ohne Config die Vorgabe von 45 s. Die
  Obergrenze am Werkzeug ist dieselbe (3600 s).
- Die Vorgabe bleibt unter 60 s: ein Client ohne eigene Einstellung bricht nach 60 s ab.

Ein längeres Budget gilt nur zusammen mit dem Abbruch des Clients. OpenCode: `experimental.mcp_timeout` in
`opencode.json` (Millisekunden), größer als `wartenSek`.

## Abnahme

`tests/delegate.test.ts`: die Vorgabe liegt unter 60 s; `executor.wartenSek` bestimmt die Wartezeit eines
Aufrufs ohne eigenes Budget; das Feld erreicht den Executor nicht; Werte über 3600 s sind abgewiesen.

Messung der Wirkung: `rig/agentdiary/messung-rollen-todo.md` (intern).

## Nicht in diesem CR

`graphcode init` schreibt weder `executor.wartenSek` noch `experimental.mcp_timeout` — ITEM-2026-703
(Scaffold für das Lokalprofil).

## Umfang laut Graph

`FUNC-graph-delegate`, `SCHEMA-delegate-input`, `REQ-delegate-wartebudget-je-repo` (neu, verifiziert von
`TEST-delegate-in-host`). Zwei Dateien.
