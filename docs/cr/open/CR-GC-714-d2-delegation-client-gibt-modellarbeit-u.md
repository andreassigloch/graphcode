# CR-GC-714: D2-Delegation: Client gibt Modellarbeit ueber MCP an den Executor im Host-Prozess (ein Schreiber), Fragen des Executors gehen an den Client zurueck

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-644 (idea)
**Erstellt:** 2026-09-28
**Item:** bok/items/ITEM-2026-644.json (Lane: code)

---

## Befund

Zielkette lokal ist **D2** (Entscheid des Autors 2026-09-28): der lokale Client (OpenCode + qwen)
recherchiert, macht Spikes, schreibt Code und fragt den Nutzer; die Modellarbeit gibt er an graphcode,
graphcode an den Executor, der Executor übersetzt die Rückmeldungen des Gates, die das lokale Modell
direkt nicht verarbeiten kann (Kette B scheitert daran — Ursprung des Executors).

Heute ist der Executor nur per CLI erreichbar (`graphcode run`), und die CLI wird abgewiesen, solange
ein Client angedockt ist — gemessen 2026-09-28 in `agentdiary-local`:
`graphcode run: store already owned by pid … — stop the running MCP host (or the other run) first.`

## Ziel

Ein MCP-Werkzeug (Arbeitsname `graph_delegate`), mit dem ein angedockter Client Modellarbeit abgibt:
- Der Executor läuft **im Host-Prozess**, der den Speicher besitzt — kein zweiter Schreiber, kein Lock-Umweg.
- Eingabe: Auftrag (Text oder Verweis auf `material/…`, das der Client angelegt hat), Anker bzw. Paket
  (CR-GC-710), Rundenbudget.
- Ausgabe: Ergebnis (angewandte Züge, offene Befunde des Pakets) **oder** die offenen Fragen des
  Executors (`? …`). Der Client beantwortet sie — selbst, per Recherche oder beim Nutzer — und setzt mit
  einem zweiten Aufruf fort.
- Modell und Gateway aus der Repo-Konfiguration (nicht aus Umgebungsvariablen des Clients); ohne
  konfiguriertes lokales LLM ist das Werkzeug nicht angeboten.
- `graphcode run` (CLI) bleibt für den Fall ohne Client; beide rufen denselben `runExecutor` — kein
  zweiter Pfad.

## Umfang (vor Beginn `graph_impact` auf `run-verb.ts`/`executor.ts`)

`src/surface/` (Werkzeug + Registrierung), `src/loop/executor.ts` (Fortsetzen nach Frage),
Konfigurationsschema, Tests (Integration: Host + Werkzeug + Executor gegen ein Test-LLM-Backend).

## Akzeptanz

- Integrationstest: angedockter Host, Delegation, eine Frage, Antwort, Fortsetzung — ein Schreiber.
- Smoke in `agentdiary-local`: OpenCode delegiert ein Paket, der Graph wächst, `graphcode status` grün.
