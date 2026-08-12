# CR-GC-331 — `graphcode remove` räumt auch den Vorgänger-Ordner weg

**Status:** done · **Datum:** 2026-08-12
**Ziel:** graphcode 0.12.x
**Ontologie:** v4.0.0 — **unverändert**
**Bezug:** [CR-GC-330](CR-GC-330-aimprove-verzeichnis-umziehen.md) (Feed zieht nach `.graphcode/`)

---

## 1. Problem

CR-GC-330 sorgt dafür, dass graphcode `.aimprove/` **nicht mehr anlegt**. In jedem Repo, das mit
einer älteren Version initialisiert wurde, liegt die Datei aber schon — und `graphcode remove`
findet sie nicht: der Befehl räumt `.graphcode/`, `.mcp.json`, `opencode.json`, Guardrails,
Steering, Skills und Hooks weg (`src/scaffold.ts:461-475`) und behauptet restlose Deinstallation.
Zurück bleibt ein Verzeichnis mit dem Namen eines fremden Produkts.

Der Fall ist im Repo bereits präzedenzlos gelöst: `removeLegacySkills()` (`src/scaffold.ts:229`)
entfernt genau so ein Alt-Layout — Kopien, die eine frühere Version nach `.claude/skills/` legte —
und läuft in `install`, `update` **und** `remove`.

---

## 2. Ziel

`graphcode remove` lässt nichts zurück, das graphcode je geschrieben hat — auch nicht unter dem
alten Namen.

---

## 3. Nicht-Ziele

- **Keine Migration.** Der Feed ist eine Projektion des Audit-Logs; die Altdatei wird gelöscht,
  nicht kopiert. Am neuen Ort entsteht sie bei der nächsten Mutation vollständig neu.
- **Nichts außer `trajectory.jsonl` anfassen.** `learning.db`, `state.json`, `graph.kuzu` in einem
  fremden `.aimprove/` gehören dem Vorgängerprodukt und können in einem Repo liegen, das aimprove
  aktiv nutzt. Ein Ordner mit Fremdinhalt bleibt stehen.
- **Kein Cleanup in `init`/`update`.** Anders als bei den Legacy-Skills ist der Alt-Feed kein
  konkurrierender Pfad — er wird nur nicht mehr beschrieben. Löschen ist eine
  Deinstallations-Handlung.

---

## 4. Anforderungen

1. `removeLegacyTrajectory(repoRoot, res)` analog `removeLegacySkills`: entfernt
   `.aimprove/trajectory.jsonl`, meldet den Pfad in `res.removed`, und entfernt `.aimprove/`
   **nur dann**, wenn der Ordner danach leer ist.
2. Aufruf ausschließlich im `remove`-Zweig.
3. Idempotent: kein Ordner, keine Datei, nicht-leerer Ordner → kein Fehler, kein `removed`-Eintrag.

---

## 5. Betroffene Dateien

| Datei | Änderung |
|---|---|
| `src/scaffold.ts` | `removeLegacyTrajectory()` + Aufruf im `remove`-Zweig |
| `src/scaffold-templates.ts` | `LEGACY_WORKSPACE_DIR` + `TRAJECTORY_FILE` |
| `src/emit.ts` | schreibt gegen `TRAJECTORY_FILE` statt gegen ein zweites Literal |
| `tests/cli.scaffold.test.ts` | 3 Fälle: entfernt Datei + leeren Ordner · lässt Fremdinhalt stehen · idempotent |

Der Dateiname stand sonst zweimal da — einmal beim Schreiben (`emit.ts`), einmal beim Aufräumen.
Zwei Literale für dieselbe Datei sind genau der parallele Pfad, den der CR beseitigen soll.

---

## 6. Akzeptanzkriterien

- [x] `remove` in einem Repo mit `.aimprove/trajectory.jsonl` → Datei und Ordner weg, Pfad steht
      in `result.removed`.
- [x] `.aimprove/` mit zusätzlicher `learning.db` → nur die `trajectory.jsonl` verschwindet, der
      Ordner bleibt.
- [x] `remove` ohne `.aimprove/` → unverändertes Ergebnis, kein Eintrag, kein Wurf.
- [x] `npm run build` + volle Suite grün — 667 Tests, 89 Dateien. Beide neuen Fälle vorher rot
      gesehen (ohne den Fix: `expected [...] to include '.aimprove/trajectory.jsonl'`).

@author andreas@siglochconsulting
