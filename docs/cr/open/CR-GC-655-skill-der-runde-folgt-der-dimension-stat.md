# CR-GC-655: Skill der Runde folgt der Dimension statt der Regel-Klausel (UC-01 bekommt author-uc statt author-req)

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-551 (bug)
**Erstellt:** 2026-09-24
**Item:** bok/items/ITEM-2026-551.json (Lane: code)

---

## Befund

Gemessen im Audit-Trail (gcrun-60/62, qwen3-coder-30b): in den Batches b11–b14 deklariert das
Modell dieselben drei UCs neu — teils mit neuer Beschreibung und neuem Namen — und loest keinen
Fund. Das Fenster war UC-02 (UC ohne ACTOR-Pfad). Die Klausel verlangt ACTOR io→FLOW io→FUNC; der
Anleitungs-Kanal lieferte `se:author-uc` (Dimension uc), dessen Beispiel `SYS -compose-> UC` /
`UC -compose-> FCHAIN` zeigt. Genau das schrieb das Modell ab, bis der Treiber das Fenster nach drei
Runden zurueckstellte. Kosten: 3–4 von 12 Runden, dazu ueberschriebene UC-Texte.

CR-GC-566/575 haben Text und Fokus-Typen an denselben Gewinner gebunden (Klausel vor Dimension);
der Skill folgte noch der Dimension, und der Executor leitete ihn ein zweites Mal selbst ab.

## Umsetzung

- `RULE_CLAUSE` nennt je Klausel ihren Skill ausdruecklich: UC-01 → `se:author-req`; UC-02, R-15,
  RD-01 → `null` (die Klausel beschreibt die Arbeit; jeder Dimensions-Skill zeigte eine andere).
- Derselbe `winner()`-Aufruf entscheidet Text, Fokus-Typen **und** Skill; `generationStep` nimmt
  im expand die Entscheidung des Gewinners, sonst (seed, handoff) die Dimension wie bisher.
- Der Executor liest `step.skill` (`skillDatei`), nicht mehr die Dimension — eine Entscheidung
  statt zwei. `focusDimension` faellt aus seiner Schnittstelle.
- Abweichung von contracts `RULE_HELP['UC-02'] = se:author-uc` bewusst und benannt; Frage an die
  Familie als ITEM-2026-557 (sigloch-modules).

## Dateien (6)

`src/loop/generate.ts`, `src/loop/executor-prompt.ts`, `tests/generate.test.ts`,
`tests/executor.test.ts`, `tests/executor.round-injection-suggest-skill.test.ts`, diese Datei.

## Akzeptanzkriterien

- [x] UC-01 → se:author-req, UC-02 → kein Skill, jede Klausel entscheidet ausdruecklich,
      Template-Fenster behalten den Dimensions-Skill — 4 der 5 Faelle rot auf dem alten Stand.
- [x] Der Executor liest den Skill des Schritts (Quelltext-Waechter).
- [ ] Rig (gcrun, N=3) gegen gcrun-60..62 (CR-GC-654): Batches ohne aufgeloesten Fund und
      Neu-Deklarationen deutlich weniger, Elemente/Kanten/Readiness nicht schlechter.
