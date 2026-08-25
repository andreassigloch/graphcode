# CR-GC-420 — LockOwner: ein Vertrag statt zweier Casts, und kein Reclaim auf Verdacht

**Status:** done · **Angelegt:** 2026-08-25 · **Geschlossen:** 2026-08-25 (graphVersion 205)
**Herkunft:** Nebenbefund aus CR-GC-413 (§B von CR-409, RC-04). SCHEMA-lock-owner blieb dort
offen, weil die Grenze ein Fremdprozess-JSON ist — beim Nachsehen fielen zwei echte Defekte auf.

## Problem 1 — ein pid-loses Lockfile holt den Lock eines LEBENDEN Owners zurück

`src/store-lock.ts:176` liest das Lockfile als `JSON.parse(...) as LockOwner` — ein Cast, keine
Prüfung. Fehlt im JSON die `pid` (Format-Drift, Fremdschreiber, abgeschnittener Write, der
zufällig gültiges JSON hinterlässt), läuft `reclaimIfStale()` in diesen Pfad:

1. `readOwner()` liefert ein Objekt (der Cast lügt) — der sichere „unparseable"-Zweig mit
   `STALE_CORRUPT_MS` wird **übersprungen**.
2. Alter unter `STALE_HEARTBEAT_MS` ⇒ kein Reclaim über den Puls.
3. `hostname` stimmt ⇒ der Cross-Host-Schutz greift nicht.
4. `this.pidAlive(undefined)` → `process.kill(undefined, 0)` wirft **TypeError**
   (`code === 'ERR_INVALID_ARG_TYPE'`, verifiziert 2026-08-25), nicht `EPERM` ⇒ Rückgabe `false`
   ⇒ „Prozess ist nachweislich weg" ⇒ **`rmSync` auf den Lock eines möglicherweise lebenden Owners.**

**Impact:** genau das, was der verriegelte Constraint ausschließt — zwei Owner-Prozesse auf einem
Kuzu-Store (single-writer). Eintrittswahrscheinlichkeit gering (der Normalfall schreibt
vollständiges JSON, und kaputtes JSON landet im sicheren Zweig), Schadenshöhe hoch.

**Root-Cause-Fix, kein Symptom-Fix:** `LockOwner` als Zod-Schema definieren und in `readOwner()`
`safeParse` statt Cast. Ein pid-loses Lockfile ist damit *unparseable* und nimmt den sicheren
Weg (Reclaim erst nach `STALE_CORRUPT_MS`). Das schließt zugleich **RC-04 für SCHEMA-lock-owner**,
ohne die Regel zu dekorieren — die Prüfung sitzt an der echten Grenze.
`pidAlive` verträgt zusätzlich einen Guard gegen nicht-numerische Eingaben; der Vertrag ist die
erste Verteidigungslinie, nicht die einzige.

## Problem 2 — zweiter Lesepfad auf dieselbe Datei

`src/status.ts:122–143` liest dasselbe Lockfile ein zweites Mal, mit eigenem Cast und
handgeschriebener `typeof`-Prüfung. Ein Vertrag, zwei Leser, zwei Auslegungen — Parallelpfad.
Nach dem Zod-Schema liest auch `status.ts` über dieselbe Funktion; der lokale Prüfcode wird
**gelöscht**, nicht danebengestellt.

## Akzeptanzkriterien

- [x] `LockOwner` ist ein Zod-Schema; `readOwner()` nutzt `safeParse`, kein Cast mehr im Repo
      (`grep -rn "as LockOwner" src/` leer).
- [x] Regressionstest, **vorher rot gesehen**: frisches Lockfile mit passendem `hostname` und
      **ohne** `pid` wird NICHT zurückgeholt (heute: wird es).
- [x] Test: kaputtes/unvollständiges Lockfile nimmt den `STALE_CORRUPT_MS`-Pfad, der lebende
      Owner behält seinen Lock.
- [x] `status.ts` liest über denselben Vertrag; die lokale `typeof`-Prüfung ist entfernt.
- [x] RC-04 für SCHEMA-lock-owner geschlossen (32 → 31 Violations, RC-04 3 → 2).
- [x] Bestehende Lock-Tests (Puls, Cross-Host, Reboot-PID-Recycling aus CR-GC-372) bleiben grün —
      der Puls bleibt die führende Aussage, dieser CR ändert daran nichts.

## Rot gesehen (2026-08-25, vor dem Fix)

`npx vitest run tests/store-lock.test.ts -t "CR-GC-420"` → **4 failed**, jeder aus dem
richtigen Grund:

| Test | Rot-Grund vor dem Fix |
|---|---|
| frischer Lock ohne `pid` wird nicht zurückgeholt | `acquire()` warf NICHT — der Lock wurde geklaut. Genau der Defekt aus §Problem 1. |
| unvollständiger Lock nimmt den Korrupt-Pfad | warf auch nach der Gnadenfrist: der Cast machte das Dokument „auslegbar", `hostname: undefined` las sich als Cross-Host, also wurde nie zurückgeholt. |
| nicht-numerische `pid` gilt nicht als tot | `acquire()` warf nicht — `pidAlive('4242')` liefert `false`. |
| `status.ts` liest denselben Vertrag | meldete `running` statt `stale` für einen Lock ohne `startedAt`. |

## Nachtrag zur Umsetzung — der Vertrag zog in eine eigene Datei

RC-04 verlangt Import **und** `parse` im Datei-Satz der io-verbundenen FUNC. Ein Schema, das
in derselben Datei definiert und geprüft wird, erfüllt das nie — `importedSymbols` bleibt leer.
Deshalb wanderte `LockOwner` nach `src/lock-owner-contract.ts`, wie Gruppe A es für
`schema-fingerprint-contract.ts` / `target-profile-contract.ts` / `gve-session-contract.ts`
schon getan hat; `store-lock.ts` importiert und `safeParse`t ihn. `readLockOwner(lockPath)` ist
der EINE Leser — `StoreLock.readOwner()` und `status.readHostStatus()` gehen beide darüber.

Nebenwirkung, absichtlich in Kauf genommen: `src/lock-owner-contract.ts` ist die zwölfte Datei
ohne MOD-Zuordnung (RC-05-Prüflücke, siehe CR-GC-425) — dieselbe Klasse wie die vier
Vertragsdateien aus Gruppe A.

Verhaltensänderung an `status`: ein Lockfile ohne `startedAt` (oder mit leerem `hostname`) gilt
jetzt als `stale` statt `running`. Das ist der Punkt des Vertrags — ein Dokument, das ihn nicht
erfüllt, benennt keinen Owner. Kein realer Owner schreibt so ein Dokument.

## Dateien (5)

1. `src/lock-owner-contract.ts` (neu)
2. `src/store-lock.ts`
3. `src/status.ts`
4. `tests/store-lock.test.ts`
5. dieser CR
