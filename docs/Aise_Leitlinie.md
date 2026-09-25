# Aise-Leitlinie

> **SSOT ist dieses Dokument.** Der Systemknoten `SYS-graphcode` trägt nur den Verweis hierher — Format-E kennt keine mehrzeiligen Beschreibungen (ITEM-2026-183).
> Änderung nur durch den Autor, nicht durch Agenten — im Knoten und hier im selben Zug.

**Zweck:** Der Anker für jede Konzept-, Architektur- und Regel-Diskussion. Verläuft sich eine
Diskussion, wird sie gegen den Kern-Claim (§1) und die Definition of Done des betroffenen
Abschnitts geprüft. Destilliert am 2026-09-10 aus den Richtungs-Inputs des Autors und
`graphcode/docs/articles/06-claims.md`, überarbeitet 2026-09-15 (Blocken, drei Stufen,
Geltungsbereich, Anker) und 2026-09-25 (DoD je Abschnitt, Testdefinitionen aus den Rigs,
Review 23.09, Konzept Modell- vs. Realisierungsarchitektur).

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

**DoD Verstehen**
- Jede Ebene liegt im Breitenband 3–9, jeder Vertragsrand unter seiner Schwelle (T-V1, T-V2).
- Alle vier Fragen sind beantwortet: die sechs Modell-Dimensionen der Readiness bestehen ihr Gate (T-V3).
- Das Modell ist zu 100 % mit dem Code gekoppelt — jedes Modul, jede Funktion und jeder Vertrag des
  Modells ist gebunden und kongruent —, ohne jede codierte Funktion abzubilden (T-V4).

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
  Gummiband zurück zur implementierungsreifen Spezifikation.
- **Empfehlen:** Vorschläge für den nächsten Schritt (`graph_next_step`, `graph_suggest`), auch
  statistisch. Nur diese Stufe darf lernen.

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

Struktur und Determinismus des Graphen versorgen das LLM gezielt mit dem Nötigen: der Agent
arbeitet auf der need-to-know-Whitebox, statt auf dem ganzen Repo zu raten. Kontextmanagement
*ist* Abstraktion. Zwei Claims:

- **Lokal ≈ Frontier:** Ein lokales Modell erzeugt unter graphcode-Führung Modelle und Code auf
  Augenhöhe mit einem Frontier-Modell.
- **Geführt ist effizienter als frei:** graphcode-geführtes Entwickeln ist effizienter als frei
  laufendes Claude Code mit Opus — **normalisiert** auf den Lieferumfang: Das Modell und die
  daraus erzeugten Dokumente (RTM, ICD, Testkonzept …) sind Lieferung, nicht Overhead.

**Kontext gegen Output — was gemessen ist.** Die Achse ist *welcher* Inhalt, nicht wie viel:

| Eingriff in den Kontext | Wirkung auf Menge / Qualität | Quelle |
|---|---|---|
| Redundanz streichen (Werkzeugkatalog, erster Turn −34 %) | Qualität gleich, Ablehnungen 5,7 → 3,0, Laufzeit 596 → 186 s | CR-GC-650/651 |
| Tragenden Inhalt streichen (Kandidaten-Text, Beispiele) | 82 → 22 Elemente | CR-GC-282 |
| Weiter kürzen (Elementliste −57 %) | Menge im Rauschen, Nachfragen +20 % | CR-GC-652 |
| Mehr Kontext (Auftrag + UC-Liste) | Tokens +38 %, Verhalten unverändert — zurückgenommen | CR-GC-663/664 |
| Vorbilder statt Verbote | Ablehnungen 13,3 → 3,0, Readiness req/uc .80/.79 → .89/.85 | CR-GC-658/659 |
| Gezieltes Bündel (`graph_context`, ~667 Token statt ~34k SPEC) | lokales 27B-Modell: 5/5 Kriterien | SPIKE context-sufficiency |
| Whitebox W statt Injektion | 100 % statt 42 % der geänderten Knoten, weniger Token | SPIKE minimal-whitebox |
| Pull statt Push (Trias nur angeboten) | nicht genommen: `graph_context` 0× bei > 400 Aufrufen | minimal-whitebox Arm pull |
| Antwort-Diät (Werkzeugantworten −38 %) | Turns 79 → 107, Kosten nicht gesunken | CR-GC-613 |

Die Kosten treibt das **Wiederlesen**, nicht das Schreiben: 99,9 % der Eingabe im
`claude -p`-Arm, 61 % der Kosten im geführten Code-Arm — getrieben von der Zahl der Turns, nicht vom Modellinhalt (§9.2). Ein **Kipppunkt** Promptgröße → Ausbeute
ist nicht gemessen — es gibt zwei Stützpunkte, keine Kurve (T-E6).

**DoD Effizienz**
- Jede Suche, die der Graph beantwortet hätte, ist als Optimierungspotenzial erkannt (T-E1), und der Agent bekommt eine
  Whitebox, die die tatsächlich betroffenen Knoten vollständig enthält (T-E2).
- Die Qualitätsunterschiede zwischen den Modellen werden durch den Graphen nivelliert: bei
  gleichem Treiber überlappen die Spannen der Qualitätskennzahlen von lokalem und
  Frontier-Arm — im Modell (T-E3) und im Code (T-E4).
- Nach der Faustregel (§9.2) kostet die geführte Lieferung höchstens so viel wie die freie (T-E5).
- Der Kontext ist auf seinen Kipppunkt eingestellt: kleiner wird er nur, solange die Ausbeute hält (T-E6).
- Der Graph sagt, welche Tests laufen müssen, und antwortet schnell genug für die Schleife (T-E7, T-E8).
- Jeder Lauf weist je Informationsaufruf aus, was das Modell wollte, ob es das schon hatte und ob der
  Graph es geliefert hätte (T-E9).

---

## 5. Optimieren — Modell-, Realisierungs- und Inhaltsarchitektur · *zahlt ein auf O*

Optimierungsvorschläge werden über Kennzahlen, Gleichgewichte und Invarianten gesteuert.
„Architektur" meint zwei Dinge, die getrennt bewertet werden
(Konzept „Modell- vs. Realisierungsarchitektur", 2026-09-25):

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

**Offene Punkte auf dem Weg dorthin** (Stand 2026-09-25):
- **Architektur-Kennzahl:** Jede Messung des ℝ⁶-Vektors gegen eine bekannte Antwort endete als
  No-Go oder widerlegt (T-O4). Die Realisierungsarchitektur (§5) ist beschrieben, aber nur als
  Spike gerechnet (T-O1).
- **Steuerung:** Sie wirkt bei Greenfield und über die Historie, nicht bei CR-Arbeit (T-M2, T-M3,
  T-E1, T-C3).
- **Empfehlen:** Empfehlungen werden nicht abgerufen, und keine Fix-Vorlage deckt die fünf
  Steuerregeln (T-M5).
- **Code-Beweis:** Greenfield erreicht nie gebundenen Code (T-C2). Nach der Faustregel ist der
  geführte Arm heute ≈ 3,5× teurer (T-E5).
- **Lokales LLM:** Die Executor-Schleife ist nicht zu Ende optimiert, und Runde 20 ist
  unausgewertet (T-E3).
- **Rig-Betrieb:** Eine strukturierte Zusammenfassung fehlt. Ein Teil der Läufe und Spikes ist
  nicht committet (T-F1).

---

## 9. Testdefinitionen

### 9.1 Gemeinsame Regeln

Jeder Test nennt: **Frage** · **Aufbau** (Rig, Skript oder Unit-Test) · **Kriterium** (bestanden,
wenn …) · **Stand** (letzte Messung mit Datum, eine ehrliche Zahl). Alle Schwellen sind vom Autor bestätigt (2026-09-25).

- Messung nur über `openMeasured` mit Stempel (`rig/README.md`); ohne Stempel keine Zahl.
- Aussagen über Arme erst ab **N ≥ 3** je Arm; darunter wird eine Spanne berichtet,
  kein Urteil. Erfahrungswert der Streuung bei N ≤ 3: Elementzahlen ±30–50 %, Readiness ±0,06–0,08.
- Streut die unterscheidende Größe nicht, ist das Ergebnis **blind**, nicht „bestanden" (`discriminate`).
- Eine Widerlegung zählt nur mit Positivkontrolle; eine Null zählt nur, wenn die Regel ausgewertet wurde.
- Eine Architektur-Kennzahl gilt erst, wenn sie ein **Known-Answer-Set** richtig rankt
  (bekannt bessere Zustände, Negativkontrolle moneyflow).

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
`node rig/code-test/messen.mjs <gefuehrt> <frei>` → `deltaZerlegung`, exakt aus der Usage je API-Call; Turns mit zwei Auslösern je zur Hälfte):

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
| **T-V2** Vertragsrand | Ist der Rand jeder Blackbox schmal? | BW-02 (FUNC), R-04 (MOD), CR-01; `scripts/randbreiten.mjs` + `tests/randbreiten.test.ts` | 0 Befunde über Schwelle (BW-02: > 5 SCHEMA) | graphcode: 16 Befunde bei 19 Whiteboxes (84 %); moneyflow hat 0 Whiteboxes, dort kann BW-02 nicht feuern (2026-09-23) |
| **T-V3** Vier Fragen | Ist jede der vier Fragen beantwortet? | `graph_readiness`, Dimensionen `uc`, `req`, `arch`, `schema`, `alloc`, `ver` | jede der sechs Dimensionen besteht ihr Phasen-Gate | Greenfield, Opus, Prosa: 4/8 Gates (Runde 18, 2026-09-23); Executor lokal: 2/8 (Runde 19) |
| **T-V4** Kopplung Modell ↔ Code | Ist das Modell zu 100 % gekoppelt, ohne ein Abbild des ganzen Codes zu sein? | RC-01…RC-09, R-19/R-20/R-26/R-32; **Grenzmenge** `scripts/grenzmenge.mjs` (CR-GC-545): FUNC/SCHEMA, die eine MOD-Grenze kreuzen, sind Pflicht, alles darunter bleibt Blackbox | Urteil `kongruent`, Bindungsquote 100 %, Grenzmenge 100 % modelliert | graphcode v283: Grenzmenge FUNC 34 % (15/44), SCHEMA 14 % (2026-09-16); sigllm-Fremdlauf FUNC 20/24; sigllm Lauf 2: 33/33 `realRef` erfunden → `gedriftet` |

#### Managen (§3)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-M1** Unterbinden | Hält das Gate jeden Verstoß aus der DB? | Gate-Unit-Tests (Rollback, R-18); Replay des Fremdlaufs gegen das Audit | kein blockierender Verstoß in der DB; kein Zug meldet `E=0`, während der Graph Errors trägt | sigllm-Fremdlauf: 117 von 137 Bauzügen `E=0`, während der Graph 16 Errors trug (Delta-Semantik); Regel-Matrix: nur 5 von 73 Regeln blocken |
| **T-M2** Steuern im Lauf | Konvergiert ein Greenfield-Lauf zur implementierungsreifen Spezifikation? | `rig/greenfield-systemtest`, `steuerung.mjs`, `trajektorie.mjs`, `zugverlauf.mjs` | Ablehnungen fallen über die Runden; Readiness 8/8; Steuerwert ≤ 1 | Runde 19 (qwen3-coder, N = 3): Ablehnungen 13,3 → 3,0 je Lauf; Handoff nie erreicht (höchstens 4/8), `ms` immer 0 (2026-09-25) |
| **T-M3** Steuern über die Historie | Sinken die Verstöße je Element, während das Modell wächst? | `scripts/spike-nachweis-history.mjs` (CR-GC-427): 73 git-Stände, alle mit heutigen Regeln gerichtet | Verstöße je Element fallen monoton im Trend | **GO:** 0,954 → 0,039 bei +86 % Elementen (2026-08-25) |
| **T-M4** Kausalität | Wirkt ein verschobenes Budget der Policy tatsächlich auf das Gate-Urteil? | `tests/steering.steer-causality.test.ts` (CR-GC-484) | 12/12 Prüfungen grün, 3 Rotkontrollen schlagen an | **12/12** (2026-09-07; vorher 2/12) |
| **T-M5** Empfehlen | Werden Empfehlungen abgerufen und sind sie anwendbar? | Audit der Aufrufe `graph_suggest`/`graph_next_step`; `schatten-suggest.mjs` (CR-GC-609); Hint-Konformanz (CR-GC-432) | ≥ 1 Abruf je Lauf, ≥ 1 angewandter Vorschlag; jede Steuerregel hat eine Fix-Vorlage | Opus: 0 Abrufe; Schatten-Suggest: 0 anwendbare Vorschläge; `FIX_TEMPLATES` decken keine der 5 Steuerregeln; Fremdlauf: ausführbar in 0,03 % der Befunde; Hint-Konformanz nicht messbar (fehlende Stempel) |
| **T-M6** Reihenfolge blockt nie | Darf der Nutzer Ebenen überspringen? | Gate-Test: MOD/FUNC ohne UC anlegen | Verdict ≠ `error`, Warnungen erlaubt | nicht erhoben |

#### Effizienz (§4)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-E1** Graph statt Grep | Wo sucht der Agent im Dateisystem, obwohl der Graph die Antwort geliefert hätte? | Zwei Analysezahlen je CR, keine Schwelle: Graph-Leseaufrufe und Suchoperationen (Grep + Glob + Doc-Read), `scripts/retro-kpi.mjs` → `.graphcode/cr-messung.jsonl` nach jedem Commit. Welche Suchen eine Graph-Abfrage beantwortet hätte, weist die Bedarfsanalyse (T-E9) je Lauf aus; für den Referenz-Change zusätzlich `rig/referenz-change/gegenprobe.mjs`. | Jede Suche, die der Graph beantwortet hätte, ist als Optimierungspotenzial ausgewiesen (Werkzeugangebot, Prompt, Skill) | Graph-Leseaufrufe ÷ Suchen im Median 0,5 seit CR-640; CR-GC-661…666 ohne einen Graph-Lesezugriff (2026-09-25). Referenz-Change: 0 Graph-Lesezugriffe gegen 27 Suchen; der Graph hätte 4 statt 172 Testdateien und 20 betroffene Kanten geliefert (2026-09-23) |
| **T-E2** Whitebox-Kontext | Enthält die Whitebox, was sich tatsächlich ändert? | `rig/minimal-whitebox` (`measure.mjs`), Ground Truth aus dem git-Diff; Spike context-sufficiency | 100 % der geänderten Knoten in W bei \|W\|/\|G\| ≤ 0,05 | W trifft 100 % mit 1 824 Token, die Injektion 42 % mit 2 234 (2026-08-18); ein Bündel von ~667 Token genügt einem 27B-Modell für 5/5 Kriterien (2026-06-26, 1 Knoten) |
| **T-E3** Lokal ≈ Frontier (Modell) | Nivelliert der Graph den Modellunterschied beim Autorieren? | `rig/greenfield-systemtest`, Arme `gcrun` (lokal, unser Executor) / `opus5` (Frontier, Claude Code). Das ist der Produktvergleich: Modell **und** Treiber verschieden, gewollt, Korpus sigllm-Prosa | Die Spannen von T-V3, T-M1, T-M2 überlappen bei N ≥ 3 | Runde 20 (40 Runden): lokal 91 Elemente, Frontier 187 — unausgewertet, nicht committet, Kosten nicht erfasst. Frühere Rankings zurückgezogen (Truncation-Fehler, Executor-Abschlussbericht) |
| **T-E4** Lokal ≈ Frontier (Code) | Dasselbe für Code? | `rig/code-test` mit lokalem Arm | Abnahme gleich, Kennzahlen aus T-C1 in überlappender Spanne | nicht gefahren |
| **T-E5** Normalisierte Effizienz | Ist die geführte Lieferung billiger als die freie? | Faustregel §9.2 auf `rig/code-test` | `K_geführt ≤ K_frei` bei gleicher Abnahme | **≈ 3,5× teurer** (2,7–4,3×, 2026-09-23) |
| **T-E6** Kipppunkt des Kontexts | Ab welcher Kürzung fällt die Ausbeute? | Executor-Rig, ≥ 3 Stufen der Promptgröße, getrennt nach „Redundanz" und „tragender Inhalt", N ≥ 3 | Kurve mit dem Punkt, an dem Menge oder Readiness die Streuung verlässt | zwei Stützpunkte: Redundanz −34 % hält die Qualität (CR-GC-650/651), tragenden Inhalt streichen kostet 82 → 22 Elemente (CR-GC-282); keine Kurve |
| **T-E7** Testauswahl | Sagt der Graph, welche Tests laufen müssen? | `graph_tests` / `impactedTests()`; `scripts/test-selection-audit.mjs` (CR-GC-381); Spike selective-tests (CR-GC-380) | direkt gekoppelte Tests vollständig getroffen; `verify:code` fällt nur bei fehlender Bindung auf VOLL zurück | Trefferquote 13 %, Einsparpotenzial 53 % der Läufe (2026-08-21); Referenz-Change: 4 statt 172 Dateien wären möglich gewesen |
| **T-E8** Werkzeuglatenz | Ist der Graph schnell genug für die Schleife? | `tests/perf.advisory-roundtrip.spike.test.ts` (CR-GC-400/665), feste Eingabe | Runde lesen → Status → Vorschlag → Anwenden < 200 ms | Median 363 ms, davon Vorschlag 272 ms (2026-08-05); Regelauswertung wächst mit n^1,93 (2026-08-22) |
| **T-E9** Bedarf je Aufruf | Was wollte das Modell — hatte es das schon, oder hätte der Graph es geliefert? | Default in jedem Lauf: `bedarfsAnalyse` für Claude-Code-Arme (Stream, mit Cache-Lesung je Aufruf), `bedarfsAnalyseExecutor` für den Executor (`run-raw.log`, Antwortgröße in Zeichen); eingebunden in `report.mjs` (Greenfield) und `messen.mjs` (Code-Test). Ein Arm ohne Modell wird gegen das Golden gelesen. Urteile: `schon-da`, `teilweise-da` (uid stand in einer Detail-Antwort), `buendelbar` (gleiches Graph-Werkzeug im Folgeturn), `werkzeug-laden` (ToolSearch), `graph-haette` (Modelldatei gelesen, uid/realRef gesucht, Volllauf trotz gebundener Tests), beim Executor zusätzlich `je-runde` (schon in einer früheren Runde gelesen — sein Kontext beginnt jede Runde neu), sonst `neu` | Jeder vermeidbare Aufruf ist mit Grund und Kosten ausgewiesen und damit Optimierungspotenzial (Werkzeugangebot, Rundenprompt, Skill) | Code-Test geführt: 39 von 50 Aufrufen `neu`, vermeidbar 0,40 $ von 8,15 $ Delta; frei: 10/10 `neu`. Executor lokal (Runde 19, N = 3): 36–51 % der gelesenen Zeichen sind `je-runde`, fast nur der Auftrag (9–10× je Lauf). 200-Runden-Lauf: 78 % `je-runde` — `graph_elements {type:REQ}` 154×, Auftrag 178× (2026-09-25). Gegenbefund: Den Auftrag in den Rundenprompt zu legen, änderte das Nachlesen nicht (CR-GC-663/664, zurückgenommen) |

#### Optimieren (§5)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-O1** Kettenkennzahlen | Lassen sich die acht Kennzahlen deterministisch richtig rechnen? | Referenzkette „Zahlung auslösen"; `scripts/spike-kettenkennzahlen.mjs` über 12 Familiengraphen | Referenzkette: Länge 6, synchron 5, Modulgrenzen 2, geteilte Knoten 1 (Banking bestanden, Social Media verletzt); ≥ 90 % der Ketten auswertbar | Spike: 5/8 Kennzahlen rechenbar, 32/76 Ketten auswertbar; ob sie mehr sagen als ℝ⁶, ist nicht entscheidbar (2026-09-25, nicht committet) |
| **T-O2** Profil auf der Kette | Wird jede profilierte FCHAIN bewertet und diagnostiziert? | NFR-REQ an FCHAIN; Bewertung mit Diagnose + Handlungsklasse; Divergenz zweier Zielprofile (CR-GC-430) | 100 % der profilierten FCHAINs bewertet; jede Verletzung mit treibendem Knoten und ≥ 1 zulässiger Handlungsklasse | Kettenbewertung nicht implementiert. Zielprofile steuern in verschiedene Richtungen (GO), aber der veröffentlichte `score` hat das falsche Vorzeichen (2026-08-26) |
| **T-O3** Degradationsschutz | Hält ein Optimierungszug die Invarianten? | Gate-dryRun vor/nach dem Zug; Prognose im CR | jede REQ behält `satisfy`; MT-02/CR-01 bleiben unter Schwelle; Prognose erfüllt | nicht implementiert |
| **T-O4** Vorzeichen der Architekturkennzahl | Rankt die Kennzahl bekannt bessere Zustände höher? | Positivkontrolle `rig/moneyflow-struktur --structure`; Known-Answer-Set `scripts/known-answer-set.mjs` (CR-SM-281) mit rekursiver und lexikographischer Variante; Archetyp-D7 (CR-GC-438); Ebenen-Konformanz (CR-GC-408) | Known-Answer-Set richtig gerankt; keine Dimension mit Gewicht ≥ 1 meldet beim bestätigten Zug eine Regression | **No-Go** über alle Varianten: moneyflow 5,33 > graphcode 5,24; rekursiv No-Go; lexikographisch widerlegt; D7 ohne eigene Dimension (R² 0,89); Ebenen-Konformanz trennt nicht (Δ 0,000). Konvergenz-Zeuge (CR-GC-407): ℝ⁶ bewegt sich bei 16 verstoßschließenden Zügen kein einziges Mal. Das ist erwartbar, weil Vollständigkeit keine Architektur ist, zeigt aber: ℝ⁶ taugt nicht als Fortschrittsanzeige. moneyflow-Zug: 3/6 Dimensionen melden Regression. Nachfolger Chebyshev (CR-SM-291) meldet GO — nicht nachgeprüft |
| **T-O5** Umbauzüge | Verbessert ein Umbauzug den Schnitt messbar? | `tests/arch.optimization-dry-run.spike.test.ts` (CR-GC-436), echtes Gate | Modularität Q und Innenanteil steigen | Verschieben **No-Go**: Innenanteil nur 17,2 → 19,6 %, deklariertes Q −0,016 gegen natürliches 0,595. Verträge konsolidieren: **GO** (2026-08-26) |
| **T-O6** Parallele Pfade finden | Findet das System Duplikate zum Zusammenlegen? | `scripts/spike-nd-known-answer.mjs` (CR-GC-542); `scripts/spike-engpass-known-answer.mjs` (CR-GC-637), 7 bekannte Paare | ≥ 6/7 bekannte Paare gefunden | Ähnlichkeit (ND-01): **0/7**. Gemeinsamer Engpass auf Dateiebene: **6/7**, auf Symbolebene 2/7 (2026-09-24) |
| **T-O7** Inhaltliche Analysen | Sind IRR/FMEA gelaufen und in Modell und Code wirksam? | Skills `se-irr`, `se-fmea`; Prüfliste im Rig | Analyse-Artefakt vorhanden; jeder Befund als REQ/TEST oder benannte Ausnahme; FMEA-Risiken am Code als Prüffragen beantwortet | sigllm Lauf 1: 0 von 5 Analysen (2026-09-19) |

#### Code (§6)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-C1** Geführt gegen frei | Baut geführtes Claude Code besseren Code als freies? | `rig/code-test` (Scheduler-Scheibe, verdeckte Abnahme mit 15 Tests); `messen.mjs`: Abnahme, `import-code`-Steuerwert, Code-Maße, RC-Urteil; dazu menschliche Durchsicht | Abnahme geführt ≥ frei; Schnitt nach Kennzahl **und** Durchsicht besser; geführt `kongruent`; N ≥ 3 | 15/15 in beiden Armen; der freie Arm hat den besseren Modulschnitt (4 Module gegen 1); `gefuehrt-2` `kongruent` (2026-09-23), `gefuehrt-0` mit heutigem Regelstand nachgemessen: `gedriftet`, Scheibe 4/5 gebunden (2026-09-25). Offene Messfehler: Der Steuerwert belohnt weniger Verträge (ITEM-2026-483), `messen.mjs` las die Saat (ITEM-2026-509) |
| **T-C2** Greenfield bis Code | Endet ein Auto-Lauf in gebundenem Code? | `rig/greenfield-systemtest`, Phase 2 | Bindungsquote > 0, Code-Urteil ≠ `nicht prüfbar` | Bindung 0 % in allen Runden 13–20 |
| **T-C3** Umbau am Bestand | Läuft ein Umbau über den Graphen? | `rig/referenz-change` (CR-GC-630/631), `golden/endzustand.md`, `gegenprobe.mjs` | Endzustand erreicht; `graph_impact` vor dem Löschzug; `graph_tests` statt Volllauf (≤ 1 VOLL) | Grundlinie: 0 Graph-Lesezugriffe, 3 Vollläufe statt 4 Testdateien (2026-09-23); Wiederholung nach `se-umbau` nicht gefahren |

#### Familie (§7)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-F1** Rig-Betrieb | Ist jeder Test reproduzierbar gefahren und ausgewertet? | Bestand §9.5 gegen `rig/README.md` | jedes Rig läuft, stempelt, hat eine committete Auswertung und ist einem T-… zugeordnet | nicht committet: Runde 20 (4 Dateien), `spike-kettenkennzahlen.mjs`, Architektur-Guide. `kennzahlen.mjs` steht seit 2026-09-16. `code-test`-Läufe liegen außerhalb des Repos. `plan-step`, `flow-cardinality`, `import-doc-live` haben kein README |
| **T-F2** Selbstanwendung | Besteht graphcode seine eigenen Tests? | T-V1…T-V4 auf `docs/graph/graphcode.graph.json` | alle bestanden oder benannte Ausnahme | nicht als Gesamtlauf erhoben |

#### Hygiene (Voraussetzung, kein Claim-Nachweis)

| Test | Frage | Aufbau | Kriterium | Stand |
|---|---|---|---|---|
| **T-H1** Verdiente Null | Sind 0 Errors echt, oder wurde die Regel gar nicht gefragt? | `rules_evaluate` + Liste der nicht ausgewerteten Regeln + Prüfliste der Analysen | 0 Errors **und** alle vorgesehenen Regeln/Analysen ausgewertet | sigllm Lauf 1: 0 Errors bei 0 von 5 Analysen (ITEM-2026-341) |
| **T-H2** Regel-Matrix | Stimmt die Grammatik-SSOT mit dem Katalog? | `scripts/regel-matrix.mjs` → `docs/research/regel-matrix.md`; Smeagol-Check `tests/skill-rule-ids.test.ts`, `tests/policy-herkunft.test.ts` | jede Regel steht in der Matrix, jede genannte ID existiert | 73 Regeln, 5 blocken, 11 mit Fix-Vorlage (2026-09-23); RC-08/09 fehlen in der Matrix, und kein Test prüft, ob sie aktuell ist |
| **T-H3** Messinstrumente | Messen die Instrumente selbst richtig? | `tests/rig-measured.test.ts`, `systemtest-rig.test.ts`, `steering.measurement-path.test.ts`, `skill-report-measured.test.ts`, `claims.conformance.test.ts`, `import-boundaries.test.ts` | grün in der VOLL-Lane | grün (Dauertests) |

### 9.4 Setting der Rigs

Jedes Rig hat eine **Aufgabe** (was der Arm bekommt), eine **Referenz** (wogegen gewertet wird,
nie Material des Arms) und **Arme**, die sich in genau einer Achse unterscheiden. Referenzen sind
eingefroren; ein Benchmark, dessen Eingabe weiterläuft, misst nichts.

#### Aufgaben und Referenzen

| Rig | Aufgabe (Input des Arms) | Referenz | Arme | Kosten je Lauf |
|---|---|---|---|---|
| Greenfield · Korpus **sigllm-prosa** | `material-prosa/auftrag.md`: SIG Local als Prosa, ohne Kennungen und Zerlegung; Saat = ein SYS-Knoten | Golden `sigllm-v98.graph.json` (handgeführt, Ende der Spezifikation: 255 Elemente / 506 Traces) + Prüfliste `anforderungen-auftrag.json` | `gcrun` (lokal, Executor) · `opus5` (Opus, Claude Code) | lokal 0 $, ~3–4 min; Opus 18–26 $ |
| Greenfield · Korpus **sigllm-spezifikation** | Projektdefinition (245 Zeilen, **mit** Systemzerlegung und Akteuren) | dasselbe Golden | wie oben | wie oben |
| Greenfield · Default **graphcode-webapp** | `prompt.txt`: „Web-App mit Multiuser aus dem Harness, sigloch-Module maximal nutzen" | keine (kein Golden, kein Abgleich) | wie oben | wie oben |
| Code-Test | `aufgabe.md` + `vertrag/contract.ts`: Scheduler der Nachtaufträge (Termine, Nachholen, nie zweimal, Neustart …) | verdeckte Abnahme mit 15 Tests; `referenz/` belegt Erfüllbarkeit (15/15) und Trennschärfe (ohne Persistenz 11/15) | `gefuehrt` (Claude Code + graphcode + Golden) · `frei` (Claude Code allein), beide Opus 5 | gefuehrt ~10–11 $, frei ~2,3 $ |
| Referenz-Change | `aufgabe.md`: `GraphCodeCodec` entfernen, keine parallelen Pfade (CR-GC-630/631, Stand `d1285ef^`) | `golden/endzustand.md` (Code-Proben, bytegleiches Format-E, RC-01 sauber, VOLL grün) + `gegenprobe.mjs` | eine Claude-Code-Sitzung | eine Sitzung (Grundlinie: 131 Werkzeugaufrufe, 3 Vollläufe) |
| Minimal-Whitebox | Jobs aus abgeschlossenen CRs: J1 (1 Knoten), J2a/J2b (CR-große Jobs), A3a–c (Autorieren) | Ground Truth = Knoten, die der Schluss-Commit laut git-Diff tatsächlich änderte | Phase 1 deterministisch (A0/A/B); Arm C lokal: `full` / `whitebox` / `off` / `pull` | Phase 1: 0 $, Sekunden; Arm C lokal 0 $ |
| moneyflow-Struktur | moneyflow-Graph (1229 Elemente, 306 flache Wurzel-FUNC) durchs echte Gate strukturieren | bestätigter Strukturierungszug (Autor + Regeln) = Positivkontrolle | Baseline · `--propose` · `--structure --apply` | 0 $, deterministisch |
| dummy-slicer | `FN-slice` aus dem `graph_context`-Bündel implementieren; `docs/SPEC.md` ist die Falle (veraltet, falsch) | Referenzimplementierung `spikes/score.ts` | Arm B (Hook blockt SPEC) · Arm C (lokales Modell) | 0 $ lokal |
| Korpus `rig/graphs/` | — (Eingabe für Rang- und Kennzahlfragen) | vier eingefrorene Graphen mit sha256, Bindung 0 % … 92 % (bok, graph-view-edit, graphcode, moneyflow) + gc_test-graphview | — | 0 $ |
| Known-Answer-Sets | — | ℝ⁶: git-Zustandspaare „bekannt besser" + Negativkontrolle moneyflow; ND/Engpass: 7 bekannte Duplikat-Paare; Kette: „Zahlung auslösen" | — | 0 $ |

#### Standard-Set

Drei Stufen, nach Kosten. Das Standard-Set ist die Regression: dieselbe Aufgabe, dieselbe
Referenz, derselbe Stempel — ein Unterschied zum letzten Lauf ist dann eine Wirkung der Änderung.

| Stufe | Wann | Umfang | Deckt |
|---|---|---|---|
| **S1 deterministisch** | jede Änderung an Regeln, Policy, Messung; vor jedem Release | Minimal-Whitebox Phase 1 · moneyflow-Struktur (Baseline + `--structure`) · Grenzmenge · Randbreiten · Known-Answer-Sets (ℝ⁶, ND, Engpass) · Nachweis-History · Regel-Matrix · Perf-Test · KPI 1 (läuft automatisch) | T-V1, T-V2, T-V4, T-M3, T-M4, T-E1, T-E2, T-E8, T-O4, T-O6, T-H2 |
| **S2 lokal** | jede Änderung am Executor, an Prompt, Werkzeugangebot oder Steuerung | Greenfield `gcrun` auf **sigllm-prosa**, N = 3, 12 Runden (`lauf-gcrun.env`) | T-V3, T-M1, T-M2, T-E3 (lokale Hälfte), T-E6, T-E9 |
| **S3 Frontier** | auf Anlass: Release, Claim-Aussage nach außen, Richtungsentscheidung | Greenfield `opus5` auf sigllm-prosa (N = 1) · Code-Test `gefuehrt` + `frei` · Referenz-Change | T-C1, T-C3, T-E3 (Frontier-Hälfte), T-E5, T-E9, T-M5 |

S1 und S2 kosten nichts und laufen oft. S3 kostet je Durchgang rund 40–50 $ plus eine Sitzung;
eine Aussage aus S3 mit n = 1 ist eine Spanne, kein Urteil (§9.1).

#### Spezifische Vergleiche

Ein Vergleich gilt nur zwischen Armen, die sich in **genau einer** Achse unterscheiden
(`ARM_ACHSEN` in `run.mjs` rechnet das aus).
Ausnahme ist der Produktvergleich lokal gegen Frontier (T-E3): Er vergleicht bewusst zwei ganze Produkte.

**Aus der Betrachtung genommen: Executor mit Frontier-Modell** (`gcrun-frontier`). Ein
Frontier-Modell leistet, was der Executor von außen erzwingt, intern besser und schneller. Das
ist zum zweiten Mal belegt (Entscheid des Autors 2026-09-25). Der Executor ist das Werkzeug für
lokale Modelle; ein Frontier-Arm läuft nativ in Claude Code.

| Frage | Arm gegen Arm | die eine Achse | Test |
|---|---|---|---|
| Ist lokal mit unserem Executor so gut wie Frontier? | `gcrun` ↔ `opus5` | Modell + Treiber (Produktvergleich) | T-E3 |
| Bringt graphcode besseren Code? | Code-Test `gefuehrt` ↔ `frei` | Werkzeug + Modell | T-C1, T-E5 |
| Muss die Struktur im Auftrag stehen? | Korpus sigllm-spezifikation ↔ sigllm-prosa | Input-Struktur | T-V3 |
| Push oder Pull beim Kontext? | Minimal-Whitebox `full` ↔ `whitebox` ↔ `off` ↔ `pull` | Injektion | T-E2, T-E6 |
| Wie viel Prompt braucht der Executor? | S2 vor ↔ nach einer Prompt-Änderung (Serie CR-GC-650…664) | Promptinhalt | T-E6 |
| Hilft die Gate-Probe (dryRun)? | `GCRUN_CANDIDATES` 1 ↔ 2 (CR-GC-568) | Kandidatenzahl | T-M2 |
| Wie viel kostet Wiederlesen? | Rewind-Lauf ↔ Normallauf (halbe Turns) | Turn-Zahl | T-E5 |
| Rankt eine Kennzahl richtig — auch bei schlechter Bindung? | Korpus `rig/graphs/` (Bindung 0 % … 92 %) | Graph | T-O4 |
| Nutzt der Agent den Graphen beim Umbau? | Referenz-Change ↔ Wiederholung nach einer Skill-/Werkzeugänderung | Führung | T-E1, T-C3 |

### 9.5 Bestand der Messaufbauten

Jeder Aufbau zahlt auf genau die Tests ein, die in der Tabelle stehen. Aufbauten ohne
Test-Zuordnung sind Kandidaten zum Entfernen.

| Aufbau | Pfad | Art | Test | Status |
|---|---|---|---|---|
| Greenfield-Systemtest | `rig/greenfield-systemtest/` (+ `steuerung`, `trajektorie`, `turn-analyse`, `schatten-suggest`) | Rig, Serie | T-V3, T-M2, T-M5, T-E3, T-C2 | läuft; Runde 20 unausgewertet |
| sigllm-Spezifikation | `rig/sigllm-spezifikation/` | Korpus für Greenfield | T-V3, T-V4, T-O7, T-H1 | ausgewertet (`ergebnis.md`) |
| Code-Test | `rig/code-test/` | Rig, 2 Arme | T-C1, T-E4, T-E5 | läuft; Läufe außerhalb des Repos |
| Referenz-Change | `rig/referenz-change/` | Rig, Sitzungsprotokoll | T-E1, T-C3 | nur die Grundlinie |
| Minimal-Whitebox | `rig/minimal-whitebox/` | Rig + Spike | T-E2, T-E6 | ausgewertet |
| moneyflow-Struktur | `rig/moneyflow-struktur/` | Rig, Gate | T-V1, T-V2, T-O4 | ausgewertet |
| dummy-slicer / context-sufficiency | `rig/dummy-slicer/` | Rig, Spike | T-E2 | ausgewertet (2026-06) |
| Executor-Programm | `docs/executor-abschlussbericht.md` | Serie | T-E3, T-E6 | abgeschlossen, Rankings zurückgezogen |
| sigllm-Fremdlauf | `bok/docs/research/fremdlauf-sigllm-2026-09.md` | Replay | T-M1, T-M5, T-V4 | ausgewertet |
| KPI 1 je CR | `scripts/retro-kpi.mjs`, `scripts/cr-messung.mjs` | Dauermessung | T-E1 | läuft nach jedem Commit |
| Bedarfsanalyse + Turn-Bilanz | `rig/greenfield-systemtest/turn-analyse.mjs` (`bedarfsAnalyse`, `bedarfsAnalyseExecutor`, `lesenJeAusloeser`), eingebunden in `report.mjs` und `rig/code-test/messen.mjs` | Default-Auswertung jedes Laufs (Stream oder Executor-Spur) | T-E1, T-E5, T-E9 | läuft |
| Grenzmenge | `scripts/grenzmenge.mjs` | Skript | T-V4 | läuft |
| Randbreiten | `scripts/randbreiten.mjs` | Skript + Test | T-V2 | läuft |
| Nachweis-History | `scripts/spike-nachweis-history.mjs` | Spike | T-M3 | GO |
| Steuer-Kausalität | `tests/steering.steer-causality.test.ts` | Dauertest | T-M4 | grün |
| Konvergenz-Zeuge | `tests/steering.convergence-witness.spike.test.ts` | Spike-Test | T-O4 | No-Go (ℝ⁶ blind für Vollständigkeitszüge) |
| Hint-Konformanz | `scripts/spike-hint-konformanz.mjs` | Spike | T-M5 | nicht messbar |
| Zugverlauf | `scripts/zugverlauf.mjs` | Skript + Test | T-M2 | läuft |
| Kennzahlen-Verlauf | `scripts/kennzahlen.mjs` → `docs/kennzahlen.md` | Skript | T-O4 | seit 2026-09-16 nicht gepflegt |
| Selektive Tests / Testauswahl-Audit | `docs/spikes/SPIKE-GC-selective-tests.md`, `scripts/test-selection-audit.mjs` | Spike + Skript | T-E7 | aktuelle Zahl fehlt |
| Advisory-Latenz | `tests/perf.advisory-roundtrip.spike.test.ts` | Dauertest | T-E8 | läuft |
| Batch-Seed-Perf | `tests/perf.batch-seed.test.ts` | Dauertest | T-E8 | aktuelle Zahl fehlt |
| Kettenkennzahlen | `scripts/spike-kettenkennzahlen.mjs` | Spike | T-O1 | nicht committet |
| Zielprofil-Divergenz | CR-GC-430 | Spike | T-O2 | GO mit Vorzeichenfehler |
| Known-Answer-Set ℝ⁶ (+ rekursiv, lexikographisch) | `scripts/known-answer-set.mjs`, `spike-rekursive-metrik.mjs`, `spike-lexikographisch.mjs` | Spikes | T-O4 | No-Go / widerlegt |
| Archetyp-D7 | `scripts/spike-archetype-eigenvector.mjs` | Spike | T-O4 | No-Go |
| Ebenen-Konformanz | `scripts/spike-ebenen-konformanz.mjs` | Spike | T-O4 | No-Go |
| Architektur-Trockenübung | `tests/arch.optimization-dry-run.spike.test.ts` | Spike-Test | T-O5 | Verschieben No-Go, Konsolidieren GO |
| Repository-Stil | `scripts/spike-repository-style.mjs` | Spike | T-O5 | M2 ableitbar, M3 → Konzept-CR |
| ND- / Engpass-Known-Answer | `scripts/spike-nd-known-answer.mjs`, `spike-engpass-known-answer.mjs` | Spikes | T-O6 | ND 0/7, Engpass 6/7 |
| Blackbox-Regeln L1/L2 | `scripts/spike-blackbox-regeln.mjs` | Spike | T-V1 | GO, umgesetzt |
| Abstraktionsebenen | `docs/spikes/SPIKE-GC-abstraction-levels*.md` | Spike | T-V1 | nur qualitativ |
| Kaltstart test_karp | CR-GC-485 | Einzellauf | T-V3, T-M2 | ausgewertet |
| import-doc-live | CR-GC-337 | Einzellauf | T-V3 | ausgewertet, kein README |
| flow-cardinality | `rig/flow-cardinality/` | Skripte | T-V2 | kein README |
| plan-step | `rig/plan-step/` | Modellstand | — | keine Messung, Kandidat zum Entfernen |
| Regel-Matrix | `scripts/regel-matrix.mjs` | Generator | T-H2 | läuft |

---

## Woran wir uns verlaufen

Views optimieren → triggert Regeln → triggert Methode → triggert Steuerung — der Kreis ohne
Anker. Der Anker ist das übergeordnete Ziel: **guter Code und gute Code-Architektur** (§6 und §8).
Eine Diskussion, die keinen Test aus §9 bewegt, zahlt auf keinen Claim ein.

Ziel-Architektur: [`aise-family-architecture.md`](../konzept/aise-family-architecture.md).
