# CR-GC-918: Eine Anforderung hat genau einen Erfueller

**Status:** 🟠 Open
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

- [ ] REQ mit mehr als einem Erfueller: 0 (gezaehlt am exportierten Modell).
- [ ] R-02: 0, oder jeder verbleibende Befund mit Grund akzeptiert und hier gelistet.
- [ ] Keine neue Fehlermeldung (`rules_get_violations {severity: error}`), R-01 = 0.
- [ ] Jede Kind-REQ hat einen TEST, der genau ihre Zusage prueft; Abweichungen hier gelistet.
- [ ] `npm run verify:model` gruen; `docs/graph` und `docs/views` im selben Commit.
- [ ] Nach dem contracts-Nachzug mit CR-SM-435: RD-06 = 0 (eigener Nachzug-CR, nicht hier).

## Nicht in diesem CR

- **RTM nach A-SPICE:** Ebene nur aus `compose` ableiten, Bezeichnungen nach PAM 4.0 (SYS.2,
  SWE.1/HWE.1, SYS.1 ausserhalb des Graphen), V-Uebersicht im Kopf der RTM. Mit einem Erfueller je REQ
  wird die Ebene eindeutig; eigener CR nach diesem, wegen der Dateigrenze.
- **Ebenensprung:** 37 REQ unter SYS oder UC, von einer tieferen FUNC erfuellt, ohne Zerlegung.
- **Regel RD-06:** CR-SM-435.

## Umfang

`docs/graph/graphcode.graph.json` und die erzeugten Sichten unter `docs/views/` (rtm, srs, testmatrix,
testconcept, architecture, icd, references). Kein Quellcode.
