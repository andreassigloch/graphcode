# CR-GC-378 — Feste Version in der Startzeile: was läuft, steht im Repo

**Status:** done · **Angelegt:** 2026-08-20 · **Geschlossen:** 2026-08-21 · **Vorgänger:** CR-GC-377

## Problem

`.mcp.json` startete `npx -y @sigloch/graphcode mcp`. Was daraus wirklich startet, ist
ein **Auflösungsergebnis**, keine Angabe: `npx` nimmt den lokalen Bin zuerst. Real
beobachtet in `graphcodedemo` — Terminal-Start 0.15.0 (Ontologie 7.0.0), Agent-Session
0.13.2 (Ontologie 6.0.0), aus derselben eingecheckten Datei. Keine der beiden Zahlen war
irgendwo lesbar.

Damit ist auch jede Diagnose weich: CR-GC-376 kann Install und Host vergleichen, aber
nicht sagen, was der Host beim nächsten Start **sein wird**.

## Ziel

`init` und `upgrade` schreiben die Version in die Startzeile — in beide Host-Configs:

```jsonc
// .mcp.json
"args": ["-y", "@sigloch/graphcode@0.17.0", "mcp"]
// opencode.json
"command": ["npx", "-y", "@sigloch/graphcode@0.17.0", "mcp"]
```

Geschrieben wird sie vom Build, der das Upgrade ausführt — CR-GC-377 lässt genau diesen
die Artefakte schreiben, also kann die Zahl nicht von einem alten Build stammen.
`graphcode status` nimmt den Pin in den Vergleich auf:

```
  Version     OK             CLI 0.17.0 · Host 0.17.0 · Repo 0.17.0 · Pin 0.17.0
  Version     Drift          CLI 0.17.0 · Repo 0.17.0 · Pin 0.13.2 → graphcode upgrade
```

Drei Urteile, die vorher nicht möglich waren:

- **Pin hinter dem Install** → die nächste Session bootet den alten Build. Drift.
- **npx-Startzeile ohne Pin** → nicht vergleichbar; das ist der Defekt selbst. Drift,
  heilt beim ersten `graphcode upgrade`.
- **Fremde Startzeile** (graphcodes eigenes Repo startet `node dist/cli.js`) → **kein**
  Urteil. Über eine Startzeile, die nicht von uns stammt, hat dieser Bericht nichts zu sagen.

## Änderungen

| Datei | Was |
|---|---|
| `src/scaffold-templates.ts` | `PACKAGE_SPEC` (Name@Version) in `.mcp.json` + `opencode.json` + GRAPHCODE.md; eigener Versions-Leser gelöscht → `package-version.ts` |
| `src/status.ts` | `readPinnedVersion()`, `VersionStatus.pin`, Pin im Drift-Urteil |
| `tests/status.test.ts` | 4 Fälle: Pin OK, Pin fehlt, Pin veraltet, fremde Startzeile |
| `tests/cli.scaffold.test.ts` | Startzeilen-Assertions gegen `PACKAGE_SPEC` statt Paketnamen |
| `tests/distribution.test.ts` · `tests/mvp-e2e.test.ts` | fremder Install und MVP-Loop prüfen die feste Version |
| `docs/cr/open/CR-GC-378-…` | dieser CR |

Nebeneffekt, bewusst mitgenommen: `scaffold-templates.packageVersion()` mit seinem
Fallback `'0'` ist weg (offener Punkt aus CR-GC-376). Für einen Dep-Range war der
Fallback tolerierbar, für einen Pin wäre er fatal — `@sigloch/graphcode@0` existiert
nicht, der Agent-Host startete dann gar nichts. Der gemeinsame Leser scheitert laut.

## Graph nachgezogen (statt eines eigenen CR-GC-379)

Zwei Gate-Mutationen, kein eigener CR — dafür wäre der Vorgang zu klein:

- `FUNC-search-updates` **gelöscht**. Die Registry-Abfrage ist in `upgrade --check`
  aufgegangen; ein zweiter Weg zur selben Auskunft wäre genau der Parallelpfad, den
  CR-GC-377 beseitigt hat.
- `FUNC-upgrade` **angelegt** (`realRef: src/upgrade.ts#executeUpgrade`,
  `testRefs: tests/upgrade.test.ts`, `allocate → MOD-cli`), graphVersion 114.

## Akzeptanzkriterien

- [x] `init`/`upgrade` schreiben die feste Version in beide Host-Configs
- [x] `status` meldet den Pin und wertet ihn (veraltet / fehlt / fremd)
- [x] Fremde Startzeile → kein Pin-Urteil
- [x] Kein `'0'`-Fallback mehr in der Versions-Auflösung
- [x] Suite 834/835 grün. Der eine rote Fall bleibt `tests/distribution.test.ts`: das
      uncommittete `package.json` zeigt auf Peer-Versionen, die es in der Registry noch
      nicht gibt (`@sigloch/graph-view-edit@^0.6.0`, `@sigloch/contracts@^6.0.0`), also
      scheitert der Tarball-Install vor jeder Assertion. **Folge:** die Pin-Prüfung im
      fremden Install ist erst nach dem Publizieren der Peers tatsächlich gelaufen.
