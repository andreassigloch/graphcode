# GraphCode — Architektur-Graph

> ⚠️ **GENERATED aus `docs/graph/graphcode.graph.json` (SSOT)** — Stand 2026-06-17 (156 Elemente / 252 Traces).
> Nicht hand-editieren; bei Modelländerung neu rendern (manueller Vorgriff auf `FUNC-export-markdown` / `UC-doc-export`).
> Layering: UC (Kundennutzen) ← FUNC (satisfy) · UC → FCHAIN → FUNC (compose) · FUNC → FLOW → FUNC (io) · FUNC → MOD (allocate).
>
> **Mermaid-Konvention (sonst rendert nichts):** keine `()` und kein `|` in Node-Labels — Wörter statt `()`, `/` statt `|`; Zeilenumbruch nur via `<br/>`.

## 1. Physische Architektur — Modulstruktur mit Funktionszuordnung

`FUNC -allocate→ MOD`. 4 Runtime-Module (Kern) + 2 app-spezifische Module.

```mermaid
graph TB
  subgraph SYS["SYS-graphcode<br/>Claude-Code-Sidecar-Governance-Harness"]
    subgraph RT["Runtime-Module — Kern"]
      subgraph H["MOD-harness<br/>Apply-Gate"]
        Fmutate["mutate"]
        Feval["evaluateRules"]
        Fsave["saveGraph"]
        Fimport["importGraph"]
        Fmigrate["migrateSchema"]
      end
      subgraph M["MOD-mcp-tools<br/>MCP-Registry"]
        Fimpact["graph_impact"]
        Fexpand["graph_expand"]
      end
      subgraph HK["MOD-hooks<br/>HookSystem"]
        Femit["emitTrajectory"]
        Fevent["emitUpdateEvent"]
      end
      subgraph C["MOD-codec<br/>Format-E Codec"]
        Fencode["encode"]
        Fdecode["decode"]
        Fmerge["mergeNodes"]
      end
    end
    subgraph APP["App-spezifische Module"]
      subgraph CLI["MOD-cli<br/>npx-Distribution & Lifecycle"]
        Fcli["graphcode init / update / remove"]
      end
      subgraph DOC["MOD-docs<br/>Markdown-Re-Exporter — code/target"]
        Fexport["exportMarkdown"]
      end
      subgraph SK["MOD-skills<br/>Skills/Prompts — prompt-realisiert"]
        Frender["render markdown views"]
      end
    end
  end
  style RT fill:#dbeafe,stroke:#3b82f6
  style APP fill:#f3e8ff,stroke:#8b5cf6
  style SK fill:#faf5ff,stroke:#8b5cf6
  style H fill:#eff6ff,stroke:#3b82f6
  style M fill:#eff6ff,stroke:#3b82f6
  style HK fill:#eff6ff,stroke:#3b82f6
  style C fill:#eff6ff,stroke:#3b82f6
  style CLI fill:#faf5ff,stroke:#8b5cf6
  style DOC fill:#faf5ff,stroke:#8b5cf6
```

## 2. Kundennutzen — welche Funktion welchen Benefit liefert

`FUNC -satisfy→ UC`. Die 4 Customer-UCs sind das *Warum*; die Funktionen liefern sie.

```mermaid
flowchart LR
  subgraph FUNCS["Funktionen"]
    direction TB
    f_impact["graph_impact"]
    f_expand["graph_expand"]
    f_encode["encode"]
    f_emit["emitTrajectory"]
    f_gate["mutate / evaluateRules / saveGraph"]
    f_codec["decode / mergeNodes"]
    f_event["emitUpdateEvent"]
    f_lifecycle["importGraph / migrateSchema / harness-cli / exportMarkdown"]
  end
  subgraph UCS["Kundennutzen — UC"]
    direction TB
    Q["UC-code-quality<br/>exzellente, governte Qualität"]
    E["UC-efficient-testing<br/>impact-basiertes Testen"]
    T["UC-token-efficiency<br/>minimaler Token-Verbrauch"]
    L["UC-reduced-llm<br/>kleine/lokale LLMs tragfähig"]
  end
  f_impact --> T
  f_impact --> L
  f_impact --> E
  f_expand --> T
  f_encode --> T
  f_encode --> Q
  f_emit --> L
  f_gate --> Q
  f_codec --> Q
  f_event --> Q
  f_lifecycle --> Q
  style UCS fill:#d1fae5,stroke:#10b981
  style FUNCS fill:#fef3c7,stroke:#f59e0b
```

## 3. Behavioral View — Use-Case-Funktionsketten (FCHAIN)

`UC -compose→ FCHAIN -compose→ FUNC`. Verhaltens-Szenarien pro Nutzen.

```mermaid
flowchart LR
  subgraph UCq["UC-code-quality"]
    subgraph FC1["FCHAIN-apply-gate"]
      a1["mutate"] --> a2["evaluateRules"] --> a3["saveGraph"] --> a4["emitTrajectory"]
    end
    subgraph FC3["FCHAIN-codec-roundtrip"]
      c1["encode"] --> c2["decode"]
    end
    subgraph FC4["FCHAIN-capture"]
      d1["decode"] --> d2["mutate suggest-Tier"]
    end
  end
  subgraph UCt["UC-token-efficiency"]
    subgraph FC2["FCHAIN-agent-query"]
      b1["graph_impact"] --> b2["graph_expand on-demand"]
    end
  end
  style UCq fill:#d1fae5,stroke:#10b981
  style UCt fill:#fef3c7,stroke:#f59e0b
```

## 4. Datenfluss — Funktionen verketten via FLOW

`ACTOR/FUNC -io→ FLOW -io→ FUNC/ACTOR` — es gibt **kein** FUNC→FUNC; der FLOW *ist* die Kante.
Hero = der Apply-Gate-Pfad mit Fan-out zu Dashboard (Ziel b) und Learning-Engine.

```mermaid
flowchart TB
  CC["ACTOR<br/>Claude Code"] -->|FLOW-mutate-cmd| MUT["mutate"]
  MUT -->|FLOW-draft-graph| EVAL["evaluateRules"]
  EVAL -->|FLOW-violations| SAVE["saveGraph"]
  SAVE -->|FLOW-committed-graph| EMITT["emitTrajectory"]
  EMITT -->|FLOW-trajectory| LE["ACTOR<br/>Learning-Engine"]
  SAVE -->|FLOW-committed-graph| EMITE["emitUpdateEvent"]
  EMITE -->|FLOW-live-event| DASH["ACTOR<br/>Dashboard read-only"]

  CC2["ACTOR<br/>Claude Code"] -->|FLOW-query-request| IMP["graph_impact"]
  IMP -->|FLOW-impact-subgraph| CC2
  CC2 -->|FLOW-expand-request| EXP["graph_expand"]
  EXP -->|FLOW-expanded-subgraph| CC2

  GF["ACTOR<br/>graphify"] -->|FLOW-bulk-formatE| IMPO["importGraph"]
  IMPO -->|FLOW-bootstrap-result| DEV["ACTOR<br/>Entwickler"]
  DEV -->|FLOW-export-request| EXPO["exportMarkdown"]
  EXPO -->|FLOW-markdown-docs| DEV

  style MUT fill:#dbeafe,stroke:#3b82f6
  style EVAL fill:#dbeafe,stroke:#3b82f6
  style SAVE fill:#dbeafe,stroke:#3b82f6
  style EMITT fill:#fef9c3,stroke:#ca8a04
  style EMITE fill:#fef9c3,stroke:#ca8a04
  style IMP fill:#e0e7ff,stroke:#6366f1
  style EXP fill:#e0e7ff,stroke:#6366f1
  style DASH fill:#fce7f3,stroke:#ec4899
  style LE fill:#fce7f3,stroke:#ec4899
```

> Weitere atomare Daten­flüsse (gleiche `ACTOR→FLOW→FUNC→FLOW→ACTOR`-Form): `merge-nodes` (Branch-Merge),
> `migrate-schema` (Version-Bump), `harness-cli` (init/update/remove). Codec-Round-Trip:
> `Entwickler →FLOW-graph-state→ encode →FLOW-formatE-artifact→ decode →FLOW-parsed-graph→ Entwickler`.

---

**Quelle:** `docs/graph/graphcode.graph.json` · **Generator-Vorbild:** `.claude/skills/se-view-arch.md`
(kopiert aus sirail, API → `GRAPH_API:3001`) · **Realisierung des Renderers:** `FUNC-export-markdown` (UC-doc-export, specced).
