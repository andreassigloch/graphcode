# CR-GC-508: scaffold-templates.ts unter 500 — Dokument-Vorlagen nach scaffold-docs.ts

**Status:** ✅ Done (2026-09-11)
**Typ:** aus Item ITEM-2026-027 (finding), CR B
**Erstellt:** 2026-09-11
**Item:** bok/items/ITEM-2026-027.json (Lane: code)

---

## Problem

`src/surface/scaffold-templates.ts` hatte 669 Zeilen, die Grenze liegt bei 500. Die Nummer entstand wie bei CR-GC-507 über `nextCrNumber` und `materializeCr` (bok/scripts/aise/lib/dispatch.mjs), weil `aise dispatch prepare` für ein Item mit crRefs nicht erneut mintet.

## Messung vor dem Schnitt (I1)

**Gruppen in der Datei:**

| Gruppe | Zeilen | Inhalt |
|---|---|---|
| Paket und Pfade | 22–90 | `PACKAGE_*`, `MCP_CONFIG`, `GUARDRAILS_FILE`, `STEERING_FILE`, `COMMANDS_DIR`, `HOOKS_DIR` … |
| Skills | 92–150 | `packagedSkillsDir`, `shippedSkillFiles`, `parseSkillFrontmatter` |
| Hooks und Settings | 152–227 | `shippedHookFiles`, `shippedHookEvents`, `isGraphcodeHookEntry`, `mergedSettingsContent` |
| Host-Konfiguration | 229–373 | `deriveHostPort`, `mcpConfigContent`, `opencodeConfigContent`, `hostConfigWithoutGraphcode` |
| **Verfasste Dokumente** | **375–669** | `skillTableRows`, `guardrailsContent`, `VIEW_BLURBS`, `viewTableRows`, `steeringContent` |

**Aufrufer und Richtung:**
- Die Dokument-Gruppe hat außerhalb der Datei genau einen Nutzer: `src/surface/scaffold.ts` ruft `guardrailsContent` und `steeringContent` (scaffold.ts:452/455 und 479/482). Kein Test importiert sie direkt.
- Die Gruppe liest nur nach oben: `packagedSkillsDir`, `shippedSkillFiles`, `parseSkillFrontmatter`, `PACKAGE_SPEC`, `GUARDRAILS_FILE`, `STEERING_FILE`.
- Aus `@sigloch/graphcode-client` braucht nur sie `MARKDOWN_VIEWS`, `VIEW_FILENAMES` und `MarkdownView`.
- Die übrigen vier Gruppen sind Konfigurations-Merge. Die obere Hälfte kennt die Dokumente nicht.

**Modell:** Keine FUNC und kein SCHEMA hat eine realRef auf scaffold-templates.ts. Die nächste Bindung ist `FUNC-harness-cli` → `scaffold.ts::scaffold`, und die bleibt unverändert.

## Schnittplan (umgesetzt)

| Datei | Inhalt | Zeilen |
|---|---|---|
| `src/surface/scaffold-docs.ts` (neu) | `skillTableRows`, `guardrailsContent`, `VIEW_BLURBS`, `viewTableRows`, `steeringContent`; Körper unverändert | aus 375–669 |
| `src/surface/scaffold-templates.ts` | Paket, Pfade, Skills, Hooks, Host-Konfiguration; der nun unbenutzte Import aus graphcode-client ist entfernt | 1–373 |
| `src/surface/scaffold.ts` | importiert `guardrailsContent` und `steeringContent` aus scaffold-docs.ts | Importblock |

Die Richtung ist scaffold.ts → scaffold-docs.ts → scaffold-templates.ts, ohne Zyklus. Es gibt keine Re-Exporte. Die verbliebenen Importe von scaffold-templates.ts sind alle benutzt: `join` 9×, `existsSync` 3×, `readFileSync` 1×, `readdirSync` 3×, `readPackageVersion` 2×, `packageRootDir` 3×.

## Akzeptanzkriterien

- [x] scaffold-templates.ts < 500, entlang der gemessenen Gruppe geschnitten, alter Block gelöscht.
- [x] `graphcode init` in ein Temp-Verzeichnis erzeugt vorher und nachher dieselben Dateien, byte-identisch.
- [x] Modell-Bindung geprüft: keine FUNC betroffen; readiness 0 Fehler, importCoverage sinkt nicht.
- [x] Build grün, Auswahl grün, volle Suite nur Grundlast rot.

## Messung

| Größe | vorher (HEAD d3c2768, v257) | nachher |
|---|---|---|
| src/surface/scaffold-templates.ts | 669 Zeilen | **372** |
| src/surface/scaffold-docs.ts | – | 318 |
| src/surface/scaffold.ts | 506 | 505 |
| `graph_readiness` Fehler | 0 | 0 |
| importCoverage | 87/88 | 88/89 (scaffold-docs.ts zugeordnet, offen bleibt `src/index.ts`) |
| RC-04 / R-31 / IO-01 / FC-04 / BW-02 | 5 / 12 / 2 / 3 / 15 | unverändert |
| IO-02 (Rig am SSOT) | 6 | 6 (keine Modelländerung, graphVersion 257) |

**Smoke, Vorher/Nachher:**
- Ablauf: `node dist/cli.js init` in dasselbe Temp-Verzeichnis (frisches `git init`, gleicher Pfad, weil `deriveHostPort` am Pfad hängt).
- Vorher mit dem dist von d3c2768, nachher mit dem neu gebauten dist.
- 43 Dateien vorher und nachher. Das SHA-256-Manifest aller Dateien außer `.git` ist identisch (`diff` leer), der init-Report auf stderr ebenfalls.

Kein Sichtcheck: Das Modell ist unverändert (graphVersion 257), also gibt es kein Linienbündel, das sich ändern könnte.

## Tests

- `tsc --noEmit` grün, `npm run build` grün.
- **Auswahl:** `graph_tests({changeSet: [FUNC-harness-cli]})` nennt cli.scaffold, distribution und upgrade. Dazu kommen die Dateien, die Dokumentinhalte prüfen (mvp-e2e, mcp.first-step), sowie hooks.prompt-relay (importiert scaffold-templates) und import-boundaries: 7 Dateien, 99 von 99 grün.
- **Assertion-Check:** Kein Test ruft `guardrailsContent` oder `steeringContent` direkt. cli.scaffold und mvp-e2e prüfen die geschriebenen Dokumente über `scaffold`. Die stärkere Zusage dieser CR, gleicher Inhalt Byte für Byte, trägt der Manifest-Vergleich. Einen zusätzlichen Test braucht es nicht, weil kein Verhalten neu ist und die Wege bereits abgedeckt sind.
- **Volle Suite (v257, nach dem Schnitt):** 1081 von 1087 grün. Rot sind 5 von 136 Dateien mit 6 Tests, genau die bekannte Grundlast: `claims.conformance`, `perf.advisory-roundtrip.spike`, `steering.artifact-coupling`, `steering.process-ratchet`, `steering`.

## Bewusst offen

- **scaffold.ts 505 > 500:** Das lag schon vor dieser CR über der Grenze (506). Die Messung von ITEM-2026-027 hatte diese Datei übersehen, ebenso tool-context.ts 618, write.ts 589 und report.ts 553 (alle am Stand f75a53d vom 2026-09-10 schon so) → ITEM-2026-042.
