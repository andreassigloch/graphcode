# CR-GC-996: Proxy-Antwortfluesse streichen

**Typ:** aus Item ITEM-2026-1574 (finding)
**Erstellt:** 2026-11-22
**Item:** bok/items/ITEM-2026-1574.json (Lane: graph)

---

Zwei Proxy-Fluesse (FLOW-proxy-answer, FLOW-proxy-answer-agent) haengen an SCHEMA-mutate-result, der Proxy reicht aber die rohe Antwort jedes Werkzeugs durch (src/surface/host-shim.ts dispatch). Der Autor entschied: Proxy ist Transport, beide Fluesse streichen, kein Ersatzfluss.

---

## Entscheidung des Autors

Der Proxy ist Transport. Die Antwort hat ihren Vertrag am Werkzeug, nicht am Proxy. Beide Flüsse entfallen, es gibt keinen Ersatzfluss.

## Am Code geprüft

`src/surface/host-shim.ts` `dispatch` gibt `unknown` zurück, `handleLine` sendet das rohe Ergebnis von `tool.handler`; die MCP-Hülle baut erst `bindRegistryToMcpServer` (`src/surface/mcp-server.ts` ca. 88). Je Werkzeug eine andere Antwortform, also kein gemeinsamer Vertrag `SCHEMA-mutate-result`.

## Umfang laut `graph_impact`

| Knoten | Kanten vor dem Löschen |
|---|---|
| `FLOW-proxy-answer` | `FUNC-host-socket -io->` Fluss `-io-> FUNC-host-proxy`; `relation` auf `SCHEMA-mutate-result`; `realRef` host-shim.ts `dispatch` |
| `FLOW-proxy-answer-agent` | `FUNC-host-proxy -io->` Fluss `-io-> FUNC-agent-loop`; `relation` auf `SCHEMA-mutate-result` |

`FCHAIN-docked-session` bleibt verbunden: `FUNC-agent-loop -io-> FLOW-formatE-artifact-agent -io-> FUNC-host-proxy -io-> FLOW-proxy-call -io-> FUNC-host-socket`. Die Antworten kommen über die Flüsse je Werkzeug (`FLOW-mutate-answer-host-socket`, `FLOW-metrics-answer`, `FLOW-generate-answer`, `FLOW-readiness-report`). Kein Glied ohne Fluss, keine Übergabe verloren. Code und Tests nennen die beiden uid nicht (grep: nur geschlossene CR-Texte).

## Änderung

Modell: beide FLOW gelöscht (ein Batch, `dryRun` vorher, keine neue Regelverletzung), CR-Kanten auf `FUNC-host-proxy`, `FUNC-host-socket`, `SCHEMA-mutate-result`. Kein Code.

## Nicht geändert, vorgelegt

`FLOW-proxy-call` (Anfrage, `FUNC-host-proxy` an `FUNC-host-socket`) trägt `SCHEMA-mutate-command`, der Proxy reicht aber die Argumente jedes Werkzeugs durch. Gleiche Art wie die gestrichenen Flüsse; der Autor entscheidet.
