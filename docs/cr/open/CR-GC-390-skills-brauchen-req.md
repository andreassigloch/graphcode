# CR-GC-390 — Skills sind FUNC, also gelten die vier Pflichten

**Status:** open · **Angelegt:** 2026-08-21 · **Revidiert:** 2026-08-21 (Scope von „Skills brauchen REQ"
auf alle vier Pflichten erweitert) · **Basis:** `evaluateAllRules` @ graphVersion 145

> Der Dateiname trägt noch den engeren Ursprungstitel. Umbenennen erst beim Abschluss, sonst zerreißt
> es die Referenzen aus CR-GC-389.

## Entscheidung vorab

Skills **bleiben FUNC**. Damit gelten für sie dieselben vier Pflichten wie für jede andere FUNC —
eine REQ erfüllen (`R-02`), in einem MOD wohnen (`R-22`), in einer Wirkkette hängen (`R-30`),
io-verdrahtet sein (`R-31`) — plus die Bindung an ihre Realisierung (`R-20`).

Die erste Fassung dieses CR sah nur die REQ-Pflicht. Das war zu eng: von den fünf ist `R-22` die
einzige, die heute erfüllt ist.

## Befund (gemessen, graphVersion 145)

24 FUNC sind `MOD-skills` zugeteilt und tragen zusammen **86 Verstöße**:

| Pflicht | Regel | offen |
|---|---|---|
| erfüllt eine REQ | `R-02` | 15 |
| wohnt in einem MOD | `R-22` | **0** |
| hängt in einer Wirkkette | `R-30` | 24 |
| ist io-verdrahtet (rein **und** raus) | `R-31` | 23 |
| trägt eine realRef | `R-20` | 24 |

Dazu drei Lücken, die keine Regel meldet, weil der Knoten fehlt:

- **`se:import-code` hat gar keinen FUNC-Knoten** — der graphify-getriebene Import-Skill existiert im
  Repo (`.claude/commands/se/import-code.md`) und im Modell nicht.
- **`FUNC-view-irr` trägt eine tote ID.** Der Knoten beschreibt die FMEA-View; der Skill wurde
  `se-view:irr` → `se-view:fmea` umbenannt (CR-GC-223), die ID nicht.
- **`FUNC-import-doc`** hängt an nichts außer `FUNC-block-anschluss`.

### Was das Loch *nicht* ist

Ein Cluster über `FUNC -compose-> FUNC` löst es nicht. Von den fünf Pflichten befreit ein Elternknoten
nur bei `R-30` (CR-SM-249: „ein zerlegter FUNC ist ein Rollup"). `R-02`, `R-22` und `R-31` prüfen
Eltern wie Blätter — belegt an den 13 bestehenden `FUNC-block-*`, die **selbst 38 Verstöße** tragen.
Dazu verbietet `FC-03` einem zerlegten FUNC, Kettenglied zu sein: ein Block kann den Cluster in der
Wirkkette gar nicht vertreten. Das Clustering-Mittel ist die FCHAIN, nicht der Elternknoten.

Auch die Trivialkette `Mensch → Skill → Mensch` ist nicht das richtige Modell: **kein einziger Skill
kommt ohne Tool-Aufruf aus** (aus den 30 Command-Dateien ausgelesen). Der Aufruf ist im Meta-Modell
kein `FUNC -> FUNC` — es gibt nur `compose` —, sondern `io` über einen FLOW. Genau das zahlt doppelt:
der Skill bekommt seinen io-Ausgang, und er landet in derselben Zusammenhangskomponente wie der
Aufgerufene, womit `IO-01` ohne Zusatzarbeit hält.

## Konzept — vier Ketten, Skills parallel in der Mitte

Der Schnitt folgt dem Tool, das der Skill treibt, nicht einer erfundenen Kategorie. Jede Kette ist
eine Sequenz mit denselben Enden; was sich unterscheidet, ist der Skill in der Mitte.

| UC | FCHAIN | Skills (parallel) | Aufgerufene FUNC |
|---|---|---|---|
| `UC-deterministic-steering` | **`FCHAIN-skill-report`** *(neu)* | review, status, retro, test, test-ui, help | `FUNC-compute-readiness`, `FUNC-evaluate-rules` |
| `UC-code-quality` | **`FCHAIN-skill-authoring`** *(neu)* | author-req, author-uc, close-violations, conops, fmea, irr, plan, generate, trade, target-profile | `FUNC-mutate` |
| **`UC-model-exchange`** *(neu)* | **`FCHAIN-model-import`** *(neu)* | import-code *(neuer Knoten)*, import-doc | `FUNC-import` |
| **`UC-model-exchange`** | `FCHAIN-doc-export` *(besteht)* | render-views + 6 `view-*` | `FUNC-export-markdown`, `FUNC-serve-stdio` |

`UC-model-exchange`: *„Als Entwickler will ich Modellstand aus Fremdquellen einlesen und als
prüffähiges Dokument herausgeben, damit Graph, Code und Dokumentation eine Quelle haben."*
Er schließt nebenbei den offenen `R-15` (`FCHAIN-doc-export` diente keinem UC) und bekommt eigene
Vor- und Nachbedingungs-REQ.

### Warum `FCHAIN-capture` bleibt, wo sie ist

Naheliegend wäre, die bestehende Erfassungskette unter den neuen UC zu hängen. Ihre vier REQ sagen
aber etwas anderes: *„NL/Text-Eingang, Agent verfügbar"*, *„Format-E-Kandidaten im suggest-Tier durchs
Gate, kein auto-apply, Review vor Persist"*, *„NL→Format-E agent-seitig"*. Das ist **Erfassung aus
Text**, nicht Einlesen eines Bestands — und gehört damit zu `UC-code-quality`.

Was dort nicht hingehört, ist `FUNC-import`: der graphify-Bulk-Arm hängt als zweiter, sachfremder
Eingang an derselben Kette. Genau darauf zeigt CR-GC-389s offengebliebener `IO-01`-Befund
(*„`FUNC-import` hat keinen FLOW-Pfad zu `FUNC-decode`"*) mit der dort notierten Frage: fehlt der
FLOW, oder gehört die FUNC nicht in die Kette? **Die Antwort ist die zweite.** `FUNC-import` wandert
in `FCHAIN-model-import`, `REQ-no-extraction` mit — keine erfundene Kante, eine `compose` weniger.

Damit bleibt CR-GC-389s zweite Frage (`FUNC-import`s Beschreibung „ausschließlich durchs Gate" vs.
sein realRef) offen und sichtbar. Sie wird hier **nicht** beantwortet, nur von ihrem Regel-Anlass
getrennt.

### Warum die View-Skills 1:1 bleiben

Gegengerechnet: die sechs `FUNC-view-*` zu einem Sammelknoten zu verschmelzen ist **schlechter** —
sie tragen `CR -relation->`-Kanten, das Löschen bricht fünf CR-Bindungen (`CR-R01` +2, `CR-R04` +3). Die acht Views **ohne** eigenen Knoten (arch, implplan, nfr, testconcept, testmatrix,
trade …) werden **nicht** angelegt; die deckt `FUNC-render-views` ab. Fein, wo Historie dranhängt;
grob, wo nicht.

## Die zwei neuen REQ mit ihrem TEST

Nach der REQ-with-Test-Invariante je in **einem** Gate-Batch (`se:author-req`):

**`REQ-skill-reports-measured-values`** — Jede Zahl in der Ausgabe eines lesenden Skills stammt aus
derselben Messung, die `graph_readiness` bzw. `rules_evaluate` liefert; der Skill schätzt keine Zahl
und schreibt den Graphen nicht.
→ `TEST-skill-reports-measured-values`: zwei Fixture-Graphen (einer rot, einer grün), Skill-Lauf,
Ausgabe gegen `graph_readiness` desselben Graphen. **Rot zuerst:** vertauscht man die Messquelle, muss
er fallen — sonst prüft er nur, dass Text erscheint (`se-test`).

**`REQ-skill-authors-through-gate`** — Jeder von einem Autoren-Skill erzeugte Knoten und jede Kante
entsteht durch einen `graph_mutate`-Batch mit `baseVersion`; ein abgelehnter Batch hinterlässt keinen
Teilstand.
→ `TEST-skill-authors-through-gate`: Skill-Lauf gegen Fixture, das Audit-Log muss jeden erzeugten
Knoten als applied Batch führen. **Rot zuerst:** der Hand-Edit-Pfad muss den Test fallen lassen.

`FCHAIN-doc-export` und `FCHAIN-model-import` brauchen keine neue REQ — `REQ-doc-export` trägt heute
schon sieben View-Skills, `REQ-no-extraction` ist von `TEST-capture` und `TEST-import-code-verb`
verifiziert.

## Wirkung (simuliert gegen graphVersion 145, nicht geschätzt)

| | |
|---|---|
| Verstöße gesamt | 820 → **740** |
| davon auf den 25 Skill-FUNC | 86 → **0** |
| `R-15` | 1 → 0 · `IO-01` 2 → 1 |
| neue Elemente / Kanten | 14 / 135 |

Die fünf Verstöße Differenz zum pauschalen Umhängen von `FCHAIN-capture` (735) sind bewusst gekauft:
vier `BQ`-Meldungen an den Formulierungen der neuen Vor-/Nachbedingungs-REQ, einer ein `RD-01` an der
Vorbedingung — korrekt, eine Vorbedingung wird von keiner FUNC erfüllt.

**Nicht in diesem CR:** die 38 Verstöße der 13 `FUNC-block-*`. Sie sind kein Modellfehler, sondern
eine Regel-Inkonsistenz → CR-GC-391.

## Vorgehen

1. `FUNC-import-code` anlegen, `FUNC-view-irr` → `FUNC-view-fmea` umbenennen.
2. `UC-model-exchange` + seine zwei Bedingungs-REQ, `FCHAIN-model-import`, `FUNC-import` umhängen.
3. Die zwei neuen REQ **mit ihrem TEST in je einem Batch** (`se:author-req`), Test rot sehen.
4. Die vier Ketten füllen: `compose`, `satisfy`, `io` je Skill.
5. `realRef` auf alle 25 Skill-FUNC (`.claude/commands/<pfad>.md`).

Schritt 3 ist der Prüfstein: trägt das Muster nicht, ist Schritt 4 hinfällig.

## Definition of Done

- [ ] Alle 25 Skill-FUNC ohne `R-02`/`R-20`/`R-22`/`R-30`/`R-31`
- [ ] Beide neuen TESTs sind rot gesehen worden, bevor sie grün waren
- [ ] `R-15` = 0; `IO-01` = 1, und der verbleibende Fall ist CR-GC-389s dokumentierte offene Sachfrage
- [ ] Kein Skill hängt nur noch an `FUNC-block-*`
- [ ] Alle Änderungen durch `mutate()` mit `baseVersion`, kein Hand-Edit
- [ ] `scripts/export-graph.mjs` danach (nicht das `graph_export` des laufenden Servers)
- [ ] `npm test` und `npm run build` grün

**Dateien (4):** `docs/graph/graphcode.graph.json` · `tests/skill-report-measured.test.ts` ·
`tests/skill-authoring-gate.test.ts` · dieses CR-Dokument.
