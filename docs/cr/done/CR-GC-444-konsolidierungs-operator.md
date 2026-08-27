# CR-GC-444 — Konsolidierungs-Operator: der Vorschlagspfad kann FLOW+SCHEMA mergen

**Status:** **ABGESCHLOSSEN** (2026-08-27) · **Angelegt:** 2026-08-27 · **Typ:** Feature (Vorschlagspfad)
**Herkunft:** [CR-GC-438](../done/CR-GC-438-spike-archetyp-zielprofile-eigenvektor.md) §7 **CR-C** —
der einzige der drei vorgelegten Familie-CRs, der den Spike überlebt hat.
**Vorgänger-Muster:** [CR-GC-435](../done/CR-GC-435-fix-templates-koennen-nur-anhaengen.md) /
sigloch-modules CR-SM-273 (`SuggestedEdit.retire`) — dasselbe Muster fortsetzen, kein zweiter
Mechanismus daneben. **Pendant:** sigloch-modules CR-SM-277 (se-engine 1.4.0, additiv).

## Problem

Wörtlich aus CR-GC-438 §7: „CR-C bleibt sinnvoll, aus anderem Grund: nicht um D7 zu heben,
sondern weil **FLOW-Merge ohne SCHEMA-Merge am Gate scheitert** und die Bündelung heute
Handarbeit ist."

Das Gate beherrscht `merge-nodes` (contracts `MutateCommand`, in CR-GC-283 real benutzt). Der
**Vorschlagspfad** kennt es nicht: `SuggestedEdit` (se-engine `fix-templates`) konnte bis
CR-GC-435 nur anhängen, seither anhängen + eine Kante zurückziehen (`retire`) — eine
**Konsolidierung** (zwei Knoten werden einer) ist darin nicht ausdrückbar.

Die Kopplung FLOW→SCHEMA ist dabei keine Konvention, sondern Gate-Realität: seit
`@sigloch/contracts` 10.0.0 gilt `FLOW -relation-> SCHEMA` = **`1..1`** (drittes R-18-Bein).
Ein FLOW mit zwei SCHEMAs wird abgewiesen — in CR-GC-438 Kill 2 gemessen: der reine
Label-Merge erzeugte **5 FLOWs mit > 1 SCHEMA** und war am Gate tot. Wer heute konsolidieren
will, muss den gekoppelten SCHEMA-Merge selbst finden und selbst in denselben Batch legen.

## Kandidatensuche — die Entscheidung, und warum

Ursprünglicher Auftrag: „nutze ND-02 (SchemaNearDuplicate) bzw. dieselbe Formel". Das trägt
so nicht, und der Grund ist strukturell (Messung aus CR-GC-442, hier nachgemessen):
ND-02s `usage_overlap` (Gewicht 0,20) ist über die **direkten** relation/io/compose-Partner
eines SCHEMA definiert — das sind wegen `FLOW -relation-> SCHEMA [1..1]` genau die FLOWs, und
jeder FLOW hat genau ein SCHEMA. Zwei verschiedene, verdrahtete SCHEMAs haben damit
strukturell **disjunkte** Usage-Mengen ⇒ Maximalscore 0,80 < Schwelle 0,85. Am
graphcode-Modell gemessen: **max ND-02 = 0,250 über alle 496 SCHEMA-Paare, 0 Funde.** Auch die
beiden naheliegenden Reparaturen bringen nichts: transitive Usage (`SCHEMA ← FLOW ← FUNC`)
kommt auf max **0,262**, Feld+Beschreibung ohne Usage-Komponente auf max **0,313** — und die
jeweils höchstbewertete Paarung ist gegen die Handkonsolidierung aus CR-GC-436 ein
**Falsch-Positiv**. Eine Textähnlichkeits-Schwelle trennt auf diesem Graphen nicht; die
Bündelung des Spikes war eine semantische Entscheidung („diese sieben sind alle ein
MutateCommand"), keine Textnähe.

**Gewählte Definition — EINE, ohne neue Zahl:** Zwei FLOWs sind Konsolidierungskandidaten,
wenn sie **denselben Datenvertrag tragen**. „Derselbe" ist genau das, was contracts schon
definiert (`ao-rules.ts` `passesSchemaOverlap`): **identischer SCHEMA-Knoten = 100 %**
(`if (a === b) return true; // same SCHEMA = 100% overlap`), sonst die **injizierte
ND-02-Matrix** ≥ Duplikat-Schwelle. Damit:

- **kein zweites Ähnlichkeitsmaß**, keine eigene Formel, **kein ND-02-Fork** (contracts bleibt
  unangetastet — die `usage_overlap`-Reparatur ist die Auftraggeber-Entscheidung aus CR-GC-442);
- die Matrix wird **gelesen, nie nachgerechnet** — se-engine nimmt, was graphcodes
  `withNDMatrices` injiziert hat;
- Schwelle für den Nicht-Identitäts-Zweig = **0,85**, ND-02s eigene Duplikat-Schwelle. Bewusst
  nicht die lockere Overlap-Schwelle 0,5 aus AO-D01/AO-D03: ein Merge ist destruktiv,
  „überlappt" ist nicht „ist derselbe Vertrag".

**Kandidatenzahl am echten graphcode-Graphen** (692 Elemente, 62 FLOW / 32 SCHEMA):
8 SCHEMAs tragen mehr als einen FLOW, zusammen **34 FLOWs in 8 Gruppen = 109 Kandidatenpaare**;
der Nicht-Identitäts-Zweig liefert **0** (s. o., strukturell). Kollabierte jede Gruppe auf
einen FLOW, stünde der Graph bei **62 → 32** — die Handkonsolidierung des Spikes kam auf
62 → 27, und ihre Gruppen decken sich weitgehend (`SCHEMA-ontology-graph` → 10 von 11 FLOWs
sind exakt die, die CR-GC-436 zu `FLOW-graph-state` zusammenlegte). Das ist Befund, keine
Zielvorgabe: dieser CR konsolidiert nichts.

## Änderung

**se-engine (1.4.0, additiv — kein zweiter Bump, contracts unverändert):**

1. `SuggestedEdit` bekommt die **Merge-Ausdrucksform** — Muster `retire`, additiv am
   bestehenden Typ: `op: 'add-trace' | 'merge-nodes'` und `merges?: {source,target,rationale}[]`
   = die **gekoppelten** Zusatz-Merges. Anwendung immer als EIN Batch
   `[merge-nodes(source→target), ...merges]`.
2. Die Kopplung wird aus der **Grammatik hergeleitet**, nicht konventioniert: für jedes
   `BOUNDED_PATTERNS`-Muster mit dem gemergten Typ als Quelle wird geprüft, ob die
   Vereinigung der Ziele die Obergrenze reißt; genau dann fällt der gekoppelte Merge an
   (`FLOW -relation-> SCHEMA [1..1]` ist heute der einzige Fall). Ist er nicht eindeutig
   auflösbar → **kein Vorschlag** (Option C aus CR-GC-435, kein sicher scheiternder Edit).
3. `suggestEdits` liefert die Konsolidierungs-Kandidaten mit aus, Δm gemessen an einem
   **echten In-Memory-Merge** (nicht an der generischen `applyRule`-Sonde). ruleId
   `OP-MERGE` — ausdrücklich **keine** contracts-Regel-ID: der Operator hängt an keiner
   Violation, weil ein Merge keine Regel repariert, sondern die Metrik bewegt.

**graphcode:**

4. `graph_suggest` baut aus einem `op:'merge-nodes'`-Edit den Batch
   `[merge-nodes(primär), ...merges]` und schickt **ihn** durch den Gate-dryRun — dieselbe
   Zusicherung wie beim retire-Verbund (CR-GC-435): beurteilt wird, was ausgeliefert wird.
5. `suggestEdits` läuft in der `withNDMatrices`-Klammer, damit der Nicht-Identitäts-Zweig
   überhaupt eine Matrix sieht (heute strukturell still, s. o.) und der contracts-Modul-State
   danach wieder auf null steht.

## Abgrenzung

- **Kein contracts-Change.** Kein neuer ElementType/TraceType/TRACE_PATTERN, keine neue Regel,
  keine geänderte ND-02-Formel und keine geänderte Schwelle in contracts.
- **Kein neuer Mutate-Op** — `merge-nodes` existiert seit CR-196.
- **Kein Auto-Apply.** Ein Merge-Vorschlag bleibt ein Vorschlag; angewandt wird über
  `graph_mutate`.
- **Der produktive graphcode-Graph wird NICHT konsolidiert** — das ist der Folge-CR. Dieser CR
  liefert das Werkzeug plus den Nachweis, dass ein Merge-Vorschlag am echten Repo-Graphen
  `applicable` ist.
- Keine Änderung an ND-01/ND-02 als Regel, keine neue Metrik-Dimension (CR-GC-438 Kill 1).
- **Keine dritte Modulrand-Traversierung.** Die Kandidatensuche ist eine Kantenabfrage
  (`FLOW -relation-> SCHEMA`), keine Randbetrachtung; `module-crossings.ts` (contracts,
  CR-SM-274/276) wird deshalb nicht gebraucht und nicht nachgebaut.

## Akzeptanzkriterien

- [x] `SuggestedEdit` kann einen Merge ausdrücken — additiv, ein Typ, kein zweiter Codec.
- [x] Ein FLOW-Merge führt den gekoppelten SCHEMA-Merge **zwingend** mit; die Kopplung ist aus
      `BOUNDED_PATTERNS` hergeleitet, nicht hartkodiert. Unit-Test in se-engine.
- [x] **Rot-zuerst am echten Gate (Disk-Kuzu):** `merge-nodes(FLOW→FLOW)` allein blockt mit
      R-18 (zwei SCHEMAs an einem FLOW); der gekoppelte Batch kommt durch.
- [x] **Store-Rücklese-Probe:** nach dem gekoppelten Batch steht — `loadGraph()` aus dem Store,
      nicht aus der Arbeitskopie — genau ein FLOW mit genau einem SCHEMA, die weichenden Knoten
      sind weg und die io-Kanten sind umgehängt. Der Memory-Fallstrick (delete+add derselben
      uid in EINEM Batch, persist schreibt deletes LAST) ist damit nachweislich nicht getroffen.
- [x] `graph_suggest` liefert am echten Repo-Graphen ≥ 1 Merge-Vorschlag mit `applicable: true`;
      die Zahl steht im Ergebnis-Nachtrag.
- [x] `npm run build` grün in beiden Repos, Paket-Suiten grün, keine neuen Roten in graphcode.

## Dateien

**sigloch-modules (≤ 6):** `packages/se-engine/src/fix-templates.ts` ·
`packages/se-engine/src/suggest.ts` · `packages/se-engine/tests/unit/suggest.test.ts` ·
`packages/se-engine/CHANGELOG.md` · `docs/cr/done/CR-SM-277-*.md`

**graphcode (≤ 6):** `src/tools/suggest.ts` · `tests/suggest.merge.test.ts` · dieser CR

---

# Ergebnis (2026-08-27)

**Gebaut:** die Merge-Ausdrucksform am `SuggestedEdit` (se-engine 1.4.0, additiv — CR-SM-277)
plus der Batch-Pfad in `graph_suggest`. Der Vorschlagspfad kann seither ausdrücken, was das
Gate seit CR-196 kann.

**Merge-Ausdrucksform:** `op: 'add-trace' | 'merge-nodes'` + `merges?: {source,target,rationale}[]`.
Bei `merge-nodes` absorbiert `target` den `source`; `merges` sind die GEKOPPELTEN Zusatz-Merges.
Angewandt wird immer als EIN Batch `[merge-nodes(source→target), ...merges]` — dasselbe
retire-Muster, ein Typ, kein zweiter Codec. Die Kopplung leitet `coupledMerges` aus
`BOUNDED_PATTERNS` her (heute genau `FLOW -relation-> SCHEMA [1..1]`); nicht eindeutig
auflösbar ⇒ kein Vorschlag.

**Atomarität + Store-Rücklese (`tests/suggest.merge.test.ts`, Disk-Kuzu):** der nackte
FLOW-Merge blockt mit `R-18 … cardinality`; der Verbund `[merge FLOW-b→FLOW-a,
merge SCHEMA-b→SCHEMA-a]` kommt durch, und **aus dem Store zurückgelesen** (`loadGraph()`)
steht genau ein FLOW mit genau einem SCHEMA, `FLOW-b`/`SCHEMA-b` sind fort und die io-Kanten
hängen am überlebenden FLOW. Der persist-Fallstrick (deletes LAST) wird nicht getroffen:
`merge-nodes` legt Knoten zusammen, statt einen gelöschten unter demselben Schlüssel neu
anzulegen; die Kante, die Merge 1 anlegt und Merge 2 wegnimmt (`FLOW-a -relation-> SCHEMA-b`),
soll am Ende fehlen — upsert-vor-delete liefert genau das.

**Am echten Repo-Graphen (graphVersion 212): 8 Merge-Vorschläge geliefert, 8 `applicable`.**

```
FLOW-bulk-formatE→FLOW-impact-subgraph · FLOW-committed-graph→FLOW-graph-state
FLOW-install-result→FLOW-cli-command   · FLOW-markdown-docs→FLOW-skill-report
FLOW-viewer-stream→FLOW-live-event     · FLOW-export-request→FLOW-authoring-request
FLOW-bootstrap-result→FLOW-violations  · FLOW-suggested-edit→FLOW-mutate-cmd
```

Alle acht aus dem Identitäts-Zweig (gemeinsamer SCHEMA-Knoten), also ohne gekoppelten
SCHEMA-Merge — die Kopplung selbst ist am Gate (Fixture, s. o.) und in se-engine unit-getestet.
Sechs der acht Paare stehen wörtlich in der Handkonsolidierung aus CR-GC-436.

**Rot-zuerst, beide Hälften gemessen:**
- se-engine mit neutralisiertem Operator: 4 von 5 neuen Tests rot (der fünfte ist der
  Negativfall „ohne ND-02-Beleg kein Kandidat" und bleibt korrekt grün).
- graphcode mit der alten Batch-Bildung (immer `add-edge`): **8 geliefert, 0 applicable** —
  das Gate weist `add-edge FLOW→FLOW relation` über R-18 ab.

**Nebenbefund, mitbehoben:** `tests/arch.optimization-dry-run.spike.test.ts` baute den Batch ein
zweites Mal nach und schickte den Merge-Vorschlag als `add-edge` ab (Zug 1 starb an R-18). Der
Autopilot benutzt jetzt dasselbe exportierte `batchFor` wie `graph_suggest` — der Parallelpfad
ist weg, nicht umgangen.

**Testnachweis:** se-engine 87/87 grün, `tsc` grün. graphcode `tsc` grün, Suite
**984 passed / 20 failed** — exakt die dokumentierte Vorlast (Publish-Pending:
`distribution`, `lockfile-sync`; contracts-10-Fixture-Kollateral: `config`, `metrics`,
`claims.conformance`, `generate`, `executor.bestofn`, `steering.*`, `suggest.ranks-…`).
Stash-Gegenprobe gefahren: dieselben 20 Zeilen mit gestashtem `src/tools/suggest.ts` und
zurückgebautem se-engine-`dist`. Keine neue Rote.

**Offen (bewusst nicht hier):**
1. **Den Graphen konsolidieren** — Folge-CR. Das Werkzeug liegt, die 8 Züge sind anwendbar;
   welche davon fachlich richtig sind, entscheidet ein Mensch.
2. **ND-02s `usage_overlap`** ist auf einem musterlegalen Graphen strukturell gedeckelt (0,80 <
   0,85). Solange das so bleibt, ist der Ähnlichkeits-Zweig der Kandidatensuche still.
   Auftraggeber-Entscheidung, Folge-CR-Kandidat aus CR-GC-442, **contracts**.
3. **Ein Vorschlag je Gruppe** (Greedy-1-Schritt). Eine 11er-Gruppe braucht 10 Runden; ob der
   Operator ganze Gruppen in einem Zug anbieten soll, ist eine eigene Entscheidung.
