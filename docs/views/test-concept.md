# GraphCode — Test-Konzept

> ⚠️ **GENERATED aus `docs/graph/graphcode.graph.json` (SSOT)** — Stand 2026-06-17.
> Nicht hand-editieren; aus TEST-Knoten (`attributes.level/tool/constraint`) + `verify`-Traces rekonstruiert
> (se-view-testconcept / FUNC-render-views). Modelländerung am Graph, dann neu rendern.

## 1. Testpyramide (aus TEST.attributes.level)

| Level | # | Bedeutung |
|---|---|---|
| acceptance (CVE) | 4 | High-Level UC-Verifikation — der Layer, den Claude&Co auslassen |
| integration | 10 | Funktions-/Gate-/Hook-/Codec-Verhalten gegen lokalen Kuzu |
| conformance | 2 | Round-Trip / deterministische Serialisierung (L3, rasentraktor) |
| performance | 1 | < 0,2 s Responsiveness |
| smoke / inspection / analysis | 3 | Install-Smoke · Struktur-Checks · Rule-Vergleich |

## 2. CVE — Customer View Evaluation (UC-Level-Acceptance)

Top-down: verifiziert den **Kundennutzen**, nicht nur den geschriebenen Code.

| UC | Test | Target | Tool | Constraint | Pass |
|---|---|---|---|---|---|
| code-quality | TEST-code-quality | regelverletzende Änderung end-to-end geblockt, driftfrei | harness + benchmark | Disk-Kuzu, V3_RULES; vs classic | 0 error-Violations am Commit **und** < classic |
| efficient-testing | TEST-efficient-testing | graph_impact liefert genau das betroffene Testset | graph_impact assertion | precision/recall vs full run | nur betroffene Tests gewählt |
| token-efficiency | TEST-token-efficiency | präziser Kontext ≪ grep/dump | benchmark + token counter | graphcode vs classic | tokens < ~50 % classic |
| reduced-llm | TEST-reduced-llm | kleines/lokales LLM reicht | benchmark, 2 LLMs | small/local LLM | Task komplett + Gate grün im graphcode-Modus |

## 3. Testinfrastruktur

- **`REQ-benchmark-harness`** (definiert, **nicht gebaut**): fixe Task-Suite · 2 Modi (graphcode vs Claude-Code-classic) · 2 LLMs (groß + klein/lokal) · Token-Counter · Quality-Scorer → Matrix `task × mode × LLM → {tokens, success, quality}`.
- **`REQ-quality-metric`** (Qualität messbar): (1) 0 error-Violations am Commit · (2) REQ→TEST-Traceability-Coverage · (3) keine Drift bei Re-Eval — gegen classic messbar.
- Unit/Integration: vitest · Conformance: vitest + rasentraktor-Fixture · E2E/Dashboard: Playwright + data-testid · Persistenz: Disk-Kuzu (kein `:memory:`).

## 4. Abdeckung (aus verify-Traces)

- REQ→TEST-Coverage aktuell **~26 %** (Verifikations-Dimension `ver` ≈ 0,6). High-Level-UC-Tests vollständig (4/4); **Lücke = granulare REQs** (pre/post, Bracket-Constraints).
- Granulare Tests (Target + Tool + Constraint, verbal — kein Code nötig):
  - Constraint-REQs (single-store/-transport/-kuzu-owner): *inspection/analysis*, grep/architektur-Check.
  - pre/post-REQs: *test* (vitest), assert Vor-/Nachbedingung.
  - Conformance: *test* (vitest) + rasentraktor (L3).
  - Dashboard: *demonstration* (Playwright + data-testid).

## 5. Lücken

- `ver` < 1: granulare REQs ohne TEST → Coverage erhöhen (TRR).
- 155 BQ-Warnungen sind **Vorgänger-Regeln** (rules 2.0.0) → `CR-GC-107` (Dashboard auf V3_RULES) löst das.
- `ms` = 0 (keine Milestones) — Scope-Entscheidung offen.

---
**Quelle:** `docs/graph/graphcode.graph.json` · **Renderer:** `.claude/skills/se-view-testconcept.md` → `FUNC-render-views`.
