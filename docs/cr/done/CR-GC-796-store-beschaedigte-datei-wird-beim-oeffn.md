# CR-GC-796: Store: beschaedigte Datei wird beim Oeffnen nicht neu aufgebaut (REQ-store-recovery, S 9)

**Status:** ✅ Done (2026-10-25)
**Typ:** aus Item ITEM-2026-855 (bug)
**Erstellt:** 2026-10-12
**Item:** bok/items/ITEM-2026-855.json (Lane: code)

---

GraphStore.open() baut einen Store nur bei Schema-Versatz neu auf (src/kernel/graph-store.ts:86-103). Ist die Kuzu-Datei beschaedigt und der Fingerabdruck passt, wirft storage.initialize() oder load(); open() gibt die Sperre frei und reicht den Fehler weiter (:99-107). REQ-store-recovery (Gegenmassnahme zu REQ-risk-store-unreadable, S 9) verlangt den Neuaufbau aus dem committeten Snapshot. Kein Test prueft eine beschaedigte Datei; TEST-store-recovery ist ungebunden. Umfang: Reproduktion als Test (beschaedigte Store-Datei auf Platte), Neuaufbau im selben Weg wie bei Schema-Versatz, TEST-store-recovery binden. Quelle: FMEA zweiter Lauf, FM-04; CR-GC-794 Befund 1.

---

## Befund (am Code geprüft, 2026-10-25)

Der Befund stimmt. `GraphStore.open()` (`src/kernel/graph-store.ts`) setzt den Store nur bei
Schema-Versatz neu auf (`staleSchema`). Passt der Fingerabdruck und ist die Kuzu-Datei beschädigt,
wirft `storage.initialize()`; `open()` gibt die Sperre frei und reicht den Fehler weiter. Der Host
startet nicht, obwohl der committete Snapshot den Store vollständig wiederherstellen könnte.

Probe mit kuzu-wasm, Store mit einem Knoten, danach die Datei verändert:

| Schaden an der Datei | Ergebnis beim Öffnen |
|---|---|
| Inhalt durch Fremdtext ersetzt | `initialize` wirft: „The file is not a valid Kuzu database file" |
| erste 4 KiB überschrieben | `initialize` wirft: dieselbe Meldung |
| auf die Hälfte gekürzt | `initialize` wirft: „Reading past the end of the file …" |
| auf 0 Byte gekürzt | Kuzu legt einen leeren Store an; `serveStdio` befüllt ihn aus dem Snapshot (seed-on-empty) — nicht Teil dieses CR |

## Root Cause

`open()` kennt genau einen Grund für den Neuaufbau, den Schema-Versatz. Ein Lesefehler beim
Öffnen ist kein Grund, obwohl REQ-store-recovery ihn verlangt („nicht lesbar ist, aus dem
committeten Snapshot neu auf").

## Umfang laut `graph_impact`

- `FUNC-graph-store -satisfy-> REQ-store-recovery`; `REQ-risk-store-unreadable -compose-> REQ-store-recovery`.
- `FUNC-open-store` liegt in fünf Ketten (`FCHAIN-host-start`, `-http-host`, `-model-import`, `-recall`,
  `-schema-migration`); die Signatur von `open()` ändert sich nicht, die Aufrufer bleiben.
- `TEST-store-recovery` ist ungebunden (`concept:true`).
- `graph_tests([FUNC-open-store])`: `tests/contracts.kernel.test.ts`, `tests/schema-guard.test.ts`,
  `tests/store-lock.test.ts`.

## Änderung

1. `GraphStore.open()`: Wirft `initialize()` oder `load()` auf einer vorhandenen Store-Datei, und der
   Snapshot existiert, schließt `open()` das Handle, löscht Store und WAL (`resetKuzuStore`), öffnet neu
   und befüllt aus dem Snapshot (`applyReseed`) — derselbe Weg wie beim Schema-Versatz. Ohne Snapshot,
   ohne bekannten Store-Pfad oder nach einem Schema-Neuaufbau bleibt der Fehler ein Fehler.
2. `SCHEMA-store-rebuild-notice` nennt den Grund: `cause: schema` (alter und neuer Fingerabdruck) oder
   `cause: unreadable` (die Kuzu-Meldung). Die Meldung geht wie bisher auf stderr.
3. `tests/store-recovery.test.ts` reproduziert die beschädigte Datei auf Platte; `TEST-store-recovery`
   bindet ihn und `tests/store-lock.test.ts` (Lock-Konflikt, beendeter Besitzer).

## Akzeptanzkriterien

- Eine Store-Datei mit überschriebenem Kopf und eine gekürzte Store-Datei: `initialize()` gelingt, der
  Graph hat die Knotenzahl des Snapshots, stderr nennt „unreadable" und die Quelle.
- Der neu aufgebaute Store liegt auf Platte: ein zweites Öffnen baut nicht neu auf und liest dieselbe
  Knotenzahl.
- Beschädigter Store ohne Snapshot: `initialize()` wirft die Kuzu-Meldung, die Sperre ist frei.
- Der Test ist vor dem Fix rot und nach dem Fix grün; `schema-guard.test.ts` bleibt grün.
- `TEST-store-recovery` trägt `testRefs`, `concept:false`.
