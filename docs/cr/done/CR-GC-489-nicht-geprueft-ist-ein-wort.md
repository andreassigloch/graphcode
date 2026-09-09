# CR-GC-489 — „Nicht geprüft" ist ein einziges Wort

**Status:** erledigt 2026-09-09 · **Angelegt:** 2026-09-09 · **Ring:** 1 (Kongruenz-Gate)
**Item:** [ITEM-2026-010](../../../../bok/items/ITEM-2026-010.json)
**Grundlage:** Lesung `src/kernel/evaluation.ts`, `src/projections/report.ts`, 2026-09-09
**Baut auf:** `CR-SM-305` (RC im Katalog, geschlossen), `CR-GC-495` (Drift-Wächter prüft den Grund)

---

## 0. Zwei Korrekturen, beide gemessen

**Erste Fassung:** *„`scoreReadinessWithConformance` hat keinen Produktionsaufrufer — ein
Modell-Zug, der die Kongruenz bricht, passiert jedes Gate lautlos."* **Falsch.**
`graph_readiness` ruft in `report.ts:322` `evaluateAll(harness)` + `readinessOf(...)` — also
zeichengleich den Rumpf des Wrappers. RC-Befunde erreichen die Readiness über **fünf**
Aufrufstellen. Messfehler: nach dem *Funktionsnamen* gegrept und daraus auf die *Fähigkeit*
geschlossen.

**Zweite Fassung:** *„`skipped` meldet `'conformance'` als ein Token für sechs Regeln — die
Regelnamen fehlen."* **Auch falsch.** Sie stehen längst da: `unevaluatedRuleIds` ist
`ALL_RULE_DEFS` minus Gate-Katalog, und seit CR-SM-305 sind RC im Katalog — also erscheinen
`rule:RC-01` … `rule:RC-06` von selbst.

**Der wirkliche Befund ist die Umkehrung, und er ist schlimmer.** Sonde gegen das
graphcode-Selbstmodell mit echter Repo-Wurzel:

```
RC-Befunde erhoben  : 3   (RC-04)
skipped enthaelt    : rule:RC-01 … rule:RC-06     ← auch RC-04
importCoverage      : da
```

**Dieselbe Antwort sagt beides:** drei RC-04-Befunde in `findings`, und daneben die Behauptung,
RC-04 sei nicht ausgewertet worden. Damit sind die zwei Lagen, die auseinanderzuhalten der ganze
Zweck war — *„ausgewertet, 0 Verstöße"* gegen *„nie ausgeführt"* — an der Oberfläche **nicht
unterscheidbar**.

## 1. Root Cause

**(a) `unevaluatedRuleIds` weiß nichts von der Konformanz.** Sie rechnet `ALL_RULE_DEFS` minus
**Gate**-Katalog. Das Gate lädt RC nie (Profil `conformance`, so gewollt) — also stehen die
sechs *immer* in `skipped`, unabhängig davon, ob `conformanceEvaluation` sie gerade gefahren
hat. Für ND gibt es dafür seit CR-GC-442 `LOCALLY_EVALUATED_RULE_IDS`; RC braucht dasselbe, nur
**bedingt**: ausgewertet genau dann, wenn die Erhebung lief.

Das zusätzlich gesetzte Quellen-Token `'conformance'` sagt dieselbe Sache ein zweites Mal und
gröber — ohne RC-01/RC-02/RC-03 zu benennen, die `severity: error` sind.

**(b) Die Reichweite fehlt an der Fläche, die das Urteil trägt.** `rules_evaluate` gibt
`importCoverage` neben `skipped` aus, ausdrücklich als dessen Geschwister (`report.ts:181`).
`graph_readiness` führte nur `skipped`. Genau dort fehlte sie: **0 % Bindung sieht aus wie
0 Verstöße.** Gemessen: FUNC-`realRef` 100 % / 92 % / 81 % in drei Repos, **0 % in moneyflow**.

**(c) Ein toter Wrapper mit einer falschen Zusage.** `scoreReadinessWithConformance` hatte genau
einen Aufrufer (einen Test), während sein Docstring behauptete: *„Jeder Readiness-Konsument geht
hier durch."* Fünf Aufrufstellen schrieben seinen Rumpf inline. Ein zweiter Pfad plus eine
Zusage, die er nicht hielt — und diese Zusage ist der Grund, warum die erste Fassung dieses CRs
falsch war.

## 2. Impact

**Bricht:** die Aussagekraft von `graph_readiness` genau dort, wo Kongruenz gemeint ist. Der
Bericht kann heute nicht zwischen *„RC-01 ist erfüllt"* und *„RC-01 wurde nie ausgeführt"*
unterscheiden — die zweite Lage erscheint als ein Wort neben sechs unsichtbaren Regeln.

**Bricht nicht:** die Erhebung, die Verdrahtung, den Gate-Pfad. RC-Befunde erscheinen an allen
fünf Flächen. Dies ist eine **Verfeinerung des Ausfall-Signals**, kein Nachbau.

## 3. Fix

1. **Die Konformanz läuft VOR der Auslassungs-Rechnung**, weil ihr Gelingen mitentscheidet,
   welche Regeln als ausgelassen gelten. Lief sie, zählen die Regeln des `conformance`-Profils
   als ausgewertet und fallen aus `skipped` — **abgeleitet** über
   `getRuleDefsForProfile('conformance')`, nie notiert. Lief sie nicht, stehen sie beim Namen
   da. Das grobe Token `'conformance'` entfällt.

   **Beidseitig, nicht einseitig.** Der erste Entwurf leitete das Ausfall-Signal allein aus
   `unevaluatedRuleIds` ab — also aus „nicht im Gate-Katalog". Bei vollständig geladenem Katalog
   und fehlender Repo-Wurzel kam damit `skipped: []` heraus: **die gescheiterte Konformanz
   hinterließ gar kein Signal.** Dieselbe Fail-open-Klasse, gegen die dieser CR antritt, neu
   eingebaut — gefangen vom Regelkatalog-Test (CR-GC-428). Jetzt werden die RC-Regeln bei
   ausgefallener Erhebung **explizit** in die Lücke gelegt, unabhängig vom geladenen Katalog.
2. **`graph_readiness` führt `importCoverage`**, wie `rules_evaluate`. Ein Urteil ohne seine
   Reichweite ist kein Urteil.
3. **Den toten Wrapper löschen** und `tests/conformance.test.ts` auf den Ausdruck umstellen, den
   die Produktion benutzt — keine parallelen Pfade, und kein Docstring, der eine Verdrahtung
   behauptet, die es nicht gibt.

### Dateien (6)

| # | Datei | Was |
|---|---|---|
| 1 | `src/kernel/evaluation.ts` | `skipped` pro RC-Regel, Wrapper weg |
| 2 | `src/projections/report.ts` | `importCoverage` an `graph_readiness` |
| 3 | `src/kernel/conformance.ts` | Verweis auf den gelöschten Wrapper |
| 4 | `tests/conformance.test.ts` | Wrapper-Nutzung auflösen |
| 5 | `tests/readiness-conformance-skip.test.ts` (neu) | s. AC |
| 6 | `tests/evaluation.reconciliation.test.ts` | pinnte das alte Token |
| 7 | `tests/evaluation.rule-catalog.test.ts` | leitet `skipped` aus `NOT_IN_GATE` ab |
| 8 | `scripts/model-test-set.mjs` | Registrierung von (5), von CR-GC-399 erzwungen |

**Acht statt sechs, und warum die Analyse vorab danebenlag:** ich habe nach dem Literal
`'conformance'` gegrept und damit `evaluation.reconciliation` gefunden — aber nicht
`evaluation.rule-catalog`, das `skipped` über `NOT_IN_GATE` **ableitet** und das Token nie
schreibt. Die richtige Frage war nicht „wer benutzt diesen String?", sondern **„wer assertiert
auf `skipped`?"**. Datei (8) ist die von CR-GC-399 erzwungene Spur-Registrierung für (5) —
mechanische Folge, kein zweiter Vorgang.

## 4. Akzeptanzkriterien

- [ ] **Rot zuerst:** ein Test führt `evaluateAll` gegen die **echte** Repo-Wurzel und verlangt,
      dass keine RC-Regel in `skipped` steht, während RC-Befunde erhoben werden. Vor der
      Änderung rot — das ist der Widerspruch aus §0.
- [ ] „Eine RC-Regel ist entweder ausgewertet ODER ausgelassen, nie beides" — als eigener Test
      über beide Lagen.
- [ ] Ohne Repo-Wurzel stehen alle sechs beim Namen in `skipped`, `'conformance'` nirgends.
- [ ] Die Menge ist **abgeleitet**: sie deckt genau das `conformance`-Profil, keine gepinnte Liste.
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
