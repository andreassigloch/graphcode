# CR-GC-438 — Spike: Archetyp-Zielprofile + 7. Dimension „Vertragskonzentration" (Eigenvektor-Test)

**Status:** **ABGESCHLOSSEN** (2026-08-27) — **No-Go für D7 als 7. Dimension** (Kill 1 greift, R² 0,89)
· **Angelegt:** 2026-08-26 · **Typ:** Spike (Timebox 1 Session, Trockenübung)
**Vorgänger:** [CR-GC-436](../done/CR-GC-436-spike-architektur-optimierung-graphcode.md) — No-Go
fürs Umhängen, GO für Vertragskonsolidierung; Nachtrag 2 + `scripts/spike-arch-regelkreis.mjs`
sind die Datenbasis dieses Spikes. Zielbild-Artefakt:
`claude.ai/code/artifact/cd55117c-0fcc-4859-be1a-615c86529760`.

> **Trockenübung.** Kein Gate-Write, kein contracts-/se-engine-Change, SSOT unangetastet.
> Ergebnis ist eine **Familie-Review-Vorlage** (R⁶ ist SSOT-verriegelt; Öffnen braucht Messung —
> die liefert dieser Spike), keine Umsetzung.

## Ausgangslage (gemessen, CR-GC-436 / Regelkreis-Trockenübung, graphVersion 208)

Die R⁶-Formeln kodieren implizit **ein** Archetyp-Ideal (verteiltes System ohne Zentrum):

| Dimension | Formel | Verhalten beim Kernel-Umbau (gemessen) |
|---|---|---|
| modifiability | 5·Q (Newman) | **blind**: −0,016 → −0,003 (Regelkreis); im Gate-Lauf sank sie sogar (2,813 → 2,760) bei gutem Zug |
| scalability | 5·(1−maxBetweenness) | **gegenläufig**: bestraft den gewollten Kernel-Hub |
| CR-01 crossingFlows (Policy warning ≥3) | rohe io-Querungen je MOD-Paar | **gegenläufig**: Konzentration auf 10 Paare treibt jedes Paar über die Schwelle |
| coherence / MT-02 | intra-Anteil / LCOM4 | dafür (0-intern-Module 5 → 0) |

Kandidat für die fehlende Achse — **Vertragskonzentration** — reagiert scharf, wo Q blind ist:
Modulrand-Vokabular **29 → 14** verschiedene FLOWs, Top-5-Konzentration **66,3 % → 93,8 %**
(`spike-arch-regelkreis.mjs`, letzte Zeile je Lauf).

**Eigenvektor-Evidenz, bisher 2 Punkte:** der Handschnitt (CR-436 Lauf B) bewegt Q ohne das
Vokabular; der Regelkreis-Schnitt bewegt Vokabular/Konzentration bei Q ≈ 0. Zwei Züge, je eine
Achse — das ist Indiz, kein Test. Der Test über den Bestand ist dieser Spike.

## Die Frage, in einem Satz

Ist „Vertragskonzentration" eine **eigenständige** 7. Dimension (über die Familie-Graphen nicht
als Linearkombination der R⁶ darstellbar), und welche **Zielvektoren je Architektur-Muster**
(Kernel · Pipeline · Layered · Föderiert · Broker · Plugin) sind messbar begründbar?

## Vorgehen — nur lesend

1. **D7-Prototyp als Messfunktion** (`scripts/spike-archetype-eigenvector.mjs`, nur lesend):
   (a) Modulrand-Vokabular — Zählbasis **SCHEMA**, nicht FLOW-Label (Anti-Gaming: SC-04 erzwingt
   SCHEMA am Grenz-FLOW; ein Label-Merge ohne Vertrags-Merge darf die Zahl nicht bewegen);
   (b) Top-k-Konzentration des Randverkehrs (k=5).
2. **Messmatrix 7×N:** die 6 R⁶ (`metrics(G, layer:'arch')`, se-engine) + D7 über die
   verfügbaren Familie-Graphen (graphcode, sigloch-modules-Selbstmodell, graphcodedemo, sirail,
   kadjar, moneyflow, siconizer, …) **plus** die drei Spike-Zustände aus CR-436
   (v208 · Handschnitt · Regelkreis). Nicht ladbare Graphen werden benannt, nicht ersetzt.
3. **Eigenvektor-Test:** lineare Regression D7 ~ R⁶ über die Matrix. Schwelle **vorab**:
   R² ≥ 0,8 ⇒ D7 ist abgeleitet, kein eigener Vektor (Kill 1). Paarweise |r| mitliefern.
4. **Archetyp-Presets:** die 6-Muster-Tabelle (Memory `r6-targets-sind-archetyp-vektoren`)
   gegen die Messmatrix prüfen: unterscheiden sich die Ist-Vektoren der Repos so, wie die
   Muster-Hypothese es vorhersagt (z. B. Web-Vertical moneyflow: hohes Q; Kernel graphcode:
   Q≈0, hohe Konzentration)? Ausgabe: Preset-Katalog `{muster → weights + MetricPolicy}` als
   Entscheidungsvorlage für `se:target-profile`.
5. **Policy-Kopplung messen:** je Familie-Graph, wie viele CR-01-Befunde kippen mit
   `crossingFlows: null` (Kernel-Preset) bzw. distinct-Zählung statt roher Querungen.

## Kill-Kriterien (vorab festgelegt)

1. **Abgeleitet statt eigenständig:** R² ≥ 0,8 der Regression D7 ~ R⁶ ⇒ keine 7. Dimension;
   D7 bleibt Modul-Kennzahl (moduleMetrics-Familie), kein MetricVector-Eintrag.
2. **Gaming-anfällig:** bewegt ein FLOW-Label-Merge ohne SCHEMA-Merge die D7-Zahl, ist die
   Zählbasis falsch — auf SCHEMA-Ebene fixieren oder No-Go.
3. **Presets diskriminieren nicht:** lassen sich die Zielvektoren zweier Muster am Bestand
   nicht messbar unterscheiden, ist der Katalog Prosa und wird nicht vorgeschlagen.

## Ausdrücklich nicht

- Keine Änderung an contracts/se-engine/MetricVector — das ist der **Familie-CR danach**
  (CR-A: D7 + Policy-Presets · CR-B: se:target-profile-Presets · CR-C: Konsolidierungs-Operator
  in fix-templates), den dieser Spike nur **vorlegt**.
- Kein Gate-Write, kein `graph_export`, kein Commit an `docs/graph/*.graph.json`.
- Keine Regel-/Readiness-Änderung, kein LLM im Loop.

## Bereits eingerichtet (dieser Commit, Sofortmaßnahme)

`.graphcode/target-profile.json` steht auf dem **Kernel-Vektor** (vorher: coherence 1,
modifiability 0,7, faultTolerance 0,3, Rest 0):

| Dimension | alt | neu | Warum |
|---|---|---|---|
| coherence | 1 | **1** | reagiert richtig (0-intern 5 → 0) |
| modifiability | 0,7 | **0** | Q ist für Rollen-Schnitte gemessen blind — raus aus dem Ranking |
| faultTolerance | 0,3 | **0** | Single-Writer-Kernel sucht keine Redundanz |
| flowEfficiency | 0 | **0,4** | kurze Wege durch den Regelkreis |
| viability | 0 | **0,4** | eine zusammenhängende Masse um den Kernel ist gewollt |
| scalability | 0 | **−0,2** | der Hub ist Design; Dezentralisierungs-Züge sollen negativ ranken |

`metricPolicy.crossingFlows` bleibt **unverändert** (warning 3), bis Schritt 5 die Bilanz
liefert — das Urteil kippen ist Spike-Ergebnis, nicht Vorgriff.

## Akzeptanzkriterien

- [x] Messmatrix 7×N tabellarisch im Ergebnis-Nachtrag; nicht ladbare Graphen benannt.
- [x] Eigenvektor-Test mit vorab fixierter Schwelle (R² 0,8), Regression + paarweise |r|.
- [x] Anti-Gaming-Probe: Label-Merge ohne SCHEMA-Merge bewegt D7 nicht (Kill 2 geprüft).
- [x] Preset-Katalog je Muster mit Messbeleg oder benanntem Nicht-Beleg (Kill 3).
- [x] CR-01-Kipp-Bilanz je Graph für `null` und distinct-Zählung.
- [x] **Entscheidungsvorlage:** Familie-Review ja/nein mit der tragenden Zahl (R² und
      Konzentrations-Spanne über die Muster). Kein „teils/teils" ohne Zahl.
- [x] Diff berührt nur `scripts/`, `.graphcode/target-profile.json` und diesen CR.
      (`target-profile.json` blieb unverändert — der Kernel-Vektor war die Sofortmaßnahme
      des Anlege-Commits; das Spike-Ergebnis fordert keine Korrektur, s. Nachtrag §7.)

## Dateien (≤ 3)

1. `scripts/spike-archetype-eigenvector.mjs` — Messmatrix + Regression + Anti-Gaming-Probe
2. `.graphcode/target-profile.json` — Kernel-Vektor (bereits mit diesem CR eingerichtet)
3. dieser CR (Ergebnis-Nachtrag)

---

# Ergebnis-Nachtrag (2026-08-27)

**Die Antwort in einem Satz: Nein.** „Vertragskonzentration" ist **keine eigenständige 7.
Dimension** — die Regression D7 ~ R⁶ über die Messmatrix liefert **R² = 0,89** (Schwelle des
CR: ≥ 0,80 ⇒ abgeleitet), und der df-ehrliche Teil desselben Befunds ist noch schärfer:
**`flowEfficiency` allein erklärt D7 mit r = 0,89 / R² = 0,79** (ein Prädiktor, keine
Freiheitsgrad-Inflation; leave-one-out R² = 0,67).

Treiber: `scripts/spike-archetype-eigenvector.mjs` (nur lesend). **Trockenübung eingehalten:**
kein Gate-Write, kein `graph_export`, kein Store-Zugriff; SHA-256 von
`docs/graph/graphcode.graph.json` vor = nach dem Lauf (`26ee99b4…`).

**Grammatik-Pin:** `@sigloch/contracts` **10.0.0** (lokale Arbeitskopie, `node_modules/@sigloch/*`
sind Symlinks nach `sigloch-modules/packages/*` — **unpubliziert**, die Registry kennt 10.0.0 nicht),
`@sigloch/se-engine` **1.4.0**. graphcode-SSOT **graphVersion 212** (CR-436 maß v208 — die drei
Spike-Zustände sind deshalb auf v212 neu nachgestellt, nicht aus CR-436 übernommen).

## 1 · Messmatrix (N = 9 primär: 7 reale Repo-SSOTs + 2 Spike-Zustände)

R⁶ = `metrics(G, {layer:'arch'})`. D7 in zwei Zählweisen: `pair` = Produzent×Konsument je
Randfluss (CR-436-Zählweise, hub-empfindlich), `edge` = io-Kanten am Randfluss, 1/|SCHEMA|
gewichtet (produkt-invariant). V = Modulrand-Vokabular in **SCHEMAs**, X = Randverkehr,
C5 = Top-5-Anteil.

| Graph | ver | mod | flt | flw | coh | via | scl | D7ᵖᵃⁱʳ | V | X | C5 | D7ᵉᵈᵍᵉ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| graphcode | 212 | 2,79 | 5,00 | 0,88 | 3,84 | 5,00 | 3,58 | **4,80** | 20 | 172 | 80 % | 4,59 |
| graphcodedemo | 10 | 2,91 | 2,83 | 0,00 | 3,67 | 5,00 | 3,76 | **2,33** | 18 | 31 | 35 % | 3,53 |
| moneyflow | 1 | 4,55 | 1,61 | 0,02 | 4,79 | 3,08 | 3,51 | **2,78** | 66 | 117 | 25 % | 3,90 |
| siconizer | 59 | 2,52 | 3,70 | 0,79 | 3,63 | 4,80 | 4,03 | **4,44** | 5 | 31 | 100 % | 4,51 |
| gc_test-graphview | 41 | 2,88 | 3,06 | 0,00 | 3,65 | 5,00 | 2,13 | **2,68** | 6 | 10 | 90 % | 3,96 |
| gc_test-sqlite | 2 | 3,43 | 1,76 | 0,22 | 4,17 | 5,00 | 3,13 | **3,81** | 21 | 53 | 60 % | 4,41 |
| aimpro-familie ¹ | — | 3,46 | 2,41 | 0,09 | 4,15 | 4,67 | 3,69 | **4,18** | 5 | 18 | 100 % | 4,06 |
| graphcode~handschnitt ² | 212* | 2,95 | 5,00 | 0,84 | 3,61 | 5,00 | 3,98 | **4,86** | 22 | 383 | 61 % | 4,55 |
| graphcode~regelkreis ² | 212* | 2,56 | 5,00 | 0,97 | 3,79 | 5,00 | 4,17 | **4,96** | 17 | 879 | 71 % | 4,76 |

¹ historisch — aimpro ist am 2026-08-22 aus der Familie ausgetreten; der Graph ist der letzte
Familie-Stand. ² in-memory auf v212 nachgestellt (kein Gate, kein Store).
Sekundär (synthetisch, nur in der Sensitivitäts-Regression): `greenfield-trial`
(2,88 / 2,29 / 0,50 / 3,75 / 4,83 / 3,15 · D7ᵖᵃⁱʳ 3,91).

**Nicht in die Matrix aufgenommen — benannt, nicht ersetzt:**

| Graph | Warum |
|---|---|
| **sirail** | Modulrand nicht messbar: **kein FLOW hat einen FUNC-Produzenten** (io FUNC→FLOW = 0, FLOW→FUNC = 40) ⇒ 0 Randquerungen. R-10-Vorlast, kein Spike-Artefakt. **Zusätzlicher Vorbehalt:** Store/SSOT divergent — `.graphcode/EXPORT_PENDING` seit 2026-08-18; gemessen wäre ohnehin der stale Export gewesen, nicht der Live-Store. |
| **kadjar** (`graph-view-edit/docs/graph/kadjar.graph.json`) | Arch-Layer leer: 0 FUNC · 0 FLOW · 0 allocate (reiner REQ/UC-Dokumentgraph, 309 Elemente). **Zusätzlich der vorbestehende BQ-06-Crash:** `evaluateAllRules` wirft `Cannot read properties of undefined (reading 'trim')` — `bq06Conforming` liest `req.description.trim()` ohne Guard (`quality-rules.js:145`). Vorlast, nicht umgangen. |
| **sigloch-modules** | 6 MOD / 11 FUNC / 4 FLOW, aber nur 1 io FUNC→FLOW und 3 FLOW→FUNC ⇒ 0 Modulgrenzen-Querung. Das Selbstmodell beschreibt Pakete, keinen Datenfluss. |
| **bok** | 0 MOD, 0 FLOW — Dokumentgraph. |
| **graphify** | 12 MOD, 3 FLOW, **0 SCHEMA** — die SCHEMA-Zählbasis ist leer, D7 nicht definierbar. |
| **graph-view-edit** | nur **9** Randquerungen (Schwelle 10) — bei X < 10 ist jede Konzentrationszahl Arithmetik. Sensitivitätslauf mit Schwelle 5 nimmt es auf (s. §3), das Urteil ändert sich nicht. |
| gve-sandbox | X = 1. |

## 2 · Eigenvektor-Test (Kill 1) — greift

| Zielgröße | R² | R²_adj | R²_LOO | p (Permutation) | Urteil an der vorab fixierten Schwelle |
|---|---|---|---|---|---|
| **D7 pair/schema** | **0,8925** | 0,570 | −7,22 | 0,285 | **Kill 1 greift** |
| D7 edge/schema | 0,9685 | 0,874 | −1,17 | 0,089 | **Kill 1 greift** |
| V/X (Vokabulardichte) | 0,9321 | 0,728 | −4,24 | 0,182 | **Kill 1 greift** |
| C5 (Top-5-Anteil) | 0,4528 | −1,19 | −39,4 | 0,903 | greift nicht |

Paarweise |r| gegen D7ᵖᵃⁱʳ, mit dem Einzel-Prädiktor-Fit (p = 1 — **die Zahlen ohne
Freiheitsgrad-Problem**):

| Dimension | r | R²₁ | R²₁ LOO |
|---|---|---|---|
| **flowEfficiency** | **+0,888** | **0,788** | **0,670** |
| faultTolerance | +0,709 | 0,503 | 0,282 |
| scalability | +0,565 | 0,320 | 0,054 |
| modifiability | −0,442 | 0,195 | −0,080 |
| viability | +0,362 | 0,131 | −1,689 |
| coherence | −0,269 | 0,072 | −0,643 |

**Was das mechanisch heißt:** `flowEfficiency = 5·(1/max(1, meanIO))·reachF` misst die mittlere
Länge des Input→Output-Pfads. Ein Rand, der über wenige, schwere Verträge läuft, hat kurze
io-Pfade — D7 und flowEfficiency messen dieselbe Sache von zwei Seiten. Die Eigenvektor-Evidenz
aus CR-436 („Handschnitt bewegt Q ohne Vokabular, Regelkreis bewegt Vokabular bei Q ≈ 0") war
korrekt, aber **gegen die falsche Dimension geprüft**: Q (modifiability) ist tatsächlich
orthogonal zu D7 (r = −0,44) — flowEfficiency war es nie, und in den beiden Spike-Zuständen
steigt sie mit (0,88 → 0,84 → 0,97).

**Methodischer Vorbehalt, nicht kleingeredet:** Bei N = 9 und 6 Prädiktoren liegt das
Permutations-Null-Mittel bei R² ≈ 0,74 — die vorab fixierte 0,80-Schwelle liegt am Rauschboden,
und die Vollmodell-R² allein wären kein Beleg. Deshalb ist die **tragende Zahl der
Einzel-Prädiktor-Fit gegen flowEfficiency (R²₁ = 0,79, LOO 0,67)** und nicht die 0,89: der ist
df-sauber und übersteht die Kreuzvalidierung. Beide zeigen in dieselbe Richtung.

## 3 · Sensitivität — das Urteil ist stabil

| Variante | N | R² (D7 pair) | Urteil |
|---|---|---|---|
| primär | 9 | 0,8925 | Kill 1 greift |
| + synthetischer Rig-Graph (`greenfield-trial`) | 10 | 0,8925 | Kill 1 greift |
| Schwelle X ≥ 5 (nimmt `graph-view-edit` auf) | 10 | 0,8934 | Kill 1 greift |

`GC438_MIN_X=5 node scripts/spike-archetype-eigenvector.mjs` reproduziert die dritte Zeile.

## 4 · Anti-Gaming-Probe (Kill 2) — SCHEMA-Zählbasis besteht, `pair` mit Rest

Der Zug: 35 FLOW-Knoten auf 14 Labels zusammenlegen, die SCHEMAs **nicht** anfassen.

| Variante | FLOW/pair V · D7 | SCHEMA/pair V · D7 · X | SCHEMA/edge V · D7 · X |
|---|---|---|---|
| Basis (graphcode SSOT) | 29 · 4,65 | 20 · 4,80 · 172 | 20 · **4,59** · 155 |
| nur FLOW-Label gemergt | **15 · 4,96** | 25 · 4,95 · 1539 | 25 · **4,59** · 182 |
| FLOW + SCHEMA gemergt | 15 · 4,96 | 18 · 4,96 · 980 | 18 · 4,70 · 236 |

- **Zählbasis FLOW-Label ist gameable:** Vokabular 29 → 15 (**−48 %**) für einen Zug, der keinen
  einzigen Datenvertrag konsolidiert. Der Verdacht des CR ist bestätigt.
- **Zählbasis SCHEMA nimmt den Zug nicht an:** das Vokabular **wächst** 20 → 25, weil der Merge
  zusätzliche SCHEMAs an den Rand zieht. Kein Gewinn — die Manipulation schlägt zurück.
- **Restbewegung nur in der `pair`-Zählweise:** D7 4,80 → 4,95 (Δ +0,15), Ursache ist die
  Produzent×Konsument-Explosion X 172 → 1539 (**CR-436 Befund 3**, Hub-Inflation — nicht die
  Zählbasis). Die `edge`-Zählweise ist davon **exakt invariant** (Δ = −0,00 bei X 155 → 182).
  ⇒ Kill 2 ist bestanden **für SCHEMA/edge**; SCHEMA/pair erbt die bekannte Hub-Empfindlichkeit.
- **Der Zug käme ohnehin nicht durchs Gate:** der Label-Merge erzeugt **5 FLOWs mit > 1 SCHEMA**,
  die Grammatik verlangt `FLOW -relation-> SCHEMA [1..1]` (R-18-Kardinalität). Der Schutz gegen
  dieses Gaming ist strukturell, nicht statistisch — genau wie in CR-436 Nachtrag 2 Punkt 1.

## 5 · Preset-Katalog (Kill 3) — greift: kein Katalog

| Muster | n | mod | flt | flw | coh | via | scl | D7 |
|---|---|---|---|---|---|---|---|---|
| Kernel (graphcode, gc_test-sqlite) | 2 | 3,11 | 3,38 | 0,55 | 4,01 | 5,00 | 3,35 | 4,30 |
| Föderiert (graphcodedemo, aimpro-familie) | 2 | 3,18 | 2,62 | 0,05 | 3,91 | 4,84 | 3,73 | 3,25 |
| Layered (moneyflow, gc_test-graphview) | 2 | 3,72 | 2,33 | 0,01 | 4,22 | 4,04 | 2,82 | 2,73 |
| Pipeline (siconizer) | 1 | 2,52 | 3,70 | 0,79 | 3,63 | 4,80 | 4,03 | 4,44 |
| **Broker** | **0** | — | | | | | | |
| **Plugin** | **0** | — | | | | | | |

Die Mittelwerte sehen aus, als trennten sie (Kernel vs Layered auf flowEfficiency und D7,
Föderiert vs Layered auf scalability). **Sie trennen nicht messbar:** zieht man aus den 7 realen
Graphen zwei **zufällige** Zweiergruppen, findet man in **85,3 %** der Ziehungen mindestens eine
„trennende" Dimension, im Mittel **2,17** davon (5000 Ziehungen). Bei n = 2 ist
Bereichs-Nichtüberlappung Arithmetik, kein Befund. Dazu: **2 der 6 Muster (Broker, Plugin) haben
im Bestand keinen einzigen Vertreter.**

⇒ **Kill 3 greift. Ein Preset-Katalog wird nicht vorgeschlagen** — er wäre Prosa mit
Zahlen-Anstrich. Der belastbare Rest ist eine Beobachtung, kein Preset: die drei Systeme mit
kurzen io-Pfaden (graphcode 0,88 · siconizer 0,79 · graph-view-edit 0,55) sind genau die mit
hoher Vertragskonzentration (D7 4,80 · 4,44 · 4,16 — graph-view-edit aus dem
Sensitivitätslauf), die drei mit flowEfficiency ≈ 0 (graphcodedemo, moneyflow,
gc_test-graphview) genau die mit breitem Rand (2,33 · 2,78 · 2,68). Das ist §2 noch einmal,
keine Musterlehre.

## 6 · CR-01-Kipp-Bilanz — die Regel feuert nirgends

| Graph | ausgelieferte Regel | als io-Pfad gemeint, roh | distinct-Verträge | kippen |
|---|---|---|---|---|
| graphcode | **0** / 0 Befunde | 20 warn / 47 Paare | 7 warn / 47 | 13 |
| graphcodedemo | **0** | 6 / 14 | 3 / 14 | 3 |
| moneyflow | **0** | 11 / 63 | 8 / 63 | 3 |
| siconizer | **0** | 5 / 7 | 0 / 7 | 5 |
| gc_test-graphview | **0** | 0 / 7 | 0 / 7 | 0 |
| gc_test-sqlite | **0** | 0 / 53 | 0 / 53 | 0 |
| aimpro-familie | **0** | 2 / 9 | 0 / 9 | 2 |
| greenfield-trial | **0** | 1 / 13 | 0 / 13 | 1 |
| graphcode~handschnitt | **0** | 24 / 44 | 11 / 44 | 13 |
| graphcode~regelkreis | **0** | 10 / 13 | 9 / 13 | 1 |
| **Summe** | **0** | **79** | **38** | **41** |

**`crossingFlows: null` kippt 0 Befunde — auf jedem Graphen der Familie.** Root Cause:
`cr01CrossingFlowCount` (`contracts/dist/se/ao-rules.js:152-198`) sucht **direkte io-Kanten
FUNC→FUNC**; die Grammatik kennt für `io` nur `ACTOR↔FLOW` und `FUNC↔FLOW` (`TRACE_PATTERNS`),
eine FUNC→FUNC-io-Kante würde R-18 sofort ablehnen. Die Regel kann seit dem Meta-Modell-Stand
nicht mehr feuern und tut es in keinem der 10 Graphen. Die Annahme der Ausgangslage dieses CR
(„Konzentration auf 10 Paare treibt jedes Paar über die Schwelle") ist damit **gegenstandslos**:
CR-01 bestraft Vertragskonzentration nicht, weil CR-01 nichts bestraft.

Die Kipp-Zahl **41 von 79** (52 %) gilt für die Regel, **wie der Regelkopf sie meint** (io-Pfad
FUNC→FLOW→FUNC je MOD-Paar). Sie ist die Bilanz für einen Bugfix, nicht für ein Preset.

## 7 · Entscheidungsvorlage fürs Familie-Review

**Empfehlung: kein Familie-Review zur Öffnung von R⁶ ansetzen.** Die drei vorgesehenen Folge-CRs
verlieren mit diesem Ergebnis ihre Grundlage:

| CR | war geplant als | Ergebnis | Kosten, die entfallen |
|---|---|---|---|
| **CR-A** | D7 + Policy-Presets in contracts/se-engine (`MetricVector` von ℝ⁶ auf ℝ⁷) | **fällt weg** — Kill 1: R² 0,89, flowEfficiency allein R²₁ 0,79 | contracts-Major (MetricVector ist ein publizierter Zod-Vertrag), Rollout über alle 5 `@sigloch/*`-Consumer, Neu-Baselining jedes Zielprofils, Golden-Files der Metrik-Tests |
| **CR-B** | `se:target-profile`-Presets je Architektur-Muster | **fällt weg** — Kill 3: Trennung im Zufallsbereich (P = 0,85), Broker/Plugin unbesetzt | Skill-Änderung + 6 gepflegte Preset-Vektoren ohne Messbeleg |
| **CR-C** | Operator „Verträge bündeln" in `fix-templates` | **bleibt sinnvoll, aber aus anderem Grund** — nicht um D7 zu heben, sondern weil FLOW-Merge ohne SCHEMA-Merge am Gate scheitert (5 R-18-Kardinalitätsfehler) und die Bündelung heute Handarbeit ist | — |

**Was stattdessen getan werden kann, ohne einen einzigen Vertrag zu ändern:** wer
Vertragskonzentration steuern will, erhöht das Gewicht von **`flowEfficiency`** im Zielprofil.
Das ist keine Näherung, sondern dieselbe Größe (r = 0,89) — und `.graphcode/target-profile.json`
ist Config, kein SSOT. Der hinterlegte Kernel-Vektor (`flowEfficiency 0,4`) bleibt deshalb
**unverändert**; ob 0,4 → 0,7 richtig ist, ist eine Zielentscheidung des Auftraggebers, kein
Messergebnis.

**Zwei Befunde, die einen eigenen CR verdienen (nicht Teil dieses Spikes):**

1. **CR-01 ist tot** (§6). Entweder auf den io-Pfad FUNC→FLOW→FUNC reparieren — dann kommen 79
   warnings familienweit hoch, davon 41 kippen bei distinct-Zählung — oder ersatzlos streichen.
   Der heutige Zustand („Regel existiert, feuert nie, Policy-Schwelle wird gepflegt") ist die
   schlechteste der drei Varianten. Familie-CR an contracts.
2. **BQ-06 crasht auf REQ ohne `description`** (`quality-rules.js:145`, `req.description.trim()`
   ohne Guard) — macht `evaluateAllRules` auf kadjar-artigen Graphen unbenutzbar. Einzeiler,
   contracts.

**Modellpflege-Befunde am Bestand (Nebenprodukt der Messung):** `sirail` hat **keinen einzigen
FLOW-Produzenten** (40 Konsum-Kanten, 0 Produktions-Kanten) und dazu einen seit 2026-08-18
divergenten Store; `graphify` hat 3 FLOWs und **0 SCHEMA**; `sigloch-modules` modelliert Pakete
ohne Datenfluss. Diese drei Graphen können an keiner Fluss-basierten Kennzahl teilnehmen —
weder an D7 noch an `flowEfficiency` noch an CR-01.

## 8 · Offene Fragen

- **N = 9 ist die Grenze des Bestands.** Vier weitere Familie-Graphen scheitern an fehlenden
  FLOW-Produzenten oder fehlenden SCHEMAs — das ist ein Modellpflege-Befund, aber es heißt auch:
  eine Metrik-Frage mit 6 Prädiktoren ist an diesem Bestand grundsätzlich nur über
  Einzel-Prädiktor-Fits ehrlich beantwortbar. Vor der nächsten Metrik-Öffnung erst die drei
  Modelle reparieren.
- **Die `pair`-Zählweise bleibt hub-empfindlich.** CR-436 Befund 3 ist hier zum zweiten Mal
  aufgetreten (X 172 → 1539 durch einen Merge, der im Code keine Kopplung erzeugt). Solange
  `moduleMetrics.cohesion` auf derselben Zählweise steht, ist jede Kohäsions-Ratio durch
  FLOW-Splitting manipulierbar. Gehört in die CR-SM-223-Validierung, nicht hierher.
- **Ist `flowEfficiency` selbst richtig geeicht?** Fünf von neun Graphen liegen unter 0,3 von 5
  — die Dimension nutzt ihren Wertebereich kaum. Wenn sie künftig die Steuergröße für
  Vertragskonzentration trägt, ist ihre Skalierung zu prüfen. Eigener Spike.
