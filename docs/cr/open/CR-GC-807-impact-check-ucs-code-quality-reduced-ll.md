# CR-GC-807: Impact-Check: UCs code-quality, reduced-llm, deterministic-steering lesen sich als Anforderungen an den Kern-UC - Herabstufen zu REQ pruefen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-894 (finding)
**Erstellt:** 2026-10-14
**Item:** bok/items/ITEM-2026-894.json (Lane: graph)
**Nach:** CR-GC-806 (Kern-UC muss stehen, bevor etwas unter ihn wandert)

---

## Befund

Drei UC beschreiben kein Nutzerziel, sondern eine Eigenschaft, die der Kern-UC (CR-GC-806) erfüllen muss:

| UC | Name | liest sich als |
|---|---|---|
| `UC-code-quality` | Jede Aenderung geht durchs Gate | funktionale Anforderung (wie geändert wird) |
| `UC-reduced-llm` | Mit kleinem oder lokalem Modell arbeiten | nicht-funktionale Anforderung (Achse Modellgröße) |
| `UC-deterministic-steering` | Deterministisch auf ein Ziel steuern | Anforderung (wie der nächste Schritt entsteht) |

## Ist-Umfang (graph_get_edges compose, v750)

| UC | FCHAIN | REQ | weitere Eltern |
|---|---|---|---|
| code-quality | apply-gate, capture, codec-roundtrip, interface-escalation, skill-authoring | 42 | SYS, MS-1-specification |
| reduced-llm | advisory-roundtrip, agent-query, grammar-query, modelfree-gate | 12 | SYS, MS-1-specification |
| deterministic-steering | generation-states, skill-help, skill-report, steering-loop | 22 | SYS |

## Auftrag: nur messen, nicht umbauen

Je UC ermitteln und hier eintragen, bevor entschieden wird:
1. `graph_impact(UC)` Tiefe 2: was hängt an den Ketten und REQ, wohin wandern sie?
2. Welche Regeln feuern nach dem Herabstufen (Trockenlauf durchs Gate, `dryRun`): FC-02 (Leaf-UC hat
   FCHAIN), R-02, R-21, CR-R01 an den CRs mit `relation → UC`.
3. Wer liest die UC: Views (RTM, ConOps, Changelog), MS-1-specification, Skills.
4. Vorschlag je UC: herabstufen zu REQ am Kern-UC / bleibt UC / umbenennen — mit Preis.

Entscheidung danach durch den Auftraggeber; ein Umbau ist ein eigener CR (se-umbau).

## Umfang

Modell: die drei UC, ihre 13 FCHAIN und 76 REQ (lesend). Keine Mutation in diesem CR.
