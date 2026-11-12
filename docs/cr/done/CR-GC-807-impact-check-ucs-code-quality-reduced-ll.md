# CR-GC-807: Impact-Check: UCs code-quality, reduced-llm, deterministic-steering lesen sich als Anforderungen an den Kern-UC - Herabstufen zu REQ pruefen

**Status:** ✅ Done (2026-11-12)
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

---

## Messung (2026-11-12, v1097, nach CR-GC-806)

Kern-UC aus CR-GC-806: `UC-intent-to-code`. Herabstufen heißt im Trockenlauf: UC löschen, gleichnamige
REQ unter `UC-intent-to-code`, die Ketten des UC an den Kern-UC, die REQ des UC unter die neue REQ,
CR- und MS-Kanten auf die neue REQ.

### 1. Was hängt dran, wohin wandert es

| UC | Ketten | davon neu am Kern-UC | REQ | REQ mit weiterem UC-Elternteil | CR-Kanten | MS |
|---|---|---|---|---|---|---|
| code-quality | apply-gate, capture, skill-authoring | 0 | 41 | 2 | 3 | MS-1 |
| reduced-llm | advisory-roundtrip, agent-query, apply-gate, grammar-query | 2 (advisory-roundtrip, grammar-query) | 10 | 0 | 11 | MS-1 |
| deterministic-steering | generation-states, skill-help, skill-report, steering-loop | 4 (alle) | 22 | 0 | 2 | – |

### 2. Welche Regeln feuern (dryRun, je UC einzeln)

Je UC genau ein Fehler: **R-01** an der neuen REQ (kein prüfender TEST). FC-02, R-02, R-21 und CR-R01
feuern nicht. Vorhandene TEST-Knoten, die die Lücke schließen könnten:

| neue REQ | Kandidat | Zustand |
|---|---|---|
| REQ-code-quality | `TEST-code-quality` | ohne `testRefs` (R-19 meldet ihn schon) |
| REQ-reduced-llm | `TEST-reduced-llm` | ohne `testRefs` (R-19) |
| REQ-deterministic-steering | `TEST-single-measurement-path` | gebunden (`tests/steering.measurement-path.test.ts`) |

### 3. Wer liest die UC

| UC | Sichten (Export, regenerieren sich) | Code/Tests | Doku |
|---|---|---|---|
| code-quality | nfr, fmea, conops, srs, references | Kommentare in `tests/mvp-e2e.test.ts` | `vorfuehrung-bausteinkonzept.md` |
| reduced-llm | changelog, conops, srs, cr-list, references | Kommentare in `tests/mvp-e2e.test.ts` | `vorfuehrung-bausteinkonzept.md` |
| deterministic-steering | conops, fmea, references, srs | – | `vorfuehrung-bausteinkonzept.md` |

Kein Skill und kein Quellcode in `src/` nennt eine der drei uids.

### 4. Vorschlag je UC, mit Preis

| UC | Vorschlag | Preis |
|---|---|---|
| code-quality | **herabstufen** zu REQ am Kern-UC (funktional: wie geändert wird) | 1 Batch (~97 Zeilen), `TEST-code-quality` binden, 1 Kommentar im Test, 1 Absatz Doku |
| reduced-llm | **herabstufen** zu nicht-funktionaler REQ (Achse Modellgröße) | 1 Batch (~54 Zeilen), `TEST-reduced-llm` binden, 2 Ketten neu am Kern-UC |
| deterministic-steering | **offen**: herabstufen (der Kern-UC bekommt 4 Ketten der Steuerung dazu) oder als eigenes Nutzerziel „Modell gegen ein Zielprofil verbessern" behalten und umbenennen | herabstufen: 1 Batch (~60 Zeilen), TEST wählen · behalten: 1 Zeile Umbenennung |

Entscheidung durch den Auftraggeber; der Umbau ist ein eigener CR (se-umbau).

## Entscheidung (Auftraggeber 2026-11-12)

Vorschläge angenommen. code-quality und reduced-llm werden REQ am Kern-UC; deterministic-steering
bleibt UC und heißt „Modell gegen ein Zielprofil verbessern“ (die günstigere Variante, ein eigenes
Nutzerziel). Umgesetzt in CR-GC-916.
