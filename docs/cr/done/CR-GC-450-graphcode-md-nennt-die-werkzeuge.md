# CR-GC-450 — GRAPHCODE.md nennt die Werkzeuge, nicht nur das Prinzip

**Status:** DONE 2026-08-28 · **Angelegt:** 2026-08-28
**Betrifft:** `src/surface/scaffold-templates.ts` (`guardrailsContent`), `tests/cli.scaffold.test.ts`

---

## Problem

Die Fähigkeiten existieren und werden nicht abgerufen.

Beim Selbstumbau von graphcode am 2026-08-27 (CR-GC-444…447) bewegten die Agenten **810
Modellelemente** — mit **174 Suchoperationen und 0 Aufrufen von `graph_impact`**
(`graph_expand` ebenfalls 0; Messung in CR-DRAFT-GC-448 §KPI). Jede dieser Suchen war eine
Näherung an eine Antwort, die der Graph exakt vorhielt.

Die Ursache liegt in der Vorlage, die jedes Consumer-Repo als Agenten-Vertrag bekommt.
`GRAPHCODE.md` sagte das Prinzip („Entry = MCP query, never a full doc read") und zählte vier
Werkzeugnamen in einem Prosa-Spiegelstrich auf. Eine Namensliste beantwortet keine Frage: der
Agent, der vor „was bricht, wenn ich X ändere?" steht, findet in der Vorlage keine Zuordnung
und greift zum Default-Werkzeug seines Harness — der Suche.

Zweiter Befund derselben Messung: die selektive Testauswahl (`graph_tests`) blieb ungenutzt,
jeder Agent fuhr wiederholt die volle Suite. Auch das stand nirgends in der Vorlage.

## Änderung

`guardrailsContent()` bekommt drei neue/umgebaute Abschnitte, die alte Verweise ersetzen:

1. **`## Ask the graph, don't grep for it`** — die Messung als Anlass, dann eine Tabelle
   *Frage → genau ein Werkzeug* über 12 Zeilen (`graph_impact` · `graph_context` · `realRef` ·
   `graph_expand` · `graph_elements` · `graph_tests` · `rules_get_violations`/`rules_evaluate` ·
   `graph_readiness` · `graph_next_step` · `graph_suggest` · `graph_metrics` · `graph_help`).
   Jede Zeile ist gegen die reale Tool-Beschreibung im Code geprüft, nicht gegen eine Aufzählung.
   Abschließend die ehrliche Abgrenzung: **kein Grep-Verbot** — Grep bleibt richtig für „welche
   Datei enthält diesen String", „wo liegt dieses Symbol", Volltextsuche in Prosa.
2. **`## Which tests to run`** — `graph_tests({changeSet})` ist die innere Schleife, die volle
   Suite das Gate vor dem CR-Abschluss. Die `unresolved`-Liste **muss gelesen** werden: ein
   concept-only TEST hat kein Laufartefakt, der selektive Lauf deckt ihn nicht ab, das Werkzeug
   meldet ihn getrennt statt ihn fallenzulassen.
3. **`## Writing to the model`** — die bisherigen Schreib-Regeln (Gate, OCC, Format-E,
   `graph_export`, Bootstrap-Prosa) an einer Stelle, plus die aus `## Rules` übernommene
   Ontologie-Klausel.

**Gestrichen:**

- `## Rules` als eigener Abschnitt. Store-Single-Writer stand schon unter „What is here",
  Apply-Gate und Ontologie sind nach „Writing to the model" gewandert. **„One transport =
  MCP-stdio, kein Express/REST im Core"** entfällt ersatzlos: das ist ein Constraint an
  graphcodes eigenen Kern, den ein Consumer-Agent gar nicht verletzen kann.
- Der Spiegelstrich „Entry = MCP query" mit seiner Vierer-Namensliste — die Tabelle ist die
  Obermenge.
- Alle graphcode-internen CR-Nummern (8 Stück, in Abschnitts-Überschriften und inline). In einem
  fremden Repo ist `(CR-GC-233)` keine Begründung, sondern eine tote Referenz.
- Der hartkodierte Portbereich `43000-43999` — die Adresse ist dynamisch, die Datei
  `docs/views/dashboard.url` bleibt die einzige Quelle.

**Korrigiert:** `Lifecycle: init | update | remove` → `init | upgrade | remove` (das Verb
`update` gibt es seit CR-GC-377 nicht mehr); der deutsche Satz im Lifecycle-Abschnitt eines sonst
englischen Produkt-Artefakts.

## Abgrenzung

- **`GRAPHCODE.md` ist ein Produkt-Artefakt, kein Repo-Dokument.** Es landet in fremden Repos,
  deren Nutzer die persönlichen globalen Instruktionen des Autors nicht haben. Die Vorlage bleibt
  deshalb **selbsttragend**: nichts wurde gestrichen, nur weil es anderswo ebenfalls steht.
- Keine `bok`-Pfade, keine Familie-Interna, keine CR-Nummern als Autorität.
- Kein Consumer-Repo wird angefasst. **Die zwölf Repos sehen die neue Fassung erst nach dem
  nächsten npm-Publish, wenn dort `graphcode upgrade` läuft** (`scaffold('update')` schreibt
  `GRAPHCODE.md` ohne Preserve neu). `upgrade --check` erkennt den Rückstand über die
  Paketversion — die Vorlage trägt keinen eigenen Inhalts-Drift-Marker, es gibt also keinen
  zweiten Stand nachzuziehen.
- `GRAPHCODE-STEERING.md` (die Fassung für den Menschen) bleibt unverändert.

## Akzeptanz

- [x] `GRAPHCODE.md` trägt den Abschnitt `## Ask the graph, don't grep for it` mit der Messung
      (174 / 810) und einer eigenen Tabellenzeile pro Präzisions-Werkzeug.
- [x] Jede Tabellenzeile benennt, welche Frage das Werkzeug wirklich beantwortet — geprüft gegen
      `src/surface/read.ts`, `src/projections/report.ts`, `src/projections/metrics.ts`,
      `src/loop/suggest.ts`.
- [x] Die Grep-Abgrenzung steht als Erlaubnis da, nicht als Verbot.
- [x] `graph_tests` als innere Schleife, volle Suite als Abschluss-Gate, `unresolved` als
      Lesepflicht.
- [x] Zwei neue Tests in `tests/cli.scaffold.test.ts` (red-first gesehen), die bestehenden
      GRAPHCODE.md-Zusicherungen (CR-GC-207/208/230/306, REQ-S07) weiter grün.
- [x] `npm run build` grün, volle Suite ohne neue Rote gegenüber der Vorlast (20 rot /
      10 Dateien: 2 Publish-Pending + 18 contracts-10-Fixture-Kollateral).
- [x] Zeilenzahl der gerenderten Vorlage: 122 → 153.
