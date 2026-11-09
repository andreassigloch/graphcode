# CR-GC-897: Sitzungsbeginn: Einstieg über CR und graph_context statt ganzes Modell

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1273 (finding)
**Erstellt:** 2026-11-09
**Item:** bok/items/ITEM-2026-1273.json (Lane: code)

---

Befund aus immo-infra, gemessen an 8 Sitzungsprotokollen 2026-10-23..11-09: Eine neue Sitzung startet mit 51 k Token (Systemprompt, CLAUDE.md, Werkzeuge) und braucht dann 22..78 Züge bis zur ersten Änderung. Danach liegt ihr Kontext bei 140..296 k, also so hoch wie in einer alten Sitzung. Bis zur ersten Änderung kostete das 2,2..11,9 M Token. Eine Hauptsitzung lief 11 Tage, wurde rund 12-mal zusammengefasst und kostete im Schnitt 203 k Token je Zug.

Was die Sitzung in dieser Zeit tut (wiederholt sich in jeder Sitzung):
- sucht die Governance-Dateien (`find / -maxdepth 6 … ITEM-UND-CR.md`), weil CLAUDE.md `bok/docs/governance/…` ohne absoluten Pfad nennt;
- liest `docs/graph/*.graph.json` roh mit node/python und entdeckt dabei jedes Mal die Struktur `elements`/`traces` neu;
- lädt das ganze Modell per graph_elements (UC, ACTOR, MOD, FUNC bis 200, FCHAIN, alle io- und allocate-Kanten);
- lädt graphcode-Werkzeuge in 5..7 einzelnen ToolSearch-Aufrufen, liest `aise --help`;
- liest veraltete Prosa-Dateien des Projekts.

## Änderung
1. GRAPHCODE.md-Vorlage (`src/surface/scaffold-templates.ts`): Abschnitt „Sitzung beginnen“ — eine Sitzung = ein CR oder eine Gruppe unabhängiger CRs; Einstieg über die CR-Datei und `graph_context` ihrer Träger, nie über graph_elements des ganzen Modells; `graph.json` nie roh lesen; alle Leser in einem ToolSearch laden; neue Sitzung nach jedem Meilenstein oder ab rund 150 k Token Kontext. Spec-Arbeit und Nebenthemen in eigene Sitzungen.
2. Scaffold schreibt den absoluten Pfad der Familien-Governance (aus family.json/bok) in den Verweis der CLAUDE.md bzw. GRAPHCODE.md.
3. se-retro: neue Kennzahl „Einstieg“ — Züge, Kontext und Token bis zur ersten Änderung je Sitzung, und Kontext je Zug im Schnitt.

## Akzeptanzkriterien
- Vorlage enthält den Abschnitt; Scaffold-Test prüft ihn und den absoluten Pfad.
- se-retro meldet die Kennzahl „Einstieg“ für immo-infra (Vergleich: heute 22..78 Züge, Ziel unter 10 Zügen und unter 100 k Kontext bei der ersten Änderung).

---

## Umfang laut Modell

- `FUNC-harness-cli` (schreibt GRAPHCODE.md, Vorlage `src/surface/scaffold-docs.ts` `guardrailsContent`),
  `FUNC-se-retro` (`.claude/commands/se-retro.md`, rechnet mit `scripts/retro-kpi.mjs`).
- `REQ-sitzung-einstieg` (neu, unter `UC-loop-closure`), verify durch `TEST-sitzung-kpi`
  (`tests/sitzung-kpi.test.ts`).

## Ergebnis

- Punkt 1: GRAPHCODE.md-Vorlage, Abschnitt „Starting a session" — eine Sitzung je CR oder Gruppe,
  Einstieg ueber CR-Datei und `graph_context` der Traeger, nie `graph_elements` ueber das ganze Modell,
  alle Leser in einem Aufruf laden (wenn der Host Schemas nachlaedt), neue Sitzung je Meilenstein oder
  ab rund 150 k Kontext, Spec-Arbeit und Nebenthemen in eigenen Sitzungen. Nebenbei korrigiert: der
  Satz „run `npm install` first" — seit CR-GC-900 installiert `init` selbst.
- Punkt 2 nicht in graphcode umgesetzt: graphcode ist oeffentlich und kennt die Familie nicht; ein
  `family.json` gibt es nicht. Der Verweis `bok/docs/governance/…` steht in der Projekt-CLAUDE.md, die
  die Familie schreibt. Abgegeben als ITEM-2026-1279 an bok.
- Punkt 3: `scripts/retro-kpi.mjs` — `zuege()` fasst die Protokollzeilen je `message.id` zu einem Zug
  zusammen (ohne Subagenten), `einstieg()` liefert Zuege, Kontext und Token bis zur ersten Aenderung
  (Edit/Write/graph_mutate) und den Kontext je Zug; `--protokoll <jsonl> [...]` druckt die Tabelle.
  se-retro Version 3 nennt die Kennzahl mit Ziel (< 10 Zuege, < 100 k Kontext) und ihre Deutung.
- Test: 5 Faelle; gegen den alten Code alle 5 rot.
- Messung an den 8 juengsten Sitzungen von immo-infra (`~/.claude/projects/-Users-andreas-Developer-prod-immo-infra`):
  Zuege bis zur ersten Aenderung 3, 17, 23, 28, 31, 33, zweimal keine Aenderung; Kontext dabei
  53..171 k; Kontext je Zug 68..220 k. Ausgangswert fuer das Ziel unter 10 Zuegen und 100 k.
- Erster Volllauf rot 3, alle aus diesem CR: GRAPHCODE.md ueber 6.000 Zeichen und mit Werkzeugnamen
  (CR-GC-612: Hausregeln nennen keine Werkzeuge), se-retro nannte als lesender Skill `graph_mutate`.
  Abschnitt ohne Werkzeugnamen neu gefasst („context slice of its carriers"), „What is here" und
  „Live view and lifecycle" gekuerzt ohne Regel zu streichen: 5.676 Zeichen.
