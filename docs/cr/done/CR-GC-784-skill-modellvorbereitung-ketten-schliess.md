# CR-GC-784: Skill Modellvorbereitung: Ketten schliessen, Anforderungen zuordnen, Fluesse kennzeichnen

**Status:** ✅ Done (2026-10-12, veröffentlicht mit graphcode 0.31.0, contracts 12.6.0)
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

## Ergebnis

**Stand 2026-10-11.** Gebaut, nicht geschlossen.

| Teil | Ort |
|---|---|
| Skill, Version 1 | `.claude/commands/se-vorbereitung.md` |
| Test | `tests/skill-vorbereitung-felder.test.ts` (9 Fälle; rot zuerst, danach mit drei verfälschten Textstellen gegengeprüft) |
| Modell | `FUNC-se-vorbereitung` (Block `FUNC-block-optimierung`, Glied von `FCHAIN-skill-authoring`, Abnehmer von `FLOW-chain-metrics`, Ausgang `FLOW-mutate-cmd-se-vorbereitung` an `FUNC-mutate`), `REQ-vorbereitung-reads-metrics`, `TEST-vorbereitung-reads-metrics` |

Liste, Hilfe und OpenCode brauchen keine Datei: die Skill-Liste in `GRAPHCODE.md` entsteht aus dem Kopf der
ausgelieferten Skills, die Auslieferung geht über das Verzeichnis `.claude/commands` (in `files` des Pakets), und
die Fassung für OpenCode erzeugt `scaffold` beim Ausliefern aus derselben Datei. Im Repo liegt keine unter
`.opencode/skills`.

**Der Test bindet** den Text an `RiskCarriers`, `RequirementScope`, `ChainMetrics`, den Regelkatalog und
`FlowSync` aus contracts: jedes genannte Feld, jeder Grund in `reasons`, die Schwere der genannten Regeln, die
Werte von `sync`. Der Zug des Vorbilds (Tieferlegen) wird an einem Probemodell nachgezogen und ergibt einen Träger.

### Trockenprobe sigllm (nur gelesen, Stand `2bb9f1f`)

Schritt 1: vier von vier Ketten bewertbar, der Lauf geht weiter. Schritt 2 liest 16 Risiken und 18
Gegenmaßnahmen, 16 an einem Modul, 2 am System.

| Klasse | Soll (Probe) | Ist |
|---|---|---|
| Tieferlegen | 11 | 11 |
| Zerlegen | 1 | 1 |
| Funktion fehlt | 2 | 2 |
| Gilt quer | 4 | 4 |

Die Klassen stimmen. Die Prüfung an der Bindung, die der Skill vor dem Zug verlangt und die die Probe nicht
hatte, ändert an vier der elf den Vorschlag. Gelesen per Stichwortsuche im gebundenen Code, kein Review:

| Gegenmaßnahme | Funktion laut Text | Bindung |
|---|---|---|
| `REQ-queue-depth-bounded-and-rejecting` | Autorisieren und Profil binden | andere Funktion: die Grenze steht in `src/llm-runtime/inference.ts` (`FUNC-load-model-run-inference`) |
| `REQ-contract-and-tool-names-resolve` | Aufgabendefinition bereitstellen | andere Funktion: die Auflösung des Schemanamens steht in `src/scheduler/validation.ts` (`FUNC-validate-result-retry-dead-letter`) |
| `REQ-command-payload-typed-per-command` | Konfiguration verwalten | nicht bestätigt: der Code liegt in `command-payloads.ts` und `management-chain.ts`, die keine Funktion bindet |
| `REQ-denied-access-is-not-success` | Ergebnis prüfen | nicht bestätigt: im gebundenen Code nicht gefunden |

Die übrigen sieben bestätigt die Bindung. Die zwei der Klasse „Funktion fehlt" haben Code
(`bind-address.ts`, `model-artifact.ts`), aber keine Funktion im Modell; das trägt den Befund. Zwei der vier
quer geltenden hängen am Modul, nicht am System (`REQ-one-error-vocabulary`,
`REQ-secret-store-matches-run-context`); der Skill lässt sie stehen und legt die Einordnung dem Autor vor.
Schritt 3: 29 Flüsse, keiner trägt das Merkmal; der Skill fragt je Fluss der Kette.

### Trockenprobe siconizer (nur gelesen)

Schritt 1: `FCH-adopt`, `FCH-agent`, `FCH-build`, `FCH-check` sind nicht bewertbar, jede mit dem Grund
`loose-member`. Der Lauf endet dort, Ergebnis sind die Züge an den Gliedern ohne Eingang oder Ausgang. Soll
erfüllt.

### Abnahme

- `npm run build`, Typprüfung: ohne Befund.
- `verify:code`: Spur CODE, 51 von 183 Dateien, 446 Tests grün.
- `verify:full CR-GC-784`: 183 Dateien, 1515 Tests, 2 rot: `distribution` und `lockfile-sync`, beide wegen
  des Link-Modus auf contracts 12.3.0. Die Messung zählt sie als Schlupf (außerhalb der Auswahl); die Folge
  bleibt bei 0 von 10.
- `rules_evaluate` am eigenen Modell: kein Fehler davor und danach, keine neue Warnung. `RD-04` an
  `MOD-agent-surface` bestand und zählt jetzt 28 statt 27 Kinder.
- Der Skilltext rechnet keine Kennzahl (Test).

### Abweichungen und Urteile

1. **Block.** Der Knoten hängt unter `FUNC-block-optimierung`, nicht wie `FUNC-se-fmea` unter
   `FUNC-block-urteilsarbeit`: der Schritt heißt im Leitfaden „Basis optimieren" und ist ausdrücklich keine
   Analyse; der Block Urteilsarbeit zählt fünf Sitzungen auf.
2. **Unbestätigte Bindung.** Der CR nennt vier Klassen und die Prüfung an der Bindung, aber nicht, was gilt,
   wenn die Bindung die Zuordnung nicht trägt. Der Skill legt das am Vorschlag offen und lässt den Autor
   zwischen Modul und „Funktion fehlt" entscheiden; eine fünfte Klasse gibt es nicht.
3. **Quer am Modul.** Der Skill schlägt für eine quer geltende Gegenmaßnahme am Modul keinen Zug ans System vor.
4. **Antwortweg.** Der Satz „wartet ein Glied synchron auf eine Funktion außerhalb, ist die Kette nicht
   vollständig" steht in Schritt 3 und führt zurück zu Schritt 1, weil er erst mit dem Merkmal erkennbar wird.
5. **Marke.** Der Skill sagt nur, dass `FC-05` PDR hält. Im Katalog trägt auch `R-31` die Rolle `existence`;
   ob sie die Marke hält, ist nicht geprüft.
6. **Ausgang im Modell.** Der Skill wendet nur gewählte Züge an; im Modell steht dafür ein Fluss ans Gate wie
   bei den anderen Autoren-Skills, sonst wäre das Glied ohne Ausgang.

**Kongruenz:** kein Laufzeitcode. Die Bindung des Knotens ist die Skilldatei, die des Tests die Testdatei.
RC-* läuft nicht im Gate (`notInGate`), also nicht prüfbar.
