# CR-GC-714: D2-Delegation: Client gibt Modellarbeit ueber MCP an den Executor im Host-Prozess (ein Schreiber), Fragen des Executors gehen an den Client zurueck

**Status:** ✅ Done (2026-09-29)
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

---

## Umsetzung (2026-09-29)

- **`graph_delegate`** (`src/surface/delegate.ts`): startet `runExecutor` im Host-Prozess gegen dieselbe
  Registry wie der Client, ohne sich selbst (`WITHHELD_TOOLS`). Der Rückkanal aus CR-GC-667 (`ask`)
  ist der Haltepunkt: die Frage beendet den Aufruf (`status: frage`), `{antwort}` löst das Versprechen
  ein, der Lauf geht weiter. Ein Aufruf kehrt spätestens nach `wartenSek` (Vorgabe 120, höchstens
  600) mit `status: laeuft` zurück — ein lokaler Lauf dauert länger als jede Client-Zeitgrenze;
  `{}` wartet weiter. Höchstens eine Delegation je Host. Audit-Herkunft während des Laufs: Modell
  des Executors + Auftrag (`setOrigin`).
- **Config**: Abschnitt `executor` in `graphcode.config.jsonc`, geprüft gegen `DelegateConfigSchema`
  (= `ExecutorConfigSchema` ohne `apiKey`/`interactive`/`candidates`/`judge`, dafür `apiKeyFile`).
  Die Datei ist eingecheckt, ein Schlüssel darin wird abgewiesen. Der Kernel hält den Abschnitt nur
  (`z.record`), geprüft wird in `surface/`, weil der Kernel den Executor nicht kennt. Ohne Abschnitt
  kein Werkzeug — in Host **und** Proxy (beide lesen dieselbe Config).
- **CA-Zertifikat** des sigllm-Gateways: `NODE_EXTRA_CA_CERTS` in der MCP-Umgebung des Clients
  (Node liest es nur beim Start).
- `graphcode run` bleibt unverändert (Env-Config); beide rufen denselben `runExecutor`.
- **Nicht enthalten:** Anker/Paket als Eingabe — kommt mit CR-GC-710, der `graph_delegate` um das
  Paket erweitert. Bis dahin wirkt der Auftrag wie bei `graphcode run` in der Seed-Phase; danach
  führt `graph_generate` über die Readiness.

```jsonc
"executor": {
  "backend": "openai",
  "baseUrl": "https://127.0.0.1:8080",
  "model": "qwen3-coder-30b-lms:latest",
  "apiKeyFile": "~/Developer/prod/sigllm/data/client-token.txt",
  "maxTokens": 4096,
  "maxRounds": 40
}
```

Modell: `FUNC-graph-delegate`, `REQ-delegate-in-host`, `TEST-delegate-in-host`, `FLOW-delegate-call`,
`FLOW-delegation-request`, `SCHEMA-delegate-input` (graphVersion 540).

## Nachweis (2026-09-29)

- `tests/delegate.test.ts` (8 Tests): Host mit Socket + Proxy, Delegation → Frage → Antwort →
  Fortsetzung, ein Schreiber; Warte-Budget; Eingabevertrag; Executor-Angebot ohne `graph_delegate`
  (rot gegengeprüft); Config mit `apiKeyFile`, Schlüssel in der Datei abgewiesen. Volle Suite 193/193.
- Smoke auf dem echten Weg: `graphcode mcp` über stdio (MCP-SDK-Client) in einer Kopie der
  `agentdiary-local`-Config, qwen3-coder-30b über das sigllm-Gateway, 2 Runden: Werkzeug angeboten,
  2 Züge angewandt, 0 abgelehnt, 4 Knoten im Store.
- **Benannte Lücke:** der Smoke lief mit einem SDK-Client, nicht mit OpenCode. Der erste
  OpenCode-Lauf in `agentdiary-local` (Config und `NODE_EXTRA_CA_CERTS` sind dort eingetragen) ist
  der Vergleichslauf selbst — das Repo bleibt dafür leer.
