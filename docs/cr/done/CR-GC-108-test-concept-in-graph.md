# CR-GC-108: Test-Konzept im Graph + Benchmark-REQ

**Status:** Done · **Closed:** 2026-06-18 · **Datum:** 2026-06-17 · **Modul:** Modell + `MOD-docs` · **Refs:** se-view-testconcept, ADR-001
**Graph:** TEST-Attribute (level/tool/constraint) + 2 REQ · **Max Files:** 5

## Problem (Why)
Das Test-Konzept soll **kein Hand-Dokument** sein, sondern eine **View aus dem Graph** (graph-is-ssot) — wie
architecture-graph.md. Dafür müssen die TEST-Knoten die nötigen Metadaten tragen. Zusätzlich: für die
Effizienz-UCs (token/llm) braucht es eine **Benchmark-Harness** (graphcode vs classic, 2 LLMs, Token-Counter)
und eine **messbare Qualitätsdefinition** — aber als **Requirement**, nicht als Bau (Bau = Realisierung).

## Entscheidung
1. **Test-Konzept = View:** jeder TEST-Knoten trägt `attributes.{level, tool, constraint}` (Testpyramide,
   Testinfrastruktur, Abdeckung sind daraus ableitbar). `docs/views/test-concept.md` ist GENERATED
   (se-view-testconcept / FUNC-render-views), nicht hand-gepflegt.
2. **`REQ-benchmark-harness`** (UC-token-efficiency): Setting graphcode-vs-classic, 2 LLMs, Token-Counter +
   Quality-Scorer. **Nur Requirement** — Harness-Bau ist eine spätere Realisierungs-CR.
3. **`REQ-quality-metric`** (UC-code-quality): „Qualität" = 0 error-Violations + REQ→TEST-Coverage + keine Drift.

## Scope (Graph)
- TEST-Attribute level/tool/constraint (20 TESTs); Pyramide/Infra/Coverage als View ableitbar.
- `+REQ-benchmark-harness` (verify ← TEST-token-efficiency), `+REQ-quality-metric` (verify ← TEST-code-quality).
- `docs/views/test-concept.md` als GENERATED-View (Demonstration der Rekonstruierbarkeit).

## Akzeptanzkriterien
- TEST-Knoten tragen level/tool/constraint; Testpyramide/CVE/Coverage aus dem Graph ableitbar.
- Benchmark + Qualität als REQ definiert (nicht gebaut); ontologie-konform; keine dangling; HTTP 200.

## Dependencies
Benchmark-Bau, Dashboard-V3_RULES (CR-GC-107) und der echte Exporter (FUNC-export-markdown) sind separate Realisierungen.
