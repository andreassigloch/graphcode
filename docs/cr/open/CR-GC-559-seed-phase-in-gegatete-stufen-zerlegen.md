# CR-GC-559: Der Kaltstart in drei gegatete Stufen

**Status:** 🟠 Open
**Typ:** aus Item ITEM-2026-376 (idea)
**Erstellt:** 2026-09-20
**Item:** bok/items/ITEM-2026-376.json (Lane: graph)
**Schliesst mit:** ITEM-2026-375 (kein Skill fuer ACTOR) — die Stufe `seed:actor` ist der Ort, an dem er greift

---

## 1 Befund

Die Seed-Phase verlangte **einen** Batch: 1 SYS, 1–3 ACTORs, 3–7 UCs. Das war die
einzige Runde ohne Regelung — weil es auf einem leeren Graphen nichts zu messen gibt,
und der Regler ab Runde 2 uebernimmt.

Gemessen im letzten `graphcode run`: das Modell hat viermal versucht, `ACTOR` direkt an
`FCHAIN` zu haengen (`compose` und `io`), alle vier vom Gate wegen R-18 abgewiesen, zwei
Runden verbrannt. Die Systemgrenze ist damit genau die Stelle, an der der Kaltstart
scheitert — und die einzige Stelle, an der niemand dem Modell etwas sagt.

Der Ein-Batch-Seed hat drei Entscheidungen zusammengelegt, die verschiedene Kriterien
haben: *was ist das System*, *was soll es leisten*, *wer steht aussen*. Eine Anleitung
kann man nur der einzelnen Entscheidung mitgeben.

## 2 Zielbild

Drei Stufen, jede mit ihrem Gate-Durchlauf und ihrer Anleitung:

| Stufe | Batch | Anleitung |
|---|---|---|
| `seed:sys` | 1 SYS-Wurzel, `description` = die Intention woertlich | `se:top-level` (Phase 0: SYS als Blackbox) |
| `seed:uc` | 3–7 UCs, `SYS compose UC` | `se:author-uc` |
| `seed:actor` | das Minimum distinkter ACTORs | `se:author-actor` (neu) |

Die Stufe folgt aus dem Graphen, nicht aus einem Zaehler: kein SYS ⇒ `seed:sys`,
kein UC ⇒ `seed:uc`, kein ACTOR ⇒ `seed:actor`. `generationStep` bleibt rein.

**Greift nur vor dem ersten FUNC/MOD.** Ein importierter oder reifer Graph ohne ACTOR
darf nicht in eine Seed-Stufe zurueckfallen — dort urteilt weiter der Regler (UC-02,
R-16, FC-04 melden dasselbe auf dem expand-Pfad).

**Verdrahtet wird in der Stufe NICHT.** `ACTOR -io-> FLOW` braucht ein FLOW an einem
FUNC, und FUNCs gibt es beim Seed noch nicht. R-16 (Warnung) ist im Anschluss der
korrekte Zustand; der Skill sagt das ausdruecklich, damit das Modell die Warnung nicht
mit einer illegalen Kante "behebt" — genau der gemessene Fehler.

`se:author-actor` traegt die Grammatik (`ACTOR -io-> FLOW` und sonst nichts), das
Minimalitaetskriterium und Quelle/Senke je UC (UC-02 ist **error**, FC-04 warning).
Er nennt auch die zwei Regeltexte, die heute das Gegenteil behaupten
(ITEM-2026-378 R-16-fix_hint, ITEM-2026-379 CL-01) — Befunde aus diesem CR, nicht
sein Umfang.

## 3 Umfang

- `src/loop/generate.ts` — `SEED_STAGES`, Stufenwahl, `DIMENSION_FOCUS_TYPES.seed` entfaellt
- `src/loop/executor-prompt.ts` — `seed:*` in `SKILL_FOR_DIMENSION`, `seed` entfaellt
- `.claude/commands/se/author-actor.md` — neu
- `tests/generate.test.ts` — Abnahme der Stufen
- `tests/executor.round-injection-suggest-skill.test.ts` — Abnahme der Zuordnung
- `tests/executor.test.ts` — Stufe 1 traegt nur die SYS-Grammatik; die ACTOR-Grammatik
  wird dort geprueft, wo sie jetzt ankommt (`seed:actor`)

Sechs Dateien — am Limit, nicht darueber.

## 4 Abnahme

1. Leerer Graph mit Intention ⇒ `seed:sys`, Fokus nur `SYS`, Prompt fordert genau die Wurzel.
2. SYS allein ⇒ `seed:uc`. SYS+UC ⇒ `seed:actor`. SYS+UC+ACTOR ⇒ raus aus dem Seed.
3. Graph mit FUNC und ohne ACTOR ⇒ **keine** Seed-Stufe, der Regler uebernimmt.
4. `seed:actor` traegt den Rumpf von `se:author-actor`, und darin die Grammatik-Zeile.
5. Die Intentions-Rueckfrage (kein SYS, keine Intention) bleibt unveraendert vorgeschaltet.
6. `skills.mcp-conformance` gruen: der neue Skill nennt echte MCP-Werkzeuge
   (`graph_elements` zum Lesen der UCs, `graph_mutate` zum Emittieren). Das Gate hat den
   ersten Entwurf zu Recht abgewiesen — ein Skill ohne Werkzeugbezug ist ein Aufsatz.
7. Suite gruen.

## 5 Was bewusst offen bleibt

Drei Stufen kosten drei Modell-Turns statt einem. Der Gegenwert sind die zwei Runden,
die der gemessene Lauf an R-18-Ablehnungen verloren hat — belegt ist bisher nur der
Verlust, nicht der Gewinn. Der naechste Rig-Lauf ist die Abnahme dafuer und gehoert
nicht in dieses CR.
