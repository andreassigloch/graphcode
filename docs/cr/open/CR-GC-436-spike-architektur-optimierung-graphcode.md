# CR-GC-436 — Spike: echte Architektur-Optimierung von graphcode (Trockenübung im Graph)

**Status:** offen · **Angelegt:** 2026-08-26 · **Typ:** Spike (Timebox 1 Session)
**Vorgänger:** CR-GC-407 (No-Go) · CR-GC-408 (No-Go) · CR-GC-427 (GO) · CR-GC-430 (GO) ·
CR-GC-432 (nicht messbar) — deren Wert kam aus scharfen Kill-Kriterien; hier gilt dasselbe.
**Hängt ab von:** [CR-GC-435](CR-GC-435-fix-templates-koennen-nur-anhaengen.md) (Umhängen)

> **Trockenübung.** Dieser Spike ändert den produktiven Graphen nicht und entscheidet nichts.
> Er misst, ob eine Architektur-Optimierung von graphcode überhaupt etwas bringt und was sie am
> Code kosten würde. **Die Umsetzungsentscheidung trifft der Auftraggeber danach.**

## Ausgangslage (gemessen, graphVersion 207 — nicht neu zu erheben)

| Befund | Wert |
|---|---|
| Verbindungen, die im eigenen Modul bleiben | **34 von 434 = 7,8 %** |
| Module mit **0** internen Verbindungen | 5 |
| `MOD-skills` | 25 FUNC, 81 Verbindungen, davon **0 intern** |
| `MOD-harness` | 15 FUNC, **93 externe** Verbindungen |
| `FUNC-block-anschluss` | 15 Kinder auf einer Ebene (RD-04) |
| offene Architektur-Befunde | **13** — R-04 ×5, RD-04 ×5, MT-02 ×3 |

**Zielprofil** (seit 2026-08-26 hinterlegt, `.graphcode/target-profile.json`):
`coherence 1 · modifiability 0,7 · faultTolerance 0,3 · flowEfficiency 0 · viability 0 ·
scalability 0`. Damit hat die Optimierung erstmals eine Richtung — vorher war jeder Δm-Score
richtungslos.

Ein Modulschnitt, bei dem 92 % aller Verbindungen die Modulgrenze kreuzen, ist keine
Modularisierung, sondern eine Namensvergabe. Das ist die These, die der Spike prüft.

## Die Frage, in einem Satz

Lässt sich der Modulschnitt von graphcode **allein durch Umhängen von Allokationen im Graphen**
messbar in Richtung des hinterlegten Zielprofils bewegen — und was würde derselbe Umbau **am
Code** kosten?

## Schritt 0 — Vorbedingungen, vor dem ersten Lauf zu klären

Ohne diese drei Punkte misst der Spike Drift statt Architektur:

1. **Welche Grammatik gilt?** `package.json:47` deklariert `@sigloch/contracts: ^6.0.0`, im Baum
   liegt **9.1.0**. Der Spike pinnt die Version, gegen die gemessen wird, und schreibt sie ins
   Ergebnis. CR-GC-430 hat den Repo-SSOT genau deshalb gemieden (CR-GC-429 offen).
2. **Ist der Repo-SSOT unter dieser Grammatik überhaupt ladbar?** Vor dem ersten Zug einmal
   `rules_evaluate` über den importierten Graphen — bestehende R-18-Fehler sind Vorlast, kein
   Spike-Ergebnis, und müssen als Baseline ausgewiesen werden (das Gate blockt nur auf **neu**
   eingeführten Verstößen, `src/harness.ts:442-447`).
3. **Ist CR-GC-435 da?** Siehe Kill-Kriterium 1 — ohne Umhängen gibt es nichts anzuwenden.

## Vorgehen — nur im Graph, nie am produktiven SSOT

Muster von CR-GC-430 (`tests/steering.divergence-two-profiles.test.ts:131-139`), aber mit dem
**echten Repo-Graphen** als Startzustand statt eines Fixtures:

- Startgraph: `docs/graph/graphcode.graph.json` (der exportierte SSOT, gelesen — nie geschrieben).
- Je Lauf ein **eigener Kuzu auf Disk** in `mkdtempSync(...)`, nie `:memory:`, nie der Repo-Store.
  Der produktive Store bleibt unangetastet; nach dem Lauf `rmSync`.
- Alle Züge über das echte Gate (`harness.mutate()` / `graph_mutate`), kein Direktschreiben.
- Endwerte **aus dem Store zurückgelesen** (`loadGraph()`), nicht aus der Arbeitskopie.
- Ranken, messen, urteilen auf `layer:'arch'` — eine Währung statt zwei (CR-GC-352/431).
- Aktor: perfekt und skriptiert, kein LLM. Der Spike misst die **Obergrenze**; kommt hier nichts
  heraus, kann kein Modell es retten.

**Zwei Läufe, weil sie verschiedene Fragen beantworten:**

- **Lauf A — greedy:** nimm die bestbewertete anwendbare Suggestion, wiederhole bis zur
  Erschöpfung. Das ist, was der Autopilot heute leisten kann.
- **Lauf B — Handschnitt:** ein von Hand entworfener Ziel-Modulschnitt (z. B. `MOD-skills`
  aufteilen, den Rest von `MOD-repo-root` verteilen), als Batch durchs Gate. Das ist die
  Obergrenze dessen, was **überhaupt** drin ist — und der Maßstab, an dem Lauf A gemessen wird.

## Zu messen

1. **Kohäsion je Modul und gesamt** — aus `graph_metrics` (`src/tools/metrics.ts`, dünnes Binding
   auf `moduleMetrics` aus contracts, dieselbe Rechnung wie MT-01/MT-02): `cohesion.{internal,
   external,ratio}`, `instability`, `lcom4`, je MOD, vorher/nachher. Die Gesamtzahl (heute 7,8 %)
   und die fünf Nullen sind die Schlagzeile.
2. **Die ℝ⁶-Metriken gegen das Zielprofil** — `metrics(G, {layer:'arch'})`, Projektion der
   Trajektorie (Ende − Start) auf die Einheitsrichtung des hinterlegten Profils. **Eine** ehrliche
   Zahl, kein Zahlenstapel.
3. **Zahl der Architektur-Befunde** vorher/nachher: R-04, RD-04, MT-02 einzeln — und getrennt
   ausgewiesen, welche **geschlossen** und welche **neu entstanden** sind.
4. **Anwendbarkeit** — wie viele Züge liefert der Vorschlagspfad überhaupt, bevor nichts mehr
   kommt (die Reichweite aus CR-GC-430 §4, hier auf dem realen Graphen).

### Die Falle, die dieser Spike ausdrücklich prüft

`graph_metrics.cohesion` misst gegen **deklarierte MOD**. Die ℝ⁶-Dimension `coherence` misst
gegen **detektierte Communities**:

```
@sigloch/se-engine/dist/metrics.js:22,  metrics.d.ts:14
  detectCommunities(...) + intraEdgeFraction(...)
  coherence = 5 · intraEdgeFraction   — community-interner Kantenanteil
```

Das sind zwei verschiedene Nenner. Eine bessere MOD-Kohäsion hebt `coherence` **nicht
mechanisch** — die Louvain-Communities können unverändert bleiben, während die Modulzuordnung
sich komplett dreht. CR-GC-430 hat genau das schon gesehen: dort endete `coherence` in **beiden**
Läufen bei exakt 4.3103, obwohl die Endgraphen sich in 8 Kanten unterschieden. Beide Zahlen
gehören ins Ergebnis, nebeneinander, mit dem Unterschied benannt. Wer nur eine berichtet, misst
das Falsche.

## Evaluierung am Code (zweite Hälfte, nach der Trockenübung)

Für jeden im Graphen vollzogenen Umhängevorgang wird — **ohne eine Zeile Code zu bewegen** —
ausgewiesen:

1. **Welche Datei müsste real wandern?** Über `realRef` der umgehängten FUNC und `MOD.path` des
   Zielmoduls. Die Datei→Modul-Auflösung ist im Regelwerk schon da und ist die eine Quelle:
   `@sigloch/contracts/dist/se/conformance-rules.js:281-310` (`buildModResolver`) — `realRef`
   einer allozierten FUNC zuerst, `MOD.path`-Präfix danach.
2. **Wie groß ist das Refactoring?** Zahl der Dateien, Zahl der Importzeilen, die sich ändern.
   Nur 4 von 17 MOD tragen heute überhaupt ein `path` (`MOD-docs`, `MOD-hooks`, `MOD-host-bridge`,
   `MOD-mcp-tools`) — für die übrigen 13 ist „wohin auf der Platte" noch gar nicht beantwortet.
   Das ist selbst ein Ergebnis.
3. **Was bricht?** RC-05 (Cross-Module-Drift) und `importCoverage` lesen aus demselben Resolver.
   Hängt eine FUNC mit `realRef` um, ohne dass die Datei folgt, verschieben sich RC-05-Befunde,
   obwohl kein Code sich geändert hat. Zu berichten: RC-05-Bilanz **vor** dem Dateiumzug (nur
   Graph) und **nach** einem hypothetischen Umzug.
4. **Öffentliche Oberfläche.** graphcode ist ein publiziertes npm-Paket; `src/index.ts` und die
   Exportpfade sind ein Vertrag. Was ein Umbau daran anfassen müsste, gehört benannt.

## Kill-Kriterien — die ehrliche Hälfte

**No-Go** (= die Architektur-Optimierung wird nicht umgesetzt), wenn eines zutrifft:

1. **Nicht anwendbar.** Die nötigen Umhängungen kommen ohne CR-GC-435 gar nicht durchs Gate
   (heute: **kein einziger** anwendbarer Architektur-Vorschlag am Repo-Graphen, R-18-Kardinalität
   `FUNC -allocate-> MOD [0..1]`). Ist CR-GC-435 nicht da, endet der Spike **hier**, mit genau
   diesem Satz als Ergebnis — nicht mit einem Workaround am Gate vorbei.
2. **Kohäsion steigt nicht messbar.** Der modulinterne Anteil kommt nicht deutlich über die
   heutigen 7,8 %. Die Schwelle wird **vor** dem Lauf festgelegt und ins CR geschrieben, nicht
   hinterher passend gewählt.
3. **Mehr kaputt als heil.** Der Umbau erzeugt mehr neue Architektur-Befunde (R-04/RD-04/MT-02
   und andere), als er schließt. Netto-Bilanz ≤ 0 ⇒ No-Go.
4. **Richtungslos.** Die Trajektorie läuft nicht in Richtung des hinterlegten Zielprofils,
   obwohl jeder Einzelschritt es behauptet (die 407-Falle: Paar-Deltas positiv, Trajektorie
   nicht). Zusätzlich zu prüfen: versprochene Schritt-Scores vs. realisierte Trajektorie.
5. **Der Code trägt es nicht.** Die Trockenübung sieht gut aus, aber die Code-Evaluierung ergibt
   ein Refactoring, das die harte CR-Größenregel (≤ 6 Dateien je CR) über eine unvertretbare Zahl
   von CRs streckt — dann ist der Befund „der Schnitt ist falsch, der Umbau ist zu teuer", und
   das ist ein legitimes, ehrliches Ergebnis.

**Ausdrücklich KEIN Kill-Kriterium:** dass `coherence` sich nicht bewegt, während die
MOD-Kohäsion steigt. Das ist ein Befund über die **Metrik** (zwei Nenner, s. o.), kein Befund
über den Umbau — und gehört als solcher berichtet, nicht als Misserfolg verbucht.

## Ausdrücklich nicht

- **Keine Änderung am produktiven Graphen.** Kein `graph_mutate` gegen den Repo-Store, kein
  `graph_export`, kein Commit an `docs/graph/graphcode.graph.json`.
- **Kein Code-Refactoring.** Die Code-Hälfte ist eine Schätzung auf Basis von `realRef`/`MOD.path`,
  keine Dateiverschiebung.
- Kein LLM im Loop, keine Regel-/Readiness-/Metrik-Änderung, kein Produktionscode.
- Keine Entscheidung über die Umsetzung — die trifft der Auftraggeber nach dem Ergebnis.

## Akzeptanzkriterien

- [ ] Vorbedingungen aus Schritt 0 beantwortet und im Ergebnis notiert (contracts-Version,
      Baseline-Verstöße, CR-GC-435-Stand).
- [ ] Alle Läufe über das echte Gate, Disk-Kuzu im Temp-Verzeichnis, Endwerte aus dem Store
      zurückgelesen. Der produktive Store und `docs/graph/*.graph.json` sind nachweislich
      unverändert (Hash vorher/nachher).
- [ ] Kohäsion je Modul **und** gesamt, vorher/nachher, tabellarisch — inkl. der fünf Module mit
      heute 0 internen Verbindungen.
- [ ] ℝ⁶-Vektor vorher/nachher **und** die Projektion auf das hinterlegte Zielprofil: **eine**
      Zahl. Der Unterschied MOD-Kohäsion vs. `coherence` explizit benannt.
- [ ] Befund-Bilanz getrennt nach geschlossen / neu entstanden, je Regel-ID.
- [ ] Lauf A (greedy) und Lauf B (Handschnitt) nebeneinander — der Abstand ist die Aussage über
      den heutigen Autopiloten.
- [ ] Code-Evaluierung: Liste der Dateien, die wandern müssten, mit Zielmodul; Schätzung der
      Importänderungen; RC-05-Bilanz vor/nach hypothetischem Umzug; benannte Bruchstellen an der
      öffentlichen Oberfläche.
- [ ] **Entscheidungsvorlage:** GO oder No-Go mit der tragenden Zahl und dem greifenden
      Kill-Kriterium. Kein „teils/teils" ohne benannte Zahl.
- [ ] Diff berührt nur `tests/` bzw. `scripts/` und diesen CR.

## Dateien (≤ 3)

1. `tests/arch.optimization-dry-run.spike.test.ts` — der Spike-Treiber (Lauf A + Lauf B)
2. `scripts/spike-arch-code-impact.mjs` — die Code-Evaluierung (realRef → Datei → Zielmodul)
3. dieser CR (Ergebnis-Nachtrag)

---

# Ergebnis-Nachtrag (2026-08-26, Auftraggeber-Zuschnitt)

**Geänderter Zuschnitt (Auftraggeber, wörtlich):** Start auf den beiden Top-Sichten
(Top-Level-Funktionssicht, Top-MOD-Sicht), Ziel Kreuz-und-quer-Verlinkungen und parallele
Pfade vermeiden, **Verbesserungsvorschlag ohne Code-Änderung**, Bewertung aus Coder-Sicht —
„es muss die Codequalität sichtbar verbessern, nicht nur die 2 oder mehr Kennzahlen
optimieren". Damit entfällt Lauf A (greedy, hätte ohne CR-GC-435 ohnehin bei Kill 1
geendet); Lauf B wurde als **In-Memory-Simulation** gefahren (kein Gate, kein Store —
noch trockener als geplant). Skripte: `scripts/spike-arch-top-views.mjs` (Vermessung),
`scripts/spike-arch-handschnitt.mjs` (Vorschlag vorher/nachher). SSOT nachweislich
unangetastet (nur Lesezugriff, `git status` sauber).

**Schritt 0:** contracts 9.1.0 (Link-Modus, `aise local on`), graphVersion 208,
CR-GC-435 offen. Baseline-Verstöße: unverändert gegenüber der Ausgangslage-Tabelle.
Die „72 Verbindungen" aus dem Auftrag waren mit keiner der drei Zählweisen reproduzierbar
(Blöcke ohne ACTORen: 53 Kanten / 80 Instanzen · mit ACTORen: 106 / 163 · gve-Netzkanten
zugeklappt: 101) — vermutlich ein UI-Zustand mit teilgeöffneten Blöcken; die Zählweise
steht deshalb an jeder Zahl.

## Gemessen (graphVersion 208)

| | vorher | nachher (Handschnitt) |
|---|---|---|
| Blatt-Verbindungen intern | 35 / 204 = **17,2 %** | 54 / 275 = **19,6 %** |
| Q deklarierter Schnitt (CNM-Referenz 0,60) | **−0,016** | **0,003** |
| Sicht 1: Kanten / parallel-überzählig / bidirektional | 53 / 27 / 15 | 54 / 22 / 16 |
| Sicht 2: MOD-Paare / Kanten | 47 / 62 | 40 / 55 |
| Module mit 0 internen Verbindungen | 5 | 2 (surface bewusst, live strukturell) |

Handschnitt = 8 Ziel-Module aus den CNM-Communities (store · gate · codec · mcp-tools ·
steering · views · cli · live, plus agent-surface und extern metrics-engine), Splitter-Module
aufgelöst, Blöcke zu ihren Kindern, drei code-gedeckte FLOW-Konsolidierungen
(5 Mess-Flows → steering-snapshot, fit-advisory+steering-delta → gate-verdict,
graph-snapshot → graph-state).

## Die drei tragenden Befunde

1. **Der deklarierte Schnitt ist statistisch Zufall.** Q=−0,016 gegen eine natürliche
   Community-Struktur von Q=0,595. Die These der Ausgangslage („Namensvergabe") ist belegt.
2. **Umhängen allein bewegt fast nichts.** Der beste Handschnitt hebt den internen Anteil
   von 17,2 % auf 19,6 % und lässt Q bei ≈0. Ursache ist kein schlechter Schnitt, sondern
   die Systemform: graphcode ist eine Pipeline um einen geteilten Zustand (`FLOW-graph-state`:
   13 FUNCs über 9 Module; `mutate-cmd`, `cli-command`, `committed-graph` ähnlich). Ein
   Substrat, bei dem alles den Graphen liest, hat wenig modulinterne Flüsse — egal wie man
   die Modulnamen verteilt.
3. **Die Kennzahl ist hub-empfindlich — die Falle aus dem Auftrag, nachgewiesen.** Die
   FLOW-Konsolidierung erzeugte +71 abgeleitete „Verbindungen" (204→275), weil Paare als
   producer×consumer je FLOW gezählt werden — im Code entsteht dabei **keine** neue Kopplung.
   Wer auf die Ratio optimiert, kann sie durch Flow-Splitting verbessern und durch ehrliche
   Bündelung verschlechtern. Zweitbefund derselben Klasse: Pipeline-/Adapter-Module (live)
   messen strukturell 0 intern. → Messproblem, gehört in die CR-SM-223-Validierung.

## Coder-Bewertung (die geforderte Hälfte)

**Was Codequalität sichtbar verbessert — und was der Spike als Vorlage liefert:**

- **Verzeichnis-Abbildung des 8er-Schnitts** (= CR-GC-429 §4): 58 flache `src/`-Dateien in
  die 8 Modulverzeichnisse. Das ist der eine Umbau, den ein Coder sofort sieht (Navigation,
  Ownership, Import-Richtung wird im Pfad lesbar). Er hängt am Dateisystem, nicht an
  Graph-Umhängungen. Umfang: ~50 Dateien bewegen, Importe mechanisch nachziehen — in
  ≤6-Dateien-CRs je Zielverzeichnis schneidbar; `src/index.ts`-Oberfläche bleibt (nur
  interne Importpfade ändern sich).
- **`harness.ts`-Split store/gate:** der Schnitt trennt Lifecycle/Store von mutate/Regel-Lauf —
  heute eine Datei. Realer Datei-Split, ~3–4 Dateien, echte Verantwortungstrennung.
- **Flow-Konsolidierung Modell→Code-Ehrlichkeit:** die ×8-Parallelkante
  `messwerk→goal-steerer` bündelt der Code längst (`SteeringSnapshot`, `MutateResult` mit
  fitAdvisory/steeringDelta). Das Modell auf die Code-Bündel zu ziehen kostet keinen Code
  und nimmt Sicht 1 fünf überzählige Parallelkanten.
- **Splitter-Module auflösen** (hooks/schema-migration/conformance/element-slice/
  completeness): Kartenpflege, Dateien liegen schon richtig — 0 Dateibewegungen.

**Was nur Kennzahlen bewegt — abgelehnt:**

- Blöcke/skills umallozieren: `MOD-skills` sind 25 Markdown-Treiber in **einem** Verzeichnis
  (`.claude/commands/`) — jede Verteilung auf Fach-Module widerspräche der Platte. 0-Kohäsion
  ist dort Kategorie (Bedienschicht), kein Defekt → umbenennen in `MOD-agent-surface`, fertig.
- Optimierung auf die Kohäsions-Ratio: siehe Befund 3.

## Entscheidungsvorlage

**No-Go** für die Spike-Frage im engen Sinn („Modulschnitt allein durch Umhängen von
Allokationen messbar verbessern"): tragende Zahl **17,2 % → 19,6 %** bei Q≈0 —
Kill-Kriterium 2. **GO-Empfehlung** für die drei code-getragenen Ableger, die der Spike
als Nebenprodukt spezifiziert hat: (a) CR-GC-429 §4 mit dem 8er-Schnitt als Zielbild,
(b) `harness.ts`-Split store/gate, (c) Flow-Konsolidierung + Splitter-/Block-Bereinigung
als Modellpflege (braucht CR-GC-435 fürs Umhängen). Dazu der Metrik-Befund an
sigloch-modules (Hub-Empfindlichkeit des Kohäsions-Nenners, Pipeline-Null).
Entscheidung liegt beim Auftraggeber.
