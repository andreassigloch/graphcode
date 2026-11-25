# CR-GC-1029: Änderungs-Heatmap schärfen: Tool-Definitionen als eigene Symbole, Commits ohne CR-Nummer nach ITEM und Release einordnen

**Typ:** aus Item ITEM-2026-1674 (finding)
**Erstellt:** 2026-11-25
**Item:** bok/items/ITEM-2026-1674.json (Lane: graph)

---

## Ziel

Die Heatmap aus CR-GC-1028 soll Umbauten begründen. Zwei Messfehler verzerren sie:

- Die Tools einer bind-Funktion (`bindReportTools`, `bindWriteTools`, `bindSuggestTools`) zählten als ein Symbol. Platz 3, 5 und 7 im Pareto waren damit Sammelposten getrennter Änderungen.
- 380 von 3.546 Datei-Änderungen trugen keine CR-Nummer. Sie zählten nicht als Nacharbeit, ohne dass die Seite sagte, was sie sind.

## Zug

1. Neuer Config-Schlüssel `teilsymbole`: Muster für Definitionen innerhalb einer Funktion, Gruppe 1 = Name. Für graphcode `^  const ([A-Za-z0-9_$]+): MCPTool<`, das trifft alle 23 Tools.
2. `gitXfunc()` hängt diese Muster an das git-xfuncname an, damit der Hunk-Kopf auch bei `-U0` das Tool nennt.
3. Der Auftrag eines Commits ist die erste CR-Nummer, sonst die erste ITEM-Nummer. Das Feld heißt `auftrag`, die Ausgabe `auftraege` statt `crs`.
4. `grenzen` nennt `item` und `ohneAuftrag` getrennt; die Seite zeigt beide.
5. Ein Muster für Release-Commits war geplant und wurde gestrichen: Release-Commits ändern 0 Quelldateien im Messbereich.

## Dateien (6)

`scripts/aenderungs-heatmap.mjs`, `scripts/aenderungs-heatmap.config.json`, `scripts/aenderungs-heatmap.html`, `tests/aenderungs-heatmap.test.ts`, `docs/messung/aenderungs-heatmap.html`, diese Datei.

## Abnahme

- `tests/aenderungs-heatmap.test.ts`: 7 von 7 grün (2 neu: Teilsymbol-Erkennung, Zuordnung zum Tool mit ITEM als Auftrag).
- Gegenprobe: Ohne die Teilsymbol-Muster im git-xfuncname wird der Zuordnungstest rot. Danach ist das Muster wieder drin.
- `npm run type-check`: 0 Fehler.
- Lauf auf den echten Repos: 1,6 s; die Seite rendert ohne `undefined`/`NaN`.

## Was sich an der Messung ändert (Stand 2026-11-25)

- Die drei bind-Funktionen fallen aus dem Pareto. Als einzelnes Tool bleibt `graph_mutate` mit 35 Änderungen darin.
- Neu im Pareto: `GRAPH_VIEW_DESCRIPTORS` (GVE, 34) und `V3_RULES` (SM, 34).
- Die 10 meistgeänderten Symbole tragen 8,6 % von 6.028 Symboländerungen.
- 11 Datei-Änderungen hängen nur an einer ITEM-Nummer. 369 haben keinen Auftrag; sie stammen aus 128 `feat:`/`fix:`/`refactor:`-Commits ohne Nummer, die meisten in SM (114 feat) und GVE (73 feat).

## Offen und benannt

- **Arbeit ohne Auftrag:** 369 Datei-Änderungen bleiben ohne Auftrag. Das ist kein Messfehler, sondern Arbeit ohne CR oder Item.
- **Teilsymbol ohne Eltern:** Ein Tool heißt im Pareto nur mit seinem Namen. Zeilen nach dem letzten Tool einer bind-Funktion (z. B. `return [...]`) zählen zum letzten Tool.
- **Modell:** Die MCP-Verbindung der Sitzung lief ab. Ein eigens gestarteter Host hat den vorgemerkten CR-Knoten (`aise doctor --fix`) und die `relation`-Kante auf `FUNC-aenderungs-heatmap` durchs Gate geschrieben.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | | |

---

## Umfang

`CR-GC-1029 -relation-> FUNC-aenderungs-heatmap` (aus CR-GC-1028). Kein neuer Knoten. `TEST-aenderungs-heatmap` ist mitgeändert, aber kein Kantenziel: R-18 lässt `CR → TEST` nicht zu.

Volllauf: `npm run verify:full CR-GC-1029` — 356 von 356 Testdateien grün, Schlupf 0.
