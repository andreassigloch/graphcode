# Modell-Drift und Modellierungsmethode — Stand 2026-10-23

Arbeitsstand zum Weiterdiskutieren. Quellen: CR-GC-832..838 (Nachprüfung), CR-GC-841..847, BOK-CR-071/072, CR-SM-415.

## 1. Befund

graphcodes eigenes Modell wurde am Code nachgeprüft (CR-GC-832..838). Etwa 4 von 10 Flüssen in 25 Wirkketten nannten einen Weg, den kein Code geht. Jede Regel und das Gate ließen sie durch.

Zwei Ursachen:

- **Entstehung aus der Absicht.** Das Modell beschrieb, woher die Daten kommen („aus dem Speicher"), nicht, wer wen aufruft.
- **Drift über CRs.** Jeder CR zog seine eigenen Knoten nach (`realRef`), aber nicht die Flüsse der Nachbarn.

Das Gate prüft die Grammatik, die RC-Regeln prüfen, ob eine `realRef` existiert. Ob ein Fluss zwischen den richtigen zwei Funktionen liegt, prüfte nichts. Die Nachprüfung von Hand kostete etwa 600k Token für 25 Ketten.

## 2. Fehlerklassen

| Fehler | Beispiel aus graphcode |
|---|---|
| Fluss überspringt das Werkzeug | Agent → Kernfunktion statt Agent → `graph_impact` → Kernfunktion |
| Antwort an den letzten Leser statt an den Aufrufer | Gate-Bericht direkt an den Agenten |
| „liest den Speicher", bekommt den Graphen aber als Argument | Speicher → fit-advisory; 6 Speicherflüsse in CR-GC-843 umgehängt |
| eine Kette mit mehreren Auslösern | repo-lifecycle: 5 Abläufe, 4 Auslöser |
| `sync` geraten oder fehlend | 43 Flüsse ohne Wert, 6 als `async`, auf die gewartet wird |
| `realRef` auf einem Wrapper | `harness.importGraph` statt `importOntologyGraph`; FUNC-check-code-conformance zeigte auf `conformanceViolations` |
| Einstieg ohne FUNC | graph_generate, graph_merge, die npm-Spuren |
| Eigenschaft als Kette modelliert | modelfree-gate, interface-escalation |
| Anforderung verspricht mehr als ihr Test prüft | 10 REQ-Paare (CR-GC-838) |
| ein Fluss mit mehreren Übergabestellen | FLOW-mutate-answer: drei Aufrufer, dreigeteilt |

## 3. Methode: den Aufrufweg modellieren, nicht die Datenherkunft

In `se:top-level` Version 3 ausgeliefert (CR-GC-841):

1. Jeder Einstieg ist eine FUNC: MCP-Werkzeug, CLI-Verb, npm-Skript, Skill. Ein Akteur erreicht nur diese.
2. Ein FLOW ist ein Schritt zwischen Aufrufer und Gerufenem. Er hat einen Erzeuger (IO-02). Die Antwort geht an den Aufrufer zurück.
3. Ein Speicherfluss endet nur an einer Funktion, die den Speicher selbst liest.
4. Eine Kette hat einen Auslöser. Start, Ende, Host und Gesundheitsprüfung sind getrennte Ketten.
5. Eine Eigenschaft ist eine nicht-funktionale REQ, keine Kette.
6. `realRef` nennt das Symbol auf dem Weg, nicht einen Wrapper darum.
7. `sync` beantwortet eine Frage: wartet der Aufrufer auf die Antwort? Rückruf, Ereignis und später gelesene Datei sind `async`.
8. Ein FLOW hat eine Aufrufstelle. Wer sie nicht nennen kann, rät.

**Über bestehendem Code von unten anfangen:** zuerst `se:import-code` (ein FLOW je aufgelöstem Aufruf), daraus Ketten bilden, dann die Absicht darüberlegen.

**Anforderungen:** der Text verspricht nur, was der TEST prüft (`se:author-req` Version 3).

## 4. Mechanische Prüfung: Fluss gegen Aufruf (CR-GC-843)

**Werkzeug:** TypeScripts LanguageService, dieselbe Maschine wie der Sprachserver, ohne laufenden Server. graphify sah nur 52 von 298 Paaren, weil sein Extraktor keine Funktionsrümpfe liest.

**Prüfung je synchronem Fluss:** gibt es einen Aufrufweg zwischen Erzeuger und Abnehmer, höchstens 3 Schritte, in einer der beiden Richtungen? Die Gegenrichtung zählt, weil die Antwort vom Gerufenen zum Aufrufer fließt.

**Bindung am Fluss:** wo keine Typanalyse den Weg sieht (Socket, Fabrik als Parameter, Registry), trägt der FLOW selbst eine `realRef` auf die Übergabestelle. Sie zählt als belegt, solange das Symbol existiert.

**Grenze mit Absicht:** hat eine Signatur mehr als eine Implementierung, folgt die Prüfung ihr nicht. Sonst erreichte `tool.handler()` jedes Werkzeug, und jeder Fluss am Registry-Aufruf galt als belegt.

Stand am Selbstmodell, 285 synchrone Paare:

| Ergebnis | Paare |
|---|---|
| direkter Aufruf | 79 |
| Aufruf über Zwischenschritte | 52 |
| belegt durch Bindung am Fluss | 27 |
| kein Aufruf / Beleg kaputt | 0 / 0 |
| ungeprüft: eine Seite ohne Bindung (Akteur, extern, physisch) | 75 |
| ungeprüft: keine TS-Datei (Skills, Skripte) | 42 |
| ungeprüft: Nachbarpaket | 10 |
| asynchron, nicht geprüft | 14 |

Kosten: etwa 1 s je Durchlauf im Prozess.

## 5. Schutz gegen neue Drift, vier Stellen

| Stelle | Wirkung | Stand |
|---|---|---|
| Skill-Regeln (Abschnitt 3) | verhindern die Fehlerklassen beim Schreiben | ausgeliefert, CR-GC-841 |
| `se-umbau` Version 2 | ein Knoten mit geänderten Aufrufen zieht seine Flüsse im selben CR mit | ausgeliefert, CR-GC-841 |
| Regel RC-12, Warnung | prüft jeden synchronen Fluss in jeder vollen Auswertung | offen: CR-SM-415 (contracts, Smeagol), danach CR-GC-846 (graphcode liefert die Aufrufkanten, Skript wird gelöscht) |
| `aise cr close` | meldet eine FUNC, deren Datei der CR änderte, ohne dass eine `io`-Kante mitkam | offen: BOK-CR-072 |

`se-vorbereitung` Schritt 4 („Flüsse am Code prüfen") nutzt bis RC-12 das Skript, danach `rules_evaluate`.

### Entschieden für RC-12

- Schwere `warning`.
- Urteilt nur über Paare mit Code-Bindung auf beiden Seiten innerhalb der Dateien, die der Lieferant abdeckt (`callScope`). Physische Flüsse, Akteure und fremde Sprachen bleiben still, werden aber gezählt (`callCoverage`).
- Aufrufkanten in `CodeFacts` sind sprachneutral. Ein Rust-Lieferant (rust-analyzer, dieselbe Aufrufhierarchie über LSP) liefert dieselbe Form, die Regel bleibt unverändert.
- Antwortlänge: `rules_evaluate`, `rules_get_violations`, `graph_readiness` wachsen um höchstens eine Zeile.

### Häufigkeit der Kosten

Volle Auswertungen lösen nur lesende Werkzeuge aus, nie ein Schreibzug. 23.09.–23.10.: 255 Auswertungen in 33 Sitzungen (`rules_evaluate` 123, `graph_readiness` 67, `rules_get_violations` 54, `graph_help` 11), etwa 8 je Sitzung. Schreibzüge im selben Zeitraum: 838.

## 6. Nebenbefunde

- **`graph_help` ohne token** startete eine volle Auswertung und lieferte die Fehlerliste doppelt, rund 13.000 statt 7.000 Zeichen und über das ganze Modell statt die Arbeitsmenge. CR-GC-847: `graph_help` erklärt nur noch.
- **CR-Status:** aise speichert keinen `status` am CR-Knoten (der Ordner ist die Wahrheit), contracts lesen ihn trotzdem (RC-07, CR-R01/R02, `hasOpenOrder`). Folge am Selbstmodell: 93 RC-07-Warnungen. BOK-CR-071.
- **Whitebox-Messung** las ein Attribut, das seit BOK-CR-060 niemand schreibt, und fand 0 Jobs. Behoben in CR-GC-844 (CR aus der Commit-Nachricht).
- **`conformanceViolations`** war ein zweiter Pfad nur für Tests. Gelöscht in CR-GC-845.

## 7. Offene Fragen für die Diskussion

1. **Asynchrone Flüsse** (14) prüft nichts. Wäre „Erzeuger schreibt X, Abnehmer liest X" (Datei, Ereignisname, Socket-Pfad) als zweite Faktenart prüfbar?
2. **Physische Flüsse:** `sync` meint dort keinen Aufruf. Braucht es dort eine andere Prüfung (Schnittstellenvertrag, SCHEMA) oder bleibt es beim Zählen?
3. **Skills und Skripte** (42 Paare): ein Skill „ruft" ein MCP-Werkzeug im Text. Ist das als Aufruf extrahierbar, oder ist der Skill-Text kein Code im Sinn der Regel?
4. **Bottom-up gegen top-down:** der Import liefert Aufrufe, die Absicht liefert Ketten. Wo genau trifft man sich, und wer entscheidet bei Widerspruch?
5. **Suchtiefe 3:** fest im Regeltext oder einstellbar? (offen in CR-SM-415)
6. **Registry-Versand:** ein Fluss über eine Registry wird nie automatisch belegt, nur über die Bindung am Fluss. Reicht das, oder braucht die Registry ein eigenes Modellmuster?
7. **Drift beim CR-Abschluss** (BOK-CR-072): Hinweis oder Abbruch, und gilt er für jedes Repo im CR-Modus graph?
