# CR-GC-209: `se-plan` — generatives Impl-/Integrations-Plan-Skill (graph-abgeleitete CR-Reihenfolge)

**Status:** Open (2026-06-25) · **Milestone:** `MS-6-adoption` (neu) · **Max Files:** 4
**Graph (SSOT):** seedet (gate-only) `REQ-generate-impl-plan`, `FUNC-plan-impl` (→ `.claude/skills/se-plan.md`, `lang:'prompt'`), `TEST-se-plan-ordering` (→ `tests/se-plan.ordering.test.ts`), `CR-GC-209`; unter `MS-6-adoption`. Pointer, nicht autoritativ.

## Problem (Why)

Erste Realanwendung (graphify). Dein O-Ton: *„whats missing is the creating the implementation plan skill"*, Prompt war *„all testconcepts defined and we can build implementation and integration plan? follow the graph, define the CR´s in right order"*.

- Es gibt nur **View**-Skills: `se-view:implplan` / `se-view:intplan` **rendern** vorhandene `MS`/`CR`-Knoten — sie **erzeugen** keinen Plan und leiten keine Reihenfolge ab.
- Folge in graphify: die CR-Reihenfolge (`100→101→102→103→104`) lebt als **Prosa in CLAUDE.md**, nicht aus `depends-on`-Kanten abgeleitet. Real existieren `CR-GF-100` (done) + `CR-GF-105` (open, **überspringt 101–104**) → die Reihenfolge ist **nicht graph-validiert**, niemand prüft Forward-Dependencies.

## Decision

Neues **generatives** Skill `.claude/skills/se-plan.md` (kein View):

1. Liest über MCP `graph_elements {type:FUNC|REQ|UC|TEST}` + `graph_get_edges {edgeType:relation|compose}` — die zu realisierende Dekomposition.
2. Bildet aus `depends-on`-Kanten den DAG, **topologische Sortierung** → CR-Reihenfolge; gruppiert in `MS`-Milestones.
3. Schlägt CR-Schnitt vor (≤5 Dateien/CR, je 1 Chat implementierbar — die harte Familie-Regel) und **gate-mutiert** die `MS`/`CR`-Knoten + `relation`-Kanten via `graph_mutate` (gate-only-writes).
4. Gibt die geordnete Sequenz + erkannte Zyklen/Forward-Deps aus.

`tests/se-plan.ordering.test.ts`: seedet einen Graph mit `depends-on`-Kette + einer absichtlichen Forward-Dependency → der abgeleitete Plan muss die Kette korrekt ordnen **und** den Verstoß melden (nicht vacuous). Test ist Skill-agnostisch: prüft die topologische Ableitung gegen den Graphen, nicht den Prompt-Text.

## Akzeptanz

- `se-plan` erzeugt aus dem Graphen eine CR-Sequenz, deren Reihenfolge **jede** `depends-on`-Kante respektiert (keine CR vor ihrer Abhängigkeit).
- Forward-Dependency / Zyklus im Modell → wird gemeldet, nicht still ge­ordnet.
- Plan wird **in den Graphen geschrieben** (MS/CR/relation via `graph_mutate`), nicht nur als Prosa.
- `se-plan` ist als generativ vom View `se-view:implplan` abgegrenzt (keine Parallelpfade — View rendert, Plan erzeugt).
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- Automatische Datei-Aufteilung pro CR (welche `src/*`-Files) — hier nur Knoten/Reihenfolge, nicht die physische Datei­zuteilung.
- MCP-Tool `graph_plan` (Topo-Sort serverseitig) statt Prompt-Ableitung — Kandidat, falls die Prompt-Ableitung unzuverlässig wird.

## Dependencies

`@sigloch/contracts/se` (`relation`/`depends-on`, `MS`/`CR` ElementTypes). Profitiert von CR-GC-208 (Skill ge­surfaced).
