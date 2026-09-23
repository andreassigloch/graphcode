# CR-GC-626: Der Testlauf erbt GIT_INDEX_FILE/GIT_DIR des pre-commit-Hooks und schreibt in den umgebenden Index

**Status:** ✅ Done (2026-09-23)
**Typ:** aus Item ITEM-2026-500 (bug)
**Erstellt:** 2026-09-23
**Item:** bok/items/ITEM-2026-500.json (Lane: code)

---

## Befund

Ein Commit mit Modell-Änderung bricht ab:

```
error: invalid object 100644 ee3caf4c... for 'docs/graph/fremd-anlage.graph.json'
error: Error building trees
```

Der Pfad existiert im Arbeitsbaum nicht und stand vor dem Commit nicht im Index. Er kommt aus dem
Hook selbst.

**Die Kette:** git setzt für jeden Hook `GIT_DIR` und `GIT_INDEX_FILE`. Der `pre-commit` fährt bei
einem Snapshot im Diff die Modell-Spur (CR-GC-535). In ihr liegt `tests/rewind.test.ts`; dessen
Helfer ruft `execFileSync('git', args, { cwd: tempRepo })` — **ohne** die Umgebung zu bereinigen.
`git -C <temp> add -A` schreibt deshalb in den Index des UMGEBENDEN Repos, während der Blob im
Objektspeicher des Temp-Repos landet. Der Eintrag zeigt ins Leere, und git kann den Baum nicht mehr
bauen.

**Nachgewiesen, nicht vermutet** (2026-09-23):

```
cp .git/index /tmp/probe-index
GIT_INDEX_FILE=/tmp/probe-index GIT_DIR=$PWD/.git npx vitest run tests/rewind.test.ts
GIT_INDEX_FILE=/tmp/probe-index git ls-files --stage | grep fremd
→ 100644 aaa6ae95... 0  docs/graph/fremd-anlage.graph.json
```

Dieselbe Form haben `tests/flow-contracts.test.ts` und `tests/systemtest-rig.test.ts`. Sie liegen
heute nicht in der Modell-Spur, also schlagen sie noch nicht zu — der Fehler ist dort dieselbe
Zeile, nur ohne Anlass.

Verwandt, aber nicht dasselbe: CR-GC-580 (`isolateGit`) hat den Arbeitsbereich des Rigs zum eigenen
Repo gemacht. Ein eigenes `.git` hilft hier nicht — `GIT_DIR` in der Umgebung sticht jedes `-C`.

## Zielbild

Die geerbte git-Umgebung fällt **einmal je Testprozess** weg, als `setupFiles` in
`vitest.config.ts`: `GIT_DIR`, `GIT_INDEX_FILE`, `GIT_WORK_TREE`, `GIT_OBJECT_DIRECTORY`,
`GIT_ALTERNATE_OBJECT_DIRECTORIES`, `GIT_COMMON_DIR`, `GIT_CEILING_DIRECTORIES`, `GIT_PREFIX`,
`GIT_INTERNAL_SUPER_PREFIX`.

**Nicht ein Testhelfer an den drei Aufrufstellen — das war der erste Anlauf, und er war falsch.**
Im selben Prozess rufen zwei Sorten Aufrufer git: die Tests und der Produktcode, den sie fahren
(`src/surface/rewind.ts`, `src/surface/measured.ts`, `src/projections/test-selection-audit.ts`).
Räumt man nur die Tests auf, committen sie ins Temp-Repo, während `resolveCommit` die sha noch im
umgebenden Repo sucht — **gemessen 10 rote Fälle** in `rewind.test.ts`. Die Umgebung gehört dem
Prozess, also wird sie im Prozess bereinigt; Produktcode und Tests werden zusammen geheilt, und es
gibt keine vierte Aufrufstelle, die es wieder vergisst.

Die Bereinigung liegt in `tests/setup/git-env.ts` **wirkungsfrei** und wird von
`tests/setup/git-env.setup.ts` ausgeführt. Grund ist ein gemessener Fehlschlag: solange der Aufruf
im selben Modul stand, reinigte schon der **Import** den Prozess — der Abnahmetest war damit auch
ohne `setupFiles` grün und bewies nichts.

## Akzeptanzkriterien

- [x] Unter der Hook-Lage (`GIT_DIR`/`GIT_INDEX_FILE` gesetzt) sind zwei der drei Fälle in
      `tests/git-env-isolation.test.ts` ohne `setupFiles` rot und mit grün — geprüft 2026-09-23
- [x] `rewind.test.ts` + `flow-contracts.test.ts` unter derselben Lage: 32/32 grün, und der
      geerbte Index trägt danach **keinen** Fremdeintrag (vorher: `docs/graph/fremd-anlage.graph.json`)
- [x] Ein Commit mit Snapshot im Diff läuft wieder durch
- [x] Testsuite grün

## Umfang

`vitest.config.ts`, `tests/setup/git-env.ts` (neu), `tests/setup/git-env.setup.ts` (neu),
`tests/git-env-isolation.test.ts` (neu), `scripts/model-test-set.mjs` (der neue Test wird in
der Spur-Buchführung begründet ausgeschlossen) — 5 Dateien. Produktcode bleibt unberührt.
