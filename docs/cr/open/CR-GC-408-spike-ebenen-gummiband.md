# CR-GC-408 — Spike: Ebenen-Reife vor Tiefe — Nachweis am aise-Bestand, Steuerung als Gummiband

**Status:** open · **Angelegt:** 2026-08-24 · **Typ:** Spike (Timebox 1 Session)
**Frage:** Bringt ein Ebenen-bewusster Authoring-Einstieg (Top-FUNC aus UCs, Zigzag, Tiefe je Ast)
den Use Case *„Abstraktion zum Verständnis und Management komplexer Systeme"* messbar weiter —
oder addieren wir nur eine Komplexitätsdimension? Nachweis auf den **realen aise-Graphen**, nicht
auf einem Beispiel.

## Herkunft — Fortsetzung der Modellphilosophie-Diskussion (2026-08-24, nach CR-GC-407)

Befund: der gelebte Authoring-Flow ist SYS → detaillierte UCs → direkt Leaf-FUNCs; die
Grob-Ebene wird bottom-up nachgerüstet (Beleg: CR-GC-405 legte **nachträglich** vier
Funktionsblöcke für 30 blocklose FUNCs an). Die Literatur ist einig, dass es andersherum gehört —
als Kombination beider im Chat diskutierten Optionen:

- **FAS-Methode** (Lamm/Weilkiens): Top-Funktionsarchitektur wird aus den UC-Schritten
  *abgeleitet* — Schritte aller FCHAINs sammeln, nach Kohäsion gruppieren, die Gruppen sind die
  Top-FUNCs.
- **Arcadia** (Voirin): Ebenenfolge Operational → System → Logical → Physical, jede Ebene
  arbeitsfähig komplett vor der nächsten, mit expliziter Rückiteration.
- **Suh (Axiomatic Design):** Zigzag — Dekomposition erst nach der Lösungsentscheidung der
  aktuellen Ebene (bei uns: allocate auf MOD vor FUNC→FUNC).
- **ISO 15288/29148, VDI 2206:** Prozesse rekursiv pro Systemebene, nicht einmal bis zum Blatt.

Prüfbare Kern-Invariante daraus („Detail detailliert das Konzept"): **jeder FCHAIN-Schritt ist
einem Top-FUNC zuordenbar** — die Umkehrung von R-30 (jedes Leaf in einer Kette ⇒ jeder
Kettenschritt in einem Block).

## Das Gummiband-Prinzip (Design-Constraint, prägt den Spike)

**Kein Hard-Gate.** Der Kunde darf Ebenen und Reihenfolgen überspringen. Die Steuerung ist ein
sanfter Zug über unsere Zieldimensionen: ein Ebenen-Konformanz-Signal fließt als **Advisory** in
Readiness/`graph_next_step`-Ranking ein und schubst Richtung „Spec ready for Implementation" —
es blockt nie (dasselbe Muster wie fitAdvisory: Signal, kein Verbot). Der Spike testet deshalb
die Advisory-Form, nicht eine Sperre.

## Hypothese

Ein Ebenen-Konformanz-Score trennt gute von schlechter Spec-Struktur auf realen Graphen,
korreliert mit Qualität/Rework, und hätte — als Ranking-Nudge rückwärts eingespielt — die
nachgerüsteten Blöcke *vor* den Leaf-FUNCs vorgeschlagen.

## Datenbasis — sechs reale Graphen, volles Spektrum (erhoben 2026-08-24)

| Repo | Profil | Rolle im Spike |
|---|---|---|
| graphcode | 663 Knoten, volle Ontologie, 10 Blöcke (4 retrofit) | Retrofit-Beleg, History vorhanden |
| moneyflow | 306 FUNC, **0 UC / 0 FCHAIN / 0 REQ / 0 ACTOR** | Kontrast: reiner Code-Import, kein Wozu |
| sirail | 24 FUNC, 6 UC/FCHAIN, volle Ontologie | mittlerer Reifegrad |
| graphcodedemo | 24 FUNC, 7 UC/FCHAIN | designtes Soll (Vorführmodell) |
| sigloch-modules | 11 FUNC, 4 UC/FCHAIN | klein, gewachsen |
| graph-view-edit | 13 FUNC, 5 UC/FCHAIN, 131 CR | klein, CR-getrieben |

## Spike-Experiment (Read-only-Analyse, kein Produktionscode)

Ein Analyse-Skript (`scripts/spike-ebenen-konformanz.mjs`, läuft gegen die sechs graph.json)
misst drei Dinge:

1. **Konformanz-Score je Graph** (im Spike definiert, Kandidaten-Komponenten):
   FCHAIN-Schritt-Abdeckung durch Top-FUNCs · Anteil Leaf-FUNCs mit Block-Parent ·
   Breite-vor-Tiefe (Ebene-1-Vollständigkeit vs. maximale Dekompositionstiefe) ·
   Zigzag-Quote (dekomponierte FUNCs mit allocate). Erwartung: demo > graphcode > moneyflow.
2. **Korrelation mit Qualität und Rework:** Readiness-Dimensionen + Violation-Dichte je Graph;
   Rework aus der Git-History des jeweiligen graph.json (Umbau-Commits: Retrofits, Renames,
   Umhängen von compose-Kanten). These: niedrige Konformanz ⇒ mehr späteren Umbau.
3. **Nudge-Replay (graphcode, da History vorhanden):** auf 3–5 historischen Ständen des
   graph.json prüfen, ob ein Konformanz-gewichtetes Ranking die in CR-GC-405 nachgerüsteten
   Blöcke vor den damals angelegten Leaf-FUNCs vorgeschlagen hätte.

## Kill-Kriterien — die ehrliche Hälfte

**No-Go** (= Komplexität addiert, nicht bauen), wenn eines eintritt:

- **Keine Trennschärfe:** der Score unterscheidet die sechs Graphen nicht (insbesondere:
  moneyflow ohne jedes Wozu landet nicht deutlich unter graphcodedemo) — dann misst er nichts.
- **Redundanz:** der Score korreliert ≈1 mit existierenden Readiness-Dimensionen — dann trägt
  Readiness die Information schon, und das Level-Gate wäre nur ein zweiter Name dafür.
- **Keine Rework-Korrelation:** Graphen mit niedriger Konformanz zeigen nicht mehr Umbau in der
  History — dann fehlt der Beleg, dass der Nudge Aufwand *spart* statt verschiebt.
- **Replay wirkungslos:** das Konformanz-Ranking hätte die Vorschlagsreihenfolge praktisch nicht
  geändert — dann schubst das Gummiband ins Leere.
- **History zu dünn** für Zigzag/Replay: wird als „nicht messbar" berichtet, nicht geschätzt —
  und schwächt den Go-Fall entsprechend.

## Ausdrücklich nicht

- Kein Hard-Gate, keine Sperr-Regel — auch bei Go nicht; das Gummiband-Prinzip ist gesetzt.
- Keine Änderung an `nextStep`/`readiness`/Regeln in Produktion — das ist der Folge-CR bei Go
  (Schnitt: Konformanz-Advisory + Ranking-Gewicht in `graph_next_step`, ≤6 Dateien).
- Die Benennung der drei Sichten (Wozu/Wie/Womit) ist GVE-Thema, nicht Teil dieses CR.
- Keine 7. Metrik-Dimension; der Score ist Spike-lokal, bis der Go-Fall ihn rechtfertigt.

## Akzeptanzkriterien

- [ ] Score auf allen sechs Graphen berechnet; Rangfolge und Komponenten-Zerlegung im Ergebnis.
- [ ] Korrelation Score ↔ Readiness-Dimensionen ausgewiesen (inkl. Redundanz-Check).
- [ ] Rework-Evidenz aus mindestens drei Repo-Histories quantifiziert (Umbau-Commits gezählt,
      Zählweise dokumentiert).
- [ ] Nudge-Replay auf ≥3 historischen graphcode-Ständen: Reihenfolge mit/ohne Konformanz-Gewicht
      gegenübergestellt — der CR-GC-405-Retrofit ist der Prüfstein.
- [ ] **Entscheidung im CR dokumentiert:** Go (mit Folge-CR-Schnitt) oder No-Go (mit der Zahl,
      die es begründet). Beides ist ein gültiges Spike-Ergebnis.
- [ ] Kein Produktionscode geändert (Diff berührt nur `scripts/` + diesen CR).

## Dateien (≤ 2)

1. `scripts/spike-ebenen-konformanz.mjs` (read-only über die sechs graph.json + git log)
2. dieser CR (Ergebnis-Nachtrag wie bei CR-GC-400/407)
