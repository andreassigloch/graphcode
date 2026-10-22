# CR-GC-826: FCHAIN-apply-gate ohne Host-Socket, StoreLock und SessionLifecycle

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-998 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-998.json (Lane: graph)

---

## Befund

Im Fokus auf FCHAIN-apply-gate (GVE, 2026-10-22):

- **Zwei Eingänge vom Auftraggeber.** Host-Socket steht als Glied im Ablauf. Laut Code reicht der Socket
  nur Aufrufe einer angedockten Sitzung an den Besitzer weiter (`src/surface/host-shim.ts`: „the proxy hop
  adds NO semantics"). Ein Aufruf geht entweder direkt an graph_mutate oder über den Socket, nie beide —
  das Bild zeigte beide gleichzeitig.
- **StoreLock ohne Eingang.** Sein Eingang FLOW-cli-command kommt beim Start aus FUNC-cli-dispatch; den
  Lock gibt SessionLifecycle am Ende frei. Beide sind kein Schritt einer einzelnen Änderung und stehen
  schon in FCHAIN-repo-lifecycle.

## Änderung (Modell)

- `FCHAIN-apply-gate -compose->` Host-Socket, StoreLock, SessionLifecycle entfernt.
- `FCHAIN-repo-lifecycle -compose-> FUNC-host-socket` neu: die Wahl des Besitzers startet den Socket
  (`src/surface/mcp-server.ts:151`); die Kette trägt schon REQ-risk-owner-ends-with-docked-sessions.

## Messung

Trockenlauf und Anwendung v805 → v806: keine neuen Befunde, Steuerwert 5,75 → 5,75. Apply-Gate 13 → 10
Glieder, Repo-Lebenszyklus 18 → 19.
