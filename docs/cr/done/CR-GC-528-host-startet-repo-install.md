# CR-GC-528: Host startet den Repo-Install statt einer npx-Auflösung

**Status:** ✅ erledigt (2026-09-14)
**Typ:** aus Item ITEM-2026-139 (finding)
**Erstellt:** 2026-09-14
**Item:** bok/items/ITEM-2026-139.json (Lane: code)
**Schwester-CRs:** CR-GC-529 (status liest die Startform), BOK-CR-056 (doctor H10)

---

## 1. Root Cause

`init`/`upgrade` schrieben `npx -y @sigloch/graphcode@<version> mcp` (CR-GC-378). npx nimmt
eine lokale Installation nur, wenn sie den Spec exakt erfüllt, sonst einen Build aus dem
npm-Cache. Pin und `node_modules` waren zwei Versionswahrheiten je Repo; ein `npm link`
(Lokal-Modus) erreichte den Host nur, solange beide zufällig gleich waren. Gemessen
2026-09-14: graph-view-edit (Pin 0.19.1), graphify (0.17.0), test_karp (0.20.1) verlinkt,
Host startet trotzdem den Cache-Build. Folge: um neue Regeln im Host zu sehen, wurde
publiziert — drei Züge an einem Tag.

## 2. Änderung

Startzeile in `.mcp.json` und `opencode.json`: `node node_modules/@sigloch/graphcode/dist/cli.js mcp`
(`HOST_ENTRY`), relativ zum Repo-Root wie graphcodes eigene Zeile `node dist/cli.js mcp`.
Die Version steht im eingecheckten Lockfile; `upgrade` zieht sie nach (Schritt 2 installiert
ohnehin in das Repo); ein Link zeigt auf die Arbeitskopie. Fehlt der Install, bricht der
Start laut ab — kein stiller Registry-Zug. `PACKAGE_SPEC` ist restlos gelöscht.

Nicht gewählt: (a) `aise local on/off` schreibt `.mcp.json` um — zweiter Schreiber derselben
Datei; (c) nur ein doctor-Befund — benennt die Drift, beseitigt sie nicht.

## 3. Dateien (5 + CR)

- `src/surface/scaffold-templates.ts` — `HOST_ENTRY` statt `PACKAGE_SPEC`, beide Host-Configs
- `src/surface/scaffold-docs.ts` — GRAPHCODE.md nennt Startzeile und `npm install`
- `tests/cli.scaffold.test.ts`, `tests/mvp-e2e.test.ts` — erwartete Startzeile
- `tests/distribution.test.ts` — im fremden Repo existiert die Datei, auf die die Zeile zeigt

## 4. Test-Nachweis

Rot gegen den alten Quellstand (`git stash` auf den zwei src-Dateien): 6 Fälle in
cli.scaffold + mvp-e2e. Grün: 52/52, `tsc --noEmit` sauber. Volllauf inkl.
distribution.test.ts siehe CR-GC-529 (gemeinsamer Lauf).

## 5. Kongruenz

Keine FUNC mit realRef auf die geänderten Symbole; TEST-cli-scaffold, TEST-mvp-e2e,
TEST-distribution binden unveränderte Dateipfade — kongruent per Symbolpräsenz. Per MCP
nicht geprüft: der Host dieser Session hängt am bok-Store.

## 6. Bewusst offen

Consumer ausserhalb des Lokal-Modus behalten die npx-Zeile bis zum nächsten graphcode-Release
mit `graphcode upgrade`. Producer-Repos (graphify, graph-view-edit) bekommen keinen Refresh aus
`aise rollout` (Self-Dep-Schutz) — ihre Zeile ist von Hand zu setzen.
