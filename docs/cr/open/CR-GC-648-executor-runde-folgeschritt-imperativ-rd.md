# CR-GC-648: Executor-Runde: Folgeschritt-Imperativ, RD-01 ohne Klausel/Quelltypen, Null-Delta

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-543 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-543.json (Lane: code)

---

## Befund

Gemessen 2026-09-24 an einer Kopie des eigenen Modells (900 Knoten), eine Executor-Runde mit
Fokus `req:RD-01`. Drei Stellen, an denen der Rundenprompt dem Modell etwas sagt, das es nicht
tun kann oder nicht braucht:

1. **Folgeschritt-Imperativ.** Das Treiber-Protokoll von `graph_generate` endete mit „Danach
   graph_generate erneut aufrufen". Im Treiber-Modus ruft der Treiber `graph_generate`; dem
   Modell ist das Werkzeug vorenthalten (`WITHHELD_TOOLS`). Ein zweiter Imperativ zu einer
   Sache, die das Modell nicht tun kann (Grundsatz „ein Imperativ je Runde", CR-GC-564).
2. **RD-01 ohne Klausel.** RD-01 liegt in der req-Dimension. Deren Template verlangt „3–5
   REQ-Kandidaten je UC" — der Fund braucht das Gegenteil: die REQ gibt es, ihr fehlt der
   Erfueller (`satisfy` von FUNC/FCHAIN/MOD/SYS). Die Fokus-Typen der Dimension (UC/REQ/TEST)
   enthielten keinen Quelltyp: die Element-Liste trug 6.746 Zeichen REQ-Namen und keine FUNC-uid.
3. **Null-Delta.** Beide Vorschlaege der Runde zeigten `delta [0.000 ×6]` unter dem Satz
   „negativ heisst Verbesserung".

## Umsetzung

- `GATE_PROTOCOL.driver` ohne Folgeschritt; `PROTOCOL_NEXT` geloescht (einziger Nutzer).
- `RULE_CLAUSE['RD-01']`: Text „verbinde jede mit dem Element, das sie erfuellt … Lege KEINE
  neue REQ an", Typen `REQ, FUNC, FCHAIN, MOD, SYS`. Der bestehende Waechter „kein genannter
  Typ fehlt im Fokus" deckt die Klausel mit ab.
- Vorschlags-Kanal: `delta` nur, wenn ein Wert |x| ≥ 0,0005.

Nachgemessen, dieselbe Runde: Auftrag 1.416 → 1.331 Zeichen, Grammatik 540 → 905 (vier
Quelltypen dazu), Element-Liste 6.746 → 6.244 und traegt jetzt FCHAIN/FUNC/MOD/SYS.

## Umfang laut Graph

`CR-GC-648 -relation-> FUNC-generation-step, FUNC-build-round-injection`.

## Dateien (5)

`src/loop/generate.ts`, `src/loop/executor-prompt.ts` (nur der Vorschlags-Kanal),
`tests/generate.test.ts`, `tests/mcp.mutate-next-step.test.ts`,
`tests/executor.round-injection-suggest-skill.test.ts`.

## Akzeptanzkriterien

- [x] Treiber-Prompt nennt `graph_generate` nicht mehr; Host-Prompt unveraendert (`mcp.mutate-next-step`, `generate.test`).
- [x] RD-01-Fenster: Klausel statt req-Template, Quelltypen im Fokus (`generate.test`, neu).
- [x] Null-Delta faellt weg, die Kante bleibt (`executor.round-injection-suggest-skill`, neu).
- [x] Neue Tests rot auf dem alten Stand (req-Template im Prompt; `delta [` im Kanal).

## Bewusst offen

- Der Skill-Rumpf `se:author-req` (Kanal `guidance`) nennt `graph_generate {task:…}` — er ist
  auch die Anleitung fuer Claude-Code-Sitzungen, dort ist der Satz richtig. Ein Treiber-Ausschnitt
  waere ein zweiter Text; offen gelassen.
- Die Eintrittspunkt-Klausel der Tasks (`generate.ts`, CR-GC-601) nennt ebenfalls
  `graph_generate {task:…}` und kann im Kern-Modus in einer Executor-Runde stehen. Nicht gemessen.
