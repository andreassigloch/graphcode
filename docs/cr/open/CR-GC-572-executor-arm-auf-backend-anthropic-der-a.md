# CR-GC-572: Executor-Arm auf backend=anthropic — ein Vergleich mit genau einer Unterschieds-Achse

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-412 (idea)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-412.json (Lane: graph)

---

## 1 Befund

Die Belegung der Betriebsmodi:

| | Frontier | lokal |
|---|---|---|
| **Mensch treibt** | `opus5` (Referenz) | `qwen38-claude`, `qwen-35b` |
| **Executor treibt** | **leer** | `gcrun` |

`opus5` gegen `gcrun` variiert **drei** Achsen zugleich: Treiber, Agent, Modell. Jede Aussage
dieser Messreihe ueber "die Steuerung" ist damit dreifach konfundiert — und genau das war der
Grund fuer zwoelf Laeufe im Kreis.

## 2 Zielbild

Ein Arm `gcrun-frontier`: `backend: 'anthropic'`, Modell `claude-opus-5`. Dann unterscheidet er
sich vom `opus5`-Arm in **genau einer** Achse — wer die Schleife treibt.

Kein neues Feature: `executor-backend.ts:232` implementiert den anthropic-Zweig vollstaendig.
Es fehlt nur ein `ANTHROPIC_API_KEY`.

## 3 Was der Key NICHT aendert

`claude -p` ist ein **Agent** (eigener System-Prompt, Kontext-Management, Kompaktierung,
Skills); der Executor ist **unsere Schleife** (Rundenprompt aus `graph_generate`, kuratiertes
Toolset, vorenthaltene Werkzeuge, Preflight, Gate-Reparatur). Gleiches Modell, gleiche
MCP-Werkzeuge — andere Schleife. Der Key ist die Leitung, nicht der Unterschied.

## 4 Kosten und Riegel

~9 $/Lauf (Erfahrungswert `opus5`). `maxRounds` und `maxStepTurns` begrenzen; ein Ausreisser
kostet kein Vielfaches. Der Key gehoert in die Umgebung, nie in eine Repo-Datei.

## 5 Akzeptanzkriterien

1. Ein Lauf `gcrun-frontier` neben `opus5`, gleiches Korpus, gleicher Prompt.
2. Der Bericht stellt beide nebeneinander und benennt die EINE Achse, die sich unterscheidet.
3. Erst danach darf eine Steuerungsaussage "produktweit" heissen.
