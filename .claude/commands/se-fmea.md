---
name: se-fmea
version: 2
description: Perform a state-of-the-art FMEA (AIAG-VDA 7-step) with the FCHAIN (Wirkkette) as the analysis unit, and integrate findings into the SE-graph + spec
---

Conduct a Failure Mode and Effects Analysis following the **AIAG-VDA FMEA Handbook (2019)** 7-step method, mapped onto this project's SE-ontology graph. Output is `docs/records/failure-mode-analysis.md` plus a CR that integrates derived requirements into the graph. This is the FMEA **create** skill; once findings are in the graph, render them with `se-view:fmea` (the read-only FMEA view) — do not re-author the analysis at render time.

**Scope argument:** the user names the analysis target. **The default and preferred unit is one `FCHAIN`** — a Wirkkette is a bounded end-to-end effect path with a named trigger and a named result, which is exactly what a failure mode needs to be stated against ("the chain does not reach its result because ..."). A `MOD` or a component (e.g. `ACS712`) is a legitimate but secondary scope: it cuts across chains, so its failure effects can only be stated per chain anyway. A whole-`SYS` scope means *every* chain, one profile each — say so and confirm the effort before starting.

If unscoped, ask for it — do not guess. If the user names a `MOD` or a component, resolve it to the chains it participates in (`allocate` → FUNC → `compose` → FCHAIN) and run Step 2 per chain.

Reference exemplar (existing, RPN-based — upgrade it to AP, do not copy verbatim): `docs/records/failure-mode-analysis.md`, integrated via `docs/cr/done/CR-FMEA-001-failure-mode-requirements.md`.

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

**For each in-scope FCHAIN, produce a chain profile before writing a single failure mode.** Four numbers, all computed from the queries above — they decide *where* to look, and a Step 4 that ignores them is a brainstorm, not an analysis:

| # | Kennzahl | Berechnung | Was sie für die FMEA bedeutet |
|---|---|---|---|
| 1 | **Linearität** | längster `FUNC→FLOW→FUNC`-Pfad unter den Mitgliedern ÷ Zahl der Mitglieder | < 0,8: die Kette ist kein Ablauf, sondern ein Stern. Ein Fehlermodus „Kette bricht bei Schritt n ab" ist dann nicht formulierbar — die Reihenfolge, die der Kettenname behauptet, steht nicht im Graphen |
| 2 | **Importgrad** | Zahl der FLOWs, die ein Mitglied konsumiert, deren Erzeuger aber **kein** Mitglied ist (ACTOR-Eingänge zählen nicht) | jeder Import ist eine Schnittstelle zu einer fremden Kette und damit ein Pflicht-Fehlermodus (Step 4, Quelle A) |
| 3 | **Übergaben** | FLOWs, die ein Mitglied erzeugt und eine FUNC **außerhalb** der Kette konsumiert | jede Übergabe ist der Eingang der nächsten Kette; die Fehlerwirkung endet nicht an der Kettengrenze (Step 4, Quelle B) |
| 4 | **Akteursgrenze** | ACTOR→FLOW→Mitglied (Trigger) und Mitglied→FLOW→ACTOR (Ergebnis) | fehlt eine Seite, ist die Fehler**wirkung** (FE) nicht auf einen Menschen abbildbar. `FC-01`/`FC-04` prüfen das bereits — hol dir die Verstöße mit `rules_get_violations`, statt es nachzurechnen |

**Was der Regelsatz schon urteilt, und was nicht.** `FC-01` (Akteursgrenze), `FC-02` (Leaf-UC hat FCHAIN), `FC-03` (Kette ist flach) und `FC-04` (Trigger **und** Konsument) liegen in `@sigloch/contracts/se` und laufen im Gate — lies sie über `rules_get_violations` und **wiederhole sie nicht als eigenen Befund**. Linearität und Importgrad (1 und 2) sind **keine** Regel; es gibt für sie keine Schwelle in `metricPolicy` und der Skill rechnet sie hier selbst. Schreib die Zahl mit ihrer Berechnung ins Protokoll, damit der Leser sie nachprüfen kann, und behandle sie als Befund des Analysten, nicht als Urteil des Werkzeugs.

Ergebnis von Step 2: der Strukturbaum (System → Subsystem → Funktionselement) **plus** eine Tabelle `FCHAIN | Mitglieder | Linearität | Importe | Übergaben | Akteursgrenze ✓/✗`, absteigend nach Importgrad. Diese Reihenfolge ist die Arbeitsreihenfolge für Step 4.

### Step 3 — Function Analysis
- For each FUNC/MOD in scope, state its intended function (what it must do, with measurable acceptance where the spec defines it).
- **State each FUNC's position in the chain**: Eingang (konsumiert den ACTOR-Trigger), Zwischenschritt, Ausgang (erzeugt das ACTOR-Ergebnis), oder Übergabepunkt (erzeugt einen FLOW, den eine fremde Kette konsumiert). Die Position bestimmt die Fehler**wirkung**: ein Ausfall am Eingang verhindert die Kette, ein Ausfall am Übergabepunkt verschiebt sie in eine andere Kette, wo sie niemand als Störung dieser Kette erkennt.
- Link functions to the requirements they `satisfy` (FUNC→REQ edges already in graph; query via `graph_get_edges` `{ "edgeType": "satisfy" }`).
- **Flag jede REQ, die von mehr als einer FUNC erfüllt wird.** Dann trägt keine der beiden allein die Verantwortung, und der Fehlermodus „Zusage wird verletzt, ohne dass eine der beiden FUNCs ausgefallen ist" ist real. Query: `graph_get_edges` `{ "edgeType": "satisfy" }`, nach Ziel gruppieren.

### Step 4 — Failure Analysis

**Walk these four graph-derived sources first — they are obligatory and each one names concrete elements. Free-form derivation comes after, and only for what they did not cover.** A finding from a source below cites the element ids it came from; that is what makes it auditable instead of plausible.

**Quelle A — Importe (aus Kennzahl 2).** Für jeden importierten FLOW: er kommt aus einer fremden Kette, deren Takt, Ausfallverhalten und Betriebsmodus diese Kette nicht kontrolliert. Pflicht-Fehlermodi je Import: *bleibt aus*, *ist veraltet*, *widerspricht einer anderen Quelle derselben Größe*. Prüfe für jeden Import, ob ein REQ die Aktualität oder das Ausbleiben behandelt (`graph_get_edges` `{ "uid": "<FUNC>", "edgeType": "satisfy" }`) — fehlt es, ist die Lücke selbst der Befund.

**Quelle B — Übergaben (aus Kennzahl 3).** Für jeden FLOW, den eine fremde FUNC konsumiert: die Fehlerwirkung (FE) tritt **in der anderen Kette** auf. Trag sie dort ein, nicht hier — sonst bewertest du eine Severity gegen den falschen Akteur. Ein Fahrauftrag mit falschem Zeitfenster ist für den Fahrgast eine späte Kabine (S niedrig) und für die Streckenfahrt eine Blockverletzung (S hoch); die zweite ist die maßgebliche.

**Quelle C — doppelt geführte Zustandsgrößen.** Zieh die SCHEMAs der beteiligten FLOWs (`graph_get_edges` `{ "edgeType": "relation" }`) und vergleiche ihre Felder. Trägt **dieselbe** Zustandsgröße in zwei SCHEMAs (z.B. ein Türzustand in der Kabinenzustandsmeldung *und* im Türstatus), existieren zwei Kopien, die divergieren können. Fehlermodus: *die beiden Kopien widersprechen sich, und der Verbraucher liest die falsche*. Prüf, ob ein REQ ihre Konsistenz fordert — meist nicht, und dann ist genau das die abgeleitete Anforderung aus Step 6. Ist die Größe sicherheitsgerichtet (Spannungsfreiheit, Verriegelung, Freigabe), ist der Befund per Definition S 9–10.

**Quelle D — Zustandsgrößen ohne aufgezählte Werte.** Nennt ein SCHEMA ein Zustands-/Statusfeld, ohne seine Werte zu enumerieren, gibt es kein prüfbares Übergangsverhalten: „unerwarteter Zustand" ist dann kein Fehlermodus, den ein Test erkennen könnte. Der Befund ist der fehlende Wertebereich, die Mitigation seine Festlegung. Bei `concept: true` (kein Zod-Export) gilt das für **jedes** Feld — sag das einmal für den Scope und zähl nicht 30 Einzelbefunde.

Danach, für jede Funktion:
- Derive the **failure chain**: Failure Effect (FE, on system/user) ← Failure Mode (FM, how the function fails) ← Failure Cause (FC, root cause).
- Number failure modes `FM-NN`. Each FM entry contains:
  - **Schwere/Severity (S, 1–10) | Auftreten/Occurrence (O, 1–10) | Entdeckung/Detection (D, 1–10)**
  - **Ursache (FC):** root cause, physically grounded (cite datasheet figures, measured values where possible).
  - **Auswirkung (FE):** effect on the system and the user; flag safety-critical effects explicitly.
  - **Mitigation:** categorize each measure as `SW (Pflicht)`, `HW (Pflicht)`, `HW (Empfehlung)`, `Config`, or `Betrieb`.
  - **Spec-Bezug:** the FN/MD/RQ element the finding affects.

### Step 5 — Risk Analysis → **Action Priority (AP), not RPN**
- Rate S, O, D on the 10-point scales.
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

### Step 7 — Documentation of Results
- Write `docs/records/failure-mode-analysis.md` with sections:
  1. Zusammenfassung (count of FMs + Top-3 AP-High risks)
  2. Kettenprofil (die Step-2-Tabelle: `FCHAIN | Mitglieder | Linearität | Importe | Übergaben | Akteursgrenze`) — sie begründet, warum die Fehlermodi dort sitzen, wo sie sitzen
  3. Fehlermodi im Detail (`FM-NN`, the Step-4 entries) — jeder Eintrag nennt seine Quelle (A/B/C/D oder „frei abgeleitet") und die Element-uids, aus denen er stammt
  4. Risikomatrix (AP-sorted, Step 5)
  5. Handlungsempfehlungen priorisiert (Step 6)
  6. Auswirkung auf Spezifikation (Spec-Sektion → Aenderung table)
  7. Quellen (every external source actually used)
- Header: `**Stand:** <today>`, `**Methodik:** AIAG-VDA 7-Step, Action Priority`, `**Bezug:** [specification.md](specification.md)`.

---

## Graph + Spec Integration (mandatory close-out)

The FMEA is not done until findings live in the graph, not just the document.

1. **Derive requirements** from AP-High/Medium mitigations. Each becomes a `REQ` node. Check the graph first for ID collisions via `graph_get_node` `{ "uid": "<candidate>" }` (uids are not idempotent — a re-add is a collision). Use the next free `REQ-NNN`.
2. **Apply to graph** via `graph_mutate` with a single `MutateCommand[]` batch — every write goes through the Apply-Gate (L2).

   **The graph attribute names are fixed by the rules — do not invent your own (CR-GC-308).** `FM-01`/`FM-02`/`FM-03` in `@sigloch/contracts/se` read exactly these keys, and so does the FMEA view. The S/O/D above are the *document's* column headers; in the graph they are spelled out:

   | write | as | read by |
   |---|---|---|
   | Severity 1–10 | `attributes.severity` (number) | FM-01, FM-03 (RPN) |
   | Occurrence 1–10 | `attributes.occurrence` (number) | FM-01, FM-03 |
   | Detection 1–10 | `attributes.detection` (number) | FM-01, FM-03 |
   | the hazard | `attributes.kinds: ["risk"]` | FM-01/02/03 select on it |
   | the countermeasure | `attributes.kinds: ["mitigation"]` | FM-02 |

   Writing `S`/`O`/`D` instead makes `FM-01` fire on every risk REQ **and** leaves the view empty — that is precisely the defect CR-GC-308 fixed.

   For each new `REQ` add:
   - an `add-node` for the `REQ`, with the FMEA finding in `attributes.rationale`, the S/O/D ratings under the names above, and `attributes.kinds`,
   - an `add-edge` **`compose`** from the risk `REQ` → the mitigation `REQ` (**FM-02**; `relation` between two REQs is *not* in `TRACE_PATTERNS` and `R-18` rejects it),
   - an `add-edge` `satisfy` from the responsible `FUNC` → the `REQ` (which function is RESPONSIBLE, not merely related),
   - an `add-edge` `verify` from a `TEST` → the `REQ` (R-01: every REQ must have ≥1 verify). Für ein Risiko mit **Action Priority High** verlangt **FM-03** zusätzlich, dass **jeder** Eintrag in `attributes.testRefs` ein `result: "passed"` trägt (CR-SM-231b) — „irgendeiner grün" zählt nicht, sonst verdeckte ein grüner Unit-Lauf einen roten Visual-Lauf. Ein Eintrag ohne Ergebnis ist nicht bestanden. Solange das nicht steht, zeigt die View das Risiko als unverifiziert, was der ehrliche Zustand ist.

   Example: `graph_mutate` `{ "commands": [ { "op": "add-node", "node": { "uid": "REQ-NNN", "type": "REQ", "name": "...", "description": "...", "attributes": { "rationale": "<FMEA finding>", "kinds": ["risk"], "severity": 9, "occurrence": 3, "detection": 4 } } }, { "op": "add-node", "node": { "uid": "REQ-MMM", "type": "REQ", "name": "<countermeasure>", "description": "...", "attributes": { "kinds": ["mitigation"] } } }, { "op": "add-edge", "edge": { "sourceId": "REQ-NNN", "targetId": "REQ-MMM", "edgeType": "compose", "attributes": {} } }, { "op": "add-edge", "edge": { "sourceId": "FUNC-...", "targetId": "REQ-NNN", "edgeType": "satisfy", "attributes": {} } }, { "op": "add-edge", "edge": { "sourceId": "TEST-...", "targetId": "REQ-NNN", "edgeType": "verify", "attributes": {} } } ] }`.
3. **Check the result.** `graph_mutate` returns `{ success, tier, appliedCommands, violations }`. The gate **BLOCKS the whole batch** if it would introduce a new **error-severity** violation (`tier: "block"`, `success: false`) — it does NOT silently drop nodes/edges. Read `violations`, fix the batch (e.g. add the missing `verify`), and re-apply.
4. **Check violations:** `rules_get_violations` — resolve any new R-01/R-02 gaps.
5. **Open a CR** `docs/cr/open/CR-FMEA-NNN-<desc>.md` listing the new RQs, affected spec sections, and acceptance criteria (mirror `CR-FMEA-001`). Patch `specification.md` sections named in the Step-7 impact table. If the SE-schema (ElementType/TraceType/rules) changed, bump the version in `@sigloch/contracts/se/index.ts`.
6. On completion, `git mv` the CR `open/ → done/` and commit `feat: FMEA findings for <scope> (CR-FMEA-NNN)`.

---

## Rules
- **Die Wirkkette ist die Analyse-Einheit.** Ein Fehlermodus wird gegen das *Ergebnis der Kette* formuliert, nicht gegen ein Bauteil. Ohne Kettenprofil (Step 2) kein Step 4.
- **Kennzahl vor Kreativität.** Importgrad und Linearität sagen, wo die Kette schwach ist; die frei abgeleiteten Fehlermodi kommen danach und füllen nur, was die vier Quellen nicht abgedeckt haben.
- **Kein Doppelurteil mit dem Regelsatz.** Was `FC-01`…`FC-04`, `R-01`, `FM-01`…`FM-03` schon melden, wird zitiert, nicht neu behauptet. Was der Regelsatz *nicht* prüft (Linearität, Importgrad, doppelte Zustandsgrößen), wird als Analystenbefund gekennzeichnet — mit der Berechnung daneben.
- **Function-based, not part-based:** start from what each function must do, then how it fails — not from a parts list. (AIAG-VDA core principle.)
- **Severity drives priority.** A safety-critical effect (S 9–10) is High/Medium AP even at low occurrence; do not let a good Detection score hide it.
- **No symptom-fixes.** Mitigations address root causes (Step 4 FC), consistent with the project's Root-Cause-Debugging rule.
- **Real sources only.** Cite datasheets/measurements; mark engineering estimates as such. Never fabricate figures.
- **NFRs are system-wide** — do not allocate a cross-cutting failure (EMV, brownout) to a single FN if it affects the whole system (see CLAUDE.md graph rules).
- Every FM must trace to an in-graph FUNC/MOD; every derived REQ must end up in the graph with satisfy + verify.
