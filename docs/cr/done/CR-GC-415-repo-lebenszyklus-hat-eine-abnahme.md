# CR-GC-415 — Der Repo-Lebenszyklus bekommt eine Abnahme

**Status:** done — 2026-08-25 (graphVersion 196)
**Herkunft:** CR-GC-409 §A, Paket „Kette" (IO-01) + die dort dokumentierte
R-21-Falle beim Anschluss von `cli-dispatch`.
**Ziel:** die Wirkkette `FCHAIN-repo-lifecycle` prüfbar machen — und erst danach
verdrahten.

## Befund

`FCHAIN-repo-lifecycle` ist die einzige Kette dieses Graphen ohne satisfy-REQ und
damit ohne Integrationstest (gemessen: 17 von 18 Ketten tragen einen). Das ist
nicht nur eine Lücke in der Verifikation, es blockiert die Verdrahtung:

- `FUNC-cli-dispatch` an `FLOW-cli-command` anzuschließen erzeugt fünf
  Kettenpaare (`bootstrap`, `collect-status`, `harness-cli`, `run-verb`,
  `upgrade`) — alle fünf melden R-21, solange die Kette keinen Test hat.
- `FUNC-session-shutdown` meldet IO-01, weil sein Nachbar `FUNC-claim-store-lock`
  (der Produzent von `FLOW-store-ownership`) gar nicht in der Kette steht.

Beides in dieser Reihenfolge zu tun — erst die Abnahme, dann die Kante — ist der
Unterschied zwischen einer geschlossenen Regel und einer getauschten.

## Umfang

**Code**
- `tests/repo-lifecycle.integration.test.ts` (neu): die Kette von Hand
  durchlaufen — Lock nehmen, Sitzung eintragen, zweiter Owner scheitert, dann
  `SessionLifecycle.shutdown()`. Danach: kein Sitzungseintrag, kein gehaltener
  Lock, und der Abbau lief rückwärts (Store-Lock zuletzt). Echter Disk-Kuzu im
  Temp-Verzeichnis, keine Mocks.

**Modell (gate-only, `graph_mutate`)**
- `REQ-session-leaves-nothing-behind` (compose von `UC-repo-lifecycle`),
  `FCHAIN-repo-lifecycle -satisfy->` darauf,
  `TEST-repo-lifecycle -verify->` darauf (mit `testRefs` auf die neue Datei).
- `FCHAIN-repo-lifecycle -compose-> FUNC-claim-store-lock` — der Lock-Nehmer ist
  ein Glied dieses Lebenszyklus, nicht nur des Apply-Gates.
- `FUNC-cli-dispatch -io-> FLOW-cli-command` — der Dispatcher liefert das Verb an
  die Verb-Handler; dass bisher nur `ACTOR-developer` als Produzent stand, ließ
  den Einsprung aus der Kette fallen.

## Regel-Delta (gemessen)

| Regel | vorher | nachher |
|---|---|---|
| R-31 | 10 | 9 |
| IO-01 | 1 | 0 |
| R-21 | 0 | 0 |
| Summe | 46 | 44 |

Die fünf R-21 aus dem dryRun vom 2026-08-25 entstehen NICHT, weil die Abnahme im
selben Batch liegt.

## Abnahme

`tests/repo-lifecycle.integration.test.ts` grün; `rules_evaluate` zeigt kein
R-21 und kein IO-01 mehr.
