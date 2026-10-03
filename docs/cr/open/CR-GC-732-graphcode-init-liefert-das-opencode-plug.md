# CR-GC-732: graphcode init liefert das OpenCode-Plugin aus, das den Vorschlag ins Eingabefeld legt (gemessen in Probe G/H)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-715 (idea)
**Erstellt:** 2026-10-03
**Item:** bok/items/ITEM-2026-715.json (Lane: code)

---

## Befund

CR-GC-729 legt den `vorschlag` an jede angewandte Mutation. Ohne Client-Seite sieht ihn in OpenCode der Agent
und der Nutzer nicht. In Probe G/H (2026-10-03) trug ein Plugin im Test-Repo: der Agent sah das Feld in keinem
Ergebnis, der Nutzer bekam den Satz ins Eingabefeld (headless: `opencode run` lief fehlerfrei durch).

## Änderung

| Datei | Änderung |
|---|---|
| `.opencode/plugin/graphcode-vorschlag.js` | neu, im Paket: Hook `tool.execute.after` auf `graphcode_graph_mutate` nimmt `vorschlag` heraus, `tui.clearPrompt` + `tui.appendPrompt`, letzter Vorschlag in `.graphcode/vorschlag.txt` |
| `package.json` | `files` + `.opencode/plugin` |
| `src/surface/scaffold-templates.ts` | `OPENCODE_PLUGIN`, `packagedOpencodePlugin()` |
| `src/surface/scaffold.ts` | init/update installieren, remove entfernt (leere Ordner nur, wenn wir sie geleert haben) |
| `src/surface/write.ts` | Beschreibung von `graph_mutate`: `vorschlag` ist für den Nutzer, nicht für den Agenten — für Clients ohne Plugin. In `GRAPHCODE.md` war kein Platz (CR-GC-612: < 6 000 Zeichen, Stand 5 997) |
| `tests/opencode-plugin.test.ts` | Installation, Entfernung neben fremdem Plugin, Hook an echter Mutationsantwort |
| Modell | `TEST-opencode-plugin` verify `REQ-repo-install`, `REQ-repo-uninstall` |

`scaffold.ts` wächst auf 572 Zeilen (vorher 546, Grenze 500) — Schnitt ist eigener Schritt.
