# CR-GC-909: SRS-Sicht nach ISO 29148 Annex A gliedern, Sichten als PDF und Word ausgeben

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1296 (idea)
**Erstellt:** 2026-11-11
**Item:** bok/items/ITEM-2026-1296.json (Lane: code)

---

## Befund

Die Norm-Prüfung vom 2026-09-26 (`docs/archive/spikes/SPIKE-GC-norm-dokumentanteil-RESULTS.md`,
Klasse 1) stuft die SRS-Sicht als „teilweise" ein: SyRS/SRS und OpsCon stehen in eigener Gliederung
(`src/projections/srs.ts`, Abschnitte 1–9: Scope, Akteure, Use Cases, Schnittstellen, Schemata,
Architektur, Cross-cutting, Verifikation, Traceability). Die Gliederung der Informationsobjekte aus
ISO/IEC/IEEE 29148:2018 Kl. 9 fehlt: BRS und StRS gibt es nicht, die SyRS-Abschnitte Usability,
Physical, Environmental und Sustainment fehlen als Gliederung. Der Inhalt dafür steht im Modell
(`kinds` der REQ, ACTOR, SYS, MOD), nur die Sicht ordnet ihn nicht so.

Die Sichten liegen nur als Markdown vor. Wer eine Spezifikation liefert, braucht PDF (Lieferung an
Stakeholder) und Word (Review mit Kommentaren im Fachbereich). Beides erzeugt graphcode heute nicht;
PDF geht nur über ein privates Werkzeug außerhalb des Repos.

Zielgruppe: Spezifikation (`docs/project/vorfuehrung-bausteinkonzept.md`, Konzept
`docs/project/zugang-fuer-spezifizierer.md` im Repo graphspec). Für den Entwickler ändert sich nichts.

## Zielbild

1. **SRS-Gliederung nach 29148 Kl. 9.** `srs.ts` rendert die SyRS-Gliederung der Norm; jeder
   Abschnitt der Norm ist eine Überschrift, auch wenn er leer ist (dann mit dem Satz „keine
   Anforderung dieser Art im Modell"). Die Zuordnung REQ → Abschnitt kommt aus `kinds` und dem
   `satisfy`-Träger, deterministisch, ohne neues Attribut. BRS und StRS werden als eigene Abschnitte
   derselben Sicht gerendert (Geschäftsziele = SYS-Beschreibung und UC, Stakeholder = ACTOR), nicht
   als neue Views. Reihenfolge der Abschnitte und ihre Namen stehen als Tabelle in `srs.ts`, nicht
   verstreut im Code.
2. **Ein Render-Verb** `graphcode render <view> --format md|docx|pdf [--out <datei>]` in
   `src/surface/render-verb.ts`, Lifecycle wie `import-code-verb.ts` (kein Parallelweg). Markdown
   bleibt die Quelle; docx und pdf entstehen aus demselben Markdown über `pandoc`, das wie
   `pdftotext` auf dem PATH erwartet wird. Fehlt pandoc, nennt das Verb den Installationsbefehl und
   endet mit Exit-Code 2. Vorlagen (`reference.docx`, eine CSS-Datei) liegen unter
   `docs/vorlagen/`; die Firmen-CI ist nicht Teil des Repos.
3. **PDF-Engine ist eine Entscheidung des Auftraggebers im Zug:** pandoc über HTML mit einer CSS-Datei
   (`--pdf-engine=weasyprint`) oder das vorhandene md2pdf aus siconizer als externer Befehl. Der CR
   nennt die Wahl im Ergebnis.
4. README nennt das Verb und die Voraussetzung pandoc.

## Abgrenzung

- ReqIF-Export, Attribute Owner/Risiko/Rationale, Sequenzsicht und SysML bleiben im Konzept
  `docs/project/zugang-fuer-spezifizierer.md` im Repo graphspec, kein Teil dieses CR.
- Rücklauf von Word-Kommentaren in das Modell ist Handarbeit über den Chat; kein Round-Trip.

## Akzeptanz

1. `docs/views/srs.md` trägt die Abschnitte der 29148-Gliederung in Normreihenfolge; leere Abschnitte
   stehen mit dem Leersatz. `tests/views.conformance.test.ts` prüft Reihenfolge und Vollständigkeit
   der Überschriften gegen die Tabelle in `srs.ts`.
2. Byte-identische Ausgabe bei gleichem Graph (Determinismus bleibt; `tests/exporter.test.ts`).
3. `graphcode render srs --format docx` erzeugt eine Datei, die `pandoc` zurück nach Markdown liest und
   die alle Überschriften der Quelle enthält (`tests/render-verb.test.ts`, übersprungen mit Hinweis,
   wenn pandoc fehlt — kein stilles Grün).
4. `graphcode render srs --format pdf` erzeugt eine PDF mit mindestens einer Seite je Abschnitt 1
   (Smoke, von Hand, Ergebnis im CR).
5. Ohne pandoc: Hinweis mit Installationsbefehl, Exit-Code 2, keine leere Datei.
6. Norm-Prüfung Klasse 1 im Spike-Dokument auf „ja" nachgezogen, mit Datum.

## Umfang (≤ 10 Dateien)

`src/projections/srs.ts`, `src/surface/render-verb.ts` (neu), `src/cli.ts`, `README.md`,
`docs/vorlagen/reference.docx` (neu), `docs/vorlagen/srs.css` (neu), `tests/views.conformance.test.ts`,
`tests/render-verb.test.ts` (neu), `docs/views/srs.md` (generiert).

---

## Umfang laut `graph_impact`

_Schnitt aus dem Modell bei `dispatch prepare` — graphVersion 1054, Tiefe 1, Wurzeln: `FUNC-export-markdown`, `FUNC-graph-export-snapshot`._

Reichweite: 12 Elemente (FLOW 8, FUNC 4); Blackbox-Rand 6, nicht geoeffnet.

Dateien (realRef, 3):
- src/projections/export.ts
- src/projections/exporter.ts
- src/surface/import-code-verb.ts

Tests (`graph_tests`, 13):
- tests/auto-export.test.ts
- tests/contracts.kernel.test.ts
- tests/export-graph-guard.test.ts
- tests/exporter.test.ts
- tests/flow-contracts.test.ts
- tests/harness.import-rejected-traces.test.ts
- tests/mcp.export-guard.test.ts
- tests/mcp.export.test.ts
- tests/mcp.member-name.test.ts
- tests/se-plan.groups.test.ts
- tests/view-fmea.test.ts
- tests/views.auditor.test.ts
- tests/views.conformance.test.ts

- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

---

## Ergebnis (2026-11-12)

Entscheidungen des Auftraggebers am 2026-11-12:
- **PDF-Engine:** pandoc über HTML mit weasyprint.
- **Zuordnung REQ → Abschnitt (Vorschlag A):**

  | kinds | satisfy-Träger | Abschnitt |
  |---|---|---|
  | functional | beliebig | 3.3.1 Functional requirements |
  | non-functional | FCHAIN oder FUNC | 3.3.3 Performance requirements |
  | non-functional | MOD | 3.3.7 Physical characteristics |
  | non-functional | SYS oder keiner | 3.3.11 Policies and regulations |

  Eine REQ ohne `kinds` gilt als functional.

**SRS-Gliederung** (`src/projections/srs.ts`):
- Die Gliederung steht als Tabelle `SRS_OUTLINE`, die Zuordnung als Funktion `srsSection`.
- 1 BRS: Business purpose ist die SYS-Beschreibung; Mission, goals and objectives sind die UC.
- 2 StRS: Stakeholders sind die ACTOR.
- 3 SyRS: Introduction, References, System requirements 3.3.1–3.3.13, Verification, Appendices.
  - System interfaces enthält FLOW und SCHEMA.
  - Physical characteristics enthält den MOD-Baum mit seinen non-functional REQ.
  - Die Traceability-Zeile steht am Ende von Verification.
- Ein leerer Abschnitt trägt „— keine Anforderung dieser Art im Modell —“.
- Am eigenen Modell: 1092 REQ-Einträge (vorher 1094). Davon stehen 35 in Performance, 42 in
  Physical characteristics und 9 in Policies.

**Verb** `graphcode render <view> --format md|docx|pdf [--out <datei>]` (`src/surface/render-verb.ts`):
- Lifecycle wie `executeImportCode`.
- Die Vorlage für PDF ist `docs/vorlagen/srs.css` im Repo, in dem das Verb läuft. Fehlt sie, nennt
  die Zusammenfassung `vorlage: null`.

Abweichungen vom Umfang:
- `docs/vorlagen/reference.docx` ist nicht angelegt. Ohne Firmen-CI wäre sie die Vorlage, die pandoc
  ohnehin mitbringt.
- Statt `tests/views.conformance.test.ts` trägt `tests/exporter.test.ts` den Gliederungstest. Diese
  Datei musste wegen der alten Nummerierung ohnehin mit.
- `src/surface/cli-args.ts` bekam den Eintrag für `render` (CR-GC-886: kein Verb ohne Argumentprüfung).

**Modellzug (graphVersion 1112).** Der erste Volllauf meldete RC-09: `render-verb.ts` parst
`MarkdownViewSchema`, und das Modell kannte die Datei nicht als Übersetzer dieses Vertrags.
Neu im Modell:
- `FUNC-render-verb` mit realRef auf `executeRender`, unter Bedienung, in MOD-surface.
- Kette `FCHAIN-render-document` „Sicht als Datei ausgeben“ unter `UC-model-exchange`, mit den
  Gliedern CLI-Einsprung, Verb und `exportMarkdown`.
- Flüsse:
  - Auftraggeber → CLI-Aufruf → CLI-Einsprung
  - Verb → Sichtauftrag (an `SCHEMA-markdown-view`) → `exportMarkdown` → Markdown → Verb
  - Verb → Datei → Auftraggeber
- `REQ-render-document`, geprüft von `TEST-render-verb` (`tests/render-verb.test.ts`).
- `REQ-srs-29148`, geprüft von `TEST-doc-export` (`tests/exporter.test.ts`).
- Relationen vom CR-Knoten an die neuen Elemente.
- Vier Flüsse für die Aufrufe, die die Commit-Prüfung (RC-13) verlangt: Harness anlegen, Store
  öffnen, Erstbefüllung und Store schließen (graphVersion 1114). Muster wie bei `import-code`.

Das Gate meldet keinen neuen Befund. Der Steuerwert steigt von 8,002 auf 8,252, weil MOD-surface und
der Block Bedienung je ein Kind mehr tragen.

**11 Dateien statt 10 (Ausnahme, Entscheidung des Auftraggebers 2026-11-12):**
- `srs.ts`, `render-verb.ts`, `cli.ts`, `cli-args.ts`, `README.md`, `docs/vorlagen/srs.css`
- `tests/exporter.test.ts`, `tests/render-verb.test.ts`
- die Normprüfung im Spike-Dokument
- `scripts/model-test-set.mjs`: Ausschluss der neuen Testdatei aus der Modell-Spur, mit Grund
- `tests/arch.optimization-dry-run.spike.test.ts`: Neumessung der Autopilot-Züge nach dem Modellzug

Generiert und nicht gezählt: `docs/graph`, `docs/views` und `docs/messung`.

**Volllauf** `npm run verify:full CR-GC-909`: Der zweite Lauf hatte einen roten Test. Er lag in der
Auswahl, es gab keinen Schlupf. Es war die Messstelle der Autopilot-Züge; nach der Neumessung ist
sie grün. Die Folge ohne Schlupf steht auf 0/10, weil der erste Lauf 2 rote Tests außerhalb der
Auswahl hatte (RC-09 und Modell-Spur, beide oben behoben).

Abnahme:
1. ✓ `docs/views/srs.md` trägt die 29 Abschnitte in Normreihenfolge, leere mit dem Leersatz.
   `exporter.test.ts` prüft Reihenfolge, Tiefe und Vollständigkeit gegen `SRS_OUTLINE`, am eigenen
   Graphen und am leeren Graphen.
2. ✓ Der Determinismus-Test in `exporter.test.ts` ist grün.
3. ✓ `render-verb.test.ts`: pandoc liest die docx zurück, und jede Überschrift der Quelle steht
   darin. Gegenprobe: Mit einer entfernten Überschrift wird der Test rot. Fehlt pandoc, ist der Fall
   sichtbar übersprungen, mit Warnung.
4. ✓ Smoke von Hand am Snapshot (Temp-Repo):
   - `render srs --format pdf`: 367 Seiten, 2,1 MB, 14 s, Vorlage verwendet.
   - Abschnitt 1 (BRS) füllt Seite 2.
   - `--format docx`: 514 KB.
5. ✓ Mit leerem PATH: „pandoc fehlt auf dem PATH. Installieren: brew install pandoc …“, Exit 2,
   keine Datei.
6. ✓ Die Normprüfung nennt Klasse 1 „ja (2026-11-12, CR-GC-909)“, mit Nachtrag zur Gesamtzahl.

### Offene Punkte

1. **Das Verb öffnet den Store selbst.** Läuft ein MCP-Host, endet es mit „store already owned“.
   Ein Weg über den Host-Socket wäre ein eigener CR.
2. **Leere Abschnitte bleiben leer.** Usability, Environmental, Security und Sustainment bleiben
   leer, bis die REQ-Art sie unterscheidet. Das wäre eine Änderung an contracts (`ReqKind`).
