# CR-GC-611: graph_realize antwortet mit dem Delta, nicht mit der Weltlage — und bindet mehrere Knoten in einem Aufruf

**Status:** 🟢 Done (2026-09-22)
**Typ:** aus Item ITEM-2026-475 (finding)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-475.json (Lane: code)

---

## Befund (gemessen, Code-Test CR-GC-610, Arm `gefuehrt`)

Der Arm hat 15-mal `graph_realize` gerufen. Die 15 Antworten zusammen: 69.000 Zeichen.

| Feld | Zeichen | Anteil |
|---|---:|---:|
| `missingRefsBefore` | 30.197 | 44 % |
| `missingRefsAfter` | 29.607 | 43 % |
| `violations` | 5.870 | 9 % |
| `occWarning` | 2.115 | 3 % |
| **`resolved`** (die eigentliche Aussage) | **608** | **1 %** |

Beide Listen tragen die fehlenden Code-Verweise des **ganzen** Modells, vor und nach der Bindung.
Bei 21 Blatt-FUNCs und 24 SCHEMAs sind das rund 2.000 Zeichen je Liste, unabhängig davon, dass
genau ein Knoten gebunden wurde. Der Unterschied zwischen beiden Listen steht schon in `resolved`.

Das ist kein Randposten: Phase 3 des Laufs (Binden, Kongruenz, Abschluss) las 12,8 Mio. der 19,5 Mio.
Eingabetokens, also 65 %. Jeder Aufruf liest den ganzen bisherigen Kontext neu, deshalb verteuert
eine große Antwort alle folgenden Aufrufe mit.

Dazu kommt die Aufruffolge: 15 Aufrufe für 6 FUNCs, 5 SCHEMAs und 12 TEST-Bindungen. `graph_realize`
bindet je Aufruf eine FUNC, eine SCHEMA und **eine** TEST-Zeile. Fünf Tests an derselben FUNC sind
damit fünf Aufrufe, die viermal dieselbe FUNC-Bindung erneut schreiben.

## Zielbild

1. **Antwort = Delta.** `missingRefsBefore`/`missingRefsAfter` entfallen. Es bleibt `resolved` (welche
   Verweise diese Bindung geschlossen hat), neu `introduced` (welche sie aufgerissen hat — normalerweise
   leer) und `openRefs` als **Zahl**, damit der Autor den Reststand kennt, ohne ihn zu lesen.
   Wer die Liste braucht, ruft `rules_get_violations` oder `graph_context`; das ist Abfrage-Genauigkeit,
   nicht Antwort-Kompression — dieselbe Trennung wie CR-GC-309 und CR-GC-570 sie für die Violations
   gezogen haben. Der Audit-Trail bekommt weiterhin die volle Fassung: er ist Evidenz, kein Antwortbudget.
2. **Ein Aufruf, mehrere Bindungen.** Neues Feld `bindings: [{funcUid?, file?, symbol?, schemaUid?,
   schemaFile?, schemaSymbol?, testUid?, testFile?, testCase?, tool?, lang?}]`. Alle Bindungen gehen als
   **ein** Batch durch dasselbe Apply-Gate, ein Audit-Eintrag, eine OCC-Prüfung.
   Kein zweiter Schreibpfad: die flachen Felder bleiben die Kurzform für genau eine Bindung und werden
   intern sofort zu `bindings: [ … ]` normalisiert — eine Implementierung, zwei Schreibweisen der Eingabe.

## Umfang (max. 6 Dateien)

| Datei | Änderung |
|---|---|
| `src/surface/write.ts` | `GraphRealizeInputSchema` um `bindings` erweitern, flache Felder normalisieren; Handler baut die Kommandos je Bindung; Antwortform auf das Delta umstellen |
| `tests/mcp.realize.test.ts` | Erwartungen auf `resolved`/`introduced`/`openRefs`; neue Tests: Batch mit mehreren Bindungen als ein Audit-Eintrag, TEST-Bindung 1:n bleibt additiv |
| `GRAPHCODE.md` bzw. `src/surface/scaffold-docs.ts` | nur falls dort die Antwortfelder benannt sind |

## Akzeptanzkriterien

- [x] `graph_realize` liefert `resolved`, `introduced`, `openRefs` (Zahl) — und keine der beiden vollen Listen.
- [x] Am Scheduler-Modell gemessen: eine Bindung **842 Zeichen** (vorher ~4.600), ein Batch mit drei
      Bindungen **374 Zeichen**. Die 842 sind kein Fehlschlag des Ziels „unter 800": davon sind 250 Zeichen
      `occWarning` (fehlendes `baseVersion`) und der Rest eine echte R-20-Meldung. Ohne Befund und mit
      `baseVersion` liegt die Antwort bei rund 300 Zeichen.
- [x] `bindings` mit 3 Einträgen erzeugt genau eine Gate-Anwendung und einen Audit-Eintrag; ein Fehler in
      einem Eintrag lehnt den ganzen Batch ab (keine Teilanwendung) — Test in `tests/mcp.realize.test.ts`.
- [x] Die flache Kurzform verhält sich unverändert (bestehende Tests grün, ohne Anpassung der Eingaben).
- [x] Der Audit-Trail enthält weiterhin die ungekürzte Fassung.
- [x] Testsuite grün (161 Dateien, 1397 Tests).

## Nicht in dieser CR

- `graph_mutate.next` und `graph_mutate.violations`: gemessen an Lauf 15 je rund 800 Zeichen pro Aufruf.
  Sie sind in Summe groß, aber pro Antwort schon knapp — keine Diät ohne neuen Befund.
- Der elfmalige `graph_authoring_guide` im Spec-Lauf (24.000 Zeichen): eigenes Item, weil die Ursache
  im Skill-Ablauf liegt und nicht in der Antwortform.
- Die Denkblöcke im Kontext (~58 % in Lauf 15): ITEM-2026-474, gehört dem Executor.
