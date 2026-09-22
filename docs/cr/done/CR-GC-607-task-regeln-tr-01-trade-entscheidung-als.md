# CR-GC-607: se-trade und se-irr setzen den Frischestempel mit `crRefs`; Task-Fokus zeigt TR-01 / IR-01

**Status:** ✅ Done (2026-09-22)
**Typ:** aus Item ITEM-2026-468 (idea)
**Erstellt:** 2026-09-22
**Item:** bok/items/ITEM-2026-468.json (Lane: graph)
**Partner-CR:** sigloch-modules CR-SM-355 (Regeln, Stempel-Feld). Diese CR importiert die neuen contracts
und hebt den Peer-Floor im selben Commit.
**Voraussetzung:** CR-GC-605 (Fokus ohne `gating`, Smeagol Stufe (e)) — die neuen Regeln muessen durch
Stufe (d)/(e) laufen: RULE_HELP.prompt nennt einen ausgelieferten Skill, `TASK_SKILL` bleibt.

---

## Befund

Beide Skills sagen, dass ein CR entstehen soll, keiner setzt den Frischestempel: `analysisFreshness`
kommt in `se-trade.md` und `se-irr.md` nicht vor. Der Rundenprompt (generate.ts, CR-GC-603) verlangt ihn
am Task-Ende — der Agent hat also zwei Texte, die sich ergaenzen muessen, und der Stempel traegt
heute nur `graphVersion`. TR-01/IR-01 pruefen `crRefs` im Stempel; ohne den Skill-Schritt feuern sie in
jedem Lauf.

## Aenderung

| Datei | Aenderung |
|---|---|
| `.claude/commands/se-trade.md` | Schritt 4 „Stempeln": am Ende `graph_mutate` auf SYS `attributes.analysisFreshness.trade = { graphVersion, crRefs: [<Entscheidungs-CRs>] }` — ein Batch mit den `decides`-Kanten. Nennt TR-01 als die Regel, die sonst feuert |
| `.claude/commands/se-irr.md` | Schritt 4 „Stempeln": `analysisFreshness['assumption-review'] = { graphVersion, crRefs: [<promovierte CRs>] }`, leer erlaubt. Nennt IR-01 |
| `src/loop/generate.ts` | Prompt-Satz am Task-Ende (Zeile ~675) nennt `crRefs` fuer trade/irr — ein Satz, keine neue Klausel; RULE_CLAUSE bleibt Kern-only (Stufe d) |
| `tests/focus-set.test.ts` | Task trade sieht TR-01 als Warnung, Kern sieht nur AF-02; dito irr/IR-01/AF-03 |
| `tests/generate.task.test.ts` | Golden: Task trade nach Stempel ohne `crRefs` → Fokus TR-01, nicht fertig; mit `crRefs` auf einen CR mit `decides` → fertig |
| `docs/research/regel-matrix.{md,csv}` | generiert: trade 1 Regel, irr 1 Regel, Skills-Spalte se-trade / se-irr |

6 Dateien. Smeagol Stufe (a) prueft automatisch, dass TR-01/IR-01 im Katalog stehen, sobald die Skills
sie nennen; Stufe (e) prueft `RULE_HELP.prompt` gegen die ausgelieferten Skills.

## Akzeptanzkriterien

- [ ] `graph_generate {task:'trade'}` am Golden: ohne Stempel → AF-02; mit Stempel ohne `crRefs` → TR-01; mit `crRefs` auf Entscheidungs-CR → `done`.
- [ ] `graph_generate {task:'irr'}`: mit Stempel und leeren `crRefs` → `done` (keine tragende Annahme ist ein legitimer Ausgang).
- [ ] `verify:code` fuer den Changeset, `npm test` vor Abschluss; Peer-Floor contracts im selben Commit.
- [ ] Kongruenz: CR-Knoten CR-GC-607 mit `relation`-Kanten auf die Skill-FUNCs und focus-set; RC-07 gruen.

---

## Umsetzung (2026-09-22)

`se-trade.md` / `se-irr.md`: Schritt 4 „Stamp the task" — ein `graph_mutate`-Batch am SYS mit
`graphVersion` und `crRefs`; TR-01 / IR-01 beim Namen genannt (Smeagol (a) prueft die Existenz).
`generate.ts`: der Satz am Task-Ende nennt `crRefs` fuer trade / irr. `generate.task.test.ts`: trade mit
Stempel ohne `crRefs` → Fokus TR-01, nicht fertig; mit `crRefs: ['CR-SL-001']` (die eine decides-Kante
des Golden) → `done`; irr mit leeren `crRefs` → `done`, mit fehlendem CR → IR-01. Nebenbefund: der
Golden-Lader des Tests warf das Kanten-`label` weg — kein Leser haette je eine decides- oder
depends-on-Kante gesehen; jetzt traegt er es. Matrix: trade 1 Regel, irr 1 Regel, Skill-Spalte se-trade /
se-irr. `generate.test.ts` (Phasen-Fixture): traegt jetzt implplan-Stempel, eine Entscheidungs-CR mit
decides-Kante und einen Meilenstein — sonst haengt PDR an TR-01 und SRR an MS-03.
