# CR-GC-959: Fehlbindung — 5 FLOW tragen ein SCHEMA, das den übergebenen Wert nicht beschreibt

**Typ:** Bug, aus Item ITEM-2026-1470
**Status:** Open
**Erstellt:** 2026-11-19
**Item:** bok/items/ITEM-2026-1470.json (Lane: graph)
**Herkunft:** CR-GC-958 (Kettentest und Nachtrag „Regel über alle Repos“)

---

## Befund

Fünf FLOW sind an ein Enum-Schema gebunden, übergeben wird aber ein anderer Wert.

| FLOW | Erzeuger → Empfänger | gebunden | übergeben wird |
|---|---|---|---|
| `FLOW-install-result-collect-status` | `FUNC-collect-status` → `FUNC-cli-dispatch` | `SCHEMA-cli-command` (`init`/`update`/`remove`) | `RepoStatus` (`src/surface/status.ts`, Interface) |
| `FLOW-install-result-harness-cli` | `FUNC-harness-cli` → `FUNC-cli-dispatch`, `FUNC-init-verb` | `SCHEMA-cli-command` | `InstallResult` (`src/surface/scaffold.ts`, Zod-Schema `InstallResultSchema` vorhanden, kein SCHEMA-Knoten) |
| `FLOW-install-result-init` | `FUNC-init-verb` → `ACTOR-auftraggeber` | `SCHEMA-cli-command` | `InitReport` (`src/surface/init-verb.ts`, Interface) |
| `FLOW-install-result-upgrade` | `FUNC-upgrade` → `FUNC-cli-dispatch` | `SCHEMA-cli-command` | `UpgradeReport` (`src/surface/upgrade.ts`, Interface) |
| `FLOW-markdown-text` | `FUNC-export-markdown` → `FUNC-render-verb`, `FUNC-graph-export-snapshot` | `SCHEMA-markdown-view` (Enum der Sichtnamen) | Markdown-Text (`string`) |

Keine Regel meldet das. Der Prototyp `graphanalyze/werkzeuge/schema-typ/pruefe.mjs` urteilt bei allen fünf „passt nicht“.

## Warum Code und nicht nur Modell

R-26 verlangt für jedes SCHEMA ein Zod-Schema mit `realRef`. Ein Konzept-SCHEMA ohne Bindung ist seit 2026-10-05 nicht mehr zulässig (FAQ `concept-true-ungebunden`). Für `RepoStatus`, `InitReport`, `UpgradeReport` und den Markdown-Text gibt es nur TypeScript-Typen. Deshalb kommen Modell- und Code-Zug in denselben CR (FAQ `modell-zug-wann`).

## Zielbild

1. **Zod statt Interface:** Die Interfaces `RepoStatus`, `InitReport` und `UpgradeReport` werden zu Zod-Schemas, der Typ kommt per `z.infer`. Für Unterobjekte wie `HostStatus`, `DashboardStatus` und `VersionStatus` gilt dasselbe. Die alten Interfaces werden gelöscht, kein paralleler Pfad.
2. **Markdown-Text:** In `src/projections/exporter.ts` kommt `MarkdownTextSchema = z.string()` dazu.
3. **Erzeuger parsen** ihr Ergebnis dort, wo es entsteht, und geben das Original zurück (FAQ `erzeuger-parst-vertrag`):
   - `collectStatus`, `executeInit`, `executeUpgrade` und `exportMarkdown` mit ihrem neuen Schema;
   - `scaffold` mit `InstallResultSchema`.
4. **Modell:**
   - neue SCHEMA-Knoten `SCHEMA-repo-status`, `SCHEMA-install-result`, `SCHEMA-init-report`, `SCHEMA-upgrade-report` und `SCHEMA-markdown-text`, je mit `realRef`;
   - die 5 FLOW per Kanten-Patch auf das richtige SCHEMA umhängen, je FLOW genau ein SCHEMA (FAQ `flow-ein-schema`);
   - `SCHEMA-cli-command` bleibt an `FLOW-cli-command` hängen, `SCHEMA-markdown-view` an `FLOW-render-view-request`.
5. **Vertragstests:** je neuem SCHEMA einer, erzeugt mit `graphanalyze/werkzeuge/vertragstest/cli.mjs` und als TEST verify SCHEMA gebunden (R-32).

## Akzeptanzkriterien

- `pruefe.mjs` auf graphcode: Alle 5 FLOW stehen auf „passt“, keiner der heute als „passt“ geurteilten FLOW fällt auf „passt nicht“.
- R-26, R-32, RC-04 und RC-08 melden für die 5 neuen SCHEMA keinen Befund.
- `npm run build` ist grün. `npm run verify:code` ist grün, ebenso `npm run verify:full CR-GC-959` vor dem Schließen.
- Die Tests `tests/status.test.ts`, `tests/init-verb.test.ts`, `tests/upgrade.test.ts`, `tests/cli.scaffold.test.ts` und `tests/exporter.test.ts` bleiben grün. Deckt ein `parse` einen Bruch auf, wird er nicht aufgeweicht: Ausnahme am Code benennen, Item anlegen.
- **Smoke:** `graphcode status` und `graphcode render srs --format md` laufen im Repo.

## Dateien (≤ 10)

`src/surface/status.ts`, `src/surface/init-verb.ts`, `src/surface/upgrade.ts`, `src/surface/scaffold.ts`, `src/projections/exporter.ts` und die 5 erzeugten Vertragstests unter `tests/`. Wächst die Liste, wird vorher geteilt.

## Entscheidungen

keine

## Umfang laut `graph_impact`

Relation-Kanten: `FUNC-collect-status`, `FUNC-harness-cli`, `FUNC-init-verb`, `FUNC-upgrade`, `FUNC-export-markdown`, `SCHEMA-cli-command`, `SCHEMA-markdown-view`.
Testspur: `graph_tests` über diese FUNC vor dem Bau.
