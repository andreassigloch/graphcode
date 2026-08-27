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
11. Der laufende Host bootet contracts 9.x — neu starten (E1).

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
