# CR-GC-838: Zehn Pre/Post-REQ-Paare zusammengelegt

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-1017 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-1017.json (Lane: graph)

---

## Befund

Seit CR-SM-366 gibt es die Arten precondition und postcondition nicht mehr:
- Die Vorbedingung ist der Eingangsfluss der Kette.
- Die Nachbedingung ist das Ziel des UC.

Im Modell standen noch zehn Paare `REQ-pre-*` / `REQ-post-*`, zwei weitere hat CR-GC-832 aufgelöst.

- **Falsch zugeordnet:** Vier Paare hingen als non-functional an einer FCHAIN (agent-query, apply-gate, capture, impact-testing), beschreiben aber Verhalten einer Funktion.
- **Texte versprachen mehr, als der Test prüft:**
  - apply-gate: „Live-Event + Trajectory emittiert, consumerType geloggt“. TEST-mutate-gate prüft Persistenz und Block.
  - capture: „kein auto-apply, Review vor Persist“. Das Gate speichert sofort, wenn kein neuer Fehler entsteht.
- **Falsche Tests:**
  - TEST-bootstrap prüft das Befüllen durch das Gate, nicht importOntologyGraph.
  - TEST-merge-no-duplicate-edge prüft die Merge-Zeile von graph_mutate, nicht replayBranchLog.

## Änderung (Modell)

- **Zusammengelegt:** Je Paar ist die Vorbedingung in die Nachbedingung aufgegangen (Merge-Zeile). Der Text sagt jetzt, was der verifizierende Test prüft, und der Name ist neu.
- **Arten und Erfüller:**
  - agent-query, apply-gate, capture und impact-testing sind jetzt `functional`.
  - Erfüller sind FUNC-read-tools, FUNC-mutate, FUNC-graph-mutate-tool und FUNC-select-tests statt der Kette.
- **verify-Kanten entfernt:**
  - TEST-merge-no-duplicate-edge → REQ-post-merge-nodes. Der Test verifiziert weiter REQ-graph-integrity.
  - TEST-bootstrap → REQ-post-import. Der Test verifiziert weiter REQ-bootstrap-through-gate.
- **Bestand:** kein `REQ-pre-*` mehr im Modell. Die Kennungen `REQ-post-*` bleiben, damit CR-Bezüge halten; der Name trägt die Aussage.

## Messung

v831 → v834 in drei Zügen: Kanten und Arten, Zusammenlegen, Rest-Kante. 0 neue Fehler, 0 neue Warnungen.

## Code-Befunde (nicht in diesem CR)

- **REQ-post-capture:** TEST-capture hat keine testRefs. Die Anforderung ist ungeprüft.
- **REQ-post-import:** Nur TEST-import-code-verb verifiziert sie, und der Test ruft importOntologyGraph nur mittelbar. Das Melden ungeprüfter REQs und das Zurückhalten von Kanten prüft kein Test.
