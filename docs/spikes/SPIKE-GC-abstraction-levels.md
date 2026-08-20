# SPIKE-GC-abstraction-levels — Zwei Übersichtsebenen aus dem Modell

**Status:** GESTARTET 2026-08-16 (Runde 1: Testcase 1, Blockschnitt-Entwurf vor Gate-Write)
**Herkunft:** Review 2026-08-16 (`docs/review.md` §5) — die Ontologie kodiert die Ebenen-Leiter,
der eigene Graph nutzt sie nicht (4× FUNC-in-FUNC bei 55 FUNCs, 0× MOD-in-MOD bei 10 MODs).
**Typ:** Handexperiment am eigenen Graphen. Kein Code, keine neuen Regeln, keine neuen Skills —
erst der Nachweis, dass die Abstraktion trägt, dann Werkzeug-CRs.

---

## 1. Hypothese

Das ganze Projekt lässt sich über grobe Funktionsblöcke mit Drill-Down definieren:

| Ebene | Publikum | Inhalt |
|---|---|---|
| **0 — Sales / Pitch** | Salespitch-tauglich | 5±2 Blöcke + Wirkketten dazwischen |
| **1 — Manager** | Management | eine Zerlegungsstufe tiefer; Rule-KPI-Loop, Candidate-Flow als Ketten sichtbar |
| 2 — Engineer | SW-Engineering | bestehende Views (arch/ICD/NFR/RTM/testconcept) — existiert |
| 3 — Agent | Coding-Agent | `graph_context`/`graph_impact`/`graph_expand` — existiert |

Die Bausteine sind `MOD compose MOD`, `FUNC compose FUNC` (beide legal, Meta-Modell:
„leaf FUNCs carry realRef, the parent is realized by its children") und **Wirkketten-Rollup**:
FLOWs zwischen Blatt-FUNCs auf die sichtbaren Vorfahren der Zielebene hochprojiziert.

**Inhalt vs. Wording auf Ebene 0:** inhaltlich sind die Blöcke **Funktionen** (FUNC mit
Wirkketten), benannt werden sie im **Komponenten-/Substantiv-Wording** — das
Bedienungsanleitungs-Prinzip: dort steht „Sitze", nicht „sitzen", obwohl der Inhalt die Funktion
ist. Die Außensicht spricht praktisch immer Komponenten-Sprache; die Struktur darunter bleibt
funktional.

**Falsifizierbar:** Wenn die von Hand gruppierten Ebenen 0/1 keine vergleichbare oder bessere
Abstraktion liefern als die handgemalten Artikel-Grafiken, ist die Vision auf diesen Daten
widerlegt — bevor Code entstanden ist.

## 2. Baseline (Vergleichsmaßstab)

Die bestehenden Artikel + Grafiken (`docs/articles/`, `docs/articles/img/`):

- `rule-kpi-loop.svg` — die Steuerungsschleife (im Modell: CR-GC-332, FCHAIN)
- `candidate-flow.svg` — der Kandidaten-Fluss
- `measurement-landscape.svg`, `phase-gates.svg`, `aspice-coverage.svg`

Erfolgskriterium je Grafik: die modellabgeleitete Darstellung (Ebene 0 oder 1 + Rollup) ist
**vergleichbar oder besser** — gleicher Informationsgehalt, weniger Pflegeaufwand, keine
Drift-Möglichkeit (die Grafik IST das Modell).

## 3. Methode — Loop bis die zwei Ebenen stehen

**Zwei Testcases:**

| # | Datengrundlage | prüft |
|---|---|---|
| 1 | der kuratierte graphcode-Selbstgraph (55 FUNC / 10 MOD / 13 FCHAIN) | trägt die Abstraktion auf einem gepflegten Modell? |
| 2 | ein per **graphify** deterministisch importiertes Repo (`se:import-code`: FUNC/MOD/FLOW/SCHEMA, kein LLM) — nach demselben Schema zu den zwei Ebenen gruppiert | erklärt die Struktur das Repo bzw. die App dahinter einem Kalt-Leser? |

Testcase 2 ist der härtere: die Rohdaten kommen aus Code, nicht aus Kuration — wenn die zwei
Ebenen auch dort eine App verständlich machen, ist das Schema übertragbar, nicht nur auf das
eigene, gepflegte Modell geeicht. Repo-Wahl bei Spike-Start (Kandidat: ein Repo, das der
Kalt-Leser nicht kennt).

Alle Schreibzugriffe durchs Gate (`graph_mutate`), Export via `graph_export`. Je Runde:

1. **Gruppieren (Fachurteil, kein Skript):** die 55 FUNCs unter 5±2 Eltern-FUNCs der Ebene 0
   hängen (`FUNC compose FUNC`); MOD-Nesting prüfen (`MOD compose MOD`, heute 0 Kanten).
   Analog CR-GC-350: das sind ~55 Fachurteile, keine Heuristik.
2. **Rollup von Hand rendern:** je Kern-Wirkkette (Rule-KPI-Loop, Candidate-Flow, Advisory-
   Roundtrip) die FLOWs auf die Ebene-0/1-Vorfahren projizieren; Mermaid reicht als Medium.
3. **Vergleichen:** Seite an Seite gegen die Baseline-Grafik. Urteil: trägt die Abstraktion?
   Wo bricht sie (falsche Blockgrenze, Kette überspringt Ebenen, Vokabular nicht pitch-tauglich)?
4. **Nachschärfen:** Umhängen und zurück zu 2. — **bis beide Übersichtsebenen stehen** und jede
   Baseline-Grafik ihr modellabgeleitetes Gegenstück hat.

**Regeln:** die bestehenden Architektur-Regeln (RD-04 Breadth, R-31 io-Verdrahtung [war R-28 bis
CR-SM-247], `crossingFlows`/`moduleSize`
aus der metricPolicy) gelten unverändert und dienen als Leitplanke; das Gate blockt auf neu
eingeführte Error-Verstöße. **Keine neuen Regeln in diesem Spike** — Ebenen-Konsistenz-Regeln
erst, wenn die Tiefe real benutzt wird (sonst wieder eine Regel über leerer Grundgesamtheit,
vgl. CR-SM-239).

**Bekannte Gate-Fallen (aus den Migrationen 08/2026):**

- Umhängen = delete-edge + add-edge in **getrennten** Batches — delete+add im selben Batch
  divergiert den Store (persist schreibt Deletes zuletzt)
- Attribute sind nicht löschbar, nur null-Grabstein
- Nach Abschluss `scripts/export-graph.mjs`, nicht dem laufenden MCP-Server vertrauen
  (Stale-Server-Falle)

## 4. Abnahme

- [ ] Ebene 0 steht: 5±2 Blöcke, jedes Blatt-FUNC über `compose` von genau einem Block erreichbar
- [ ] Ebene 1 steht: eine Zerlegungsstufe tiefer, konsistent (kein FUNC hängt an zwei Eltern)
- [ ] Rule-KPI-Loop, Candidate-Flow und Advisory-Roundtrip als Rollup auf Ebene 0/1 gerendert
- [ ] Seite-an-Seite-Vergleich gegen jede Baseline-Grafik dokumentiert; Urteil je Grafik:
      besser / vergleichbar / schlechter — mit Begründung
- [ ] Vokabular-Check Ebene 0: jeder Blockname und jede Kette Salespitch-tauglich
      (Cold-Reader-Test, kein internes Jargon); Benennung im Substantiv-/Komponenten-Wording
      („Sitze", nicht „sitzen"), Inhalt funktional
- [ ] Testcase 2 (graphify-Import): die zwei Ebenen erklären einem Kalt-Leser, was die App tut —
      Urteil dokumentiert, gleiche Kriterien wie Testcase 1
- [ ] Keine neuen Error-Verstöße; Readiness vorher/nachher notiert (gemessen, nicht geschätzt)

## 5. Ergebnis-Verwertung

**Wenn die Abstraktion trägt** → drei Folge-CRs (Reihenfolge):

1. `projectDepth(graph, level)` als **eine** Funktion im Sibling (graph-api-core/se-optimizer) —
   Tiefen-Projektion mit FLOW/allocate/satisfy-Rollup; Permutations- und Rollup-Tests gegen den
   echten Graphen (Zwei-Skalen-Regel). Nicht je View improvisieren — die Ebenen-Verwirrungsklasse
   aus CR-GC-352 (Ranking- vs. Advisory-Ebene) nicht um eine Achse multiplizieren.
2. Render-Aufsätze: `se-view:arch --depth n` bzw. Blockbild-View; FCHAIN-Render mit
   Tiefenparameter (Mermaid)
3. GVE: Default-Einstieg „alles eingeklappt auf Ebene 0" (Collapse-all existiert, CR-GVE-234)

**Wenn nicht** → Befund dokumentieren, welche Blockgrenze/Kette gebrochen ist; die Artikel-
Grafiken bleiben handgepflegt, die Vision wird nicht in Werkzeug gegossen.

@author andreas@siglochconsulting
