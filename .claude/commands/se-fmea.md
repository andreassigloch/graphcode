---
name: se-fmea
version: 8
description: Perform a state-of-the-art FMEA (AIAG-VDA 7-step) with the FCHAIN (Wirkkette) as the analysis unit, and integrate findings into the SE-graph + spec
---

Conduct a Failure Mode and Effects Analysis following the **AIAG-VDA FMEA Handbook (2019)** 7-step method, mapped onto this project's SE-ontology graph. Output is one closed change request (`docs/cr/done/`) carrying the analysis, plus the derived requirements with their tests in the graph. This is the FMEA **create** skill; once findings are in the graph, render them with `se-view:fmea` (the read-only FMEA view) — do not re-author the analysis at render time.

**Scope argument:** the user names the analysis target. **The default and preferred unit is one `FCHAIN`** — a Wirkkette is a bounded end-to-end effect path with a named trigger and a named result, which is exactly what a failure mode needs to be stated against ("the chain does not reach its result because ..."). A `MOD` or a component (e.g. `ACS712`) is a legitimate but secondary scope: it cuts across chains, so its failure effects can only be stated per chain anyway. A whole-`SYS` scope means *every* chain, one profile each — say so and confirm the effort before starting.

If unscoped, ask for it — do not guess. If the user names a `MOD` or a component, resolve it to the chains it participates in (`allocate` → FUNC → `compose` → FCHAIN) and run Step 2 per chain.

---

## The 7 Steps (each maps to graph artifacts)

### Step 1 — Planning & Preparation
- Define scope, boundary, and what is in/out of scope (e.g. COTS locomotives = out of scope).
- State the basis: domain-fault research (search authoritative sources for the domain — forums, datasheets, app notes) **plus** component-specific analysis driven by the actual BOM (`docs/project/bom-*.md`) and spec (`docs/project/specification.md`).
- List the graph elements in scope (SYS/UC/FUNC/MOD).

### Step 2 — Structure Analysis → **the chain profile**

Walk the graph's `compose` hierarchy for the scoped target: `SYS → UC → FCHAIN → FUNC` and `MOD → MOD`. Query the live structure over MCP — do NOT invent elements, analyze what exists:
  - `graph_impact` `{ "id": "<scoped-target-uid>", "depth": 2 }` for the blast-radius slice around the target (Format-E),
  - `graph_elements` `{ "type": "FCHAIN" }` (and `"UC"` / `"FUNC"` / `"MOD"`) to enumerate the in-scope nodes,
  - `graph_get_edges` `{ "uid": "<FCHAIN-uid>", "edgeType": "compose" }` for the chain's member FUNCs,
  - `graph_get_edges` `{ "edgeType": "io" }` for the FLOW wiring; deepen a single branch on demand with `graph_expand`.

**For each in-scope FCHAIN, read the chain profile before writing a single failure mode — do not compute it.** Call `graph_metrics` once and take the chain's row from `chains` and the reach of its members from `functions`. Figures and places are computed in ONE place (`chainMetrics` in `@sigloch/contracts/se`); a number derived by hand from `graph_get_edges` is a second calculation, and it disagrees with the first at every chain that has a loop.

**Erster Schritt: die Verdrahtung der Kette.** Die Regeln `R-30`, `R-31`, `R-21`, `IO-01`, `FC-04` und `FC-05` sind Warnungen, kein Fehler — das Gate hält eine unverbundene Kette nicht auf. Hol ihre Befunde für die Kette und ihre Glieder (`rules_get_violations`) und lies `measurable`:

- `measurable: false` → die Kette wird **nicht** analysiert. Nenne die `reasons`; das Schließen dieser Befunde ist das Ergebnis dieses Laufs, nicht eine FMEA.
- offene Verdrahtungsbefunde an einem Glied → erst schließen, oder der Nutzer bestätigt sie als bewusst offen.
- `length` 1 → Hinweis an den Nutzer: eine Kette aus einem Glied hat keine Orte. Klär mit ihm, ob ein Glied fehlt — typisch der Speicher zwischen einer schreibenden und einer lesenden Funktion.

**Die Orte der Kette.** Sie entscheiden, *wo* du suchst; ein Step 4, der sie übergeht, ist ein Brainstorming, keine Analyse. Die Kennzahlen finden den Ort, sie bewerten ihn nicht — das Urteil bleibt beim Nutzer.

| Ort | Feld in der Zeile der Kette | Was er für die FMEA bedeutet |
|---|---|---|
| Kreislauf | `loops` — je Kreislauf Kennung und Mitglieder | ein Fehler klingt nicht ab, Ursache und Folge sind nicht mehr gerichtet. Dieselbe Kennung in mehreren Ketten ist derselbe Kreislauf: einmal analysieren, sonst zitieren (Step 4, Quelle E) |
| Geteilte Funktion | `shared` — dazu ihre Reichweite in `functions` (`chains`, `useCases`) | gemeinsame Ursache: ein Fehler trifft jede Kette, in der sie liegt (Step 4, Quelle F) |
| Import | `imports` — Fluss und empfangende Funktion | eine fremde Kette liefert an eine Funktion zu, die nur dieser Kette gehört (Step 4, Quelle A) |
| Übergabe | `handovers` — Fluss und liefernde Funktion | die Fehlerwirkung tritt in einer anderen Kette auf (Step 4, Quelle B) |
| Verzweiger, Zulauf | `branching`, `fanIn`, gelesen gegen `memberCount` | eine Stelle mit mehreren Folgen bzw. mehreren Ursachen |
| Modulgrenze | `boundaries` — je Modulpaar Kanten und verschiedene Verträge | je **Vertrag** ein Schnittstellen-Fehlermodus, nicht je Kante: elf Flüsse mit demselben Schema sind eine Schnittstelle |
| Akteursgrenze | `FC-04` über `rules_get_violations` | fehlt eine Seite, ist die Fehler**wirkung** (FE) nicht auf einen Menschen abbildbar |

**Geteilte Funktionen gehören zur Analyse der Kette.** Ihre Zuflüsse stehen an ihnen selbst und erscheinen nicht als `imports` der Kette. Wer die Kette analysiert, analysiert ihre geteilten Funktionen mit; ist eine schon in einer früheren FMEA analysiert (CR in `docs/cr/done/`), zitiere sie und wiederhole sie nicht.

**Was der Regelsatz schon urteilt.** `FC-02` (Leaf-UC hat FCHAIN), `FC-03` (Kette ist flach), `FC-04` und `FC-05` liegen in `@sigloch/contracts/se` und laufen im Gate — lies sie über `rules_get_violations` und **wiederhole sie nicht als eigenen Befund**.

Ergebnis von Step 2: der Strukturbaum (System → Subsystem → Funktionselement) **plus** eine Tabelle `FCHAIN | Glieder | Kreisläufe | geteilte Funktionen | Importe | Übergaben | Modulgrenzen (Verträge) | Akteursgrenze ✓/✗`, alle Werte aus `graph_metrics` zitiert. Arbeitsreihenfolge für Step 4: erst die geteilten Funktionen, absteigend nach Reichweite, dann Kreisläufe, dann Importe und Übergaben.

### Step 3 — Function Analysis
- For each FUNC/MOD in scope, state its intended function (what it must do, with measurable acceptance where the spec defines it).
- **State each FUNC's position in the chain**: Eingang (konsumiert den ACTOR-Trigger), Zwischenschritt, Ausgang (erzeugt das ACTOR-Ergebnis), oder Übergabepunkt (erzeugt einen FLOW, den eine fremde Kette konsumiert). Die Position bestimmt die Fehler**wirkung**: ein Ausfall am Eingang verhindert die Kette, ein Ausfall am Übergabepunkt verschiebt sie in eine andere Kette, wo sie niemand als Störung dieser Kette erkennt.
- Link functions to the requirements they `satisfy` (FUNC→REQ edges already in graph; query via `graph_get_edges` `{ "edgeType": "satisfy" }`).
- **Flag jede REQ, die von mehr als einer FUNC erfüllt wird.** Dann trägt keine der beiden allein die Verantwortung, und der Fehlermodus „Zusage wird verletzt, ohne dass eine der beiden FUNCs ausgefallen ist" ist real. Query: `graph_get_edges` `{ "edgeType": "satisfy" }`, nach Ziel gruppieren.

### Step 4 — Failure Analysis

**Walk these six graph-derived sources first — they are obligatory and each one names concrete elements. Free-form derivation comes after, and only for what they did not cover.** A finding from a source below cites the element ids it came from; that is what makes it auditable instead of plausible.

**Quelle A — Importe (`imports` aus `graph_metrics`).** Für jeden importierten FLOW: er kommt aus einer fremden Kette, deren Takt, Ausfallverhalten und Betriebsmodus diese Kette nicht kontrolliert. Pflicht-Fehlermodi je Import: *bleibt aus*, *ist veraltet*, *widerspricht einer anderen Quelle derselben Größe*. Prüfe für jeden Import, ob ein REQ die Aktualität oder das Ausbleiben behandelt (`graph_get_edges` `{ "uid": "<FUNC>", "edgeType": "satisfy" }`) — fehlt es, ist die Lücke selbst der Befund.

**Quelle B — Übergaben (`handovers` aus `graph_metrics`).** Für jeden FLOW, den eine fremde FUNC konsumiert: die Fehlerwirkung (FE) tritt **in der anderen Kette** auf. Trag sie dort ein, nicht hier — sonst bewertest du eine Severity gegen den falschen Akteur. Ein Fahrauftrag mit falschem Zeitfenster ist für den Fahrgast eine späte Kabine (S niedrig) und für die Streckenfahrt eine Blockverletzung (S hoch); die zweite ist die maßgebliche.

**Quelle C — doppelt geführte Zustandsgrößen.** Zieh die SCHEMAs der beteiligten FLOWs (`graph_get_edges` `{ "edgeType": "relation" }`) und vergleiche ihre Felder. Trägt **dieselbe** Zustandsgröße in zwei SCHEMAs (z.B. ein Türzustand in der Kabinenzustandsmeldung *und* im Türstatus), existieren zwei Kopien, die divergieren können. Fehlermodus: *die beiden Kopien widersprechen sich, und der Verbraucher liest die falsche*. Prüf, ob ein REQ ihre Konsistenz fordert — meist nicht, und dann ist genau das die abgeleitete Anforderung aus Step 6. Ist die Größe sicherheitsgerichtet (Spannungsfreiheit, Verriegelung, Freigabe), ist der Befund per Definition S 9–10.

**Quelle D — Zustandsgrößen ohne aufgezählte Werte.** Nennt ein SCHEMA ein Zustands-/Statusfeld, ohne seine Werte zu enumerieren, gibt es kein prüfbares Übergangsverhalten: „unerwarteter Zustand" ist dann kein Fehlermodus, den ein Test erkennen könnte. Der Befund ist der fehlende Wertebereich, die Mitigation seine Festlegung. Hat das SCHEMA noch keinen `realRef` (kein Zod-Export), gilt das für **jedes** Feld — sag das einmal für den Scope und zähl nicht 30 Einzelbefunde.

**Quelle E — Kreisläufe (`loops`).** Für jeden Kreislauf der Kette: die klassische FMEA nimmt Einzelfehler an, die voneinander unabhängig sind und in eine Richtung wirken — im Kreislauf gilt beides nicht. Pflicht-Fehlermodi: *ein Fehler läuft um und verstärkt sich*, *der Kreislauf endet nicht*, *ein Glied arbeitet auf dem Stand des vorigen Umlaufs*. Prüf, ob ein REQ den Abbruch oder die Begrenzung fordert.

**Quelle F — geteilte Funktionen (`shared`).** Für jede geteilte Funktion: ein Fehlermodus an ihr ist eine gemeinsame Ursache für alle Ketten, in denen sie liegt. Zähl **je betroffener Kette eine Fehlerwirkung** auf und trag sie bei der Kette ein, deren Akteur sie trifft. Die Reichweite bestimmt, wie viele Wirkungen aufzuzählen sind und wo zuerst gearbeitet wird — die Reichweite erhöht nicht die Schwere (Severity): S ist die Schwere der schwersten Wirkung, nicht die Zahl der betroffenen Ketten.

Danach, für jede Funktion:
- Derive the **failure chain**: Failure Effect (FE, on system/user) ← Failure Mode (FM, how the function fails) ← Failure Cause (FC, root cause).
- Number failure modes `FM-NN`. Each FM entry contains:
  - **Schwere/Severity (S, 1–10) | Auftreten/Occurrence (O, 1–10) | Entdeckung/Detection (D, 1–10)**
  - **Ursache (FC):** root cause, physically grounded (cite datasheet figures, measured values where possible).
  - **Auswirkung (FE):** effect on the system and the user; flag safety-critical effects explicitly.
  - **Mitigation:** categorize each measure as `SW (Pflicht)`, `HW (Pflicht)`, `HW (Empfehlung)`, `Config`, or `Betrieb`.
  - **Spec-Bezug:** the FN/MD/RQ element the finding affects.

### Step 5 — Risk Analysis → **Action Priority (AP), not RPN**
- Rate S, O, D on the 10-point scales. The user rates; you propose. A value you pre-fill is marked as a proposal, and nothing is written without the user's confirmation (headless run: see close-out step 1).
- Assign **Action Priority** using the AIAG-VDA AP logic — **Severity first, then Occurrence, then Detection**:
  - **High AP** — action MUST be taken or a justification documented. (High severity of effect, esp. S 9–10, with any non-trivial occurrence; or high S+O combinations.)
  - **Medium AP** — action SHOULD be taken or a justification documented.
  - **Low AP** — action MAY be taken.
  - Use the canonical AIAG-VDA AP lookup table for the exact S/O/D → AP mapping; Detection only shifts priority within a fixed S/O band. Safety/regulatory effects (S 9–10) are never demoted below the band their occurrence dictates by a good Detection score alone.
- Render a **risk matrix** table sorted by AP (High → Low): `# | Fehlermodus | S | O | D | AP | Kategorie`.
- **AP lives in the document, not (yet) in the graph.** The FMEA view renders `RPN = S×O×D` — the same number `FM-03` thresholds on — because the canonical AP classification belongs in `@sigloch/contracts/se` (`actionPriority()`, CR-SM-229) and is not published yet. Do **not** write an AP field into the graph and do not let a view invent a second classification for a safety-relevant judgement (CR-GC-308).
- **Legacy compatibility:** the existing doc shows an RPN column. You MAY keep an `RPN = S×O×D` column as a secondary/legacy indicator, but **AP is the primary, governing classification** — never let RPN override AP.

### Step 6 — Optimization
- For each High (and relevant Medium) AP item, define concrete mitigations grouped by horizon:
  - **Vor Prototyp** (design decisions: sensor choice, PCB redesign) — table: `# | Massnahme | Betroffene FMs | Aufwand`.
  - **Firmware** (before commissioning) — table: `# | Massnahme | Betroffene FMs`.
  - **Software** (sirail backend) — table: `# | Massnahme | Betroffene FMs`.
- State the **residual risk** intent: which mitigations lower O (prevention) vs. D (detection).
- **Architekturvorschlag.** Zeigt ein Befund, dass die Kette selbst das Risiko trägt — ein Kreislauf ohne Abbruch, eine geteilte Funktion als einziger Weg, ein Import ohne Absicherung —, formuliere einen Vorschlag zum Umbau der Kette: Zweck (die REQ, der er dient), Kette, Ort, Handlungsklasse (Entkoppeln, Zusammenlegen, Verschieben, Aufteilen, Vorverlagern), Prognose (was besser werden soll, was gleich bleiben muss) und die erwartete Wirkung auf die Kennzahlen des Modul- und des Funktionsbaums. **Du wendest ihn nicht an** — er ist Eingang der Optimierung (`se:optimize`).
- **Konflikt am Kreuzungspunkt.** Verlangt ein Vorschlag an einer geteilten Funktion etwas, das einer anderen Kette durch dieselbe Funktion schadet, notiere den Konflikt **an der geteilten Funktion** (uid, die beteiligten Ketten, was gegeneinander steht) — nicht in einer der Ketten.

### Step 7 — Documentation of Results
- Write the analysis as the text of a closed change request: `docs/cr/done/<next CR id>-<slug>.md` — the next free number after the files in `docs/cr/open/` and `docs/cr/done/`, same prefix; `CR-001` in a repo without CRs. It is the only prose record; a new analysis is a new CR, never an edit of an old one. Sections:
  1. Zusammenfassung (count of FMs + Top-3 AP-High risks)
  2. Kettenprofil (die Step-2-Tabelle aus `graph_metrics`) — sie begründet, warum die Fehlermodi dort sitzen, wo sie sitzen
  3. Fehlermodi im Detail (`FM-NN`, the Step-4 entries) — jeder Eintrag nennt seine Quelle (A bis F oder „frei abgeleitet") und die Element-uids, aus denen er stammt
  4. Risikomatrix (AP-sorted, Step 5)
  5. Handlungsempfehlungen priorisiert (Step 6), darunter eigene Abschnitte „Architekturvorschläge" und „Konflikte an Kreuzungspunkten" — auch wenn sie leer sind
  6. Auswirkung auf Spezifikation (Spec-Sektion → Aenderung table)
  7. Quellen (every external source actually used)
- Header: `**Stand:** <today>`, `**Methodik:** AIAG-VDA 7-Step, Action Priority`, `**Bezug:** [specification.md](specification.md)`.

---

## Graph + Spec Integration (mandatory close-out)

The FMEA is not done until findings live in the graph, not just the document.

1. **Ask which risks become requirements, then derive them.** Show the user the whole risk matrix from Step 5 — every failure mode, Low AP included — with your recommendation per line (`write` for High and Medium AP, `leave` for Low). Ask which of them to write as requirements. The user decides: a Low one the user picks is written like any other; a High or Medium one the user declines stays in the document with that decision and its justification noted (AIAG-VDA demands the justification). If nobody answers (headless run), write High and Medium and say so in the closing report. Each chosen mitigation becomes a `REQ` node. Check the graph first for ID collisions via `graph_get_node` `{ "uid": "<candidate>" }` (uids are not idempotent — a re-add is a collision). Use the next free `REQ-NNN`.
2. **Apply to graph** via `graph_mutate` with a single `MutateCommand[]` batch — every write goes through the Apply-Gate (L2).

   **The graph attribute names are fixed by the rules — do not invent your own (CR-GC-308).** `FM-01`/`FM-02`/`FM-03` in `@sigloch/contracts/se` read exactly these keys, and so does the FMEA view. The S/O/D above are the *document's* column headers; in the graph they are spelled out:

   | write | as | read by |
   |---|---|---|
   | Severity 1–10 | `attributes.severity` (number) | FM-01, FM-03 (RPN) |
   | Occurrence 1–10 | `attributes.occurrence` (number) | FM-01, FM-03 |
   | Detection 1–10 | `attributes.detection` (number) | FM-01, FM-03 |
   | the hazard | `attributes.role: "risk"` | FM-01/02/03 select on it |
   | the countermeasure | `attributes.role: "mitigation"` | FM-02 |
   | what it is | `attributes.kinds` — `["functional"]` or `["non-functional"]`, as for any REQ | R-18 (who may satisfy it) |

   The role is the requirement's *motivation*, the kind is *what it is* — every FMEA REQ carries both. The role is satisfy-neutral; the kind alone picks the satisfier (`se:author-req`).

   Writing `S`/`O`/`D` instead makes `FM-01` fire on every risk REQ **and** leaves the view empty — that is precisely the defect CR-GC-308 fixed.

   For each new `REQ` add:
   - a `+ REQ-…` node line, with the FMEA finding in `attributes.rationale`, the S/O/D ratings under the names above, `attributes.role` and `attributes.kinds` (each as an `@key value` line below the node),
   - a **`compose`** edge from the risk `REQ` → the mitigation `REQ` (**FM-02**; `relation` between two REQs is *not* in `TRACE_PATTERNS` and `R-18` rejects it),
   - a `satisfy` edge onto every leaf `REQ`, chosen by its kind: a `non-functional` REQ from the responsible `MOD` (or the `SYS`, or the `FCHAIN` for an end-to-end effect) — which module is RESPONSIBLE, not merely related; a `functional` REQ from the `FUNC` that performs the countermeasure (R-18, `kinds` where-predicate),
   - a `verify` edge from a `TEST` → the `REQ` (R-01: every REQ must have ≥1 verify). Für ein Risiko mit **Action Priority High** verlangt **FM-03** zusätzlich, dass **jeder** Eintrag in `attributes.testRefs` ein `result: "passed"` trägt (CR-SM-231b) — „irgendeiner grün" zählt nicht, sonst verdeckte ein grüner Unit-Lauf einen roten Visual-Lauf. Ein Eintrag ohne Ergebnis ist nicht bestanden. Solange das nicht steht, zeigt die View das Risiko als unverifiziert, was der ehrliche Zustand ist.

   Example — ONE `graph_mutate` call, `formatE`:

   ```
   ## Nodes
   ### REQ
   + REQ-NNN|<FMEA finding as a falsifiable statement> [__name:<risk>]
   @role risk
   @kinds ["non-functional"]
   @rationale <FMEA finding>
   @severity 9
   @occurrence 3
   @detection 4
   + REQ-MMM|<the countermeasure, falsifiable> [__name:<countermeasure>]
   @role mitigation
   @kinds ["functional"]

   ## Edges
   + REQ-NNN -compose-> REQ-MMM
   + MOD-<responsible> -satisfy-> REQ-NNN
   + FUNC-<countermeasure> -satisfy-> REQ-MMM
   + TEST-<slug> -verify-> REQ-NNN, REQ-MMM
   ```

3. **Check the result.** `graph_mutate` returns `{ success, tier, appliedCommands, violations }`. The gate **BLOCKS the whole batch** if it would introduce a new **error-severity** violation (`tier: "block"`, `success: false`) — it does NOT silently drop nodes/edges. Read `violations`, fix the batch (e.g. add the missing `verify`), and re-apply.
4. **Check violations:** `rules_get_violations` — resolve any new R-01/R-02 gaps.
5. **Add the CR node.** In the same batch as the requirements (or directly after it), add the CR node of Step 7 — id and title only, `status: "done"` — with one `relation` edge from it to every REQ and TEST this analysis wrote. A closed CR documents; it orders no build: the build order for whatever the requirements still need is cut later by `se-plan`. If the SE-schema (ElementType/TraceType/rules) would have to change, stop and name it — that is a contracts change, not part of this analysis.
6. **Stamp the task.** Close with **one** `graph_mutate` batch on the SYS root. `analysisFreshness` is one attribute for all analyses and a patch replaces it whole: read SYS first (`graph_get_node`), keep every entry already in `analysisFreshness`, set `"fmea": { graphVersion: <current graphVersion()> }`, and write the complete object with the `baseVersion` you read — after the risk and mitigation REQ of step 2 are in the graph. **AF-04** (the entry rule of the task `fmea`) stays open until then. An FMEA with no risk REQ in the graph has not happened: leave AF-04 open instead of stamping an empty analysis.

---

## Rules
- **So viele Tests wie nötig, der Rest ist Verlinkung (CR-GC-760).** Jede Risiko-REQ braucht ihren `verify` (R-01, FM-03) — das heißt nicht: einen eigenen Test. Entscheide je Risiko: belegt der Test der Gegenmaßnahme, dass das Risiko beherrscht ist, dann verweise auf ihn (`TEST -verify-> REQ-risiko, REQ-massnahme`). Nur wo er das nicht belegt, entsteht ein neuer Test. Kein wortgleicher zweiter Test.
- **Die Wirkkette ist die Analyse-Einheit.** Ein Fehlermodus wird gegen das *Ergebnis der Kette* formuliert, nicht gegen ein Bauteil. Ohne Kettenprofil (Step 2) kein Step 4.
- **Ort vor Kreativität.** Die Orte aus `graph_metrics` sagen, wo die Kette schwach ist; die frei abgeleiteten Fehlermodi kommen danach und füllen nur, was die sechs Quellen nicht abgedeckt haben.
- **Eine Rechnung.** Du rechnest keine Kettenkennzahl selbst. Fehlt dir ein Ort, ist das ein Befund an `chainMetrics`, kein Anlass für eine Nebenrechnung.
- **Kein Doppelurteil mit dem Regelsatz.** Was `FC-02`…`FC-04`, `R-01`, `FM-01`…`FM-03` schon melden, wird zitiert, nicht neu behauptet. Was der Regelsatz *nicht* prüft (doppelte Zustandsgrößen, Zustandsgrößen ohne Werte), wird als Analystenbefund gekennzeichnet.
- **Function-based, not part-based:** start from what each function must do, then how it fails — not from a parts list. (AIAG-VDA core principle.)
- **Severity drives priority.** A safety-critical effect (S 9–10) is High/Medium AP even at low occurrence; do not let a good Detection score hide it.
- **No symptom-fixes.** Mitigations address root causes (Step 4 FC), consistent with the project's Root-Cause-Debugging rule.
- **Real sources only.** Cite datasheets/measurements; mark engineering estimates as such. Never fabricate figures.
- **NFRs are system-wide** — do not allocate a cross-cutting failure (EMV, brownout) to a single FN if it affects the whole system (see CLAUDE.md graph rules).
- Every FM must trace to an in-graph FUNC/MOD; every derived REQ must end up in the graph with satisfy + verify.
