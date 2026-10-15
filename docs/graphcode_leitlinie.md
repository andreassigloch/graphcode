# graphcode-Leitlinie

> **SSOT ist dieses Dokument.** Der Systemknoten `SYS-graphcode` trägt nur den Verweis hierher — Format-E kennt keine mehrzeiligen Beschreibungen (ITEM-2026-183).
> Änderung nur durch den Autor, nicht durch Agenten — im Knoten und hier im selben Zug.

**Zweck:** Der Anker für jede Konzept-, Architektur- und Regel-Diskussion. Verläuft sich eine
Diskussion, wird sie gegen den Kern-Claim (§1) und die Definition of Done des betroffenen
Abschnitts geprüft. Stand 2026-10-08. Der Verlauf steht in `git log`, Herleitungen und ältere Messreihen in
[`archive/leitlinie-staende-2026-10-08.md`](archive/leitlinie-staende-2026-10-08.md).

**Übergeordnetes Ziel:** Gute Architektur erzeugt guten Code durch MBSE.

**Lesart:** Jeder Abschnitt nennt, auf welchen Teil des Kern-Claims er einzahlt, und endet mit
einer **Definition of Done (DoD)**. Die DoD verweist auf Tests `T-…`; deren Aufbau, Kriterium und
heutiger Stand stehen gesammelt in §9.

---

## 1. Kern-Claim

Komplexe Systeme **verstehen (V)**, **managen (M)** und **optimieren (O)** durch **Abstraktion** —
nicht die (Software-)Implementierung 1:1 abbilden, sondern Blackboxen mit definierten Schnittstellen
von der System Wurzel bis zur implementierten Funktion sicherstellen.



**DoD:** Die DoD von §2–§8 ist erfüllt, geprüft an graphcode selbst, an einem Fremdsystem
(moneyflow oder sirail) und an einem Greenfield-Lauf. Jeder Claim ist nicht nur **nachgewiesen**, sondern
**vorführbar**: ein Außenstehender sieht ihn an einer Demo, ohne das Repo zu kennen (§9.1, Demo).

---

## 2. Verstehen — das Modell beantwortet vier Fragen · *zahlt ein auf V*

Das Gütemaß ist **Verständlichkeit**: wenige Blöcke pro Ebene („was muss ich dem CEO zeigen, damit
er das Konzept versteht") — nicht Knotenzahlen. Die Schwellen stehen in den Regeln, nicht hier.

| Frage | Modellteil | Stufen der Readiness → Marke · Regeln |
|---|---|---|
| **Warum** | UC-Baum, REQ | Anwendungsfall, Anforderung · R-02 (FUNC ohne REQ) |
| **Wie** | FUNC-in-FUNC + Wirkketten (FCHAIN) als Netz | Wirkkette → **SRR**; Funktion, Datenfluss · R-30 (FUNC ohne Kette) · FC-04 (Kette ohne Akteur an Anfang und Ende) |
| **Womit** | MOD-in-MOD, der Stack | Modul → **PDR** · CR-01 (Verträge über Modulgrenzen), MT-02 (LCOM4) |
| **Worüber** | SCHEMA/FLOW — der Vertrag, der die Grenze definiert | Schema → **CDR** · IO-01 (Kettenanschluss) · BW-02, R-04 (Randbreite) |

Dahinter liegen der Nachweis (Stufe Test → **TRR**) und die Kopplung an den Code (Stufen Plan, Bindung, Abgleich →
**Bau**). Die Readiness meldet je Stufe die Befunde und je Marke, ob sie erreicht ist (`graph_readiness`: `stages`,
`marks`); welche Regel an welcher Stufe fällig wird, steht in der Regel-Matrix (`docs/views/regel-matrix.md`).

Jede Ebene ist eine Blackbox mit 3–9 Kindern (7 ± 2, RD-04/RD-05) und einem schmalen
Vertragsrand (BW-02 für FUNC, R-04 für MOD). Das Modell ist **vollständig** (jede Frage hat eine
Antwort) und **mit dem Code gekoppelt**: jedes Modellelement hat seine Realisierung, aber das
Modell ist kein Abbild aller codierten Funktionen — was darunter liegt, bleibt in der Blackbox.

**Geltungsbereich.** **Modelliert** wird jedes System — Software, mechanisch, elektrisch —,
Nachweisbarkeit vor Detailtiefe. **Implementiert** wird nur Code.

**Nachweis.** Die aus dem Modell erzeugte Dokumentation (SRS, ConOps, Architektur, ICD, RTM, VCRM,
Test- und Integrationsplan, Change Log …) ist kompatibel zum **Dokumentanteil** der gängigen
Systems-Engineering-Normen: ISO/IEC/IEEE 29148, ISO/IEC/IEEE 15288 und Automotive SPICE. Welche
Anforderungen dokument-belegbar sind und welche davon graphcode heute erfüllt, steht in
[`SPIKE-GC-norm-dokumentanteil-RESULTS`](spikes/SPIKE-GC-norm-dokumentanteil-RESULTS.md).

Added Value ( Claim): Traceability und die Konsistenz Modell ↔ Code sind **deterministisch** aus demselben Modell belegt, aus dem die Dokumente gerendert werden. Ein frei laufendes Frontier-Modell kann Dokumente schreiben, diese Nachweise
aber nach Einschätzung des Autors nicht sicher erbringen (T-N3).

**DoD Verstehen**
- Jede Ebene liegt im Breitenband 3–9, jeder Vertragsrand unter seiner Schwelle (T-V1, T-V2).
- Alle vier Fragen sind beantwortet und verifizierbar: die Marken SRR, PDR, CDR und TRR sind erreicht (T-V3).
- Ein Greenfield-Lauf trägt alle Ebenen der Referenz, auch Architektur (MOD) und Qualität
  (TEST an SCHEMA), nicht nur das Szenario-Skelett (T-V5).
- Das Modell ist zu 100 % mit dem Code gekoppelt — jedes Modul, jede Funktion und jeder Vertrag des
  Modells ist gebunden und kongruent: die Marke Bau ist erreicht —, ohne jede codierte Funktion abzubilden: die
  Grenzmenge ist zu 100 % modelliert, alles darunter bleibt Blackbox (T-V4).
- Jede dokument-belegbare Anforderung aus 29148, 15288 und A-SPICE ist von einer erzeugten Sicht
  und einer prüfenden Regel gedeckt, oder als Lücke benannt (T-N1, T-N2).

*Hygiene (Voraussetzung, kein eigener Nachweis):* 0 Error-Verletzungen, 0 Warnings und nur dort, wo die
Regeln auch ausgewertet wurden (T-H1); Regel-Matrix und Regelkatalog stimmen überein (T-H2).

---

## 3. Managen — deterministische Steuerung in drei Stufen · *zahlt ein auf M*

Deterministisch berechnete Kenngrößen — nicht Statistik — steuern Prozess, Architektur,
Regelkonformität und Optimierung. Das Gate ist nur der harte Sonderfall des Zielsteuerers.

- **Unterbinden:** Eine Regel blockt — die Schreiboperation gelangt nicht in die Datenbank und
  muss mit Korrektur wiederholt werden. Das gilt auch für Vollständigkeitsregeln (REQ ohne TEST,
  UC ohne REQ, CR ohne Commit).
- **Steuern:** Deterministische Kenngrößen (Readiness, Steuerwert) und Warnungen ziehen wie ein
  Gummiband zurück zur implementierungsreifen Spezifikation — an der Antwort an den Agenten
  (`steerAdvisory`); den Nutzer erreichen die Steuerregeln als `vorschlag`.
- **Empfehlen:** Vorschläge für den nächsten Schritt (`graph_suggest`; der `vorschlag` jeder
  angewandten Mutationsantwort — ein Satz an den **Nutzer**, je Regel formuliert, gewählt wie der
  Schritt von `graph_generate`), auch statistisch. Der Arbeitsauftrag an den Agenten
  kommt nur von `graph_generate`. Nur diese Stufe darf lernen.

Was nie blockt, ist die **Reihenfolge**: Ebenen und Reihenfolgen darf der Nutzer überspringen,
Architektur und Optimierer stehen ab dem ersten Zug offen.

**DoD Managen**
- Eine blockende Regel hält jeden Verstoß aus der Datenbank, auch einen Vollständigkeitsverstoß,
  und der Graph trägt keine Error-Verletzung, die das Gate nicht gemeldet hat (T-M1).
- Empfehlungen werden abgerufen und sind anwendbar (T-M5).
- Übersprungene Ebenen erzeugen Warnungen, keine Blockade (T-M6).
- Die Steuerung greift bei Greenfield **und** bei CR-Arbeit am Bestand (T-M2, T-E1, T-C3).

---

## 4. Managen — den LLM-Agenten führen (Effizienz) · *zahlt ein auf M*

**Ziel.** Zwei Claims:

- **Lokal ≈ Frontier:** Ein lokales Modell erzeugt unter graphcode-Führung Modelle und Code auf
  Augenhöhe mit einem Frontier-Modell.
- **Geführt ist effizienter als frei:** graphcode-geführtes Entwickeln ist effizienter als frei
  laufendes Claude Code mit Opus — **normalisiert** auf den Lieferumfang: Das Modell und die
  daraus erzeugten Dokumente (RTM, ICD, Testkonzept …) sind Lieferung, nicht Overhead.

**Prinzip.** Struktur und Determinismus des Graphen versorgen das LLM gezielt mit dem Nötigen: der
Agent arbeitet auf der need-to-know-Whitebox, statt auf dem ganzen Repo zu raten.
Kontextmanagement *ist* Abstraktion. Der Hauptfall ist **interaktiv**: der Nutzer
führt Zug für Zug, der Agent — lokal (qwen3.8 in OpenCode) oder Frontier (Opus in Claude Code) —
fragt, baut einen kleinen Schritt, berichtet, endet. Der Automodus (`graph_generate`-Schleife,
Executor) ist Testmodus, nicht Zielbild. Das Vorgehen ist für jeden Ausführenden dasselbe — Mensch,
Frontier- oder lokales Modell, Executor: vom Groben ins Feine, geführt vom schon
erzeugten Graphen. Verschieden sind nur zwei Stellgrößen:

- die **Schnittgröße** — wie viel Arbeit ein Paket umfasst. Die untere Grenze gibt die Ontologie
  (ein Anker, eine Ebene darunter), die obere das Budget des Ausführenden. Interaktiv ist der
  Schnitt der `vorschlag`: ein Schritt je Regel je Zug.
- das **Kontextrezept** — was mitkommt: der Anker offen, die Geschwister als Box, der Rest als
  Index, der passende Ausschnitt des Auftrags. Es zählt *welcher* Inhalt, nicht wie viel.
  Maßgeblich ist die **Prompt-Bilanz**: die Gesamtgröße des ersten Prompts beim Modell, je
  Bestandteil zugeordnet, mit so wenig Standardanteil wie nötig — nicht eine Zeichengrenze je
  Datei (T-E6).

Konzept: [`graphcode_arbeitspakete_konzept.md`](graphcode_arbeitspakete_konzept.md). Wie die
Stellgrößen gemessen werden, steht bei den Tests (§9.3 Effizienz).

**DoD Effizienz**
- Die Qualitätsunterschiede zwischen den Modellen werden durch den Graphen nivelliert, in dieser Rangfolge
  (Autor 2026-10-08): **1.** der lokale Arm kommt am Ziel an, **2.** sein Ergebnis ist verwertbar - höhere Anzahl von Rückfragen erlaubt **3.** die
  Geschwindigkeit — lokal beim Faktor 2 zu Frontier als Ziel. Im Modell (T-E3) und im Code (T-E4).
- Statistik
- Jede Suche, die der Graph beantwortet hätte, ist als Optimierungspotenzial erkannt (T-E1), und der Agent bekommt eine
  Whitebox, die die tatsächlich betroffenen Knoten vollständig enthält (T-E2). 
  Der Kontext ist auf seinen Kipppunkt eingestellt: kleiner wird er nur, solange die Ausbeute hält (T-E6).
- Die lokal erzeugte Spec trifft den Auftrag so gut wie die Frontier-Spec und erfindet keinen
  offenen Wert — im Blindurteil gegen die Auftragspunkte, nicht an der Readiness (T-E10).
- Das Modell referenziert den Bestand, statt ihn neu zu schreiben, legt keine Dubletten an und
  übernimmt aus Vorbildern die Form, nicht den Inhalt (T-E11).
- Für jedes eingesetzte Modell ist gemessen, welche Schnittgröße es trägt (T-E12).
- Der Graph sagt, welche Tests laufen müssen, und antwortet schnell genug für die Schleife (T-E7, T-E8).
- Jeder Lauf weist je Informationsaufruf aus, was das Modell wollte, ob es das schon hatte und ob der
  Graph es geliefert hätte (T-E9).

---

## 5. Optimieren — Modell-, Realisierungs- und Inhaltsarchitektur · *zahlt ein auf O*

Kennzahlen zeigen, wo ein Optimierungsvorschlag eingreift und was dazu zu lesen ist; Invarianten schützen
das Modell; die Wahl trifft der Autor. Eine Rangfolge aus Kennzahlen ordnet Vorschläge nicht (gemessen an
drei Fällen mit neun Entwürfen, 2026-10-10 und -11). Grundlage ist die **Güte des Modells**: geschlossene
Wirkketten und Anforderungen am richtigen Träger auf der tiefsten möglichen Ebene. Leitfaden, Maße und
Belege: `docs/graphcode_analyse_optimierungskonzept.md`, Abschnitt 10.
„Architektur" meint zwei Dinge, die getrennt bewertet werden
(Konzept: `docs/graphcode_architektur_konzept.md`):

- **Modellarchitektur** — Verständlichkeit, domänenneutral: Modul- und Funktionsaggregation über
  die Blackboxen und ihre Beziehungen je Ebene (7 ± 2, Kohäsion LCOM4, Kopplung/Crossings,
  Vertragsrand). Sie ist **Nebenbedingung**, nicht Zielgröße.
- **Realisierungsarchitektur** — Umsetzung der Wirkkette im Kontext: bewertet **nur auf der
  FCHAIN**, weil nur die Kette Laufzeitverhalten erzeugt. Acht Kennzahlen (Gesamtlänge,
  synchrone Tiefe, Verzweigungsgrad, Modulgrenzen, Rückkopplungen; geteilte Knoten,
  Engstellen-Grad, Fehlerpfad-Tiefe) plus dominierende Skalierungsklasse. Das **Nutzungsprofil**
  (Banking, Social Media, Embedded …) legt nicht den Funktionsumfang fest, sondern steht als
  Schwellenwertsatz in NFR-REQs an den FCHAINs. Verletzung → Diagnose (Kennzahl + treibender
  Knoten) → Handlungsklasse (Entkoppeln, Zusammenlegen, Verschieben, Aufteilen, Vorverlagern) →
  Nachmessung. Erst andere Realisierung prüfen, dann das Modell neu schneiden.
- **Inhaltliche Optimierung** — Elemente und Graph über Quality-Rules, IRR (Annahmen) und FMEA
  (Risiken). Die gefundenen Risiken dienen zusätzlich als Prüffragen an den erzeugten Code.

**Reihenfolge.** Erst die Basis optimieren (Ketten schließen, Gegenmaßnahmen der tragenden Funktion
zuordnen, Flüsse als abgerufen oder vorab geliefert kennzeichnen), dann je Dimension analysieren (Sicherheit
mit der FMEA, Laufzeit am Antwortweg), dann Vorschläge einzeln proben und wählen. Die Basis zu optimieren
ist Hygiene und ein eigener Schritt, nicht Teil einer Analyse; er liegt am Abschluss von Stufe 7 der
Regelmatrix, an der Marke PDR, vor den Kettenanalysen auf Stufe 8. Perspektivisch ist eine unvollständige
Kette ein Fehler und keine Warnung. Eine Analyse ist eine Schleife: sie erzeugt Anforderungen, Funktionen
und Flüsse, und ihr Ergebnis ist ein gewöhnlicher CR, dessen Elemente die Stufen wie jede Änderung
durchlaufen. Eigen je Analyse ist der Vorschlag, allgemein der Umgang mit ihm.

**Gegengewicht.** Kettenoptimierung allein degradiert das Modell („die beste Funktion ist die,
die nicht da ist"); kürzer ist nicht besser, die besser beurteilten Entwürfe machten einen Schritt
ausdrücklich. Der **Blast-Radius** (vorwärts: betroffene FCHAINs; rückwärts: REQs über satisfy/verify)
läuft ihr entgegen. Er ordnet nicht, er spannt den Betrachtungsumfang auf: was vor einem Umbau zu lesen
ist. Schutzinvarianten: jede REQ behält eine
Realisierung; Modellgüte hält ihre Schwellen; vor jedem Zug steht die Prognose, was besser wird
und was gleich bleiben muss; kein Code ohne `realRef`.

**DoD Optimieren**
- Die acht Kettenkennzahlen werden deterministisch berechnet und reproduzieren das Referenzbeispiel
  (T-O1).
- Jede FCHAIN mit Profil-NFR ist bewertet; jede Verletzung trägt Diagnose und zulässige
  Handlungsklassen (T-O2).
- Jeder angewandte Optimierungszug hält die Schutzinvarianten und seine vorab festgelegte Prognose
  (T-O3).
- Die Modellarchitektur-Kennzahl bewertet einen bestätigt guten Zug als Verbesserung (T-O4).
- Umbauzüge (Verschieben, Verträge konsolidieren, parallele Pfade zusammenlegen) werden gefunden
  und verbessern messbar (T-O5, T-O6).
- IRR und FMEA sind gelaufen, ihre Befunde stehen als REQ/TEST im Modell und als Prüffragen am
  Code (T-O7).
- Das Modell ist vorbereitet: jede Wirkkette ist geschlossen, jedes Risiko hat einen Träger, und der
  Träger ist eine Funktion oder die Gegenmaßnahme ist als quer geltend benannt (T-O8).

---

## 6. Der Beweis im Code · *Abnahme von V, M und O*

Der Beweis muss im **Code** ankommen: sichtbar bessere **Architektur** und **Effizienz** gegenüber
frei laufendem Claude Code, nicht bessere Zahlen im Modell. Architektur-Urteile, die kein
deterministisches Maß tragen, bleiben menschliche Durchsicht — beide Codes nebeneinander.

**DoD Code**
- Bei gleicher Aufgabe und gleicher verdeckter Abnahme besteht der geführte Arm mindestens so gut
  wie der freie, mit dem besseren Schnitt nach Kennzahl **und** Durchsicht, kongruent zum Modell
  (T-C1).
- Ein Greenfield-Lauf endet in gebundenem Code, das Code-Urteil ist prüfbar (T-C2).
- Ein Umbau am Bestand läuft über Graph-Fragen, nicht über Suche und Volllauf (T-C3).
- Effizienz wird nur normalisiert verglichen (T-E5).
- Der freie Arm kann die Norm-Nachweise aus §2 nicht deterministisch erbringen; die Faustregel
  rechnet ihm die Dokumente deshalb nur als Text an, nicht als Nachweis (T-N3).

---

## 7. Die Familie ist Testbett und Fabrik · *zahlt ein auf M*

Eine Ontologie, ein Gate, ein SSOT (Kuzu), BOK als Standard-Quelle, jedes Mitglied nach
derselben Methode gebaut. Die Rigs sind die
**Systemabnahmetests** für Verstehen, Steuerung, Architektur und Effizienz: Betrieb, Auswertung
und Zusammenfassung gehören zur Methode, nicht daneben. Das Testbett ist ein eigenes Repo: **graphanalyze** trägt Rig, Nutzer-Simulator, Aufgaben, Auswertung und Läufe und misst eine gebaute
Arbeitskopie von graphcode; was graphcode an sich selbst prüft bleibt in graphcode.

**DoD Familie**
- Jeder Test aus §9 hat ein Rig oder einen Unit-Test; jedes Rig ist genau einem Test zugeordnet (T-F1).
- Jedes Rig läuft mit einem Befehl über `openMeasured`, stempelt Graph, Policy, Regeln, Code und
  Korpus in jede Zeile, und seine Auswertung ist committet (in graphanalyze). Ein Rig, das nicht läuft, fliegt
  raus (T-F1).
- graphcode selbst besteht T-V1 bis T-V4 (T-F2).

---

## 8. Am Ziel

Am Ziel sind wir, wenn FUNC- und MOD-View ein vernünftiges Blackboxing zeigen, sich aus den Regeln
ein Konstrukt wie moneyflow oder sirail strukturieren lässt und die resultierenden Datenströme ein
Optimum an Verträgen haben.

**DoD Ziel:** T-V1 bis T-V4, T-O4 und T-C1 sind an moneyflow **oder** sirail erfüllt, und alle
Tests aus §9 stehen auf „bestanden" oder tragen eine benannte Ausnahme.

**Offene Punkte auf dem Weg dorthin** (Stand 2026-10-08):
- **Optimieren:** Keine Architektur-Kennzahl rankt bekannt bessere Zustände richtig (T-O4), und keine Rangfolge
  aus Kennzahlen ordnet Umbauvorschläge (T-O3). Die Kettenkennzahlen sind Produktcode, Antwortweg und Träger je
  Risiko noch nicht (T-O1, T-O2, T-O8). Die Vorbereitung des Modells fehlt als Schritt (Stand 2026-10-11).
- **Steuerung bei CR-Arbeit:** Sie wirkt bei Greenfield und über die Historie, nicht am Bestand (T-E1, T-C3).
- **Empfehlen:** `graph_suggest` wird nicht abgerufen; keine Fix-Vorlage deckt die fünf Steuerregeln (T-M5).
- **Code-Beweis:** Kein ausgewerteter Lauf bis zum gebundenen Code (T-C2). Geführt ist ≈ 3,5× teurer als frei (T-E5).
- **Lokal gegen Frontier:** An der kleinen Aufgabe erfüllt bis auf die Geschwindigkeit (Faktor 2,6); am echten
  Auftrag und bis zum Code offen (T-E3, T-E4).
- **Selbstanwendung:** graphcode erreicht SRR, nicht PDR; Vertragsrand und Kopplung bestehen nicht (T-V2, T-V4, T-F2).
- **Rig-Betrieb:** Ohne Aufbau sind T-C1, T-C3, T-E5 und T-E9 (T-F1).
- **Vorführbarkeit:** Für keinen Test ist eine Demo benannt (§9.1). Demo-Träger ist der Energy Manager.

---

## 9. Testdefinitionen

### 9.1 Gemeinsame Regeln

Jeder Test nennt: **Frage** · **Aufbau** (Rig, Skript oder Unit-Test) · **Kriterium** (bestanden,
wenn …) · **Stand** (letzte Messung mit Datum, eine ehrliche Zahl) · **Demo** (ein Befehl oder eine Szene am
Demo-Projekt, an der ein Außenstehender den Claim sieht). Ein Test ohne Demo ist nachgewiesen, aber nicht
vorführbar — für die DoD zählt er als offen (§1). Alle Schwellen sind vom Autor bestätigt.

Ein Test kann auf mehrere Abschnitte einzahlen. Er steht unter dem Abschnitt, dessen Claim er
zuerst prüft; die DoD der anderen verweist auf ihn.

- Messung nur über `openMeasured` mit Stempel; ohne Stempel keine Zahl.
- Ein Lauf je Arm ist ein Einzelwert, kein Urteil. Aussagen über Arme erst ab **N ≥ 3** je Arm; die Läufe
  kommen über die Zeit dazu.
- Streut die unterscheidende Größe nicht, ist das Ergebnis **blind**, nicht „bestanden" (`discriminate`).
- Eine Widerlegung zählt nur mit Positivkontrolle; eine Null zählt nur, wenn die Regel ausgewertet wurde.
- Eine Architektur-Kennzahl gilt erst, wenn sie ein **Known-Answer-Set** richtig rankt.
- **Vier Gegenproben vor jedem Befund:**
  **G1** die Alternative auch dann messen, wenn man die Antwort zu kennen glaubt ·
  **G2** die naheliegende Erklärung gegen die eigenen Daten halten ·
  **G3** den Schaden eingrenzen, nicht nur nachweisen ·
  **G4** prüfen, ob das Werkzeug die Frage überhaupt beantworten kann.

### 9.2 Faustregel Effizienz (T-E5)

Beide Arme zahlen für ihre **ganze** Lieferung, Code plus Spezifikation:

```
K_geführt = K_Code,geführt + E_Modell × k_El
K_frei    = K_Code,frei    + (Z_Doku / 4) × p_out / a_out
```

| Größe | Bedeutung |
|---|---|
| `E_Modell` | Elemente des Modells, das der geführte Arm nutzt |
| `k_El` | Kosten je autoriertem Element |
| `Z_Doku` | Zeichen der Dokumente, die graphcode aus dem Modell rendert |
| `p_out` | Preis je Ausgabe-Token |
| `a_out` | Anteil der Ausgabe an den Gesamtkosten eines Schreiblaufs |

Der Kostentreiber ist die **Zahl der Turns mal Kontextgröße**, nicht das Modell an sich. Hebel: weniger
Graph-Turns, kleinerer Dauerkontext, weniger Reparaturschleifen im Code.

### 9.3 Tests

#### Verstehen (§2)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-V1** Blackbox-Breite | Hat jede Ebene 7 ± 2 Kinder? | `rules_evaluate` RD-04/RD-05, Band 3–9 | 0 Befunde auf allen Ebenen | graphcode: 7 Befunde RD-04 (2026-10-08) |
| **T-V2** Vertragsrand | Ist der Rand jeder Blackbox schmal? | BW-02, R-04, CR-01; `scripts/randbreiten.mjs` | 0 Befunde über Schwelle | nicht bestanden: BW-02 15 bei 19 Whiteboxes (2026-10-05) |
| **T-V3** Vier Fragen | Ist jede der vier Fragen beantwortet? | `graph_readiness`: Stufen und Marken; im Rig am Nachbau aus dem Audit | die Marken SRR, PDR, CDR und TRR sind erreicht | graphcode: SRR ja, PDR nein (2026-10-08) |
| **T-V4** Kopplung Modell ↔ Code | Ist das Modell zu 100 % gekoppelt, ohne ein Abbild des ganzen Codes zu sein? | RC-01…RC-09, R-19/R-20/R-26/R-32; `scripts/grenzmenge.mjs` | Marke Bau erreicht, Bindungsquote 100 %, Grenzmenge 100 % modelliert | nicht bestanden: gedriftet, Bindung 114/115, Grenzmenge FUNC 15/63 (2026-10-05) |
| **T-V5** Struktur gegen die Referenz | Trägt ein Greenfield-Lauf alle Ebenen, die die Referenz trägt? | graphanalyze `auswertung/verhalten.mjs` (`struktur`) | kein tragendes Muster des Golden fehlt in allen Läufen; Wirkketten mit genau einer FUNC ≤ 20 % | nicht bestanden: 23 von 43 Ketten mit einer FUNC (2026-09-27) |

#### Nachweis (§2)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-N1** Dokumentanteil der Normen | Welche Norm-Anforderungen sind dokument-belegbar, und deckt graphcode sie? | [`SPIKE-GC-norm-dokumentanteil-RESULTS`](spikes/SPIKE-GC-norm-dokumentanteil-RESULTS.md) | jede der 10 Anforderungsklassen ist `ja` oder als Lücke benannt | 3 von 10 ja, 6 teilweise, 1 nein (2026-09-26) |
| **T-N2** Nachweis deterministisch | Werden Traceability und Konsistenz aus dem Modell geprüft statt behauptet? | R-18, R-02/R-05/UC-01/R-21, R-19/R-20, RC-01…09, `graph_test_ingest` | RTM und VCRM ohne Lücke; Bindung 100 %; Ergebnisse aus echten Läufen | 118 von 134 TEST gebunden (Datum nicht festgehalten) |
| **T-N3** Gegenprobe freies Frontier-Modell | Kann ein frei laufendes Modell dieselben Nachweise erbringen? | freier Arm mit Auftrag RTM und VCRM, per `se:import-doc` gegen dieselben Regeln | Traceability und Konsistenz sind aus seinen Artefakten deterministisch prüfbar | nicht gemessen |

#### Managen (§3)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-M1** Unterbinden | Hält das Gate jeden Verstoß aus der DB? | Gate-Unit-Tests; Replay eines Fremdlaufs gegen das Audit | kein blockierender Verstoß in der DB; kein Zug meldet `E=0`, während der Graph Errors trägt | nicht bestanden: 5 von 76 Regeln blocken (2026-10-08) |
| **T-M2** Steuern im Lauf | Konvergiert ein Greenfield-Lauf zur implementierungsreifen Spezifikation? | Rig in graphanalyze, Stufe `modellieren` | Ablehnungen fallen; Marken SRR und PDR erreicht; Steuerwert ≤ 1 | todo: SRR und PDR in 7 von 7 Läufen je Arm; Steuerwert nicht im Datensatz (2026-10-06) |
| **T-M3** Steuern über die Historie | Sinken die Verstöße je Element, während das Modell wächst? | `scripts/spike-nachweis-history.mjs` | Verstöße je Element fallen monoton im Trend | GO: 0,954 → 0,039 (2026-08-25) |
| **T-M4** Kausalität | Wirkt ein verschobenes Budget der Policy auf das Gate-Urteil? | `tests/steering.steer-causality.test.ts` | 12/12 Prüfungen grün, 3 Rotkontrollen schlagen an | bestanden (2026-10-05) |
| **T-M5** Empfehlen | Erreichen Empfehlungen den Nutzer und sind sie anwendbar? | Audit der Aufrufe `graph_suggest`; graphanalyze `auswertung/schatten-suggest.mjs`; `vorschlag` je Zug im Rig | ≥ 1 angewandte Empfehlung je Lauf; jede Steuerregel hat Vorschlagssatz und Fix-Vorlage | nicht bestanden: keine Fix-Vorlage für die 5 Steuerregeln (2026-10-03) |
| **T-M6** Reihenfolge blockt nie | Darf der Nutzer Ebenen überspringen? | Gate-Test: MOD/FUNC ohne UC anlegen | Verdict ≠ `error`, Warnungen erlaubt | nicht erhoben |

#### Effizienz (§4)

**Wie gemessen wird.** Zwei Stellgrößen, eine je Messung: Schnittgröße und Kontextrezept (§4). Drei Wirkgrößen,
keine allein: Menge (Elemente), Qualität (Blindurteil, T-E10), Kosten (Turns und Wiederlesen, §9.2). Die
Readiness trennt die Arme nicht.

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-E1** Graph statt Grep | Wo sucht der Agent im Dateisystem, obwohl der Graph die Antwort hätte? | `scripts/retro-kpi.mjs` je CR: Graph-Leseaufrufe gegen Suchoperationen | jede Suche, die der Graph beantwortet hätte, ist als Potenzial ausgewiesen | KPI 1 Median 0,29 über 20 CRs (2026-10-05) |
| **T-E2** Whitebox-Kontext | Enthält die Whitebox, was sich tatsächlich ändert? | `scripts/whitebox-messung.mjs`, Ground Truth aus dem git-Diff | 100 % der geänderten Knoten in W bei \|W\|/\|G\| ≤ 0,05 | nicht bestanden: 4 von 7 Jobs (2026-10-05) |
| **T-E3** Lokal ≈ Frontier (Modell) | Nivelliert der Graph den Modellunterschied beim interaktiven Modellieren? | Rig in graphanalyze: Nutzer-Simulator, Arme `lokal` (qwen3.8, OpenCode) und `frontier` (Opus, Claude Code), Stufe `modellieren` | in dieser Rangfolge: **1.** jeder lokale Lauf erreicht das Ziel der Stufe · **2.** das Blindurteil trennt die Arme nicht · **3.** Zeit bis zum Ziel als Faktor lokal zu Frontier; Faktor 2 gilt als sehr gut, keine Bestehensschwelle | todo, je 7 Läufe (2026-10-06): 1 erfüllt (7 von 7) · 2 erfüllt · 3 Faktor 2,6 |
| **T-E4** Lokal ≈ Frontier (Code) | Dasselbe bis zum Code? | Rig in graphanalyze, Stufe `bauen`, beide Arme | Rangfolge wie T-E3; Ziel der Stufe ist die Marke Bau | kein ausgewerteter Lauf |
| **T-E5** Normalisierte Effizienz | Ist die geführte Lieferung billiger als die freie? | Faustregel §9.2; kein Aufbau | `K_geführt ≤ K_frei` bei gleicher Abnahme | ≈ 3,5× teurer (2026-09-23, n = 1) |
| **T-E6** Kipppunkt des Kontexts | Ab welcher Kürzung fällt die Ausbeute? | Rig, ≥ 3 Stufen der Promptgröße; Prompt-Bilanz der ersten Anfrage | Kurve mit dem Punkt, an dem Menge oder Qualität die Streuung verlässt | keine Kurve, nur Einzelpunkte |
| **T-E7** Testauswahl | Sagt der Graph, welche Tests laufen müssen? | `graph_tests` / `impactedTests()`; `scripts/test-selection-audit.mjs` | direkt gekoppelte Tests vollständig getroffen | Trefferquote 13 % (2026-08-21) |
| **T-E8** Werkzeuglatenz | Ist der Graph schnell genug für die Schleife? | `tests/perf.advisory-roundtrip.spike.test.ts` | Runde lesen → Status → Vorschlag → Anwenden < 200 ms | nicht bestanden: Median 4041 ms bei 2000 Knoten (2026-10-05) |
| **T-E9** Bedarf je Aufruf | Was wollte das Modell — hatte es das schon, oder hätte der Graph es geliefert? | kein Aufbau: der Treiber speichert den rohen Strom je Zug nicht | jeder vermeidbare Aufruf ist mit Grund und Kosten ausgewiesen | zuletzt 0,40 $ von 8,15 $ vermeidbar (2026-09-23) |
| **T-E10** Auftragstreue (Blindurteil) | Deckt die Spec den Auftrag, ohne offene Werte zu erfinden? | graphanalyze `auswertung/blindurteil.mjs`: anonyme Spec, ein Gutachter je Spec, Raster der Aufgabe | lokaler Arm in der Spanne des Frontier-Arms; 0 erfundene Werte bei den offenen Punkten | todo (2026-10-06): erfüllte Punkte lokal 9–11, Frontier 11 von 11 |
| **T-E11** Arbeitsweise | Referenziert das Modell den Bestand, statt ihn neu zu schreiben? | graphanalyze `auswertung/verhalten.mjs` | Dubletten ≤ 5 % der Elemente; neu angelegter Bestand fällt über die Runden | nicht bestanden: 125 Dubletten in 9 Läufen (2026-09-27, qwen3-coder) |
| **T-E12** Schnittgröße je Modell | Welche Paketgröße trägt ein Modell? | Paket-Werkzeug und Planer (Konzept Arbeitspakete) | je Modell die größte Stufe, deren Abnahmequote in der Streuung der kleinsten liegt | nicht gefahren: Paket-Werkzeug fehlt |

#### Optimieren (§5)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-O1** Kettenkennzahlen | Lassen sich die acht Kennzahlen deterministisch richtig rechnen? | `scripts/spike-kettenkennzahlen.mjs`, Referenzkette „Zahlung auslösen" | Referenzkette reproduziert; ≥ 90 % der Ketten auswertbar | nicht bestanden: 6 von 8 Kennzahlen in `chainMetrics` (synchrone Tiefe und Fehlerpfad-Tiefe leer), Referenzkette reproduziert; graphcode 24 von 25 Ketten bewertbar; von acht geprüften Modellen der Familie zwei ohne Fehler und voll bewertbar (2026-10-11) |
| **T-O2** Profil auf der Kette | Wird jede profilierte FCHAIN bewertet und diagnostiziert? | NFR-REQ an FCHAIN; Bewertung mit Diagnose und Handlungsklasse | 100 % der profilierten FCHAINs bewertet; jede Verletzung mit treibendem Knoten | nicht implementiert. Probe am energymanager: mit dem Merkmal synchron oder asynchron an den Flüssen ist der Antwortweg lesbar; das Merkmal ist an keinem Fluss der Familie gesetzt. Bau: CR-SM-407, CR-GC-783 (2026-10-11) |
| **T-O3** Degradationsschutz | Hält ein Optimierungszug die Invarianten? | Gate-dryRun vor und nach dem Zug; Prognose im CR | jede REQ behält `satisfy`; Schwellen halten; Prognose erfüllt | nicht implementiert. Von Hand an drei Fällen mit neun Entwürfen geprobt: die Invarianten hielten, eine Rangfolge aus Kennzahlen ordnete gegen das Blindurteil. Bau: CR-GC-785 (2026-10-11) |
| **T-O4** Vorzeichen der Architekturkennzahl | Rankt die Kennzahl bekannt bessere Zustände höher? | `scripts/known-answer-set.mjs`; graphanalyze `rig/moneyflow-struktur` | Known-Answer-Set richtig gerankt | No-Go: moneyflow 5,33 > graphcode 5,24 |
| **T-O5** Umbauzüge | Verbessert ein Umbauzug den Schnitt messbar? | `tests/arch.optimization-dry-run.spike.test.ts` | Modularität Q und Innenanteil steigen | Verschieben No-Go, Verträge konsolidieren GO (2026-08-26) |
| **T-O6** Parallele Pfade finden | Findet das System Duplikate zum Zusammenlegen? | `scripts/spike-nd-known-answer.mjs`, `scripts/spike-engpass-known-answer.mjs` | ≥ 6 von 7 bekannten Paaren gefunden | Ähnlichkeit 0/7, Engpass auf Dateiebene 6/7 (2026-09-24) |
| **T-O7** Inhaltliche Analysen | Sind IRR/FMEA gelaufen und in Modell und Code wirksam? | Skills `se-irr`, `se-fmea`; Prüfliste im Rig | jeder Befund als REQ/TEST oder benannte Ausnahme; Risiken als Prüffragen am Code | FMEA: ein Lauf an einer Kette von graphcode, vier Risiken mit Gegenmaßnahme im Modell, Tests ungebunden (CR-GC-779, 2026-10-10). IRR und die übrigen Analysen: nicht gelaufen |
| **T-O8** Güte des Modells | Ist das Modell vor der Analyse vorbereitet? | Bewertbarkeit und Träger je Risiko aus `graph_metrics` (CR-SM-407); Skill `se-vorbereitung` (CR-GC-784) | 100 % der Ketten bewertbar; jedes Risiko hat einen Träger; Träger ist eine Funktion oder die Gegenmaßnahme ist als quer geltend benannt | nicht bestanden. Die Rechnung steht in contracts 12.1.0 (CR-SM-407, nicht veröffentlicht); Skill und Marke fehlen (CR-GC-784, CR-SM-409). Gezählt am 2026-10-11: energymanager 8 von 8 Risiken an genau einer Funktion, sigllm 2 von 16, graphcode 2 von 4 |

#### Code (§6)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-C1** Geführt gegen frei | Baut geführtes Claude Code besseren Code als freies? | kein Aufbau | Abnahme geführt ≥ frei; Schnitt nach Kennzahl **und** Durchsicht besser; geführt `kongruent` | zuletzt 15/15 in beiden Armen, der freie Arm mit dem besseren Modulschnitt (2026-09-23) |
| **T-C2** Greenfield bis Code | Endet ein Lauf in gebundenem Code? | Rig in graphanalyze, Stufe `bauen`: Agent mit Schreibrecht, Ende an der Marke Bau, gemessen am Lauf-Repo; je Lauf Marken, Bindung und `npm test` | Bindungsquote > 0, Code-Urteil ≠ `nicht prüfbar`; Ziel der Stufe: Marke Bau | kein ausgewerteter Lauf. Positivkontrolle echtes Projekt energymanager: TRR erreicht, Bau nicht, 12 von 16 FUNC gebunden (2026-10-08) |
| **T-C3** Umbau am Bestand | Läuft ein Umbau über den Graphen? | kein Aufbau; die Reihenfolge hält der Skill `se-umbau` | `graph_impact` vor dem Löschzug; `graph_tests` statt Volllauf | Grundlinie: 0 Graph-Lesezugriffe, 3 Vollläufe (2026-09-23) |

#### Familie (§7)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-F1** Rig-Betrieb | Ist jeder Test reproduzierbar gefahren und ausgewertet? | Bestand §9.5 gegen graphanalyze `rig/README.md` | jedes Rig läuft, stempelt, hat eine committete Auswertung und ist einem T-… zugeordnet | nicht bestanden: 4 Tests ohne Aufbau (2026-10-08) |
| **T-F2** Selbstanwendung | Besteht graphcode seine eigenen Tests? | T-V1…T-V4 auf `docs/graph/graphcode.graph.json` | alle bestanden oder benannte Ausnahme | nicht bestanden: T-V1, T-V2, T-V3, T-V4 (2026-10-08) |

#### Hygiene (Voraussetzung, kein Claim-Nachweis)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-H1** Verdiente Null | Sind 0 Errors echt, oder wurde die Regel gar nicht gefragt? | `rules_evaluate` + Liste der nicht ausgewerteten Regeln | 0 Errors **und** alle vorgesehenen Regeln ausgewertet | graphcode: 5 Regeln nicht ausgewertet (BQ-*) (2026-10-08) |
| **T-H2** Regel-Matrix | Stimmt die Grammatik-SSOT mit dem Katalog? | `scripts/regel-matrix.mjs`; `tests/skill-rule-ids.test.ts` | jede Regel steht in der Matrix, jede genannte ID existiert | bestanden (2026-10-05) |
| **T-H3** Messinstrumente | Messen die Instrumente selbst richtig? | `tests/rig-measured.test.ts`, `claims.conformance.test.ts`, `import-boundaries.test.ts` | grün in der VOLL-Lane | grün |

### 9.4 Setting der Rigs

Rig und Auswertung leben im privaten Repo **graphanalyze**; es misst eine gebaute Arbeitskopie von graphcode. Hier
stehen Definition, Kriterium und Stand; was graphcode an sich selbst prüft (`npm run messung`, `verify:*`), bleibt
in diesem Repo.

Das Rig hat je **Aufgabe** (was der Arm bekommt) eine **Referenz** (wogegen gewertet wird, nie Material des Arms)
und **Arme**, die sich in genau einer Achse unterscheiden. Referenzen sind eingefroren. Ausnahme ist der
Produktvergleich lokal gegen Frontier: er vergleicht bewusst zwei ganze Produkte (Modell und Client).

| Aufgabe (graphanalyze `rig/aufgaben/`) | Input des Arms | Referenz | Stufen |
|---|---|---|---|
| **todo** | Todo-Liste für die Kommandozeile | Referenzlauf je Arm + Raster (11 P + 5 O) | `modellieren` |
| **todo-warnungsfrei** und Varianten | das fertige todo-Modell | wie todo | `warnungsfrei` |
| **todo-bauen** | das fertige todo-Modell | wie todo | `bauen` |
| **sigllm-prosa** | SIG Local als Prosa | Golden (255 Elemente) + Raster (28 P + 5 O) | `modellieren` |
| **energymanager** | echter Auftrag mit Projektskizze; gebaut wird ohne Gerätezugriff gegen eigene Testdaten | Raster (32 P + 6 O), vom Autor abgenommen | `modellieren`, `bauen` |
| moneyflow-Struktur | moneyflow-Graph durchs echte Gate strukturieren | bestätigter Strukturierungszug | deterministisch |
| Korpus `beispielgraphen/` (dieses Repo) | Eingabe für Rang- und Kennzahlfragen | eingefrorene Graphen | — |

**Standard-Set.** Dieselbe Aufgabe, dieselbe Referenz, derselbe Stempel — ein Unterschied zum letzten Lauf ist
dann eine Wirkung der Änderung.

| Stufe | Wann | Umfang | Deckt |
|---|---|---|---|
| **S1 deterministisch** | jede Änderung an Regeln, Policy, Messung; vor jedem Release | `npm run messung` → `docs/messung/stand.md` | T-V1, T-V2, T-V4, T-M3, T-M4, T-E1, T-E2, T-E8, T-O4, T-O6, T-H2 |
| **S2 lokal** | jede Änderung an Prompt, `vorschlag`, Werkzeugangebot oder Steuerung | `node rig/treiber.mjs serie` in graphanalyze, Aufgabe todo, Arm `lokal` | T-V3, T-V5, T-M1, T-M2, T-M5, T-E3, T-E4, T-E6, T-E10, T-E11, T-E12, T-C2 |
| **S3 Frontier** | Release, Claim-Aussage nach außen, Richtungsentscheidung | dieselbe Serie, Arm `frontier` | T-E3, T-E4, T-M5, T-C2 |

Der Executor (`graph_delegate`, `graphcode run`) ist eingefroren: kein Ausbau; er bleibt für headless und
schwächere Modelle.

### 9.5 Bestand der Messaufbauten

Jeder Aufbau zahlt auf genau die Tests ein, die in der Tabelle stehen. Aufbauten ohne Test-Zuordnung sind
Kandidaten zum Entfernen.

| Aufbau | Ort | Test | Status |
|---|---|---|---|
| Rig (Treiber, Simulator, Arme, Aufgaben) | graphanalyze `rig/` | T-E3, T-E4, T-M2, T-M5, T-C2 | läuft |
| Auswertung eines Laufs | graphanalyze `auswertung/` | T-V5, T-E10, T-E11, T-M5 | läuft |
| moneyflow-Struktur | graphanalyze `rig/moneyflow-struktur/` | T-V1, T-V2, T-O4 | ausgewertet |
| Messstand S1 | `scripts/messung.mjs` → `docs/messung/stand.md` | T-V2, T-V4, T-M4, T-E1, T-E2, T-E8, T-H2 | läuft |
| KPI 1 je CR | `scripts/retro-kpi.mjs` | T-E1 | läuft nach jedem Commit |
| Grenzmenge, Randbreiten | `scripts/grenzmenge.mjs`, `scripts/randbreiten.mjs` | T-V4, T-V2 | läuft |
| Whitebox-Messung | `scripts/whitebox-messung.mjs` | T-E2 | läuft |
| Nachweis-History | `scripts/spike-nachweis-history.mjs` | T-M3 | GO |
| Steuer-Kausalität | `tests/steering.steer-causality.test.ts` | T-M4 | grün |
| Testauswahl-Audit | `scripts/test-selection-audit.mjs` | T-E7 | aktuelle Zahl fehlt |
| Advisory-Latenz | `tests/perf.advisory-roundtrip.spike.test.ts` | T-E8 | läuft |
| Kettenkennzahlen | `scripts/spike-kettenkennzahlen.mjs` | T-O1 | Spike |
| Known-Answer-Sets | `scripts/known-answer-set.mjs`, `spike-nd-known-answer.mjs`, `spike-engpass-known-answer.mjs` | T-O4, T-O6 | No-Go / 6 von 7 |
| Architektur-Trockenübung | `tests/arch.optimization-dry-run.spike.test.ts` | T-O5 | Spike-Test |
| Norm-Dokumentanteil | `docs/spikes/SPIKE-GC-norm-dokumentanteil*.md` | T-N1, T-N2 | ausgewertet |
| Regel-Matrix | `scripts/regel-matrix.mjs` | T-H2 | läuft |
| Beispielgraphen | `beispielgraphen/` | T-O4, T-V2 | eingefrorener Korpus |

---

## Woran wir uns verlaufen

Views optimieren → triggert Regeln → triggert Methode → triggert Steuerung — der Kreis ohne
Anker. Der Anker ist das übergeordnete Ziel: **guter Code und gute Code-Architektur** (§6 und §8).
Eine Diskussion, die keinen Test aus §9 bewegt, zahlt auf keinen Claim ein.

Ziel-Architektur: `bok/docs/konzept/aise-family-architecture.md` (Familie-Repo).
