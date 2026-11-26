# CR-GC-918: Eine Anforderung hat genau einen Erfueller

**Status:** ✅ Done (2026-11-17)
**Typ:** aus Item ITEM-2026-1320 (finding)
**Erstellt:** 2026-11-12
**Item:** bok/items/ITEM-2026-1320.json (Lane: code)
**Produzent der Regel:** CR-SM-435 (RD-06 „Single satisfier"); dieser CR haengt nicht davon ab.

---

**Bezug:** [`SPIKE-GC-ein-erfueller-je-req-RESULTS.md`](../../archive/spikes/SPIKE-GC-ein-erfueller-je-req-RESULTS.md),
Batches [`SPIKE-GC-ein-erfueller-je-req.fe`](../../archive/spikes/SPIKE-GC-ein-erfueller-je-req.fe).
Entscheidung des Autors 2026-11-12: Eine Anforderung hat genau einen Erfueller. Kann keine Funktion sie
allein erfuellen, wird sie zerlegt; geht das nicht, ist sie eine NFR oder eine Mischung.

## Befund

Im Modell (HEAD 7e46c55b) haben 40 von 200 REQ mehr als einen Erfueller, zusammen 121 `satisfy`-Kanten.
Der Spike hat sie an einer Kopie auf je einen Erfueller gebracht: 24 zerlegt, 4 Mengen-Einschraenkungen
und 4 NFR auf ein gemeinsames Element, 6 Hilfskanten gestrichen, 2 fehlende FUNCs angelegt
(`laufUrteil`, `meldeZurueck`), 1 Art korrigiert. Das Gate nahm alle drei Batches ohne Fehler an.

Danach melden 29 Funktionen R-02: sie hatten keine eigene Anforderung und hingen nur an einer
Sammel-REQ. Daraus folgen 78 R-21-Befunde. Der Spike hat die Kind-REQ-Texte und die TEST-Zuordnung
nicht am Code geprueft.

## Zielbild

1. **Batches anwenden.** Die drei Batches aus dem Spike laufen ueber `graph_mutate` gegen das echte
   Modell, erst als Trockenlauf. Weicht das Modell inzwischen ab (CR-GC-909 und CR-GC-910 schreiben
   gerade ins Modell), wird der Batch angepasst, nicht erzwungen.
2. **Kind-REQ am Code pruefen.** Je Kind-REQ: prueft der zugeordnete TEST genau diese Zusage? Wenn
   nicht, Text auf das Gepruefte einengen oder TEST ergaenzen (`se:author-req`: der Text verspricht nur,
   was der Test prueft). Mit Vorrang die drei Faelle mit Mehrversprechen: `REQ-auto-export-nach-zug`,
   `REQ-status-sammeln`, `REQ-steuerung-deterministisch`.
3. **Eigene REQ fuer die 29 Funktionen** aus R-02, je eine funktionale REQ mit TEST
   (`se:author-req`, EARS). Ist eine Funktion nur ein innerer Schritt ohne eigene Zusage, wird das mit
   Grund akzeptiert und im CR gelistet.
4. **Nebenbefunde aus der Qualitaetspruefung** im selben Zug: Wie, Aenderungsnotizen und Altkennungen
   aus den Eltern-REQ-Texten streichen; „Dimension" in `REQ-steering-from-metrics` durch „Stufe"
   ersetzen; die zwei Prozessvorgaben aus den Texten nehmen; das Duplikat `REQ-store-recovery` gegen
   `REQ-schema-version-migration` und `REQ-first-session-claims-store-lock` aufloesen.
5. **Export, Sichten, Spur MODELL.**

## Akzeptanz

- [x] REQ mit mehr als einem Erfueller: 0 (gezaehlt am exportierten Modell).
- [ ] R-02: 0, oder jeder verbleibende Befund mit Grund akzeptiert und hier gelistet. **Verschoben in den
  Folge-CR** (Entscheidung des Auftraggebers 2026-11-17): 29 Befunde, Grund unten.
- [x] Keine neue Fehlermeldung (`rules_get_violations {severity: error}`), R-01 = 0.
- [ ] Jede Kind-REQ hat einen TEST, der genau ihre Zusage prueft; Abweichungen hier gelistet. **Verschoben in
  den Folge-CR.**
- [x] `npm run verify:model` gruen; `docs/graph` und `docs/views` im selben Commit.
- [x] RD-06 = 0. contracts 12.14.0 ist seit CR-GC-953 eingezogen, die Regel misst direkt.

## Nicht in diesem CR

- **RTM nach A-SPICE:** Ebene nur aus `compose` ableiten, Bezeichnungen nach PAM 4.0 (SYS.2,
  SWE.1/HWE.1, SYS.1 ausserhalb des Graphen), V-Uebersicht im Kopf der RTM. Mit einem Erfueller je REQ
  wird die Ebene eindeutig; eigener CR nach diesem, wegen der Dateigrenze.
- **Ebenensprung:** 37 REQ unter SYS oder UC, von einer tieferen FUNC erfuellt, ohne Zerlegung.
- **Regel RD-06:** CR-SM-435.

## Umfang

`docs/graph/graphcode.graph.json` und die erzeugten Sichten unter `docs/views/` (rtm, srs, testmatrix,
testconcept, architecture, icd, references). Kein Quellcode.

---

## Ergebnis

**Stand 2026-11-17**, Modell graphVersion 1247, contracts 12.14.0.

| Messgroesse | vorher | nachher |
|---|---|---|
| RD-06 (REQ mit mehr als einem Erfueller) | 40 | 0 |
| REQ | 204 | 259 |
| R-02 (FUNC ohne eigene REQ) | 0 | 29 |
| R-21 (Uebergabe ohne Ketten-REQ oder Integrationstest) | 1 | 85 |
| Fehler (severity error) | 0 | 0 |

- Die drei Batches aus dem Spike liefen unveraendert durchs Gate, jeweils erst als Trockenlauf. Seit dem Spike
  hatte sich kein betroffenes Element geaendert.
- Die zwei neuen FUNCs `FUNC-lauf-urteil` und `FUNC-aenderung-melden` haengen jetzt in beiden Spur-Ketten
  (`FCHAIN-verify-lane`, `FCHAIN-verify-lane-full`). Die Fluesse folgen dem Code: Jede Spur gibt ihren vitest-Lauf an
  `laufUrteil` und bekommt das Urteil zurueck. `meldeZurueck` nimmt Bericht und Changeset, ruft
  `graph_test_ingest` und gibt die Antwort an die Spur. Die Fluesse `FLOW-test-run-report-*` und
  `FLOW-test-ingest-answer` laufen jetzt ueber `FUNC-aenderung-melden`, nicht mehr direkt zu `FUNC-test-ingest`.
- **Code:** `VitestLauf` und `LaufUrteil` in `src/projections/test-schlupf.ts` sind jetzt Zod-Schemata
  (`VitestLaufSchema`, `LaufUrteilSchema`), die Typen werden daraus abgeleitet. `laufUrteil` parst seinen Eingang.
  Grund: RC-08 bindet ein SCHEMA nur an ein Zod-Schema (FAQ `schema-bindung-realref`).
  `TEST-test-schlupf` prueft beide Vertraege.
- **Tests nachgezogen:** `hooks.inject-graph-slice` (Grundwahrheit: `REQ-real-health-check` ist zerlegt,
  `FUNC-health-endpoint` erfuellt `REQ-health-antwortet-stand`). `arch.optimization-dry-run.spike` neu
  gemessen: drei Zuege statt vier, Engpass danach R-04 @ MOD-projections.

**Warum R-02 = 29 bleibt:** Diese Funktionen hingen nur an einer Sammel-REQ, die eine andere Funktion oder eine
Menge beschreibt. Jede braucht eine eigene funktionale REQ mit TEST (`se:author-req`), oder sie wird mit Grund als
innerer Schritt akzeptiert. Die 85 R-21-Befunde folgen daraus und gehen mit R-02 zurueck.

**Folge-CR:** CR-GC-954. Die Zielbild-Schritte 2 bis 4 (Kind-REQ am Code pruefen, eigene REQ fuer die 29 Funktionen,
Nebenbefunde) gehen in einen neuen CR.

**Dateien:** `docs/graph/graphcode.graph.json`, `docs/views/*` (erzeugt), `src/projections/test-schlupf.ts`,
`tests/hooks.inject-graph-slice.test.ts`, `tests/arch.optimization-dry-run.spike.test.ts`, diese CR-Datei.

`npm run verify:full CR-GC-918` am 2026-11-17: 231 von 231 Dateien, 1914 von 1914 Tests gruen, Schlupf 0.


## Entscheidungen

_Nachtrag 2026-11-26 (CR-AB-036, aise-bok): Der Abschnitt fehlte beim Schließen. Übertragen aus dem Text oben; der Text oben bleibt unverändert._

| Frage | Festlegung | Begründung |
|---|---|---|
| Wie viele Erfüller hat eine Anforderung? | Genau einen. Kann keine Funktion sie allein erfüllen, wird sie zerlegt; geht das nicht, ist sie eine NFR oder eine Mischung. | Entscheidung des Autors 2026-11-12 (Abschnitt „Bezug"); Regel RD-06 misst das |
