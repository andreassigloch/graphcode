# CR-GC-572: Executor-Arm auf backend=anthropic — ein Vergleich mit genau einer Unterschieds-Achse

**Status:** 🟠 Arm steht, der Lauf fehlt
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

---

## 6 Umsetzung (2026-09-21)

### 6.1 Der Arm

`gcrun-frontier` in `rig/greenfield-systemtest/run.mjs`: `executor: 'gcrun'`,
`backend: 'anthropic'`, Modell `claude-opus-5`, Key **nur** aus `ANTHROPIC_API_KEY`.
Kein neues Feature — `executor-backend.ts` implementiert den anthropic-Zweig vollstaendig.

**Kosten-Riegel** (nicht in der CR gefordert, aber noetig): der Arm traegt `optIn: true`
und faehrt nur, wenn `ARMS` ihn namentlich nennt. Ein blosses `node run.mjs` darf keine
Rechnung erzeugen. Fehlt der Key, bricht der Lauf ab, **bevor** ein Workspace entsteht.

### 6.2 Kriterium 2 — der Bericht nennt die Achse

`ARM_ACHSEN` in `run.mjs` traegt je Arm Treiber, Modell und Agent-Harness; `report.mjs`
zeigt die Tabelle und rechnet paarweise aus, in wie vielen Achsen sich zwei Arme
unterscheiden. Damit `report.mjs` das importieren kann, laeuft `main()` in `run.mjs` jetzt
nur noch als Programm, nicht beim Import.

### 6.3 Korrektur an §1 dieser CR: es sind zwei Achsen, nicht drei

Die CR zaehlt fuer `opus5` gegen `gcrun` **drei** konfundierte Achsen: Treiber, Agent,
Modell. Beim Modellieren faellt auf: der **Agent ist keine unabhaengige Variable**.
Treibt der Executor, gibt es keinen fremden Agenten — seine Abwesenheit IST die
Treiber-Differenz. Wer sie als dritte Achse mitzaehlt, bekommt auch fuer `opus5` gegen
`gcrun-frontier` **zwei** Unterschiede statt einem und zerredet damit genau den Vergleich,
fuer den dieser Arm gebaut wurde.

Deshalb: `agent: null` heisst **entfaellt**, und der paarweise Vergleich ueberspringt eine
Achse, die auf einer Seite nicht existiert. Unter den agent-getriebenen Armen bleibt der
Agent sehr wohl eine Achse — `qwen-35b` (opencode) gegen `qwen38-claude` (claude-code)
unterscheidet sich in genau ihr. Beide Gegenkontrollen stehen als Assertion im Test.

Der gemessene Befund der CR aendert sich dadurch nicht, nur seine Zahl: die Paarung war
konfundiert, und `gcrun-frontier` loest es auf.

### 6.4 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Ein Lauf `gcrun-frontier` neben `opus5`, gleiches Korpus, gleicher Prompt | **offen** — braucht `ANTHROPIC_API_KEY` und ~9 $; faehrt der Auftraggeber |
| 2 | Der Bericht stellt beide nebeneinander und benennt die EINE Achse | erfuellt — §6.2, belegt durch `tests/systemtest-rig.test.ts` |
| 3 | Erst danach darf eine Steuerungsaussage "produktweit" heissen | haengt an 1 |

Der Befehl:

```bash
export ANTHROPIC_API_KEY=…
ARMS=gcrun-frontier,opus5 RUNS=3 node rig/greenfield-systemtest/run.mjs
node rig/greenfield-systemtest/report.mjs
```

Mit demselben Lauf faellt auch das offene Kriterium 1 von CR-GC-570 (weniger
`cache_creation` bei gleicher Elementzahl).
