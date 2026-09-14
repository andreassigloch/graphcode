# CR-GC-527: import-code: Reseed löscht handgeschriebene UC/REQ/ACTOR

**Status:** ✅ erledigt (2026-09-14)
**Typ:** aus Item ITEM-2026-074 (bug)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-074.json (Lane: code)
**Commit:** 516538b
**Schwester-CR:** graphify CR-GF-149 (MOD-in-MOD aus der Verzeichnisstruktur)

---

## 1. Root Cause

`src/surface/import-code-verb.ts` (Stale-Filter im Reseed-Transport): `staleNodes = alles
ausser SYS, das die Extraktion nicht liefert`. Die Extraktion liefert nie UC/REQ/ACTOR/FCHAIN
(und nie handgeschriebene FUNC/FLOW/SCHEMA/TEST) — jeder Reseed loeschte damit den gesamten
Warum-/Wie-Baum samt Kanten; der Kommentar am Backup nannte es sogar („trifft auch
hand-autorisierte UC/REQ/ACTOR"). Ebenso `staleEdges`: jede Kante zwischen ueberlebenden
Knoten, die nicht aus dem Import kam (REQ<-satisfy-FUNC, SYS-compose->UC), fiel.

## 2. Impact

Leitlinie S1/S2 unerfuellbar: ein Modell konnte nie gleichzeitig Code-Import UND Warum-Baum
tragen; jeder `graphcode import-code` setzte die Absichtsebene auf Null (nur das Backup blieb).
Nicht betroffen: SYS-Anker (CR-GC-302), Erstimport auf leerem Store.

## 3. Aenderung — Entwurfsentscheidung: Herkunfts-Stempel, keine Typmenge

Es gab keine Herkunfts-Markierung am Knoten. Eingefuehrt (graphcode-lokal, kein contracts-
Schema — `attributes` ist ein freier Record, CR-GC-524): der Transport stempelt jeden
importierten `add-node` mit `attributes.origin = 'import-code'`. Stale ist nur ein Knoten,
der den Stempel traegt und nicht wieder geliefert wird; stale ist nur eine Kante, deren
BEIDE Endpunkte gestempelt sind und die nicht wieder geliefert wird. Alles andere ueberlebt —
SYS, UC, REQ, ACTOR, FCHAIN, handgeschriebene FLOW/SCHEMA/TEST/FUNC und deren Kanten, auch
die Bindung an importierte FUNCs (REQ<-satisfy-FUNC, FCHAIN-compose->FUNC, FLOW-io->FUNC).
Die CR-GC-302-SYS-Ausnahme ist damit ein Spezialfall des Stempels, kein eigener Zweig.

Die vom Item angebotene Alternative „Typmenge des Importers (FUNC/MOD/FLOW/SCHEMA/TEST)"
wurde am roten Test verworfen: ein governter UC traegt zwingend handgeschriebene FLOW (UC-02,
Error) und TEST (R-01, Error). Per Typ geloescht fuehrt jeder Reseed NEUE Errors ein — das Gate
blockt genau die (gate.ts: Delta gegen Baseline) — der Import waere auf jedem governten
Modell blockiert.

Upsert merged Attribute (apply-commands.ts): der Stempel landet auf wiedergefundenen Knoten,
handgesetzte `realRef`/`testRefs` bleiben. Stempel round-trippt durch graph_export/seedFromJson
(Attribute werden flach exportiert und beim Seed wieder eingesammelt).

## 4. Dateien (2 + CR)

- `src/surface/import-code-verb.ts` — `CODE_ORIGIN`, Stempel im Transport, Stale-Filter auf
  Herkunft statt Typ, Kommentare.
- `tests/import-code-verb.test.ts` — +1 Fall (Repro aus dem Item, rule-valider Warum-Baum:
  ACTOR/UC/REQ/TEST/FCHAIN/FLOW/SCHEMA an importiertem funcA, Reseed, alles da);
  MOD-Zahlen 2→3 / 1→2 wegen CR-GF-149; Assertion `mod_src -compose-> {fileA,fileB}` als
  Nachweis, dass graphcode den compose-Output ohne R-18-Error einliest.

## 5. Test-Nachweis

Rot zuerst (Verb per `git stash` auf altem Stand): `expected [...] to include 'ACTOR-nutzer'`.
Nach dem Fix `npx vitest run tests/import-code-verb.test.ts` 8/8 (vorher 7). Volllauf
`npm test`: 139 Dateien, 1121 Tests (vorher 1120), 280.6 s, exit 0 — Log
`scratchpad/graphcode-npm-test.log`. `npm run build` und `type-check` gruen.

## 6. Modell / Kongruenz

Keine neuen Symbole: `FUNC-import-code-verb` realRef `src/surface/import-code-verb.ts`,
`TEST-import-code-verb` testRef `tests/import-code-verb.test.ts` — Symbolpraesenz geprueft;
RC-*/readiness nicht per MCP (Host dieser Session an bok gebunden).

## 7. Bewusst offen

- **Bestandsstores** (Importe vor diesem CR): Knoten tragen den Stempel nicht. Der erste
  Reseed danach stempelt alle wiedergefundenen Knoten; Code-Knoten, deren Code ZWISCHEN dem
  letzten alten und dem ersten neuen Import verschwand, bleiben einmalig stehen (sichtbar,
  `graph_mutate delete-node`). Kein Fallback auf Typmenge eingebaut (paralleler Pfad).
- Importierte TEST-Kandidaten werden jetzt sauber mitgeraeumt; ihre Semantik (Datei- vs.
  Fall-Granularitaet) bleibt CR-DRAFT-GC-463.
