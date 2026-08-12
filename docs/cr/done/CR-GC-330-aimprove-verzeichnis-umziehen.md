# CR-GC-330 — Der Learning-Feed zieht in den eigenen Workspace

**Status:** done · **Datum:** 2026-08-12
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert**
**Bezug:** [CR-GC-102](../done/CR-GC-102-hooks.md) (Trajectory-Emission),
[CR-GC-252](../done/CR-GC-252-learning-feed-projektion.md) (Feed = Projektion des Operations-Logs)

---

## 1. Problem

`.aimprove/` ist der Workspace des Vorgängerprodukts **aimprove**, aus dem graphcode ausgecarvt
wurde. graphcode hat seit CR-GC-100 seinen eigenen Workspace `.graphcode/` (Kuzu-Store,
`owner.lock`, `host.sock`, `audit.jsonl`, `EXPORT_PENDING`, `target-profile.json`) — schreibt aber
bis heute **eine** Datei in den Fremd-Ordner: den Learning-Feed `trajectory.jsonl`
(`src/tool-context.ts:129` + `:155`). Zwei Folgen, keine davon kosmetisch:

- **`graphcode remove` ist nicht restlos.** Der Befehl verspricht restlose Deinstallation
  (`src/scaffold.ts:461-469`) und entfernt `.graphcode/`, kennt `.aimprove/` aber nicht → in jedem
  Zielrepo bleibt `.aimprove/trajectory.jsonl` verwaist liegen.
- **Der Graph beschreibt den Pfad falsch.** Drei Live-Knoten — `FUNC-emit-trajectory`,
  `REQ-trajectory-emit`, `REQ-post-emit-trajectory` — nennen `.aimprove/*.jsonl` als verbindlichen
  Ort. Der Graph ist SSOT; der falsche Pfad propagiert von dort in `docs/views/srs.md`.

Dazu die tote Masse: im graphcode-Repo hält `.aimprove/` 107 MB Vorgänger-Daten
(`graph.kuzu` 92 M, `learning.db` + WAL/SHM 14 M, `state.json`), die kein Code mehr liest.

---

## 2. Ziel

Ein Ordner pro Repo. graphcode schreibt ausschließlich nach `.graphcode/`.

---

## 3. Nicht-Ziele

- **aimprove als Produkt bleibt erwähnt.** README-Abgrenzung, ADR-001, CR-Historie in `done/`,
  `tests/views.no-fork.test.ts` referenzieren den Generator/die Learning-Engine — korrekt, bleibt.
  Nur der **Pfad** zieht um.
- **Kein Legacy-Cleanup in `graphcode remove`** → CR-GC-331, sonst 8 Dateien.
- **Keine Migration der Altdatei.** Der Feed ist eine reine Projektion des Audit-Logs (CR-252) und
  wird bei der nächsten Mutation am neuen Ort vollständig neu geschrieben.

---

## 4. Anforderungen

1. `materializeTrajectory` schreibt nach `<repoRoot>/.graphcode/`. Das Ziel kommt aus dem
   bestehenden `GRAPHCODE_DIR` (`src/scaffold-templates.ts:51`) — **importieren, kein zweites
   String-Literal.** `materializeTrajectory` selbst (`src/emit.ts:100`) bleibt unverändert: es nimmt
   `outDir` als Parameter und kennt keinen Pfad.
2. Die beiden Tests, die die Datei lesen, sind der Verifier des Umzugs — **red-first**: erst den
   Pfad im Test umstellen, Fehlschlag am neuen Ort sehen, dann `tool-context.ts` fixen.
3. Die drei Graph-Knoten durchs Gate korrigieren, `docs/views/srs.md` per `graph_export` neu
   erzeugen (nie von Hand — Generat).
4. `.aimprove/` verschwindet aus `.gitignore` (durch `**/.graphcode/*` bereits abgedeckt) und vom
   Datenträger.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/tool-context.ts` | 2× `'.aimprove'` → `GRAPHCODE_DIR` + Import |
| `src/index.ts` | Docblock `createHarness` (Zeile 164) |
| `tests/smoke.create-harness.test.ts` | Feed-Pfad + Kommentar |
| `tests/hooks.learning-emit.test.ts` | `readTrajectory()`-Helper |
| `rig/greenfield-systemtest/run.mjs` | `--exclude '.aimprove'` raus |
| `.gitignore` | `.aimprove/` raus |

6 Dateien — Obergrenze erreicht. Graph-Änderung ist kein File-Edit (Gate), `srs.md` ist Generat.

---

## 6. Akzeptanzkriterien

- [x] Kein `.aimprove`-**Schreibpfad** mehr in `src/`, `tests/`, `rig/`, `.gitignore`. Verbleibende
      4 Treffer sind absichtlich: 3 Kommentare, die den Umzug erklären, + die Negativ-Assertion.
- [x] Nach einer echten Mutation: `.graphcode/trajectory.jsonl` frisch, `.aimprove/` entsteht **nicht**
      neu — gepinnt in `tests/smoke.create-harness.test.ts` (frischer Prozess, temp-Repo, beide
      Richtungen). *Im laufenden Repo greift das erst nach einem MCP-Server-Neustart; der Server
      hält den Code von seinem Boot (bekanntes Stale-Server-Verhalten, kein Code-Defekt).*
- [x] Die drei Graph-Knoten nennen `.graphcode/`; `srs.md` nach Export ebenso.
- [x] `npm run build` + volle Suite grün — 664 Tests, 89 Dateien.
- [x] 103 MB Vorgänger-Daten entfernt (`.aimprove/` im Root + je eine verwaiste `trajectory.jsonl`
      in `rig/dummy-slicer/` und `rig/plan-step/` — durch die `.gitignore`-Zeile bisher unsichtbar).

---

## 7. Folgen

`graphcode remove` bleibt bis CR-GC-331 unvollständig gegenüber Repos, die mit einer älteren
Version initialisiert wurden — die Neuinstallation legt den Fremd-Ordner ab hier nicht mehr an.

@author andreas@siglochconsulting
