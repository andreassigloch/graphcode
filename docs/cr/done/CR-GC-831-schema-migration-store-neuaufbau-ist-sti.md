# CR-GC-831: Schema-Migration — Store-Neuaufbau meldet sich; migrateSchema entfällt

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-1010 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1010.json (Lane: code)

---

## Befund

FCHAIN-schema-migration hatte kein Ende beim Nutzer (Gate-Vorschlag, R-31). FUNC-migrate-schema war nie gebaut
(`concept:true`, kein realRef). Was der Code tut (`src/kernel/graph-store.ts`, open): Fingerabdruck der DDL gegen
den Marker; bei Abweichung Store weg, aus der SSOT neu befüllen, Marker neu — **still**. Was seit dem letzten
Export nur im Store stand, war fort, ohne dass der Nutzer es erfuhr.

## Änderung

Code:
- `src/kernel/store-rebuild-notice.ts` (neu): `StoreRebuildNoticeSchema` + `formatStoreRebuildNotice`.
- `src/kernel/graph-store.ts`: nach dem Neuaufbau eine Zeile auf stderr — alter → neuer Fingerabdruck, Quelle,
  Hinweis auf nicht exportierte Änderungen.
- `tests/schema-guard.test.ts`: Meldung beim Neuaufbau, keine bei gleichem Fingerabdruck (rot ohne die Zeile);
  Vertragstest inkl. Ablehnung.

Modell:
- FUNC-migrate-schema gelöscht; REQ-pre/post-migrate-schema in REQ-schema-version-migration gemergt
  („Store folgt dem Schema", functional, erfüllt von FUNC-schema-guard und FUNC-graph-store).
- Neu SCHEMA-store-rebuild-notice + FLOW-store-rebuild-notice (GraphStore → Auftraggeber, async);
  FCHAIN-schema-migration: Regelhalter (Version-Bump) → Fingerabdruck → GraphStore → Meldung an den Auftraggeber.

## Messung

v815 → v816: Datenfluss 2 → 0 Befunde, Bindung 33 → 30. RD-04 an MOD-kernel bleibt (21 Kinder, Altlast).
verify:full: 191 Dateien, 1611 Tests grün, Schlupf 0.
