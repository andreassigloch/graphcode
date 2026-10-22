# CR-GC-834: Start, Sitzungsende und Store-Öffnen als eigene Ketten

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1013 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1013.json (Lane: graph)

---

## Befund

Modell-Audit gegen den Code, 2026-10-22, Gruppe D. Entscheidung des Autors: je Auslöser eine Kette, Flüsse über den Aufrufweg.

- **FCHAIN-repo-lifecycle** hatte 19 Glieder, 4 Auslöser und 5 Abläufe: Einrichten, Status, Upgrade, Hoststart und Sitzungsende. `cli.ts:74` ruft nur `serveStdio`. createHarness, Store-Lock und attachGve ruft serveStdio auf, nicht die CLI.
- **FLOW-store-rebuild-notice** hing an FUNC-graph-store und erschien damit in 18 Ketten. Geschrieben wird es nur in `GraphStore.open` beim Start.
- **Store-Lock und Schema-Guard** antworten GraphStore.open (`graph-store.ts:73, 87`), nicht createHarness bzw. dem GraphStore.
- **realRefs:** FUNC-seed-from-json und FUNC-import zeigten auf die Harness-Hüllen. Alle Wege laufen über `seedFromJsonFile` und `importOntologyGraph`.
- **Host-Socket:** Sein Gegenüber ist der Stellvertreter einer zweiten Sitzung (`host-shim.ts`, `buildProxyRegistry`), nicht der Auftraggeber. Er trägt jeden Werkzeugaufruf.
- **sync:** Mehrere Startflüsse standen auf `async`, obwohl der Aufrufer wartet.

## Änderung (Modell)

- **Neue FUNC-open-store** (`GraphStore.open`):
  - Lock-Anspruch → StoreLock → Besitz.
  - Fingerabdruck-Anfrage → Schema-Guard → Fingerabdruck.
  - Neuaufbau-Auftrag → applyReseed.
  - Sie erzeugt die Startmeldung und erfüllt REQ-schema-version-migration.
- **createHarness und Store öffnen:** Je Aufrufer eine Harness-Anfrage und ein Store-Öffnen. Aufrufer sind serveStdio, rewind, import-code und ownKuzu.
- **Neue FCHAIN-host-start:** CLI → serveStdio → Harness (Konfiguration) → Store öffnen → Erstbefüllung → Werkzeuge binden (Kontext) → Auto-Export → Host-Socket → Dashboard → stdio an die Ablaufsteuerung.
- **Neue FCHAIN-session-end:** Sitzungsende oder Lock verloren → SessionLifecycle → Dashboard abmelden, Socket schließen, Export nachziehen, Lock freigeben.
- **Neue FCHAIN-docked-session:** neue FUNC-host-proxy; Ablaufsteuerung → Stellvertreter → host.sock → graph_mutate → Gate, die Antwort zurück. mutate-cmd-owner und mutate-answer-owner sind gelöscht.
- **FCHAIN-repo-lifecycle** heißt jetzt „Repo einrichten und aktualisieren“ (init, status, update, remove, upgrade). upgrade liest owner.lock. Die Ausgaben der Verben gehen über die CLI (FLOW-cli-output).
- **schema-migration und recall** haben die Startglieder (CLI, serveStdio, open-store, Lock), schema-migration zusätzlich Neuaufbau, Seed und Import.
- **realRefs:** `seedFromJsonFile` und `importOntologyGraph`.
- **Doppelte Registry:** FLOW-mcp-tool-registry gelöscht. FLOW-tool-registry und FLOW-tool-surface tragen SCHEMA-mcp-tool-registry, das ein Zod-Schema und einen Test hat. SCHEMA-tool-registry ohne realRef ist gelöscht.
- **metric-policy → snapshot gelöscht:** Die Aufrufer geben die Politik mit, siehe die Messanfragen aus CR-GC-833.
- **sync:** store-ownership, schema-fingerprint, lock-release, imported-graph, reseeded-graph, ontology-json, tool-registry → `sync`. viewer-start, version-bump, lock-lost, session-end → `async`.

## Messung

v823 → v824, 0 neue Fehler.
- Behoben: R-30 an serve-sse, own-kuzu-host, health-endpoint und load-config (aus CR-GC-832/833); R-31 an serve-sse.
- Neu: R-30 an FUNC-bootstrap (siehe Code-Befunde) und RD-04 an FUNC-block-speicherwerk (11 Kinder, Grenze 9).
- Der Steuerwert steigt um 0,50.

## Code-Befunde (nicht in diesem CR)

- **`bootstrap`** hat keinen Aufrufer in der Produktion, nur `index.ts` und einen Test. Entweder löschen oder einen Aufrufer geben.
- **Schema-Guard** (`graph-store.ts:92-108`):
  - Fehlt die SSOT-Datei, wird der neue Fingerabdruck ohne Neuaufbau gestempelt.
  - Der Neuaufbau prüft EXPORT_PENDING nicht und löscht den Marker.
  - Die Warnungen über zurückgehaltene Kanten (`rejectedTraces`, `unverifiedReqs`) verwirft er.
- **Die Startmeldung geht nur auf stderr.** Unter MCP-stdio landet sie im Log des Clients. `meldeZurueck` startet den Host mit `stderr:'ignore'`.
- **`catch {}` bei der Erstbefüllung** (`mcp-server.ts:128`, `import-code-verb.ts:127`) schluckt auch eine kaputte SSOT-Datei.
- **import-code und import-doc** öffnen einen eigenen Harness. Während einer Agentensitzung scheitern sie am Store-Lock.
