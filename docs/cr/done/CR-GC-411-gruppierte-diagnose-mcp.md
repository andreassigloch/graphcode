# CR-GC-411 — Gruppierte Verstöße als MCP-Detail-Level (eine Aggregation, zwei Konsumenten)

**Status:** done · **Angelegt:** 2026-08-25 · **Abgeschlossen:** 2026-08-25
**Herkunft:** Dashboard-Review 2026-08-25, Frage „was bekommt die LLM — würde die Aggregation
auch dort helfen?"

> ## ⚠️ OFFENE VORAUSSETZUNG: `@sigloch/graphcode-client@1.3.0` publizieren
>
> Der Code ist fertig und lokal grün (`link:siblings` löst 1.3.0 aus dem Arbeitsbaum auf).
> **1.3.0 liegt aber noch nicht in der Registry.** Bis der Publish läuft, sind in graphcode
> ZWEI Tests rot — beide benennen genau diese Ursache, keiner ist ein Codefehler:
>
> | Test | Meldung |
> |---|---|
> | `tests/distribution.test.ts` | `ETARGET — No matching version found for @sigloch/graphcode-client@^1.3.0` |
> | `tests/lockfile-sync.test.ts` | `package.json=^1.3.0 lock=^1.1.0` (Lock hält noch 1.2.0) |
>
> Das ist gewollt: ein sprechender Installationsfehler ist besser als ein
> `groupViolations is not a function` zur Laufzeit — der Code REQUIRES 1.3.0, also muss der
> Range das sagen. Nach `npm publish` in `sigloch-modules/packages/graphcode-client`:
> `npm install` in graphcode (löst das Lock neu auf) und in graph-view-edit → beide grün.

## Befund — die Mittel-Ebene fehlt auf der MCP-Surface

Was die LLM heute bekommt:

| Tool | Default | Inhalt |
|---|---|---|
| `graph_readiness` | summary | Scores + `violationsByRule` (Count je Regel, **ohne** Element-IDs) |
| `rules_evaluate` | **full** | jedes Finding einzeln inkl. `context` — gemessen > 750 KB bei 667 Knoten |
| `rules_evaluate summary` | — | je Verstoß eine Zeile, aber **ungruppiert** |

Die Mittel-Ebene — EINE Gruppe je ruleId mit Count, message, fixHint und gekappter
elementIds-Liste — existiert nur privat in gve (`vite.config.js recommendationGroups`,
CR-GVE-250): ein paralleler Aggregationspfad außerhalb der Familie.

## Änderung

`detail:'grouped'` für `rules_evaluate` (und `rules_get_violations`):
`{ruleId, severity, count, message, fixHint, elementIds (gekappt, Kappung benannt),
elementIdsOmitted}` — erst gruppieren, dann kappen (Zählung über die ungekappten Listen,
CR-GVE-250-Lehre). Die Gruppierungsfunktion wird EINMAL implementiert und exportiert
(graphcode-client), gve ersetzt seine `recommendationGroups`-Kopie durch den Import
(Folge-CR dort — kein Parallelpfad mehr).

## Nutzen

- LLM: token-präzise Diagnose („welche Regeln feuern, an welchen Elementen") ohne
  750-KB-Antwort und ohne Zeile-pro-Verstoß-Rauschen; `full` bleibt für den
  candidate_targets-Fall (CR-GC-309-Zusage unangetastet).
- Familie: eine Aggregation, zwei Konsumenten (MCP + gve-Dashboard).

## Akzeptanzkriterien

- [x] `detail:'grouped'` liefert Gruppen mit korrektem Count aus ungekappten Listen
      (Test > Kappgrenze, vorher rot) — die 11 Fälle über der Kappgrenze liegen in der
      Unit-Suite des Pakets (`tests/unit/violation-groups.test.ts`, rot gesehen). Im
      Tool-Layer prüft `evaluation.reconciliation.test.ts`, dass die Antwort **identisch**
      zu `groupViolations(findings)` ist — ein lokaler Nachbau (und damit ein cap-then-count)
      fiele dort auf. Der reale Repo-Graph hat keine Regel über der Kappgrenze (max 5×),
      deshalb ist die Kappung dort nicht demonstrierbar, nur die Delegation.
- [x] Antwortgröße auf dem realen Graphen gemessen (688 Elemente / 1862 Traces, 30 Verstöße;
      `rules_evaluate`-Antwort als JSON, UTF-8-Bytes):

      | detail | Bytes | vs. full |
      |---|---:|---:|
      | full | 33 971 | 1,0× |
      | summary | 7 406 | 0,22× |
      | grouped | **4 469** | **0,13×** |

      Der Abstand zu `full` wächst mit der Zahl der Verstöße (`context` dominiert die Bytes);
      der Abstand zu `summary` wächst mit der Zahl der Verstöße JE REGEL. Die Test-Schranke ist
      bewusst konservativ (`grouped × 4 < full`), damit sie auf einem roteren Graphen nicht kippt.
- [x] `full`-Default und Semantik unverändert (mcp.mutate-violations-Vertrag) — `detail` bleibt
      `.default('full')`, `total` bei `rules_get_violations` bleibt `matched.length`
      (Zahl der VERSTÖSSE, nicht der Gruppen).
- [x] gve-Folge-CR angelegt und umgesetzt: **CR-GVE-259** (`recommendationGroups` gelöscht,
      `groupViolations` importiert; 14/14 grün, 7 vorher rot gesehen).

## Dateien

| Repo | Datei | Änderung |
|---|---|---|
| sigloch-modules | `packages/graphcode-client/src/panels.ts` + Test | `groupViolations`/`ViolationGroup` (Teil 1, `7b4bf4e`) |
| graphcode | `src/tools/report.ts` | `detail:'grouped'`, `project`-Zweig, Rückgabetypen |
| graphcode | `tests/evaluation.reconciliation.test.ts` | Gruppen-Invarianten + Byte-Messung |
| graphcode | `package.json` | Dep `^1.1.0` → `^1.3.0` |
| graphcode | dieser CR | |
| graph-view-edit | `vite.config.js`, Tests, `package.json` | CR-GVE-259 (Import statt Kopie) |

---

## Umsetzungsstand 2026-08-25 — alle drei Teile fertig (Publish offen, s.o.)

### Teil 1 — SSOT-Funktion (sigloch-modules)

| | |
|---|---|
| Paket | `@sigloch/graphcode-client` (`sigloch-modules/packages/graphcode-client`) |
| Version | **1.3.0** (Minor, additiv) — vorher 1.2.0 |
| Commit | `7b4bf4e` — `feat: violation grouping (CR-GC-411)` |
| Export | `groupViolations(violations: RuleViolation[], elementLimit = 10): ViolationGroup[]` + `type ViolationGroup` (in `src/panels.ts`, über `export * from './panels.js'` am Root-Barrel **und** am Subpath `./panels`) |
| Tests | `tests/unit/violation-groups.test.ts` — 11 Fälle, alle über der Kappgrenze; rot gesehen (11/11 `groupViolations is not a function`), danach 47/47 grün |

`ViolationGroup = {ruleId, severity, count, message, fixHint?, elementIds, elementIdsOmitted}`,
sortiert nach `count` absteigend. Erst gruppieren, dann kappen: `count` kommt aus den
UNGEKAPPTEN Listen, `elementIdsOmitted` benennt die Kappung.

### Teil 2 — `detail:'grouped'` in graphcode

`src/tools/report.ts`: `detailField` = `z.enum(['summary','full','grouped'])` (Default weiter
`full`), `project()` bekommt den dritten Zweig `groupViolations(findings)` — **delegiert, nicht
nachgebaut**; Rückgabetypen beider Tools `Finding[] | ViolationGroup[]`, `total` unverändert
`matched.length`. Dep auf `^1.3.0` gepinnt (Lock wird beim ersten `npm install` nach dem
Publish nachgezogen — bis dahin die zwei roten Tests oben).

Rot gesehen: 2/2 neue Tests rot vor der Implementierung (`grouped` fiel auf `summary` zurück —
`expected 30 to be less than 30`), danach 8/8 grün; `npm run build` + `type-check` sauber;
Gesamtsuite 951/953 (die 2 sind die Publish-Blocker oben).

### Teil 3 — gve importiert statt zu kopieren

**CR-GVE-259** in `graph-view-edit`: `recommendationGroups` in `vite.config.js` GELÖSCHT,
`groupViolations` importiert, alle drei Aufrufer (`recommendationsPayload`,
`gateBlockerGroups`, `gateBlockerRollup`) umgestellt, Dep-Range `>=1 <2` → `>=1.3 <2`.
Rot gesehen: nach dem Löschen 7/14 rot (`recommendationGroups is not a function`), danach
14/14 grün; `npm run build` grün. Kein Parallelpfad mehr in der Familie.
