# CR-GC-374 — Snapshot-Pfad: eine Quelle statt zwei

**Status:** open
**Datum:** 2026-08-19
**Herkunft:** Aufbau des Vorführ-Repos `prod/graphcodedemo` gegen die publizierte 0.13.2.

## Problem

Der Pfad des committeten Graph-Snapshots wird an **zwei** Stellen bestimmt, und sie
widersprechen sich in jedem Repo außer diesem:

- **Schreibend** (`src/tools/export.ts:178`): `docs/graph/${systemId}.graph.json`, wobei
  `systemId` aus `deriveMemberName()` stammt — also aus `package.json.name`.
- **Lesend** (`src/harness-import.ts:26`): die Konstante
  `DEFAULT_GRAPH_JSON = 'docs/graph/graphcode.graph.json'` — der Name hart verdrahtet.

In diesem Repo fallen beide zufällig zusammen (`@sigloch/graphcode` → member `graphcode`),
deshalb ist es nie aufgefallen. Überall sonst zeigt die lesende Seite auf eine Datei, die
nie geschrieben wird.

Betroffen ist nicht nur `rewind`, sondern jeder Leser der Konstante:

| Stelle | Wirkung im Fremd-Repo |
|---|---|
| `src/rewind.ts:112` | `graphcode rewind <ref>` findet keinen Snapshot — Recall ist tot. Die `snapshot`-Option existiert in `executeRewind`, aber `src/cli.ts:151` reicht sie nicht durch, es gibt also auch keinen Ausweg über die CLI. |
| `src/harness.ts:208/225` | **Der Schema-Drift-Guard (CR-GC-249) greift nicht.** `existsSync(graphJson)` ist false, `staleSchema` bleibt false — nach einem contracts-Bump mit neuem TRACE_PATTERN lehnt der eingefrorene Store die neue Kante ab, und die automatische Erholung, die genau dafür gebaut wurde, läuft nicht an. |
| `src/harness.ts:593` | `harness.reseed()` ohne Argument reseedet aus einer Datei, die es nicht gibt. |

Verifiziert in `prod/graphcodedemo` (156 Elemente): Export schreibt
`docs/graph/graphcodedemo.graph.json`, `npx graphcode rewind HEAD` meldet den Snapshot als
fehlend. Das Demo-Repo umgeht das derzeit mit einem eigenen `scripts/reset-demo.mjs`, das
`harness.reseed('docs/graph/graphcodedemo.graph.json')` explizit aufruft.

## Lösung

Der Snapshot-Pfad wird **einmal** abgeleitet, aus derselben Größe, die ihn schreibt:

```ts
export function graphSnapshotRel(systemId: string): string   // docs/graph/<systemId>.graph.json
```

`src/tools/export.ts` baut den Pfad nicht mehr selbst, sondern ruft den Helfer. Die Leser
ziehen den `systemId` aus dem Scope, den sie ohnehin halten (`this.config.scope.systemId`
in der Harness, `deriveMemberName(repoRoot)` in `rewind`). Die Konstante
`DEFAULT_GRAPH_JSON` entfällt ersatzlos — keine zweite Definition, die wieder auseinander
laufen kann.

**Kein Bruch für dieses Repo:** `systemId` ist hier `graphcode`, der abgeleitete Pfad also
byte-identisch mit der bisherigen Konstante.

Zusätzlich bekommt `graphcode rewind` das Flag `--snapshot <pfad>` durchgereicht — nicht als
Fix (der Default stimmt danach), sondern für den Fall, dass jemand einen Snapshot unter
abweichendem Namen recallen will.

## Abgrenzung

- **Keine** Rückwärtskompatibilität für den alten festen Namen: ein Fallback auf
  `docs/graph/graphcode.graph.json`, wenn die abgeleitete Datei fehlt, wäre genau der
  parallele Pfad, den dieser CR beseitigt.
- **Keine** Änderung an der Export-Semantik (Refuse-to-clobber-Guards bleiben unberührt).
- **Kein** neuer ElementType, keine neue Rule, kein contracts-Bump.

## Dateien (≤ 6)

| Repo | Datei | Änderung |
|---|---|---|
| graphcode | `src/harness-import.ts` | `DEFAULT_GRAPH_JSON` raus, `graphSnapshotRel(systemId)` rein; `applyReseed`-Default zieht nach |
| graphcode | `src/harness.ts` | Schema-Guard + `reseed()`-Default leiten den Pfad aus `config.scope.systemId` ab |
| graphcode | `src/rewind.ts` | Default aus `deriveMemberName(repoRoot)`; `src/cli.ts` reicht `--snapshot` durch |
| graphcode | `src/tools/export.ts` | nutzt `graphSnapshotRel` statt eigenem `join` |
| graphcode | `tests/rewind.test.ts` | Regression: Repo mit Fremdnamen recallt seinen eigenen Snapshot |
| graphcode | `tests/schema-guard.test.ts` | Regression: Auto-Reseed nach Fingerprint-Drift greift auch bei Fremdnamen |

## Akzeptanzkriterien

- [ ] In einem Repo mit `package.json.name != "graphcode"` stellt `graphcode rewind <ref>` den
      committeten Graph-Stand her (roter Test zuerst: er muss vorher am fehlenden Snapshot scheitern).
- [ ] Der Schema-Drift-Guard reseedet in demselben Repo nach einer Fingerprint-Änderung
      selbsttätig — ebenfalls rot-zuerst nachgewiesen.
- [ ] `grep -rn "graph/graphcode.graph.json" src/` ist leer.
- [ ] `npm run build` + `npm test` grün; dieses Repo verhält sich unverändert.
- [ ] `prod/graphcodedemo` kommt nach dem Bump ohne `scripts/reset-demo.mjs` aus
      (`npm run demo:reset` ruft dann `graphcode rewind HEAD --force`).
