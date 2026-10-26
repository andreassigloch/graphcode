# CR-GC-858: graphify 0.6 einziehen: Range, import-code-verb-Test auf lesbare uids

**Status:** ✅ Done (2026-10-26)
**Typ:** aus Item ITEM-2026-1081 (idea)
**Erstellt:** 2026-10-26
**Item:** bok/items/ITEM-2026-1081.json (Lane: code)

---

graphify 0.6.0 ist veröffentlicht (Release-Zug 2026-10-26). graphcode zieht es ein; der contracts-Floor
bleibt (`>=12.7 <13`).

## Ziel

- `@sigloch/graphify` von `>=0.5.2 <1` auf `>=0.6 <1`, im Stil der übrigen Ranges (`>=12.7 <13`, `>=0.16 <1`).
  `npm install` aus der Registry, kein Link-Modus.
- `tests/import-code-verb.test.ts` („imports the fixture…") erwartet die alten uids `mod_src_*`. graphify 0.6
  vergibt lesbare uids (CR-GF-132); die alte uid steht in `attributes.candidateId`. Der Test prüft die neuen uids
  der Verzeichnis-Hierarchie (`MOD-src` compose-t `MOD-src-filea-ts`, `MOD-src-fileb-ts`) und je MOD und FUNC
  der Fixture die alte uid in `candidateId`.

## Befund ohne Änderung: graphify holt das LLM-Modell nur noch aus der Konfiguration (CR-GF-153)

- graphcode-Code ruft graphify nur deterministisch (`import-code-verb.ts`, kein LLM). Er braucht keine
  Konfiguration.
- Der Skill `se:import-doc` (`.claude/commands/se/import-doc.md`) ruft in Stufe 2 `new LMStudioClient()` ohne
  `model` und nennt in den Voraussetzungen `LLM_MODEL` mit Default `qwen/qwen3.6-27b`. Mit graphify 0.6 wirft
  `complete()` ohne `LLM_MODEL` den Fehler `LlmConfigError`; den Default gibt es nicht mehr. Nachzug im Skill:
  eigener CR, nicht dieser.

## Umfang (Dateien)

1. `package.json` — Range
2. `package-lock.json`
3. `tests/import-code-verb.test.ts`
4. dieser CR

## Akzeptanzkriterien

- `node_modules/@sigloch/graphify` ist 0.6.0 aus der Registry; contracts bleibt 12.7.0.
- `tests/import-code-verb.test.ts` grün mit lesbaren uids und `candidateId`; vorher rot an `mod_src`.
- `npm run build`, `verify:code`, `verify:full CR-GC-858` grün, darin `lockfile-sync` und `distribution`.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 911, Tiefe 1, Wurzeln: `FUNC-import-code-verb`._

Reichweite: 6 Elemente (FLOW 4, FUNC 2); Blackbox-Rand 5, nicht geoeffnet.

Dateien (realRef, 2):
- src/kernel/own-kuzu.ts
- src/surface/import-code-verb.ts

Tests (`graph_tests`, 6):
- tests/cli.scaffold.test.ts
- tests/contracts.kernel.test.ts
- tests/contracts.surface.test.ts
- tests/import-code-umbenennung.test.ts
- tests/import-code-verb.test.ts
- tests/mutate.schema-guard.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
