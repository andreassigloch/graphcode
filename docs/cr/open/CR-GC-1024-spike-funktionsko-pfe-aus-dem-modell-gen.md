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

## Ergebnis

_(nach dem Lauf)_

---

## Entscheidungen

keine

---

## Umfang laut `graph_impact`

Spike: kein Umbau, keine Änderung an `src/`. Relation-Kanten: `MOD-kernel-measure`, `MOD-loop`, `MOD-projections`.
