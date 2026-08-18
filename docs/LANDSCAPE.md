# graphcode — Externe Landschaft (rolling)

> **Rolling-Datei, kein REQ, kein Bootstrap-Input.** Fremde Code-Graph-Tools + deren
> Benchmark-Behauptungen, gegen graphcodes USPs geprüft. Wird pro Review fortgeschrieben —
> anders als `RECOMMENDATIONS.md` (eingefrorener R1–R14-Bootstrap, INPUT-ONLY).
> **Stand: 2026-08-18** (Stern-/Lizenz-/Datums-Zahlen via `gh api repos/<n>` verifiziert).

## Kernaussage

Die vier meistgenutzten Fremdtools liegen **auf demselben Layer wie einander** und **nicht auf
graphcodes Layer**: read/extract, Code = Truth, Graph = abgeleiteter Cache, **kein Write-Gate**.
Das 2026-07-Urteil zu CodeGraph verallgemeinert sauber auf alle vier. Die *Konsequenz* hat sich
aber umgedreht: **Query-Precision ist kein graphcode-Differentiator mehr**, sondern Tischkante mit
vier reifen Implementierungen und ~300k Sternen zusammen.

## Die vier (verifiziert 2026-08-18)

| | Graphify-Labs/graphify | Egonex-AI/Understand-Anything | colbymchenry/codegraph | abhigyanpatwari/GitNexus |
|---|---|---|---|---|
| Sterne / Forks | **107,5k** / 10,4k | 79,6k / 6,7k | 66,8k / 4,2k | 45,5k / 5,0k |
| Lizenz | Apache-2.0 | MIT | MIT | **PolyForm Noncommercial** |
| Erstellt | 2026-04-03 | 2026-03-15 | 2026-01-18 | 2025-08-02 |
| Extraktion | tree-sitter ~40 Sprachen + Docs/PDF + Bilder (Vision) | tree-sitter + LLM-Semantik-Pass | tree-sitter 30+ Sprachen, nativer Kernel | tree-sitter 14 Sprachen |
| LLM zur Index-Zeit | **null** | ja (= die Token-Kosten) | null | optionale Embeddings |
| Store | `graph.json` / NetworkX (+SurrealDB) | `.ua/knowledge-graph.json` | SQLite + FTS5 (WAL) | LadybugDB (Graph+Vector) |
| Precompute | Leiden-Communities, God-Nodes | Arch-Layer, Domains, Tours | Route-Synthese (17 Frameworks), Cross-Lang-Bridging | Leiden-Communities + **Processes** (Exec-Flows) |
| Oberfläche | Skill + MCP + CLI | Plugin (6 Agents) + Dashboard | 1 Tool `codegraph_explore` | 17 MCP-Tools + Hooks |
| Writes | keine | keine | keine | `rename` = Dry-Run-**Vorschlag** |

Alle vier innerhalb von 14 Monaten entstanden. Das ist eine **Kategorie**, die sich bildet, keine
vier Produkte.

## Halten ihre USP-Behauptungen?

**Graphify — überwiegend ja, und die einzige ehrliche Messung im Feld.** Ein geteiltes Modell
(Kimi K2.6), Spend-Ledger pro Lauf, Judge blind gegen einen zweiten Judge validiert (90,6 %
Übereinstimmung, Cohen's κ 0,81). „Null LLM-Credits zum Bauen des Graphen" stimmt.
**Aber:** das Code-Intelligence-Ergebnis ist **n=6** Fragen auf ERPNext, Key-Fact-Coverage
70,8 % → **82,0 % bei ~140K Token pro Query**. Das ist ein token-**teurer** Genauigkeitsgewinn —
er widerspricht den „71,5× weniger Token"/„500× smarter"-Behauptungen im Ökosystem drumherum.
Ihre eigene `BENCHMARKS.md` ist ehrlicher als ihr Marketing.

**CodeGraph — so nicht überprüfbar.** „88 % weniger Tool-Calls · 53 % schneller · 62 % weniger
Token · 44 % billiger" (7 Repos, 2026-08) ist Vendor-gemessen und hat **keine Genauigkeitsachse**.
Billiger ist nicht besser, wenn die Coverage fällt — und Coverage messen sie nie.

> **Der interessante Befund:** die beiden Headline-Claims zeigen in **entgegengesetzte Richtungen** —
> CodeGraph sagt, ein Code-Graph spart 62 % Token; Graphify misst Coverage und findet, dass die
> Token *steigen*. Niemand in der Kategorie hat das aufgelöst. **Keine der beiden Zahlenreihen mit
> graphcodes Loop-Spike mischen.**

**GitNexus — architektonisch die stärkste These, komplett ungemessen.** „Precompute zur Index-Zeit,
damit ein kleines Modell nicht schließen muss" ist wörtlich R12/R13. Kein Benchmark publiziert.
Zugleich das eine, aus dem **nicht adoptiert werden darf**: PolyForm Noncommercial.

**Understand-Anything — das zerfallende.** Bezahlt LLM-Token zur Index-Zeit für Prosa-Summaries und
Tours, die beim nächsten Commit veralten. Höchste Kosten, kürzeste Halbwertszeit.

## graphcode-USP-Check

**Hält — nichts in der Kategorie berührt es:**

- **Apply-Gate.** Jede Edit durch `mutate()`, Delta-Blockade auf neu eingeführten Error-Violations,
  Autor geloggt. **Null von vier** haben irgendein Write-Gate.
- **Richtung der Wahrheit.** REQ/UC/FUNC/TEST existieren *vor* dem Code; `codeRef`/`testRef`
  (R-19/R-20) binden zurück. Alle vier blicken ausschließlich rückwärts.
- **Versionierte Ontologie + Regeln** aus `@sigloch/contracts/se` mit Drift-Locks. Sie haben
  Confidence-Heuristiken, graphcode hat ein versioniertes Regelwerk.
- **Intent-tragende Knotentypen + die View-Exporter** (RTM, SDD, ICD, VCRM, FMEA, ConOps).
  Niemand sonst emittiert ISO-29148-förmige Artefakte aus einem Graph.

**Unter Druck:**

- **`graph_impact`/`graph_expand`/`graph_context` sind jetzt Tischkante** — funktional gematcht von
  `codegraph_explore`, GitNexus `impact/trace/context`, graphify `subgraph/impact`, alle mit weit
  besserer Sprachabdeckung. **R12/R13 ist extern validiert *und* kein Moat mehr.** Nicht länger als
  Alleinstellung beschreiben.
- **Eigenes `@sigloch/graphify` 0.2.0 ist tree-sitter TypeScript-only** — gegen 30+ und ~40 Sprachen.
  Diese Lücke ist durch Bauen nicht zu schließen. Verteidigbar ist die **zweite** Hälfte, die die
  eigene Paketbeschreibung schon nennt: *auto-typing → SE-Ontologie-Kandidaten → Suggestion-Gate* —
  die hat keines der vier. Konsequenz: **Typer + Gate behalten, den Slicer als ersetzbar behandeln**
  (Apache-2.0 Graphify und MIT CodeGraph sind lizenzkompatibel, **GitNexus nicht**).
- **Distribution.** Ein-Zeilen-Skill/Plugin-Installs über 10+ Agents gegen npm + MCP-Config + Hooks.
  Kein Produkt-Wahrheitsproblem, erklärt aber die Sternlücke.

## Adoptierbar (gereiht, alle mit den verriegelten Constraints vereinbar)

| # | Was | Quelle | Draft-CR |
|---|---|---|---|
| L1 | **PreToolUse-Graph-Slice-Injektion** auf dem Discovery-Pfad (Read/Grep/Glob) — macht den Graph zum Default statt zur Wahl des Agents | GitNexus PreToolUse | `CR-DRAFT-GC-361` |
| L2 | **Token-budgetierter Subgraph**: `graph_context(budget: n)` liefert die größte kohärente Scheibe unter n Token statt fixer Tiefe — bedient `graphcode run` / Local-LLM | graphify-mcp | `CR-DRAFT-GC-362` |
| L3 | **Freshness-Banner inline im Read-Ergebnis** (AF-01..05 in `graph_context`/`graph_impact`, nicht nur in `readiness`) | CodeGraph ⚠️ / GitNexus PostToolUse | `CR-DRAFT-GC-363` |
| L4 | **Confidence-Tags mit Klartext-Begründung** (`EXTRACTED`/`INFERRED`/`AMBIGUOUS`) — = R1, offen. Der Begründungsstring ist das, was einen Slicer-Vorschlag gate-prüfbar macht | Graphify | (R1, `RECOMMENDATIONS.md`) |
| L5 | **Benchmark-Hygiene**: ein geteiltes Modell, Spend-Ledger, Zweit-Judge-Validierung, **Coverage als Primärachse** statt Kosten | Graphify-Harness | offen |

**Nicht adoptieren:** Leiden-Communities · LLM-Summaries zur Index-Zeit · Vector-Store ·
Multi-Repo-Registry (bricht ein-Store-pro-Repo) · Browser-WASM-Store.

## Bekannter Stand der eigenen Injektion (Kontext für L1)

Weder graphengine noch graphcode haben die GitNexus-Form heute:

- **graphengine** `.claude/settings.json` PreToolUse = `claude-flow@alpha hooks pre-edit
  --load-context true`, Matcher `Write|Edit|MultiEdit` — generischer claude-flow-Memory-Loader auf
  dem **Write**-Pfad, nicht graph-abgeleitet, nicht auf dem Discovery-Pfad.
- **graphcode** hat zwei benachbarte Dinge: `deny-stale-prose-read.sh` (CR-GC-214) = PreToolUse auf
  `Read`, aber **deny + redirect** — zeigt auf den Graph, ohne die Scheibe zu liefern; und CR-GC-285
  Guide/Index-Injektion in den **eigenen Executor-Prompt**, nicht in einen fremden Harness pro Call.
- **Messvorbehalt:** CR-GC-293 hat gemessen, dass Injektion Frontier nützt und **Local Ausbeute +
  Breite kostet** (v15 22 vs. v9 38 Elemente). L1 muss gemessen ausgeliefert werden, nicht
  default-an — siehe `CR-DRAFT-GC-297`.

## Quellen

- https://github.com/Graphify-Labs/graphify (lokaler Klon: `~/Developer/dev/graphify-labs`)
- https://github.com/Egonex-AI/Understand-Anything
- https://github.com/colbymchenry/codegraph
- https://github.com/abhigyanpatwari/GitNexus
- https://github.com/yasinyaman/graphify-mcp
