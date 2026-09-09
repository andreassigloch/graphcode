# CR-GC-489 — „Nicht geprüft" ist ein einziges Wort

**Status:** offen · **Angelegt:** 2026-09-09 · **Ring:** 1 (Kongruenz-Gate)
**Item:** [ITEM-2026-010](../../../../bok/items/ITEM-2026-010.json)
**Grundlage:** Lesung `src/kernel/evaluation.ts`, `src/projections/report.ts`, 2026-09-09
**Baut auf:** `CR-SM-305` (RC im Katalog, geschlossen), `CR-GC-495` (Drift-Wächter prüft den Grund)

---

## 0. Korrektur der ersten Fassung

Dieser CR behauptete am 2026-09-09: *„`scoreReadinessWithConformance` hat keinen
Produktionsaufrufer — ein Modell-Zug, der die Kongruenz bricht, passiert jedes Gate lautlos."*

**Das war falsch, und der Messfehler ist benennbar:** ich habe nach dem *Funktionsnamen* gegrept
und daraus auf die *Fähigkeit* geschlossen. `graph_readiness` ruft in
`report.ts:322` `evaluateAll(harness)` und `readinessOf(...)` — also **zeichengleich das, was
der Wrapper tut**. RC-Befunde erreichen die Readiness über **fünf** Aufrufstellen. Die Fähigkeit
ist verdrahtet; nur der benannte Trichter ist es nicht.

Was übrig bleibt, ist kleiner und anders gelagert — und steht unten.

## 1. Root Cause

**Drei Befunde, eine Ursache: die Konformanz wird als EINE Quelle behandelt, nicht als sechs Regeln.**

**(a) Das Nicht-Geprüft ist ein einziges Token.** `evaluateAll` meldet fehlende Repo-Wurzel oder
eine geworfene Extraktion mit `skipped.push('conformance')` — **ein** Wort für **sechs** Regeln.
Für Katalogregeln existiert längst die feinere Form: `SKIPPED_RULE_PREFIX = 'rule:'`, also
`rule:BQ-01`. Die Konformanz hat sie nicht.

**Das ist seit CR-SM-305 nicht mehr kosmetisch:** RC-01, RC-02 und RC-03 sind `severity: error`.
Wer `blocking.errors: 0` liest und daneben `skipped: ['conformance']`, erfährt nicht, dass darin
drei **error**-Regeln stecken. `CR-GC-495` hat genau diese Frage für den *Katalog* geklärt
(geprüft wird der Grund, nicht eine Namensliste) — an der *Readiness*-Fläche steht sie offen.

**(b) Die Reichweite fehlt an der Fläche, die das Urteil trägt.** `rules_evaluate` gibt
`importCoverage` neben `skipped` aus, ausdrücklich als dessen Geschwister
(`report.ts:181` — *„skipped means this source was not evaluated at all, importCoverage means
evaluated, but…"*). `graph_readiness` führt nur `skipped` mit. Genau dort fehlt sie: **0 %
Bindung sieht aus wie 0 Verstöße.** Gemessen (`optimierungsring.md` §6.2): FUNC-`realRef`
100 % / 92 % / 81 % in drei Repos, **0 % in moneyflow**.

**(c) Ein toter Wrapper mit einer falschen Zusage.** `scoreReadinessWithConformance` hat genau
einen Aufrufer, `tests/conformance.test.ts`. Sein Docstring behauptet: *„Jeder
Readiness-Konsument (graph_readiness, graph_help, Dashboard) geht hier durch."* Fünf
Aufrufstellen umgehen ihn, indem sie seinen Rumpf inline schreiben. Ein zweiter Pfad plus eine
Dokumentationslüge — und die Lüge ist der Grund, warum ich (a)–(b) beim ersten Lesen für etwas
Größeres gehalten habe.

## 2. Impact

**Bricht:** die Aussagekraft von `graph_readiness` genau dort, wo Kongruenz gemeint ist. Der
Bericht kann heute nicht zwischen *„RC-01 ist erfüllt"* und *„RC-01 wurde nie ausgeführt"*
unterscheiden — die zweite Lage erscheint als ein Wort neben sechs unsichtbaren Regeln.

**Bricht nicht:** die Erhebung, die Verdrahtung, den Gate-Pfad. RC-Befunde erscheinen an allen
fünf Flächen. Dies ist eine **Verfeinerung des Ausfall-Signals**, kein Nachbau.

## 3. Fix

1. **`skipped` wird pro Regel.** Statt `'conformance'` die sechs `rule:RC-0x` — **abgeleitet**
   aus dem `conformance`-Profil (`getRuleDefsForProfile('conformance')`), nie notiert. Kommt in
   contracts eine siebte RC-Regel dazu, erscheint sie von selbst. Dasselbe Muster wie
   `unevaluatedRuleIds` und wie `CR-GC-495`s Grund-Prüfung.
2. **`graph_readiness` führt `importCoverage`**, wie `rules_evaluate`. Ein Urteil ohne seine
   Reichweite ist kein Urteil.
3. **Den toten Wrapper löschen** und `tests/conformance.test.ts` auf den Ausdruck umstellen, den
   die Produktion benutzt — keine parallelen Pfade, und kein Docstring, der eine Verdrahtung
   behauptet, die es nicht gibt.

### Dateien (5)

| # | Datei | Was |
|---|---|---|
| 1 | `src/kernel/evaluation.ts` | `skipped` pro RC-Regel, Wrapper weg |
| 2 | `src/projections/report.ts` | `importCoverage` an `graph_readiness` |
| 3 | `src/index.ts` | Export-Sweep |
| 4 | `tests/conformance.test.ts` | Wrapper-Nutzung auflösen |
| 5 | `tests/readiness-conformance-skip.test.ts` (neu) | s. AC |

## 4. Akzeptanzkriterien

- [ ] **Rot zuerst:** ein Test führt `evaluateAll` gegen einen Harness **ohne** Repo-Wurzel und
      erwartet `rule:RC-01` … `rule:RC-06` in `skipped`. Heute steht dort `'conformance'` —
      der Test ist vor der Änderung rot und trifft nachweislich `evaluateAll`.
- [ ] Die Liste ist **abgeleitet**: ein Stub-Katalog mit einer siebten `conformance`-Regel lässt
      sie ohne Codeänderung in `skipped` erscheinen.
- [ ] `graph_readiness` gibt `importCoverage` aus; bei fehlender Wurzel `null`, nie `0` und nie
      weggelassen.
- [ ] `grep -rn "scoreReadinessWithConformance" src tests` findet **nichts**.
- [ ] `npm test` grün, insbesondere `evaluation.rule-catalog` und `conformance`.

## 5. Nicht im Scope

- **RC am Gate auslösen.** `mutate()` fährt weiter nur `evaluateRules()`; ob ein Modell-Zug an
  Code-Drift scheitern *soll*, ist eine Entscheidung, kein Nachzug — und braucht erst den
  Arbeitsauftrag aus **`CR-GC-490`**.
- Die Bindungsquote als eigene Kennzahl: **`CR-SM-306`**.
- Die Done-Definition: **`BOK-CR-033`**.
