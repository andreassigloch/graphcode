# CR-DRAFT-GC-448 — Stand nach dem Selbstumbau, und was der Prozess gelehrt hat

**Status:** DRAFT — Bestandsaufnahme, keine Umsetzung. Die hier benannten Entscheidungen und
Regelkandidaten werden **einzeln** geschnitten, nicht aus diesem CR heraus gebaut.
**Angelegt:** 2026-08-27 · **Herkunft:** der Umbau von graphcode selbst (CR-GC-444…447) plus
die Regel- und Werkzeug-Arbeit desselben Tages (CR-GC-434…443, CR-SM-274…277).
**Zielbild:** `claude.ai/code/artifact/cd55117c-0fcc-4859-be1a-615c86529760` („graphcode-Regelkreis")

---

## 1 — Stand

graphcode hat sich selbst umgebaut, in der Reihenfolge des Zielbilds: **erst die Kanten, dann der
Schnitt, dann der Code.**

| Schritt | Commit | Ergebnis |
|---|---|---|
| CR-GC-444 Konsolidierungs-Operator | `af0d1c0` | `graph_suggest` kann Merges vorschlagen; 8 Vorschläge, 8 anwendbar (vorher: 0) |
| CR-GC-445 Vertragskonsolidierung | `4f450c4` | 23 Merges durchs Gate, FLOWs 62 → 39 |
| CR-GC-446 5er-Schnitt | `f4cb67b` | MOD 17 → 6, Modul-Paare 79 → 10 |
| CR-GC-447 Code-Nachzug | `e0c900d` | 73 Dateien nach `src/kernel\|projections\|loop\|surface`, importCoverage 75/75 |

**Die tragenden Zahlen, je einmal:**

| Kennzahl | vor Schritt 1 | nach Schritt 1 | nach Schritt 2 |
|---|---|---|---|
| Kohäsion gesamt | 7,1 % | 9,7 % | **17,2 %** |
| Randverkehr über die Top-5-Verträge | 66,9 % | 91,1 % | **93,1 %** |
| Module mit 0 internen Verbindungen | 5 | 3 | **0** |
| Violations gesamt | 79 | 109 | **44** |

**Die beiden Schritte messen Verschiedenes.** Die Konsolidierung bewegt den Randverkehr und lässt
die Kohäsion fast unberührt; der Schnitt dreht es um. Das ist der empirische Beleg für die
Reihenfolge des Zielbilds — und die Erklärung, warum CR-GC-436 („nur umhängen") ein No-Go war:
eine Zuordnung über unkonsolidierten Kanten zu optimieren, optimiert das Falsche.

---

## 2 — Lessons learned

### A · Über Messgrößen

**A1 — Eine Messgröße, die der eigene Fix-Hint nicht senkt, ist die falsche Messgröße.**
CR-01 zählte rohe io-Querungen; ihr Fix-Hint lautet „Mediator einziehen". Ein Mediator senkt die
Zahl der *Verträge*, nicht die der Kanten. Erst die Umstellung auf `distinct SCHEMA` macht Regel
und Fix zu einem Paar. Dasselbe bei R-04 („Modul splitten" verteilt Verträge, keine io-Kanten).
Prüffrage für jede neue Regel: **senkt der vorgeschlagene Fix die gemeldete Zahl?**

**A2 — Feinheit ist nicht Güte.** Modul-Paare und Kreuzungszahlen stiegen bei der Konsolidierung
(47 → 79) und fielen beim Schnitt (79 → 10). Beide Bewegungen sind korrekt: ein geteilter Vertrag
verbindet rechnerisch jeden Produzenten mit jedem Konsumenten. Wer den Umbau an der Paarzahl misst,
misst gegen das eigene Ziel. Geurteilt wird über **Kohäsion und Randverkehr**.

**A3 — Nicht messbar ist nicht null.** Durchgehend eingehalten (Kohäsion `null`, nicht ladbare
Graphen werden benannt statt ersetzt, `importCoverage` getrennt von `skipped`). Das ist die Regel,
die am häufigsten unter Druck gerät, weil eine 0 immer „ordentlicher" aussieht als eine Lücke.

### B · Über Regeln

**B1 — Eine Regel, die auf keinem Familie-Graphen je gefeuert hat, ist verdächtig, nicht beruhigend.**
CR-01 suchte `FUNC -io-> FUNC` — ein Paar, das die Grammatik nicht kennt. Ergebnis: 0 Befunde auf
16 Graphen, bei gepflegter Schwelle. R-04 zählte den io-Grad statt der Kreuzungen und war dadurch
für jedes Modul mit Datenfluss trivial über der Schwelle. Beide Fehler fielen erst auf, als jemand
die Zahl **gegen eine unabhängig erhobene Zahl** hielt.
→ Vorschlag: ein Bericht „Regeln ohne Befund über den gesamten Familie-Bestand".

**B2 — „Regel existiert" ≠ „Regel wird ausgewertet" ≠ „Regel kann feuern".** Drei verschiedene
Aussagen, die bis heute vermischt waren. ND-01/ND-02 existierten, wurden aber nur im Steering-Pfad
ausgewertet (`rules_evaluate` injizierte die Matrix nicht → stilles `[]`), und ND-02 **kann**
zusätzlich auf einem musterlegalen Graphen fast nie feuern: `usage_overlap` ist über die direkten
SCHEMA-Partner definiert, und seit `FLOW -relation-> SCHEMA [1..1]` sind die Usage-Mengen zweier
verschiedener SCHEMAs strukturell disjunkt — Maximalscore 0,80 gegen Schwelle 0,85.
CR-GC-442 hat die zweite Lücke geschlossen (`catalogs.notInGate` und `skipped` sind jetzt getrennte
Aussagen); die dritte ist offen (§3).

**B3 — Injizierter Modul-Zustand leckt.** `setND02SimilarityMatrix` setzt globalen Zustand in
contracts; `AO-D01` liest ihn und **steht im Gate-Katalog**. Eine liegengebliebene Matrix hätte
verändert, was der nächste Lauf meldet. Heute folgenlos (AO-D01 verlangt ebenfalls ein illegales
Kantenpaar — siehe B1), gekapselt ist es trotzdem. Muster: wer Zustand injiziert, gibt ihn in
einem `finally` zurück.

### C · Über Spikes und Trockenübungen

**C1 — In-Memory-Trockenübungen können Modelloperationen behaupten, weil nichts hinsieht.**
CR-GC-436 Lauf B versprach acht gekoppelte SCHEMA-Merges. Am echten Gate fielen **alle acht** —
jeder scheitert an dem, was die Knoten über sich selbst sagen: `concept:true` mit der Notiz
„bewusst spec-only, um die Verstreuung sichtbar zu halten", `external:true` mit eigenem `realRef`,
oder ein echter Rechenschritt zwischen den beiden. Deshalb stehen die SCHEMAs bei 32 statt bei den
im Zielbild versprochenen 22.
→ **Regel für künftige Spikes:** eine Zahl, die eine Modelloperation voraussetzt, gehört nicht ins
Ergebnis, bevor ein Gate-dryRun gegen den echten SSOT sie bestätigt hat.

**C2 — Vorab fixierte Kill-Kriterien tragen das Ergebnis.** CR-GC-438 hatte R² ≥ 0,8 vor dem ersten
Lauf festgelegt; das Ergebnis (0,89) war damit nicht verhandelbar. Wertvoller noch war die
Selbstkritik im selben Bericht: bei N = 9 und sechs Prädiktoren liegt das Permutations-Nullmittel
bei R² ≈ 0,74, die Schwelle also nah am Rauschboden — deshalb trägt der Einzel-Prädiktor-Fit
(`flowEfficiency` allein, r = 0,89) den Befund, nicht die 0,89.

**C3 — Der teuerste Spike-Ausgang ist der nützlichste.** Von sechs Architektur-Spikes endeten vier
mit No-Go oder „nicht messbar". Ihr Ertrag: die 7. Dimension wurde **nicht** eingeführt (und damit
ein contracts-Major, ein Rollout über fünf Pakete und das Neu-Baselining jedes Zielprofils
vermieden), und der Umbau lief über den einen Hebel, der trug.

### D · Über den Umbau

**D1 — Der Graph ist die Wahrheit, das Verzeichnis nicht.** Sechs strittige FUNC-Zuordnungen wurden
nach der Knotenbeschreibung entschieden, nicht nach dem heutigen Ordner. `FUNC-own-kuzu-host` liegt
im Code unter `src/viewer/`, ist aber die Single-Owner-Invariante und gehört nach `kernel`.
Bemerkenswert: `next-step` und `graph-suggest` hätten `projections` **exakt** auf die Zielzahl des
Schaubilds gebracht — sie kamen trotzdem nach `loop`, weil sie einen Zug vorschlagen statt zu
beschreiben. Zielzahlen sind Absicht, nicht Zwang.

**D2 — Modell-Behauptungen brechen am Code, nicht vorher.** Erst der Nachzug deckte auf, dass
`FUNC-own-kuzu-host` und `FUNC-serve-sse` auf **dasselbe Symbol** zeigten: das Modell behauptete
eine Trennung, die der Code nie hatte. Ebenso trug `hooks/emit.ts` zwei FUNCs aus verschiedenen
Modulen. Beides wurde im Code hergestellt, nicht wegmodelliert.
→ **Regelkandidat (§3):** zwei FUNC verschiedener Module auf demselben `realRef`-Symbol. RC-01/02
sehen es nicht, weil Datei und Symbol ja existieren.

**D3 — Ein roter Test verdeckt, was er prüfen sollte.** Zwei tote `exports`-Subpfade lagen seit
CR-GC-429 §4 im Manifest. Der einzige Test, der sie greift, ist der Tarball-Test — und der ist
wegen des Publish-Staus rot. Eine dauerhaft rote Testdatei ist kein Parkplatz, sie ist ein blinder
Fleck mit Ablaufdatum.

### E · Über den Betrieb

**E1 — Ein veralteter Host ist eine stille Rückschreib-Gefahr.** Der laufende MCP-Server hielt den
Stand von vor der Konsolidierung; sein nächstes `graph_export` hätte die 23 gemergten FLOWs wieder
angelegt, **ohne** dass der Clobber-Schutz greift — denn sein Graph war ein Superset des
committeten. `graph_reseed` löst den Datenstand; der **Regelkatalog** bleibt trotzdem vom Boot
(er meldete CR-01 = 0 statt 79). Für Nachrechnungen hilft nur ein Neustart.

**E2 — Roher `harness.mutate()` schreibt keine Audit-Provenienz.** `graph_export` verweigert danach
die *eigene* Änderung als Fremd-Clobber. Jedes Skript fährt über `tools.graph_mutate`. Gleiche
Klasse wie der `trajectory.jsonl`-Fall aus CR-GC-252 — der Tool-Layer ist nicht Dekoration, er ist
der Pfad, an dem die Provenienz entsteht.

**E3 — Parallelität braucht Regeln, die heute nicht erzwungen sind.** In einem Lauf mit mehreren
gleichzeitigen Agenten trat auf: eine **CR-Nummernkollision** (zwei Agenten griffen CR-SM-274), ein
`git stash`-Roundtrip, der fremde In-Flight-Edits duplizierte, und der pre-commit-Hook, der
`docs/graph` + `docs/views` selbst dazustagt und dadurch fremde Modellstände in einen fremden
Commit zieht (ein Agent hat den Hook deshalb bewusst umgangen).
→ BOK-CR-031 (`aise dispatch`, Lanes/Leases) adressiert genau das und ist umgesetzt, aber in diesem
Lauf nicht benutzt worden. Beim nächsten Mehr-Agenten-Lauf: **Lanes benutzen.**

**E4 — Der Auftrag muss die bekannten Fallen mitliefern.** Wo Memory-Wissen im Auftrag stand
(persist-Reihenfolge bei delete+add, stale Server, Format-E-Pfeile), sind die Agenten nicht
hineingelaufen. Wo meine eigene Vorgabe falsch war — ND-02 als Kandidatenquelle für Merges — musste
sie mitten im Lauf korrigiert werden, und der Agent hat sie danach begründet verworfen.

---

## 3 — Was offen ist

Jeder Punkt ist ein eigener CR, keiner wird aus diesem Draft gebaut.

**Entscheidungen des Auftraggebers**

1. **CR-01-Severity:** 198 der 216 Befunde sind `info` (eine Meldung je Modulpaar) und verdünnen
   `readiness.arch` messbar. Bleiben, oder erst ab Schwelle melden?
2. **Schwellen-Kalibrierung:** `crossingFlows: 3` und die R-04-Schwelle stammen aus der Zeit, als
   rohe Kanten gezählt wurden. Bei Verträgen sind sie unkalibriert (zwei moneyflow-Module liegen
   exakt darauf).
3. **Vertragsentscheidung für die 22 SCHEMAs:** erreichbar nur, wenn `FitAdvisory`/`SteeringDelta`
   in contracts wirklich Felder von `MutateResult` werden — eine Vertragsänderung, kein Merge.
4. **Zweite Modulebene:** fünf Module à 14–26 FUNC reißen jede Größenschwelle (R-04 und RD-04 feuern
   jetzt auf allen fünf, MT-02 auf vier). Die Antwort wäre eine Ebene *innerhalb* der Module — nicht
   wieder mehr Module.
5. **ND-02-Deckelung:** `usage_overlap` auf transitive Nutzung (`SCHEMA ← FLOW ← FUNC`) umstellen
   verändert familienweit, was als Duplikat gilt.

**Regel-/Werkzeugkandidaten**

6. Zwei FUNC verschiedener Module auf demselben `realRef`-Symbol (D2).
7. Bericht „Regeln ohne Befund über den gesamten Bestand" (B1).
8. `external` ist keine belastbare Modulgrenze: `MOD-dashboard` (external, 0 FUNC) musste bleiben,
   `MOD-metrics-engine` (3 FUNC in Schwesterpaketen, *nicht* external) konnte aufgehen — beide
   meinen „hier endet das Repo".
9. Modellpflege: `FLOW-element-slice` hängt am falschen Vertrag; `SCHEMA-cli-command` ist zu weit
   gefasst (teilen, nicht mergen); `RD-03` auf `REQ-graph-is-ssot`.

**Betrieb**

10. Publish-Stau: contracts 10.0.0 → se-engine 1.4.0 → graph-api-core 5.4.0 + graphcode-client
    1.3.1 → graphcode. Erst danach lösen sich die 20 roten Tests (2 Publish-Pending + 18
    contracts-10-Fixture-Kollateral).
11. Der laufende Host bootet contracts 9.x — neu starten (E1). **Auch der Fix aus §5.1 greift erst
    nach dem Neustart.**

**Aus dem Nachtrag §5 hinzugekommen**

12. **Vier Folge-CRs, je im Umfang von CR-SM-274** (Zählbasis-Entscheidung + Bestandsmessung):
    `AO-D01`, `AO-D03` (beide `FUNC -io-> FUNC`), `CL-01` (`ACTOR -io-> UC`), `BQ-04` (Setter wird
    nirgends gerufen). Reihenfolge offen.
13. **CR-SM-266-D1-Migration ist unvollständig:** 99 `ACTOR -io-> UC`-Kanten im Bestand, **539
    R-18-Befunde**. Größer als alles andere in dieser Liste.
14. **Die CR-SM-276-Klasse bleibt ungefangen** — legale Kanten falsch gezählt. Ein
    „zweite-Zahl"-Werkzeug (unabhängige Gegenrechnung je Metrikregel) ist nicht entworfen; §5.4
    argumentiert, warum es der wichtigste Kandidat ist.
15. **Gegenrichtung ungeprüft:** 51 Kombinationen über 7 Regeln akzeptieren eine illegale Kante als
    *Erfüllung*. Gemessen, weder gepinnt noch behoben.
16. **`unfedMutations > 0`: Warnung oder Block?** Ein Block im pre-commit-Hook verhindert den
    Commit nach jeder Temp-Store-Session — manchmal genau der Arbeitsmodus.
17. **`bootstrap()`** hat null Aufrufer und umgeht das Audit — löschen oder auf den Tool-Layer.
18. **Das A/B-Experiment aus §5.2 ansetzen** — die einzige Antwort auf „sparen wir gegenüber dem
    freien Lauf". Nicht vor §5.1-Host-Neustart und nicht ohne die Vorbedingung, dass Arm G die
    Präzisions-Queries wirklich fährt.

---

## 4 — Was beim Ausprobieren zu beobachten ist

Der Auftraggeber setzt als nächstes ein neues Projekt auf. Vier Stellen, an denen sich zeigt, ob
der Umbau trägt:

- **Ist der Modulschnitt beim Kaltstart überhaupt sichtbar?** Ein frisches Projekt hat keine
  Module, bis jemand welche anlegt. Die interessante Frage ist, ob `graph_suggest` und
  `graph_next_step` den Schnitt früh genug vorschlagen — oder ob Architektur wieder erst am Ende
  vorkommt (das war der Befund von CR-DRAFT-GC-433).
- **Feuern die reparierten Regeln auf einem neuen Graphen sinnvoll?** CR-01 und R-04 haben heute
  zum ersten Mal überhaupt gemessen. Ein junger Graph mit wenigen Modulen ist der ehrlichste Test.
- **Trägt der Konsolidierungs-Operator ohne Vorlast?** Am gewachsenen Modell fand er acht Gruppen.
  Auf einem neuen Projekt sollte er lange **nichts** vorschlagen — täte er es früh, wäre die
  Kandidatendefinition zu weit.
- **Was sagt der Flugschreiber bei wenigen Ständen?** Die Karte lebt von History; bei drei Commits
  ist sie ehrlich leer. Sie sollte das sagen, statt eine Linie zu zeichnen.

---

## 5 — Nachtrag 2026-08-27: drei Sofortmaßnahmen, drei Befunde

Der Auftraggeber hat nach der Bestandsaufnahme drei Punkte beauftragt. Alle drei sind erledigt;
zwei davon haben mehr gefunden, als die Fragestellung erwartete.

### 5.1 Das Trajektorien-Leck war ein Clobbering, kein Ausbleiben (CR-GC-449, `b7c8802`)

**Root Cause:** `materializeTrajectory` nahm sein **Ausgabeverzeichnis vom `repoRoot`**, projizierte
aber aus dem Log **beim Store** (`FileOperationsLog(harness.getStoreDir())`, CR-GC-232). Eine
Harness mit Temp-Store und echtem `repoRoot` — das Arbeitsmuster **aller** Umbau-Agenten —
überschrieb damit bei *jeder* Mutation die `trajectory.jsonl` des echten Repos vollständig aus
ihrem eigenen, frischen Log. Die zwei gefundenen Zeilen waren nicht die letzten Überlebenden,
sondern der komplette Inhalt des letzten Temp-Logs.

**Der Widerspruch stand wörtlich im Code:** der Doc-Kommentar von `getStoreDir()` sagt „a
temp-store harness must not touch the repo's live `.graphcode`". Unentdeckt blieb er, weil im
Normalbetrieb beide Anker dasselbe Verzeichnis sind und **kein Test je einen Write über eine
Harness mit fremdem Store gefahren hat**.

**Fix:** Feed hängt an `getStoreDir()` (in Produktion ein No-Op, aber `feed === project(log)` gilt
jetzt per Konstruktion); `graph_export` meldet `unfedMutations: N` — der Vergleich zweier Zähler,
die beide schon existierten und nur nie gegeneinander gehalten wurden. Repo-Feed aus dem intakten
`audit.jsonl` neu projiziert: **2 → 301 Zeilen**.

**Was bleibt:** die Provenienz der drei Temp-Store-Sessions ist **endgültig verloren** — ihre Logs
lagen in gelöschten Temp-Verzeichnissen. Ausgerechnet der größte Modellumbau des Projekts hat keine
Spur hinterlassen.

**Lektion (ergänzt E2):** Nicht „der Tool-Layer schreibt die Provenienz", sondern **Quelle und Ziel
einer Projektion müssen denselben Anker haben.** Ein Werkzeug, das aus A liest und nach B schreibt,
ist korrekt, solange A = B — und still zerstörerisch, sobald jemand sie trennt. Das war kein
exotischer Fall: es war der Normalmodus jedes Agenten an diesem Tag.

### 5.2 Die KPIs: nicht belegt — und die Mechanismen waren an diesem Tag aus

Fenster `ef0d6bb..e0c900d` (CR-GC-444…447), Regelauswertung offline gegen die exportierten
Snapshots je Commit, contracts 10.0.0.

| KPI | Wert | Basis |
|---|---|---|
| Graph-vs-Grep | **0,029** | 5 `graph_*`-Aufrufe ÷ 174 Suchoperationen |
| Tool-Nutzung | `graph_impact` **0** · `graph_expand` **0** · `rules_evaluate` 1 | Transkripte |
| Token je Netto-LOC | **nicht berechenbar** (Netto-LOC = −283) | Ersatz: 2,2 Mio. neu erzeugte Token |
| Planungskonformität | 1 Forward-Violation, unverändert | `deriveImplPlan()` auf 3 Snapshots |
| Gate-Health | **nicht berechenbar** (0 Batches im Log) | Ursache = 5.1 |
| Bindung | 88,2 % (112/127 Tests verankert) | `test-selection-audit.mjs` |

**Die beiden Mechanismen, aus denen ein Vorteil gegenüber dem freien Lauf entstehen soll, waren
abgeschaltet:** Präzisions-Queries **nullmal** aufgerufen (stattdessen 174 Suchen — genau das, was
`CLAUDE.md` unter „Efficiency" verbietet), und das Gate sah 0 von 810 SSOT-Deltas.

**Selbstreferenz-Warnung:** Violations 77 → 42, MOD 17 → 6, FLOW 62 → 39 sind gemessen, stammen
aber **ausnahmslos aus graphcodes eigenem Regelkatalog**. Als Beleg gegen einen freien Lauf taugen
sie nicht — es fehlt die Kontrollgruppe.

**Nebenbefund im Messwerkzeug:** `scripts/retro-kpi.mjs` gibt „Gate health 0" (`applied ÷ max(1,
rejected)` bei leerem Log) und „Readiness Δ 0" (gerundetes −0,0001) aus. Zwei Nullen, die wie
Messungen aussehen — der A3-Verstoß im eigenen Werkzeug.

**Das Experiment, das die Frage beantworten würde:** A/B über dieselbe Aufgabe, frischer Worktree je
Arm. **Arm G** mit MCP-Tools/Skills/Gate, **Arm F** mit abgeschaltetem MCP-Server und ohne
`se-*`-Skills. 3–5 bewusst *nicht* modellzentrierte Aufgaben (weiter Blast-Radius,
Schnittstellenänderung, Refactor mit Testnachzug), Reihenfolge randomisiert. Primärmetrik: neu
erzeugte Token bis zum ersten grünen `build && test`. Qualitätsmetrik, die **keinem Arm gehört**:
Zeilen, die in den folgenden 3 Commits erneut angefasst werden (kein Regelkatalog, kein
Readiness-Score — beides wäre Heimvorteil für Arm G). **Zwei Vorbedingungen:** 5.1 muss zu sein,
und Arm G muss `graph_impact`/`graph_expand` tatsächlich fahren — tut er es nicht, ist die
Hypothese leer und der Lauf zu verwerfen.

### 5.3 Regel-Prüfungen: drei weitere Regeln mit demselben Fehler (CR-SM-278, `49f5d5d`)

**Prüfung A** (`se-rule-pair-legality.test.ts`): statische Quelltext-Analyse wurde verworfen
(Regeln filtern frei über `graph.traces`; ein Parser wäre ein zweiter Grammatik-Leser, Drift-Lock
L2). Stattdessen die Konjunktion zweier Schritte: wer schweigt auf dem aus `TRACE_PATTERNS`
**generierten** Referenzgraphen *und* allen 288 Basis-Graphen — und wer davon durch eine der 834
verbotenen Kanten aufwacht. Gegen die rekonstruierte Vor-CR-SM-274-Fassung von CR-01 schlägt sie
mit genau einem Eintrag an, ohne Beifang.

**Was sie ausdrücklich NICHT fängt** (im Dateikopf ausbuchstabiert): die **CR-SM-276-Klasse** —
legale Kanten *falsch gezählt*. Dafür braucht es weiter eine unabhängig erhobene Gegenzahl. Ebenso
außerhalb: Schwellen-/Attributregeln, tote Zweige lebender Regeln, RC-*/CodeFacts.

**Prüfung B** (`npm run report:silence`), angewandt auf 18 Graphen, 0 nicht ladbar:
**21 von 72 Regeln sind stumm.**

| | Regeln |
|---|---|
| **verdächtig (4)** | `AO-D01`, `AO-D03` — zählen `FUNC -io-> FUNC`, **derselbe Fehler wie CR-01/R-04** · `CL-01` — traversiert das mit CR-SM-266 D1 entfernte `ACTOR -io-> UC` · `BQ-04` — braucht `setBQ04SimilarityMatrix()`, **den Setter ruft im gesamten Familie-Baum niemand** |
| ohne Aussage (2) | ND-01/ND-02 (host-injizierte Matrix) |
| legitim (17) | je mit gezähltem fehlenden Zustand (0 ASIL, 0 physische MODs, 0 CR-Status …) |

**Damit ist B1 aus §2 belegt statt vermutet:** die Fehlerklasse „Regel fragt ab, was die Grammatik
nicht kennt" traf nicht zwei Regeln, sondern **mindestens vier** — und `BQ-04` zeigt eine zweite
Variante derselben Krankheit (B2): eine Regel, deren Injektionspunkt nirgends aufgerufen wird.

**Nebenbefund, unabhängig und größer als der Auftrag:** **99 `ACTOR -io-> UC`-Kanten liegen noch im
Bestand** — die CR-SM-266-D1-Migration ist unvollständig und erzeugt **539 R-18-Befunde**.

### 5.4 Was die drei zusammen sagen

Sie treffen alle denselben Nerv: **das System hat mehr Werkzeuge, als es benutzt, und mehr Regeln,
als es auswertet.** Der Feed schrieb sich selbst kaputt, die Präzisions-Queries wurden nullmal
gerufen, vier Regeln fragen nach Unmöglichem, eine wartet auf einen Setter, den niemand ruft, und
die reduzierten Tests lagen ungenutzt daneben. Keiner dieser Befunde ist ein Defekt im Sinne von
„etwas ist kaputtgegangen" — alles war von Anfang an so, nur hat nie jemand die Zahl gegen eine
zweite Zahl gehalten. **Das ist die eigentliche Lektion des Tages, und sie ist mechanisierbar:**
jede Kennzahl braucht eine unabhängig erhobene Gegenzahl, sonst misst sie ihre eigene Existenz.
