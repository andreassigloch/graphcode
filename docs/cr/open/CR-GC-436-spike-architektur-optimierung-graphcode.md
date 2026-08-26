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
