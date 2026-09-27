# CR-GC-686: Vorbilder und Werkzeugtexte auf Format-E: Skills, SCHEMA-01-fixHint, graph_merge-Beschreibung

**Status:** ✅ Done (2026-09-27)
**Typ:** aus Item ITEM-2026-602 (idea)
**Erstellt:** 2026-09-26
**Item:** bok/items/ITEM-2026-602.json (Lane: code)

---

Teil von ITEM-2026-571. JSON-commands als Vorbild ersetzen durch Format-E: .claude/commands/se/close-violations.md:11-12, se/optimize.md:70-81, se-fmea.md:128, se/import-doc.md:99-106 (Transport - pruefen, ob Format-E geht); SCHEMA-01-fixHint src/kernel/gate.ts:73-77; Werkzeugtexte write.ts (commands als Alternative, graph_merge-Beschreibung = Knoten-Merge statt Branch-Replay - BUG); README und rig/code-test/run-code.mjs (graph_realize). NICHT: executor-prompt.ts AUTHORING_PARAMS (Executor-Dateien gehoeren der CR-GC-682-Session).

---

## Umfang laut `graph_impact`

_(vor der Arbeit fuellen — sonst ist der Umfang geraten)_

- `graph_impact(<uid>)` je Knoten am Umfang: welche `satisfy`, `io`, `compose` haengen daran?
- `graph_tests({changeSet})`: die Testspur, statt der vollen Suite.
- Beim Entfernen: `/se-umbau` fuehrt die Reihenfolge.

## Umfang (9 Dateien)

`.claude/commands/se/close-violations.md`, `se/optimize.md`, `se-fmea.md`, `se/import-doc.md`,
`src/kernel/gate.ts` (SCHEMA-01-fixHint), `src/surface/write.ts` (Werkzeugtexte, graph_merge; formatE-Beschreibung nennt vorab: Knoten-Operationen `+ ~ - !` stehen unter `## Nodes` + `### <TYPE>`, Kanten unter `## Edges` — Nachtrag aus CR-SM-369),
`README.md`, `rig/code-test/run-code.mjs`, `tests/skills.mcp-conformance.test.ts` (kein JSON-commands-Vorbild).

**Nach CR-GC-685** (write.ts, README und Rig nennen dann kein graph_realize mehr).

## Akzeptanz

- [x] Rot zuerst: Konformanztest fand JSON-commands-Vorbilder in `se/close-violations.md`,
  `se/optimize.md`, `se-fmea.md` (3 Treffer; `se/import-doc.md` s. u.).
- [x] graph_merge-Beschreibung beschreibt Branch-Replay (`log`, `sinceVersion`), Knoten-Merge
  verweist auf Format-E `M source + target` (Test `mcp.agent-agnostic` (c), rot → gruen).
- [x] Smeagol gruen (`skill-rule-ids`, `policy-herkunft`, `skill-kinds-werte`).
- [~] VOLL-Lane: 1630 gruen / 3 rot — s. Ergebnis.

## Ergebnis (2026-09-27)

- **Skills:** `se/close-violations.md` (Kantenvorschlaege als `+ A -verify-> B`, Batch als ein
  `## Edges`-Block), `se/optimize.md` (Anhaengen `+`, Umhaengen `-` + `+` in EINEM Block),
  `se-fmea.md` (Beispiel als Format-E mit `@kinds`/`@rationale`/`@severity`/…, dazu der
  `verify` fuer die Mitigation-REQ, den das alte JSON-Beispiel vergass — R-01 haette geblockt).
  **Gegen ein echtes Gate geprobt:** FMEA-Batch und Umhaengen laufen durch (`success: true`,
  keine Errors; `@severity 9` landet als Zahl). Damit ist auch Frage (2) des Items beantwortet:
  `delete-edge` + `add-edge` im selben Format-E-Block passiert das Gate.
- **`se/import-doc.md` bleibt:** dort ruft Code `graph_mutate` mit dem `commands`-Batch, den
  `handleMcpExtract` liefert — Transport, kein Vorbild; Umstellen hiesse Kommandos nach Format-E zu
  serialisieren (Klimmzug) und haengt am `commands`-Parameter, den CR-GC-685 ausdruecklich stehen
  laesst. Der Konformanztest prueft deshalb nur die zitierte JSON-Form (`"op": "…"`,
  `"commands": [`).
- **SCHEMA-01-fixHint** (`src/kernel/gate.ts`) beginnt mit "Prefer formatE …" und nennt die
  Sektionen; die JSON-Formen bleiben dahinter (update-edge, Reparatur).
- **Werkzeugtexte** (`src/surface/write.ts`): `formatE` nennt zuerst die Sektionen (`+ ~ - !` unter
  `## Nodes` + `### <TYPE>`, Kanten unter `## Edges`, CR-SM-369), `~` = Patch auf Bestehendes (mit
  CR-GC-685), Binden per `@realRef`/`@testRefs`; `commands` beschrieben als "nur update-edge";
  `graph_merge` = Branch-Replay, Knoten-Merge → `M source + target`.
- **README:** `graph_merge`-Zeile war derselbe Fehler ("additive merge (adds only)") — korrigiert.
  (`graph_realize` hatte CR-GC-685B schon entfernt.)
- **`rig/code-test/run-code.mjs`:** Auftrag des Arms `gefuehrt` bindet per `graph_mutate`/Format-E.

Dateien (10): 3 Skills, `src/kernel/gate.ts`, `src/surface/write.ts`, `README.md`,
`rig/code-test/run-code.mjs`, `tests/skills.mcp-conformance.test.ts` (neuer Test + der
retire-Test von `delete-edge`/`add-edge` auf die Format-E-Zeilen), `tests/mutate.schema-guard.test.ts`,
`tests/mcp.agent-agnostic.test.ts`.

**Tests:** `verify:code` 16 Dateien / 114 gruen; Skills/Smeagol/Beschreibungen 8 / 110 gruen.
**VOLL** (`npx vitest run`, Zweig `zug-685` = CR-GC-685 + 685B + 686): 186 Dateien, 1630 gruen,
3 rot:
- `tests/conformance.test.ts` (2): **eine** Ursache — `FUNC-graph-realize` im Selbstmodell traegt
  `realRef.symbol 'graph_realize'` in `write.ts`, das CR-GC-685B geloescht hat → RC-01. Das ist
  der benannte Modell-Rueckstand (Zustand `gedriftet`), Aufloesung = Loeschzug der FUNC in der
  Graph-Lane (CR-GC-685B, Offen).
- `tests/rig-measured.test.ts` (1): bekannt vorbestehend rot (ENOENT `.graphcode/kuzu` im Worktree).

## Offen

- `rig/code-test/README.md:36` beschreibt den Arm `gefuehrt` noch mit "bindet mit `graph_realize`"
  — ausserhalb der 10-Dateien-Grenze, ein Satz.
- Graph-Lane: CR-Knoten auf `done`; Beschreibungen der FUNCs von `graph_merge` (falls sie den
  Knoten-Merge nennen) und der Skills-FUNCs pruefen.
