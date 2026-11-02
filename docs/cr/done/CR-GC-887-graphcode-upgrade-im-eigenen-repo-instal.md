# CR-GC-887: graphcode upgrade im eigenen Repo installiert sich selbst und biegt .mcp.json auf die Registry-Version

**Status:** ✅ Done (2026-11-02)
**Typ:** aus Item ITEM-2026-545 (bug)
**Erstellt:** 2026-11-02
**Item:** bok/items/ITEM-2026-545.json (Lane: graph)

---

Gemessen 2026-09-24: 'graphcode upgrade' im graphcode-Repo selbst behandelt es als Consumer: installiert @sigloch/graphcode ^0.25.0 aus der Registry als Self-Dependency (package.json + lock), biegt .mcp.json von dist/cli.js auf node_modules/@sigloch/graphcode/dist/cli.js um (der naechste Host liefe dann auf dem PUBLIZIERTEN Stand, nicht auf dem Arbeitsstand), setzt GRAPHCODE_HOST_PORT und legt GRAPHCODE.md, GRAPHCODE-STEERING.md, opencode.json an. Vorzustand von Hand wiederhergestellt. Erwartet: upgrade erkennt das Paket-Repo (package.json name == @sigloch/graphcode) und tauscht nur den Host.

---

## Befund

`graphcode upgrade` behandelte jedes Repo als Consumer. Drei Folgen:

- Im graphcode-Repo selbst: Self-Dependency und `.mcp.json` auf die Registry-Version (ITEM-2026-545).
- In graphify (graphcode haengt daran): `aise rollout` durfte nicht laufen, sonst Publish-Zyklus. Die Skills blieben stehen.
- In graph-view-edit: `registerDependency` schrieb graphcode nach `dependencies`, obwohl es in `devDependencies` steht. Das ist ein Laufzeit-Zyklus.

## Umsetzung

- `scaffold.ts`: `dependencySection` behaelt die Klasse des Eintrags, auch beim Entfernen.
- `scaffold.ts`: `packageRepoKind` erkennt `self` und `upstream` am Paketnamen. `init` und `update` verweigern dort.
- `upgrade.ts`: Im Paket-Repo keine Installation. `upstream` bekommt die Skills per `syncSkills`, `self` ist ihre Quelle. Der Host wird in beiden Faellen getauscht.
- `upgrade.ts`: `npm install --save-dev`, wenn graphcode eine devDependency ist.

Bewusst nicht: `graphcode upgrade` schreibt die Startzeile von graphify nicht. Sie steht von Hand auf
`node ../graphcode/dist/cli.js mcp`, wie im graphcode-Repo selbst.

## Akzeptanz

- [x] `upgrade` im graphcode-Repo installiert nichts und meldet keine fehlenden Artefakte.
- [x] `upgrade` in graphify installiert nichts und zieht die Skills nach (27 neu, 19 aktualisiert).
- [x] Eine devDependency bleibt eine, bei `update` und `upgrade`.
- [x] `remove` nimmt auch die devDependency mit.
- [x] `init` und `update` verweigern im Paket-Repo und aendern nichts.

Tests: `tests/upgrade.test.ts`, `tests/cli.scaffold.test.ts`.
