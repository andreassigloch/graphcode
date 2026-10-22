# CR-GC-827: Regelprüfung liest den Kandidaten von mutate

**Status:** ✅ Done (2026-10-22)
**Typ:** aus Item ITEM-2026-999 (finding)
**Erstellt:** 2026-10-22
**Item:** bok/items/ITEM-2026-999.json (Lane: graph)

---

## Befund

`src/kernel/gate.ts` (`apply`, Zeilen 131–176): Zustand aus dem Store lesen → Befehle im Speicher anwenden →
`this.evaluate(candidate)` → erst bei Annahme `store.commit`. Im Modell bekam FUNC-evaluate-rules den Graphen
nur aus dem Store (FLOW-graph-state); den Kandidaten aus mutate gab es nicht. In der Animation von
FCHAIN-apply-gate lief die Regelprüfung deshalb nach dem Schreiben.

## Änderung (Modell)

- Neu FLOW-gate-candidate „Kandidat (im Speicher)", `sync`, Vertrag SCHEMA-ontology-graph:
  FUNC-mutate → FUNC-evaluate-rules.
- FLOW-graph-state → FUNC-evaluate-rules bleibt: das Regelwerkzeug und der Health-Endpunkt prüfen den Store.

## Messung

v807 → v808: keine neuen Befunde, Steuerwert 5,75 → 5,75. ℝ⁶-Hinweis: modifiability −0,017, coherence −0,041
(Rückgang, kein Gate-Urteil).

Die Reihenfolge in der Animation ändert dieser Zug allein nicht (Simulation: Regelprüfung bleibt Schritt 6,
Schreiben Schritt 5) — sie braucht die Auswertung von `sync` im Viewer (CR in graph-view-edit).
