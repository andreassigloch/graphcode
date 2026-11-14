# CR-GC-931: Host-Start meldet nicht, wenn der committete Snapshot neuer ist als der Store

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-1348 (finding)
**Erstellt:** 2026-11-14
**Item:** bok/items/ITEM-2026-1348.json (Lane: code)

---

## Befund

Liegt ein Store vor und ist der committete Snapshot `docs/graph/<system>.graph.json` neuer, etwa nach
`git pull` oder `git checkout`, lädt der Host den Store und arbeitet mit dem alten Stand weiter.
`GraphStore.open()` (`src/kernel/graph-store.ts`) baut den Store nur in drei Fällen aus dem Snapshot neu
auf: leer, anderes Schema, nicht lesbar (CR-GC-796). Einen Vergleich mit der Datei gibt es dort nicht;
CR-GC-392 hat das so entschieden („Der Boot lädt den Store und vergleicht nicht mit der Datei"). Den Hook
nach dem Checkout hat CR-GC-218 abgelöst.

Folge: Zwei CRs nennen verschiedene Wahrheiten (CR-GC-217 den Snapshot im Ruhezustand, CR-GC-392 den Store),
und beide stimmen je Lage. Die Lücke ist die Lage „Store vorhanden, Snapshot neuer".

Herkunft: einmaliger Scan der geschlossenen CRs in die FAQ (CR-AB-005, aise-bok), Abschnitt „Kandidaten für Vorschläge des Agenten". Vorschlag des Agenten, vom Auftraggeber nicht freigegeben. Nicht geprüft: ob der Startpfad oberhalb von `GraphStore.open()` oder `graphcode status` die
Abweichung meldet. In `src/surface/status.ts` fand eine Suche nach „snapshot" keinen Treffer.

## Vorschlag

Beim Start vergleicht der Host den Fingerabdruck des Snapshots mit dem des letzten Exports. Weicht er ab und
steht kein Export aus, meldet der Host: „Snapshot ist neuer als der Store, `graph_reseed` zieht ihn nach."
Er baut nicht selbst neu auf: Ein ungewollter Reseed verwirft lokale, noch nicht exportierte Züge.

## Abnahme

- [ ] Test zuerst rot: Store vorhanden, Snapshot danach geändert, Start meldet die Abweichung.
- [ ] Steht ein Export aus (Marke `EXPORT_PENDING`), meldet der Host den Konflikt und ändert nichts.
- [ ] Kein zweiter DB-Handle, kein Vergleich Knoten für Knoten.
- [ ] FAQ `wahrheit-snapshot-oder-store` (aise-bok) nennt die Meldung.

## Offen für den Auftraggeber

Melden oder selbst nachziehen? Der Vorschlag meldet nur.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

keine, bis der Auftraggeber über den Vorschlag entschieden hat.

---

## Umfang laut `graph_impact`

**KEIN SCHNITT aus dem Modell:** keine Wurzel-uids am Item (`aise dispatch prepare <ITEM> --wurzel <uid>[,…]`).

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
