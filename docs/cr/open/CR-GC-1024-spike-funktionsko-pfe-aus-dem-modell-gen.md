# CR-GC-1024: Spike: Funktionsköpfe aus dem Modell generieren, Drift durch Bau verhindern

**Typ:** Spike, aus Item ITEM-2026-1650 (idea)
**Erstellt:** 2026-11-24
**Item:** bok/items/ITEM-2026-1650.json (Lane: graph)
**Vorgänger:** CR-GC-957 (No-Go für die Frage nach eingespartem Code)

---

## Frage

CR-GC-957 hat gemessen, wie viel Code ein Generator einspart: Median 13,4 % der Zeilen, No-Go. Dieser Spike stellt eine andere Frage: **Kann ein Generator aus dem Modell allein für jede FUNC einen Kopf (Signatur aus den gebundenen SCHEMA) erzeugen, an dem der Typprüfer Drift meldet, die heute keine Regel meldet?**

Die Lücke, die das schließen soll (Abschnitt 7 in `docs/project/systemmodell-in-bildern.html`): Keine Regel prüft, ob eine FUNC-Signatur zu ihren gebundenen SCHEMA passt. Alle RC-Regeln sind Warnungen. CR-GC-957 verwarf F2 mit „ein Generator unterscheidet sich nur in der Treue zum Modell, die prüfen RC-01 bis RC-13“; genau diese Treue prüft für Signaturen keine Regel.

Ein Spike ändert kein Produkt. Generator und Läufe liegen in `graphanalyze/docs/spikes/SPIKE-GC-1024/`.

## Prämisse gegen den Code geprüft

- `CLAUDE.md` schließt einen Generator nicht mehr aus: CR-GC-962 hat „a generator“ am 2026-11-19 aus der IS-NOT-Liste gestrichen. Die Begründung in CR-GC-957, der Generator gehöre deshalb nicht nach `src/`, ist überholt.
- Die Ontologie kennt an einer FUNC keine Parameter. Ein Kopf kann nur aus den `io`-FLOW und ihren SCHEMA abgeleitet werden.
- **Vorwissen, offen genannt:** Vor dem Festlegen dieser Kriterien habe ich die Signaturen von 5 der 12 FUNC gelesen (`einAdapterJeAkteur`, `eingaengeNurAus`, `grenzeNurMitSchema`, `impactedTests`, `zugBericht`) und gesehen, dass sie Parameter tragen, die kein FLOW ist. Die übrigen 7 sind ungesehen. Das Ergebnis wird für beide Gruppen getrennt berichtet.

## Prüfsatz (fest vor der ersten Zahl)

**FUNC:** die 12 FUNC, die CR-GC-957 als ableitbar gezählt hat (`graphanalyze/docs/spikes/SPIKE-GC-957/f1-ableitbar.json`):
`FUNC-compute-readiness`, `FUNC-ein-adapter-je-akteur`, `FUNC-eingaenge-nur-aus`, `FUNC-grenze-nur-mit-schema`, `FUNC-select-tests`, `FUNC-zug-bericht`, `FUNC-cr-groups`, `FUNC-chain-metrics`, `FUNC-lauf-urteil`, `FUNC-measure-test-schlupf`, `FUNC-plan-code-lane`, `FUNC-score-completeness`.

**Modellstand:** `docs/graph/graphcode.graph.json` beim Commit dieses CR.

### Generatorregel

Je FUNC entsteht genau eine Zeile Typbindung, die der Typprüfer prüft:

```ts
const _kopf: (p1: z.infer<typeof S1>, …) => z.infer<typeof R1> | … = realFn;
```

1. Es zählen nur `io`-FLOW mit `sync`. Ein `async`-FLOW geht über Speicher, Datei oder Ereignis und ist kein Parameter und keine Rückgabe.
2. **Anfrage und Antwort:** Läuft ein OUT-FLOW der FUNC zu einer FUNC G, und läuft ein IN-FLOW von G zurück, ist das ein Aufruf von G. Beide FLOW sind weder Parameter noch Rückgabe.
3. **Parameter:** je übriger IN-FLOW einer; IN-FLOW mit demselben SCHEMA sind ein Parameter (verschiedene Aufrufer, ein Vertrag). Reihenfolge nach uid des FLOW.
4. **Rückgabe:** die Vereinigung der SCHEMA der übrigen OUT-FLOW. Kein OUT-FLOW: `void`.
5. Typ eines SCHEMA: `z.infer<typeof <symbol>>` aus seinem `realRef`.

Die Regel wird nach dem Lauf nicht geändert.

### Messung

- **M1 Kopftreue:** Je FUNC: Besteht die Typbindung `tsc --noEmit` ohne Änderung von Hand? Jede rote FUNC bekommt eine Klasse: (a) dem Modell fehlt eine Information (z. B. ein Parameter, der kein FLOW ist), (b) Modell und Code widersprechen sich (Drift), (c) die Generatorregel greift nicht.
- **M2 Positivkontrolle:** Eine Fixture in `graphanalyze` mit bekannter Antwort: eine passende FUNC (Typbindung grün) und zwei Mutationen (Pflichtfeld im Rückgabe-SCHEMA ergänzt, Parametertyp geändert; beide rot). Danach an einer echten FUNC mit grüner Bindung in einem Wegwerf-Worktree: Pflichtfeld im Rückgabe-SCHEMA ergänzen, Funktion unverändert. Erwartet: Typbindung rot, RC-01 bis RC-13 melden nichts Neues.
- **M3 RC-04:** Die heutigen RC-04-Befunde in Code- und Modellfehler trennen und zählen, wie viele ein generierter Parse an der Schnittstelle verhindert hätte. Ohne Schwelle.

## Kriterien (fest vor der ersten Zahl)

| | Kriterium |
|---|---|
| **Kontrolle** | Fixture: passende FUNC grün, beide Mutationen rot. Sonst wird nicht gewertet. |
| **Muss 1** | M2 an der echten FUNC: Typbindung rot, keine neue RC-Meldung |
| **Muss 2** | M1: ≥ 9 von 12 FUNC grün ohne Änderung von Hand |
| **Kill** | M1: < 6 von 12 FUNC grün |
| **Soll** | M1 in der ungesehenen Gruppe (7 FUNC) nicht schlechter als in der gesehenen, als Anteil |

Go = Kontrolle bestanden, kein Kill, Muss 1 und 2 erfüllt. Dazwischen (6 bis 8 von 12) entscheidet der Autor anhand der Klassen aus M1. Bei Kill ist das Ergebnis die Liste der Informationen, die dem Modell für einen Kopf fehlen.

## Korrektur nach der Kontrolle, vor dem ersten Lauf (2026-11-24)

Die Kontrolle an der Fixture ist gescheitert, bevor eine Zahl an echten FUNC entstand. Zwei Ursachen:

1. **Werkzeug:** `pruefen.mjs` ordnete die Meldungen von tsc nicht zu, weil tsc relative Pfade meldet. Behoben.
2. **Regel 2 ist im Modell nicht entscheidbar.** Ein synchroner Aufruf sind zwei FLOW zwischen denselben zwei FUNC: Anfrage hin, Antwort zurück (FAQ `fluss-nach-veranlasser-oder-aufrufer`: Erzeuger ist der Aufrufer, die Antwort hat einen eigenen FLOW). Von der FUNC aus sieht der Aufrufer genauso aus wie der Gerufene. Kein Attribut und keine Kante sagt, wer ruft: Die FLOW tragen `sync`, `treiber` (7 von 287), `zeitpunkt` (7 von 287), sonst nichts zur Richtung. An der Fixture machte Regel 2 deshalb auch den Aufrufer zum Gerufenen, die Signatur wurde `() => void`.

Regel 2 wird in zwei Varianten gerechnet; Regeln 1, 3, 4, 5 und alle Kriterien bleiben:

- **2a Modell allein:** Ein FLOW-Paar in beide Richtungen mit derselben FUNC ist nicht entscheidbar. Hat eine FUNC ein solches Paar, ist ihr Kopf nicht ableitbar: M1 rot, Klasse (a) „Aufrufrichtung fehlt“.
- **2b Modell plus Aufrufkanten des Codes:** Die Richtung kommt aus `extractCallFacts` (`dist/kernel/call-edges.js`, dieselben Aufrufkanten wie RC-12 und RC-13). Ruft die FUNC G, ist das Paar ein Aufruf. Ruft G die FUNC, ist G Aufrufer: Anfrage = Parameter, Antwort = Rückgabe. Zeigt der Code keine Richtung, ist das Paar nicht entscheidbar wie in 2a.

2a beantwortet die Frage des CR (Modell allein). 2b beantwortet die Frage des Auftraggebers, ob ein Kopf an bestehendem Code Drift meldet. Die Kriterien werden je Variante ausgewertet. Die Fixture bekommt für 2b Aufrufkanten; sie muss in beiden Varianten bestehen, in 2a mit der Erwartung „nicht ableitbar“.

## Ergebnis

**Lauf 2026-11-24**, Modell eingefroren beim Commit nach der Korrektur, 1193 Aufrufkanten aus `extractCallFacts`. Werkzeug und Rohdaten: `graphanalyze/docs/spikes/SPIKE-GC-1024/` (`werkzeug/kopf.mjs`, `werkzeug/pruefen.mjs`, `lauf/plan-2a.json`, `lauf/plan-2b.json`, `lauf/tsc-2a.json`, `lauf/tsc-2b.json`, `lauf/rc-befunde.json`).

**Werkzeugfehler im Lauf, vor der ersten tsc-Zahl:**
- Variante 2b ordnete Aufrufe zuerst über den Anfang des Symbolpfads zu. Am echten Modell lieferte das fast überall „kein Aufruf“. An bekannten Aufrufen nachgeprüft: `bindReportTools.graph_readiness.handler` ruft `readinessOf`, wurde aber nicht erkannt. Behoben durch die Zuordnung, die RC-12 nutzt (`anchorDepth`, Weg ≤ 3 Kanten, aus `call-rules.ts` übernommen, dort nicht exportiert). Danach wurde die Fixture erneut geprüft und bestand.
- `pruefen.mjs` las grün, wenn `zod/v4` nicht auflösbar war, weil die Typen dann zu `any` wurden. Jetzt gilt eine Meldung außerhalb der Bindungsdateien als „nicht prüfbar“.

### Kontrolle

Fixture besteht in 2b: passende FUNC grün, Rückgabe-Mutation und Parameter-Mutation rot. In 2a ist sie wie erwartet nicht ableitbar. Ohne die Bindung bleibt `code.ts` in beiden Mutationen für tsc grün.

### M1 Kopftreue

| | ableitbar | grün | rot | nicht ableitbar |
|---|---|---|---|---|
| 2a Modell allein | 3 | 0 | 3 | 9 |
| 2b Modell + Aufrufkanten | 6 | **0** | 6 | 6 |

Gesehene Gruppe (5 FUNC): 0 grün. Ungesehene Gruppe (7 FUNC): 0 grün.

**Kill greift in beiden Varianten** (< 6 von 12).

**Klassen der roten FUNC (2b):**

| FUNC | Modell sagt | Code hat | Klasse |
|---|---|---|---|
| `FUNC-ein-adapter-je-akteur`, `FUNC-eingaenge-nur-aus`, `FUNC-grenze-nur-mit-schema` | Eingang nur über den async-FLOW `FLOW-graph-snapshot-file`, also `() => Befund` | `(graph, elternMod/elementId, Liste)` | (a) Parameter, die kein FLOW sind; der Graph kommt im Speicher, nicht als Datei |
| `FUNC-select-tests` | `(OntologyGraph) => TestImpactResult` | `(graph: Graph, changeSet, depth?)` | **(b)** `Graph` (nodes/edges) statt `OntologyGraph` (elements/traces); (a) `changeSet` |
| `FUNC-zug-bericht` | `(OntologyGraph) => ZugBericht` | `(before: Graph, after: Graph, policy, opts) => ZugBericht \| BerichtFehlt` | **(b)** `Graph` statt `OntologyGraph`; (a) `policy`, `opts`, Fehlerfall `BerichtFehlt` |
| `FUNC-cr-groups` | `(CrGroups) => CrGroups` | `(graph, crIds) => CrGroups` | **(b)** Der Anfrage-FLOW `FLOW-cr-groups-request` trägt das Antwort-SCHEMA |

**Nicht ableitbar in 2b (6):** Der Partner liegt außerhalb der Aufrufkanten, in `scripts/*.mjs` (`FUNC-lauf-urteil`, `FUNC-measure-test-schlupf`, `FUNC-plan-code-lane`) oder in einem Nachbarpaket (`FUNC-compute-readiness` ↔ `FUNC-score-completeness`, `FUNC-chain-metrics`).

**Drift, die keine Regel meldet:** Die drei Fälle der Klasse (b) widersprechen dem Code. RC-01 bis RC-13 melden zu `FUNC-cr-groups` nichts. Zu `FUNC-select-tests` und `FUNC-zug-bericht` meldet nur RC-04 „OntologyGraph wird nicht geparst“; das SCHEMA trägt diesen Befund als bewusst akzeptiert, und er nennt den falschen Typ nicht.

### M2 Positivkontrolle an echter FUNC

Nicht gelaufen: Keine echte FUNC hat eine grüne Bindung, an der eine Mutation rot werden könnte. Muss 1 ist damit nicht bewertbar.

### M3 RC-04

Am eingefrorenen Modell meldet RC-04 10 Befunde, nicht 23 wie in CR-GC-957. 7 davon tragen am SCHEMA den Vermerk „bleibt bewusst stehen“ (Übergabe im selben Prozess). Ein generierter Parse würde diese Entscheidung umkehren. 3 haben keinen Vermerk (`SCHEMA-audit-stats`, `SCHEMA-impact-slice`, `SCHEMA-skill-text`); am Code nicht geprüft.

### Empfehlung

**No-Go** für „Funktionsköpfe aus dem heutigen Modell generieren“. Dem Modell fehlen für einen Kopf drei Informationen: Parameter, die kein FLOW sind (Auswahl, Einstellung), die Aufrufrichtung eines FLOW-Paars und der Fehlerfall. Die ersten beiden wären eine Änderung an der Ontologie in contracts.

Der Mechanismus selbst wirkt: Die Typbindung fand an 6 roten FUNC 3 Widersprüche zwischen Modell und Code, die keine Regel meldet. Ob daraus eine Regel wird, die das Anfrage-SCHEMA gegen den Parametertyp prüft, entscheidet der Autor.

---

## Entscheidungen

keine

---

## Umfang laut `graph_impact`

Spike: kein Umbau, keine Änderung an `src/`. Relation-Kanten: `MOD-kernel-measure`, `MOD-loop`, `MOD-projections`.
