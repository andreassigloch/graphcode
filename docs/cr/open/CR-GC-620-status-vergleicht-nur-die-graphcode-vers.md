# CR-GC-620: Der Host stempelt, womit er gebootet hat — nicht nur seine Nummer

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-480 (finding)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-480.json (Lane: code)

---

## Befund

`graphcode status` meldet `Version OK`, sobald CLI, Host und Repo-Install **dieselbe
Paketnummer** tragen. `judgeVersions` vergleicht drei Versions-Strings — mehr nicht. Zwei
gemessene Fälle fallen damit durch:

1. **Neu gebautes `dist` unter derselben Nummer.** Gemessen am 2026-09-23: Host pid 2422
   gestartet 19:28 des Vortags, `dist/*.js` gebaut 07:04 — und `npm run build` macht `rm -rf
   dist`, der Host hielt also den Modulgraphen gelöschter Dateien. Bericht: `Version OK · CLI
   0.24.0 · Host 0.24.0`. Nach dem `/mcp`-Reconnect (pid 67732, 07:32) steht **dieselbe Zeile**.
   Ob der Host 27 Minuten jünger als der Build ist oder elf Stunden älter, ist am Werkzeug nicht
   zu unterscheiden.
2. **Getauschtes `contracts` unter derselben graphcode-Version.** Der Host urteilte mit 76
   Regeln, während 73 installiert waren (UC-05/06 waren längst gestrichen) — und meldete `ok`.

Der Vertrag `SCHEMA-lock-owner` sagt über sein `version`-Feld selbst, es sei *„die EINZIGE
lokale Quelle für ‚welcher Build besitzt den Store'"*. Das stimmt für ein Release und ist falsch
für alles darunter: eine Paketnummer identifiziert keinen Build.

**Der Neustart ist nicht das Problem.** `/mcp` → reconnect ersetzt den Prozess nachweislich
(neue pid, Start nach dem Build). Es fehlt der **Anlass**: nichts sagt, dass er fällig ist.

## Zielbild

Der Lock trägt neben der Nummer, **womit** der Host gebootet hat:

- `codeRoot` + die neueste Änderung darunter (das `dist`, aus dem er lädt),
- die beim Boot installierte `contracts`-Version.

`status` liest denselben Ort erneut und vergleicht. Weicht etwas ab, ist der Zustand `drift` mit
der einen Aktion: **`/mcp` → reconnect, sonst Agent-Session neu starten.**

Beide Felder sind **optional** im Vertrag: ein Lock aus einem älteren Build muss weiter parsen.
`readLockOwner` gibt bei Vertragsbruch `null` zurück, und `null` heisst dort „kein benennbarer
Eigentümer" — ein Pflichtfeld hätte jeden alten Host als verwaist gemeldet und wäre damit die
schlimmere Lüge als die, die dieser CR beseitigt.

## Akzeptanzkriterien

- [ ] Ein Host, dessen `dist` nach seinem Boot neu gebaut wurde, meldet `Drift` mit der Reconnect-Aktion
- [ ] Ein Host, unter dem `contracts` getauscht wurde, ebenso — auch bei gleicher graphcode-Version
- [ ] Ein Lock ohne die neuen Felder (älterer Build) parst weiter und gilt nicht als verwaist
- [ ] Reine Funktionen (`neuesteAenderung`, `judgeBootDrift`) mit Tests, kein Prozess, kein Netz
- [ ] Der frisch verbundene Host meldet `OK` — sonst ist die Erkennung nur lauter, nicht richtiger

## Umfang

`src/kernel/build-stamp.ts` (neu), `src/kernel/lock-owner-contract.ts`, `src/kernel/store-lock.ts`,
`src/surface/status.ts`, `tests/status.test.ts`, `tests/store-lock.test.ts`.
