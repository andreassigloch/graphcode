# CR-GC-865: Host ohne owner.lock laesst Aufrufe haengen statt abzubrechen oder zu uebernehmen

**Status:** ✅ Done (2026-10-27)
**Typ:** aus Item ITEM-2026-1091 (bug)
**Erstellt:** 2026-10-27
**Item:** bok/items/ITEM-2026-1091.json (Lane: code)

---

Befund zweimal: (1) 2026-10-25, CR-GC-848: nach dem Beenden des Owners hing die Uebernahme Proxy -> Owner 2x1800 s in graph_help. (2) 2026-10-26, CR-GC-853: ein zweiter Host (pid 33064) lief ohne .graphcode/owner.lock; ein graph_mutate-Aufruf hing 30 Minuten, bis der Prozess beendet wurde. Erwartet: ein Host ohne owner.lock bricht ab oder wird uebernommen, ein Aufruf haengt nie. Root Cause nicht untersucht: Election/Host-Uebernahme (vgl. CR zu OCC/merge/Election) und Lebenszyklus nach dem Kill der owner.lock-pid. Reproduktion zuerst als Test mit echtem Prozess.

---

## Befund (2026-10-27)

Reproduziert mit echten Prozessen (`node dist/cli.js mcp`, MCP-Client des SDK):

| Fall | Ergebnis |
|---|---|
| Owner per SIGTERM oder SIGKILL beendet, Proxy übernimmt | geht, Übernahme in 2,2 s |
| owner.lock gelöscht, Host endet nach dem nächsten Puls | geht, Host endet nach ≤ 30 s |
| Lock von einem zweiten Host übernommen, Dashboard läuft für den zweiten weiter | **Host ist tot, der Aufruf an ihn hängt** |

**Defekt 1 — der Viewer hält den stderr-Kanal des Hosts.** `spawnViewer` startet das Dashboard
mit `stdio: ['ignore', 2, 2]`. Der Viewer erbt damit die stderr-Pipe des Hosts. Der MCP-Client
des SDK erkennt das Ende des Servers am Ereignis `close`, und `close` kommt erst, wenn alle
stdio-Pipes zu sind. Lebt der Viewer weiter, weil noch eine zweite Sitzung ihn braucht, sieht der
Client das Ende des Hosts nie. Jeder weitere Aufruf geht in eine tote Pipe und hängt bis zum
Leerlauf-Abbruch des Clients (Claude Code: 1800 s). Das ist Befund (1).

**Defekt 2 — der Abbau nach Lock-Verlust hat keinen Deckel.** Signale und stdin-EOF laufen über
`teardown` mit dem 3-s-Deckel (`GRACE_MS`). `onLockLost` ruft `lifecycle.shutdown` direkt, also
ohne Deckel. `shutdown` setzt zudem `closing`, und danach kehrt auch `teardown` sofort zurück.
Hängt ein Abbauschritt, lebt der Host ohne Lock weiter, und stdio nimmt weiter Aufrufe an. Das
passt zu Befund (2): Host 33064 gewann um 15:08 UTC die Wahl. Um 15:49 gehörte der Lock pid 31884.
Um 16:34 lief 33064 noch, ohne Lock. Welcher Schritt hing, belegen die Logs nicht.

**Nicht geklärt:** Wer 33064 den Lock nahm. Keine Schlafphase im `pmset`-Log; die Spur
`verify:code` lief in dem Fenster. Das bleibt offen, die zwei Defekte machen aus jeder Übernahme
einen Hänger.

## Änderung

1. `src/surface/gve.ts`: Der Viewer schreibt in `.graphcode/gve.log`, nicht in die stderr des Hosts.
2. `src/surface/session-lifecycle.ts`: Ein Abbauweg mit Deckel für alle Auslöser, `end(reason)`.
   `teardown` in `installTriggers` ruft ihn.
3. `src/surface/mcp-server.ts`: `onLockLost` ruft `lifecycle.end`.

## Tests

- `tests/host-ende-sichtbar.test.ts` (neu, echte Prozesse): Host mit Dashboard, eine zweite Sitzung
  hält den Viewer. SIGTERM an den Host, der Client sieht `close` in ≤ 5 s.
- `tests/session-lifecycle.test.ts`: `end` beendet auch bei hängendem Abbauschritt.

## Akzeptanzkriterien

- Beide Tests zuerst rot, dann grün.
- Smoke: Host mit Dashboard in einem Temp-Repo, Lock-Übernahme durch einen zweiten Host. Der erste
  endet, sein Client sieht das Ende.

## Nachweis (2026-10-27)

- Rot zuerst: `tests/host-ende-sichtbar.test.ts` (der Client sah `close` nicht in 5 s),
  `tests/session-lifecycle.test.ts` (`end` fehlte).
- Grün: Auswahl aus `graph_tests` (8 Dateien), `verify:code` (72 Dateien), `verify:full CR-GC-865` (200 Dateien, Schlupf 0).
- Smoke mit echtem Modell, echtem Dashboard und Lock-Übernahme durch einen zweiten Host: vorher hing
  der Aufruf an den beendeten ersten Host über 20 s, jetzt meldet der Client sofort `Not connected`.
- Modell: `REQ-host-end-visible`, `TEST-host-ende-sichtbar`, CR-Knoten mit Kanten auf
  `FUNC-session-shutdown`, `FUNC-gve-supervise` und die REQ.
