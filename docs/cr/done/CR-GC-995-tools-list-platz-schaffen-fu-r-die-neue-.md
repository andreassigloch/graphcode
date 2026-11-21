# CR-GC-995: tools/list: Platz schaffen für die neue Eingabe von graph_test_ingest (Texte von audit_trail und graph_elements kürzen)

**Typ:** aus Item ITEM-2026-1564 (idea)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1564.json (Lane: code)

---

## Befund

`tools/list` trägt 28.295 Zeichen für alle Werkzeuge; die Schranke in `tests/mcp.agent-agnostic.test.ts` (d) steht bei 28.300 und darf nur sinken. Die neue Eingabe von `graph_test_ingest` (CR-GC-992) ist eine Vereinigung mit drei Varianten und braucht rund 800 Zeichen mehr als das flache Objekt. Die Schranke bleibt unverändert; dieser CR schafft den Platz.

## Änderung

Zwei Werkzeuge tragen Beschreibungen, die dieselbe Aussage mehrfach machen:

| Stelle | Vorher | Nachher |
|---|---|---|
| `audit_trail`: `includeRulesPassed`, `includeCommands`, `includeIntent` | Begründung mit Messwerten (129 KB von 163 KB), Verweis auf den Replay-Merge, Wiederholung von „OFF by default“ | Was das Feld liefert, dass es aus ist, und der eine Grund (Umfang) |
| `graph_elements`: `format` | wiederholte den Text der Werkzeugbeschreibung (Format-E, `### <TYPE>`, Codec) | ein Satz: `'json'` oder `'formatE'` |

Gemessen mit der Zählung der Schranke (`JSON.stringify(tool).length`, Summe über alle Werkzeuge): 28.295 vorher, 27.564 nachher (minus 731). Kein Verhalten ändert sich; kein Test prüft diese Texte (`grep` über `tests/`: nur `audit.rules-passed.test.ts` nennt `rulesPassed`, prüft aber die Antwort, nicht den Text).

Gezählt: 2 Quelldateien, 1 CR.

## Akzeptanz

- [x] `tests/mcp.agent-agnostic.test.ts` (d) grün bei unveränderter Schranke 28.300.
- [x] `npm run build` grün.

---

## Entscheidungen

Keine: der CR kürzt Texte; die Schranke bleibt die von CR-GC-722.

## Umfang laut `graph_impact`

Wurzeln: `FUNC-audit-trail` (`src/surface/audit.ts`); `graph_elements` (`src/surface/read.ts`) hat keinen eigenen FUNC-Knoten mit `realRef` auf die Beschreibung.
