# CR-GC-489 — Der tote Kongruenz-Pfad wird der einzige

**Status:** offen · **Angelegt:** 2026-09-09 · **Ring:** 1 (Kongruenz-Gate)
**Item:** [ITEM-2026-010](../../../../bok/items/ITEM-2026-010.json)
**Hängt an:** `CR-SM-305` (RC im Katalog — liefert die laute „nicht geprüft"-Ableitung)
**Grundlage:** Lesung `src/kernel/evaluation.ts`, `src/kernel/conformance.ts`,
`src/projections/report.ts`, `src/kernel/measure/readiness.ts`, 2026-09-09

---

## 1. Root Cause

`scoreReadinessWithConformance` (`evaluation.ts:254`) führt Katalog- und RC-Befunde zusammen —
laut Kommentar bewusst „EINE Fläche" seit CR-GC-398. **Sie hat keinen Produktionsaufrufer.**

```
grep -rn "scoreReadinessWithConformance" src tests
  src/kernel/evaluation.ts:254   (Definition)
  tests/conformance.test.ts:21   (Import)
  tests/conformance.test.ts:144  (einziger Aufruf)
```

`GET /api/graph/readiness` geht stattdessen über `scoreReadiness` (`measure/readiness.ts`), also
**ohne** Konformanz. Damit steht ein zweiter Pfad neben dem gewollten — genau die Lage, die
CR-GC-398 beseitigen wollte, nur in die andere Richtung: nicht zwei Rechnungen, sondern eine
richtige und eine benutzte.

## 2. Impact

**Bricht:** jede Aussage über Kongruenz an der Oberfläche. Die Readiness, die ein Mensch oder ein
Agent liest, ist über Katalogregeln vollständig und über Code-Bindung **stumm** — nicht
„0 Befunde", sondern gar keine Erhebung. Das ist die Fail-Open-Klasse aus CR-SM-286: eine
Zahl, die grün aussieht, weil niemand hingesehen hat.

**Bricht nicht:** die Erhebung. `conformanceEvaluation` läuft, `extractCodeFacts` und
`importCoverage` sind in `tests/conformance.test.ts` gedeckt. Es fehlt die Verdrahtung.

**Grenze der Aussage — gemessen, nicht behauptet:** Kongruenz ist nur dort aussagbar, wo die
Bindung trägt. FUNC-`realRef`-Quote: **100 % / 92 % / 81 %** in drei Repos, **0 % in moneyflow**
(`optimierungsring.md` §6.2). Bei 0 % darf der Bericht **nicht** „kongruent" sagen und auch nicht
„0 Verstöße" — nur **„nicht prüfbar"**, mit der Quote daneben.

## 3. Fix

1. `readinessReport` in `projections/report.ts` ruft **`scoreReadinessWithConformance`**.
2. **`scoreReadiness` ohne Konformanz aus dem Produktionspfad löschen** (keine parallelen Pfade).
   Bleibt sie als Re-Export in `index.ts` stehen, ist es ein „deprecated but still works"-Pfad —
   dann mit Aufrufer-Sweep entfernen, nicht nur umbenennen.
3. **Ausfallsemantik, dreiwertig statt zweiwertig.** Der Bericht führt je RC-Regel einen von drei
   Zuständen, nie „grün per Abwesenheit":

   | Zustand | Bedingung |
   |---|---|
   | `kongruent` | `CodeFacts` vorhanden **und** 0 Verstöße dieser Regel |
   | `gedriftet` | `CodeFacts` vorhanden **und** ≥ 1 Verstoß |
   | `nicht prüfbar` | keine Repo-Wurzel / keine Bindung — mit `importCoverage` und Bindungsquote als Beleg |

4. Die Liste der nicht geprüften RC-IDs kommt aus `unevaluatedRuleIds` — nach `CR-SM-305`
   entsteht sie **von selbst** aus `ALL_RULE_DEFS` minus ausgewertetem Katalog. Kein neuer Zweig.

### Dateien (max 6)

| # | Datei | Was |
|---|---|---|
| 1 | `src/projections/report.ts` | Readiness-Endpunkt auf `…WithConformance` |
| 2 | `src/kernel/evaluation.ts` | dreiwertiger Zustand je RC-Regel |
| 3 | `src/kernel/measure/readiness.ts` | konformanzlose Variante entfernen |
| 4 | `src/index.ts` | Export-Sweep |
| 5 | `tests/conformance.test.ts` | Erweiterung: Pfad + Dreiwertigkeit |
| 6 | `tests/readiness-conformance-pfad.test.ts` (neu) | der Endpunkt-Nachweis |

## 4. Akzeptanzkriterien

- [ ] **Rot zuerst:** ein Test ruft den Readiness-Endpunkt gegen einen Graphen mit **einer**
      gebrochenen `realRef` und erwartet den RC-01-Befund. Vor der Änderung grün-ohne-Befund
      (= der Beweis, dass er die geänderte Stelle erreicht), danach rot → gefixt.
- [ ] Ein Graph **ohne** Repo-Wurzel liefert `nicht prüfbar`, nicht `kongruent` und nicht 0.
      Explizit gegen einen moneyflow-artigen Fixture mit 0 % `realRef`.
- [ ] `grep -rn "scoreReadiness\b" src` findet nur noch den konformanzführenden Pfad.
- [ ] `aise doctor` bleibt ohne neue Befundklasse.

## 5. Nicht im Scope

Der Arbeitsauftrag („welche Datei muss mitwandern") — **`CR-GC-490`**. Dieser CR macht das
**Urteil** sichtbar, nicht die **Anweisung**.
