# CR-GC-761: Sicht cr-list streichen — die Änderungsliste (changelog) ersetzt sie

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-782 (idea)
**Erstellt:** 2026-10-08
**Item:** bok/items/ITEM-2026-782.json (Lane: code)

---

## Entscheidung des Autors (2026-10-08)

„Die cr-list da auch weg, wird durch Change Log ersetzt." Die Sicht `cr-list` listet jeden CR-Knoten mit Kennung,
Titel, Status und – aufklappbar – seiner Beschreibung. Die Änderungsliste (`changelog`) zeigt dieselben CR-Knoten mit
Kennung, Status und Titel, zusätzlich nach Meilenstein gruppiert und mit Summenzeile. Zwei Sichten auf eine Menge.

Was wegfällt, ist allein der aufklappbare Beschreibungstext. Der gehört ohnehin nicht in den Graphen: der CR-Text
steht in `docs/cr/`, der CR-Knoten trägt nur Kennung, Titel, Status und Umfangs-Kanten.

Der Viewer (graph-view-edit) führt `cr-list` bereits nicht mehr als Sicht; er filtert die Kennung dort lokal aus dem
Katalog. Dieser Filter entfällt, sobald der Katalog sie nicht mehr nennt.

## Was gestrichen wird

| Datei | Änderung |
|---|---|
| `src/projections/exporter.ts` | `renderCrList` und der Zweig `cr-list` entfallen; Kopfkommentar nennt die Sicht nicht mehr |
| `src/surface/scaffold-docs.ts` | Zeile `cr-list` in `VIEW_BLURBS` entfällt |
| `scripts/export-graph.mjs` | Kopfkommentar: `cr-list.md` entfällt |
| `docs/views/cr-list.md` | gelöscht |
| `tests/exporter.test.ts`, `tests/mcp.export.test.ts` | `cr-list` aus den Foundation-Listen; der Test „cr-list lists CR nodes" entfällt. Neu: `cr-list` ist keine Sicht mehr, und jeder CR-Knoten steht in `changelog` |
| Graph: `FUNC-export-markdown` | Beschreibung nennt `cr-list` (und das längst gestrichene `spec`) nicht mehr — per `graph_mutate`, im selben CR |

## Abhängigkeit

Die View-Kennung selbst (`MARKDOWN_VIEWS`, `VIEW_FILENAMES`) liegt in `@sigloch/graphcode-client`
(`sigloch-modules/packages/graphcode-client/src/view-catalog.ts`). Sie fällt dort mit einem eigenen CR — der ist
**noch nicht angelegt**. Ohne ihn lässt `MarkdownViewSchema` die Kennung weiter zu, und `exportMarkdown` hätte für
sie keinen Zweig mehr. Reihenfolge wie bei der Sicht `trade` (CR-GC-756 gegen CR-SM-400): erst der Katalog, dann
dieser CR.

## Abnahme

- `verify:code` und `verify:full CR-GC-761` grün gegen den Katalog ohne `cr-list`.
- `MarkdownViewSchema` weist `cr-list` ab; ein Export schreibt keine `docs/views/cr-list.md` mehr.
- Jeder CR-Knoten des Graphen erscheint in `changelog` (Test, nicht Augenschein).

---

## Umfang laut `graph_impact`

Noch nicht gemessen — die Tabelle oben stammt aus einer Textsuche nach `cr-list` über `src/`, `scripts/`, `tests/`
und `docs/` (ohne `docs/cr/done`). Vor dem Löschzug:

- `graph_impact(FUNC-export-markdown)`: welche `satisfy`, `io`, `compose` hängen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- `/se-umbau` führt die Reihenfolge.
