# SPIKE-GC: Context-Sufficiency — liefert `graph_context` „gerade-gut-genug" Kontext?

**Status:** Proposed (2026-06-26) · **Voraussetzung:** CR-GC-213 (MVP, BLOCKER), optional CR-GC-214 (Arm B), CR-GC-207-Materialisierung (Fixture)
**Frage:** Liefert das `graph_context`-MVP einem Agenten den **minimal-hinreichenden** Kontext, um einen Milestone zu implementieren — ohne `SPEC.md`/Spike-Re-Reads, bei ≪ Baseline-Kontext — und schafft ein **lokales Modell** denselben Job aus den Bundles?

> Begründung: Die Graph-Build-Arbeit (reiche `description`-Prosa pro Knoten, Test-Konzepte, Spike-Schlüsse) war korrekt — verloren ging die **Konsumtion**: der Impl-Loop re-derivierte aus `SPEC.md`/Spikes, was bereits als Knoten-Prosa im Graph stand. Dieser Spike misst, ob ein ergonomisches Pull-Tool (`graph_context`) die Konsumtion graph-first dreht — und ob das ein kleineres Modell tragfähig macht (= die eigentliche Win-Condition).

## Hypothesen (falsifizierbar)

- **H1 — Sufficiency:** Mind. 1 Milestone (z. B. `CR-GF-105` / Slicer-Core) wird implementiert **und** Tests grün, **allein** aus `graph_context`-Bundles + Reads der zu editierenden Dateien — **ohne** `docs/SPEC.md`, **ohne** `spikes/**`.
- **H2 — Efficiency:** injizierter Kontext pro Milestone ≤ **~10k Tokens** (vs Baseline ~30k+ je Planungs-Schritt); Peak-Context der Session **< 50 %** der Baseline-619k.
- **H3 — Small-Model-Viability:** ein lokales Modell (48 GB M4, ~32B-Klasse quantisiert, ≤ 32k ctx) implementiert denselben Milestone aus den Bundles, wo es am 600k-Prosa-Baseline scheitern würde.

## Fixture (Test-Repo — „earlier status of graphify")

**Quelle (Source-Stand):** graphify @ **Pre-Impl-Commit**. Der Impl-Loop (Session `4025681c`, 2026-06-24 14:59+) erzeugte `c2aab74 feat: pipeline modules + tests + benchmark`. Pre-Impl-Stand = dessen Eltern, ~`adc5870`/`85a4694` (2026-06-24): Spec + Mission + UCs + REQs + Test-Konzepte definiert, **Pipeline-Module noch nicht implementiert**.

**Graph (kritisch):** ⚠ `.graphcode/` ist **gitignored** → ein Checkout stellt den Graphen **nicht** wieder her (genau CR-GC-207s Befund: nie materialisiert). Fixture-Bau daher reproduzierbar:

1. Aktuellen Graphen via `graph_export` → `graphify-spec-state.graph.json` materialisieren.
2. **Realisierungs-Zustand strippen:** `attributes.codeRef`/`testRef` entfernen, `CR`/`MS`-Readiness auf Pre-Impl zurücksetzen (FUNC = spec'd, nicht realisiert) → ergibt den **Spec-Ära-Graphen**.
3. `graphify-spec-state.graph.json` **committen** → reproduzierbares Fixture (validiert nebenbei CR-GC-207-Materialisierung).

**Referenz-Impl-Prep (= `codeRef`, kein neues Attribut):** für die FUNCs, deren Spike-Algorithmus zum Implementieren nötig ist (`slice`/`score`/`matcher`), den `codeRef` auf den bewährten Spike/Stub setzen **oder** den Algorithmus-Hinweis in die REQ/TEST-Prosa schreiben — schließt die **einzige legitime** Spike-Re-Read-Lücke (Graph hält den Vertrag; die Referenz-Impl ist nur ein Pointer). Ist der Spike-Code funktional nicht 100%, sieht der Agent das und fixt.

## Baseline (Control — bereits gemessen, Session `4025681c`)

| Signal | Baseline |
|---|---|
| `Read` calls / chars | 31 / 171.417 |
| `Bash` calls / chars | 90 / 78.787 |
| `docs/SPEC.md` (Einzel-Read) | 50.132 chars |
| precise nav (`impact`/`expand`/`get_node`/`context`) | **0** |
| Datei/Shell-Gather gesamt | ~250k chars (~62k tok) |
| Peak-Context | 619.123 tok |

## Treatment-Arme

- **A0 (Pre-MVP, kein Code — braucht CR-GC-213 NICHT):** nur **bestehende** Precise-Tools (`graph_get_node` + `graph_expand {branch:'all'|'traces'}` + `verify`-Kanten), Prompt instruiert „pro Knoten Graph-query, **kein** `SPEC.md`/`spikes`". Testet **H1 (Content-Sufficiency)** und **de-riskt CR-GC-213, bevor es gebaut wird**. ⚠ **Bias gegen** Graph-first: die 4–5-Call-Friktion (genau die Ursache des `SPEC.md`-Fallbacks) ist hier noch da → gelingt A0 trotzdem, ist das *starkes* Signal; ist es klobig, ist das das Argument *für* CR-GC-213, nicht gegen das Konzept. Noch billiger als Vorab-Gate: **statischer Dry-Run** (Spec-Closure der `CR-GF-105`-Knoten via bestehende Tools gegen den *aktuellen* Graph — Spec-Inhalt unverändert, nur Realisierungs-Attribute differieren — gegen das diffen, was die Originalsession real aus `SPEC.md`/Spikes zog; kein Agent-Loop, kein Fixture-Strip nötig).
- **A (Tool-MVP):** `graph_context` verfügbar; **gleicher** Impl-Prompt; Agent angewiesen, pro Knoten `graph_context` als Implementier-Input zu nutzen. Read-Deny **aus**. Testet die **Ergonomie-These** (ein Call statt 4–5 dreht den Read-Default). A-vs-A0 **quantifiziert** den Ergonomie-Lift.
- **B (A + Erzwingung):** zusätzlich CR-GC-214-Hook aktiv (`SPEC.md`/Spike-Reads denied). Isoliert: **reicht Ergonomie (A), oder braucht es Erzwingung (B)?**
- **C (Small-Model):** Arm B mit lokalem Modell (BYOK/OpenCode-Executor, 48 GB M4). **User-getriggert** als Final-Test nach Change-Implementierung.

## Prozedur

1. Fixture-Repo bereitstellen (s. o.), Spec-Ära-Graph laden, MCP `graphcode` aktiv.
2. **Exakt denselben** Prompt fahren (verbatim aus `4025681c`): `/loop until all milestones are implemented and tested until E2E user test`.
3. Transkript je Arm aufzeichnen (`~/.claude/projects/-Users-andreas-Developer-dev-graphify/<id>.jsonl`).
4. **Mess-Harness** (wiederverwendbar, aus der Analyse dieses Spikes): pro Transkript Tool-Call-Counts + Result-Chars + Peak-Context extrahieren; Vergleich gegen Baseline. (Parser: `tools.py`/`usage.py` — Tool-Use → Result-Size-Mapping per `tool_use_id`, `usage`-Felder für Context-Peak.)

## Metriken & Schwellen („just good enough")

| Metrik | Baseline | Ziel Arm A/B |
|---|---|---|
| Reads von `SPEC.md`/`spikes` | 50k + ~21k chars | **0** |
| precise graph calls (`context`/`impact`) | 0 | **≥ 1 / Milestone** |
| injizierter Kontext / Milestone | ~30k+ tok | **≤ 10k tok** |
| Peak-Context Session | 619k tok | **< 300k tok** |
| Tests grün (Akzeptanz erfüllt) | ja (Referenz) | **ja (= oder besser)** |

## Erfolgs- / Abbruchkriterien

- **ERFOLG:** H1 erfüllt (Milestone grün ohne stale Reads) **und** H2 (Context-Halbierung+) **und** in Arm C schließt das lokale Modell mind. 1 Milestone.
- **TEILERFOLG / Signal:** Agent will wiederholt `score.ts`/`matcher.ts` → `codeRef`-Lücke ist real → **Fixture-Prep nachziehen** (`codeRef` auf Spike/Stub bzw. REQ-Prosa), **nicht** Tool-Design ändern.
- **ABBRUCH / Falsifikation:** `graph_context`-Bundle reicht nicht (Agent kann ohne Full-Doc nicht implementieren) → Pack zu schmal → `depth`/Closure-Definition revidieren **oder** Hypothese „Graph = hinreichend" verworfen (dann ist das Doc-SSOT, nicht der Graph).
- **A0-Gate (vor CR-GC-213-Bau):** A0/Dry-Run zeigt Content **un**zureichend → erst Graph-**Daten** fixen (`codeRef` auf Spike/Stub bzw. REQ-Prosa), **dann** Tool. Content zureichend → CR-GC-213 bauen, A-vs-A0 misst den Ergonomie-Lift.

## Entscheidungswert (was wir lernen)

- **Ergonomie (A) vs Erzwingung (B):** entscheidet, ob CR-GC-214 nötig ist oder ob ein besseres Tool allein die Konsumtion dreht.
- **Small-Model (C):** **DIE** Win-Condition — kleineres Modell durch besseres Framework. Positiv ⇒ Konzept trägt, OpenCode-Executor + BYOK gerechtfertigt; das „wir können Claude Code nicht motivieren" wird zur Begründung *für* die eingeschränkte Surface, nicht gegen das Konzept.
- **Graph-Lücken:** wo ist Prosa/`codeRef` zu dünn? → konkrete Daten-Nachträge statt Architektur-Änderung.

## Deliverable

`docs/spikes/SPIKE-GC-context-sufficiency-RESULTS.md`: Metrik-Tabelle (Baseline vs A/B/C), H1–H3-Verdikt, Liste der Graph-Lücken (Knoten ohne hinreichende Prosa/`codeRef`).
