# CR-GC-756: Sicht Variantenvergleich streichen

**Status:** ✅ Done (2026-10-07)
**Typ:** aus Item ITEM-2026-766 (idea)
**Erstellt:** 2026-10-07
**Item:** bok/items/ITEM-2026-766.json (Lane: code)

---

## Entscheidung des Autors (2026-10-07)

„Sicht ‚Variantenvergleich' streichen." Die Sicht las die Kanten-Etiketten `decides`, `alternative` und
`superseded-by`. Seit CR-GC-755 schreibt kein Skill sie mehr: eine Entscheidung ist ein erledigter Auftrag, und die
Änderungsliste (`changelog`) zeigt jeden erledigten Auftrag.

## Was gestrichen wird

| Datei | Änderung |
|---|---|
| `src/projections/graphcode.ts` | `renderTrade` entfällt |
| `src/projections/exporter.ts` | Import und Zweig `trade` entfallen |
| `src/surface/scaffold-docs.ts` | Zeile `trade` in `VIEW_BLURBS` entfällt |
| `src/projections/help-content.ts` | Verweis auf `se-view:trade` → Änderungsliste |
| `.claude/commands/se-view/trade.md`, `docs/views/trade.md` | gelöscht |
| `README.md` | Zeile `se-view:trade` entfällt |
| `tests/exporter.test.ts`, `tests/views.conformance.test.ts` | Sicht-Tests entfallen; neu: `trade` ist keine Sicht mehr, die Entscheidung steht in der Änderungsliste |

Die View-Kennung selbst (`MARKDOWN_VIEWS`, `VIEW_FILENAMES`) liegt in `@sigloch/graphcode-client` und fällt mit
CR-SM-400. Der Analyse-Schritt `trade` (Skill `se-trade`, Regel AF-02, Vermerk) bleibt.

## Abnahme

- `verify:code` und `verify:full CR-GC-756` grün gegen den Katalog aus CR-SM-400.
- `MarkdownViewSchema` weist `trade` ab; ein erledigter Entscheidungs-Auftrag erscheint in `changelog`.
