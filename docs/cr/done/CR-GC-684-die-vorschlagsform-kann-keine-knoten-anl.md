# CR-GC-684: graph_suggest wendet add-node-Vorschlaege als ein Batch an

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-350 (finding)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-350.json (Lane: code)

---

GEMESSEN 2026-09-19 ueber fuenf echte Familiengraphen (sigllm Hand + Auto, graphcode, sigloch-modules, bok): 915 Befunde, 835 davon ohne ausfuehrbare Vorlage in 29 Regeln.

DIE KLASSIFIKATION LIEFERT DIE TRIAGE SCHON: CLASS_MAP fuehrt 28 Regeln als 'Operator' (der Zug ist eine mechanische Graphkante) und 46 als 'Constraint'. Von den 28 Operatoren tragen nach CR-SM-342 zehn eine Vorlage, achtzehn nicht. Von diesen achtzehn feuern in den gemessenen Graphen nur fuenf - und deren eigene rationale sagt, was fehlt:

  R-32  37 Befunde  'add verify trace SCHEMA<-TEST - the contract test is missing'  -> braucht einen TEST-KNOTEN
  R-21  16 Befunde  'chain has no integration TEST - add TEST + verify'             -> braucht einen TEST-KNOTEN
  FC-04  8 Befunde  'add ACTOR->FLOW entry + FUNC->FLOW exit io traces'              -> zwei Kanten
  IO-01  8 Befunde  'add FLOW element + io traces between the FUNC pair'             -> braucht einen FLOW-KNOTEN
  UC-06  5 Befunde  'add REQ(precondition) via compose trace'                        -> braucht einen REQ-KNOTEN

VIER VON FUENF BRAUCHEN EINEN NEUEN KNOTEN. Die SuggestedEdit-Form kennt genau zwei Operationen: add-trace (optional mit EINEM retire) und merge-nodes. Ein add-node ist nicht ausdrueckbar. Deshalb ist nicht 'es fehlen Vorlagen' das Problem, sondern 'die Form kann den Zug nicht sagen'.

DASSELBE BLOCKIERT DEN ARCHITEKTUR-OPERATOR Z3 (ITEM-2026-053, dort schon vermerkt: 'Braucht eine ERWEITERTE SuggestedEdit-Form - heute genau ein retire, kein add-node'). Zwei unabhaengige Wege fuehren also auf dieselbe Erweiterung.

ZWEITER BEFUND, unabhaengig davon: KEINE der fuenf STEER_RULES (RD-04, BW-02, R-04, CR-01, MT-02) hat eine Vorlage - die Regeln, nach denen gesteuert wird, koennen als einzige nichts empfehlen. Das ist ITEM-2026-333, hier familienweit bestaetigt statt an einem Graphen.

DRITTER BEFUND: zwei Vorlagen sind da und greifen nie. MS-03 (31 Befunde) verweigert bewusst zu raten, wenn der CR keinen Meilenstein nennt und es mehr als einen gibt - in echten Graphen ist das der Normalfall. R-23 (4) ebenso. Ableitbar waere der Meilenstein aus dem Umfang des CR (relation-Kanten auf FUNC/REQ und deren MS-Zuordnung) statt aus dem Text; das ist Herleitung, keine Raterei.

VORSCHLAG, in dieser Reihenfolge: (1) SuggestedEdit um eine Knoten-Variante erweitern (add-node + die zugehoerigen Kanten als EIN Batch, wie merge-nodes es schon vormacht) samt Konsumenten-Seite in graphcode suggest.ts; (2) R-32 als erste Vorlage darauf, weil sie die groesste und einfachste ist (TEST-Stub + verify auf das SCHEMA); (3) MS-03 auf Herleitung aus dem CR-Umfang umstellen. Erst danach lohnt sich die Frage nach weiteren Operatoren - vorher baut man Vorlagen fuer eine Form, die den Zug nicht tragen kann.

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Schnitt (2026-09-26, Release-Zug)

**Konsument** von CR-SM-367 (se-engine). Erst nach deren Publish; Peer-Floor `@sigloch/se-engine`
im selben Commit auf die neue minor heben.

## Zielbild

`src/loop/suggest.ts` uebersetzt `edit.op === 'add-node'` in
`[add-node(node), ...delete-edge(retires), ...add-edge(edges)]` als EIN Batch — neben den bestehenden
Zweigen `retire` und `merge-nodes`. `retires[]` kam mit CR-SM-356 dazu: der RD-04-Operator
(Zwischenebene) haengt mehrere Kinder um. Achtung: se-engine spiegelt `edges[0]` in
`source/target/type` — ohne den add-node-Zweig entstuende eine Kante ins Nichts (das Gate lehnt ab). Dry-Run und Score laufen
unveraendert ueber das Gate.

## Umfang (4 Dateien)

`src/loop/suggest.ts`, ein Test (Vorschlag R-32 an einem Fixture → Batch → Befund weg),
`package.json` + `package-lock.json` (Peer-Floor).

## Akzeptanz

- [x] Rot zuerst: `tests/suggest.add-node.test.ts` — alle drei rot vor der Aenderung: `batchFor` lieferte
      nur das gespiegelte `add-edge(edges[0])`; R-32 und RD-04 wies das Gate mit R-08 ab
      (Kante auf den noch nicht existierenden Knoten).
- [x] `graph_suggest` am Fixture liefert den Batch (R-32: TEST-Knoten + verify), anwendbar; angewandt
      ist der Befund am SCHEMA weg.
- [x] RD-04 (add-node + retires) am Fixture: Batch passiert das Gate, `steer.improvement > 0`, angewandt
      feuert RD-04 am Eltern nicht mehr, jedes umgehaengte Kind hat genau einen compose-Eltern (Store).
- [x] Schatten-Simulation opus5-14/15 (kein LLM, nur Dry-Runs), Zuege mit anwendbarem Vorschlag
      vorher → nachher: opus5-14 0 → 0, opus5-15 0 → 3 (alle RD-04, verpasste Steuerverbesserung 0.667).
      Vorbehalt: 18 von 29 bzw. 34 Zuegen weist das heutige Gate beim Nachspielen ab.
- [ ] VOLL-Lane: nicht gefahren, benannte Ausnahmen unten.

## Ergebnis

- `src/loop/suggest.ts` `batchFor`: dritter Zweig `add-node` → `[add-node(node), ...delete-edge(retires),
  ...add-edge(edges)]`; die gespiegelte Kante wird nicht zusaetzlich angelegt.
- Zweite Uebersetzung entfernt: `tests/steering.divergence-two-profiles.test.ts` und
  `tests/suggest.ranks-the-delivered-edit.test.ts` bauten den Batch selbst als nacktes `add-edge` —
  jetzt `batchFor`.
- `tests/suggest.rehang.test.ts`: die Invariante war „retire.source === edit.source" — gilt fuers
  Umallokieren (R-04/CR-01), nicht fuer BW-02 (retire = compose des ALTEN Eltern). Wahre Invariante:
  gleicher Kantentyp, genau EIN gemeinsames Ende in derselben Rolle (Umhaengen).

## Offen (benannt)

1. **Peer-Floor `@sigloch/se-engine`:** nicht gehoben. 1.9.0 (Registry) enthaelt CR-SM-367/356 nicht;
   gegen 1.9.0 kompiliert `edit.node/edges/retires` nicht. Beim Release auf die naechste minor heben.
2. **se-engine (Produzent):** `suggestEdits` nimmt einen Operator-Befund nur auf, wenn die generische
   Sonde (`applyRule`) greift — R-32 in einem Graphen ohne jeden TEST faellt heraus, bevor die
   add-node-Vorlage gefragt wird.
3. **`steering.divergence-two-profiles` rot:** auf master (Link-Modus) rot an „gate refused RD-04
   (R-08)" — genau dieser Befund. Nach dem Fix rot an „SCALABLE chain too short": EIN RD-04-Zug
   realisiert +0.4950 entlang SCALABLE (alte Fuenf-Kanten-Kette +0.3226), danach Optimum. Die
   Kill-Kriterien (Schrittzahl, CONTESTED-Allokation) stammen aus dem Einzelkanten-Aktionsraum —
   Entscheidung noetig, ob der Spike auf Reichweite umgestellt wird.
4. **`arch.optimization-dry-run.spike` Lauf A rot, unabhaengig:** auch mit master-suggest.ts —
   15 Zuege (MAX_STEPS) aus BW-02/CR-01-Umhaengen (CR-SM-356), kein add-node-Zug.
5. **Weitere Leser der Edit-Form:** `src/loop/executor-prompt.ts` zeigt einen Vorschlag als eine Kante,
   `src/surface/mcp-tools.ts` (`noteTemplateEdits`) identifiziert Edits ueber source/target — beide
   kennen `node/edges/retires` nicht.
6. CR-Knoten im Graphen: Status nicht gesetzt (kein graph_mutate in dieser Lane).
