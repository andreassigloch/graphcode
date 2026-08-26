# CR-GC-435 — Fix-Templates können nur anhängen, nicht umhängen

**Status:** offen · **Angelegt:** 2026-08-26 · **Typ:** Fix (Vorschlagspfad) + Konzept (Code-Kopplung)
**Betrifft:** `graph_suggest` · `@sigloch/se-engine` fix-templates · Apply-Gate-Batch-Semantik

## Root Cause

Ein Fix-Template kann als Ergebnis genau **eine additive Kante** zurückgeben. Der Typ lässt
nichts anderes zu:

```
node_modules/@sigloch/se-engine/dist/fix-templates.d.ts:2-9
  export interface SuggestedEdit { op: 'add-trace'; source; target; type; rationale }
```

Eine **Änderung** einer Allokation ist aber kein Anhängen, sondern ein **Umhängen**: alte Kante
weg, neue Kante hin. Dafür gibt es im ganzen Vorschlagspfad keine Ausdrucksform — weder im
Template-Rückgabetyp noch im Werkzeug, das ihn ausliefert.

## Impact — der verifizierte Fall

R-23 (`MOD hat keine allozierte FUNC`) feuert auf `MOD-dashboard`. Das Template
`edgeToMentioned({ types:['FUNC'], traceType:'allocate', direction:'in' })`
(`fix-templates.js:146`) sucht eine im MOD-Text genannte FUNC. `MOD-dashboard`s Beschreibung
enthält „Live-**Viewer** und Editor auf dem Graphen", und `FUNC-block-schaufenster` heißt
`Viewer` — `mentionedElements` liefert einen Namens-Treffer (`fix-templates.js:53`). Ausgeliefert
wird:

```
{ op:'add-trace', source:'FUNC-block-schaufenster', target:'MOD-dashboard', type:'allocate' }
```

Diese FUNC ist bereits alloziert:

```
docs/graph/graphcode.graph.json:13350-13354
  { "source":"FUNC-block-schaufenster", "target":"MOD-repo-root", "type":"allocate" }
```

Das Gate weist den Edit ab. Die Grammatik erlaubt genau eine Allokation je FUNC:

```
@sigloch/contracts 9.1.0 · dist/se/meta-model.js:81
  { source:'FUNC', target:'MOD', type:'allocate', cardinality:'0..1' }
```

und das **zweite Bein von R-18** (`cardinalityViolations`, `dist/se/rules.js:768-793`) macht daraus
eine `error`-Violation, sobald eine FUNC zwei `allocate`-Kanten trägt.

**Warum das Template das nicht selbst merkt:** es prüft `isValidTrace` — die **Paar**-Legalität
(`fix-templates.js:115-119`) — und kennt die **Mengen**-Bedingung nicht. Paar legal, Menge
illegal: das Template hält den Edit für gültig, das Gate nicht.

**Die Folge, gemessen 2026-08-26:** am gesamten Repo-Graphen ist **kein einziger**
Architektur-Vorschlag anwendbar. Das ist derselbe Befund, den CR-GC-430 §5 schon als Nebenbefund
notiert hat („ist eine FUNC bereits alloziert, schlägt R-23 sie trotzdem noch einem leeren Modul
zu; der Gate-dryRun weist diesen Edit dann selbst ab") — dort als Randnotiz, hier als Ursache.

**Was NICHT bricht:** nichts persistiert Falsches. Das Gate hält. Der Schaden ist, dass der
Optimierungspfad auf `layer:'arch'` — die Default-Messebene von `graph_suggest` — in einem
gewachsenen Graphen leerläuft, sobald die Funktionen einmal alloziert sind. Genau dann, wenn
Architekturarbeit anfängt, hört der Vorschlag auf.

## Machbarkeit: geht ein delete+add in EINEM Batch? — **Ja, für zwei verschiedene Kanten.**

Das ist die entscheidende Frage des CR, und sie ist am Code belegbar. Drei Befunde:

**1. Das Gate urteilt einmal über den Endzustand des ganzen Batches, nicht schrittweise.**

```
src/harness.ts:442-447
  const snapshot = cloneGraph(this.graph);
  const baselineKeys = new Set(this.runRules().map(violationKey));
  const delta = this.applyCommands(commands);          // ALLE Kommandos
  const newViolations = this.runRules().filter(...);   // EINE Auswertung danach
```

Der Zwischenzustand „zwei Allokationen" existiert nur innerhalb von `applyCommands` und wird
**nie bewertet**. R-18s Kardinalitätsbein sieht ihn nicht.

**2. Der bekannte Fallstrick greift nur bei IDENTISCHEM Schlüssel.**

```
src/harness.ts:741-747
  /** Persist a delta to the store. Order: nodes before edges (FK), deletes last. */
  saveNodes → saveEdges → deleteEdges → deleteNodes
```

Deletes laufen zuletzt. Ein `delete` würde also ein gleich benanntes `upsert` wieder wegräumen —
aber nur, wenn beide **denselben** Schlüssel tragen. Beim Umhängen unterscheiden sich die
Kanten in `targetId` (`MOD-repo-root` vs. `MOD-dashboard`); es gibt keine Kollision. Der Code
sagt genau das, an der Stelle, an der es schon einmal wehgetan hat:

```
src/harness.ts:702-708 (update-edge)
  // Attribute-only patch keeps the edge identity — a delete of the old key
  // would remove the just-upserted edge from the store (persist runs upserts
  // before deletes), so only push the delete when the identity changed.
```

Dieselbe Einschränkung, wörtlich auf die uid bezogen, steht im Import-Pfad
(`src/import-code-verb.ts:128-134` und `:161-162`): *„nie delete+add derselben uid in einem
Batch"*. **Derselben** — nicht: nie delete und add im selben Batch.

**3. Es gibt bereits einen ausgelieferten Pfad, der genau das tut.** `graphcode import-code` baut
routinemäßig einen Batch aus `delete-node` + `delete-edge` + `add-node` + `add-edge` und schickt
ihn in **einem** Gate-Durchlauf durch:

```
src/import-code-verb.ts:180-193
  const batch = [ ...staleNodes.map(delete-node), ...staleEdges.map(delete-edge),
                  ...ensureSys, ...commands ];
  await registry['graph_mutate'].handler({ commands: batch, consumerId: 'import-code' })
```

**Fazit:** Das Umhängen ist mit den heutigen Ops **ausdrückbar und sicher** — als Zwei-Kommando-
Batch `[delete-edge(alt), add-edge(neu)]`. Es fehlt kein Gate-Feature.

**Was NICHT geht: `update-edge`.** Der naheliegende Ein-Op-Weg trägt den Fall nicht — sein
`set` kann Typ und Richtung ändern, aber keinen Endpunkt auf einen **anderen Knoten** umlegen:

```
node_modules/@sigloch/graph-api-core/dist/edge-ops.d.ts:12-16
  export interface UpdateEdgeSet { edgeType?: string; flip?: boolean; attributes?: Record<…> }
```

Ein Umhängen bleibt also zwei Kommandos in einem Batch — kein neuer Op nötig, aber auch keine
Abkürzung über `update-edge`.

## Die zweite Hälfte: umhängen im Graph = Refactoring im Code

Bei einer **realisierten** FUNC ist die Allokation keine reine Modellaussage. Sie ist die
Quelle, aus der die Regelbasis die Datei→Modul-Zuordnung ableitet:

```
@sigloch/contracts · dist/se/conformance-rules.js:281-310 (buildModResolver)
  1. realRef einer allozierten FUNC → die Datei gehört zur MOD ihrer FUNC
  2. sonst: MOD.attributes.path, longest-prefix
  3. sonst: `unassigned`
```

Dieser eine Resolver speist **RC-05** (Cross-Module-Drift) und `importCoverage`. Hängt man eine
FUNC mit `realRef` in ein anderes MOD um, **ohne die Datei zu bewegen**, dann:

- gilt die Datei ab sofort als Teil des neuen Moduls — Weg 1 schlägt Weg 2;
- widerspricht das dem `path`-Präfix des alten Moduls, falls eines gesetzt ist (in diesem Repo
  tragen 4 von 17 MOD ein `path`: `MOD-docs`=`src/views`, `MOD-hooks`=`src/hooks.ts`,
  `MOD-host-bridge`=`src/viewer`, `MOD-mcp-tools`=`src/tools`);
- verschieben sich sämtliche RC-05-Befunde, ohne dass eine Zeile Code sich geändert hat.

Der Vorschlag darf das nicht als reine Graph-Edit ausweisen. Anknüpfungspunkte im Modell sind
`realRef` (Vorhandensein = realisiert, R-20 / `dist/se/rules.js:874-953`) und `MOD.path`.

Für den konkreten Fall oben trifft das nicht zu — `FUNC-block-schaufenster` ist ein Rollup-Block
ohne `realRef` (`docs/graph/graphcode.graph.json:2289-2293`). Es trifft jede Blatt-FUNC.

**Nebenbefund, gehört nicht in diesen CR:** `MOD-dashboard` ist laut eigener Beschreibung ein
Nachbarsystem (`@sigloch/graph-view-edit`, eigenes Repo). Eine FUNC dieses Repos dorthin zu
allozieren wäre auch dann falsch, wenn die Kardinalität es zuließe. Dass die Templates keinen
Begriff von „extern" haben, ist ein eigener Befund.

## Optionen

| # | Ansatz | Bewertung |
|---|---|---|
| **A** | `SuggestedEdit` bekommt ein optionales `retire?: {source,target,type}` — die eine Kante, die weichen muss, damit der Edit legal wird. Templates ohne Umhäng-Fall bleiben unverändert. | **Empfohlen.** Kleinste Formänderung, die den Verbund ausdrückt; alle bestehenden Templates und Konsumenten laufen unverändert weiter (Feld fehlt = heutiges Verhalten). Contracts-/se-engine-Version-Bump + Familie-Review (Drift-Lock). |
| **B** | `SuggestedEdit` wird zu `SuggestedEdit[]` | Ausdrucksstärker, aber jeder Konsument der Familie muss angefasst werden, und „beliebige Batch-Folge" lädt genau die Nichtdeterminismen ein, gegen die die Templates gebaut wurden. |
| **C** | Templates lernen die Kardinalitätsschranke und liefern in diesem Fall `null` | Ehrlich (kein Vorschlag, der sicher scheitert), löst das Problem aber nicht: R-23 bliebe dauerhaft unreparierbar. Als **Teil** von A sinnvoll: wo kein einzelnes `retire` den Edit legal macht, `null` statt eines Edits, den das Gate abweist. |
| **D** | graphcode-lokal in `src/tools/suggest.ts` die fehlende `delete-edge` anfügen | **Abgelehnt.** Das wäre Grammatikwissen (welche Kardinalität, welche Kante weicht) in graphcode — ein lokaler Rule-Parser, den CLAUDE.md/CLAUDE.local.md ausdrücklich sperren („SE-Ontologie + V3_RULES importieren, NIE forken"). |

**Zweiter Fundort, unabhängig von der Option:** `src/tools/suggest.ts:178-181` baut den
dryRun-Batch fest als **ein** `add-edge`. Selbst ein Template, das ein Paar zurückgäbe, käme
heute nicht durch — das Werkzeug muss den Verbund als Batch schicken, sonst urteilt der dryRun
über etwas anderes als das, was angewandt würde (dieselbe Klasse Fehler wie CR-GC-431).

## Akzeptanzkriterien

- [ ] Ein Test belegt am **echten Gate mit Disk-Persistenz**: Batch `[delete-edge(FUNC→MOD-alt),
      add-edge(FUNC→MOD-neu)]` kommt durch, und nach `loadGraph()` steht **aus dem Store
      zurückgelesen** genau eine Allokation. Rot-zuerst: derselbe Test ohne das `delete-edge`
      muss mit R-18 blocken.
- [ ] Ein Test belegt die Gegenprobe zum bekannten Fallstrick: delete+add **derselben** Kante in
      einem Batch führt zu Store≠Memory — damit die Grenze dokumentiert **und** erzwungen ist,
      nicht nur behauptet.
- [ ] `graph_suggest` liefert auf dem Repo-Graphen mindestens einen Vorschlag mit
      `applicable: true` auf `layer:'arch'` (heute: keinen).
- [ ] Der dryRun in `suggest.ts` prüft den **vollständigen** Verbund-Batch, nicht nur die
      additive Kante; `verdict.fitDelta`/`score` messen denselben Batch, der ausgeliefert wird.
- [ ] Ein Umhäng-Vorschlag auf eine FUNC **mit** `realRef` weist im Ergebnis aus, dass er
      Code-Arbeit nach sich zieht — mindestens die betroffene Datei und das Zielmodul benannt.
      Ein Vorschlag auf eine FUNC ohne `realRef` tut das nicht (kein Rauschen).
- [ ] Kein Grammatik-/Kardinalitätswissen in `graphcode` — die Herleitung, welche Kante weichen
      muss, bleibt in `@sigloch/se-engine`/`@sigloch/contracts`.
- [ ] Entscheidung dokumentiert, ob die Templates einen Begriff von „externem MOD" brauchen
      (eigener CR) oder nicht.

## Dateien (≤ 6)

Der tragende Teil liegt **außerhalb** dieses Repos (`@sigloch/se-engine` fix-templates +
`SuggestedEdit`-Typ) und braucht einen Version-Bump. In graphcode:

1. `src/tools/suggest.ts` — Verbund-Batch statt einzelnem `add-edge` im dryRun
2. `tests/suggest.rehang.test.ts` — die beiden Gate-Tests oben
3. dieser CR

**Reihenfolge:** erst der se-engine/contracts-Bump (Familie-Review, Drift-Lock L1/L2), dann der
graphcode-Nachzug. Ohne den Bump ist hier nichts zu tun außer dem Batch-dryRun.

## Abgrenzung

- Keine neue Regel, kein neuer ElementType, kein neuer TraceType.
- Kein neuer Mutate-Op — `delete-edge` + `add-edge` reichen (s. Machbarkeit).
- Kein Auto-Apply: ein Umhäng-Vorschlag bleibt ein Vorschlag, angewandt wird über `graph_mutate`.
- Nicht das eigentliche Refactoring. Dieser CR macht die Code-Folge **sichtbar**; sie
  auszuführen ist Arbeit am Code, nicht am Graphen.
