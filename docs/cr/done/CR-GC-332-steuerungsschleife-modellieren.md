# CR-GC-332 — Die Steuerungsschleife ist nicht modelliert

**Status:** done · **Datum:** 2026-08-13 · **Abgeschlossen:** 2026-08-13
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert** (nur Graph-Inhalt)
**Bezug:** `docs/MESSGROESSEN.md` (Normseite), `articles/07-the-scoring-landscape.md`,
`articles/img/measurement-landscape.svg`, CR-GC-289 (Ranking), CR-GC-275 (`graph_generate`),
CR-GC-279 (`graphcode run`), CR-GC-250 (completeness)

---

## 1. Problem

Der Kern-Use-Case des Produkts — **aus deterministisch ermittelten Kenngrößen den nächsten Schritt
ableiten und damit auf ein mehrdimensionales Ziel steuern** — kommt im eigenen Graphen nicht vor.

Gemessen an `docs/graph/graphcode.graph.json` (2026-08-13):

| | Befund |
|---|---|
| FUNC gesamt | 44 |
| davon für die Schleife | **0** — kein `computeReadiness`, kein `nextStep`, kein `rankCandidates`, kein `moduleMetrics`, kein `fitAdvisory`, kein `computeSteeringDelta` |
| vorhanden, aber nur am Rand | `FUNC-score-completeness`, `FUNC-render-readiness` (Anzeige) |
| FCHAIN gesamt | 12 |
| davon für die Schleife | **0**. Am nächsten: `FCHAIN-advisory-roundtrip` = evaluate-rules → graph-impact → graph-suggest → mutate — der ältere Advisory-Weg unter `UC-reduced-llm`, ohne Fokuswahl, ohne Kandidatenvergleich, ohne Δ |
| UC für Steuerung | **keiner** (vorhanden: code-quality, efficient-testing, graph-time-travel, live-graph-view, reduced-llm, token-efficiency) |

Dazu ein hängender Verweis: die Beschreibung von `graph_readiness` nennt
`FUNC-score-readiness` (`src/tools/report.ts:334`) — **den Knoten gibt es nicht**. Das Werkzeug
behauptet eine Modellstelle, die das Modell nicht enthält.

**Warum das mehr ist als eine Lücke im Inventar.** Genau dieser Bereich trug in den letzten Tagen
vier Befunde, die niemand über Regeln bemerkt hat: die abgeflachte Steering-Eingabe (CR-GC-324), der
Nenner von `dimension_readiness` (CR-SM-235), zwei Schwellen für dieselbe Frage (0.7 vs. 0.8), drei
Kenngrößen ohne Konsument. Alle vier sind unsichtbar geblieben, **weil es kein Modellelement gibt,
gegen das eine Regel hätte feuern können.** R-20 kann keine Code-Bindung anmahnen, die es nicht gibt;
`completeness` prüft nur Legs, die jemand definiert hat. Der Governance-Harness governt seinen
eigenen Steuerungskern nicht — das ist die härtere Version von „rule-green ≠ analysis-done".

---

## 2. Ziel

Die Schleife steht als Modell: ein UC, eine FCHAIN, die FUNCs mit `realRef` auf den echten Code —
und damit unter denselben Regeln wie alles andere.

---

## 3. Nicht-Ziele

- **Kein Code-Umbau.** Dieser CR ändert `src/` nicht (Ausnahme: der hängende Verweis in der
  Tool-Beschreibung, siehe §4.6). Er modelliert, was da ist.
- **Keine neue Kenngröße.** Der Inhalt steht in `docs/MESSGROESSEN.md`; hier wird er in den Graphen
  übersetzt, nicht neu erfunden.
- **Kein zweiter Weg neben `FCHAIN-advisory-roundtrip`.** Der bleibt, was er ist (Advisory für den
  fragenden Agenten). Die neue Kette ist die Kenngrößen-Schleife — beide gehören zusammen, sind
  aber nicht dasselbe: die eine antwortet auf eine Frage, die andere wählt selbst den nächsten Schritt.
- **Kein Umbau der drei Qualitäts-Eimer.** Dass `UC-token-efficiency` eher eine REQ ist (eine
  Qualität mit genau einer Kette darunter: `FCHAIN-agent-query`), dass ihre REQ-Kinder als `REQ→REQ`
  weiterhängen könnten und die Kette zu `UC-selbststeuerung` gehörte — richtig, aber ein eigener
  Schnitt an bestehender Struktur. Dieser CR fügt hinzu, er sortiert nicht um. **Folge-CR.**

---

## 4. Anforderungen

1. **`UC-selbststeuerung` — ein Enabler-UC**, nicht ein weiterer Ziel-UC. Er beschreibt den
   Mechanismus („das System bestimmt seinen nächsten Schritt aus Kenngrößen"), aus dem die
   Ziel-UCs erst folgen; Herkunft ist der aimprove-Steuerungskern. Mit ACTOR-Bindung (Mensch **und**
   lokaler Executor lösen aus, das Gate ist Konsument — FC-04 verlangt beides).

   **Beziehung zu den Ziel-UCs als `relation` mit Label `enables`**, nicht als compose: das
   Meta-Modell kennt `SYS→UC`, `UC→FCHAIN`, `UC→REQ`, `MS→UC` — **kein `UC→UC`**. Ein Enabler kann
   also nicht unter einem Ziel hängen. Mindestens: `UC-selbststeuerung —enables→ UC-reduced-llm`.

   **Der Sammler ist der ConOps**, nicht ein Knoten: welche Enabler es gibt, woher sie stammen und
   welchem Ziel sie dienen, steht dort. Die `enables`-Kante ist die maschinenlesbare Hälfte davon.

   **Befund, der das auslöst:** drei der sechs UCs (`code-quality`, `reduced-llm`, `token-efficiency`)
   tragen `name == id` **und leere description** — nie formuliert, nur befüllt. Es sind Qualitäts-Eimer;
   `REQ-greenfield-systemtest-dod` hängt unter allen dreien. Die drei ausformulierten UCs stehen
   dagegen im „Als Entwickler will ich…"-Stil.
2. **FCHAIN** entlang `measurement-landscape.svg`, flach (FC-03), in der Reihenfolge des Bildes:
   messen → projizieren → Fokus wählen → Kandidaten bewerten → Prompt stellen → Gate.
3. **FUNCs mit `realRef`** auf den existierenden Code — mindestens:
   `computeReadiness` (se-steering), `moduleMetrics` (contracts), `metrics(layer:arch)` (se-optimizer),
   `takeSteeringSnapshot` + `computeSteeringDelta`, `nextStep`, `nextGenerationStep`, `rankCandidates`.
   Fremdpaket-Realisierungen tragen `external:true` (R-20s eigener Ausnahmeweg), nicht einen
   erfundenen lokalen Pfad.
4. **Zielsteuerer als logischer Sammler, nicht als Megafunktion.** Die vier Entscheidungen —
   Gate-Verdikt, Fokuswahl, Kandidaten-Rangfolge, Handoff — teilen heute schon eine Signatur:
   `(Messvektor [+ Kandidat]) → Handlung`. Sie bekommen deshalb einen Eltern-FUNC
   (`FUNC —compose→ FUNC`), der sie sammelt:
   - der Sammler trägt **`concept: true`, kein `realRef`** — R-20s Ausnahmeweg für spec-only.
     Das ist die formale Aussage „Sammler, keine Funktion"; wer ihm später eine Datei anhängt,
     muss die Ausnahme entfernen, und das fällt auf.
   - **die FCHAIN führt die Blätter, nicht den Sammler** (FC-03 „flach"). Läge er in der Kette und
     komponierte dort seine Kinder, feuert FC-03 — wie heute schon einmal bei `FUNC-gesture-capture`
     in `FCHAIN-apply`.
   - der Code wird **nicht** zusammengezogen. Die vier Stellen bleiben, wo sie sind; zusammengeführt
     wird das Modell.
5. **FLOWs mit SCHEMA** zwischen den Schritten (SC-04): der Regelstrom, der Snapshot, das Verdict,
   der Prompt. Zwei davon sind der gemeinsame Vertrag des Sammlers — **Messvektor** und **Handlung**;
   erst mit ihnen ist die Gleichheit der Signaturen geprüft statt behauptet. Was heute nur als
   TypeScript-Interface existiert, wird als SCHEMA mit `realRef` gebunden.

   **Granularität = Zeichnungstiefe.** Die Projektionen bekommen je einen eigenen FLOW —
   `completeness`, `phase_readiness`, `dimension_readiness`, `steeringDelta`, `moduleMetrics`,
   `fitAdvisory` — nicht einen gesammelten „Messvektor". Sonst rendert die Wirkkette gröber als
   `measurement-landscape.svg`, und es blieben zwei Bilder nebeneinander: ein generiertes und ein
   handgepflegtes. Genau das soll wegfallen (§7).
6. **Den hängenden Verweis auflösen:** entweder `FUNC-score-readiness` heißt künftig so und wird
   angelegt, oder `src/tools/report.ts:334` nennt den Knoten, den es gibt. Kein Verweis ins Leere.
7. **TESTs**: die vorhandenen Suiten (`tests/steering.test.ts`, `tests/metrics.test.ts`,
   `tests/mcp.readiness.test.ts`, Executor-Ranking) werden per `testRef` an die neuen FUNCs
   gebunden — sie existieren, sie sind nur unverbunden.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `docs/graph/graphcode.graph.json` | UC + FCHAIN + FUNCs + FLOWs/SCHEMAs + verify/allocate-Kanten |
| `src/tools/report.ts` | hängenden `FUNC-score-readiness`-Verweis auflösen (§4.6) |
| `docs/views/*` | regeneriert (kein Handedit) |

**Umsetzung ausschließlich über `graph_mutate` + `graph_export`** in einer graphcode-Session — die
committete SSOT ist governt, ein direkter Edit ist blockiert. Der Umfang ist ~10 Knoten und ~25
Kanten; das ist ein Batch, keine Sitzung.

---

## 6. Akzeptanzkriterien

- [x] `graph_readiness` weist die neue FCHAIN als actor-bounded (FC-04) und flach (FC-03) aus.
      FC-04 hat **einen** offenen Fund, und der ist `FCHAIN-live-update` (vorbestehend); FC-03 ist
      im ganzen Graphen still.
- [x] Jede neue FUNC hat `realRef` (Fremdpaket: `external:true`; **der Sammler: `concept:true`**) —
      R-20 feuert für keine von ihnen, und der Sammler ist als spec-only kenntlich.
- [x] Der Sammler ist **nicht** Mitglied der FCHAIN — FC-03 bleibt still.
- [x] Jeder neue FLOW hat ein SCHEMA (SC-04) — die drei offenen SC-04-Funde sind die
      vorbestehenden `FLOW-round-scope`/`-findings`/`-suggested-edit`. CDR-completeness ist
      unverändert 43/46.
- [x] `grep -rn "FUNC-score-readiness" src/` findet nichts mehr — die Tool-Beschreibung nennt
      `FUNC-compute-readiness`, den Knoten, den es jetzt gibt.
- [x] `docs/MESSGROESSEN.md` und die FCHAIN nennen dieselben Schritte in derselben Reihenfolge
      (Handprüfung, s. §8).
- [x] Die Suite bleibt grün (dieselben zwei vorbestehenden roten Tests wie in CR-GC-329, keine
      neuen); die Views sind neu exportiert.

---

## 7. Folgen

Danach steht der Steuerungskern unter denselben Regeln wie der Rest: eine gelöschte Bindung, eine
verwaiste Funktion, ein Schritt ohne Datenvertrag fallen ab sofort **auf** statt nach Tagen im
Audit. Und der stärkste Beleg für den Claim ist, dass er auf das eigene Werkzeug angewendet wird —
die vier Befunde dieser Woche hätte der Graph selbst gemeldet.

**Die eigentliche Definition of Done liegt eine Stufe weiter** und ist nicht Teil dieses CRs, aber
sein Zweck: *die Übersichtsbilder entstehen aus dem Graphen, nicht aus Code-Recherche.* Dafür fehlen
nach diesem CR noch drei Stücke — als Folge-CRs zu schneiden:

1. **Rolle als Modellinformation.** Die Legende „blockt / misst / handelt" existiert im Graphen
   nicht. Sie im Renderer abzuleiten wäre wieder Code-Wissen; sauber ist ein Attribut
   (`role: gate | measure | control`), nach dem gefärbt wird.
2. **Bild-Export.** GVE kennt weder `toDataURL` noch Download noch `serializeToString`, die
   graphcode-Views sind reiner Text. Die Wirkkette lässt sich ansehen, aber nicht als Datei erzeugen.
3. **Der Abnahmetest:** `articles/img/measurement-landscape.svg` wird **gelöscht** und durch das
   generierte Bild ersetzt. Solange dieses SVG von Hand gepflegt wird, ist der Claim nicht eingelöst.

---

## 8. Abschluss 2026-08-13

**Was jetzt im Graphen steht** — 37 Knoten, 84 Kanten, in zwei Gate-Batches (Version 73 → 75):

| | |
|---|---|
| UC / REQ / TEST | `UC-deterministic-steering` · `REQ-steering-from-metrics` · `TEST-steering-loop` (testRef `tests/steering.test.ts`) |
| FCHAIN | `FCHAIN-steering-loop` — 6 Glieder in der Reihenfolge des Bildes: `take-steering-snapshot` → `compute-readiness` → `generation-step` → `rank-candidates` → `next-step` → `mutate` |
| FUNC | 10 neue, alle gebunden: 6 lokal mit `realRef`, 3 mit `external:true` (se-steering / contracts / se-optimizer), der Sammler `FUNC-goal-steerer` mit `concept:true` |
| MOD | `MOD-steering` — die Dateien gab es, die Modellstelle nicht |
| FLOW / SCHEMA | 13 FLOWs, jeder mit SCHEMA; 11 neue SCHEMAs, davon 9 mit `realRef` auf das existierende TypeScript-Interface und 2 (`Messvektor`, `Handlung`) bewusst `concept:true` |

**Die Schleife schließt sich im Modell:** `FUNC-mutate —io→ FLOW-gate-verdict —io→
FUNC-take-steering-snapshot`. Vorher endete jede modellierte Kette am Gate.

**Reihenfolge gegen `docs/MESSGROESSEN.md` geprüft (Hand, beim Abschluss):** messen
(`takeSteeringSnapshot`, „eine Regelauswertung") → projizieren (`dimension_readiness`,
`phase_readiness`, `completeness`, `moduleMetrics`, Architecture Fitness) → Fokus wählen
(`generationStep`, „unter Fokus-Schwelle → Fokus") → Kandidaten bewerten (`rankCandidates`,
„Δ = 1. Rangkriterium, Fitness als Tiebreaker") → Prompt stellen (`nextStep`) → Gate (`mutate`).
Die drei Handelnden der Normseite bilden sich als ACTOR-/FUNC-Konsumenten ab: Gate = `FUNC-mutate`,
Treiber = `FUNC-generation-step`/`FUNC-rank-candidates`, Anzeige = `FLOW-module-metrics —io→
ACTOR-dashboard`.

**Zwei Funde beim Modellieren, beide nicht stillschweigend geschluckt:**

1. **`@realRef`-Follow-Lines im Format-E-Pfad verlieren die Objektform.** `graph_mutate({formatE})`
   liefert `realRef` als **String** statt als Objekt — der contracts-Parser hydriert korrekt, der
   graphcode-Codec-Pfad gibt es als String weiter. Folge: R-19/R-20 feuern trotz vorhandener
   Bindung, und ein Autor, der Format-E benutzt, kann eine Bindung nicht setzen. Der Batch lief
   deshalb über `commands`. **Eigener CR** — das ist ein Codec-Defekt, kein Modellierungsproblem.
2. **IO-01 liest eine Kette als Clique.** Die Regel verlangt einen FLOW-Pfad zwischen *jedem Paar*
   von Kettengliedern; eine Sequenz erfüllt das nie. 21 offene Funde im ganzen Graphen, davon 7 in
   der neuen Kette — dieselbe Quote wie bei `FCHAIN-apply-gate`, `-live-update`, `-agent-query`,
   `-advisory-roundtrip`. Hier **nicht** durch erfundene Flows weggeräumt: das wäre Modell nach
   Regel gebogen. Kandidat für einen contracts-CR (Nachbar-Paare statt alle Paare).

**Nebenbefund beim Batch:** der laufende MCP-Server stammt aus einem Build **vor** CR-GC-330 und
hat den Learning-Feed nach `.aimprove/trajectory.jsonl` geschrieben statt in den eigenen Workspace.
Das Verzeichnis ist seit CR-GC-330 nicht mehr gitignoriert, tauchte also als unversionierter Rest
auf; entfernt (der Feed ist eine Projektion des Operations-Logs, regenerierbar). Der Server muss
neu gestartet werden, damit er den aktuellen Build fährt.

**Offen geblieben (bewusst):** die drei externen FUNCs tragen R-22 („nicht alloziert") — sie liegen
in Fremdpaketen, und ein erfundenes MOD dafür wäre eine Modellstelle für fremden Code. Der Fund ist
die ehrliche Aussage „hier endet unser Modul".

@author andreas@siglochconsulting
