# CR-GC-617: Das Rig beendet den Eigentümer, statt seinen Ausweis zu löschen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-489 (bug)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-489.json (Lane: code)

---

## Befund

```js
function releaseStore(dir) {
  for (const f of ['owner.lock', 'host.sock']) rmSync(join(dir, '.graphcode', f), { force: true });
}
```

Das Rig ruft das zweimal je Lauf: einmal, damit der MCP-Host des Executors den Store übernehmen
kann, und einmal danach — mit dem Kommentar *„executor's MCP may leave a lock (esp. on timeout
kill)"*. Der Kommentar nennt den Fall richtig und die Behandlung ist falsch.

`spawnSync(..., { timeout })` schickt SIGTERM an das **direkte** Kind (`claude` bzw. `opencode`).
Dessen MCP-Host ist ein Enkel. Er überlebt, hält den Kuzu-Handle offen und ~550 MB RSS, und
bekommt nie mit, dass sein Arbeitsbereich gleich per `rmSync` verschwindet.

`owner.lock` trägt die PID des Eigentümers, und `src/kernel/store-lock.ts` hat für genau diese
Frage eine Heartbeat-Erkennung (`STALE_HEARTBEAT_MS`, `reclaimIfStale`). Das Rig umgeht sie: es
löscht den Ausweis. Danach ist der Waisen-Prozess **unsichtbar** — kein Lock nennt ihn mehr,
kein späterer Lauf stolpert über ihn, `aise doctor` kennt ihn nicht. Ein zweiter Schreiber auf
demselben Store ist ab da nicht mehr ausgeschlossen, sondern nur noch unwahrscheinlich; das ist
die Verletzung von `REQ-single-kuzu-owner`, gegen die der Lock gebaut wurde.

Messbarer Nachlass, Stand 2026-09-23: drei verwaiste `owner.lock` unter `rig/`, `runs/` auf 2,2 GB.

## Zielbild

`releaseStore` wird `storeFreigeben(dir)` und **beendet den Eigentümer**:

1. `owner.lock` lesen (derselbe Vertrag, `LockOwner`) — kein Eigentümer benennbar → nur aufräumen.
2. Fremder Host (anderer `hostname`) → **nicht** töten, sondern melden. Ein Rig tötet nichts,
   was es nicht gestartet haben kann.
3. Eigener Host, PID lebt → SIGTERM, kurze Frist, dann SIGKILL; danach prüfen, dass die PID weg
   ist. Bleibt sie, ist das ein **Befund** und kein stilles Weiter.
4. Erst dann `owner.lock` und `host.sock` entfernen.

Die Funktion gibt zurück, was sie getan hat, damit der Lauf es protokollieren kann — ein
beendeter Waise ist eine Messgröße (er hat Speicher und Zeit gekostet), keine Nebensache.

## Akzeptanzkriterien

- [ ] Ein lebender Eigentümer wird beendet, bevor der Lock verschwindet — mit Nachweis (PID tot)
- [ ] Ein Lock ohne lesbaren Eigentümer wird wie bisher entfernt, ohne Lärm
- [ ] Ein Lock eines anderen Hosts wird gemeldet, nicht angefasst
- [ ] Reine Funktionen, an denen ein Test hängen kann — kein `kill` in einer Closure
- [ ] Ein Test tötet einen echten Kindprozess über den echten Lock-Vertrag, kein Mock

## Umfang

`rig/greenfield-systemtest/run.mjs`, `rig/code-test/run-code.mjs` (falls es denselben Pfad hat),
ein neuer Test.
