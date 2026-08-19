# CR-GC-372 — Herzschlag im Store-Lock: ein Host ohne Puls blockiert kein Repo mehr

**Status:** done · **Angelegt:** 2026-08-19 · **Geschlossen:** 2026-08-19

> ## Abschluss 2026-08-19
>
> Umgesetzt wie geplant, 5 Dateien (`src/index.ts` kam dazu: `createHarness` muss
> `onLockLost` durchreichen). Gesamtsuite grün (104 Dateien / 801 Tests), Build grün.
>
> ### Entwurfsentscheidung: `utimesSync` statt Neuschreiben
>
> Der Puls stempelt nur den mtime. Ein Zeitstempel kann nicht halb geschrieben sein,
> ein JSON-Dokument schon — und `reclaimIfStale` liest diese Datei aus einem FREMDEN
> Prozess. Ein regelmäßig neu geschriebener Lock hätte die bestehende
> „unparseable + alt = stale"-Regel gegen sich selbst laufen lassen.
>
> ### Warum 90 s und nicht 35 s
>
> Drei Schläge Spielraum. Ein einzelner verpasster Schlag (Lastspitze, kurzer Suspend)
> darf keinen Lock-Diebstahl auslösen — der Preis ist, dass ein hart gestorbener Host
> im schlimmsten Fall 90 s nachwirkt, und selbst das nur, wenn seine PID nach dem Tod
> wiederverwendet wurde (sonst greift weiter die schnellere PID-Regel).

## Problem

Der Lock beweist Lebendigkeit über die **PID** (`kill(pid, 0)`). Das ist die richtige
Vorsicht gegen das Klauen eines aktiven Locks, aber als *einziges* Kriterium zu schwach:

1. **PID-Wiederverwendung.** Nach einem Reboot oder einem PID-Überlauf kann die im Lock
   stehende Nummer einem fremden Prozess gehören — dann gilt der Lock als gehalten und
   das Repo ist dauerhaft blockiert, ohne dass ein graphcode läuft.
2. **Hängender Host.** Ein Prozess im Deadlock oder mit SIGSTOP lebt für `kill(pid, 0)`,
   bedient aber niemanden mehr.

CR-GC-370 nimmt den häufigsten Fall (Host überlebt seine Session) an der Wurzel weg.
Was bleibt, ist die Rückfallebene für harte Fälle — genau die, die man nicht von Hand
debuggen will.

## Ziel

Der Lock trägt einen **Puls**: der Eigentümer stempelt ihn regelmäßig. Ein Lock ohne
Puls ist frei, unabhängig davon, was die PID sagt. Umgekehrt merkt ein Eigentümer, dem
der Lock entzogen wurde, dies beim nächsten Schlag und beendet sich — es darf nie zwei
Schreiber geben (REQ-single-kuzu-owner).

## Umsetzung

| # | Datei | Änderung |
|---|-------|----------|
| 1 | `src/store-lock.ts` | Puls: `utimesSync` auf die Lock-Datei alle 30 s (unref'd Timer, kein Inhalt geschrieben → kein zerrissener Lesevorgang). `reclaimIfStale` nimmt einen Lock zusätzlich, wenn sein mtime älter als 90 s ist — auch bei lebender PID, auch cross-host. Schlägt ein Schlag fehl oder gehört die Datei einem anderen, meldet der Lock `onLockLost` und gilt als nicht mehr gehalten. |
| 2 | `src/harness.ts` | Reicht `onLockLost` an den `StoreLock` durch. |
| 3 | `src/mcp-server.ts` | `onLockLost` → Sessionende über den `SessionLifecycle` (der zweite Schreiber hat gewonnen; dieser Host geht, statt weiter auf einen fremden Store zu schreiben). |
| 4 | `tests/store-lock.test.ts` | Puls hält den Lock jung; Lock ohne Puls wird trotz lebender PID übernommen; ein aktiv gestempelter Lock wird NIE übernommen; Puls-Verlust meldet `onLockLost`. |

4 Dateien.

## Akzeptanzkriterien

- [ ] Ein Lock mit frischem mtime wird nie übernommen — auch nicht cross-host.
- [ ] Ein Lock ohne Puls (> 90 s) wird übernommen, obwohl die PID lebt.
- [ ] Der Puls hält den eigenen Lock über die Grenze hinweg jung.
- [ ] Wird die Lock-Datei ersetzt, meldet der Alteigentümer `onLockLost` genau einmal.
- [ ] `npm test && npm run build` grün.
