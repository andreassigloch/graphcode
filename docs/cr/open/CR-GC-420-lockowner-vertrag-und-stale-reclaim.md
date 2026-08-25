# CR-GC-420 — LockOwner: ein Vertrag statt zweier Casts, und kein Reclaim auf Verdacht

**Status:** open · **Angelegt:** 2026-08-25
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

- [ ] `LockOwner` ist ein Zod-Schema; `readOwner()` nutzt `safeParse`, kein Cast mehr im Repo
      (`grep -rn "as LockOwner" src/` leer).
- [ ] Regressionstest, **vorher rot gesehen**: frisches Lockfile mit passendem `hostname` und
      **ohne** `pid` wird NICHT zurückgeholt (heute: wird es).
- [ ] Test: kaputtes/unvollständiges Lockfile nimmt den `STALE_CORRUPT_MS`-Pfad, der lebende
      Owner behält seinen Lock.
- [ ] `status.ts` liest über denselben Vertrag; die lokale `typeof`-Prüfung ist entfernt.
- [ ] RC-04 für SCHEMA-lock-owner geschlossen (Zahl vorher/nachher aus `rules_evaluate`).
- [ ] Bestehende Lock-Tests (Puls, Cross-Host, Reboot-PID-Recycling aus CR-GC-372) bleiben grün —
      der Puls bleibt die führende Aussage, dieser CR ändert daran nichts.

## Dateien (≤ 4)

1. `src/store-lock.ts`
2. `src/status.ts`
3. Lock-Testdatei
4. dieser CR
