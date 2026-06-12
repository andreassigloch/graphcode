# GraphCode — Empfehlungen aus `safishamsi/graphify`-Vergleich

**Stand:** 2026-06-12
**Volle Analyse (SSOT):** `bok/docs/research/graphify-comparison.md`
**Scope dieser Datei:** nur die **graphcode-relevanten** Handlungspunkte. Extraktions-/Slicer-
Themen (tree-sitter, Leiden, Inline-Comments, Namenskollision) gehören zu graphify (Prio 2),
nicht hierher.

## Kernaussage

graphcode konkurriert **nicht** mit graphify: graphify = read/extract, graphcode = governter
write-gate + store. graphifys bewusste Lücke (kein Regel-Enforcement, kein getyptes Apply-Gate)
ist genau unser **Moat**. → Fokus halten: **Store + Gate + Hooks + Learning-Emission**, keine
Extraktion in graphcode bauen (die kommt vom Slicer/aimprove).

## Konkrete To-Dos (in graphcode umzusetzen)

| # | Empfehlung | Bezug | Wohin im Code |
|---|---|---|---|
| R1 | **Confidence-Metadaten am Mutate-Result/Violation** (analog EXTRACTED/INFERRED/AMBIGUOUS) — speist den 3-Tier-Apply-Gate (auto-apply / suggest / block) | graphify Confidence-Tags | `harness.ts` MutateResult, `MutateResultSchema` (§2.2) |
| R2 | **Auto-Rebuild/-Persist bei Commit + conflict-free Merge-Strategie** für das Graph-Artefakt | graphify Auto-Rebuild + Merge-Driver | `hooks.ts` post-apply + nightly; `.graphcode/` Artefakt |
| R3 | **Graph-Artefakt commit-fähig & merge-arm halten** (deterministische Serialisierung via codec) | graphify graph.json + Merge-Driver | `codec.ts` (Format-E, stabile Sortierung) |
| R4 | **Differenzierung explizit dokumentieren** in Architektur-Docs: governter Write-Gate als Alleinstellung | graphify hat keinen Write-Gate | `docs/ARCHITECTURE.md` (TBD) |

## Nicht tun (Scope-Abgrenzung)

- ❌ **Keine** tree-sitter/AST-Extraktion in graphcode — das ist Slicer-Aufgabe (graphify Prio 2).
- ❌ **Keine** LLM-Semantik-Extraktion, keine Community-Detection (Leiden) hier.
- ❌ Multi-Assistant Skill-Installer = Distributions-/Familien-Thema, nicht graphcode-Core.

## Verriegelung

Diese Empfehlungen ändern **nicht** die verriegelten Entscheidungen (Kuzu-Store, MCP-stdio,
ein Apply-Gate, SE-Ontologie aus contracts/se). R1–R3 sind Verfeinerungen *innerhalb* dieser
Gates und gehören in die CRs CR-GC-100 (Gate/Result) bzw. CR-GC-102 (Hooks) / CR-GC-103 (Codec),
sobald der §6-Checkpoint abgezeichnet ist.
