# CR-GC-580: Rig-Workspace ist kein eigenes Git-Repo: claude -p (skip-permissions) committet per git add -A ins graphcode-Repo (runde7 opus5-6, selbst zurueckgesetzt) — initWorkspace braucht git init

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-428 (bug)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-428.json (Lane: graph)

---

## 1 Befund (Runde 7, 2026-09-21)

Der Arbeitsbereich jedes Rig-Laufs liegt unter `graphcode/rig/greenfield-systemtest/runs/` und
hatte kein eigenes `.git`. `claude -p` laeuft dort mit uebersprungenen Berechtigungen. In
`opus5-6` rief es `git add -A && git commit` — der Commit landete **im graphcode-Repo**, mit der
Ergebnisdatei eines parallelen Arms und einem Bild einer anderen Session. Der Agent setzte selbst
zurueck (`git reset HEAD~1`), geblieben ist nichts. `opus5-8` versuchte dasselbe und scheiterte
nur an `.gitignore`.

## 2 Umsetzung

`isolateGit(dir)` in `run.mjs`: `git init` im Arbeitsbereich, **nach** `graphcode init` — so
installiert init keine Hooks, die Laufbedingungen bleiben mit Runde 1–7 vergleichbar. Beim Kunden
ist der Arbeitsbereich immer ein Repo; das Rig bildet das jetzt ab.

Abnahme `tests/systemtest-rig.test.ts`: ein umgebendes Repo, darin ein Arbeitsbereich, dort
`git add -A` + Commit → das umgebende Repo bekommt keinen Commit.

## 3 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Test stellt den Unfall nach und ist gruen | erfuellt |
| 2 | Bestaetigungslauf: kein Commit im graphcode-Repo waehrend des Laufs | erfuellt |

## 4 Bestaetigung

Bestaetigungslauf `opus5-9` (2026-09-21, sigllm-Prosa, Claude Code, 1 Lauf): 265 Elemente, Konformitaet 1,0, 10,85 $, 22 min.

Der Agent committete zweimal — beide Commits liegen im Arbeitsbereich (`2e11807`, `70567bc`),
der graphcode-HEAD blieb `17f2cf3` vor und nach dem Lauf.

**Kongruenz:** RC-* nicht aus dieser Session geprueft — benannte Ausnahme wie bei CR-GC-570.
