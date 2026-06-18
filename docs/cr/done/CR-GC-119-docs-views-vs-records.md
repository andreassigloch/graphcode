# CR-GC-119: Docs-Taxonomie — Views vs Records (`+REQ-docs-taxonomy`)

**Status:** Done (2026-06-17) · **Modul:** Modell + `MOD-docs` · **Refs:** ADR-001 (AD-1/AD-8), REQ-graph-is-ssot, REQ-doc-export
**Graph:** `+REQ-docs-taxonomy` (Constraint) + `+TEST-docs-taxonomy` · **Max Files:** mechanischer Rename-Sweep (Ausnahme zur 5-Datei-Regel)

## Problem (Why)
`docs/` vermischt zwei Artefakt-Arten und verwischt damit das einzige Kriterium, das graph-is-ssot (AD-1) interessiert: **Ist das Artefakt aus dem Graphen reproduzierbar?**

- `docs/project/` hält `irr.md` (eingefrorenes Gate-Verdikt) **und** `test-concept.md` (Graph-Projektion).
- `docs/graph/` hält die SSOT `graphcode.graph.json` **und** `architecture-graph.md` (Graph-Projektion).

Die Frage „IRR/FMEA — View oder Record?" ist damit beantwortbar über einen **Litmus-Test**.

## Entscheidung

**Litmus-Test (die Regel):**
- **Aus dem Graphen reproduzierbar → VIEW.** Reine Projektion via `se-view-*`-Skill / künftig `FUNC-export-markdown`, GENERATED-Header, byte-deterministisch (`TEST-doc-export`). **Disposable** — existiert nur, bis es einen Live-Viewer gibt (AD-8). → `architecture-graph.md`, `test-concept.md`.
- **Friert ein datiertes Urteil / externen Input ein → RECORD.** Die Graph-Lesung war ein *Input*; das Verdikt/die Analyse ist das Artefakt und ist später **nicht** rekonstruierbar (Graph bereits 196→176 Elemente). Gleicher Charakter wie der ADR: datiert, hand-geschrieben, immutable, Prozess-Nachweis. → `irr.md` (`se-review`), FMEA `failure-mode-analysis.md` (`se-fmea`; nur die *abgeleiteten REQs* fließen in den Graphen zurück).

**Klassifikation:** Die Regel ist ein **Constraint**, kein funktionales Requirement. In `@sigloch/contracts/se` gibt es keinen eigenen `Constraint`-ElementType; ein Constraint = `non-functional`-REQ in der SYS-Governance-Gruppe (REQ-graph-is-ssot, REQ-frame-binding, REQ-no-extraction). Die Taxonomie-Regel ist querschnittliche Modellpflege-Governance ohne einzelnen FUNC-Owner → `non-functional`, modelliert als **neuer** Knoten `REQ-docs-taxonomy` (Verfeinerung von `REQ-graph-is-ssot`).

**Ziel-Layout:**
```
docs/
  graph/      graphcode.graph.json            ← nur SSOT
  views/      architecture-graph.md, test-concept.md   ← generiert, disposable
  records/    irr.md (+ künftig FMEA, TRR)     ← datiert, immutable, Nachweis
  adr/        ADR-001                          ← der EINE Founding-Charter
  cr/         open/ done/                      ← Change-/Decision-Log
```
`docs/records/` ist **keine** ADR-Serie und enthält keine Entscheidungen (die bleiben CRs, AD-3) — nur Assurance-Nachweise.

## Scope (Graph) — `scripts/seed-graph.mjs`, Kanten gegen TRACE_PATTERNS validiert
- **`+REQ-docs-taxonomy`** (`['non-functional']`): Litmus-Test als Beschreibung; verweist verbal auf `REQ-graph-is-ssot` (verfeinert) + `REQ-doc-export` (governt dessen Outputs).
- **Verfeinerungs-Kante** `tr('REQ-graph-is-ssot', 'REQ-docs-taxonomy', 'compose')` — gültiges `REQ→REQ compose` (Sub-Requirement). Rollt via graph-is-ssot zu SYS hoch; **nicht** zusätzlich in die SYS-Direkt-Liste (kein Doppel-Parent). `REQ-doc-export` bleibt Prosa (kein gültiges `REQ→REQ relation`).
- **`+TEST-docs-taxonomy`** + `tr('TEST-docs-taxonomy','REQ-docs-taxonomy','verify')`; Attribute `{ level: 'inspection', tool: 'grep/structure-check', constraint: 'views reproduzierbar & headered; records durable; kein docs/project' }`.
- **`+CR-GC-119`**-Knoten (`cr(..., 'MOD-docs', ...)`) + `'CR-GC-119': ['REQ-docs-taxonomy']` in `crReqs` (`CR→REQ relation`).
- MS-1-Beschreibung: Pfad `docs/project/irr.md` → `docs/records/irr.md`.

## Realisierung (mechanischer Rename-Sweep)
- `git mv` → `docs/views/architecture-graph.md`, `docs/views/test-concept.md`, `docs/records/irr.md`; `docs/project/` entfällt.
- Pfad-Refs umstellen: `CR-GC-108` (Z.14/23), `CR-GC-105` (Z.29), `.claude/skills/se-view-testconcept.md` (Z.6), `.claude/skills/se-fmea.md` (FMEA-Output Z.6/10/57; sirail-Inputs Z.18 unangetastet).
- `node scripts/seed-graph.mjs` regeneriert die JSON (schreibt vor dem `/api/graph/import`-POST; Fetch-Fehler ohne Server unschädlich).

## Akzeptanzkriterien
- `REQ-docs-taxonomy` (non-functional, `REQ-graph-is-ssot -compose→`), `TEST-docs-taxonomy` (`verify→`), `CR-GC-119` (`relation→`) in der regenerierten JSON vorhanden — keine still verworfenen Kanten.
- `docs/views/` + `docs/records/` befüllt; `docs/project/` weg; kein graphcode-eigener `docs/project/`-Ref mehr (`git grep`).
- Keine SE-Schema-Version-Bump nötig (REQ/TEST/CR sind Instanzen, kein ElementType/TraceType/Rule).
- `npm run build` grün.

## Dependencies
Keine. Realer Exporter (`FUNC-export-markdown`, CR-GC-113) und ein echter Viewer (AD-8) sind separate Realisierungen; bis dahin sind Views frozen-by-discipline.
