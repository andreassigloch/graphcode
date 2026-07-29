# CR-GC-275 — graph_generate: der Kaltstart-Generierungstreiber

**Status:** ✅ Done (2026-07-29)
**Typ:** Feature (aimpro-Fahrplan-Schritt 6, Regime 1 — „LLM schlägt vor, Gate scort/wählt")

## Beschreibung

Der bisher fehlende generative Treiber: aus Prosa-Intention + Graph-Zustand die
**konkrete** nächste Generierungs-Instruktion — nicht die generische
`graph_next_step`-Aktion. Deterministische Zustandsmaschine (`src/generate.ts`,
se-plan-Muster: testbarer Kern, Vorschlagen bleibt beim Host):

- **seed** (kein SYS): Seed-Batch-Instruktion aus der Intention — 1 SYS
  (description = Intention), 1–3 ACTORs, 3–7 UCs; keine FUNC/MOD-Ebene.
- **expand**: schwächste Readiness-Dimension mit Funden (wie `nextStep`), aber
  als Schreib-Instruktion: `GENERATION_TEMPLATE` je Dimension + bis zu 3
  konkrete Funde (Element-UID + Regel + Message) + Kandidaten-Protokoll.
- **handoff** (alle Dimensionen ≥ threshold, 0 error-Violations): Übergabe an
  die ℝ⁶-Optimierung (`graph_suggest`, Schritt 3). `done: true`.

Das Gate-Protokoll steckt in jedem Prompt: `graph_authoring_guide` vor dem
Schreiben, Alternativen als dryRun-Batches, Auswahl per Verdict-Tier +
`fitAdvisory` (Schritt 4), bester Batch echt, block nie erzwingen. Intention
wird nach dem Seed aus der SYS-description gelesen (stateless, kein
Parallelspeicher). Skill `se:generate` ist der Host-Loop dazu.

Damit sind die Fahrplan-Schritte 3+4+6 zusammengeschaltet: generate erzeugt,
fitAdvisory misst, suggest optimiert — Vorschlag → Verdict in jeder Phase
(zugleich das Evidenz-Format fürs F2-Gate).

## Akzeptanzkriterien

- [x] Leerer Graph ohne Intention → seed fordert Intention an; mit Intention → Seed-Batch-Instruktion inkl. Gate-Protokoll
- [x] expand nennt die schwächste Dimension + konkrete Funde (UID + Regel), deterministisch; Intention aus SYS-description ohne Parameter
- [x] Schwelle erreicht + 0 Blocker → handoff mit graph_suggest-Anleitung, `done: true`
- [x] `graph_generate` im Registry beider MCP-Clients (agent-agnostic-Test erweitert)
- [x] `npm run build` grün; volle Suite 331/331

**Dateien:** `src/generate.ts` (neu), `src/tools/suggest.ts` (Binding),
`.claude/skills/se-generate.md` (neu), `tests/generate.test.ts`,
`tests/mcp.agent-agnostic.test.ts` (Tool-Liste), dieses Doc.

**Nicht-Ziele:** kein LLM-Aufruf im Tool (der Host generiert), keine
Kandidaten-Persistenz außerhalb des Gates, kein Beam/A* (Schritt 5,
braucht Merge-Fixture).
