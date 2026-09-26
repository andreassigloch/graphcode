# Modellphilosophie

**Stand:** 2026-08-24 · destilliert aus der Grundsatzdiskussion vom selben Tag (Messungen: Anhang C).
Offene Nachweise: CR-GC-407 (Konvergenz-Zeuge), CR-GC-408 (Ebenen-Gummiband) — beide Spikes.

## 1. Die einfachste Erklärung

Das Modell ist nicht der Code. Es ist die Antwort, die ein guter Analyst auf *„erklär mir dieses
System"* geben würde — festgehalten als Graph statt als Prosa, damit sie prüfbar, abfragbar und
steuerbar wird. Modellieren ist Analysieren, invertiert: vom Groben ins Feine.

Vier Sätze tragen alles:

1. **Drei Fragen, drei Sichten.** Wozu (Use-Case-Baum) · Wie (Funktionsbaum) · Womit
   (Modul-/Stack-Baum) — im Viewer benannt nach Arcadia: Operational · Functional · Physical.
   Eine Sicht ist eine Projektion desselben Graphen, nie eine Kopie.
2. **Verhalten ist ein Netz, kein Baum.** Wirkketten (FCHAIN) laufen quer durch die Äste.
   Die oberste Ebene ist nur dann eine treue Zusammenfassung, wenn sie neben dem Baum die
   Querflüsse zwischen den Blöcken mitzeigt.
3. **Detail detailliert das Konzept — und darf es nicht *still* verletzen.** Anpassung nach oben
   ist ausdrücklich legitim (Detail-Erkenntnis revidiert Konzepte); aber der Konflikt muss
   sichtbar werden, und die Entscheidung geht geloggt durchs Gate.
4. **Regeln sind Signale, keine Ziele.** Jede Metrik ist eine Ein-Parameter-Sicht; die globale
   Abwägung trifft der Mensch, und *die Abwägung selbst* gehört in den Graph — als
   Entscheidungs-Relation (`relation decides`, Trade-Study-Muster) — sonst „repariert" der
   nächste Agent die bewusste Ausnahme. Steuerung ist ein Gummiband:
   sanfter Zug über Zieldimensionen, nie ein Hard-Gate.

## 2. Wo wir mit dem Stand der Kunst übereinstimmen

| Prinzip bei uns | Quelle (Anhang A) |
|---|---|
| Modell verkürzt und ist zweckrelativ, nie 1:1 | Stachowiak (Verkürzungs- + pragmatisches Merkmal); MDE-Empirie: 1:1-Sync ist der Killer |
| Wozu/Wie/Womit-Triade | Rasmussen (means-ends), Gero (FBS), Arcadia (operational/functional/physical) |
| Verhalten als Netz neben dem Baum | Alexander (Semilattice), SysML (Blockdefinitions- vs. internes Blockdiagramm, bdd/ibd) |
| Zusammenfassbarkeit hat eine Bedingung | Simon (Near-Decomposability) — bei uns in der Hub-Form erfüllt: Querverkehr gebündelt auf wenige Schnittstellen |
| Top-Funktionen aus Use-Case-Schritten ableiten | FAS-Methode (Lamm/Weilkiens) |
| Dekomposition erst nach Lösungsentscheidung der Ebene | Suh, Axiomatic Design (Zigzag) |
| Rekursion pro Systemebene, Rückiteration bei Konflikt | Arcadia, ISO 15288/29148, VDI 2206 |
| Fertig = gewählter Pareto-Punkt, Wahl durch Gewichte von oben | Multi-Objective-Optimierung; sechsdimensionales Zielprofil |
| Graph als Agenten-Substrat (Query statt grep) | RPG/RepoGraph/LocAgent-Forschung 2025 |

## 3. Wo wir explizit abweichen — und warum

**3.1 Gummiband statt Ebenen-Zwang (vs. Arcadia/Capella).** Arcadia verriegelt die
Ebenenübergänge methodisch; bei uns darf der Kunde Ebenen und Reihenfolgen überspringen. Ein
Ebenen-Konformanz-Signal zieht als Empfehlung Richtung guter Spec — über die Reifegrad-Messung
(Readiness) und das Vorschlags-Ranking (`graph_next_step`) — es blockt nie. Gründe: unsere Nutzer sind Agenten und Menschen in iterativen Sessions,
nicht Systemhäuser mit Prozesshoheit; Hard-Gates erzeugen Umgehung oder Stillstand; und
Bottom-up-Einstiege (`import-code`, Bestandsanalyse) sind legitime Startpunkte, die ein
Ebenen-Zwang verbieten würde. Das Arcadia-*Vokabular* übernehmen wir dagegen bewusst
(Sichten-Namen operational/functional/physical, CR-GVE-255) — Begriffe ja, Übergangs-Zwang nein.
Nachweis, dass der Nudge wirkt: CR-GC-408.

**3.2 Ein Graph statt vier Modellschichten (vs. Arcadia OA/SA/LA/PA).** Arcadia hält getrennte
Modelle je Ebene mit Transitions-Traceability. Wir halten **einen** Graphen; Ebenen sind
Zerlegungstiefe (compose-Kanten), Sichten sind Projektionen. Grund: getrennte Schichten sind
parallele Pfade mit Sync-Kosten — genau die Drift, an der MDE laut Empirie scheitert. Eine
Quelle der Wahrheit (SSOT) im eingebetteten Graph-Store (Kuzu), genau ein Schreibprozess.

**3.3 Erzwingen statt Methodenhandbuch (vs. Harmony-SE/Arcadia-Prozessdisziplin).** Invarianten
leben als Engine-Regeln im Schreibtor (Apply-Gate): Kanten-Legalität (R-18), Code-/Test-Bindung
(R-19/20), Dekompositions-Qualität (RD-01..04) — nicht als Prosa, der man folgt oder nicht. Bewusste Lücke: die *semantische* Invariante („Kind bleibt
im Scope des Parents") ist deterministisch nicht prüfbar und heute nicht erzwungen —
LLM-Advisory-Kandidat, kein Regel-Parser.

**3.4 Wirkketten erster Klasse (vs. Aktivitätsdiagramm je Ebene).** Wirkketten (FCHAIN) sind
benannte Pfade *über* dem einen Datenfluss-Netz (FLOW), keine pro Ebene neu gezeichneten
Diagramme. Baum und Netz koexistieren im selben Graphen, ohne sich zu vermischen — die
Funktionszerlegung ist ein exakter Baum, das Datenfluss-Netz ist keiner (Anhang C).

**3.5 Fertig ist ein Messpunkt, kein Prozessmeilenstein (vs. Reifegrad-/Phasenmodelle).**
Optimierung endet am Pareto-Punkt, den das Zielprofil auswählt; ob eine Sitzung konvergiert oder
kreist, entscheidet ein monotoner Zeuge über der Trajektorie plus Zustands-Archiv — nicht ein
Phasen-Abnahmetermin. Ob das trägt oder nur Komplexität addiert: CR-GC-407.

**3.6 Agent-first.** Arcadia & Co. adressieren menschliche Ingenieurteams; unser Modell dient
zuerst dem Verständnis-Transfer an Coding-Agenten — präzise Graph-Abfrage statt Volltextsuche:
Blast-Radius (`graph_impact`), gezieltes Vertiefen (`graph_expand`). Die 2025er-Forschung (RPG, RepoGraph, LocAgent) bestätigt die Richtung
unabhängig: hierarchische Graph-Repräsentationen schlagen flache Kontexte bei Repo-Aufgaben.

## 4. Entscheidungsbaum der Diskussion (2026-08-24)

1. **Modell ≠ 1:1-Abbild** — bestätigt (Stachowiak, MDE-Empirie). Keine Änderung.
2. **„Oberste Ebene = 1:1 die Zusammenfassung"** — *revidiert*: nur treu als **Baum + Hub-Flows**.
   Empirisch: 0,77 der Modell-Links und 0,67 der Code-Imports sind blockübergreifend, aber auf
   Hubs konzentriert (Top-10-Paare ≈ 60 %). Und: *die* Zusammenfassung gibt es nicht — wir
   fixieren bewusst eine kanonische Projektion.
3. **„Detail darf Konzept nicht verletzen"** — *präzisiert*: nicht **still** verletzen.
   Anpassung nach oben legitim (Suh-Zigzag); Konflikt sichtbar, Entscheidung geloggt.
4. **Grenzen der Regeln** (LCOM4-Fall) — akzeptiert: bewusste Regel-Ausnahmen sind globale
   Abwägungen; sie gehören als Entscheidung in den Graph, sonst stille Verletzung in
   Gegenrichtung (Regel-Mechanik überschreibt Design-Entscheidung).
5. **Abbruchkriterium einer Optimierung** — Spiderweb-Kriterium = Pareto-Optimalität; zwei
   Lücken benannt: Front-Wahl (leistet das Zielprofil) und Schleifen-Erkennung (fehlt; nur
   Paar-Deltas vorhanden) → **Spike CR-GC-407**: skalarer Zeuge + Graph-Hash-Archiv über der
   Snapshot-Trajektorie.
6. **Benennung der drei Sichten** — Befund: der Viewer (GVE) nutzt Geros FBS-Wörter mit
   vertauschter Zuordnung (der Use-Case-Pfad heißt „Verhalten", die Funktionszerlegung
   „Funktion"). *Entschieden*: **Arcadia-Benennung** — Operational (UC) · Functional (FUNC) ·
   Physical (MOD) → **CR-GVE-255**. Wozu·Wie·Womit bleibt die Erklärsprache dieses Dokuments
   (§1), Arcadia sind die Sichten-Namen im Werkzeug.
7. **Spec-Einstieg** — Befund: gelebter Flow System → detaillierte Use Cases → Blattfunktionen
   (Leaf-FUNC), Grob-Ebene wird nachgerüstet (CR-GC-405). Ziel: Ebenen-Reife vor Tiefe
   (Use-Case-Breite → Ableitung der Top-Funktionen nach FAS → Allokations-Entscheidung je Ebene
   (Zigzag) → Tiefe je Ast), durchgesetzt als **Gummiband**, nie als Sperre →
   **Spike CR-GC-408** (Nachweis an sechs realen aise-Graphen, inkl. Kontrastfall moneyflow:
   306 Funktionen, kein einziger Use Case).

---

## Anhang A — Quellen (Theorie & Methode)

- H. Stachowiak, *Allgemeine Modelltheorie*, 1973 — Abbildungs-, Verkürzungs-, pragmatisches Merkmal.
- H. A. Simon, *The Architecture of Complexity*, 1962 — Near-Decomposability als Bedingung
  hierarchischer Zusammenfassbarkeit.
- C. Alexander, *A City is Not a Tree*, 1965 — Semilattice vs. Baum.
- J. Rasmussen, Abstraction Hierarchy (means-ends), 1985 — Zweck→Funktion→Form.
- J. Gero, *Design Prototypes: FBS*, 1990 — Function/Behaviour/Structure (Benennungsbefund §4.6).
- N. P. Suh, *Axiomatic Design*, 1990/2001 — Zigzagging FR↔DP.
- T. Weilkiens, J. G. Lamm et al., *Model-Based System Architecture* / FAS-Methode — Top-Funktionen
  aus Use-Case-Aktivitäten.
- J.-L. Voirin, *Model-based System and Architecture Engineering with Arcadia*, 2017.
- H. Hoffmann, Harmony-SE (IBM) — Iterationsschleife je Ebene.
- ISO/IEC/IEEE 15288 & 29148; VDI 2206 — Rekursion pro Systemebene, Mikro-/Makrozyklus.
- G. E. P. Box — „all models are wrong"; C. Goodhart — Metrik als Ziel hört auf zu messen.

## Anhang B — Quellen (Empirie & aktuelle Forschung)

- Hutchinson, Whittle, Rouncefield: [The State of Practice in MDE](https://www.semanticscholar.org/paper/08b64030f5a95401473710521f650ad57cd15f71) —
  MDE scheitert an 1:1-Sync, gewinnt bei Abstraktion/Generierung; Erfolg hängt an sozialen Faktoren.
- [MBE im Embedded-Bereich, Industrie-Survey](https://link.springer.com/article/10.1007/s10270-016-0523-3) (SoSyM 2016).
- [RPG: Repository Planning Graph / ZeroRepo](https://arxiv.org/pdf/2509.16198) — Capability-Baum
  (Wozu) + Implementierungsebene in einem Graphen; SOTA Repo-Generierung.
- [RepoGraph](https://arxiv.org/html/2410.14684v1) · [Code Graph Model](https://arxiv.org/pdf/2505.16901) ·
  [LocAgent](https://arxiv.org/pdf/2503.09089) — Graph-Repräsentationen verbessern
  Repo-Verständnis/Lokalisierung von LLM-Agenten.

## Anhang C — Eigene Messungen (2026-08-24, dieses Repo)

| Messung | Wert | Bedeutung |
|---|---|---|
| Funktionszerlegung (FUNC→FUNC compose) | 107 Funktionen, 97 Kanten, 10 Wurzeln, keine Mehrfach-Eltern | Der Funktionsbaum ist ein exakter Baum |
| Funktions-Verbindungen über Datenflüsse (FLOW) im Modell | 26 blockintern, 86 blockübergreifend (0,77) | Verhalten lebt zwischen den Blöcken |
| Code-Imports über Modul-Grenzen (MOD) | 40 intern, 82 übergreifend (0,67; 47 Dateien auf 13 Module gemappt) | Kein reiner Modell-Bias — das Territorium ist ähnlich vernetzt |
| Konzentration der Querverbindungen | Top-10-Paare ≈ 60 % (Hubs: harness, mcp-tools, steering, cli) | Simon-Bedingung in Hub-Form erfüllt → Zusammenfassung braucht Baum **+ Hub-Flüsse** |
| aise-Graph-Spektrum | 6 Repos; Extrem moneyflow: 306 Funktionen, keine Use Cases, Wirkketten oder Anforderungen | Datenbasis + Kontrastfall für CR-GC-408 |

Messskripte: Session-Scratchpad (ad hoc, read-only); Reproduktion in CR-GC-408 vorgesehen.

## Anhang D — Glossar

| Unser Begriff | Fachbegriff / Bedeutung |
|---|---|
| SYS | System — der Wurzelknoten des Modells |
| UC | Use Case (Anwendungsfall) — das Wozu; Akteur–Verb–Objekt–Ergebnis |
| FCHAIN | Wirkkette — benannter Verhaltens-Pfad durch das Datenfluss-Netz, hängt an einem Use Case |
| FUNC | Funktion — Blackbox-Architekturblock; Blattfunktion (Leaf-FUNC) trägt die Code-Bindung |
| FLOW | Datenfluss — Objekt, das zwischen Funktionen fließt |
| MOD | Modul — physischer/technischer Baustein, das Womit (Bill of Material / Stack) |
| REQ | Anforderung (Requirement) |
| TEST | Testfall |
| ACTOR | Akteur — Mensch oder Fremdsystem am Systemrand |
| CR / MS | Change Request (Änderungsauftrag) / Milestone (Meilenstein) |
| compose | Zerlegungskante (Eltern → Kind) — trägt die Baum-Hierarchie aller drei Sichten |
| io | Fluss-Kante Funktion ↔ Datenfluss — trägt das Netz |
| allocate | Allokation — Zuordnung Funktion → Modul (die Lösungsentscheidung einer Ebene) |
| satisfy / verify | Anforderungs-Erfüllung (durch Funktion/Modul) / -Verifikation (durch Test) |
| Apply-Gate, `mutate()` | das eine Schreibtor: jede Modelländerung wird geprüft und mit Autor geloggt |
| Readiness | Reifegrad-Messung der Spezifikation, je Dimension bewertet |
| Zielprofil | sechsdimensionale Gewichtung der Architektur-Metriken (Wandelbarkeit, Fehlertoleranz, Flusseffizienz, Kohärenz, Tragfähigkeit, Skalierbarkeit) |
| R-xx / RD-xx | Engine-Regeln: Kanten-Legalität (R-18), Code-/Test-Bindung (R-19/20), Dekompositions-Qualität (RD-01..04) u. a. |
| `graph_next_step` / `graph_impact` / `graph_expand` | Werkzeuge: nächster Vorschlag / Blast-Radius einer Änderung / gezieltes Vertiefen eines Astes |
| SSOT | Single Source of Truth — die eine verbindliche Quelle (hier: der Graph) |
| GVE | Graph-View-Edit — der Viewer; seine drei Explorer-Sichten heißen Operational/Functional/Physical (Arcadia, CR-GVE-255) |
| FBS | Function–Behaviour–Structure (Gero) — die Sichten-Triade der Designtheorie |
| Gummiband | unser Steuerungsprinzip: Empfehlung mit Zug Richtung Spec-Qualität, nie eine Sperre |
