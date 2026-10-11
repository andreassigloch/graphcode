# CR-GC-784: Skill Modellvorbereitung: Ketten schliessen, Anforderungen zuordnen, Fluesse kennzeichnen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-824 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-824.json (Lane: code)

---

**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10, Schritt „Basis optimieren". Sicht Wirkkette und Anforderung. **Wartet auf CR-SM-407.**
**Entscheidungen des Autors (2026-10-11):** die Vorbereitung des Modells gehört nicht in die FMEA. Der Schritt liegt am
Abschluss von Stufe 7 der Regelmatrix, an der Marke PDR, vor den Kettenanalysen auf Stufe 8; er ist Hygiene und braucht
Funktionen, Flüsse und Module als Basis.

## Anlass

Die Güte des Modells entscheidet vor jeder Analyse: geschlossene Wirkketten und Anforderungen am richtigen
Träger auf der tiefsten möglichen Ebene. Von acht geprüften Modellen der Familie waren zwei ohne Fehler und voll
bewertbar; eines hing alle Gegenmaßnahmen an Modul oder System. Heute führt kein Skill dorthin. Die FMEA und die
Laufzeitanalyse setzen den Stand voraus und sollen ihn nicht selbst herstellen.

## Umfang

Neuer Skill `.claude/commands/se-vorbereitung.md` (und die Fassung für OpenCode). Einheit ist eine Wirkkette;
ohne benannte Kette geht der Skill die Ketten des Umfangs einzeln durch. Er liest aus `graph_metrics` und
`rules_evaluate` und rechnet nichts. Er führt durch den Schritt und schlägt je Lücke den Zug vor; die Züge selbst
sind ein gewöhnlicher CR im Zielrepo (Beispiel: sigllm CR-SL-096).

| Schritt | Liest | Ergebnis |
|---|---|---|
| 1 Kette schließen | `measurable` und Gründe, Befunde der Verdrahtung (R-30, R-31, R-21, IO-01, FC-04, FC-05) | je Lücke ein Zug: Fluss, Glied oder Kante |
| 2 Anforderungen zuordnen | Träger und Erfüller je Risiko (`riskCarriers`, CR-SM-407); Risiken ohne Träger meldet die Matrix schon | je Gegenmaßnahme eine von vier Klassen: tieferlegen, zerlegen, Funktion fehlt, gilt quer |
| 3 Flüsse kennzeichnen | Flüsse der Kette ohne Merkmal synchron oder asynchron; als Kennzahl erst mit CR-SM-408, bis dahin fragt der Skill je Fluss | je Fluss die Frage „wartet die Antwort darauf?"; wird derselbe Inhalt abgerufen und vorab geliefert, zwei Flüsse |
| 4 Bericht | – | Stand der Kette: bewertbar, Träger je Risiko, Sockel, Flüsse ohne Merkmal; was offen bleibt, mit Grund |

Regeln des Skills:

- Jeder Zug geht durchs Gate; der Skill schlägt vor, der Autor wählt.
- Tieferlegen heißt: die Gegenmaßnahme als funktionale Anforderung fassen und der einen Funktion zuordnen. Vor
  dem Zug prüft der Skill die Zuordnung an der Bindung der Funktion (`realRef`), nicht nur am Text.
- „Funktion fehlt" ist ein Befund am Funktionsbaum und wird ein Item, kein stiller Zug.
- Der Skill beurteilt kein Risiko und keine Laufzeit.

Dazu: ein Test, der den Skilltext an die Felder aus CR-SM-407 bindet (Muster `tests/skill-fmea-orte.test.ts`);
Modell (`FUNC-se-vorbereitung` mit Anforderung und Test, Abnehmer von `FLOW-chain-metrics`, Glied von
`FCHAIN-skill-authoring`); Hilfetext; Eintrag in der Skill-Liste.

## Abnahme

- Ein Lauf am sigllm-Modell liefert für die 18 Gegenmaßnahmen die vier Klassen (Probe: 11, 1, 2, 4) oder
  begründet jede Abweichung.
- Ein Lauf am siconizer-Modell meldet in Schritt 1 alle vier Ketten als nicht geschlossen und geht nicht weiter.
- Der Skilltext rechnet keine Kennzahl.

## Grenzen

Ob eine Gegenmaßnahme quer gilt, bleibt ein Urteil. Kongruenz: kein Laufzeitcode.
