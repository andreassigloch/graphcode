# ADR-001: GraphCode — Ziel, Constraints & app-spezifische Entscheidungen

**Status:** Accepted (immutable) · **Datum:** 2026-06-17 · **Autor:** andreas@siglochconsulting
**Supersedes:** — · **Superseded by:** —

> **Founding-Charter (der EINE ADR).** Bracket-/Familie-Entscheidungen sind **SSOT in bok** und hier nur
> **referenziert**, nicht neu entschieden. Dieser ADR besitzt ausschließlich die **app-spezifischen**
> Entscheidungen + Guidelines, die bok nicht trägt. **Going-forward-Entscheidungen werden NICHT als
> weitere ADRs geführt**, sondern als **CR** (mit `## Problem`/Why) — ein ADR-Series + CR-Audit wären
> zwei Quellen = kein SSOT. Immutable: bei Bedarf neuer ADR der diesen *supersedet*, nie editieren.

## 1. Kontext (Warum)

Entwickler brauchen verlässliche **Traces & Strukturen** (Requirements ↔ Architektur ↔ Code ↔ Tests),
pflegen sie aber selten — manuelles SE-Modellieren ist Overhead. **graphcode erzeugt diese Strukturen im
Hintergrund**: der Coding-Agent (Claude Code / OpenCode) arbeitet über einem **governten Graphen** statt
über einem ungoverten Filesystem. Kurz: *graphcode = Claude Code/OpenCode mit Graph-Backend.*

## 2. Entscheidung — Was graphcode ist / nicht ist

**Variante A (Scope):** **Code bleibt Text** (compiliert); der **Doc-/Modell-Layer** (Mission, UCs,
Requirements, Architektur, Tests, Referenzen) ist **SSOT im Graphen**. F13 koppelt Code-Artefakte an
Modell-Knoten. graphcode ist **headless**, **agent-agnostisch**, **eine Instanz pro Repo**; Claude Code
ist *ein* Client. **NICHT:** Generator (→aimprove), Slicer (→graphify), Viewer (→graph-view-edit),
Learning (→learning-engine).

## 3. Bracket-Entscheidungen — SSOT in bok (nur referenziert)

Diese werden **nicht** hier entschieden; Rationale + Detail liegen in bok:

| Entscheidung | bok-Quelle |
|---|---|
| Ein Store = **Kuzu** (embedded, Cypher) | `2yR-35-store-spec.md` |
| Ein Transport = **MCP-stdio** + SSE/WS-Bridge | `graphcode-governance.md` §2 |
| Ein **Apply-Gate** (`mutate()`, autorenunabhängig) | `unified-model-interface` §4 |
| **SE-Ontologie + V3_RULES** importieren (nie forken) | `@sigloch/contracts/se` |
| **Format-E-Codec** Baseline (+ `merge_nodes`) | `2yR-36-codec-spec.md` |
| OpenCode-Sidecar · BYOK · TypeScript · Zod | `2yR-SSOT-stand-und-ziel.md` |
| **Drift-Locks L1–L4** | `graphcode-governance.md` §3 |

## 4. App-spezifische Entscheidungen — SSOT = dieser ADR + Graph

| # | Entscheidung | Why (kurz) |
|---|---|---|
| **AD-1** | **Graph-first Self-Hosting:** graphcode modelliert sich selbst; SSOT = `docs/graph/graphcode.graph.json` (Re-Export via `scripts/export-graph.mjs`, CR-GC-113). `docs/*.md` = **INPUT-ONLY**. | Dogfooding der eigenen Value-Prop; eine Quelle, kein Doc-Drift. |
| **AD-2** | **Frame ist bindend** (`REQ-frame-binding`): Struktur+Interfaces sind für die Realisierung verriegelt. Ergänzung nur, wenn sie in vordefinierte Boxen passt (FUNC/FLOW/REQ/TEST an bestehendem MOD/UC). | Realisierung soll detaillieren, nicht neue Boxen wachsen lassen. |
| **AD-3** | **3-SSOT-Modell:** bok (Bracket-Rationale) · Graph (Modell) · **CR** (Change+Why). **Kein app-lokaler ADR-Series.** | ADR-Series + CR-Audit = zwei Quellen = kein SSOT. |
| **AD-4** | **Customer-View-Altitude:** UC = Kundennutzen (4: code-quality, efficient-testing, token-efficiency, reduced-llm); FUNC verketten **nur via FLOW**; pre/post = REQ (`ReqKind`); FCHAIN = Szenario. | UC ist das *Warum* (Nutzen), nicht die Funktionsdefinition; Daten-Fluss-Modellierung statt Call-Graph. |
| **AD-5** | **Ingestion nach Größe:** chat-taugliche Inputs → graphcode direkt durchs Gate; **große Docs → graphify** sliced zuerst. | Grenze = „passt in einen Chat"; keine Eigen-Extraktion (`REQ-no-extraction`). |
| **AD-6** | **App-spezifische Module** über die 4 Runtime-Module hinaus: `MOD-cli` (npx-Distribution), `MOD-docs` (Markdown-Re-Export). Nur **sigloch-modules-Shared** braucht Familie-Review. | App-lokale Module sind frei; geteilte Module sind die Governance-Grenze. |
| **AD-7** | **npx-Distribution** `npx @sigloch/graphcode init\|update\|remove` (ruflo/claude-flow-Muster). | Self-contained statt AIMPRO_ROOT-Kopplung. GATED auf D5 + CR-GC-100..103. |
| **AD-8** | **Graph→Markdown Re-Export** verpflichtend (`UC-doc-export`/`FUNC-export-markdown`): human-readable Views deterministisch generiert, GENERATED-Header, nie hand-editiert. **Gebaut (CR-GC-113/220):** 16 deterministische Views. `lean`-Scope **verfeinert** (CR-GC-226): Renders = Projektionen (keine separaten Deliverables), Creations (ConOps/FMEA/Assumption/Trade/Impl-Plan) = leichtgewichtige Urteils-Inputs + Gate-Vorbedingung. Pointer: `docs/proposals/readiness-artifact-model.md` §3. | Schließt die graph-is-ssot-Drift-Lücke; Renders nie hand-editiert, Creations leichtgewichtig in-scope (kein ASIL-D). |

## 5. Guidelines (app-spezifisch)

- **Graph-is-SSOT:** Modelländerung = Mutation am Graph (durchs Gate), dann Re-Export — nie am Markdown.
- **CR-Konzept** (SSOT = `~/.claude/CLAUDE.md` „Documentation & CR Process" + `graphcode/CLAUDE.md`):
  Format `docs/cr/open/CR-XXX-*.md`; **Lifecycle** `git mv open→done`, sofort committen; **Größenregel**
  max 5 Dateien/ein Chat. Jeder CR trägt **`## Problem` (Why) → `## Design`/Architektur-Entscheidung →
  `## Akzeptanzkriterien`** und referenziert im Commit (`feat: … (CR-XXX)`). Der CR **mutiert den Graphen**
  (`CR -relation→ UC/REQ/FUNC/MOD`); seine Why-Prosa ist der Commit-Mehrwert. **Ein CR ist die
  Entscheidungs-Aufzeichnung** — kein zusätzlicher ADR.
- **Ontologie-Konformität:** alle Kanten ∈ `TRACE_PATTERNS`; keine neuen ElementType/TraceType/Customer-UC/
  Shared-MOD ohne Familie-Review.
- **Test-Disziplin** (`CLAUDE.md`): verifiziert (`npm test`+`build`) **und** validiert; Persistenz = Disk.

## 6. Konsequenzen

- Realisierung läuft **innerhalb** dieses Frames; Einstieg **CR-GC-100** (D5 Build-Blocker → Kuzu-Gate),
  dann 101 (MCP) → 102 (Hooks) → 103 (Codec).
- Dieser ADR ist **immutable** und referenziert den Graphen für strukturelle Details (er listet keine
  Einzel-REQs — die sind im Graph SSOT).
- Solange `FUNC-export-markdown` nicht realisiert ist, gehen generierte Docs **frozen-by-discipline**;
  dieser ADR ist davon ausgenommen (founding record, kein generierter View).

## 7. Ableitung → Graph (SSOT für Struktur)

| ADR-Inhalt | Graph-Knoten |
|---|---|
| Mission (§1–§2) | `SYS-graphcode` |
| Goals (§4 AD-4) | `UC-code-quality`, `UC-efficient-testing`, `UC-token-efficiency`, `UC-reduced-llm` |
| Bracket-Constraints (§3) | `REQ-single-store`, `REQ-single-transport`, `REQ-one-gate-per-repo`, `REQ-import-se-ontology`, … |
| App-Constraints (§4) | `REQ-frame-binding`, `REQ-graph-is-ssot`, `REQ-npx-distribution`, `REQ-doc-export`, … |

## 8. Referenzen

- **Graph (SSOT):** `docs/graph/graphcode.graph.json` · Re-Exporter: `scripts/export-graph.mjs` (CR-GC-113)
- **Öffentliche Einführung:** `README.md` · `docs/articles/`
- _Hinweis:_ Teile der Entwurfshistorie verweisen auf interne Governance-Dokumente, die nicht Teil dieses Repositorys sind.
