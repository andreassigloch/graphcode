# CR-GC-987: Vertragstest-Generator prüft Wertregeln und friert die Enum-Werteliste ein

**Typ:** aus Item ITEM-2026-1552 (finding)
**Erstellt:** 2026-11-21
**Item:** bok/items/ITEM-2026-1552.json (Lane: code)
**Auftrag:** Autor, 2026-11-21: „Wertregeln im Generator: ja, GO“.

---

## Befund

CR-GC-980 maß: 12 Mutanten an Wertregeln (`min(1)` entfernt, `nonnegative` entfernt, `positive` zu `nonnegative`, `int` entfernt, Liste darf nicht leer sein) blieben mit dem erzeugten Test grün. Nur Handdateien `tests/vertrag/*.elemente.test.ts` fingen sie (36 Fälle in 6 Dateien aus CR-GC-980, 985 und 986). Der Generator (`src/projections/vertragstest.ts`) las die Prüfungen aus `_zod.def.checks` nur, um das gültige Beispiel zu bauen, und erzeugte keinen Ablehnungsfall dazu.

Enum-Unklarheit: In CR-GC-980 fand der erzeugte Test 3 von 3 Enum-Mutanten, in CR-GC-981 0 von 1 (`severity` um `fatal` erweitert). Ursache: Der Fall „außerhalb des Enums“ prüft `'__ausserhalb__'`. Die Mutanten aus CR-GC-980 weiteten das Enum zu `z.string()`, das nimmt `'__ausserhalb__'` an. Ein Enum mit einem Wert mehr lehnt `'__ausserhalb__'` weiter ab: Der Generator kennt den neuen Wert nicht, also kann kein Parse-Fall ihn nennen. Das ist eine Lücke, keine Grenze des Verfahrens. Sie schließt mit der Werteliste als eingefrorener Liste.

## Änderung

**Code (1 Quelldatei, `src/projections/vertragstest.ts`).** Je Wertregel, die der Erzeuger liest, entsteht auf jeder Ebene (Objektfeld, Listenelement, Tupel, Record, Union-Variante, durch `optional`/`nullable`/`pipe`/`lazy`) ein Fall knapp außerhalb (abgelehnt) und ein Fall auf der Grenze (angenommen):

| Prüfung | Abgelehnt | Angenommen |
|---|---|---|
| Text: `min_length`, `max_length`, `length_equals` | Länge min−1, max+1 | Länge min, max; leerer Text, wenn erlaubt |
| Liste: dieselben | min−1, max+1 Elemente | min, max Elemente; leere Liste, wenn erlaubt |
| Zahl: `greater_than`, `less_than` (je Richtung die engste Grenze) | eingeschlossen: Grenze ∓ 1 (ganze Zahl) bzw. ∓ 0,001; ausgeschlossen: die Grenze selbst | eingeschlossen: die Grenze; ausgeschlossen: Grenze ± 1 bzw. ± 0,001 |
| Zahl: `int` | Wert + 0,5 | |
| Text: Format (`datetime`, `date`, `uuid`, `email`, `url`) | `__kein_format__` | |
| Text: Regex | ein Kandidat aus einer festen Liste, der diese Regex verletzt und alle anderen Regex, Längen erfüllt | |

Zwei kleine Fälle in derselben Art, die der Handbestand brauchte: `nullable` nimmt `null` an, ein optionales Feld darf fehlen (vorher entstand dort ein Ablehnungsfall, den das Original verwarf), ein Record nimmt `{}` an. Die Werteliste jedes Enums steht als eingefrorene Liste in der Datei (`Werteliste unverändert`); die Datei liest sie über den Weg im Schema von der Wurzel zur Stelle (`bei([...])`).

Wo kein sicherer Fall entsteht, steht die Prüfung in `verworfen` des Berichts (Feld besteht schon, kein neues Feld, `SCHEMA-vertragstest-bericht` bleibt unverändert): Längenregel an einem Text mit Format oder Regex, Format mit Längenregel, Regex ohne verletzenden Kandidaten, Obergrenze über 1000, leerer Zahlenbereich. Im Bestand tritt keiner dieser Fälle auf (Bericht der 21 erzeugten Dateien, außer den schon vorhandenen verworfenen Fällen: Zusatzfeld an nicht strikten Objekten, `context` mit falschem Typ). `refine`, `superRefine` und `z.custom` bleiben außerhalb.

## Nachweis

**(a) Unit-Tests des Generators** (`tests/vertragstest.test.ts`, 15 neue Fälle, auf dem alten Generator rot gesehen (15 rot), danach 50 grün): je Prüfungsart ein eigenes kleines Schema; Ebenen-Test mit Objekt, Liste, Tupel, Record, Union, optional; Fälle ohne sicheren Wert; Enum mit Weg zur Stelle.

**(b) Mutanten** (`docs/messung/vertragstest-mutanten-cr-gc-987.md`):

| Art | Mutanten | alt rot | neu rot |
|---|---|---|---|
| Wertregel aus CR-GC-980 | 12 | 0 | 12 |
| Struktur aus CR-GC-980 | 17 | 17 | 17 |
| Wertregel an den Schemas der Handdateien (neu) | 16 | 0 | 16 |
| Optionalität: Feld optional zu Pflicht, `nullable` entfernt (neu) | 4 | 0 | 4 |
| Enum um einen Wert erweitert, am eigenen Schema (neu) | 2 | 0 | 2 |
| Struktur, zusätzlich (neu) | 1 | 1 | 1 |

„alt“ der 17 Strukturmutanten ist 17, weil HEAD den Generator von CR-GC-980 trägt (damals 8). Alle Mutanten am eigenen Quell-Schema, nie in `node_modules`.

**(c)** Alle 21 erzeugbaren `tests/vertrag/*.vertrag.test.ts` neu erzeugt (`node dist/cli.js vertragstest` mit den uids der 22 Dateien), alle grün gegen das Original: kein neu erzeugter Fall war rot, kein Befund an Generator oder Schema. `SCHEMA-test-ingest-input` bleibt Handdatei (zwei `refine`, der Generator meldet „kein angenommenes Beispiel“).

**(d) Handfälle.** Jeder der 36 Handfälle gegen die neuen Fälle geprüft; der Generator deckt die Regel mit einem Fall derselben Stelle, bei eigenem Schema mit Mutante (Tabelle (b)), bei Regeln aus `@sigloch/contracts` (Zähler, `confidence`, `tier`, `graphVersion`, `staleDelta`) mit dem gleichen Fall am selben Pfad in der erzeugten Datei (zu prüfen am Dateinamen der Fälle, z. B. `appliedCommands: lehnt ab: -1 unter der Untergrenze 0`); Mutanten dort wären Änderungen in `node_modules`.

| Datei | Handfälle vorher | nachher | Rest |
|---|---|---|---|
| export-answer | 6 | 0 | Datei gelöscht |
| test-ingest-answer | 3 | 0 | Datei gelöscht |
| work-set | 4 | 0 | Datei gelöscht |
| render-summary | 4 | 0 | Datei gelöscht |
| import-summary | 6 | 0 | Datei gelöscht |
| mutate-answer | 13 | 0 | Datei gelöscht; zwei Aussagen fallen ohne Ersatz: „NaN wird abgelehnt“ (das leistet `z.number()` selbst, keine Regel des Schemas) und „Liste mit ungültigem zweiten Eintrag wird abgelehnt“ (der Fall prüft nichts, was der Fall am ersten Eintrag nicht prüft: beide Varianten der Union lehnen den Eintrag ab) |
| **Summe** | **36** | **0** | |

Erwartet war: es bleibt, was an `refine` hängt. Das ist `SCHEMA-test-ingest-input.vertrag.test.ts` (23 Fälle, von Hand, schon vor dem CR kein Teil der 36). Aus den `testRefs` von `TEST-vertrag-export-answer`, `-test-ingest-answer`, `-work-set`, `-import-summary`, `-render-summary`, `-mutate-answer` sind die sechs `.elemente`-Einträge entfernt; die Dateien sind gelöscht (kein paralleler Pfad).

**Zahlen der erzeugten Dateien** (22 Dateien in `tests/vertrag`, 21 erzeugt): Fälle vorher 835, nachher 1342; Zeilen vorher 2651, nachher 4268.

## Dateien

Quelle und Test: `src/projections/vertragstest.ts`, `tests/vertragstest.test.ts` (2). Gelöscht: 6 Handdateien `*.elemente.test.ts` (6). Neu erzeugt (mechanischer Fan-out, FAQ `cr-dateigrenze-ausnahme`): 21 Dateien `tests/vertrag/SCHEMA-*.vertrag.test.ts`, alle aus demselben Lauf des Generators; ein Aufteilen ließe Dateien aus dem alten und dem neuen Generator nebeneinander stehen. Ohne Fan-out 8 Dateien. Dazu `docs/messung/vertragstest-mutanten-cr-gc-987.md`.

## Schätzung: Kombinationen optionaler Felder (nicht gebaut)

Nicht gebaut, Entscheidung des Autors steht aus. Der Generator müsste je Objekt Teilmengen der optionalen Felder bilden: 2^n Fälle bei n Feldern, das ist bei `SCHEMA-mutate-answer` (rund 12 optionale Felder) zu viel, also eine Obergrenze (etwa n ≤ 4 voll, sonst nur einzeln und alle) und je Teilmenge das Urteil des Originals; rund 40 Zeilen Generator und ein weiterer Unit-Test je Fall. `SCHEMA-test-ingest-input` hängt mit seinen beiden `refine` nur an der Anwesenheit von `report`, `results`, `changeSet` (3 Felder, 8 Teilmengen): diese Bedingungen deckte der Generator vollständig ab; ob die übrigen 23 Handfälle der Datei damit entfielen, ist nicht Fall für Fall geprüft.

## Akzeptanz

- [x] Rot-zuerst: Unit-Tests auf dem alten Generator 15 rot.
- [x] Mutanten: 12 von 12 Wertregeln, 17 von 17 Strukturen, Enum erweitert 2 von 2.
- [x] Erzeugte Dateien grün gegen das Original; Handdateien gelöscht.
- [x] `npm run type-check` und `npm run build` grün.
- [x] `verify:code` grün: 77 Dateien, 1843 Tests, Bindung 1/1, Rückmeldung 61 Ergebnisse, 0 zurückgenommen.
- [x] `verify:full CR-GC-987` grün: 267 Dateien, 3444 Tests in 491 s, Schlupf 0 (zwölf CODE-CR ohne Schlupf in Folge), Rückmeldung 205 Ergebnisse.
- [x] Regeln (`rules_evaluate` grouped, nach dem CR): R-26 8, R-32 11, RC-04 15 — wie in CR-GC-986 (der CR ändert kein SCHEMA und keinen FLOW); VR-01 (Info) nennt `TEST-vertrag-mutate-answer`: der Eintrag `tests/mcp.mutate-answer.test.ts` trägt kein Ergebnis, bis der nächste Lauf ihn meldet.
- [x] Smoke: `node dist/cli.js vertragstest` ohne uids läuft durch und nennt je SCHEMA Ergebnis oder Grund (22 Ergebnisse, ein Grund: `SCHEMA-test-ingest-input`, „kein angenommenes Beispiel“, Handdatei wegen zweier `refine`). Der Lauf erzeugt auch 39 Dateien für SCHEMA ohne Vertragstest-Datei im Repo; sie gehören nicht zu diesem CR und wurden nicht behalten.

---

## Entscheidungen

| Frage | Festlegung | Begründung |
|---|---|---|
| Wer deckt die Wertregeln, der Generator oder die Hand? | der Generator, auf jeder Ebene | Auftrag des Autors vom 2026-11-21; Mutanten 12 von 12 |
| Enum um einen Wert erweitert | Werteliste als eingefrorene Liste je Enum | kein Parse-Fall kann einen neuen Wert nennen |
| Kombinationen optionaler Felder für `refine` | offen, beim Autor | Schätzung oben |

---

## Umfang laut `graph_impact`

Kanten des CR (`relation`): `FUNC-erzeuge-vertragstests`, `REQ-contract-test-generation`. Das Berichtsschema (`SCHEMA-vertragstest-bericht`) ist unverändert, weil kein Feld dazukam.
