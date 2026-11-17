# CR-GC-953: contracts 12.14.0 übernehmen: R-26 Stufe 8 (CR-SM-437), RD-06 (CR-SM-435), FC-04 answer (CR-SM-438) — 15 rote Tests in 8 Dateien, Regelmatrix und Hilfetext

**Status:** ✅ Done (2026-11-17)
**Typ:** aus Item ITEM-2026-1421 (finding)
**Erstellt:** 2026-11-17
**Item:** bok/items/ITEM-2026-1421.json (Lane: code)

---

## Befund

contracts 12.14.0 (Regelkatalog 53.0.0) bringt drei Änderungen. Gegen diesen Stand waren 15 Tests in 8 Dateien rot:

- **CR-SM-437:** R-26 (SCHEMA trägt `realRef`) wechselt von Stufe 11 „Bindung“, Marke Bau, auf Stufe 8 „Schema“,
  Marke CDR. Das Zod-Schema im Code ist Teil der Spezifikation. R-26 meldet, sobald es ein SCHEMA gibt, auch im Entwurf.
- **CR-SM-435:** Die neue Regel RD-06 verlangt genau einen Erfüller je Anforderung. Der Katalog hat jetzt 68 Regeln
  im Kern, 81 insgesamt.
- **CR-SM-438:** FC-04 nennt `se-vorbereitung` nicht mehr als Folge-Skill.

## Root Cause

Tests, Hilfetext und ICD-Kommentar setzten R-26 als Bindungsregel des Baus voraus. Die Zählungen in Artikeln und
auf der Seite „Systemmodell in Bildern“ standen auf dem alten Katalog.

## Zielbild

- `HELP_ELEMENT_STATES` nennt R-26 als Teil der Spezifikation, fällig ab dem ersten SCHEMA. R-19 und R-20 bleiben
  bis zur Eröffnung des Baus still.
- Die Tests prüfen R-26 im Entwurf als offen. Gate und ICD markieren dieselben SCHEMA (T-B4).
- Die Testgraphen erfüllen RD-06: eine Kind-REQ je Funktion. Das Golden von sigllm bekommt RD-06 als offene Regel,
  es wird nicht gerichtet.
- Die Zählungen in Artikeln, Seite und Regelmatrix folgen dem Katalog. Das gehört zum getrennten Doku-Commit.

## Abnahme

- `npm run build` grün.
- Die 7 geänderten Testdateien grün.
- Das Golden von sigllm meldet RD-06 an 3 Anforderungen mit je zwei Erfüllern.
- `npm run verify:full CR-GC-953` grün.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| keine | – | Der CR wendet CR-SM-435, CR-SM-437 und CR-SM-438 an. |

---

## Umfang laut `graph_impact`

- `FUNC-graph-help` (Kante `relation` vom CR). `graph_tests` wählt `mcp.help`, `mcp.readiness`,
  `mcp.stdio-server` und `mutate.formate-ops`.
- `src/projections/incose.ts` hat keinen Knoten im Modell. Geändert ist nur ein Kommentar.
- Im Modell zeigen `realRef`-Pfade noch auf `src/viewer/help-content.ts`. Das ist veraltet und nicht Teil dieses CR.

## Dateien

1. `src/projections/help-content.ts`
2. `src/projections/incose.ts`
3. `tests/export.testref-materialize.test.ts`
4. `tests/focus-set.test.ts`
5. `tests/generate.statemachine.test.ts`
6. `tests/generate.test.ts`
7. `tests/readiness.completeness.test.ts`
8. `tests/steering.artifact-coupling.test.ts`

Im Doku-Commit danach, nicht in diesem CR: `docs/articles/03-…`, `docs/articles/04-…`,
`docs/project/systemmodell-in-bildern.html` und `tests/claims.conformance.test.ts`. Dieser Test prüft die
Zählung in den Artikeln. Die neu erzeugte `docs/views/regel-matrix.{md,csv}` kommt mit dem Modell in den CR-Commit:
Der pre-commit-Hook nimmt `docs/views` immer mit.

**Zwischenstand:** Der Auftraggeber hat zwei Commits verlangt: den CR und die Doku getrennt. Seit contracts 12.14.0
installiert ist, sind alle 8 Testdateien auf `master` rot. Nach dem CR-Commit bleibt nur `claims.conformance` rot, bis
der Doku-Commit folgt. Kein Schnitt erzeugt einen zweiten Weg. Der CR selbst bleibt bei 8 Dateien, unter der Grenze von 10.

## Ergebnis

`npm run verify:full CR-GC-953` am 2026-11-17 gegen contracts 12.14.0 aus der Registry: 231 von 231 Dateien,
1914 von 1914 Tests grün, Schlupf 0.

Ein erster Lauf hatte einen roten Spike (`arch.optimization-dry-run`, Hash der Graph-Datei vorher = nachher).
Während dieses Laufs wurde der Knoten CR-GC-953 über das Gate angelegt, und der Host hat die Graph-Datei neu
exportiert. Dasselbe Muster ist in CR-GC-932 beschrieben. Allein auf ruhigem Baum war der Spike grün, der zweite
Volllauf ebenfalls. Der erste Lauf steht mit Schlupf 1 in `docs/messung/testauswahl.jsonl`. Dieser Schlupf kam von
der Umgebung, nicht von der Testauswahl.
