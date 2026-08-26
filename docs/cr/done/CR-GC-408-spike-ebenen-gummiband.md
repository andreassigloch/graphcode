# CR-GC-408 — Spike: Ebenen-Reife vor Tiefe — Nachweis am aise-Bestand, Steuerung als Gummiband

**Status:** done (2026-08-25) · **Ergebnis: No-Go** · **Angelegt:** 2026-08-24 · **Typ:** Spike (Timebox 1 Session)

> **Einordnung beim Schließen (2026-08-25).** Widerlegt ist **dieser Score**, nicht das
> Gummiband-Prinzip: die Advisory-Mechanik (fitAdvisory, `dimension_readiness` →
> `graph_next_step`) war nicht Gegenstand des Spikes und läuft unverändert. Der tragende
> Grund für das No-Go ist eine **fehlende Grundgesamtheit** — 5 der 6 Graphen haben gar
> keine Blockebene (graphcodedemo: 24/24 blocklos), und graphcode hat seine erst per
> Retrofit bekommen (CR-GC-405). Ein Score kann nicht zwischen „Ebene fehlt" und „Ebene
> nicht nötig" trennen, wenn die Vergleichsgruppe praktisch leer ist; genau daher auch die
> zirkuläre Rework-Korrelation (+0,951).
> **Der eigentliche Ertrag des Spikes ist der Nebenbefund:** die *vorhandenen*
> Steuersignale melden Abwesenheit als Reife (`uc` = 0,997 bei 0 UCs) → **CR-SM-270**.
> Bevor ein neues Signal ans Gummiband kommt, gehören die bestehenden repariert.
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

---

## Ergebnis (2026-08-25) — **No-Go**

**Die Zahl: Δ(graphcodedemo − moneyflow) = 0,000.** Das designte Soll-Modell und der reine
Code-Import ohne jedes Wozu erreichen **denselben** Konformanz-Score (beide 0,000) — Kill-Kriterium 1
ist wörtlich erfüllt. Die Erwartung des CR (`demo > graphcode > moneyflow`) ist **falsifiziert**;
gemessen gilt `graphcode = sirail (1,000) > graph-view-edit (0,338) > moneyflow = graphcodedemo =
sigloch-modules (0,000)`. Zweites feuerndes Kriterium: die Rework-These kippt im **Vorzeichen**
(unten, §3).

Reproduktion: `node scripts/spike-ebenen-konformanz.mjs` (read-only, schreibt nichts).

### 0. Ist-Zahlen vs. Profil-Tabelle (erhoben 2026-08-24)

Nur **graphcode** ist gedriftet, die fünf anderen stimmen:

| Repo | Tabelle (24.08.) | Ist (25.08.) | Abweichung |
|---|---|---|---|
| graphcode | 663 Knoten, 10 Blöcke (4 retrofit) | graphVersion **206**, **688** Elemente, 107 FUNC, **15** Blöcke, maxTiefe 3 | +25 Elemente; „10 Blöcke" = die 10 **Wurzel**-Blöcke, 5 weitere liegen auf Ebene 2/3 |
| moneyflow | 306 FUNC, 0 UC/FCHAIN/REQ/ACTOR | 1229 Elemente, 306 FUNC, 0 UC/FCHAIN/REQ/ACTOR | keine |
| sirail | 24 FUNC, 6 UC/FCHAIN | 196 Elemente, 24 FUNC, 6 UC/6 FCHAIN | keine (Datei trägt **kein** `graphVersion`-Feld) |
| graphcodedemo | 24 FUNC, 7 UC/FCHAIN | v10, 219 Elemente, 24 FUNC, 7 UC/7 FCHAIN | keine |
| sigloch-modules | 11 FUNC, 4 UC/FCHAIN | v5, 59 Elemente, 11 FUNC, 4 UC/4 FCHAIN | keine |
| graph-view-edit | 13 FUNC, 5 UC/FCHAIN, 131 CR | v1169, 271 Elemente, 13 FUNC, 5 UC/5 FCHAIN, 131 CR | keine |

### 1. Konformanz-Score mit Komponenten-Zerlegung

Zählweise (im Skript verbindlich dokumentiert, damit die Zahl nachrechenbar ist):
**K1** Anteil FCHAIN-Schritte mit Block-Vorfahren (Lesart von CR-GC-405, „Deckung operativer
FUNCs"; eine Wurzel ohne Kinder zählt **nicht** als ihr eigener Top-FUNC — sonst ist die Invariante
vakuum-wahr) · **K2** Anteil Blatt-FUNC mit FUNC-Elter · **K3** Anteil Wurzeln, die Blöcke sind
(Breite-Hälfte von „Breite vor Tiefe") · **K4** Anteil Blöcke mit `allocate` (Zigzag).
Score = Mittel über K1..K4, undefinierte Komponente = 0.

| Rang | Repo | FUNC | Blöcke | Wurzeln | Blätter | Ketten­schritte | maxTiefe | K1 | K2 | K3 | K4 | **Score** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | graphcode | 107 | 15 | 10 | 92 | 92 | 3 | 1,00 | 1,00 | 1,00 | 1,00 | **1,000** |
| 1 | sirail | 24 | 5 | 5 | 19 | 9 | 2 | 1,00 | 1,00 | 1,00 | 1,00 | **1,000** |
| 3 | graph-view-edit | 13 | 1 | 10 | 12 | 9 | 2 | 0,00 | 0,25 | 0,10 | 1,00 | **0,338** |
| 4 | moneyflow | 306 | 0 | 306 | 306 | 0 | 1 | n/a | 0,00 | 0,00 | n/a | **0,000** |
| 4 | graphcodedemo | 24 | 0 | 24 | 24 | 24 | 1 | 0,00 | 0,00 | 0,00 | n/a | **0,000** |
| 4 | sigloch-modules | 11 | 0 | 11 | 11 | 11 | 1 | 0,00 | 0,00 | 0,00 | n/a | **0,000** |

Drei Befunde, alle gegen die Hypothese:

- **Der Score ist faktisch binär**, kein Reifegrad: die Werteverteilung ist {0; 0; 0; 0,338; 1; 1}.
  Er beantwortet „existiert überhaupt eine FUNC→FUNC-Zerlegungsebene?" — und nur genau EIN Repo der
  sechs (graphcode) hat sie in nennenswerter Breite. Oben sättigt er (graphcode und sirail teilen
  sich 1,000 bei 107 vs. 24 FUNC), unten kollabiert er.
- **K4 (Zigzag) trägt null Information.** In allen sechs Graphen tragen **100 %** aller FUNC eine
  `allocate`-Kante; K4 ist deshalb konstant 1,00 wo Blöcke existieren und undefiniert wo keine
  existieren. Die Zigzag-Idee (Lösungsentscheidung vor Dekomposition) ist an diesem Bestand
  **nicht messbar** — nicht widerlegt, sondern ohne Varianz. Nicht geschätzt.
- **Die Tiefen-Hälfte von „Breite vor Tiefe" ist statisch nicht entscheidbar** und wurde deshalb
  nicht in den Score gerechnet, sondern nur roh berichtet: unterschiedliche Tiefe je Ast ist
  legitim (steht so im Titel dieses CR), ein unbalancierter Baum ist kein Befund.

Das Kernproblem hinter Kill 1: der Score bestraft **kleine** Modelle, in denen eine Blockebene
fachlich gar nicht geschuldet ist, exakt gleich hart wie einen Code-Import ohne jedes Wozu.
graphcodedemo ist mit 24 FUNC an der Grenze der CR-GC-405-Faustregel („4–9 Blöcke für den CEO");
sigloch-modules ist mit 11 FUNC klar darunter. Der Score kann *„Abstraktionsebene fehlt"* nicht von
*„Abstraktionsebene nicht nötig"* trennen — und misst damit nicht, was die Hypothese behauptet
(gute vs. schlechte Spec-Struktur), sondern nur die Modellgröße-über-Schwelle.

### 2. Korrelation mit Readiness + Redundanz-Check (n = 6) — **Kill 2 feuert NICHT**

| Dimension | req | uc | arch | alloc | ver | schema | cr | ms |
|---|---|---|---|---|---|---|---|---|
| Pearson r | 0,502 | −0,127 | 0,231 | −0,035 | 0,473 | 0,364 | −0,122 | **0,572** |
| Spearman ρ | 0,926 | −0,278 | 0,093 | 0,062 | 0,525 | 0,031 | −0,787 | 0,602 |

Stärkste Pearson-Korrelation **|r| = 0,572** (`ms`) — weit von 1. Der Score ist **nicht redundant**;
Readiness trägt die Information heute nicht. Der hohe Spearman gegen `req` (0,926) ist ein
Rangartefakt bei n = 6 mit drei Bindungen auf 0 und ist keine Evidenz — n wird hier mitgenannt, statt
die Zahl als Befund zu verkaufen.

Die Blindstellen-Gegenprobe ist der belastbarere Teil dieser Messung und fällt **für** ein Signal aus:

| Repo | readiness `arch` | blocklose Blatt-FUNC | readiness `uc` | UC im Graph |
|---|---|---|---|---|
| graphcodedemo | 0,971 (24/832) | **24 von 24** | 1,000 (0/110) | 7 |
| moneyflow | 0,845 (1174/7587) | **306 von 306** | **0,997** (1/307) | **0** |
| sigloch-modules | 0,928 (22/306) | 11 von 11 | 0,813 | 4 |
| graph-view-edit | 0,975 (19/755) | 9 von 12 | 0,840 | 5 |

Readiness liest `arch` = 0,97 an einem Graphen, in dem **keine einzige** Funktion unter einem Block
hängt, und `uc` = 0,997 an einem Graphen mit **null** Use Cases. Das ist ein echtes Loch —
Vollständigkeit einer Ebene ist keine Verstoß-Dichte, und eine Pro-Element-Regel kann eine
**abwesende** Ebene nicht melden. Dieses Loch ist real; der hier gebaute Score ist trotzdem nicht
sein Verschluss (§1).

### 3. Rework aus der Git-History — **Kill 3 feuert (Vorzeichen kippt)**

Zählweise je Revisionspaar des jeweiligen `graph.json`: **retrofit-compose** (neue
`compose FUNC→FUNC`, deren KIND in der Vorrevision schon existierte = Block nachträglich
übergelegt) · **reparent** (Elternwechsel) · **composeRemoved** · **elemRemoved**.
Umbau-Commit = eine der vier Zahlen > 0.

| Repo | Revs | Paare | retrofit | reparent | cRemoved | eRemoved | Umbau-Commits | Rate |
|---|---|---|---|---|---|---|---|---|
| graphcode | 73 | 72 | **94** | 13 | 24 | 21 | 10 | 0,14 |
| graph-view-edit | 73 | 72 | 3 | 0 | 1 | 16 | 11 | 0,15 |
| sigloch-modules | 5 | 4 | 0 | 0 | 0 | 0 | 0 | 0,00 |
| graphcodedemo | 4 | 3 | 0 | 0 | 0 | 192 | 1 | 0,33 |
| moneyflow | 1 | — | **nicht messbar** | — | — | — | — | — |
| sirail | 1 | — | **nicht messbar** | — | — | — | — | — |

Die drei größten Retrofit-Commits sind alle graphcode: `db7d631` +51 (contracts ^4.2.0),
`0f015a0` +31 (**CR-GC-405**, der Prüfstein), `3ac435a` +7 (Viewer-Trias).
graphcodedemos `eRemoved` = 192 stammt aus `9ae4a90` („englische Demo") — ein **Reseed**, kein
Authoring-Umbau; die Rate 0,33 ist dort nicht als Rework lesbar.

**These „niedrige Konformanz ⇒ mehr späteren Umbau": falsifiziert, und zwar im Vorzeichen.**
Score ↔ retrofit-compose: Pearson **+0,951**, Spearman **+1,000** (n = 4). Der Zusammenhang ist
genau umgekehrt und zudem **zirkulär**: retrofit-compose ist der Mechanismus, mit dem man den Score
überhaupt auf 1,0 bringt (graphcode hat 94 Kanten nachträglich gelegt), während die
Null-Scorer null Retrofits zeigen, weil sie nie eine Blockebene gebaut haben. Score ↔ Umbau-Rate:
Pearson −0,096, Spearman −0,105 — **kein Signal**.

Ehrliche Grenze dieser Messung: „null Retrofits" kann „kein Umbau nötig" *oder* „Schuld noch nicht
bezahlt" heißen; die History kann das nicht trennen. Es bleibt: **es existiert kein Beleg, dass der
Nudge Aufwand spart statt ihn zu verschieben** — genau die Lücke, die Kill 3 benennt.

**Kill 5 (History zu dünn) feuert für die Hälfte des Bestands:** 4 von 6 Repos messbar, davon nur 2
(graphcode 73, graph-view-edit 73) mit tragfähiger Länge. moneyflow und sirail haben je **1**
Revision → als *nicht messbar* berichtet, nicht geschätzt.

### 4. Nudge-Replay auf 8 graphcode-Ständen — **Kill 4 feuert NICHT**

Advisory-Form wie gefordert (Gummiband, kein Gate): der Fokus-Score der Dimension `arch` wird mit
der Ebenen-Konformanz **multipliziert** (fitAdvisory-Muster); `nextStep` wählt unverändert die
niedrigste Dimension mit `applicable > 0 && violations > 0`. Keine Sperre, kein Regelzusatz.

| rev | graphVersion | Konf. | blocklose Blätter | Baseline-Top | mit Gewicht | Flip |
|---|---|---|---|---|---|---|
| e25b59c | 175 | 0,758 | 12 | schema 0,800 | **arch 0,720** | ja |
| c4d3ce3 | 177 | 0,728 | 17 | schema 0,800 | **arch 0,688** | ja |
| 49c787e | 179 | 0,714 | 17 | schema 0,800 | **arch 0,677** | ja |
| 203f54f | 181 | 0,649 | 29 | schema 0,800 | **arch 0,608** | ja |
| 004aca1 | 184 | 0,642 | 29 | schema 0,800 | **arch 0,606** | ja |
| ce01378 | 189 | 0,639 | **30** | schema 0,800 | **arch 0,602** | ja |
| 0f015a0 | 190 | 1,000 | 0 | schema 0,800 | schema 0,800 | — (nach Retrofit) |
| 664a536 | 206 | 1,000 | 0 | schema 0,789 | schema 0,789 | — (nach Retrofit) |

**6 von 6 Ständen vor CR-GC-405 kippen von `schema` auf `arch`; 0 von 2 Ständen danach.** Der Nudge
zeigt also genau im richtigen Zeitfenster und erlischt von selbst, sobald die Blöcke stehen — kein
Dauerschubser. Das ist das stärkste Einzelergebnis dieses Spikes.

Zwei Einschränkungen, die es kleiner machen als es aussieht:
- `nextStep` rankt **Dimensionen, keine Kandidaten**. Der Flip sagt „arbeite an `arch`", nicht
  „lege vier Blöcke an" — der Aktionstext bleibt „Fix functional architecture — satisfy REQ, wire
  FLOWs, break cycles". Dass *Blöcke vor Leaf-FUNCs* vorgeschlagen worden wären, ist mit dem
  heutigen Ranking-Korn **nicht** gezeigt; gezeigt ist nur der Dimensionswechsel.
- Der Flip hängt daran, dass `schema` bei 0,800 stand und `arch` bei 0,94 · 0,64. Er ist ein
  Ein-Repo-Ergebnis; kein zweiter Graph im Bestand hat die History, um ihn zu wiederholen.

### 5. Entscheidung: **No-Go** — Kill 1 und Kill 3 feuern

| Kill-Kriterium | Status | Zahl |
|---|---|---|
| 1 Keine Trennschärfe | **FEUERT** | Δ(demo − moneyflow) = **0,000**; erwartete Ordnung falsifiziert |
| 2 Redundanz mit Readiness | feuert nicht | max \|r\| = 0,572 (`ms`) |
| 3 Keine Rework-Korrelation | **FEUERT** | Score ↔ retrofit Spearman **+1,000** (These verlangt negativ); ↔ Umbau-Rate ρ = −0,105 |
| 4 Replay wirkungslos | feuert nicht | 6/6 Flips vor dem Retrofit, 0/2 danach |
| 5 History zu dünn | teilweise | 4/6 messbar, davon 2 tragfähig |

Der Score, wie dieser CR ihn schneidet, wird **nicht gebaut**. Er misst nicht Ebenen-Reife, sondern
„hat dieses Modell überhaupt eine FUNC→FUNC-Zerlegung", ist auf sechs realen Graphen faktisch binär,
setzt das designte Soll-Modell mit dem Code-Import ohne Wozu gleich, und die Ersparnis-These trägt
das Vorzeichen der Gegenthese. Die im CR benannte Alternative — „addiert nur eine
Komplexitätsdimension" — ist damit die gemessene Antwort.

### 6. Was aus dem Spike bleibt (festgehalten, nicht schöngerechnet)

Wie bei CR-GC-407 trennen sich die Zutaten in der Messung. Zwei Teile haben bestanden, sie tragen
den Go-Fall dieses CR aber nicht:

1. **Readiness hat ein echtes Abwesenheits-Loch.** `arch` = 0,971 bei 24/24 blocklosen FUNCs,
   `uc` = 0,997 bei null UC. Eine Pro-Element-Regel kann eine fehlende **Ebene** nicht melden,
   weil das Element, an dem sie meldet, nicht existiert (dasselbe Vacuous-Complete-Loch, das
   CR-SM-247 mit R-28 geschlossen und dann wieder aufgegeben hat). Das ist ein Befund über
   **Readiness**, kein Argument für diesen Score.
2. **Die Advisory-Form funktioniert mechanisch.** Multiplikativ auf den Fokus-Score, kein Gate,
   selbst erlöschend (0 Fehlschubser nach dem Retrofit). Falls je ein *anderes*, trennscharfes
   Ebenensignal gefunden wird, ist die Einspeisung damit vorvermessen.

Ein Folgeschritt wäre ein **neuer Spike mit eigenen Kill-Kriterien** — Frage: „wann ist eine
Blockebene überhaupt geschuldet?" (die Größenschwelle, an der Kill 1 hier gescheitert ist), gemessen
an einem Bestand, in dem mehr als ein Repo eine Zerlegung besitzt. Ausdrücklich **nicht** dieser CR
und ausdrücklich nicht als Fortsetzung angelegt: solange fünf von sechs Graphen keine Blockebene
haben, gibt es keine Grundgesamtheit, an der sich so eine Schwelle validieren ließe.

### Akzeptanzkriterien — Beleg

| AK | Beleg |
|---|---|
| Score auf allen sechs Graphen, Rangfolge + Komponenten | §1 (K1–K4 je Graph, Rangfolge, Sättigung und Nullkollaps benannt) |
| Korrelation ↔ Readiness inkl. Redundanz-Check | §2 (8 Dimensionen, Pearson + Spearman, max \|r\| = 0,572, plus Blindstellen-Gegenprobe) |
| Rework aus ≥ 3 Histories, Zählweise dokumentiert | §3 (4 Repos messbar, 4-teilige Zählweise im Skript-Kopf, moneyflow/sirail als *nicht messbar* ausgewiesen) |
| Nudge-Replay auf ≥ 3 Ständen, Prüfstein CR-GC-405 | §4 (8 Stände: 6 vor, 2 nach dem Retrofit; Baseline vs. gewichtet gegenübergestellt) |
| Entscheidung dokumentiert | §5 — **No-Go**, tragende Zahl Δ = 0,000 |
| Kein Produktionscode | Diff: `scripts/spike-ebenen-konformanz.mjs` + dieser CR |
