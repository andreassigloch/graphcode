# CR-GC-214: Read-seitige Graph-first-Erzwingung (`deny-stale-prose-read` Hook)

**Status:** Open (2026-06-26) · **Milestone:** `MS-6-adoption` · **Max Files:** 4
**Graph (SSOT):** zu seeden (gate-only, bei Pick-up) `REQ-graph-first-read`, `FUNC-deny-stale-read` (→ `.claude/hooks/deny-stale-prose-read.sh`), `TEST-deny-stale-read` (→ `tests/hooks.test.ts`), `CR-GC-214`; unter `MS-6-adoption`. Pointer, nicht autoritativ.

## Problem (Why)

CR-GC-205-Prinzip **„enforce, don't document":** die **Schreib**-Seite ist erzwungen (`deny-graph-write.sh` + Apply-Gate), die **Lese**-Seite nicht.

- Folge (graphify, Session `4025681c`): der Agent liest `docs/SPEC.md` (INPUT-ONLY/obsolet, 50.132 chars) als **primären Planungs-Input**, obwohl der Graph SSOT ist. Es war die größte Einzel-Injektion der Session — und ein als veraltet markiertes Dokument.
- CR-GC-207 setzt nur einen **Header-Hinweis** („Dialekt obsolet") in `SPEC.md`. Das ist Prosa-Vertrauen, kein Forcing. Ein Header verhindert den 50k-Read nicht — der Agent liest die Datei, *dann* sieht er den Header.
- Ohne Read-Erzwingung bleibt der Graph ein optionales Tool gegen die immer-präsenten `Read`/`Grep`-Reflexe. Genau dieser Default-Konflikt ist das Argument für den OpenCode-Executor mit eingeschränkter Tool-Surface.

## Decision

PreToolUse-Hook **`.claude/hooks/deny-stale-prose-read.sh`** — der Read-Twin von `deny-graph-write.sh`:

- Greift bei `Read`, dessen Ziel-Datei im Kopf (erste ~15 Zeilen) einen **selbst-deklarierten Marker** trägt: `status: INPUT-ONLY` bzw. `SUPERSEDED-BY-GRAPH`/`obsolet`. **Keine hartkodierte Pfadliste** — die Datei deklariert sich selbst (koppelt direkt an CR-GC-207s `SPEC.md`-Header; keine zweite Drift-Quelle).
- Bei Treffer: **deny** mit Redirect-Message: *„`<file>` ist INPUT-ONLY (SSOT = Graph). Nutze `graph_context <node>` / `graph_elements {type}` / `graph_readiness` statt Doc-Ingest."*
- **Escape-Hatch:** `GRAPHCODE_ALLOW_STALE_READ=1` lässt den Read bewusst durch (Migrations-/Audit-/Codec-Vergleichs-Fälle) — kein hartes Lock ohne Ausweg.
- `src/scaffold.ts`: Hook + Settings-Registrierung beim `init` ins Ziel-Repo shippen (wie die übrigen Hooks).

## Akzeptanz

- `Read docs/SPEC.md` mit `status: INPUT-ONLY`-Header → Hook **denied** und nennt `graph_context`/`graph_elements`/`graph_readiness` als Alternative.
- Datei **ohne** Marker → unverändert lesbar (kein False-Positive auf normalen Source-/Edit-Targets — verifiziert per Negativ-Test).
- `GRAPHCODE_ALLOW_STALE_READ=1` → Read durchgelassen.
- `init` legt Hook + Registrierung im Ziel-Repo an; Test prüft Existenz + Deny-Pfad + Negativ-Pfad.
- `npm run build` + `npm test` grün.

## Out of scope (Follow-up)

- **Automatisches** Markieren von Docs als INPUT-ONLY (CR-GC-207 setzt den Marker in `SPEC.md`; weitere Docs manuell/Folge-CR).
- Erzwingen von `graph_export`-vor-Session-Ende (anderer Hook, CR-GC-207 Out-of-scope).

## Dependencies

`src/scaffold.ts` (Hook-Shipping) · `.claude/hooks/deny-graph-write.sh` (Muster) · CR-GC-207 (setzt den `INPUT-ONLY`-Marker, auf den der Hook reagiert) · CR-GC-213 (liefert die Alternative `graph_context`, auf die der Deny verweist). **Zweiter Treatment-Arm** in `SPIKE-GC-context-sufficiency` (isoliert: reicht Ergonomie, oder braucht es Erzwingung?).
