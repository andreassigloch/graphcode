# CR-GC-343 — Nachdokumentation: was ausgeliefert ist, aber nirgends steht

**Status:** open · **Angelegt:** 2026-08-15 · **Max Files:** 6 (dieser CR: **4**)
**Ziel:** README und Artikel bilden den ausgelieferten Funktionsumfang ab.
**Reihenfolge:** **nach** CR-GC-339 (der korrigiert dieselben Artikel-Dateien; erst korrigieren,
dann ergänzen — sonst Merge-Konflikte in Prosa).

---

## 1. Problem

Der Zahlen-Sweep aus CR-GC-339 hat den Anlass geliefert: die Artikel nennen 22 Tools, es sind 25.
Die Ursachenanalyse zeigt ein größeres Bild — **13 der 25 MCP-Tools fehlen in der README-Tabelle**,
7 davon kommen in **keinem** Dokument vor, und mehrere ganze Funktionsblöcke sind undokumentiert.

Das ist die Gegenrichtung zu falschen Claims: wir verschenken ausgelieferte Funktion. Und es
signalisiert dem Leser, dass die Dokumentation dem Code nicht folgt.

---

## 2. Befund

### 2.1 MCP-Tools

Die README-Tabelle ([`README.md:97-108`](../../../README.md)) listet 12 von 25:

`graph_elements` · `graph_get_node` · `graph_get_edges` · `graph_impact` · `graph_expand` ·
`graph_mutate` · `graph_export` · `rules_evaluate` · `rules_get_violations` · `audit_trail` ·
`audit_stats` · `graph_help`

**Fehlen in der Tabelle, aber in Artikel 03 erklärt** (nur ins README nachziehen):
`graph_context` · `graph_authoring_guide` · `graph_next_step` · `graph_readiness` · `graph_suggest`

**Fehlen überall — weder README noch Artikel:**

| Tool | Was es tut | Warum es dokumentiert gehört |
|---|---|---|
| `graph_generate` | der Kaltstart-Generierungstreiber (seed → expand → handoff) | Artikel 03 beschreibt den „built-in executor" als CLI, nennt aber nie das Tool, das die Zustandsmaschine ist |
| `graph_realize` | FUNC→`codeRef`, TEST→`testRefs` | schließt die Modell↔Code-Bindung — genau die Lücke, die `04:88-90` als Downside benennt |
| `graph_test_ingest` · `graph_test_report` · `graph_tests` | Testergebnisse in den Graphen, Report daraus | trägt `UC-efficient-testing` und den Satz „erledigt = nachgewiesen" |
| `graph_merge` | additiver Merge (adds-only) | die Alternative zum Reseed; ohne Doku wählt der Nutzer die zerstörerische Variante |
| `graph_reseed` | In-Process-Reseed mit Backup | ersetzt den Stop/rm/Restart-Tanz |
| `graph_metrics` | `moduleMetrics` je MOD abfragen | `07:139-152` beschreibt die Zahl, nennt den Zugang nicht |

### 2.2 Skills — zwei Import-Wege fehlen komplett

Ausgeliefert unter `.claude/commands/se/` und `.claude/commands/se-view/`:

- **`se:import-code`** (CR-GC-298) — bestehende TypeScript-Codebasis deterministisch in den Graphen,
  über graphify, ohne LLM. FUNC/MOD/FLOW/SCHEMA. **Reseed-Semantik mit automatischem Backup.**
  Das ist der Brownfield-Einstieg — heute in keinem Dokument. Ein Leser von `04` („Most tools read
  your code and draw a picture of it; here the model *is* the truth") schließt daraus, dass es
  keinen Weg aus bestehendem Code gibt. Den gibt es.
- **`se:import-doc`** (CR-GC-337, 2026-08-15) — Dokument (PDF/Markdown/Text) zweistufig in den
  Graphen: Skelett zeigen, Typ-Entscheidungen im Chat, LLM-Extract durchs Gate. **Merge, nie
  Reseed.** Brandneu, noch nirgends erwähnt.
- **`se-retro`** — die 6 KPIs (graph-vs-grep, Tool-Nutzung, Token/LOC, Plan-Konformität,
  Gate-Health, Binding-Coverage). `MESSGROESSEN.md` führt sie in der Tabelle; die Artikel nicht.
- **12 `se-view:*`-Generatoren** — `arch` (SDD) · `changelog` · `conops` · `fmea` · `icd` ·
  `implplan` · `intplan` · `nfr` · `rtm` · `testconcept` · `testmatrix` · `trade`.
  [`06-claims.md:125`](../../articles/06-claims.md) erledigt das mit vier Wörtern („documents
  generated from the graph"). Das ist die vollständige SE-Dokumentenfamilie, deterministisch
  gerendert — der sichtbarste Nutzen für jeden, der aus der SE-Welt kommt, und der beste Beleg
  für „Traceability is guaranteed by the same graph rules".

### 2.3 Zeitreise fehlt in den Artikeln

`npx @sigloch/graphcode rewind <ref>` steht im README ([`README.md:24`](../../../README.md)) und ist
als `UC-graph-time-travel` modelliert — kommt aber in **keinem** Artikel vor. „Der Graph-Stand jedes
Commits ist wiederherstellbar" ist ein starkes Argument gegenüber jedem descriptive-map-Tool und
gehört mindestens in `03`.

### 2.4 Nebenlaufigkeit (MS-7)

Store-Lock und optimistische Concurrency (`tests/store-lock.test.ts`, `tests/mcp.occ.test.ts`) sind
ausgeliefert. Die Dokumentation sagt nur „one process owns one store" — was wie eine Einschränkung
klingt, während der Mechanismus dahinter (Lock + OCC bei konkurrierenden Tool-Writes) die Antwort
auf die naheliegende Rückfrage ist.

---

## 3. Lösung

1. **README-Tool-Tabelle vervollständigen** — alle 25, gruppiert nach Rolle (lesen · schreiben ·
   messen · generieren · importieren · Audit). Der Tabellenkopf sagt heute nichts über
   Vollständigkeit; einen Satz ergänzen, dass sie vollständig ist.
2. **README-Abschnitt „Bringing an existing project in"** — `se:import-code` und `se:import-doc`
   mit ihrer jeweiligen Semantik (Reseed+Backup vs. Merge). Die Unterscheidung ist
   sicherheitsrelevant, nicht kosmetisch.
3. **README-Abschnitt „Generated documents"** — die 12 Views mit Zielname; Verweis auf `docs/views/`.
4. **Artikel 03** (`Under the Hood`): `graph_realize`, den Test-Evidenz-Loop und `rewind` in die
   bestehenden Abschnitte einhängen. Kein neuer Artikel.
5. **Artikel 06** (`Claims`): die vier Wörter „documents generated from the graph" zu einem Absatz
   ausbauen, der die Dokumentenfamilie benennt — das ist der stärkste unausgespielte Claim im Satz.
6. **Artikel 04**: beim Downside „Model und Code können driften" auf `graph_realize` und die
   Test-Evidenz verweisen — der Downside bleibt echt, aber der Gegenmechanismus existiert und
   sollte genannt sein.

---

## 4. Akzeptanzkriterien

- [ ] Die README-Tool-Tabelle listet alle 25 Tools; der Test T-D1 (CR-GC-340) prüft die Zahl
      gegen die Registry.
- [ ] `se:import-code` und `se:import-doc` sind im README erklärt, inklusive Reseed-vs-Merge.
- [ ] Die 12 `se-view:*`-Generatoren sind an einer Stelle vollständig aufgezählt.
- [ ] `rewind` kommt in mindestens einem Artikel vor.
- [ ] Kein Artikel behauptet mehr implizit, es gebe keinen Weg aus bestehendem Code in den Graphen.
- [ ] `npm test` grün (nur Markdown geändert, plus T-D1 aus CR-GC-340 muss weiter grün sein).

---

## 5. Betroffene Dateien (4)

| Datei | Änderung |
|---|---|
| `README.md` | Tool-Tabelle vollständig · Import-Abschnitt · Views-Abschnitt |
| `docs/articles/03-graphcode-harness-goal-and-concept.md` | `graph_realize`, Test-Evidenz, `rewind` |
| `docs/articles/04-the-graphcode-story.md` | Downside „drift" mit Gegenmechanismus |
| `docs/articles/06-claims.md` | Dokumentenfamilie ausbauen |

---

## 6. Bewusst **nicht** in diesem CR

Die Nebenlaufigkeit aus §2.4. Sie ist echte Funktion, aber die Zielgruppe der Artikel fragt nicht
danach — und im README würde sie den Constraint „one store, one owner" verwässern, der als
*Constraint* stimmt. Wenn, dann als eigener kurzer Abschnitt unter „Constraints (locked)", der
erklärt, was bei konkurrierenden Writes passiert. Eigener CR, eigene Entscheidung.

@author andreas@siglochconsulting
