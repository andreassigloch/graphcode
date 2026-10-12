# CR-GC-783: Skill Laufzeitanalyse einer Wirkkette

**Status:** ✅ Done (2026-10-12)
**Typ:** aus Item ITEM-2026-819 (idea)
**Erstellt:** 2026-10-11
**Item:** bok/items/ITEM-2026-819.json (Lane: code)

---

**Bezug:** `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10, Schritt Kettenanalyse (Stufe 8 der Regelmatrix). Sicht Wirkkette, Dimension Laufzeit, Ergebnisse a bis d.
**Wartet auf CR-SM-408 (Antwortweg; Freigabe des Autors erteilt am 2026-10-11) und CR-GC-784 (Merkmal an den
Flüssen).** Das Ergebnis eines Laufs ist ein gewöhnlicher CR.

## Anlass

Für die Laufzeit einer Wirkkette gibt es keinen Analyse-Skill. Die Probe am energymanager-Modell zeigt, was er
leisten kann: mit dem Merkmal synchron oder asynchron an den Flüssen wird sichtbar, auf welche Funktionen eine
Antwort wartet. Ohne es lag bei allen drei Entwürfen genau eine Funktion auf dem Anfragepfad.

## Umfang

Neuer Skill `.claude/commands/se-laufzeit.md` (und die Fassung für OpenCode). Einheit ist eine Wirkkette mit einer
Laufzeitanforderung.

1. **Vorbedingung.** Kette geschlossen, jeder Fluss der Kette trägt das Merkmal. Sonst endet der Skill mit dem
   Verweis auf `se-vorbereitung`; er setzt das Merkmal nicht selbst.
2. **Betrachtungsumfang** aus `graph_metrics`.
3. **Orte lesen:** Antwortweg (Glieder der Kette und die Ketten durch sie; er verlässt die Kette nicht), Zulieferer
   außerhalb des Antwortwegs, Zulauf, Verzweigung, Kreisläufe auf dem Antwortweg.
4. **Ergebnisse a bis d:** Befunde je Ort; fehlende Anforderungen (zu jeder Laufzeitanforderung die Anforderung
   an das Datenalter); Vorschläge der Klassen Vorverlagern (vorhalten statt beim Aufruf rechnen, mit eigenem
   Fluss) und Entkoppeln (geteilte Funktion vom Antwortweg nehmen); Konflikte an geteilten Funktionen.
5. **Vorschläge in derselben festen Form wie in der FMEA** (CR-GC-782, Punkt 6), mit dem Preis: Datenalter und
   die Schnittstelle der Funktion, die speist. Der Skill wendet keinen Umbau an.

Dazu ein Test nach dem Muster `tests/skill-fmea-orte.test.ts`, Modell (`FUNC-se-laufzeit` mit Anforderung und
Test, Abnehmer von `FLOW-chain-metrics`, Glied von `FCHAIN-skill-authoring`), Eintrag in der Skill-Liste.

## Umfang laut `graph_impact` (graphVersion 681)

`FUNC-chain-metrics` hat heute einen Abnehmer unter den Skills und liegt in zwei Ketten. Der neue Skill wird ein
weiterer Abnehmer von `FLOW-chain-metrics`; kein bestehender Knoten ändert sich.

## Nicht im Umfang

Menge je Abruf und Takt der Zulieferer. Der Skill sagt, auf wen die Antwort wartet, nicht wie lange.

## Abnahme

- Ein Lauf an `FCHAIN-energiefluss-ansehen` (energymanager, Merkmal gesetzt) liefert den Antwortweg der Probe
  (Dashboard und Ablage) und einen Vorschlag „Momentanstand vorhalten" mit eigenem Fluss und Datenalter als Preis.
- Ohne Merkmal endet derselbe Lauf mit dem Verweis auf die Vorbereitung.

## Grenzen

Ein Fall in der Probe.

## Nachzug für contracts 12.4.0 (CR-SM-408)

Der Antwortweg steht seit contracts 12.4.0 an jeder bewertbaren Kettenzeile: `answerPath` und
`answerPathBlockedBy`. Drei Stellen in graphcode folgen:

1. **`tests/metrics.test.ts`, Fall „graph_metrics auf dem eigenen Modell" (CR-GC-767), war rot.** Der Test
   gab die roh geparste SSOT-Datei an `chainMetrics`. Die Datei legt Attribute flach ans Element
   (`"sync": "sync"`), die Rechnung liest `attributes.sync`. Roh gelesen trägt kein Fluss das Merkmal; das
   Werkzeug geht über `toOntologyGraph` und liest richtig. Der Fehler lag im Test. Er rechnet jetzt auf
   `toOntologyGraph(getGraph())` und sichert zu, dass mindestens eine Kette ein Glied auf dem Antwortweg nennt.
   Der leere Weg `[]` belegt das nicht: roh gelesen haben ihn zwei Ketten ohne Antwort an einen Akteur.
2. **Hilfe zu `graph_metrics`** (`src/projections/tool-help.ts`): beide Felder beschrieben. Der Satz
   „`syncDepth` und `errorPathDepth` sind immer `null`: das Modell trägt dafür kein Attribut" ist
   richtiggestellt: beide werden nicht gerechnet.
3. **Peer-Floor bleibt `>=12.1 <13`.** Der Diff importiert keinen Export, den es erst ab 12.4 gibt; er liest
   zwei Felder. Folge, benannt: gegen contracts unter 12.4 fehlen die Felder in der Antwort, und der Skill hat
   keinen Eingang.

Dieselbe rohe Lesart außerhalb des Tests: `scripts/spike-kettenkennzahlen.mjs` (Zeile 89) gibt die SSOT-Datei
roh an `chainMetrics`; seine Kettenzahlen stimmen, sein Antwortweg nicht. Nicht geändert.

## Umsetzung

- `.claude/commands/se-laufzeit.md`, Version 1. Fünf Schritte: Eingang, Umfang und Laufzeitanforderung, Orte,
  Ergebnisse a bis d, CR. Der Skill prüft die Vorbedingung nicht selbst, er liest sie an der Rechnung ab:
  `answerPath: null` beendet den Lauf mit `answerPathBlockedBy` und dem Verweis auf `se-vorbereitung`.
- Eine eigene Fassung für OpenCode gibt es nicht und braucht es nicht: `installSkills` schreibt jeden Skill
  aus `.claude/commands/` beim Einrichten auch nach `.opencode/skills/` (CR-GC-721). Die Skill-Liste in
  `GRAPHCODE.md` entsteht aus dem Verzeichnis (`skillNameList`).
- `tests/skill-laufzeit-antwortweg.test.ts` bindet den Text an den Vertrag und an die Hilfe und rechnet am
  Probemodell nach, was der Text über den Weg behauptet.
- Modell (graphVersion 701): `FUNC-se-laufzeit` unter `FUNC-block-urteilsarbeit`, Glied von
  `FCHAIN-skill-authoring`, Abnehmer von `FLOW-chain-metrics` und `FLOW-skill-request`, Erzeuger von
  `FLOW-mutate-cmd-se-laufzeit` (Merkmal `sync`, wie die Nachbarn); `REQ-laufzeit-reads-answer-path` mit
  `TEST-laufzeit-reads-answer-path`; `SCHEMA-chain-metrics` nennt die beiden Felder. Der neue Fluss ist ein
  weiterer hindernder Fluss an `FCHAIN-steering-loop` (27 werden 28): er trägt `sync` und kommt von einer
  Funktion außerhalb dieser Kette.

## Ergebnis der Abnahme (2026-10-12)

Gefahren von Hand über die Werkzeuge, im Wegwerf-Store (`openMeasured`), am Stand
`energymanager-sync-2026-10-12.graph.json` aus contracts (die SSOT von energymanager trägt das Merkmal an
keinem Fluss).

- **Mit Merkmal.** `graph_metrics({ scope: ["FCHAIN-energiefluss-ansehen"] })`: `answerPath`
  `["FUNC-energiefluss-ansehen-annehmen", "FUNC-messwerte-speichern"]` (Dashboard und Ablage),
  `answerPathBlockedBy` `[]`. Beide stehen in `shared`; durch die Ablage laufen 11 Ketten, durch das
  Dashboard 5. Zulieferer außerhalb des Wegs: `FLOW-messpunkte` und `FLOW-auswertungsparameter`, beide `async`.
  `requirements` ist leer (der Stand trägt keine Anforderungen): die Laufzeitanforderung und die Anforderung
  an das Datenalter fehlen, das ist Befund b.
- **Vorschlag „Momentanstand vorhalten"** (Vorverlagern an der Ablage): eigener Fluss `FLOW-momentanstand`
  mit `async` von der Ablage an das Dashboard statt des Abrufs von `FLOW-messreihen`. Preis: Datenalter des
  Momentanstands, ein neuer Vertrag an der Ablage. Im Trockenlauf geprobt: `answerPath` danach
  `["FUNC-energiefluss-ansehen-annehmen"]`. Dieselbe Änderung trifft vier weitere Ketten durch das Dashboard
  (Ergebnis d). Ohne Vertrag am neuen Fluss blockt das Gate (`R-18`); der Skill nennt ihn deshalb im Preis.
- **Ohne Merkmal.** `answerPath` `null`, `answerPathBlockedBy` `["FLOW-energiefluss-ansicht"]`: der Lauf endet
  mit dem Verweis auf `se-vorbereitung`. Die Liste nennt das Hindernis, auf das der Weg trifft, nicht alle 26
  Flüsse ohne Merkmal; Skill und Hilfe sagen das.
- **Eigenes Modell.** `FCHAIN-impact-testing`: `answerPath` `["FUNC-deduce-tests", "FUNC-plan-code-lane",
  "FUNC-resolve-tests-from-code"]`, drei von vier Gliedern. `FCHAIN-steering-loop`: `answerPath` `null`,
  27 hindernde Flüsse vor dem Modellzug dieses CR, 28 danach.

## Befund im Volllauf: Zeichengrenze des Vorspanns

Der erste Volllauf war an `tests/vorspann.test.ts` rot: `GRAPHCODE.md` hatte 6.012 Zeichen, die Grenze ist
6.000 (CR-GC-612). Ursache: die Skill-Liste im Vorspann entsteht aus dem Verzeichnis und wächst mit jedem
Skill; vor diesem CR lagen 4 Zeichen unter der Grenze. Behoben durch das Streichen eines Halbsatzes im
Vorspann (`src/surface/scaffold-docs.ts`, „Each states its own purpose"), 5.983 Zeichen danach. Die Grenze
steht unverändert. Der nächste Skill reißt sie wieder; siehe Offen.

## Volllauf

`npm run verify:full CR-GC-783`, zweiter Lauf nach der Kürzung: 184 von 186 Dateien grün. Rot und im
Link-Modus erwartet: `tests/distribution.test.ts`, `tests/lockfile-sync.test.ts`. `tests/metrics.test.ts` ist
grün. `docs/messung/testauswahl.jsonl` trägt beide Läufe; der erste nennt `tests/vorspann.test.ts` als Schlupf.

## Offen

- Die Zeichengrenze des Vorspanns ist fest, die Skill-Liste darin wächst. Heute 17 Zeichen Luft. Zu
  entscheiden: Liste aus dem Vorspann nehmen oder die Grenze ohne die Liste messen.
- `se:optimize` Version 4 und `se-vorbereitung` Version 1 nennen den Antwortweg noch als künftige Kennzahl
  (`.claude/commands/se/optimize.md` Zeile 79, `se-vorbereitung.md` Schritt 3; dazu die Zusicherungen in
  `tests/skill-optimize-vorlage.test.ts` Zeile 223 und `tests/skill-vorbereitung-felder.test.ts` Zeile 76).
  `se:optimize` nennt als Quelle eines Vorschlags nur `se-fmea`. Eigener CR.
- Ob der auslösende Befehl eines Glieds als Warten zählt, entscheidet der Autor; der Skill sagt dazu nichts.
