# CR-GC-263: OpenCode als First-Class-Client — `opencode.json` scaffolden

**Status:** Done (2026-07-26) · **Max Files:** 6
**Herkunft:** Publish-Audit 2026-07-26. Die letzte Halb-Implementierung aus ADR-001 §3
(„OpenCode-Sidecar") und `MS-4-mvp2` (draft) vor dem Public-Release.

## Problem (Why)

`init`/`update` scaffolden ausschließlich `.mcp.json` — das **Claude-Host**-Format. OpenCode liest
`opencode.json` mit `mcp`-Block (`{"type":"local","command":[...]}`); das eigene Benchmark-Rig
(`rig/dummy-slicer/opencode.json`) beweist es, weil es dort **von Hand** verdrahtet wurde.
`README.md` behauptet trotzdem, OpenCode nehme `.mcp.json` auf.

Damit ist die agent-agnostische Claim nur zur Hälfte ausgeliefert: der **MCP-Kern** ist bewiesen
agent-agnostisch (CR-GC-124, `tests/mcp.agent-agnostic.test.ts` — zwei Clients, ein Store), das
**Onboarding** ist es nicht. Ein OpenCode-Nutzer bleibt nach `npx @sigloch/graphcode init` ohne
laufenden Server stehen. Im Graph ist genau das sichtbar: `ACTOR-opencode` ist der einzige
`draft`-Actor.

Zweiter Befund aus demselben Pfad: `mcpConfigContent()` **überschreibt** `.mcp.json` komplett
(es rettet nur den `GRAPHCODE_HOST_PORT`) und `remove` löscht die Datei ganz. Ein Repo, das schon
einen MCP-Server konfiguriert hat — der Normalfall — verliert ihn bei `graphcode init`. Dieselbe
Mechanik ist für `opencode.json` zu bauen; sie einmal richtig zu bauen und einmal falsch zu lassen
wäre ein Parallelpfad.

## Design

1. **`opencode.json` wird mitgescaffoldet** (`src/scaffold-templates.ts` + `src/scaffold.ts`):
   gleicher Server, gleicher Befehl wie `.mcp.json` — `npx @sigloch/graphcode mcp` — nur im
   OpenCode-Schema (`$schema: https://opencode.ai/config.json`, `mcp.graphcode.type = "local"`).
2. **Merge statt Überschreiben — für beide Dateien.** Geschrieben wird nur der eigene Schlüssel
   (`mcpServers.graphcode` bzw. `mcp.graphcode`); fremde Server und alle übrigen Top-Level-Keys
   (`provider`, `model`, `permission`) bleiben unangetastet (`REQ-install-idempotent`).
3. **`remove` entfernt genau das Eigene, restlos** (`REQ-repo-uninstall`): löscht den
   graphcode-Schlüssel; die Datei selbst nur dann, wenn danach kein anderer Schlüssel übrig ist —
   dieselbe Regel, die `.claude/settings.json` schon befolgt.
4. **Kein Host-Flag.** Beide Dateien immer schreiben. Ein `--host claude|opencode` wäre ein zweiter
   Konfigurationspfad ohne Nutzen: beide Dateien sind ~10 Zeilen, für den jeweils anderen Host
   unsichtbar, und die Erkennung des Hosts ist zum `init`-Zeitpunkt nicht verlässlich.
5. **README korrigiert**: Artefakt-Tabelle bekommt `opencode.json`; Schritt 2 nennt beide Hosts mit
   ihrer jeweiligen Datei statt beide auf `.mcp.json` zu schicken.
6. **Skills bleiben Claude-only** und werden ausdrücklich so benannt: `.claude/skills/se-*` sind
   Claude-Code-Oberfläche, die MCP-Tools sind der agent-agnostische Vertrag. Kein OpenCode-Port der
   21 Skills in diesem CR (eigener CR, wenn ein echter OpenCode-Nutzer danach fragt) — aber auch
   keine stille Falschbehauptung im README.

## Akzeptanzkriterien

- [ ] `init` in einem leeren Repo erzeugt `.mcp.json` **und** `opencode.json`, beide auf
      `npx @sigloch/graphcode mcp` zeigend.
- [ ] `init` über einer bestehenden `opencode.json` mit `provider`/`model` erhält diese Schlüssel
      und ergänzt nur `mcp.graphcode` (Test mit Vorher-/Nachher-Vergleich).
- [ ] `init` über einer bestehenden `.mcp.json` mit einem FREMDEN Server erhält diesen Server
      (heute wird er gelöscht — Regressionstest).
- [ ] `remove` löscht `mcp.graphcode`/`mcpServers.graphcode`; eine Datei mit weiteren
      Nutzer-Schlüsseln überlebt, eine rein von graphcode erzeugte wird gelöscht.
- [ ] `update` ist idempotent (zweimal laufen lassen ⇒ byte-identische Datei).
- [ ] README nennt für OpenCode `opencode.json`, nicht `.mcp.json`.
- [ ] `npm run build` + `npm test` grün.

## Nicht in diesem CR

OpenCode-Port der Skills · Provider-/Modell-Konfiguration (BYOK bleibt Nutzer-Sache) ·
`ACTOR-opencode` auf `done` — das folgt erst, wenn ein OpenCode-Lauf gegen ein frisch
gescaffoldetes Repo grün ist (Validierung, nicht Implementierung).
