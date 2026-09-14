# CR-GC-525: implplan-Renderer filtert CRs per uid-Praefix 'CR-' statt Typ - BOK-CR-* unsichtbar

**Status:** ✅ erledigt (2026-09-14)
**Typ:** aus Item ITEM-2026-116 (bug)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-116.json (Lane: code)
**Commit:** a6e6baa

---

## 1. Root Cause

`renderImplPlan` (src/projections/graphcode.ts) und `renderIntPlan` (src/projections/incose.ts)
waehlen die `relation`-Nachbarn einer MS mit `c.startsWith('CR-')` — ein uid-Praefix als
Typ-Ersatz. Ein CR-Ledger mit eigenem Namensraum (bok: `BOK-CR-040…`, `family.json
crPrefix`) faellt heraus; die MS rendert `— no CR —`, obwohl vier CRs an ihr haengen.

## 2. Impact

implplan/intplan sind fuer jedes Repo mit crPrefix ≠ `CR-` leer; changelog/cr-list (Typfilter)
zeigen dieselben CRs — die Views widersprechen sich. Umgekehrt wuerde ein Nicht-CR mit
`CR-`-uid faelschlich als CR gelistet.

## 3. Aenderung

Beide Filter auf `idx.get(c)?.type === 'CR'` (der `nodeIndex` lag in beiden Funktionen
schon vor). Kein weiteres `startsWith('CR-')` in `src/` (grep).

## 4. Dateien (3 + CR)

- `src/projections/graphcode.ts`
- `src/projections/incose.ts`
- `tests/views.conformance.test.ts` (TEST-views-conformance, +1 Fall)

## 5. Test-Nachweis

Rot zuerst: neuer Fall (MS mit `BOK-CR-040` type CR und `CR-nicht` type REQ, beide per
relation) rot in implplan. Nach dem Fix: `npx vitest run tests/views.conformance.test.ts
tests/exporter.test.ts` 48/48 gruen (views.conformance 13, vorher 12). `npm run build` gruen.

## 6. Modell

Keine neuen Symbole, keine neue Testdatei; `TEST-views-conformance` bleibt an
tests/views.conformance.test.ts gebunden. Bewusst offen: RC-*/readiness nicht per MCP
geprueft (Host dieser Session an bok gebunden), nur Symbolpraesenz.
