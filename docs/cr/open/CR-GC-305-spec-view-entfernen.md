# CR-GC-305 — `spec`-View entfernen, `srs` ist die Requirements-Sicht (Cross-Package)

**Status:** open · **Angelegt:** 2026-08-07 · **Max Files:** 6 in graphcode (+ 1 in
graphcode-client, + 0 Code in GVE — s. Reihenfolge)

## Problem

`docs/views/` liefert zwei Dokumente, die dieselbe Frage beantworten:

| View | Zeilen | Form |
|---|---|---|
| `spec.md` | 458 | Roh-Dump **aller** 388 Elemente, gruppiert nach Typ, eine Tabelle je Typ |
| `srs.md` | 2429 | ISO-29148-Narrativ: Scope → Akteure → UC/FCHAIN/FUNC-Baum mit den REQ am jeweiligen Knoten |

Der Exporter-Kommentar hält die beiden auseinander („`srs` (REQ-slice, 29148 spec
shape) is DISTINCT from `spec` (full graph dump) — they must differ"), aber für den
Leser sind es zwei Requirements-Dokumente mit unterschiedlicher Vollständigkeit.
Die Hilfe sagt es selbst: „`srs` = die Slice, `spec` = der volle Dump"
(`src/viewer/help-content.ts:308`). Zwei Wahrheiten für dieselbe Frage = die
klassische Doppel-Doku-Falle, die `README.md`-Regel „eine Summary, keine Duplikate"
genau verbietet.

## Entscheidung (2026-08-07, Nutzer)

**`spec` fällt weg, `srs` bleibt.** Kompletter Cross-Package-Zug — kein halber Pfad
(`renderSpec` im Katalog lassen und nur den Export unterdrücken wäre genau der
„deprecated but still works"-Parallelpfad, den `CLAUDE.md` untersagt).

### Warum das drei Repos berührt

Der View-**Katalog** (welche Views existieren, Reihenfolge, Dateinamen) wohnt seit
CR-GC-264 in `@sigloch/graphcode-client` (`src/view-catalog.ts`), damit ein Viewer
die Views auflisten kann, ohne über den Exporter am Store zu hängen. Die
**Renderer** blieben in graphcode. GVE liest `VIEW_FILENAMES` aus demselben Paket
und hat einen Drift-Test, der die Doc-View-IDs **exakt** dagegen prüft
(`tests/view-registry.test.mjs`, CR-GVE-225/F4). Antwort auf die Frage
„Abstimmung mit Dashboard nötig?": **ja, zwingend** — und der Drift-Test erzwingt
sie, statt sie dem Gedächtnis zu überlassen.

## Reihenfolge (strikt — jeder Schritt einzeln grün)

1. **`@sigloch/graphcode-client`** (`packages/graphcode-client/src/view-catalog.ts`):
   `'spec'` aus `MARKDOWN_VIEWS` **und** `VIEW_FILENAMES` entfernen. Minor-Bump
   `0.6.0 → 0.7.0` (breaking für Konsumenten, die `MarkdownView` typisieren — vor 1.0
   ist Minor die Familie-Konvention). `npm publish`.
2. **graphcode**: Dep-Range auf `^0.7.0` heben, `npm install`. `renderSpec`
   (`src/exporter.ts:212`) **löschen**, `case 'spec'` (`:311`) löschen, den
   „DISTINCT from"-Kommentar-Absatz (`:47`) auf den neuen Stand ziehen.
   `src/viewer/help-content.ts` — Hilfetext `srs` ohne die `spec`-Gegenüberstellung.
   Tests: `tests/exporter.test.ts:144/155-157`, `tests/mcp.export.test.ts:87/124-128`,
   `tests/mvp-e2e.test.ts:316-317` von `'spec'` auf `'srs'` umstellen.
   `git rm docs/views/spec.md`.
3. **GVE**: Dep-Range auf `^0.7.0`, `npm install`, `tests/view-registry.test.mjs`
   grün — **ohne Code-Änderung**. Wenn dieser Test rot wird, ist es kein
   Test-Problem: dann hängt in GVE eine eigene `spec`-ID, die mit entfernt gehört.

## Akzeptanzkriterien

- [ ] `MARKDOWN_VIEWS.length === 15`, `'spec'` weder in `MARKDOWN_VIEWS` noch in
      `VIEW_FILENAMES` (Unit in graphcode-client)
- [ ] `exportMarkdown(graph, 'spec')` ist ein **Typfehler**, nicht ein Laufzeit-Fallback
      (`MarkdownViewSchema.parse('spec')` wirft) — Unit
- [ ] grep über `src/` + `tests/`: kein `renderSpec`, kein `'spec'` als View-ID mehr
- [ ] `docs/views/spec.md` ist gelöscht; ein `graph_export` über alle Views legt sie
      nicht neu an (Unit: `readdirSync(docs/views)` enthält kein `spec.md`)
- [ ] `srs.md` unverändert — Byte-Vergleich vor/nach dem CR (keine Kollateral-Änderung
      an der bleibenden View)
- [ ] `npm run build` + volle Suite grün in graphcode
- [ ] GVE: `npm test` grün, `tests/view-registry.test.mjs` insbesondere
- [ ] `@sigloch/graphcode-client@0.7.0` ist publiziert (`npm view … versions`), bevor
      graphcode committet wird — kein `file:`-Umweg (Stale-Dist-Vorbehalt, CR-GC-262)

## Dateien

**graphcode (5):**
1. `docs/cr/open/CR-GC-305-spec-view-entfernen.md` (dieses Dokument)
2. `src/exporter.ts`
3. `src/viewer/help-content.ts`
4. `tests/exporter.test.ts` + `tests/mcp.export.test.ts` + `tests/mvp-e2e.test.ts`
   (drei Testdateien, jeweils nur die View-ID — als **ein** Posten geführt, weil es
   eine einzige mechanische Ersetzung ist)
5. `package.json` (Dep-Range)

Dazu `git rm docs/views/spec.md` (Generat) und `package-lock.json` (Nachweis).

**graphcode-client (1):** `src/view-catalog.ts` + `package.json`-Version.
**GVE (0 Code):** nur `package.json`-Range + `npm install`.

## Abhängigkeiten

- **`src/exporter.ts`-Kollision — aufgelöst (2026-08-07).** CR-GC-299 hätte als Option 1
  `exportGraphJson` großflächig umgebaut und wäre mit dem `renderSpec`-Löschen in
  derselben Datei kollidiert. CR-299 ist als *superseded by CR-GC-303* geschlossen;
  CR-GC-303 lässt den Export-Encoding **ausdrücklich unangetastet** und fasst
  `src/exporter.ts` gar nicht an (sein Scope: `conformance.ts` + `steering-snapshot.ts`).
  Dieses CR ist damit der einzige offene Schreiber auf `src/exporter.ts`.
- **`tests/exporter.test.ts` teilt es sich mit CR-GC-304** (ConOps). Verschiedene
  Test-Blöcke, aber dieselbe Datei — **nacheinander, nicht parallel**.

## Risiko

Ein Konsument außerhalb dieser drei Repos, der `'spec'` als View-ID hart verdrahtet
hat, bricht. Bekannt sind keine — `MARKDOWN_VIEWS`-Importeure sind ausschließlich
`src/exporter.ts`, `src/index.ts`, `src/tools/export.ts` (graphcode) und
`vite.config.js` (GVE). Vor dem Publish gegengeprüft, nicht angenommen.
