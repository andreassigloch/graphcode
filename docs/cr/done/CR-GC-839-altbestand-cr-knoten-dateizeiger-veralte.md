# CR-GC-839: Altbestand CR-Knoten — Dateizeiger und Umfang; Skripte in ein MOD

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-1022 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1022.json (Lane: graph)

---

## Befund

- **Dateizeiger:** 139 CR-Knoten zeigten in `description` auf `docs/cr/open/…`, obwohl ihre Datei in `done/` liegt. `aise dispatch prepare` schreibt den Pfad beim Anlegen, `aise cr close` zieht ihn nicht nach.
- **Umfang:** 138 CR-Knoten hatten keine relation-Kante auf FUNC, MOD, SCHEMA, REQ oder UC. CR-R01 meldete 30 davon.
- **Skripte:** Die npm-Spuren unter `scripts/` (CR-GC-836) lagen in keinem MOD (R-22). verify:model hatte keine FUNC. Entscheidung des Autors: Skripte, die einen Use Case erfüllen, sind Funktionen und gehören in ein MOD, wie die Skills.
- **Status** am CR-Knoten (RC-07, 88 Befunde) gehört nicht in diesen CR. Er ist in bok BOK-CR-071, Methode für alle Repos.

## Änderung (Modell)

- **Zeiger:** 139 Beschreibungen zeigen jetzt auf die tatsächliche Datei.
- **Umfang** für 65 CRs, mechanisch abgeleitet:
  - Aus den Commits, deren Nachricht die CR-Nummer trägt: geänderte Datei → FUNC mit diesem realRef, Testdatei → TEST → verifizierte REQ.
  - Aus den uids im CR-Text, die im Modell existieren.
  - Mehr als 10 FUNCs → stattdessen deren MODs.
- **Neues MOD-dev-scripts** (SYS compose). Darin verify-lane-code, verify-lane-full und die neue FUNC-verify-lane-model.
- **verify:model:**
  - neue FCHAIN-model-lane.
  - REQ-model-lane-fixed-set, verifiziert von der neuen TEST-verify-model-set (`tests/verify-model.completeness.test.ts`).
  - UC-efficient-testing komponiert beides.

## Messung

v835 → v836, 0 neue Fehler.
- CR-R01: 30 → 19.
- R-22: 20 → 18.
- Neu: VR-01 (info) an TEST-verify-model-set, bis die Modell-Spur das erste Ergebnis zurückmeldet.

## Offen

- **73 CRs ohne ableitbaren Umfang:**
  - 60 erledigte, überwiegend Läufe des inzwischen ausgelagerten Executors, Rig-Messungen und reine Doku.
  - 13 offene: 710–713 geparkt, 761, 771, 796, 808–812. Bei den offenen entsteht der Umfang, wenn der CR bearbeitet wird.
- **CR-R02** an CR-GC-780, 781, 788, 789: Die Regel liest `status`, deshalb erst nach BOK-CR-071.
- **Werkzeug:** `aise cr close` zieht den Dateizeiger nicht nach. Das gehört mit in BOK-CR-071.
