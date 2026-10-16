# CR-GC-815: Akteure nach Kanal statt nach Rolle geschnitten: Auftraggeber und Regelhalter

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-966 (finding)
**Erstellt:** 2026-10-16
**Item:** bok/items/ITEM-2026-966.json (Lane: graph)
**Art:** Modellzug, kein Code

---

## Befund

Das Modell (v762) führt zwei Akteure, geschnitten nach dem Weg ins System:

| Akteur | sendet |
|---|---|
| `ACTOR-agent` „Auftraggeber" | nur `FLOW-auftrag` (Prompt an `FUNC-agent-loop`) |
| `ACTOR-owner` „Repo-Owner" | CLI-Aufruf, Mutate-/Query-Befehl, Config-Datei, Regelklausel, Dimension-Vorlage, Gate-Protokoll, Version-Bump |

Mensch und Orchestrator sind gleichwertige Auftraggeber; das Gate unterscheidet sie nicht (der Autor wird
nur geloggt). Prompt, CLI und MCP sind Kanäle derselben Rolle, keine eigenen Akteure. Der echte Unterschied
liegt woanders: wer einen **Auftrag** gibt und wer das **Regelwerk** setzt, nach dem das Gate urteilt
(Urteilsschwellen, Regelklauseln, Vorlagen, Ontologie-Version).

## Entscheidung (Auftraggeber 2026-10-16)

Zwei Rollen, geschnitten nach dem, was die Systemgrenze kreuzt — nicht nach Mensch oder Maschine:

- **`ACTOR-auftraggeber`** — gibt Aufträge und nimmt Ergebnisse ab, über jeden Kanal (Prompt, CLI, MCP).
- **`ACTOR-regelhalter`** — setzt das Regelwerk: `FLOW-config-file`, `FLOW-channel-rule-clause`,
  `FLOW-channel-dimension-template`, `FLOW-channel-gate-protocol`, `FLOW-version-bump`.

Verworfen: ein einziger Akteur (verwischt, dass ein Auftrag das Regelwerk nicht ändern darf).

## Umfang laut `graph_impact`

- `ACTOR-agent`: aus `FLOW-auftrag`, ein `FLOW-ergebnis`. → `ACTOR-auftraggeber`, `ACTOR-agent` gelöscht.
- `ACTOR-owner`: aus 8 FLOWs, ein 15 FLOWs. Die 5 Regelwerk-Flüsse → `ACTOR-regelhalter`; die übrigen 3
  ausgehenden (`FLOW-cli-invocation`, `FLOW-mutate-cmd-owner`, `FLOW-query-request-owner`) und alle 15
  eingehenden → `ACTOR-auftraggeber`. `ACTOR-owner` gelöscht.
- Keine UC-, CR- oder REQ-Kante an beiden Akteuren. Im Code nur Kommentare
  (`src/projections/graphcode.ts:365`, `tests/arch.optimization-dry-run.spike.test.ts:431`).
- Beifang: `FLOW-query-request-agent` nennt in der Beschreibung `ACTOR-agent` als Quelle; die Kante kommt
  von `FUNC-agent-loop`. Beschreibung korrigiert.
- `graph_tests`: kein Code geändert → Spur MODELL (`npm run verify:model`).
