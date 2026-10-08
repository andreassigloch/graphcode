# graphcode-Leitlinie

> **SSOT ist dieses Dokument.** Der Systemknoten `SYS-graphcode` trägt nur den Verweis hierher — Format-E kennt keine mehrzeiligen Beschreibungen (ITEM-2026-183).
> Änderung nur durch den Autor, nicht durch Agenten — im Knoten und hier im selben Zug.

**Zweck:** Der Anker für jede Konzept-, Architektur- und Regel-Diskussion. Verläuft sich eine
Diskussion, wird sie gegen den Kern-Claim (§1) und die Definition of Done des betroffenen
Abschnitts geprüft. Destilliert am 2026-09-10 aus den Richtungs-Inputs des Autors und
`graphcode/docs/archive/articles/06-claims.md`, überarbeitet 2026-09-15 (Blocken, drei Stufen,
Geltungsbereich, Anker), 2026-09-25 (DoD je Abschnitt, Testdefinitionen aus den Rigs,
Review 23.09, Konzept Modell- vs. Realisierungsarchitektur), 2026-09-27 (§4 nur Ziel, Prinzip,
DoD; Messmethode zu den Tests; T-V5, T-E10…T-E12) und 2026-10-03 (interaktives Modellieren als
Hauptfall, `vorschlag` statt `next`, Executor eingefroren, S2 und T-E3 auf das interaktive Rig,
Prompt-Bilanz statt Zeichengrenze; Änderung vom Autor delegiert) und 2026-10-08 (Rig und Auswertung
im privaten Repo graphanalyze: Aufbau-Spalte in §9.3, §9.4 und §9.5 auf den Bestand nach CR-GC-739/740/764
gebracht; Fragen, Kriterien und Stände unverändert; Änderung vom Autor delegiert).

**Übergeordnetes Ziel:** guter Code und gute Code-Architektur.

**Lesart:** Jeder Abschnitt nennt, auf welchen Teil des Kern-Claims er einzahlt, und endet mit
einer **Definition of Done (DoD)**. Die DoD verweist auf Tests `T-…`; deren Aufbau, Kriterium und
heutiger Stand stehen gesammelt in §9.

---

## 1. Kern-Claim

Komplexe Systeme **verstehen (V)**, **managen (M)** und **optimieren (O)** durch **Abstraktion** —
nicht die Software-Implementierung 1:1 abbilden, sondern Blackboxen mit definierten Schnittstellen
vom SYS-Knoten bis zur implementierten Funktion sicherstellen.

Das Gütemaß ist **Verständlichkeit**: wenige Blöcke pro Ebene („was muss ich dem CEO zeigen, damit
er das Konzept versteht") — nicht Knotenzahlen. Die Schwellen stehen in den Regeln, nicht hier.

**DoD:** Die DoD von §2–§8 ist erfüllt, geprüft an graphcode selbst, an einem Fremdsystem
(moneyflow oder sirail) und an einem Greenfield-Lauf.

---

## 2. Verstehen — das Modell beantwortet vier Fragen · *zahlt ein auf V*

| Frage | Modellteil | Regeln / Readiness |
|---|---|---|
| **Warum** | UC-Baum, REQ | `uc`, `req` · R-02 (FUNC ohne REQ) |
| **Wie** | FUNC-in-FUNC + Wirkketten (FCHAIN) als Netz | `arch` · R-30 (FUNC ohne Kette) · FC-04 (Kette ohne Akteur an Anfang und Ende) |
| **Worüber** | SCHEMA/FLOW — der Vertrag, der die Grenze definiert | `schema` · IO-01 (Kettenanschluss) · BW-02, R-04 (Randbreite) |
| **Womit** | MOD-in-MOD, der Stack | `alloc` · CR-01 (Verträge über Modulgrenzen), MT-02 (LCOM4) |

Jede Ebene ist eine Blackbox mit 3–9 Kindern (7 ± 2, RD-04/RD-05) und einem schmalen
Vertragsrand (BW-02 für FUNC, R-04 für MOD). Das Modell ist **vollständig** (jede Frage hat eine
Antwort) und **mit dem Code gekoppelt**: jedes Modellelement hat seine Realisierung, aber das
Modell ist kein Abbild aller codierten Funktionen — was darunter liegt, bleibt in der Blackbox.

**Geltungsbereich.** **Modelliert** wird jedes System — Software, mechanisch, elektrisch —,
Nachweisbarkeit vor Detailtiefe. **Implementiert** wird nur Code.

**Nachweis.** Die aus dem Modell erzeugte Dokumentation (SRS, ConOps, Architektur, ICD, RTM, VCRM,
Test- und Integrationsplan, Change Log …) ist kompatibel zum **Dokumentanteil** der gängigen
Systems-Engineering-Normen: ISO/IEC/IEEE 29148, ISO/IEC/IEEE 15288 und Automotive SPICE. Der
Dokumentanteil ist der kleinere Teil. Die Normen sind überwiegend Prozessnormen, und Einigung,
Kommunikation, Planung, Steuerung und Capability Level ≥ 2 belegt kein Dokument. Welche
Anforderungen dokument-belegbar sind und welche davon graphcode heute erfüllt, steht in
[`SPIKE-GC-norm-dokumentanteil-RESULTS`](spikes/SPIKE-GC-norm-dokumentanteil-RESULTS.md). Der Unterschied zu frei erzeugter Doku: Traceability und die Konsistenz
Modell ↔ Code sind **deterministisch** aus demselben Modell belegt, aus dem die Dokumente
gerendert werden. Ein frei laufendes Frontier-Modell kann Dokumente schreiben, diese Nachweise
aber nach Einschätzung des Autors nicht erbringen (T-N3).

**DoD Verstehen**
- Jede Ebene liegt im Breitenband 3–9, jeder Vertragsrand unter seiner Schwelle (T-V1, T-V2).
- Alle vier Fragen sind beantwortet: die sechs Modell-Dimensionen der Readiness bestehen ihr Gate (T-V3).
- Ein Greenfield-Lauf trägt alle Ebenen der Referenz, auch Architektur (MOD) und Qualität
  (TEST an SCHEMA), nicht nur das Szenario-Skelett (T-V5).
- Das Modell ist zu 100 % mit dem Code gekoppelt — jedes Modul, jede Funktion und jeder Vertrag des
  Modells ist gebunden und kongruent —, ohne jede codierte Funktion abzubilden (T-V4).
- Jede dokument-belegbare Anforderung aus 29148, 15288 und A-SPICE ist von einer erzeugten Sicht
  und einer prüfenden Regel gedeckt, oder als Lücke benannt (T-N1, T-N2).

*Hygiene (Voraussetzung, kein eigener Nachweis):* 0 Error-Verletzungen, und nur dort, wo die
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
  Schritt von `graph_generate`, CR-GC-729…732), auch statistisch. Der Arbeitsauftrag an den Agenten
  kommt nur von `graph_generate`. Nur diese Stufe darf lernen.

Was nie blockt, ist die **Reihenfolge**: Ebenen und Reihenfolgen darf der Nutzer überspringen,
Architektur und Optimierer stehen ab dem ersten Zug offen.

**DoD Managen**
- Eine blockende Regel hält jeden Verstoß aus der Datenbank, auch einen Vollständigkeitsverstoß,
  und der Graph trägt keine Error-Verletzung, die das Gate nicht gemeldet hat (T-M1).
- Ein Greenfield-Lauf konvergiert: die Zahl der Gate-Ablehnungen fällt über die Runden, die
  Readiness erreicht den Handoff (8/8 Gates) (T-M2).
- Über die Historie eines Modells sinken die Verstöße je Element (T-M3).
- Die Stellgrößen (Budgets der Policy) wirken kausal auf das Gate-Urteil (T-M4).
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
Kontextmanagement *ist* Abstraktion. Der Hauptfall ist **interaktiv** (2026-10-03): der Nutzer
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
  Datei (die 6 000 Zeichen für `GRAPHCODE.md`, CR-GC-612, waren willkürlich). Messung offen (T-E6).

Konzept: [`graphcode_arbeitspakete_konzept.md`](graphcode_arbeitspakete_konzept.md). Wie die
Stellgrößen gemessen werden, steht bei den Tests (§9.3 Effizienz).

**DoD Effizienz**
- Jede Suche, die der Graph beantwortet hätte, ist als Optimierungspotenzial erkannt (T-E1), und der Agent bekommt eine
  Whitebox, die die tatsächlich betroffenen Knoten vollständig enthält (T-E2).
- Die Qualitätsunterschiede zwischen den Modellen werden durch den Graphen nivelliert: bei
  gleichem Treiber überlappen die Spannen der Qualitätskennzahlen von lokalem und
  Frontier-Arm — im Modell (T-E3) und im Code (T-E4).
- Nach der Faustregel (§9.2) kostet die geführte Lieferung höchstens so viel wie die freie (T-E5).
- Der Kontext ist auf seinen Kipppunkt eingestellt: kleiner wird er nur, solange die Ausbeute hält (T-E6).
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

Optimierungsvorschläge werden über Kennzahlen, Gleichgewichte und Invarianten gesteuert.
„Architektur" meint zwei Dinge, die getrennt bewertet werden
(Konzept „Modell- vs. Realisierungsarchitektur", 2026-09-25,
`docs/graphcode_architektur_konzept.md`):

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

**Gegengewicht.** Kettenoptimierung allein degradiert das Modell („die beste Funktion ist die,
die nicht da ist"). Der volatilitätsgewichtete **Blast-Radius** (vorwärts: betroffene FCHAINs;
rückwärts: REQs über satisfy/verify) läuft ihr entgegen. Schutzinvarianten: jede REQ behält eine
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
und Zusammenfassung gehören zur Methode, nicht daneben.

**DoD Familie**
- Jeder Test aus §9 hat ein Rig oder einen Unit-Test; jedes Rig ist genau einem Test zugeordnet (T-F1).
- Jedes Rig läuft mit einem Befehl über `openMeasured`, stempelt Graph, Policy, Regeln, Code und
  Korpus in jede Zeile, und seine Auswertung ist committet. Ein Rig, das nicht läuft, fliegt raus (T-F1).
- graphcode selbst besteht T-V1 bis T-V4 (T-F2).

---

## 8. Am Ziel

Am Ziel sind wir, wenn FUNC- und MOD-View ein vernünftiges Blackboxing zeigen, sich aus den Regeln
ein Konstrukt wie moneyflow oder sirail strukturieren lässt und die resultierenden Datenströme ein
Optimum an Verträgen haben.

**DoD Ziel:** T-V1 bis T-V4, T-O4 und T-C1 sind an moneyflow **oder** sirail erfüllt, und alle
Tests aus §9 stehen auf „bestanden" oder tragen eine benannte Ausnahme.

**Offene Punkte auf dem Weg dorthin** (Stand 2026-09-25; Empfehlen und Lokales LLM 2026-10-03):
- **Architektur-Kennzahl:** Jede Messung des ℝ⁶-Vektors gegen eine bekannte Antwort endete als
  No-Go oder widerlegt (T-O4). Die Realisierungsarchitektur (§5) ist beschrieben, aber nur als
  Spike gerechnet (T-O1).
- **Steuerung:** Sie wirkt bei Greenfield und über die Historie, nicht bei CR-Arbeit (T-M2, T-M3,
  T-E1, T-C3).
- **Empfehlen:** `graph_suggest` wird nicht abgerufen; der `vorschlag` an den Nutzer ist noch ohne
  Stempel gemessen (2026-10-03: in 6 Zügen unverändert abgeschickt, 2 Ablehnungen in 9 Bau-Zügen),
  und keine Fix-Vorlage deckt die fünf Steuerregeln (T-M5).
- **Code-Beweis:** Greenfield erreicht nie gebundenen Code (T-C2). Nach der Faustregel ist der
  geführte Arm heute ≈ 3,5× teurer (T-E5).
- **Lokales LLM:** Der Executor ist eingefroren (2026-10-03); interaktiv trägt qwen3.8 ohne ihn
  (3 Läufe ohne Stempel: Bau-Züge Median 1,8 min, 2 Ablehnungen in 9 Zügen). Der Vergleich zu
  Frontier im selben interaktiven Ablauf ist nicht gemessen — das Rig fehlt (T-E3); Runde 20
  (Executor) zeigte lokal deutlich hinter Frontier, die Readiness allein erkennt das nicht.
- **Rig-Betrieb:** Eine strukturierte Zusammenfassung fehlt; die `code-test`-Läufe liegen außerhalb
  des Repos (T-F1).

---

## 9. Testdefinitionen

### 9.1 Gemeinsame Regeln

Jeder Test nennt: **Frage** · **Aufbau** (Rig, Skript oder Unit-Test) · **Kriterium** (bestanden,
wenn …) · **Stand** (letzte Messung mit Datum, eine ehrliche Zahl). Alle Schwellen sind vom Autor bestätigt (2026-09-25);
die Schwellen von T-V5 und T-E10…T-E12 sind gesetzt (2026-09-27) und werden nach den nächsten Testläufen validiert.

Ein Test kann auf mehrere Abschnitte einzahlen. Er steht unter dem Abschnitt, dessen Claim er
zuerst prüft; die DoD der anderen verweist auf ihn.

- Messung nur über `openMeasured` mit Stempel (graphanalyze `rig/README.md`); ohne Stempel keine Zahl. Das gilt auch für `docs/messung/stand.md`: `npm run messung` verweigert eine Zeile ohne Stempel.
- Aussagen über Arme erst ab **N ≥ 3** je Arm; darunter wird eine Spanne berichtet,
  kein Urteil. Erfahrungswert der Streuung bei N ≤ 3: Elementzahlen ±30–50 %, Readiness ±0,06–0,08.
- Streut die unterscheidende Größe nicht, ist das Ergebnis **blind**, nicht „bestanden" (`discriminate`).
- Eine Widerlegung zählt nur mit Positivkontrolle; eine Null zählt nur, wenn die Regel ausgewertet wurde.
- Eine Architektur-Kennzahl gilt erst, wenn sie ein **Known-Answer-Set** richtig rankt
  (bekannt bessere Zustände, Negativkontrolle moneyflow).
- **Vier Gegenproben vor jedem Befund** (aus dem Kaltstart-Analysecase, `docs/archive/analysecase-kaltstart.md`):
  **G1** die Alternative auch dann messen, wenn man die Antwort zu kennen glaubt ·
  **G2** die naheliegende Erklärung gegen die eigenen Daten halten ·
  **G3** den Schaden eingrenzen, nicht nur nachweisen ·
  **G4** prüfen, ob das Werkzeug die Frage überhaupt beantworten kann (gibt es einen zweiten Pfad?).

### 9.2 Faustregel Effizienz (T-E5)

Ein echter dritter Arm („frei mit Dokumentation") ist zu teuer. Die Faustregel schätzt ihn aus
vorhandenen Zahlen: Beide Arme zahlen für ihre **ganze** Lieferung, Code plus Spezifikation.

```
K_geführt = K_Code,geführt + E_Modell × k_El
K_frei    = K_Code,frei    + (Z_Doku / 4) × p_out / a_out
```

| Größe | Bedeutung | Wert (Opus 5) | Herkunft |
|---|---|---|---|
| `E_Modell` | Elemente des Modells, das der geführte Arm nutzt | 255 (Golden, vorgegeben) | Code-Test |
| `k_El` | Kosten je autoriertem Element | 0,040–0,064 $ | Greenfield Runde 17 (Standard) / 18 (Prosa) |
| `Z_Doku` | Zeichen der Dokumente, die graphcode aus dem Modell rendert (für 0 LLM-Token) | 240 957 | Views des geführten Arms |
| `p_out` | Preis je Ausgabe-Token | 25 $/M | aus der Usage zurückgerechnet |
| `a_out` | Anteil der Ausgabe an den Gesamtkosten eines Schreiblaufs | 0,33 (0,28–0,38) | Runde 17/18 |

Der Code-Test vom 2026-09-23 ergibt damit:
- geführt: 10,44 $ + 255 × 0,052 $ ≈ **23,7 $**
- frei: 2,29 $ + 60 k Token × 25 $/M ÷ 0,33 ≈ **6,9 $**
- Verhältnis: **≈ 3,5×** (Spanne 2,7–4,3×; unnormalisiert waren es 4,6×).

Grenzen:
- n = 1 je Arm.
- Das Golden ist von Hand verfeinert und wird hier zum Listenpreis „nachgekauft".
- Die Scheibe nutzt nur 5 der 255 Elemente.

**Woher das Delta kommt** (Code-Test, `gefuehrt-0` gegen `frei-0`, 10,44 $ gegen 2,29 $, Δ 8,15 $;
`rig/code-test/messen.mjs` → `deltaZerlegung` (Aufbau entfernt mit CR-GC-740), exakt aus der Usage je API-Call; Turns mit zwei Auslösern je zur Hälfte):

| Anteil am Δ | $ | Mechanik |
|---|--:|---|
| mehr Code-Turns in größerem Kontext | 3,53 | 53 statt 21 Datei-/Code-Turns (Bash 18 statt 6, Edit 13 statt 3), jeder liest im Mittel 159k statt 65k Token |
| Turns, die eine graphcode-Antwort auslöst | 1,96 | 29,5 Turns, jeder liest den ganzen Kontext neu (~133k Token) |
| mehr Ausgabe | 1,66 | 110k statt 43k Ausgabe-Token |
| mehr Cache-Schreiben | 0,78 | |
| Turns nach ToolSearch | 0,21 | 3,5 Turns; entfällt, wenn die Werkzeuge nicht deferred sind |
| ungecachte Eingabe | 0,01 | |

Die Modellelemente selbst (`graph_elements`, `graph_context`, `graph_expand`, `graph_get_node`)
machen als wiedergelesener Inhalt nur ~1,1–1,4 $ aus (Größen aus Zeichen/4, auf die gemessene
Cache-Lesung skaliert). Der Kostentreiber ist die **Zahl der Turns mal Kontextgröße**, nicht das
Modell an sich. Das gibt drei Hebel:
1. **Weniger Graph-Turns.** Ein `graph_context` liefert den ganzen Slice, statt `elements` +
   `expand` + `get_node` einzeln abzufragen. `graph_help` (7–8 Aufrufe je Lauf, also Werkzeug
   lernen) gehört in Skill oder Prompt. ToolSearch verschwindet, wenn die Werkzeuge nicht mehr
   deferred sind (CR-GC-638).
2. **Kleinerer Dauerkontext.** Große Graph-Antworten bleiben bis zum Ende im Kontext.
   Gegenläufig: Die Antwort-Diät (CR-GC-613) kostete mehr Turns.
3. **Weniger Reparaturschleifen im Code.** 2,5× mehr Code-Turns bei gleicher Abnahme. Die
   Ursache ist nicht gemessen.

Die Bedarfsanalyse (T-E9) bestätigt das: Nur 0,40 $ der 8,15 $ Delta gehen auf vermeidbare
Informationsaufrufe. Der Rest ist echter Bedarf, und vor allem Code-Arbeit.

### 9.3 Tests

#### Verstehen (§2)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-V1** Blackbox-Breite | Hat jede Ebene 7 ± 2 Kinder? | `rules_evaluate` RD-04/RD-05, Band 3–9 (`policy.ts`); Spike Blackbox-Regeln L1/L2 (CR-SM-282) | 0 Befunde auf allen Ebenen | moneyflow nach dem Strukturieren: Wurzel-FUNC 306 → 9, RD-04 1 → 12 (der Befund wandert eine Ebene tiefer). Blackbox-Regeln auf Familiengraphen: GO (2026-09-05) |
| **T-V2** Vertragsrand | Ist der Rand jeder Blackbox schmal? | BW-02 (FUNC), R-04 (MOD), CR-01; `scripts/randbreiten.mjs` + `tests/randbreiten.test.ts` | 0 Befunde über Schwelle (BW-02: > 5 SCHEMA) | siehe [`docs/messung/stand.md`](messung/stand.md) (`npm run messung`) |
| **T-V3** Vier Fragen | Ist jede der vier Fragen beantwortet? | `graph_readiness`, Dimensionen `uc`, `req`, `arch`, `schema`, `alloc`, `ver` | jede der sechs Dimensionen besteht ihr Phasen-Gate | Greenfield, Opus, Prosa: 4/8 Gates (Runde 18, 2026-09-23); Executor lokal: 2/8 (Runde 19) |
| **T-V4** Kopplung Modell ↔ Code | Ist das Modell zu 100 % gekoppelt, ohne ein Abbild des ganzen Codes zu sein? | RC-01…RC-09, R-19/R-20/R-26/R-32; **Grenzmenge** `scripts/grenzmenge.mjs` (CR-GC-545): FUNC/SCHEMA, die eine MOD-Grenze kreuzen, sind Pflicht, alles darunter bleibt Blackbox | Urteil `kongruent`, Bindungsquote 100 %, Grenzmenge 100 % modelliert | siehe [`docs/messung/stand.md`](messung/stand.md) (`npm run messung`) |
| **T-V5** Struktur gegen die Referenz | Trägt ein Greenfield-Lauf alle Ebenen, die die Referenz trägt? | graphanalyze `auswertung/verhalten.mjs` (`struktur`), in jeder Auswertung eines Laufs gegen den Referenzlauf der Aufgabe: Typ-Kante-Typ-Muster in allen / in keinem Lauf, Jaccard Lauf↔Lauf und Lauf↔Golden, Typverteilung, FUNC je Wirkkette | kein Muster, das im Golden tragend ist (≥ 5 Kanten), fehlt in allen Läufen; Wirkketten mit genau einer FUNC ≤ 20 % | CR-GC-682 (9 Läufe qwen3-coder): untereinander 85 %, zum Golden 41–48 %. In keinem Lauf: MOD satisfy REQ, REQ compose REQ, TEST verify SCHEMA, SYS compose MOD, CR/MS. Median 0 MOD (Golden 7), 9 UC (3); 23 von 43 Ketten mit genau einer FUNC (2026-09-27) |

#### Nachweis (§2)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-N1** Dokumentanteil der Normen | Welche Norm-Anforderungen sind dokument-belegbar, und deckt graphcode sie? | Spike [`SPIKE-GC-norm-dokumentanteil-RESULTS`](spikes/SPIKE-GC-norm-dokumentanteil-RESULTS.md): Normtexte (PAM 4.0 und 29148 im Volltext, 15288 Leseprobe) gegen erzeugte Sichten und prüfende Regeln | jede der 10 dokument-belegbaren Anforderungsklassen ist `ja` oder als Lücke benannt | **3 von 10 ja, 6 teilweise, 1 nein** (semantische Qualität, braucht Urteil). Lücken: BRS/StRS fehlen, REQ ohne Owner/Priorität/Rationale/Risiko, 5.2.7-Wortliste nicht als Lint, Verifikationsmaßnahmen ohne Entry/Exit/Umgebung, dynamische Architektursicht nur als Wirkkette (2026-09-26) |
| **T-N2** Nachweis deterministisch | Werden Traceability und Konsistenz aus dem Modell geprüft statt behauptet? | R-18 (legale Kante), R-02/R-05/UC-01/R-21 (Abdeckung), R-19/R-20 (Bindung), RC-01…09 (Modell ↔ Code), `graph_test_ingest` (echte Ergebnisse); Sichten deterministisch gerendert (gleicher Graph, gleiche Bytes) | RTM und VCRM ohne Lücke; Bindung 100 %; Ergebnisse aus echten Läufen | graphcode: 118 von 134 TEST gebunden, 119 passed, 1 failed; Bindungsquote FUNC siehe T-V4 |
| **T-N3** Gegenprobe freies Frontier-Modell | Kann ein frei laufendes Modell dieselben Nachweise erbringen? | Code-Test `frei` mit Auftrag, zusätzlich RTM und VCRM zu liefern; dessen Dokumente per `se:import-doc` einlesen und mit denselben Regeln prüfen | Traceability und Konsistenz sind aus seinen Artefakten deterministisch prüfbar und stimmen | nicht gemessen. Ohne Auftrag lieferte der freie Arm keine IDs und keine Trace-Links (2026-09-23). These des Autors: Links in frei geschriebenem Text sind Behauptungen ohne Prüfer |

#### Managen (§3)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-M1** Unterbinden | Hält das Gate jeden Verstoß aus der DB? | Gate-Unit-Tests (Rollback, R-18); Replay des Fremdlaufs gegen das Audit | kein blockierender Verstoß in der DB; kein Zug meldet `E=0`, während der Graph Errors trägt | sigllm-Fremdlauf: 117 von 137 Bauzügen `E=0`, während der Graph 16 Errors trug (Delta-Semantik); Regel-Matrix: nur 5 von 73 Regeln blocken |
| **T-M2** Steuern im Lauf | Konvergiert ein Greenfield-Lauf zur implementierungsreifen Spezifikation? | Rig in graphanalyze (§9.5): Ablehnungen und Steuerwert je Zug aus dem Audit, Ende bei SRR und PDR. Der Executor-Aufbau `greenfield-systemtest` (`steuerung.mjs`, `trajektorie.mjs`), an dem der Stand gemessen ist, wurde mit CR-GC-740 entfernt | Ablehnungen fallen über die Runden; Readiness 8/8; Steuerwert ≤ 1 | Runde 19 (qwen3-coder, N = 3): Ablehnungen 13,3 → 3,0 je Lauf; Handoff nie erreicht (höchstens 4/8), `ms` immer 0 (2026-09-25) |
| **T-M3** Steuern über die Historie | Sinken die Verstöße je Element, während das Modell wächst? | `scripts/spike-nachweis-history.mjs` (CR-GC-427): 73 git-Stände, alle mit heutigen Regeln gerichtet | Verstöße je Element fallen monoton im Trend | **GO:** 0,954 → 0,039 bei +86 % Elementen (2026-08-25) |
| **T-M4** Kausalität | Wirkt ein verschobenes Budget der Policy tatsächlich auf das Gate-Urteil? | `tests/steering.steer-causality.test.ts` (CR-GC-484) | 12/12 Prüfungen grün, 3 Rotkontrollen schlagen an | siehe [`docs/messung/stand.md`](messung/stand.md) (`npm run messung`) |
| **T-M5** Empfehlen | Erreichen Empfehlungen den Nutzer und sind sie anwendbar? | Audit der Aufrufe `graph_suggest`; graphanalyze `auswertung/schatten-suggest.mjs` (CR-GC-609); Hint-Konformanz (CR-GC-432); `vorschlag` je angewandter Mutation (CR-GC-729…732) im Rig (§9.5): übernommene Vorschläge und Ablehnungen je Zug | ≥ 1 angewandte Empfehlung je Lauf (`graph_suggest`-Abruf oder übernommener `vorschlag`); jede Steuerregel hat einen Vorschlagssatz und eine Fix-Vorlage | Opus: 0 Abrufe; Schatten-Suggest: 0 anwendbare Vorschläge; `FIX_TEMPLATES` decken keine der 5 Steuerregeln, `VORSCHLAG_REGEL` alle 5; Fremdlauf: ausführbar in 0,03 % der Befunde; Hint-Konformanz nicht messbar (fehlende Stempel). Interaktiv qwen3.8 (2026-10-03, 3 Läufe ohne Stempel): `vorschlag` in 6 Zügen unverändert abgeschickt, 2 Ablehnungen in 9 Bau-Zügen |
| **T-M6** Reihenfolge blockt nie | Darf der Nutzer Ebenen überspringen? | Gate-Test: MOD/FUNC ohne UC anlegen | Verdict ≠ `error`, Warnungen erlaubt | nicht erhoben |

#### Effizienz (§4)

**These.** Was ein Modell liefert, hängt davon ab, *welcher* Inhalt im Kontext steht und wie groß
der Arbeitsschnitt ist — nicht davon, wie viel Kontext es bekommt.

**Prinzip — wie gemessen wird.**
- **Zwei Stellgrößen, eine je Messung:** Schnittgröße und Kontextrezept (§4). Modell, Treiber,
  Auftrag und Rundenzahl bleiben fest (§9.4).
- **Eingriffe nach Klasse getrennt:** Redundanz streichen · tragenden Inhalt streichen · Inhalt
  ergänzen · Push gegen Pull. Die Klassen wirken gegenläufig; gemittelt heben sie sich auf.
- **Drei Wirkgrößen, keine allein:** Menge (Elemente), Qualität (Blindurteil gegen die
  Auftragspunkte, T-E10), Kosten (Turns und Wiederlesen, §9.2). Dazu die Arbeitsweise (T-E11), die
  erklärt, *warum* sich eine Größe bewegt. Die Readiness trennt die Arme nicht (T-E3).
- **Bedarf je Aufruf** (T-E9): was das Modell nachlas, ob es das schon hatte, ob der Graph es
  geliefert hätte.
- **Nachspiel vor Lauf:** Ein neues Kontextrezept wird zuerst deterministisch gegen
  aufgezeichnete Läufe nachgespielt (Nachladequote, Größe), dann im echten Lauf gemessen. Das
  Nachspiel sagt, was fehlt — nicht, was das Modell mit dem Rest tut.
- **Streuung vor Effekt, Kurve statt Stützpunkt:** N ≥ 3 je Arm (§9.1); Schnittgröße und
  Kipppunkt über ≥ 3 Stufen je Modell.

**Beispiel.** CR-GC-682 verglich drei Kontextrezepte — Befund-Kontext, voller Index, Faltung — mit
qwen3-coder, je N = 3. Nach Menge gewann der Index (Median 126 gegen 112 und 83 Elemente). Das
Blindurteil fand in allen neun Specs keinen der 28 Auftragspunkte voll abgedeckt, und die
Arbeitsweise zeigte den Grund: Die Mehr-Elemente waren Dubletten, der Inhalt kam aus den
Prompt-Vorbildern statt aus dem Auftrag. Nach Menge allein wäre der falsche Default gewählt worden.

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-E1** Graph statt Grep | Wo sucht der Agent im Dateisystem, obwohl der Graph die Antwort geliefert hätte? | Zwei Analysezahlen je CR, keine Schwelle: Graph-Leseaufrufe und Suchoperationen (Grep + Glob + Doc-Read), `scripts/retro-kpi.mjs` → `.graphcode/cr-messung.jsonl` nach jedem Commit. Welche Suchen eine Graph-Abfrage beantwortet hätte, weist die Bedarfsanalyse (T-E9) je Lauf aus; für den Referenz-Change zusätzlich `rig/referenz-change/gegenprobe.mjs`. | Jede Suche, die der Graph beantwortet hätte, ist als Optimierungspotenzial ausgewiesen (Werkzeugangebot, Prompt, Skill) | siehe [`docs/messung/stand.md`](messung/stand.md) (`npm run messung`) |
| **T-E2** Whitebox-Kontext | Enthält die Whitebox, was sich tatsächlich ändert? | `scripts/whitebox-messung.mjs` (CR-GC-741, aus `rig/minimal-whitebox` Phase 1; Jobs aus der CR-Historie), Ground Truth aus dem git-Diff; Spike context-sufficiency; das Faltungs-Nachspiel (SPIKE compose-faltung) ist ausgewertet und mit CR-GC-740 entfernt | 100 % der geänderten Knoten in W bei \|W\|/\|G\| ≤ 0,05 | W trifft 100 % mit 1 824 Token, die Injektion 42 % mit 2 234 (2026-08-18); ein Bündel von ~667 Token genügt einem 27B-Modell für 5/5 Kriterien (2026-06-26, 1 Knoten). Pull statt Push wird nicht genommen: `graph_context` 0× bei > 400 Aufrufen (Arm `pull`). Faltung im Nachspiel: 5 % Nachladen bei 35 % Größe (mit uid-Index); im echten Lauf schlägt das Modell die nackten uids nach und liefert weniger als mit dem Index (CR-GC-682, 2026-09-27) |
| **T-E3** Lokal ≈ Frontier (Modell) | Nivelliert der Graph den Modellunterschied beim interaktiven Modellieren? | Rig in graphanalyze (§9.5): der Nutzer-Simulator (CR-GC-715) drückt bei jedem `vorschlag` Enter und beantwortet Fragen aus einem festen Antwortblatt; Arme `lokal` (qwen3.8, OpenCode) / `frontier` (Opus, Claude Code) — derselbe Ablauf, Modell **und** Client verschieden (Produktvergleich), Korpus sigllm-Prosa, `openMeasured`-Stempel, N ≥ 3. Je Zug: Dauer, Schritte, Ablehnungen, Steuerwert (Audit); Fragen in Zug 1; Blindurteil gegen die Auftragspunkte (T-E10) | Die Spannen von Dauer, Ablehnungen, Steuerwert je Zug und der Fragenzahl in Zug 1 überlappen bei N ≥ 3, und das Blindurteil trennt die Arme nicht (Autor 2026-10-03) | Nicht gefahren. Vorproben ohne Stempel (2026-10-03, Spanne): lokal (qwen3.8, 4 Läufe) Zug 1 2,0–4,1 min mit Fragen in 3 von 4 (0–5 Fragen); Bau-Züge (3 Läufe) Median 1,8 min (0,9–8,1), 2 Ablehnungen in 9 Zügen. Frontier (Opus, Claude Code headless, 1 Lauf, dieselbe Anweisung als CLAUDE.md): Zug 1 18 s mit 5 Fragen, vier Züge 2,1 min, 1,21 $, 0 Ablehnungen; mit der Standard-Auslieferung von `init` statt der Anweisung baute Opus alles in einem Zug (6,6 min, 2,26 $). Vorläufer über den Executor (Runde 20, 40 Runden, `auswertung-runde20.md`): lokal 91 Elemente, Frontier 187; Blindurteil lokal deutlich hinter Opus — die Readiness bildet das nicht ab (lokaler Coder: höchste Readiness, schlechtestes Urteil). Kosten nicht erfasst. Frühere Rankings zurückgezogen (Truncation-Fehler, Executor-Abschlussbericht) |
| **T-E4** Lokal ≈ Frontier (Code) | Dasselbe für Code? | kein Aufbau: `rig/code-test` wurde mit CR-GC-740 entfernt | Abnahme gleich, Kennzahlen aus T-C1 in überlappender Spanne | nicht gefahren |
| **T-E5** Normalisierte Effizienz | Ist die geführte Lieferung billiger als die freie? | Faustregel §9.2; der Aufbau `rig/code-test`, an dem der Stand gemessen ist, wurde mit CR-GC-740 entfernt | `K_geführt ≤ K_frei` bei gleicher Abnahme | **≈ 3,5× teurer** (2,7–4,3×, 2026-09-23) |
| **T-E6** Kipppunkt des Kontexts | Ab welcher Kürzung fällt die Ausbeute? | Executor-Rig (eingefroren) bzw. interaktives Rig, ≥ 3 Stufen der Promptgröße, getrennt nach „Redundanz" und „tragender Inhalt", N ≥ 3; interaktiv gemessen als Prompt-Bilanz (§4): Gesamtgröße der ersten Anfrage je Bestandteil | Kurve mit dem Punkt, an dem Menge oder Readiness die Streuung verlässt | keine Kurve, nur Einzelpunkte: Redundanz −34 % hält die Qualität (CR-GC-650/651); tragenden Inhalt streichen kostet 82 → 22 Elemente (CR-GC-282); Elementliste −57 %: Menge im Rauschen, Nachfragen +20 % (CR-GC-652); Auftrag + UC-Liste dazu: Tokens +38 %, Verhalten gleich (CR-GC-663/664); Vorbilder statt Verbote: Ablehnungen 13,3 → 3,0 (CR-GC-658/659); Zuschnitt Befund/Index/Faltung: Menge 112/126/83, Qualität gleich am Boden (CR-GC-682). Interaktiv, ein Lauf je Aufbau, ohne Stempel (2026-10-03): erste Anfrage 61 552 gegen ~17 800 Zeichen bei gleicher Dauer von Zug 1 (22 min) — die Dauer kam aus der Ausgabe; mit Vorbildern im Prompt Zug 1 in 2–4 min; Ausgabelimit 8 192 brach das Denken ab (25 750 Zeichen Denken in 9,5 min), seit 32 768 kein Abbruch |
| **T-E7** Testauswahl | Sagt der Graph, welche Tests laufen müssen? | `graph_tests` / `impactedTests()`; `scripts/test-selection-audit.mjs` (CR-GC-381); Spike selective-tests (CR-GC-380) | direkt gekoppelte Tests vollständig getroffen; `verify:code` fällt nur bei fehlender Bindung auf VOLL zurück | Trefferquote 13 %, Einsparpotenzial 53 % der Läufe (2026-08-21); Referenz-Change: 4 statt 172 Dateien wären möglich gewesen |
| **T-E8** Werkzeuglatenz | Ist der Graph schnell genug für die Schleife? | `tests/perf.advisory-roundtrip.spike.test.ts` (CR-GC-400/665), feste Eingabe | Runde lesen → Status → Vorschlag → Anwenden < 200 ms | siehe [`docs/messung/stand.md`](messung/stand.md) (`npm run messung`) |
| **T-E9** Bedarf je Aufruf | Was wollte das Modell — hatte es das schon, oder hätte der Graph es geliefert? | Kein laufender Aufbau: `turn-analyse.mjs` wurde mit CR-GC-740 entfernt, weil der Treiber des Rigs den rohen Strom je Zug nicht speichert (ITEM-2026-745). Definition, wie zuletzt gerechnet: `bedarfsAnalyse` für Claude-Code-Arme (Stream, mit Cache-Lesung je Aufruf), `bedarfsAnalyseExecutor` für den Executor (`run-raw.log`, Antwortgröße in Zeichen); eingebunden in `report.mjs` (Greenfield) und `messen.mjs` (Code-Test). Ein Arm ohne Modell wird gegen das Golden gelesen. Urteile: `doppelt` (wortgleich im selben Turn), `schon-da`, `teilweise-da` (uid stand in einer Detail-Antwort), `buendelbar` (gleiches Graph-Werkzeug im Folgeturn), `werkzeug-laden` (ToolSearch), `graph-haette` (Modelldatei gelesen, uid/realRef gesucht, Volllauf trotz gebundener Tests), beim Executor zusätzlich `je-runde` (schon in einer früheren Runde gelesen — sein Kontext beginnt jede Runde neu), sonst `neu` | Jeder vermeidbare Aufruf ist mit Grund und Kosten ausgewiesen und damit Optimierungspotenzial (Werkzeugangebot, Rundenprompt, Skill) | Code-Test geführt: 39 von 50 Aufrufen `neu`, vermeidbar 0,40 $ von 8,15 $ Delta; frei: 10/10 `neu`. Executor lokal (Runde 19, N = 3): 36–51 % der gelesenen Zeichen sind `je-runde`, fast nur der Auftrag (9–10× je Lauf). 200-Runden-Lauf: 78 % `je-runde` — `graph_elements {type:REQ}` 154×, Auftrag 178× (2026-09-25). Ursache (Runde 21, ITEM-2026-576): Der Dateiverweis in der Intention steht in jedem Rundenprompt. Ohne Verweis fällt das Nachlesen von 12 auf 1 je Lauf. CR-GC-663/664 hatte Text **und** Verweis im Prompt, deshalb blieb es beim Nachlesen. Den ganzen Text mitzuschicken war im sauberen Lauf teurer (589 s statt 115–246 s, n = 1). Offen ist die Variante „Verweis nur in der Seed-Runde“ |
| **T-E10** Auftragstreue (Blindurteil) | Deckt die Spec den Auftrag, ohne offene Werte zu erfinden? | graphanalyze `auswertung/blindurteil.mjs`: `vorbereiten` rendert je Lauf eine anonyme Spec (`spec-render.mjs`) mit Zuordnung und Gutachter-Vorgabe; ein Gutachter je Spec (Claude-Subagent, ohne Vergleich, ohne Herkunft) bewertet jeden Auftragspunkt (Raster der Aufgabe, `rig/aufgaben/<name>/punkte.json`; sigllm-prosa: 28 P + 5 O) mit ✓/~/✗, erfundene Werte, Dubletten, fünf Noten; `auswerten` fasst zur Tabelle je Lauf. Stichprobe der Befunde am Graphen | lokaler Arm in der Spanne des Frontier-Arms bei ✓ (P) und Notensumme; 0 erfundene Werte bei den O-Punkten | CR-GC-682 (qwen3-coder, 9 Läufe): ✓ 0 von 28 in allen Läufen, ~ 3–9; O offen geführt 0–1 von 5; erfunden 6–14; Notensumme 5–7 von 25 (Boden 5). Frontier-Arm mit diesem Raster nicht gemessen (2026-09-27) |
| **T-E11** Arbeitsweise | Referenziert das Modell den Bestand, statt ihn neu zu schreiben — und übernimmt es aus Vorbildern die Form statt des Inhalts? | graphanalyze `auswertung/verhalten.mjs`, in jeder Auswertung eines Laufs: Gate-Ablehnungen je Regel und mitgenommene Warnungen; Dubletten mit Form und Auslöser (aus `audit.jsonl`); REQ ohne kinds, ohne Erfüller, namensgleich. Preflight-Blocks und Vorbild-Leck gehörten zum Executor-Eingang und entfielen mit CR-GC-739 | Vorbild-Leck 0; Dubletten ≤ 5 % der Elemente; neu angelegter Bestand fällt über die Runden | CR-GC-682 (9 Läufe): 927 Neuanlagen bestehender Knoten, 125 Dubletten (75 ohne Befund, `arch`-Alternativen bei einem Kandidaten), Vorbild-Leck in 9 von 9 (ITEM-2026-607/610, 2026-09-27) |
| **T-E12** Schnittgröße je Modell | Welche Paketgröße trägt ein Modell? | Paket-Werkzeug und Planer (Konzept Arbeitspakete, CR 2); Stufen: ein Anker mit einer Ebene · ein Anker mit zwei Ebenen · alle Geschwister einer Ebene; Abnahmequote je Paket (Regeln im Geltungsbereich des Pakets), T-E10 und T-E11 je Stufe; N ≥ 3 je Modell und Stufe | je Modell die größte Stufe, deren Abnahmequote und Auftragstreue in der Streuung der kleinsten Stufe liegen | nicht gefahren — Paket-Werkzeug fehlt. Erster Punkt qwen3.8, interaktiv, ohne Stempel (2026-10-03): ein Vorschlag je Regel (ein Schritt je Zug) trägt — Median 1,8 min, 2 Ablehnungen in 9 Zügen; ein Vorschlag je Dimension (zwei Regeln) kostete 38,5 min und 5 Ablehnungen in einem Zug (CR-GC-730) |

#### Optimieren (§5)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-O1** Kettenkennzahlen | Lassen sich die acht Kennzahlen deterministisch richtig rechnen? | Referenzkette „Zahlung auslösen"; `scripts/spike-kettenkennzahlen.mjs` über 12 Familiengraphen | Referenzkette: Länge 6, synchron 5, Modulgrenzen 2, geteilte Knoten 1 (Banking bestanden, Social Media verletzt); ≥ 90 % der Ketten auswertbar | Spike: 5/8 Kennzahlen rechenbar, 32/76 Ketten auswertbar; ob sie mehr sagen als ℝ⁶, ist nicht entscheidbar (2026-09-25) |
| **T-O2** Profil auf der Kette | Wird jede profilierte FCHAIN bewertet und diagnostiziert? | NFR-REQ an FCHAIN; Bewertung mit Diagnose + Handlungsklasse; Divergenz zweier Zielprofile (CR-GC-430) | 100 % der profilierten FCHAINs bewertet; jede Verletzung mit treibendem Knoten und ≥ 1 zulässiger Handlungsklasse | Kettenbewertung nicht implementiert. Zielprofile steuern in verschiedene Richtungen (GO), aber der veröffentlichte `score` hat das falsche Vorzeichen (2026-08-26) |
| **T-O3** Degradationsschutz | Hält ein Optimierungszug die Invarianten? | Gate-dryRun vor/nach dem Zug; Prognose im CR | jede REQ behält `satisfy`; MT-02/CR-01 bleiben unter Schwelle; Prognose erfüllt | nicht implementiert |
| **T-O4** Vorzeichen der Architekturkennzahl | Rankt die Kennzahl bekannt bessere Zustände höher? | Positivkontrolle graphanalyze `rig/moneyflow-struktur --structure`; Known-Answer-Set `scripts/known-answer-set.mjs` (CR-SM-281) mit rekursiver und lexikographischer Variante; Archetyp-D7 (CR-GC-438); Ebenen-Konformanz (CR-GC-408) | Known-Answer-Set richtig gerankt; keine Dimension mit Gewicht ≥ 1 meldet beim bestätigten Zug eine Regression | **No-Go** über alle Varianten: moneyflow 5,33 > graphcode 5,24; rekursiv No-Go; lexikographisch widerlegt; D7 ohne eigene Dimension (R² 0,89); Ebenen-Konformanz trennt nicht (Δ 0,000). Konvergenz-Zeuge (CR-GC-407): ℝ⁶ bewegt sich bei 16 verstoßschließenden Zügen kein einziges Mal. Das ist erwartbar, weil Vollständigkeit keine Architektur ist, zeigt aber: ℝ⁶ taugt nicht als Fortschrittsanzeige. moneyflow-Zug: 3/6 Dimensionen melden Regression. Nachfolger Chebyshev (CR-SM-291) meldet GO — nicht nachgeprüft |
| **T-O5** Umbauzüge | Verbessert ein Umbauzug den Schnitt messbar? | `tests/arch.optimization-dry-run.spike.test.ts` (CR-GC-436), echtes Gate | Modularität Q und Innenanteil steigen | Verschieben **No-Go**: Innenanteil nur 17,2 → 19,6 %, deklariertes Q −0,016 gegen natürliches 0,595. Verträge konsolidieren: **GO** (2026-08-26) |
| **T-O6** Parallele Pfade finden | Findet das System Duplikate zum Zusammenlegen? | `scripts/spike-nd-known-answer.mjs` (CR-GC-542); `scripts/spike-engpass-known-answer.mjs` (CR-GC-637), 7 bekannte Paare | ≥ 6/7 bekannte Paare gefunden | Ähnlichkeit (ND-01): **0/7**. Gemeinsamer Engpass auf Dateiebene: **6/7**, auf Symbolebene 2/7 (2026-09-24) |
| **T-O7** Inhaltliche Analysen | Sind IRR/FMEA gelaufen und in Modell und Code wirksam? | Skills `se-irr`, `se-fmea`; Prüfliste im Rig | Analyse-Artefakt vorhanden; jeder Befund als REQ/TEST oder benannte Ausnahme; FMEA-Risiken am Code als Prüffragen beantwortet | sigllm Lauf 1: 0 von 5 Analysen (2026-09-19) |

#### Code (§6)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-C1** Geführt gegen frei | Baut geführtes Claude Code besseren Code als freies? | kein Aufbau: `rig/code-test` wurde mit CR-GC-740 entfernt. Wie zuletzt gemessen: Scheduler-Scheibe, verdeckte Abnahme mit 15 Tests; `messen.mjs`: Abnahme, `import-code`-Steuerwert, Code-Maße, RC-Urteil; dazu menschliche Durchsicht | Abnahme geführt ≥ frei; Schnitt nach Kennzahl **und** Durchsicht besser; geführt `kongruent`; N ≥ 3 | 15/15 in beiden Armen; der freie Arm hat den besseren Modulschnitt (4 Module gegen 1); `gefuehrt-2` `kongruent` (2026-09-23), `gefuehrt-0` mit heutigem Regelstand nachgemessen: `gedriftet`, Scheibe 4/5 gebunden (2026-09-25). Offene Messfehler: Der Steuerwert belohnt weniger Verträge (ITEM-2026-483), `messen.mjs` las die Saat (ITEM-2026-509) |
| **T-C2** Greenfield bis Code | Endet ein Auto-Lauf in gebundenem Code? | kein Aufbau: `greenfield-systemtest` Phase 2 wurde mit CR-GC-740 entfernt | Bindungsquote > 0, Code-Urteil ≠ `nicht prüfbar` | Bindung 0 % in allen Runden 13–20 |
| **T-C3** Umbau am Bestand | Läuft ein Umbau über den Graphen? | kein Aufbau: `rig/referenz-change` (CR-GC-630/631, `golden/endzustand.md`, `gegenprobe.mjs`) wurde mit CR-GC-740 entfernt; die Reihenfolge hält der Skill `se-umbau` | Endzustand erreicht; `graph_impact` vor dem Löschzug; `graph_tests` statt Volllauf (≤ 1 VOLL) | Grundlinie: 0 Graph-Lesezugriffe, 3 Vollläufe statt 4 Testdateien (2026-09-23); Wiederholung nach `se-umbau` nicht gefahren |

#### Familie (§7)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-F1** Rig-Betrieb | Ist jeder Test reproduzierbar gefahren und ausgewertet? | Bestand §9.5 gegen graphanalyze `rig/README.md` | jedes Rig läuft, stempelt, hat eine committete Auswertung und ist einem T-… zugeordnet | Abgeschlossene Spikes, Recorder und Alt-Ergebnisse gelöscht (CR-GC-676…678, 2026-09-26); `plan-step`, `flow-cardinality`, `import-doc-live` entfernt. `code-test`-Läufe liegen außerhalb des Repos. Eine strukturierte Gesamtauswertung fehlt |
| **T-F2** Selbstanwendung | Besteht graphcode seine eigenen Tests? | T-V1…T-V4 auf `docs/graph/graphcode.graph.json` | alle bestanden oder benannte Ausnahme | nicht als Gesamtlauf erhoben |

#### Hygiene (Voraussetzung, kein Claim-Nachweis)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-H1** Verdiente Null | Sind 0 Errors echt, oder wurde die Regel gar nicht gefragt? | `rules_evaluate` + Liste der nicht ausgewerteten Regeln + Prüfliste der Analysen | 0 Errors **und** alle vorgesehenen Regeln/Analysen ausgewertet | sigllm Lauf 1: 0 Errors bei 0 von 5 Analysen (ITEM-2026-341) |
| **T-H2** Regel-Matrix | Stimmt die Grammatik-SSOT mit dem Katalog? | `scripts/regel-matrix.mjs` → `docs/views/regel-matrix.md`; Smeagol-Check `tests/skill-rule-ids.test.ts`, `tests/policy-herkunft.test.ts` | jede Regel steht in der Matrix, jede genannte ID existiert | siehe [`docs/messung/stand.md`](messung/stand.md) (`npm run messung`) |
| **T-H3** Messinstrumente | Messen die Instrumente selbst richtig? | `tests/rig-measured.test.ts`, `steering.measurement-path.test.ts`, `skill-report-measured.test.ts`, `claims.conformance.test.ts`, `import-boundaries.test.ts` | grün in der VOLL-Lane | grün (Dauertests) |

### 9.4 Setting der Rigs

Das Rig und die Auswertung leben seit CR-GC-764 im privaten Repo **graphanalyze**; dort liegen Treiber,
Nutzer-Simulator, Aufgaben, Läufe und Datensätze (`docs/messung/benchmark.jsonl`). graphanalyze misst eine gebaute
Arbeitskopie von graphcode. Hier stehen Definition, Kriterium und Stand; was graphcode an sich selbst prüft
(`npm run messung`, `verify:*`, KPI 1), bleibt in diesem Repo.

Das Rig hat je **Aufgabe** (was der Arm bekommt) eine **Referenz** (wogegen gewertet wird,
nie Material des Arms) und **Arme**, die sich in genau einer Achse unterscheiden. Referenzen sind
eingefroren; ein Benchmark, dessen Eingabe weiterläuft, misst nichts.

#### Aufgaben und Referenzen

| Aufgabe (graphanalyze `rig/aufgaben/`) | Input des Arms | Referenz | Arme | Kosten je Lauf |
|---|---|---|---|---|
| **todo** | `start.md`: Todo-Liste für die Kommandozeile (`add`, `list`, `done`); Rückfragen beantwortet der Nutzer-Simulator aus `antwortblatt.md` | Referenzlauf je Arm (`referenz/<arm>/`: Graph, graphcode-Log, LLM-Log, Stempel) + Raster `punkte.json` (11 P + 5 O) | `lokal` (qwen3.8, OpenCode) · `frontier` (Opus, Claude Code) | lokal 0 $; Frontier nicht beziffert |
| **todo-warnungsfrei** · **todo-hand-warnungsfrei** | Stufe `warnungsfrei` auf einem fertigen Modell: Referenzlauf todo/lokal bzw. Handlauf des Autors (54 Elemente, eingefroren); Analysen abgelehnt, Freigabe erst am Ziel | wie todo | wie todo | wie todo |
| **todo-skill-warnungsfrei** · **todo-hand-skill-wf** | wie die beiden darüber, aber der Auftrag ist der Skill `se:close-violations` wörtlich — misst den Skilltext | wie todo | wie todo | wie todo |
| **sigllm-prosa** | `start.md`: SIG Local als Prosa, ohne Kennungen und Zerlegung; Saat = ein SYS-Knoten | Golden `beispielgraphen/sigllm-v98.graph.json` (handgeführt, Ende der Spezifikation: 255 Elemente / 506 Traces) + Raster `punkte.json` (28 P + 5 O; Blindurteil, T-E10) | `lokal` · `frontier`, interaktiv über den Nutzer-Simulator | lokal 0 $, ~3–4 min; Opus 18–26 $ |
| **energymanager** | echtes Projekt (2026-10-07), kein Rig-Lauf: Ausgangsauftrag mit Projektskizze, Antwortblatt aus dem Dialog | Raster `punkte.json` (32 P + 6 O), vom Autor abgenommen; nur Blindurteil | eine Claude-Code-Sitzung | zwei Gutachter-Läufe |
| moneyflow-Struktur (graphanalyze `rig/moneyflow-struktur/`) | moneyflow-Graph (1229 Elemente, 306 flache Wurzel-FUNC) durchs echte Gate strukturieren | bestätigter Strukturierungszug (Autor + Regeln) = Positivkontrolle | Baseline · `--propose` · `--structure --apply` | 0 $, deterministisch |
| Korpus `beispielgraphen/` (dieses Repo) | — (Eingabe für Rang- und Kennzahlfragen und für Produkt-Tests) | eingefrorene Graphen: bok, graph-view-edit, graphcode, moneyflow, gc_test-graphview, dummy-slicer, zwei Executor-Läufe, Golden sigllm-v98 mit Audit, zwei Referenzläufe todo | — | 0 $ |
| Known-Answer-Sets | — | ℝ⁶: git-Zustandspaare „bekannt besser" + Negativkontrolle moneyflow; ND/Engpass: 7 bekannte Duplikat-Paare; Kette: „Zahlung auslösen" | — | 0 $ |

Entfernt mit CR-GC-740 (Ergebnisse unter `docs/archive/`, in graphanalyze): Greenfield-Systemtest mit den Korpora
sigllm-spezifikation und graphcode-webapp (Executor), Code-Test, Referenz-Change, die Executor-Arme der
Minimal-Whitebox, dummy-slicer. Die Phase 1 der Minimal-Whitebox läuft als `scripts/whitebox-messung.mjs` (CR-GC-741).

#### Standard-Set

Drei Stufen, nach Kosten. Das Standard-Set ist die Regression: dieselbe Aufgabe, dieselbe
Referenz, derselbe Stempel — ein Unterschied zum letzten Lauf ist dann eine Wirkung der Änderung.

| Stufe | Wann | Umfang | Deckt |
|---|---|---|---|
| **S1 deterministisch** | jede Änderung an Regeln, Policy, Messung; vor jedem Release | `npm run messung` → `docs/messung/stand.md` (Urteil je Test-ID; noch nicht erhoben: T-V1, T-M3, T-E2, T-O4, T-O6, CR-GC-679B) — Whitebox-Messung · Grenzmenge · Randbreiten · Known-Answer-Sets (ℝ⁶, ND, Engpass) · Nachweis-History · Regel-Matrix · Perf-Test · KPI 1 (läuft automatisch) | T-V1, T-V2, T-V4, T-M3, T-M4, T-E1, T-E2, T-E8, T-O4, T-O6, T-H2 |
| **S2 lokal** | jede Änderung an Prompt, `vorschlag`, Werkzeugangebot oder Steuerung | Rig in graphanalyze (§9.5), `node rig/treiber.mjs serie`: Nutzer-Simulator (CR-GC-715) auf der Aufgabe **todo** (Standard-Set `rig/serie.json`; **sigllm-prosa** auf Anlass), Arm `lokal` (qwen3.8, OpenCode), N = 3, `openMeasured`-Stempel; je Zug Dauer, Schritte, Ablehnungen, Steuerwert (Audit), Fragen in Zug 1; Auswertung `auswertung/auswerten.mjs` (Kennzahlen, Verhalten, Schatten-Vorschlag, Blindurteil der Specs). Die Bedarfsanalyse hat keinen Aufbau (T-E9). Ersetzt den Executor-Lauf `gcrun` (N = 3, 40 Runden; eingefroren 2026-10-03) | T-V3, T-V5, T-M1, T-M2, T-M5, T-E3 (lokaler Arm), T-E6, T-E9, T-E10, T-E11, T-E12 |
| **S3 Frontier** | auf Anlass: Release, Claim-Aussage nach außen, Richtungsentscheidung | Rig in graphanalyze, Arm `frontier` (Opus, Claude Code). Code-Test und Referenz-Change wurden mit CR-GC-740 entfernt: T-C1, T-C3 und T-E5 haben keinen Aufbau | T-C1, T-C3, T-E3 (Frontier-Arm), T-E5, T-E9, T-M5 |

S1 und S2 kosten nichts und laufen oft; nur das Blindurteil in S2 braucht Frontier-Token (ein
Gutachter je Spec). S3 kostet je Durchgang rund 40–50 $ plus eine Sitzung;
eine Aussage aus S3 mit n = 1 ist eine Spanne, kein Urteil (§9.1).

#### Spezifische Vergleiche

Ein Vergleich gilt nur zwischen Armen, die sich in **genau einer** Achse unterscheiden.
Ausnahme ist der Produktvergleich lokal gegen Frontier (T-E3): Er vergleicht bewusst zwei ganze Produkte.

**Der Executor (`graph_delegate`, `graphcode run`) ist eingefroren** (Entscheid des Autors
2026-10-03): kein Ausbau; er bleibt für headless und schwächere Modelle und wird für größere
Aufgaben vermutlich wieder gebraucht. Für qwen3.8 ist er nicht mehr nötig — interaktiv 2
Gate-Ablehnungen in 9 Bau-Zügen ohne Executor (3 Läufe ohne Stempel). Executor mit
Frontier-Modell (`gcrun-frontier`) bleibt aus der Betrachtung (Entscheid 2026-09-25): ein
Frontier-Modell leistet intern besser und schneller, was der Executor von außen erzwingt.

| Frage | Arm gegen Arm | die eine Achse | Test |
|---|---|---|---|
| Ist lokal interaktiv so gut wie Frontier? | `lokal` (qwen3.8, OpenCode) ↔ `frontier` (Opus, Claude Code) | Modell + Client (Produktvergleich), derselbe Ablauf | T-E3 |
| Bringt graphcode besseren Code? | Code-Test `gefuehrt` ↔ `frei` | Werkzeug + Modell | T-C1, T-E5 |
| Muss die Struktur im Auftrag stehen? | Korpus sigllm-spezifikation ↔ sigllm-prosa | Input-Struktur | T-V3 |
| Push oder Pull beim Kontext? | Minimal-Whitebox `full` ↔ `whitebox` ↔ `off` ↔ `pull` | Injektion | T-E2, T-E6 |
| Welches Kontextrezept? | `GCRUN_INVENTORY` `fund` ↔ `index` ↔ `faltung` (CR-GC-682) | Inventar-Zuschnitt | T-E6, T-E10, T-E11 |
| Welche Schnittgröße trägt das Modell? | Paketstufen je Modell (Konzept Arbeitspakete) | Schnittgröße | T-E12 |
| Wie viel Prompt braucht der Agent? | S2 vor ↔ nach einer Prompt-Änderung (Executor: Serie CR-GC-650…664; interaktiv: Prompt-Bilanz der ersten Anfrage) | Promptinhalt | T-E6 |
| Hilft die Gate-Probe (dryRun)? | `GCRUN_CANDIDATES` 1 ↔ 2 (CR-GC-568) | Kandidatenzahl | T-M2 |
| Wie viel kostet Wiederlesen? | Rewind-Lauf ↔ Normallauf (halbe Turns) | Turn-Zahl | T-E5 |
| Rankt eine Kennzahl richtig — auch bei schlechter Bindung? | Korpus `beispielgraphen/` (Bindung 0 % … 92 %) | Graph | T-O4 |
| Nutzt der Agent den Graphen beim Umbau? | Referenz-Change ↔ Wiederholung nach einer Skill-/Werkzeugänderung | Führung | T-E1, T-C3 |

Die Vergleiche auf Code-Test, Referenz-Change, den Armen der Minimal-Whitebox und den `GCRUN_*`-Schaltern haben seit
CR-GC-740 keinen Aufbau; ihre Ergebnisse stehen in den Ständen der Tests.

### 9.5 Bestand der Messaufbauten

Jeder Aufbau zahlt auf genau die Tests ein, die in der Tabelle stehen. Aufbauten ohne
Test-Zuordnung sind Kandidaten zum Entfernen.

Entfernt mit CR-GC-740, weil ihr Eingang nicht mehr entsteht oder ihre Frage beantwortet ist: Greenfield-Systemtest
(samt `steuerung`, `trajektorie`, `faltung`, `turn-analyse`), sigllm-Spezifikation als eigenes Rig, Code-Test,
Referenz-Change, dummy-slicer. Ohne Aufbau sind seither T-C1, T-C2, T-C3, T-E4, T-E5 und T-E9.

| Aufbau | Pfad | Art | Test | Status |
|---|---|---|---|---|
| Rig | graphanalyze `rig/` (`treiber.mjs`, `simulator.mjs`, `arme.mjs`, `aufgaben/`, `serie.json`) | Rig, Serie; Nutzer-Simulator, Ende bei SRR und PDR | T-E3, T-M2, T-M5, T-E10 | läuft seit CR-GC-738; Datensätze in graphanalyze `docs/messung/benchmark.md` |
| Auswertung eines Laufs | graphanalyze `auswertung/` (`auswerten.mjs`: `kennzahlen`, `verhalten`, `schatten-suggest`, `blindurteil` + `spec-render`, `nachspielen`) | ein Datensatz je Lauf | T-V5, T-E10, T-E11, T-M5 | läuft (CR-GC-739) |
| Auswertung eines echten Projekts | graphanalyze `docs/messung/energymanager-2026-10-07/` | Audit, Sitzungsprotokolle, Blindurteil gegen ein abgenommenes Raster | T-E1, T-E10, T-E11 | einmal gefahren (2026-10-07); Folge-Items ITEM-2026-779…781 |
| moneyflow-Struktur | graphanalyze `rig/moneyflow-struktur/` | Rig, Gate | T-V1, T-V2, T-O4 | ausgewertet |
| Whitebox-Messung | `scripts/whitebox-messung.mjs` | Skript in `npm run messung` | T-E2 | läuft (CR-GC-741) |
| Beispielgraphen | `beispielgraphen/` | eingefrorener Korpus | T-O4, T-V2, Produkt-Tests | läuft |
| Executor-Programm | `docs/archive/executor-abschlussbericht.md` | Serie | T-E3, T-E6 | abgeschlossen, Rankings zurückgezogen; Rohdaten gelöscht bis auf 4 Fixture-Graphen (CR-GC-678); Executor eingefroren (2026-10-03) |
| sigllm-Fremdlauf | `bok/docs/research/fremdlauf-sigllm-2026-09.md` | Replay | T-M1, T-M5, T-V4 | ausgewertet |
| KPI 1 je CR | `scripts/retro-kpi.mjs`, `scripts/cr-messung.mjs` | Dauermessung | T-E1 | läuft nach jedem Commit |
| Messstand S1 | `scripts/messung.mjs` (`npm run messung`) → `docs/messung/stand.md` | Runner, deterministisch | T-V2, T-V4, T-M4, T-E1, T-E8, T-H2 | läuft (2026-09-27); T-V1, T-M3, T-E2, T-O4, T-O6 folgen (CR-GC-679B) |
| Grenzmenge | `scripts/grenzmenge.mjs` | Skript | T-V4 | läuft |
| Randbreiten | `scripts/randbreiten.mjs` | Skript + Test | T-V2 | läuft |
| Nachweis-History | `scripts/spike-nachweis-history.mjs` | Spike | T-M3 | GO |
| Steuer-Kausalität | `tests/steering.steer-causality.test.ts` | Dauertest | T-M4 | grün |
| Konvergenz-Zeuge | `tests/steering.convergence-witness.spike.test.ts` | Spike-Test | T-O4 | No-Go (ℝ⁶ blind für Vollständigkeitszüge) |
| Selektive Tests / Testauswahl-Audit | `docs/spikes/SPIKE-GC-selective-tests.md`, `scripts/test-selection-audit.mjs` | Spike + Skript | T-E7 | aktuelle Zahl fehlt |
| Advisory-Latenz | `tests/perf.advisory-roundtrip.spike.test.ts` | Dauertest | T-E8 | läuft |
| Batch-Seed-Perf | `tests/perf.batch-seed.test.ts` | Dauertest | T-E8 | aktuelle Zahl fehlt |
| Kettenkennzahlen | `scripts/spike-kettenkennzahlen.mjs` | Spike | T-O1 | 5/8 rechenbar |
| Zielprofil-Divergenz | CR-GC-430 | Spike | T-O2 | GO mit Vorzeichenfehler |
| Known-Answer-Set ℝ⁶ | `scripts/known-answer-set.mjs` | Spike | T-O4 | No-Go (Varianten rekursiv, lexikographisch, Archetyp-D7, Ebenen-Konformanz: No-Go, Skripte gelöscht, CR-GC-676) |
| Architektur-Trockenübung | `tests/arch.optimization-dry-run.spike.test.ts` | Spike-Test | T-O5 | Verschieben No-Go, Konsolidieren GO |
| Repository-Stil | `tests/repository-style.spike.test.ts` | Dauertest (Modell-Lane) | T-O5 | grün; Spike-Skript gelöscht (CR-GC-677) |
| ND- / Engpass-Known-Answer | `scripts/spike-nd-known-answer.mjs`, `spike-engpass-known-answer.mjs` | Spikes | T-O6 | ND 0/7, Engpass 6/7 |
| Abstraktionsebenen | `docs/spikes/SPIKE-GC-abstraction-levels*.md` | Spike | T-V1 | nur qualitativ |
| Kaltstart test_karp | CR-GC-485 | Einzellauf | T-V3, T-M2 | ausgewertet |
| Norm-Dokumentanteil | `docs/spikes/SPIKE-GC-norm-dokumentanteil*.md` | Spike (Recherche) | T-N1, T-N2 | ausgewertet (2026-09-26) |
| Regel-Matrix | `scripts/regel-matrix.mjs` | Generator | T-H2 | läuft |

---

## Woran wir uns verlaufen

Views optimieren → triggert Regeln → triggert Methode → triggert Steuerung — der Kreis ohne
Anker. Der Anker ist das übergeordnete Ziel: **guter Code und gute Code-Architektur** (§6 und §8).
Eine Diskussion, die keinen Test aus §9 bewegt, zahlt auf keinen Claim ein.

Ziel-Architektur: `bok/docs/konzept/aise-family-architecture.md` (Familie-Repo).
