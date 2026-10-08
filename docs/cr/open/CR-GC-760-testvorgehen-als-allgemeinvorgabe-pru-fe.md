# CR-GC-760: Testvorgehen als Allgemeinvorgabe prüfen: Abnahme je Use Case, Smoke-Test, Risiko-Tests, Prüfaufbau

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-778 (idea)
**Erstellt:** 2026-10-08
**Item:** bok/items/ITEM-2026-778.json (Lane: graph)

---

## Befund

Im Modell des Energiemanagers (Repo `energymanager`, Commits `4f38a5e` bis `0af4825`, 2026-10-08)
hat der Auftraggeber vier Festlegungen zum Testen getroffen, die graphcode heute weder vorgibt noch
prüft. Schwester-CR zu den Werteklassen: CR-GC-759.

1. **Die Testübersicht leitet die Stufe aus der Position ab, nicht aus dem Test.** `testconcept.md`
   meldete dort „26 E2E-Tests ✓" und „11 von 11 Use Cases durch einen Szenariotest geprüft", weil
   26 Anforderungen direkt unter dem System hängen. Keiner dieser Tests spielte eine Funktion aus
   Kundensicht durch; darunter waren ein Unit-Test der Zeitrechnung und Build-Prüfungen des Stacks.
2. **Abnahme als Systemanforderung (Definition of Done).** Festlegung: Das System fährt hoch, und
   jeder Use Case lässt sich vom Akteur oder einem Akteur-Simulator durchspielen – zuerst mit
   Testdaten über nachgestellte Quellen, danach mit echten Quellen. Der Smoke-Test ist der Lauf
   aller Durchspiele auf einem gestarteten System. Dazu eine eigene Anforderung für grafische
   Oberflächen: Sichtbarkeit, Kontrast, Überlappung, mit festen Fenstergrößen.
3. **Ein Test kann nicht an einem Use Case hängen.** `TEST` kennt nur `verify` auf `REQ` und
   `SCHEMA`. Das Durchspiel je Use Case wurde deshalb als Test geführt, der auf die Abnahme-
   Anforderung und auf die vorgeführten Anforderungen seines Use Case verweist. Ob ein Use Case
   abgenommen ist, ist nur über diese Verweise ablesbar.
4. **Risiken: so viele Tests wie nötig, der Rest ist Verlinkung.** Acht Risiko-Anforderungen teilten
   sich wortgleich den Test ihrer Maßnahme, weil das Gate je Risiko einen `verify`-Verweis verlangt
   (R-01, FM-03) und der Test der Maßnahme der nächstliegende war. Nach Durchsicht je Risiko
   entstanden sechs neue Tests für echte Lücken und 15 Verweise auf bestehende Tests.
5. **Der Prüfaufbau ist kein Produkt.** Nachgestellte Quellen, Testdaten-Generator und Demo lagen
   im Produktcode und zählten per Pfad zu Produktmodulen. Sie sind jetzt ein eigenes Modul mit
   eigenem Verzeichnis nach Rust-Layout (`src/`, `tests/`, `examples/`, Prüfaufbau als eigenes Paket,
   `spikes/`); der Compiler lehnt Importe aus dem Prüfaufbau ins Produkt ab. Im Modell hängt das
   Modul unter `SYS`, obwohl es nicht zum ausgelieferten System gehört – die Ontologie kennt kein
   unterstützendes System.

## Ziel

Prüfen, welche dieser Festlegungen Allgemeinvorgabe von graphcode werden, und entscheiden. Dieser
CR baut nichts; er endet mit einem begründeten Entscheid je Punkt.

Zu beantworten:

1. **Stufe eines Tests:** Soll sie am Test stehen (`testRefs.level`, Wertebereich festlegen) statt
   aus der Position der Anforderung abgeleitet zu werden? Was meldet `testconcept.md` dann für die
   Bestandsmodelle?
2. **Abnahme-Anforderung:** Soll jedes Modell genau eine Abnahme-Anforderung am System tragen
   (mit Testdaten und mit echter Umgebung), und soll eine Regel ihr Fehlen melden?
3. **Use Case und Test:** Reicht die Verlinkung über Anforderungen, oder braucht es `verify` von
   `TEST` auf `UC` beziehungsweise auf `FCHAIN`? Das wäre eine Änderung der Ontologie und damit
   Sache der Contracts.
4. **Risiko-Tests:** Soll das Gate melden, wenn ein Risiko nur den Test seiner Maßnahme hat? Wie
   viele Fehlalarme entstehen an den Bestandsmodellen?
5. **Prüfaufbau:** Braucht `MOD` ein Kennzeichen „nicht Teil des Produkts" (vergleichbar mit
   `external`), damit Warnungen wie „Modul ohne Funktion" und die Code-Zuordnung richtig greifen?
   Soll `graphcode init` das Rust-Layout vorschlagen?
6. **Oberflächenprüfung:** Gehört die Anforderung an Sichtbarkeit, Kontrast und Überlappung in den
   Skill `se-test-ui` als Vorgabe für jedes Modell mit grafischer Oberfläche?

## Akzeptanz

- Je Punkt ein Entscheid in diesem CR: übernehmen, nur als Skill-Konvention übernehmen oder
  verwerfen, mit der verworfenen Alternative und dem Grund.
- Für die Punkte 1 und 4 stehen Zahlen aus mindestens zwei Bestandsmodellen im CR.
- Bei Übernahme: je ein Item für Contracts, Regel, Ansicht und Skill; keine Umsetzung in diesem CR.

---

## Umfang laut `graph_impact`

Noch nicht bestimmt: Der CR wurde aus einer Sitzung im Repo `energymanager` angelegt, deren
Graph-Zugang nicht auf das Modell von graphcode zeigt. Erster Schritt der Lane ist `graph_impact`
auf die Knoten für die Ansicht Testkonzept, die Regeln R-01 und FM-03, die `TEST`-Kanten der
Ontologie, das `MOD`-Attribut `external` und den Skill `se-test-ui`. Dieser CR ändert selbst keinen
dieser Knoten.
