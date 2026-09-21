# CR-GC-569: Die Betriebsmodi modellieren — wer treibt, und wer liefert die Antwort

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-414 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-414.json (Lane: graph)

---

## 1 Befund

Ein „Lauf" ist an keiner Stelle definiert — weder im Code noch im Modell. Die Konfiguration
liegt an zwei Orten (`ExecutorConfigSchema` als Zod-Schema, `arms: [...]` als JS-Literal in
`rig/greenfield-systemtest/run.mjs`), und **keiner der beiden nennt die Achse, an der sich alles
entscheidet: wer die Schleife treibt.**

Folge, gemessen an dieser Sitzung: jeder Vergleich `opus5` gegen `gcrun` variierte drei Achsen
gleichzeitig (Treiber, Agent, Modell). Zwoelf Laeufe lang wurde am Proxy optimiert, ohne dass
irgendwo stand, wovon er ein Proxy ist.

### 1.1 Drei Luecken, jede einzeln pruefbar

**(a) Ein ACTOR fuer zwei Treiber.** `ACTOR-agent` ("Gegateter Agent (MCP-stdio-Client)") deckt
sowohl den Fall ab, in dem ein externer Client die Reihenfolge bestimmt, als auch den, in dem
`MOD-loop` sie bestimmt. Das sind verschiedene Systemgrenzen, nicht verschiedene Produkte.

**(b) Der Modell-Endpunkt hat keinen Akteur — und das Modell behauptet etwas Falsches.**
Heute gilt:

```
FUNC-run-executor -io-> FLOW-model-request -io-> FUNC-call-model -io-> FLOW-model-answer
```

Damit sagt der Graph: **graphcode erzeugt die Modellantwort selbst.** Tut es nicht. Sie kommt
von einem LLM-Dienst ausserhalb der Systemgrenze — bei `claude -p` ueber OAuth, beim Executor
ueber `/v1/messages` oder einen lokalen Endpunkt. Die Kette endet innerhalb des Systems, obwohl
sie es verlaesst. Kein ACTOR-Knoten traegt den Dienst; die vier vorhandenen sind `agent`,
`dashboard`, `learning-engine`, `owner`.

**(c) Kein SCHEMA fuer die Lauf-Konfiguration.** `ExecutorConfigSchema` ist die faktische SSOT
fuer drei der vier Achsen und hat keinen Knoten. `SCHEMA-round-injection` ist das Naechstliegende
und meint etwas anderes.

## 2 Zielbild

Die vier Achsen, die einen Lauf bestimmen:

| Achse | Werte | wo sie hingehoert |
|---|---|---|
| **Treiber** | externer MCP-Client · `MOD-loop` | Systemgrenze — Akteur und Fluesse |
| **Modell-Endpunkt** | Frontier über API · lokal · `sigllm` | Systemgrenze — **ein** Akteur, Wert ist Konfiguration |
| **Agent (bei externem Treiber)** | *bewusst nicht modelliert* | s. 4 |
| **Stellschrauben** | toolset, candidates, judge, injection, selection | `SCHEMA-executor-config` |

Der Treiber ist **keine Konfiguration**, sondern eine Grenzfrage: im auto-Modus steht der externe
Agent nicht mehr an der Grenze — `MOD-loop` steht dort, und das Modell wird zum *gerufenen
Dienst*. Genau das kann der Graph heute nicht ausdruecken.

## 3 Konkreter Zug (Vorschlag — nichts mutiert, bis du zustimmst)

### 3.1 Neuer Akteur

| Knoten | Name | Beschreibung |
|---|---|---|
| `ACTOR-llm` | Modell-Endpunkt | Der LLM-Dienst ausserhalb der Systemgrenze, den graphcode ruft und dessen Antwort es nicht kontrolliert. Agnostisch wie `ACTOR-agent`: Anbieter, Modellname und Transport sind Konfiguration, kein Knoten. |

### 3.2 Kanten — und die eine, die wehtut

```
  neu:   FLOW-model-request -io-> ACTOR-llm        (die Anfrage verlaesst das System)
  neu:   ACTOR-llm          -io-> FLOW-model-answer
  weg:   FUNC-call-model    -io-> FLOW-model-answer
  bleibt: FLOW-model-answer -io-> FUNC-call-model  (der Adapter KONSUMIERT sie)
```

**IO-02 (FLOW single producer) erzwingt den Tausch:** solange `FUNC-call-model` als Produzent
der Modellantwort eingetragen ist, kann `ACTOR-llm` nicht danebenstehen. Genau dieser Eintrag
ist die Falschaussage — `callModel` ist der HTTP-Adapter, nicht die Quelle. Der Zug macht aus
einer stillen Unwahrheit eine sichtbare Grenze.

Erwartete Nebenwirkung: R-16 (ACTOR must have io) wird fuer `ACTOR-llm` sofort erfuellt; UC-02
(UC has actor) kann fuer die Executor-Kette erstmals ehrlich beantwortet werden.

### 3.3 Neues Schema

| Knoten | `realRef` | Inhalt |
|---|---|---|
| `SCHEMA-executor-config` | `src/loop/executor.ts` · `ExecutorConfigSchema` | backend, model, toolset, candidates, judge, injection, selection, maxRounds, maxStepTurns |

`relation` auf `FUNC-run-executor`. Damit hat die Lauf-Definition **einen** Ort.

### 3.4 `UC-reduced-llm` schaerfen, nicht teilen

Der UC vermischt heute Modellgroesse und Treiber ("Mit kleinem oder lokalem Modell arbeiten …
weil Gate und praezise Graph-Abfragen die Arbeit tragen"). Der zweite Halbsatz ist die
Treiber-Aussage. Vorschlag: der UC bleibt die **Modellgroessen**-Achse; die Treiber-Achse steht
ab jetzt an der Grenze (3.1/3.2) und nicht in einer UC-Beschreibung. Kein neuer UC — ein
zusaetzlicher waere ein Knoten ohne eigenen Konsumenten.

## 4 Was ausdruecklich NICHT modelliert wird

- **Kein benannter Agent.** `ACTOR-agent` traegt die Zusage „bewusst NICHT namentlich modelliert
  — agent-agnostisch ist eine verriegelte Zusage (CLAUDE.md)". Der Zug teilt nach *Rolle an der
  Grenze*, nie nach Produktnamen. `ACTOR-llm` erbt dieselbe Zusage.
- **Kein benannter Rig-LAUF.** Einzelne Arme, Modelle und Laufnummern sind Konfiguration.

**Korrektur (2026-09-21, nach Einwand):** das Rig gehoert SEHR WOHL in den Graphen. Es ist
kein Nebenwerkzeug, sondern der **Systemtest** — es fuettert den Audit-Log, und seine
verbose-Auswertung ist die Voraussetzung fuer Optimierungsschleifen wie diese. Ein Systemtest
ohne Knoten ist genau die Bindungsluecke, die RC-* aufdecken soll. Die urspruengliche Fassung
dieses Abschnitts ("das Rig misst, es ist kein Teil des Produkts") war falsch: gemessen wird
mit ihm ueber das Produkt, und was das Produkt ueber sich selbst lernt, ist Produkt.
Eigener Zug (ITEM-2026-416), weil er TEST-/FCHAIN-Knoten braucht und diesen CR sonst
unpruefbar macht.
- **Die Stellschrauben-WERTE.** `candidates=2` ist Konfiguration, kein Knoten.

## 5 Was dieser CR NICHT loest

Die **Steuerungskanaele** (ITEM-2026-415): `FUNC-generation-step` ist an eine Datei gebunden, in
der fuenf unabhaengige Prompt-Autoritaeten sitzen (`SEED_STAGES`, `DIMENSION_FOCUS_TYPES`,
`GENERATION_TEMPLATE`, `RULE_CLAUSE`, `GATE_PROTOCOL`). Der Graph zeigt **einen** Rundenprompt,
der Code hat fuenf Schreiber darin — deshalb musste das „ein Imperativ je Runde"-Prinzip viermal
per Messung wiederentdeckt werden. Eigener CR; ihn hier mitzunehmen macht den Graph-Zug
unpruefbar.

## 6 Akzeptanzkriterien

1. Aus dem Graphen allein beantwortbar: **wer erzeugt `FLOW-model-answer`** — und die Antwort
   ist ein Akteur ausserhalb der Systemgrenze.
2. `SCHEMA-executor-config` ist an `ExecutorConfigSchema` gebunden (`realRef` aufloesbar).
3. `graph_readiness`: keine neue RC-Verletzung; IO-02 und R-16 gruen fuer die geaenderte Kette.
4. Suite gruen; der Zug laeuft vollstaendig ueber das Gate (`graph_mutate`), nie per Hand am
   Snapshot.
