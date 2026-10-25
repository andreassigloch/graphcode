# CR-GC-761: Sicht cr-list streichen — die Änderungsliste (changelog) ersetzt sie

**Status:** ✅ Done (2026-10-25)
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

`graph_impact(FUNC-export-markdown)` am 2026-10-25: keine Kante hängt an der Sicht selbst. Betroffen ist nur die Beschreibung von `FUNC-export-markdown`, die noch `spec` und `cr-list` nannte.

## Ergebnis

Umgesetzt am 2026-10-25 gegen die Arbeitskopie von graphcode-client mit CR-SM-403.

- `renderCrList` und der Zweig `cr-list` in `exporter.ts` sind gelöscht, ebenso die Zeile in `VIEW_BLURBS`.
- `.gitignore`: die Regel für `docs/views/cr-list.md` ist gelöscht. Keine Sicht erzeugt die Datei mehr; die lokale Kopie ist entfernt.
- `scripts/export-graph.mjs` nennt die Sichten nicht mehr einzeln, sondern verweist auf `MARKDOWN_VIEWS`.
- Tests: `MarkdownViewSchema` weist `cr-list` ab, und jeder CR-Knoten des Graphen steht in `changelog`. Der Export schreibt 13 Sichten.
- Mindestversion `@sigloch/graphcode-client ^3.1.0`, die Version des Zugs mit CR-SM-403. Bis zum Publish sind `lockfile-sync` und `distribution` rot.
- Modell: Die Beschreibung von `FUNC-export-markdown` nennt die Sichten aus `MARKDOWN_VIEWS`.
- graph-view-edit braucht keine Änderung: sein Filter `REMOVED_DOC_VIEWS` filtert dann nichts mehr. Ihn zu löschen ist eine Aufräumarbeit in graph-view-edit, kein Teil dieses CR.
