# CR-GC-910: import-doc als Werkzeug der Tool-Schicht statt Skript: Bestand einlesen in jedem MCP-Host

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1297 (idea)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1297.json (Lane: code)

---

## Befund

`FUNC-import-doc` ist heute der Skill `.claude/commands/se/import-doc.md`. Er schreibt ein
Skript nach `.graphcode/tmp/`, führt es mit `npx tsx` aus, braucht `pdftotext` auf dem PATH und in
Stufe 2 einen OpenAI-kompatiblen LLM-Endpunkt (`LLM_BASE`, `LLM_MODEL`), durch den graphify das
Dokument slict. Das läuft nur in Claude Code mit Shell. In Claude Desktop, claude.ai und über einen
gehosteten MCP-Eingang (Konzept im Repo graphspec, `docs/project/zugang-fuer-spezifizierer.md`) gibt es keine Shell und
keinen eigenen LLM-Endpunkt: dort fällt der Use Case „Bestand erschließen" (CR-GC-905) aus, obwohl er
genau für diese Zielgruppe gedacht ist.

Von 25 se-Skills brauchen 21 nur die Graph-Werkzeuge. import-doc ist der eine, der für die Zielgruppe
Spezifikation fehlt. import-code bleibt beim Entwickler (Repo, Tree-sitter), das ist kein Mangel.

## Zielbild

1. **Stufe 1 wird ein Werkzeug der Tool-Schicht:** `graph_import_doc_structure({documents})` nimmt
   Text (Markdown, Text, PDF als Base64) entgegen und liefert das Skelett aus graphifys
   `handleMcpStructure` plus den Typ-Vorschlag je Knoten nach der Tabelle im Skill, deterministisch,
   0 LLM. `pdftotext` bleibt die Voraussetzung für PDF; fehlt es, nennt das Ergebnis das und nimmt
   Text weiter an.
2. **Stufe 2 macht der Host-Agent, nicht ein Sidecar.** Die Extraktion je Skelett-Knoten schreibt der
   Agent des Nutzers als Format-E durch `graph_mutate`, geführt von der Anleitung (Typ-Entscheidungen,
   verify-Zuordnung, Merge adds-only, nie Reseed). graphcode stellt damit keine Inferenz bereit und
   verwaltet keine Schlüssel. Der LLM-Endpunkt in Stufe 2 des Skills entfällt; es gibt einen Pfad,
   nicht zwei.
3. **Der Skill wird die Anleitung dieses Werkzeugs:** `se/import-doc.md` ruft Stufe 1 als Werkzeug und
   führt Stufe 2 im Chat. Kein Skript mehr in `.graphcode/tmp/`, keine `LLM_*`-Variablen.
   `TEST-import-doc-modell` (kein Modellname im Skill) bleibt gültig und wird auf das Werkzeug
   ausgeweitet.
4. **Modell:** `FUNC-import-doc` bekommt den `realRef` auf das Werkzeug, die Anleitung bleibt als
   eigene FUNC am Skill, beide hängen an der Kette, die CR-GC-905 für „Bestand einlesen" festlegt.
   Entscheidung des Auftraggebers im Zug: Reihenfolge zu CR-GC-905 (UC zuerst, dann dieses
   Werkzeug an seine Kette).

## Entscheidung, die der Auftraggeber im Zug trifft

Die lokale Extraktion über graphify (Stufe 2 mit `LLM_MODEL`) ist gemessen im Rig, die Extraktion
durch den Host-Agenten nicht (Leitlinie T-N3: nicht gemessen). Vor dem Löschen der Sidecar-Stufe:
ein Lauf mit demselben Dokument auf beiden Wegen, Vergleich der Knoten- und Kantenzahl und der
Gate-Verstöße. Ist der Host-Weg schlechter, bleibt der Sidecar-Weg für Claude Code, und dieser CR
wird als Folge-CR geteilt.

## Abgrenzung

- Kein Hochladen von Dateien in den Store; das Dokument ist nur Eingabe des Werkzeugaufrufs.
- Zusammenführen von Dubletten ist Teil von CR-GC-905, nicht dieses CR.
- Der gehostete Eingang selbst (Transport, Login, Container) ist Konzept, kein CR.

## Akzeptanz

1. `graph_import_doc_structure` liefert für ein Markdown-Testdokument dasselbe Skelett wie das heutige
   Skript (Known-Answer aus `tests/`), mit Typ-Vorschlag je Knoten.
2. Der Skill enthält kein `npx tsx`, kein `.graphcode/tmp/`, keine `LLM_*`-Variable;
   `tests/skill-import-doc-modell.test.ts` prüft das.
3. Ein Durchlauf in Claude Desktop (kein Terminal): Dokument einfügen, Skelett sehen, Typen
   entscheiden, Knoten durchs Gate, Ergebnis im Protokoll des CR.
4. Vergleichsmessung Sidecar gegen Host-Agent dokumentiert im CR, mit Entscheidung.

## Umfang (≤ 10 Dateien)

`src/surface/import-doc-tool.ts` (neu), `src/surface/mcp-tools.ts`, `.claude/commands/se/import-doc.md`,
`tests/import-doc-tool.test.ts` (neu), `tests/fixtures/import-doc/*.md` (ein Testdokument),
`tests/skill-import-doc-modell.test.ts`, `README.md`.

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1055, Tiefe 1, Wurzeln: `FUNC-import-doc`._

Reichweite: 3 Elemente (FLOW 1, FUNC 2); Blackbox-Rand 2, nicht geoeffnet.

Dateien (realRef, 1):
- .claude/commands/se/import-doc.md

Tests (`graph_tests`, 2):
- tests/mutate-violations-leser.test.ts
- tests/skill-import-doc-modell.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
