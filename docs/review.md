# Review 2026-08-16 — Reparaturwelle 2026-08-12 → 08-16

**Scope:** graphcode · sigloch-modules · graph-view-edit (GVE).
**Kernbefund:** ~85 Commits in 4 Tagen über drei Repos, überwiegend Reparatur/Nachzieh-Arbeit.
Eine einzige Defektklasse (deklarierte Regel-Metadaten ≠ tatsächliches Regelverhalten) erzeugte
allein 4 geschlossene + 2 offene CRs (CR-SM-235, CR-SM-239 zweifach, CR-SM-242, CR-SM-243).

---

## 1. Muster & Root Causes

### P1 · Deklaration ohne Erzwingung — die dominante Klasse

`domain` (Grundgesamtheit je Regel¹) wurde als zweite, handgepflegte Aussage neben dem Evaluator
eingeführt. Jede Redundanz driftete:

- CR-SM-235: 18/71 Regeln ohne Nenner-Eintrag → `ms` las 0 %, der Executor optimierte gegen ein
  Rechenartefakt
- CR-SM-239: Graph-Checks (AF-01..05, R-28) als 1-Element-Gruppen dominierten leere/kleine
  Dimensionen → Fix brauchte **zwei Anläufe** (se-steering 0.5.0 war halb)
- CR-SM-242/243: 7 Regeln deklarieren Typ A, prüfen Typ B (R-10, SC-04, IO-01, R-03, FC-03,
  NFR-01, CR-R03)

Entscheidend: von Hand gefunden in 4 CRs über 4 Tage; der Katalog-Invariantentest aus CR-SM-242
fand 4 weitere Fälle in Sekunden. Das Motto „enforce, don't document" war auf Graph-Writes
angewandt, aber nicht auf den Regelkatalog.

### P2 · Ordnungs-Nichtdeterminismus (CR-GC-351 / CR-SM-240)

Kuzu gibt keine Reihenfolgegarantie (3× `loadGraph()` → 3 Knotenfolgen), aber `buildAdjacency`
las die Eingabereihenfolge → `graph_suggest` nicht deterministisch (Score 0.263 vs 0.000 für
denselben Kandidaten). Die kleine Fixture verdeckte, dass auch `coherence` wandert — „nur
modifiability" war ein Fixture-Artefakt. Fix an der einen Eintrittsstelle (`buildAdjacency`),
nicht an fünf Konsumenten.

### P3 · Fake-Coverage (CR-GC-334)

Der Format-E-Round-Trip-Test stringifizierte beide Seiten → `[object Object] == [object Object]`
war monatelang grün, während der Autoring-Pfad für gebundene Elemente faktisch unbenutzbar war
(R-19/R-20 feuerten auf Knoten *mit* Bindung). Ein Test, der per Konstruktion nicht scheitern kann.

### P4 · Release-/Link-Topologie als Fallenfeld

Drei dokumentierte Reinfälle in einer Woche:

- `npm install` ersetzte den Workspace-Symlink still → alle Zwischenmessungen liefen gegen den
  ungefixten Stand (CR-GC-338)
- `^` ist auf 0.x minor-gesperrt — `^0.4.0` zieht kein 0.5.0; zweimal explizit als Warnung notiert
- Lokale Versionsnummern (contracts „5.1.0") kollabierten beim Release zu 4.0.0; der laufende
  MCP-Server hält Boot-Code, während ein Neustart am Config-Fail-Fast scheitert

### P5 · Breaking-Change-Wellen im Hub-Paket

`testRef`→`testRefs` (CR-SM-231) erzeugte: CR-SM-231b → CR-GC-338 (20 Dateien statt 6, geplanter
Schnitt hinfällig) → CR-GVE-230 (offen: Graph-Datenmigration steht aus) → graphify/aimpro hängen
weiter zurück. GVE war zwei Majors hinterher, der graphcode-Host startete nicht mehr.
Produktlücken dabei offengelegt: Attribute sind im Gate nicht löschbar (null-Grabsteine als
Workaround); delete+add derselben uid im Batch verboten.

### P6 · Modell-/Claim-Drift: Regeln sehen keine Abwesenheit

64 von 123 REQ ohne `compose`-Elternteil (CR-GC-350) — keine Regel feuerte darauf, während
`06-claims.md` Traceability behauptete. Dieselbe Klasse: konsumentenlose Artefakte
(`overallScore`, D1–D6-Vektor, `trajectory.jsonl` — bei jeder Mutation vollständig neu
geschrieben, null Leser).

---

## 2. Übergreifende Root Causes

1. **Jede zweimal geschriebene Wahrheit driftet.** Domain-Tabellen, Kommentare („ties broken by
   community-id order" — stimmte nicht), USAGE-MATRIX-Zeilen zum Vorgängerprodukt. Ohne
   Invariante über dem Paar Deklaration↔Implementierung ist Drift der Normalfall.
2. **Stichproben-Schluss.** Dreimal wurde an einem kleinen Beispiel gemessen und auf den Bereich
   geschlossen (CR-SM-239 §7: „Zweimal zu früh zufrieden"). Kleine Fixtures verdecken genau die
   Effekte, die auf echten Graphen dominieren.
3. **Publish-Friktion vergrößert Batches.** Manuelles Publishen (OIDC tot) + 0.x-Caret +
   Link-Workflow → Änderungen stauen sich, Releases kollabieren Versionen, Konsumenten fallen
   Majors zurück; jede Welle wird teurer.

---

## 3. Maßnahmen (priorisiert)

### Produkt / Architektur

| # | Maßnahme | Begründung |
|---|---|---|
| 1 | CR-SM-242/243 schließen, dann `domain` strukturell machen: aus dem Evaluator ableiten oder Fixture ausbauen, bis der Katalog-Test für keine Regel stumm ist | Klasse 4× aufgetreten; der Test fängt nur, was feuert |
| 2 | Abwesenheits-Regel „REQ ohne compose-Parent" (warning) | CR-GC-350s Zustand (0/123) kann sonst still regressieren |
| 3 | Gate: Attribut-Delete als First-Class-Op (auditiert) | Null-Grabsteine tauchen in jeder Migration auf |
| 4 | `trajectory.jsonl`-Schreibpfad stilllegen oder hinter Config | 108 Zeilen je Mutation für null Leser |
| 5 | Nenner-Modell-Entscheidung bündeln: Prädikat-Domains, Slots-vs-Elemente, Legs/Paare-Kardinalität — **ein** CR mit Messung | Alle offenen Reste aus CR-SM-235/242 sind dieselbe Frage |

### Entwicklungsprozess

| # | Maßnahme | Begründung |
|---|---|---|
| 6 | Familie auf 1.x heben (se-steering, se-optimizer, graphcode-client) oder exakte Pins + Bump-Automation | Zwei dokumentierte `^0.x`-Fallen in einer Woche |
| 7 | Konsumenten-Lag sichtbar machen: Script über die Repos (package.json vs Registry) | GVE 2 Majors zurück, nur als CR-Fußnote vermerkt |
| 8 | Zwei-Skalen-Regel kodifizieren: Invarianten immer gegen kleine Fixture **und** einen echten committeten Graphen messen | CR-SM-239/GC-351 scheiterten exakt daran |
| 9 | Einmaliger Fake-Coverage-Sweep: Tests, deren Erwartung durch dieselbe Transformation gebaut wird wie das Ist | Red-first sichert neue Tests; die Altlast prüft niemand |
| 10 | 6-Dateien-Regel verfeinern: mechanischer Fan-out (71× dasselbe Feld) zählt nicht gegen das Limit | CR-SM-235: 5 geplant/24 real; CR-GC-338: Schnitt verworfen |
| 11 | Neustart-Kriterium standardisieren: bei Config-Schema-/Publish-Änderung „frisch gestarteter Server kommt hoch" als Akzeptanzkriterium | Der laufende Prozess maskiert den Startabbruch sonst tagelang |

---

## 4. Was tragfähig war (beibehalten)

- **Gemessen statt geschätzt** — mehrfach hat die Nachmessung die eigene Annahme umgeworfen
  (CR-GC-338 §9: „Die Annahme dieses CRs war falsch")
- **Fix an der Quelle statt Konsumenten-Pflaster** (`buildAdjacency`); und das Pflaster danach
  nicht reflexhaft entfernt, sondern nachgemessen, dass es inzwischen etwas anderes schützt
  (CR-GC-351 §4)
- **Der Audit-Trail zahlt sich aus:** 4 CRs aus Trail-Analysen (CR-GC-284/286/290/292); einmal
  ein CR ohne Bau geschlossen, weil der Trail die Vorbedingung widerlegte
- **Sibling-CR-Muster** (CR-GC-351↔CR-SM-240): Befund beim Konsumenten, Fix an der Quelle,
  Nachmessung beim Konsumenten
- Die Root-Cause-Qualität der CR-Dokumente selbst — dieses Review war nur möglich, weil die
  Befunde dort präzise stehen

---

## 5. Nachträge aus der Review-Diskussion

**Reverse-Engineering-Anteil (~30 %)** ist Schuldentilgung eines nachlaufenden Modells, kein
Dauerzustand — gilt nur, wenn neue Arbeit model-first läuft. Kommt das Muster wieder, ist es ein
Prozessleck.

**Folge-CR-Generatoren, gewichtet:** (a) Entdeckung beim Bauen (gesund, Scope-Disziplin),
(b) Hub-Fan-out (strukturell — ein Breaking Change im Nabenpaket = ein CR je Konsument),
(c) 6-Dateien-Limit (kleinster Anteil, erzeugte aber zweimal verworfene Planung).
Parallelpfade/Altlasten wurzeln im aimprove-Erbe ohne Konsumenten-Audit; „keine parallelen Pfade"
wird innerhalb eines Repos erzwungen, über Paketgrenzen und Produktgenerationen nicht.

**Modell-Auflösungsgrenzen:** (1) die Familie selbst (Pakete, Versionen, Konsumenten-Lag) ist in
keinem Graphen — der größte Zeitfresser der Woche lag komplett unterhalb des Modells;
(2) Regeln sehen keine Abwesenheit — das Modell hielt 64 elternlose REQ monatelang wahrheitsgemäß,
ohne dass etwas feuerte (Speicher, nicht Wächter); (3) Regelkatalog und Testqualität liegen
unterhalb der Modellauflösung — dort sind Invariantentests das richtige Werkzeug, nicht mehr Modell.

**Abstraktionsebenen-Befund (2026-08-16):** Die Ontologie kodiert die Ebenen-Leiter
(`FUNC compose FUNC`: „leaf carries realRef, parent realized by children"; MOD-in-MOD legal),
aber der eigene Graph ist faktisch flach: 4× FUNC-in-FUNC bei 55 FUNCs, 0× MOD-in-MOD bei
10 MODs. Es existiert keine Tiefen-Projektion (nur Typ-Projektion `projectLayer` und
Ast-Vertiefung `graph_expand`). → `docs/spikes/SPIKE-GC-abstraction-levels.md`

---

¹ Nenner = `applicable` im Dimensions-Score: `score = 1 − Verstöße / anwendbare Prüfungen`.

@author andreas@siglochconsulting
