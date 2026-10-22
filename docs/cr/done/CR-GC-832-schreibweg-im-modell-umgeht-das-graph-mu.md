# CR-GC-832: Schreibweg im Modell über das graph_mutate-Werkzeug; zwei Eigenschafts-Ketten entfallen

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-1011 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1011.json (Lane: graph)

---

## Befund

Modell-Audit gegen den Code, 2026-10-22, fünf Prüfagenten, Gruppe A, C und E. Entscheidungen des Autors:
- Flüsse zeigen den Aufrufweg über das MCP-Werkzeug.
- Je Auslöser gibt es eine Kette.
- Eigenschafts-Ketten werden gelöscht.
- Auslöser vom Akteur sind `sync`.

Im Code ruft `graph_mutate` (`src/surface/write.ts`) alles selbst:
- `formatEToCommands` (:343)
- `harness.mutateWithStates` (:389)
- `mitBericht`
- `recordAudit` bzw. `recordPreview`

Das Modell führte die Flüsse an der Werkzeugschicht vorbei:
- decode → mutate
- zug-bericht → Agent
- mutate → audit-record
- graph-state → arch-fitness, fit-advisory, emit-trajectory, emit-update-event; diese bekommen das Paar oder das Urteil als Argument.

`graph_merge` hatte keine FUNC. Das Kanal-Modell (channel-fit-advisory, channel-steer-advisory, channel-gate-verdict) doppelte Flüsse, die in der Antwort von graph_mutate reisen.

FCHAIN-modelfree-gate und FCHAIN-interface-escalation sind keine Abläufe:
- modelfree-gate ist eine Eigenschaft von apply-gate.
- Für interface-escalation gibt es keinen Code (keine Notwendigkeitsprüfung, kein Eskalations-CR).

## Änderung (Modell)

- **Schreibweg:**
  - decode → graph_mutate (Rückgabe), dann graph_mutate → mutate (neu: FLOW-mutate-cmd-tool).
  - graph-state → decode.
- **Bericht zum Zug:**
  - mutate → Stände → graph_mutate bzw. graph_suggest.
  - Werkzeug → mitBericht (FLOW-zug-anfrage, FLOW-zug-anfrage-suggest).
  - mitBericht → fitAdvisory → archFitness über eigene Graphpaar-Flüsse.
  - Der Bericht geht an graph_mutate zurück, nicht an den Agenten.
- **Protokoll:**
  - Je Werkzeug ein eigener Fluss an createToolContext (FLOW-audit-entry, -merge, -test-ingest; IO-02: ein Erzeuger je FLOW).
  - Erzeuger von audit-record ist tool-context.
  - Die Trajektorie liest das Log.
- **graph_merge:**
  - neue FUNC-graph-merge-tool.
  - Agent → Pfad → Werkzeug → Chargen → replayBranchLog → Bericht → Werkzeug → Antwort.
- **Live-Update:**
  - Gate-Urteil → Hook.
  - live-event nur an den Verteiler, `sync`.
  - FLOW-live-event-host gelöscht.
  - Startglieder aus der Kette (create-harness, own-kuzu-host, serve-sse, serve-stdio, health-endpoint).
- **loop-closure:**
  - Agent fragt audit_trail/audit_stats.
  - mutate und graph-store sind keine Glieder mehr, tool-context ist eines.
  - Die Flüsse an den Auftraggeber sind gelöscht.
- **Kanal-Flüsse** (Katalog aus CR-GC-591, bleibt): channel-gate-verdict, channel-fit-advisory und channel-steer-advisory kommen von graph_mutate, nicht mehr von Gate-Block oder fitAdvisory. Sie reisen in seiner Antwort.
- **Eigenschafts-Ketten:**
  - FCHAIN-modelfree-gate ist gelöscht. Ihre REQs erfüllt jetzt apply-gate, UC-reduced-llm komponiert apply-gate. Pre/Post sind zu „Gate ohne Modellaufruf“ zusammengelegt.
  - FCHAIN-interface-escalation ist gelöscht. Pre/Post sind in REQ-interface-change-escalation aufgegangen.
- **sync:** graph-delta, formatE-tool, auftrag, branch-log, merge-report, live-event → `sync`.

## Messung

v818 → v820, 0 neue Fehler. Neue Warnungen:
- R-30 und R-31 an serve-sse, own-kuzu-host, health-endpoint: Startglieder ohne Kette, bis die Host-Start-Kette steht (Folge-CR).
- RD-01 an REQ-interface-change-escalation: kein Code erfüllt die Eskalation — Code-Befund, offen.

## Code-Befunde (nicht in diesem CR)

- Die Rücksetzung nach einem Probelauf steht in graph_mutate (:398) und graph_merge (:465) ohne `finally`. Wirft der Schritt davor, bleiben Arbeitskopie und Platte verschieden.
- Fehler der Post-Apply-Hooks verwirft das Gate (gate.ts:206).
- Die Eskalation einer Schnittstellenänderung (REQ-interface-change-escalation) ist nicht gebaut.
