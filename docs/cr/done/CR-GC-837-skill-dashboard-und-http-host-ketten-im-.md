# CR-GC-837: Skill-, Dashboard-, HTTP-Host- und Health-Ketten nach dem Code

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-1016 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1016.json (Lane: graph)

---

## Befund

Modell-Audit gegen den Code, 2026-10-22, Gruppe E und Rest aus Gruppe A.

- **se:help** ruft das Werkzeug graph_help (`report.ts:454`), das keine FUNC hatte. Ohne Token rechnet es eine volle Erhebung (`report.ts:477`). Die Kette behauptete „die Hilfe zieht keine Messung“.
- **se-test und se-test-ui** sind Anleitungen zum Testentwurf und lesen keine Messung.
- **Dashboard:**
  - ACTOR-dashboard löste keinen Fluss aus.
  - Das Dashboard holt Kennzahlen über host.sock (`host-shim.ts`, handleLine); nach einer Änderung schiebt nichts.
  - graph_metrics liest den Graphen selbst (`metrics.ts:170`).
- **`graphcode host`:** serveHost (`cli.ts:81`), ownKuzu und /health standen in keiner Kette, seit CR-GC-832 sie aus live-update genommen hat. serve-sse hatte keinen Ausgang.
- **Skills ohne FUNC:** se-umbau und se:author-actor.
- **sync fehlte** an 32 Flüssen (anleitung-*, action, rules-answer).

## Änderung (Modell)

- **graph_help:**
  - neue FUNC-graph-help.
  - Agent → graph_help → Antwort; Regel- und Konformanzbefunde → graph_help.
  - FCHAIN-skill-help, jetzt „Hilfe und Anleitung“, trägt se:help, se-test, se-test-ui, graph_help und die Erhebung.
- **skill-report:** se-test und se-test-ui raus. audit_stats und graph_metrics mit den Kennzahl-Rechnungen sind Glieder, weil se-retro und se-modulebene sie rufen.
- **skill-authoring:**
  - neue FUNC-se-umbau und FUNC-author-actor, mit Skill-Aufruf und Anleitung.
  - Glieder read-tools, rules-tool, evaluate-rules.
- **Dashboard:**
  - Dashboard → host.sock → graph_metrics, graph_readiness, graph_generate.
  - Die Antworten gehen an den Socket und von dort an das Dashboard. Die direkten Flüsse an das Dashboard sind gelöscht.
  - graph_metrics → Kennzahl-Anfrage → chain-, function-criticality-, module-metrics; graph-state → diese drei gelöscht.
  - module-metrics → evaluate-rules gelöscht: die Regeln messen über `measureModules`.
  - mutate und die Ablaufsteuerung sind keine Glieder von dashboard-metrics mehr.
- **Neue FCHAIN-http-host:** CLI → serveHost → ownKuzu → Harness → Store öffnen; serveHost → Host bereit → CLI.
- **Neue FCHAIN-health:** Dashboard → GET /health → Regellauf → Antwort.
- **sync:** alle 32 restlichen Flüsse → `sync`. Kein FLOW ist mehr ohne Wert.

## Messung

v829 → v830, 0 neue Fehler.
- Behoben: R-30 an serve-sse, own-kuzu-host und health-endpoint; R-31 an serve-sse.
- RD-04 und BW-02 an den Blöcken abfrage, bedienung und host-sitzung sowie an MOD-agent-surface (33 Elemente): Jedes MCP-Werkzeug und jeder Skill ist jetzt eine eigene FUNC.
- Der Steuerwert steigt um 0,25.

## Code-Befunde (nicht in diesem CR)

- **graph_help:** Die Beschreibung verschweigt den Regellauf ohne Token. Antwort ohne Zod-Schema, im Modell vorläufig an SCHEMA-skill-text.
- **SSE:** Die Bruecke bestätigt `Last-Event-ID`, spielt aber nichts nach (`host.ts:279`). FUNC-broadcast-diff behauptet einen Cache für Nachzügler.
- **Health:** Der Health-Check verwirft die Befunde und wertet nur „wirft / wirft nicht“ (`host.ts:323`).
