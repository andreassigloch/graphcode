# CR-GC-768: 17 von 21 Wirkketten nicht bewertbar: Saecke, lose Glieder, fehlende Glieder

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-796 (finding)
**Erstellt:** 2026-10-09
**Item:** bok/items/ITEM-2026-796.json (Lane: graph)

---

## Befund

Die Kettenbewertung (Leitlinie §5, T-O1) kann nur über Ketten urteilen, die gerichtet zusammenhängen und
einen Ein- und Ausgang haben. In graphcodes eigenem Modell sind das 4 von 21 (Messung 2026-10-09,
`scripts/spike-kettenkennzahlen.mjs`). Die Regeln melden die Ursachen bereits als Warnungen (FC-05 Kette
zerfällt, R-31/IO-01 Glied ohne Anschluss, R-10 Fluss ohne Abnehmer) — sie wurden nur nie abgearbeitet.

Gegenprobe an anderen Modellen: Energy Manager 11 von 11, sigllm 3 von 4 — Modelle, die unter graphcode-Führung
entstanden, sind von Anfang an bewertbar. Der Bedarf ist Altlast dieses Modells, kein Fehler der Kennzahl.

## Zielbild

Mindestens 17 von 21 Ketten bewertbar (Schwelle 0,8 des Regelkandidaten K-MESSBAR). Jede Kette, die danach
nicht bewertbar bleibt, steht mit Grund in dieser CR.

## Drei Fehlerklassen, je eine Behandlung

| Klasse | Erkennbar an | Behandlung |
|---|---|---|
| Loses Glied | Funktion ohne Ausgangs- oder Eingangsfluss | Den Fluss anlegen, den der Code belegt (Rückgabe an den Aufrufer oder an einen Akteur). Ohne Beleg im Code: Glied aus der Kette nehmen. |
| Nebenteil | Glied hängt nur über eine Funktion außerhalb der Kette am Hauptteil | Die verbindende Funktion in die Kette aufnehmen — oder das Glied gehört in eine andere Kette. |
| Sack | parallele Ein-Schritt-Pfade an gemeinsamer Senke | Je Fall entscheiden: Kette teilen, oder die parallelen Flüsse gleichen Vertrags zu einem zusammenführen. |

**Harte Regel:** Kein Fluss wird angelegt, nur damit die Kette zusammenhängt. Jeder neue Fluss nennt in seiner
Beschreibung die Stelle im Code (Datei, Symbol), die ihn belegt. Eine Kette, die sich nur durch erfundene Flüsse
schließen ließe, wird geteilt oder gestrichen.

## Befund je Kette

| Kette | Lose Glieder | Nebenteile |
|---|---|---|
| agent-query | — | list-elements |
| apply-gate | host-socket, own-kuzu-host, session-shutdown (kein Ausgang) | host-socket |
| capture | decode (kein Ausgang) | mutate |
| codec-roundtrip | decode (kein Ausgang) | — |
| doc-export | serve-stdio (kein Ausgang) | list-elements + view-fmea + read-tools; serve-stdio |
| generation-states | — | graph-suggest |
| impact-testing | — | graph-impact; test-ingest |
| interface-escalation | — | mutate |
| live-update | serve-sse, serve-stdio (kein Ausgang) | — |
| model-import | import-code (kein Ausgang) | import-code |
| recall | apply-reseed, reseed (weder Ein noch Aus), rewind (kein Ausgang) | je eines |
| repo-lifecycle | session-shutdown (kein Ausgang) | bind-tools + tool-profile |
| schema-migration | migrate-schema (kein Ausgang) | schema-guard |
| skill-authoring | — | target-profile (Sack: 11 Skills, je ein eigener Fluss gleichen Vertrags zum Gate) |
| skill-report | — | evaluate-rules + module-metrics; function-criticality; se-help |
| snapshot-freshness | graph-export-snapshot (kein Ausgang) | — |
| steering-loop | compose-faltung, fund-kontext, nd-similarity, read-anthropic-stream, read-openai-stream (kein Ausgang), task-abschluss (weder noch) | vier einzelne |

Wiederkehrend: `serve-stdio`, `decode`, `session-shutdown`, `mutate` — ein behobenes Glied heilt mehrere Ketten.
`steering-loop` hat 31 Funktionen; ob das eine Kette ist oder mehrere, ist die erste Frage dort.

## Reihenfolge

1. Lose Glieder (13 Ketten) — je Glied Code lesen, Fluss anlegen oder Glied herausnehmen.
2. Nebenteile — verbindende Funktion aufnehmen oder Glied umhängen.
3. Säcke und die Größe von `steering-loop` — Entscheidung des Autors je Fall (unten).
4. Nach jedem Schritt: Spike neu fahren, Bewertbarkeit notieren.

## Entscheidung des Autors vor Schritt 3

- `skill-authoring`: elf Flüsse `mutate-cmd-<skill>` zu einem zusammenführen (ein Vertrag, elf Erzeuger) — ja oder nein?
- `steering-loop`: in Teilketten schneiden — ja oder nein, und entlang welcher Grenze?

## Akzeptanz

- Bewertbarkeit ≥ 17 von 21, gemessen mit `scripts/spike-kettenkennzahlen.mjs`.
- FC-05, IO-01, R-31 und R-10 melden für die bewertbaren Ketten nichts mehr.
- Kein neuer Regelverstoß gegenüber dem Stand vor der CR (`rules_evaluate` vorher und nachher).
- Jeder neue Fluss nennt seinen Code-Beleg.
- `npm run verify:model` grün, SSOT und Sichten neu exportiert.
- Alle Änderungen durch `graph_mutate`; Löschzüge erst nach `graph_impact` (`/se-umbau`).

---

## Stand 2026-10-09: Schritt 1 und 2 umgesetzt

Bewertbar: 4 → 15 von 21 (Ziel 17). Zwei Züge durchs Gate (graphVersion 645 → 647), 15 neue Flüsse, jeder
mit Code-Beleg in der Beschreibung, kein neues SCHEMA.

| Regel | vorher | nachher |
|---|---|---|
| R-31 Funktion ohne Anschluss | 18 | 4 |
| FC-05 Kette zerfällt | 6 | 4 |
| IO-01 Glied nicht an der Kette | 4 | 2 |
| R-21 Übergabe ohne gemeinsame Kette | 13 | 9 |

Keine Regel meldet mehr Verstöße als vorher. Preis: die Module zeigen mehr Verträge an ihrer Grenze (R-04:
Kernel 19 → 20, Surface → 15) — die Flüsse gab es im Code schon, das Modell zählt sie jetzt mit.

Nachgezogen: `tests/test-selection.audit.test.ts` — die Testauswahl für den Format-E-Leser enthält jetzt den
Vertragstest von SCHEMA-mutate-command, weil das Modell den Fluss decode → mutate führt.

**Abweichung von der Planung:** Das Zusammenführen gleichartiger Flüsse ist kein Weg. IO-02 verlangt genau einen
Erzeuger je Fluss, und CR-GC-510 hat `mutate-cmd` bewusst je Erzeuger aufgetrennt. Die Frage zu
`skill-authoring` unten entfällt damit; dort bleibt nur das lose Glied `target-profile`.

## Offen — Entscheidung des Autors je Kette

| Kette | Was fehlt | Optionen |
|---|---|---|
| doc-export | `serve-stdio` und die Lesewerkzeuge hängen nicht am Export-Teil | Glieder herausnehmen (der Export läuft im Code nicht über sie) oder Kette teilen |
| impact-testing | `graph-impact` und `test-ingest` hängen nicht an der Testauswahl | `graph-impact` herausnehmen; `test-ingest` in eine eigene Kette „Testergebnis einlesen" |
| skill-authoring | `target-profile` führt nicht zum Gate | herausnehmen (liegt schon in steering-loop) |
| skill-report | vier Teile: Berichts-Skills, Regeln + Modulmetrik, Kritikalität, Hilfe | teilen — je Bericht eine Kette — oder Glieder herausnehmen |
| steering-loop | `compose-faltung`, `fund-kontext`, `nd-similarity` sind Helfer ohne eigenen Vertrag | als Teil ihres Aufrufers führen statt als Kettenglied, oder je ein Konzept-SCHEMA anlegen (kostet je zwei neue Warnungen) |
| schema-migration | `migrate-schema` ist nicht gebaut | bleibt nicht bewertbar, bis CR-DRAFT-GC-437 entschieden ist |

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
