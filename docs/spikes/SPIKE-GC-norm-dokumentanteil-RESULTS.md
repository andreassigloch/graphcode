# SPIKE-GC-norm-dokumentanteil — Ergebnis

**Stand:** 2026-09-26 · Frage und Methode: [`SPIKE-GC-norm-dokumentanteil.md`](SPIKE-GC-norm-dokumentanteil.md)
**Modellstand:** `docs/graph/graphcode.graph.json`, graphVersion 489

## Kurzfassung

Keine der drei Normen verlangt ein Dokument um seiner selbst willen. **Nur ISO/IEC/IEEE 29148**
kennt eine Konformität zum Inhalt von Informationsobjekten (Kl. 4.4). **ISO/IEC/IEEE 15288**
schreibt Outcomes vor, keine Dokumente. **Automotive SPICE 4.0** nutzt Informationsobjekte nur als
Indikatoren für den Assessor („shall not be interpreted as a required structure", PAM 4.0 Kap. 3.3).

Von den **zehn Klassen dokument-belegbarer Anforderungen** belegt graphcode heute **3 voll und 6
teilweise**; eine braucht menschliches Urteil. Alles Übrige ist Prozess: Einigung, Kommunikation,
Planung und Steuerung, Capability Level ≥ 2. Das ist mit keinem Dokument zu belegen, auch nicht
mit einem erzeugten.

Der tragende Unterschied zu frei erzeugter Dokumentation: graphcode belegt Traceability und einen
Teil der Konsistenz **deterministisch aus demselben Modell**, aus dem die Dokumente gerendert werden.
Ein frei laufendes Modell kann Dokumente schreiben, aber nicht nachweisen, dass ihre Links stimmen
und über Änderungen hinweg stimmen bleiben.

## Quellen

| Norm | geprüft | Fundstelle |
|---|---|---|
| Automotive SPICE PAM 4.0 (VDA QMC, 2023) | Volltext | vda-qmc.de, `Automotive-SPICE-PAM-v40.pdf`; alle Informationsobjekt-IDs gegen Annex B geprüft |
| ISO/IEC/IEEE 29148:2018 | Volltext | offiziell: ieeexplore.ieee.org/document/8559686 · iso.org std:72089 |
| ISO/IEC/IEEE 15288:2023 | nur Leseprobe (Inhaltsverzeichnis, Kl. 1, 3) | iso.org, Leseprobe über standards.iteh.ai |
| ISO/IEC/IEEE 15289:2019 | nur Leseprobe | dito |

**Nicht verifiziert:** der Outcome-Wortlaut von 15288:2023 (zitiert ist der von 2015, wie ihn
29148 wiedergibt); eine an 15288:2023 angepasste 15289-Revision; PAM 4.1 (laut Suche 2026-08
erschienen). Die A-SPICE-Evaluation vom 2026-08-05 (CR-GC-301) lief noch gegen 3.1.

## Was die Normen an Dokumentinhalt verlangen

- **29148:** Pflicht-Informationsobjekte BRS, StRS, SyRS, bei Softwareanteil SRS (Kl. 7), OpsCon
  normativ (Annex A), ConOps informativ (Annex B), je mit Gliederung (Kl. 9). Eigenschaften
  einzelner Anforderungen (5.2.5) und der Menge (5.2.6, u. a. frei von TBD/TBS/TBR), zu meidende
  Formulierungen (5.2.7), Attribute (5.2.8: Identifikation, Version, Owner, Priorität, Risiko,
  Rationale, Schwierigkeit, Typ), Traceability nach oben und unten bis zu Verifikationsobjekten
  (6.4.3.5, Nachweisform RTM). Informationsobjekte dürfen im Repository oder Modell liegen und
  müssen nicht physisch gedruckt sein (Kl. 4.4 Note 2, Kl. 7).
- **15288:** Outcomes wie „traceability … is established", „system architecture … is defined",
  „verification results … are available". Inhalte von Informationsobjekten regelt 15289
  (Description, Plan, Report, Specification, Request …; u. a. SyRS 10.60, Architekturbeschreibung
  10.58, Schnittstellenbeschreibung 10.28, Verifikationsplan/-bericht 10.72–10.74).
- **A-SPICE 4.0:** je Engineering-Prozess (SYS.1–5, SWE.1–6) eine Base Practice „ensure consistency
  and establish bidirectional traceability" mit dem Zusatz, dass Links allein keine Konsistenz
  beweisen. Consistency Evidence (13-51) hat zwei Teile: (a) Links — erzeugbar, (b) Nachweis
  inhaltlicher Übereinstimmung durch Review, Stichprobe, Änderungshistorie — Prozess. Communication
  Evidence (13-52) ist reine Prozessspur.

## Abgleich: dokument-belegbare Anforderungen gegen graphcode

| # | Anforderungsklasse | Norm | erzeugte Sicht | prüfende Regel | heute |
|---|---|---|---|---|---|
| 1 | Pflicht-Informationsobjekte + Gliederung | 29148 Kl. 7/9, Annex A | `srs` (SyRS/SRS-Anteil), `conops` (OpsCon-Anteil) | — (Gliederung nicht geprüft) | **teilweise:** SyRS/SRS und OpsCon in eigener Gliederung; BRS und StRS fehlen; Abschnitte wie Usability, Physical, Environmental, Sustainment der SyRS nicht als Gliederung |
| 2 | Syntaktische Anforderungsqualität | 29148 5.2.5–5.2.7 | — | BQ-01 Unambiguous, BQ-02 Verifiable, BQ-06 Conforming, BQ-07 Complete | **teilweise:** Regeln vorhanden, nur steuernd (Warnung); die Wortliste aus 5.2.7 ist nicht als Lint nachgewiesen |
| 3 | Semantische Anforderungsqualität | 29148 5.2.5/5.2.6 | — | BQ-04 Necessary (Heuristik) | **nein:** braucht Urteil; kein Dokument-Claim |
| 4 | Anforderungsattribute | 29148 5.2.8; A-SPICE 17-54 | `rtm`, `srs` | — | **teilweise:** ID (stabile uid), Typ (`kinds`), Status, Zeitstempel; Version über graphVersion und Audit-Trail; **Owner, Priorität, Risiko, Rationale fehlen** |
| 5 | Traceability-Links + Abdeckung | 29148 6.4.3.5; 15288; A-SPICE BP „bidirectional traceability" | `rtm`, `testmatrix` (VCRM, mit Integrationsabdeckung, CR-GC-317) | R-18 (legale Kante), R-02, R-05, UC-01, R-21 | **ja:** bidirektional aus dem Graphen, nach A-SPICE-Ebenen gruppiert |
| 6 | Konsistenz entlang der Kette | A-SPICE 13-51 (a)+(b) | `rtm`, `testmatrix`, `changelog` | RC-01…RC-09 (Modell ↔ Code), R-19/R-20 (Bindung) | **teilweise:** (a) ja; (b) deterministisch für Modell ↔ Code (realRef löst auf, SCHEMA exportiert, Parse am Interface), Audit-Trail als Änderungshistorie; inhaltliche Übereinstimmung von Anforderungstexten bleibt Review |
| 7 | Architektur- und Designinhalt | 15288; 15289 10.28/10.58; A-SPICE 04-06, 04-04 | `architecture` (Allokation), `icd` (Zod-Verträge, Flüsse), `trade` (Entscheidungen) | R-04, BW-02, CR-01, MT-02 | **teilweise:** statische Sicht und Schnittstellen ja; dynamisches Verhalten nur als Wirkkette (FCHAIN), keine Zustands- oder Sequenzsicht |
| 8 | Spezifikation der Verifikationsmaßnahmen | A-SPICE 08-60, 08-58; 15289 10.72/10.73 | `testconcept`, `intplan`, `testmatrix` | R-05, R-19, R-21 | **teilweise:** TEST mit Methode, Ebene, Werkzeug, Bindung; Auswahlmenge (08-58) über `graph_tests`; Entry/Exit-Kriterien und Umgebung fehlen |
| 9 | Verifikationsergebnisse | A-SPICE 15-52; 15288 Verification | `testmatrix` | VR-01 (Ergebnis fehlt) | **ja:** aus echten Läufen über `graph_test_ingest` — 118 von 134 TEST gebunden, 119 passed, 1 failed |
| 10 | Traceability Änderung ↔ Arbeitsergebnis | A-SPICE SUP.10 BP4 | `changelog`, `cr-list`, `implplan` | CR-Knoten mit `relation`-Kanten, Status aus dem Verzeichnis | **ja** für CR ↔ betroffene Elemente; CR ↔ Problem nur über Items |

**Ergebnis: 3 von 10 ja, 6 teilweise, 1 nein.**

## Was kein Dokument belegen kann (außerhalb des Claims)

- Einigung und Abstimmung mit Stakeholdern (29148/15288 „agreement is achieved", A-SPICE SYS.1).
- Kommunikation (A-SPICE „communicate …", 13-52).
- Durchführung von Planung, Steuerung, Risiko-, Qualitäts- und Konfigurationsmanagement
  (15288 Kl. 6.3; MAN.3/5, SUP.1/8/9) — ein Dokument ist dort höchstens eine Momentaufnahme.
- Capability Level ≥ 2 (PA 2.1/2.2): Prozessmanagement. Ein erzeugtes Dokument kann Eingabe für
  GP 2.2.1 sein, nicht der Nachweis.
- 15288-Konformität allgemein: ein Dokument ist Evidenz für ein Outcome, kein Ersatz dafür.

## Gegenprobe: frei laufendes Frontier-Modell

Im Code-Test (2026-09-22/23) lieferte der freie Arm Code (10 Dateien), 62 eigene Tests und ein
README — keine Anforderungs-IDs, keine Trace-Links, keine Verifikationszuordnung. Aus seinen
Artefakten sind die Klassen 1, 4, 5, 6, 8, 9 und 10 damit **nicht deterministisch** belegbar.

Ob ein freies Modell sie liefern kann, wenn man es ausdrücklich beauftragt, ist **nicht gemessen**.
Die These des Autors: nein, denn Links in frei geschriebenem Text sind Behauptungen ohne Prüfer,
und ihre Stimmigkeit überlebt die nächste Änderung nicht. Der Test dafür steht in der Leitlinie
(T-N3).
