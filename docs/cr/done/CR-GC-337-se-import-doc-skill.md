# CR-GC-337: `se:import-doc` — zweistufiger Dokument-Import (graphify »Struktur vor KI«)

**Status:** Done (2026-08-14) · **Max Files:** 3

## Problem (Why)

graphify liefert seit CR-GF-139 den zweistufigen MCP-Schnitt (`graphify_structure` → Decisions →
`graphify_extract`), aber graphcode hatte keinen Konsumenten dafür: Dokumente (PDF/md/txt) konnten
nur monolithisch oder gar nicht in den Graph. Der Familie-Entscheid (2026-08-14): **der MCP-Client
ist das UI** — kein neuer Viewer, die Typ-Zuordnung passiert im Chat.

## Approach (How)

1. **`.claude/commands/se/import-doc.md` (neu):** Skill nach dem `se:import-code`-Vorbild, aber
   **Merge (adds-only durchs Gate), nie Reseed**. Zwei Stufen mit eingebetteten Skripten
   (`.graphcode/tmp/`, bare imports lösen über Repo-`node_modules`):
   - Stufe 1: `handleMcpStructure` → Skelett rendern (Baum + Blockgrößen), Typ-Vorschlag per
     Dokumenttyp-Tabelle, Decisions via AskUserQuestion → `decisions.json`.
   - Stufe 2: `handleMcpExtract({documents, decisions})` mit `McpConsumerGate`-Transport gegen
     `bindToolsToHarness`→`graph_mutate` (consumerId `import-doc`), danach `graph_export` —
     Harness-Lifecycle (initialize/seed-on-empty/close) wie `import-code-verb.ts`, kein Parallelweg.
2. **`package.json`:** `@sigloch/graphify` in `link:siblings` aufgenommen; dev-Wiring als
   Sibling-Symlink `node_modules/@sigloch/graphify → ../../../graphify` (gleiches Muster wie
   contracts/graph-api-core — `npm link` scheitert am Registry-Reify der gelinkten Siblings).

## Files

1. `.claude/commands/se/import-doc.md` (neu)
2. `package.json` (link:siblings)
3. `docs/cr/done/CR-GC-337-se-import-doc-skill.md`

## Verifikation

- [x] Stufe-1-Skript real ausgeführt (graphcode-Repo, mini-spec.md): Skelett mit
      `name`/`number`/`depth`/`blockTokens`, `rejected: []`.
- [x] graphify-API im graphcode-Kontext auflösbar (`handleMcpStructure`/`handleMcpExtract`/
      `buildSkeleton`/`pdfToText` = function).
- [x] Decisions-Semantik Ende-zu-Ende in graphify getestet (CR-GF-139, `tests/ports.test.ts`:
      Typ-Override landet im finalGraph, exclude entfernt den Knoten).
- [ ] **Offen (bewusst):** Stufe 2 gegen den echten Kuzu-Store — braucht laufendes LM Studio und
      schreibt in den Store; erster Live-Lauf mit kleinem Dokument + explizitem Go.

## Abhängigkeit / Publish-Hinweis

Der npm-Stand `@sigloch/graphify@0.1.0` hat die CR-GF-139-API **nicht** — Member-Repos außerhalb
der Dev-Umgebung brauchen ein graphify-Release (nach Merge von `feat/cr-gf-138-outline-chain`)
+ Dep-Bump hier. Bis dahin: Sibling-Symlink (dev-only).
