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

- [x] Test zuerst rot: Store vorhanden, Snapshot danach geändert, Start meldet die Abweichung. Beleg: `tests/snapshot-drift.test.ts` (a), vor der Umsetzung 5 von 5 rot, danach 5 von 5 grün.
- [x] Steht ein Export aus (Marke `EXPORT_PENDING`), meldet der Host den Konflikt und ändert nichts. Beleg: Test (b), Snapshot, Marke und Knotenzahl unverändert.
- [x] Kein zweiter DB-Handle, kein Vergleich Knoten für Knoten. Beleg: `src/kernel/snapshot-stamp.ts` liest nur Dateien (SHA-256 des Snapshots gegen den Stempel `.graphcode/snapshot.sha256`); Stempel schreiben `graph_export` und der Reseed (`seedFromJsonFile`). Fehlt der Stempel (erster Start nach diesem CR), meldet der Host nichts (Test d).
- [ ] FAQ `wahrheit-snapshot-oder-store` (aise-bok) nennt die Meldung.

## Frage des Auftraggebers, 2026-11-14: Warum braucht es Snapshot und Store?

Jeder der beiden kann etwas, das der andere nicht kann:

| | Store (Kuzu, `.graphcode/kuzu`) | Snapshot (`docs/graph/*.graph.json`) |
|---|---|---|
| Abfragen und Gate | ja, der Host liest und schreibt nur hier | nein, eine Datei |
| git, Diff, anderer Rechner | nein, binär und nicht in git | ja |
| Neuaufbau | wird aus dem Snapshot gebaut | ist die Vorlage |

Die Lücke dieses CR entsteht, weil ein vorhandener Store den Start überlebt. Zwei Wege schließen sie:

1. **Melden** (der Vorschlag oben). Der Store bleibt über den Start hinweg bestehen. Der Host meldet die
   Abweichung, `graph_reseed` zieht nach.
2. **Bei jedem Start aus dem Snapshot aufbauen.** Dann gibt es zwischen zwei Läufen nur einen Stand, die
   Datei; der Store lebt nur, solange der Host läuft. CR-GC-392 hat das am 2026-08-22 gemessen: 1626 ms für
   636 Knoten und 1510 Kanten, Round-Trip byte-identisch, Verlustfenster 250 ms (Entprellzeit des Exports).
   CR-GC-392 hat es nicht umgesetzt: „möglich, nur nicht nötig", und es dreht `REQ-graph-is-ssot` um.
   Nicht gemessen: die Startzeit beim heutigen Modell und bei einem großen Fremdmodell.

Weg 2 macht diesen CR, den Eintrag „Store vorhanden, Snapshot neuer" der FAQ und das Rezept
„`graph_reseed` nach `git pull`" überflüssig. Er kostet Startzeit je Host-Start und verlangt, dass kein
Export aussteht, wenn der Host endet (`flush()` beim Shutdown gibt es seit CR-GC-392; ein harter Abbruch
innerhalb der Entprellzeit verliert den letzten Zug).

## Offen für den Auftraggeber

Weg 1 oder Weg 2? Bis zur Entscheidung wird nichts umgesetzt.

---

## Entscheidungen

_(nur Festlegungen, die ueber diesen CR hinaus gelten. Wendet der CR nur die FAQ an oder baut er einmalig um: „keine".)_

| Frage | Festlegung | Begründung |
|---|---|---|

| Liegt ein Store vor und ist der committete Snapshot neuer, was tut der Host beim Start? | Er meldet es und baut nicht selbst neu auf. Weg 2 (bei jedem Start aus dem Snapshot aufbauen) ist verworfen. | Ein ungewollter Reseed verwirft lokale, noch nicht exportierte Züge. Entscheidung des Auftraggebers 2026-11-14. |

---

## Umfang laut `graph_impact`

Modell-Zug (2026-11-14, über `graph_mutate`): neue `REQ-snapshot-drift-notice` (satisfy von `FUNC-graph-store`),
`TEST-snapshot-drift` (verify, `testRefs` auf `tests/snapshot-drift.test.ts`), CR-Knoten mit `relation` auf
`FUNC-graph-store` und `REQ-snapshot-drift-notice`. Testauswahl laut `graph_tests({changeSet: [FUNC-graph-store, REQ-snapshot-drift-notice]})`: 9 Dateien.

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.
