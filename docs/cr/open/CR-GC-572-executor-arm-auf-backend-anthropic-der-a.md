# CR-GC-572: Executor-Arm auf backend=anthropic — ein Vergleich mit genau einer Unterschieds-Achse

**Status:** ✅ Abgeschlossen 2026-09-21 — Lauf gefahren, zwei Leitungsfehler behoben
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
kostet kein Vielfaches. Der Key liegt in `graphcode/.env` (gitignored) oder der Umgebung,
nie in einer getrackten Datei; `claude -p` erbt ihn nie (`claudeEnv` in `run.mjs`).

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
# Key einmalig in graphcode/.env (Vorlage: .env.example)
ARMS=gcrun-frontier,opus5 RUNS=3 node rig/greenfield-systemtest/run.mjs
node rig/greenfield-systemtest/report.mjs
```

Mit demselben Lauf faellt auch das offene Kriterium 1 von CR-GC-570 (weniger
`cache_creation` bei gleicher Elementzahl).

---

## 7 Der Lauf (Runde 7, 2026-09-21, sigllm-Prosa-Korpus, je 3 Laeufe)

### 7.1 Zwei Fehler, die erst der Lauf zeigte

Der erste Lauf lieferte 9–29 Elemente und null Reparaturen. Kein Modellbefund, sondern die Leitung:

1. **Thinking-Bloecke beim Echo beschnitten.** `AnthropicWireAnswer` war ein `z.object`, Zod strich
   `thinking`/`signature`, die API lehnte jeden Turn .2 ab (`messages.1.content.0.thinking.thinking:
   Field required`, 11 von 12 Schritten). Fix `8576d56`: `z.looseObject`, Abnahme
   `tests/executor.anthropic-roundtrip.test.ts` (vorher rot). Sichtbar wurde es erst, nachdem der
   Trace die Meldung nicht mehr bei 80 Zeichen abschnitt (`2219a49`).
2. **4096 Ausgabe-Tokens fuer ein denkendes Modell.** Denken zaehlt gegen `max_tokens`: 38 von 45
   Mutate-Turns gekappt, alle 38 als `INPUT-SCHEMA` abgelehnt. Fix `ed0e078`: 32000, per Test gehalten.
   Dass die Schleife einen gekappten Aufruf als Schemafehler statt als Ueberlauf meldet, ist
   ITEM-2026-427.

Der Key liegt seit `b2de4aa` in `graphcode/.env` (gitignored); `claude -p` erbt ihn nie.

### 7.2 Ergebnis — eine Achse Unterschied

| Arm | treibt | Elemente | Dimensionen req/uc/arch/alloc/ver | Wall | Kosten |
|---|---|---|---|---|---|
| `opus5` | Agent (Claude Code) | 278 / 321 / 280 | 0,81–0,99 / 0,96–1 / ≥0,98 / 0,84–1 / 0,94–1 | 27–38 min | 12,54–19,35 $ |
| `gcrun-frontier` | Executor | 179 / 175 / 191 | 0,66–0,68 / 0,75–0,81 / 0,89–0,94 / 0,76–0,93 / 0,84–0,85 | 13–14 min | nicht erhoben |

Gleiches Modell, gleiche Werkzeuge: **der Agent baut gut 1,5-mal so viel (Median 280 gegen 179) bei hoeherer Form.**
Der Executor war nach 12 Runden nie fertig (`done=false` in allen drei) — er endet am Rundendeckel,
nicht an der Aufgabe. Das ist eine zweite, bewusst gesetzte Differenz (der Agent hat nur das
Zeitlimit), ebenso das Ausgabebudget, das Claude Code setzt (nicht geprueft).

### 7.3 Kriterien

| # | Kriterium | Ergebnis |
|---|---|---|
| 1 | Lauf `gcrun-frontier` neben `opus5`, gleiches Korpus | erfuellt — §7.2. Prompt je Treiber verschieden, wie in `run.mjs` begruendet |
| 2 | Bericht benennt die EINE Achse | erfuellt — §6.2 |
| 3 | Steuerungsaussage „produktweit" erst danach | erfuellt, und sie faellt anders aus als erwartet: am selben Modell ist die eigene Schleife **schwaecher** als der fremde Agent. Die Steuerungsmaschinerie hilft dem kleinen Modell (CR-GC-568), am grossen kostet sie Ausbeute |

**Kongruenz:** nicht geprueft aus dieser Session (Rig- und Executor-Code; der Graph-Zug liegt bei
der graphcode-Session) — benannte Ausnahme.
