# CR-GC-573: Die Steuerungskanaele sichtbar machen — fuenf Schreiber in einem Knoten

**Status:** ✅ Done (2026-09-21)
**Typ:** aus Item ITEM-2026-415 (finding)
**Erstellt:** 2026-09-21
**Item:** bok/items/ITEM-2026-415.json (Lane: graph)

---

## 1 Befund

`generate.ts` ist an **genau einen** FUNC gebunden: `FUNC-generation-step`. In dieser einen
Funktion sitzen fuenf unabhaengige Autoritaeten, die alle in denselben Rundenprompt schreiben:
`SEED_STAGES`, `DIMENSION_FOCUS_TYPES`, `GENERATION_TEMPLATE`, `RULE_CLAUSE`, `GATE_PROTOCOL`.
Dasselbe in `executor-prompt.ts`: ein FUNC (`buildRoundInjection`), daneben `SYSTEM`,
`IDLE_NUDGE`, `SKILL_FOR_DIMENSION`, `WITHHELD_TOOLS`.

**Der Graph sagt: ein Rundenprompt. Der Code hat fuenf Schreiber darin.**

Von 17 Ratgeber-Kanaelen sind 9 modelliert (Flow/Schema/Func-Tripel: Gate-Verdikt,
Regelbefunde, Fit-Advisory, Steering-Delta/-Snapshot, Preflight, Kandidaten-Ranking,
Runden-Injektion, Rundenprompt). Die 8 nicht modellierten sind genau die Inhaltstabellen, die
entscheiden, **was** gesagt wird.

Folge, vierfach belegt: das "ein Imperativ je Runde"-Prinzip musste per Messung
wiederentdeckt werden (CR-GC-560..562, 564, 565, 568), weil der Graph die Doppelung nicht
zeigen konnte — beide Schreiber verschwinden im selben Knoten.

Auch wo modelliert, ist es zusammengefaltet: `SCHEMA-round-injection` ist EIN Block, traegt
aber vier Inhalte (Guide-Ausschnitt, Element-Index, Suggest-Zeilen, Skill-Rumpf). Ihre Kosten
liessen sich nur messen, weil der Turn-Strom aufgeschnitten wurde.

## 2 Zielbild und die Gefahr dabei

Jeder Kanal, der dem Modell etwas SAGT, ist ein eigener Knoten mit eigenem Konsumenten — dann
ist ein zweiter Weg zur selben Sache im Graphen sichtbar, nicht erst in der Messung.

**Die Gefahr ist Bloat** (KEEPER-Regel): acht neue Knoten, die niemand liest, waeren
schlimmer als der heutige Zustand. Deshalb gilt die Reihenfolge aus CR-GC-575 zwingend:
**erst streichen, was gemessen nichts traegt, dann modellieren, was bleibt.** Dieser CR
laeuft NACH der Bereinigung, nicht davor.

## 3 Akzeptanzkriterien

1. Fuer jeden verbliebenen Kanal: ein Knoten, ein Konsument, eine Kante in den Rundenprompt.
2. Eine Regel oder ein Test kann beantworten: "sagen zwei Kanaele dieser Runde dasselbe?"
3. Kein Knoten ohne Konsumenten.

---

## 4 Umsetzung (2026-09-21)

### 4.1 Neun Kanaele, ein Vertrag

Jeder Kanal, der dem Modell etwas SAGT, ist jetzt ein FLOW mit genau einem Konsumenten:

| Kanal | Rang | Produzent | Konsument |
|---|---:|---|---|
| `FLOW-channel-rule-clause` | 2 | `ACTOR-owner` | `FUNC-generation-step` |
| `FLOW-channel-grammar` | 3 | `FUNC-authoring-guide` | `FUNC-build-round-injection` |
| `FLOW-channel-inventory` | 4 | `FUNC-read-tools` | `FUNC-build-round-injection` |
| `FLOW-channel-guidance` | 5 | `ACTOR-owner` | `FUNC-build-round-injection` |
| `FLOW-channel-dimension-template` | 6 | `ACTOR-owner` | `FUNC-generation-step` |
| `FLOW-channel-proposal-suggest` | 6 | `FUNC-graph-suggest` | `FUNC-build-round-injection` |
| `FLOW-channel-gate-protocol` | — | `ACTOR-owner` | `FUNC-generation-step` |
| `FLOW-channel-system-prompt` | — | `ACTOR-owner` | `FUNC-run-executor` |
| `FLOW-channel-idle-nudge` | — | `ACTOR-owner` | `FUNC-run-executor` |

**Ein** Vertrag fuer alle neun (`SCHEMA-steering-channel`), weil sie sich genau darin
gleichen und nur im Rang unterscheiden. Neun Vertraege waeren neun Knoten fuer eine
Unterscheidung, die kein Leser braucht — genau der Bloat aus §2.

`ACTOR-owner` als Produzent ist keine Verlegenheit: die sechs so gekennzeichneten Kanaele
sind vom Menschen gepflegte Konstanten im Quelltext. Dass sie **an der Systemgrenze**
einlaufen, ist die Aussage — es sind Ratschlaege, keine gerechneten Werte.

Nebenbefund, mitgeschlossen: `graph_authoring_guide` hatte **keinen FUNC-Knoten** — ein
ausgeliefertes MCP-Werkzeug ohne Bindung. `FUNC-authoring-guide` traegt ihn jetzt.

`SCHEMA-round-injection` sagt nicht mehr „Guide-Slice plus Element-Index", sondern was es
ist: die nach Rang verkettete Fassung der vier Injektions-Kanaele.

### 4.2 Kriterium 2 — die Frage ist beantwortbar, ohne einen Lauf zu fahren

`duplicateChannels()` in `src/loop/channel-rank.ts` haelt die Kanalbloecke einer Runde
gegeneinander. Bewusst **Ueberlappung statt Gleichheit**: der Fall, der die Serie ausgeloest
hat, war keine Dublette, sondern ein Widerspruch in Paraphrase (R-15s Klausel gegen das
uc-Template, CR-GC-358) — ein Exakt-Vergleich haette genau ihn durchgelassen.

Damit die Frage an einer ECHTEN Runde stellbar ist, liefert `buildRoundChannels()` die
Bloecke einzeln; `buildRoundInjection()` verkettet nur noch, was dort entsteht — ein
Erzeuger, zwei Sichten, kein zweiter Pfad. `tests/channel-rank.test.ts` prueft beides, samt
Positivkontrolle: wird die Doppelung kuenstlich eingebaut, faellt der Test.

### 4.3 Der Preis, gemessen

Der Steuerwert (`graph_readiness.steer.score`) geht von **3,50 auf 3,75** — eine einzige
Ursache: der neue Vertrag `SCHEMA-steering-channel` kreuzt die Grenze von `MOD-surface`
(13 → 14 Vertraege) und die des Wertbaum-Blocks „Grounding" (18 → 19).

Das ist **der Befund, nicht sein Preis**: dass der Rundenprompt viele Schreiber hat, war
vorher wahr und unsichtbar; jetzt ist es wahr und messbar. Ein Zug, der den Wert
verbessert haette, ohne einen Kanal zu streichen, haette nur wieder gebuendelt.

Zwei Zuege im selben Batch haben den Ausschlag halbiert und sind selbst richtig:
`FUNC-authoring-guide` gehoert in den Wertbaum-Block „Abfrage" wie seine Geschwister, und
`FUNC-graph-suggest` gehoert in `FCHAIN-steering-loop` — seit CR-GC-556 wird es je Runde
gerufen, nicht nur im Advisory-Roundtrip.

### 4.4 Was offen bleibt

Die Reihenfolge aus CR-GC-575 („erst streichen, dann modellieren") ist **nicht** eingehalten
worden, weil das Streichen dort auf die Ausbeute-Messung wartet (Entscheidung 2026-09-21).
Modelliert sind deshalb alle neun Kanaele, auch die, die nach der Messung fallen koennen.
Faellt einer, faellt sein Knoten mit — das ist eine `delete-node`-Zeile, kein Umbau.
