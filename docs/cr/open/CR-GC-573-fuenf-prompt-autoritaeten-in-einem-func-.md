# CR-GC-573: Die Steuerungskanaele sichtbar machen — fuenf Schreiber in einem Knoten

**Status:** 🟠 Open
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
