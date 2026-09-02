# CR-GC-455 — Actors: 9 → 4

**Status:** done
**Abgeschlossen:** 2026-09-02
**Angelegt:** 2026-09-02

## Root Cause

Neun ACTOR-Knoten, die **dieselbe Schnittstelle** benutzen. Die Aufteilung trägt keine Information:

- `ACTOR-vibe-coder` hat **eine** io-Kante (`CLI-Command`) — eine Teilmenge von `ACTOR-developer`.
- `ACTOR-facilitating-agent` hat **eine** io-Kante (`Skill-Aufruf`) — identisch mit `ACTOR-systems-engineer`.
- `ACTOR-systems-engineer` (4 Kanten) ist vollständig in `ACTOR-developer` (13 Kanten) enthalten.
- `ACTOR-claude-code`, `ACTOR-opencode`, `ACTOR-facilitating-agent` reden alle über **eine** Fläche:
  MCP-stdio durch dasselbe Gate. `CLAUDE.md` sagt selbst *„agent-agnostisch […] ein Coding-Agent ist
  ein Client"* — drei namentlich modellierte Clients widersprechen der eigenen Verriegelung.
- `ACTOR-graphify` ist **veraltet**: graphify ist seit `@sigloch/graphify ^0.2.0` eine Dependency,
  importiert in [import-code-verb.ts:27](src/surface/import-code-verb.ts#L27). Kein externes System.

## Der Beleg, dass die Unterscheidung nichts trägt

`docs/views/conops.md` §3–4: **8 von 9 Actors lösen fast jeden UC aus** — inklusive
`ACTOR-dashboard` und `ACTOR-learning-engine` bei `UC-code-quality`. Die Ableitung läuft
ACTOR →io→ FLOW →io→ FUNC ←compose← FCHAIN ←compose← UC und trifft dabei auf die Hub-Flows
(`FLOW-graph-state` 17 ein / 24 aus, `FLOW-mutate-cmd` 20 ein / 3 aus). Über einen Hub ist jeder
mit jedem verbunden. **Neun Actors, die alle alles auslösen, tragen null Bit.**

Das koppelt diesen CR an CR-GC-456: erst wenn die Hub-Flows aufgelöst sind, wird „Ausgelöst von"
wieder eine Aussage. Die Actor-Reduktion allein repariert das nicht — sie macht die Liste nur kurz
genug, dass die Nutzlosigkeit auffällt.

## Entscheidung: 4 Actors

| neu | absorbiert | Grund |
|---|---|---|
| `ACTOR-owner` — Repo-Owner (Mensch am Repo) | `developer`, `systems-engineer`, `vibe-coder` | identische Schnittstellenmenge. Der Unterschied ist eine **Nutzerklasse**, kein Interface — er gehört in die Beschreibung (ConOps §3), nicht in die Topologie |
| `ACTOR-agent` — Gegateter Agent (MCP-stdio-Client) | `claude-code`, `opencode`, `facilitating-agent` | eine Fläche, ein Gate. Agent-agnostisch ist eine verriegelte Zusage, kein Ziel |
| `ACTOR-dashboard` — Viewer | — | bleibt: reiner Lesekanal (SSE) |
| `ACTOR-learning-engine` | — | bleibt: **bidirektional** — liest den Trajectory-Log und schreibt eine Empfehlung (`Urteils-Policy`) zurück. Kein read-only Consumer, deshalb nicht mit dem Viewer zusammenzulegen |

`ACTOR-graphify` entfällt ersatzlos (Bibliothek, kein Actor). Seine einzige Kante
(`→ Format-E-Artefakt`) ist durch die Import-FUNC bereits abgedeckt.

Nutzerklassen gehen nicht verloren: sie wandern in die Beschreibung von `ACTOR-owner` und bleiben
in ConOps §3 lesbar — dort, wo ISO 29148 §5.2.4 sie hinstellt.

## Acceptance

- [x] 4 ACTOR im SSOT, keine verwaisten io-Kanten
- [x] `conops.md` §3 nennt die drei Nutzerklassen weiterhin namentlich
- [x] keine neue Regelverletzung (`rules_evaluate` blockingErrors unverändert)
- [x] Suite ohne neue Rote gegenüber der HEAD-Baseline (4c91b69: 10 Dateien / 16 Tests rot,
      darunter die bekannten Link-Modus-Roten `lockfile-sync` und `distribution`)
