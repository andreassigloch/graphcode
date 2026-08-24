# CR-GC-406 — Die Spurwahl kommt an, wenn der Testlauf schon gelaufen ist

**Status:** draft — Befund belegt, Fix-Ort zu entscheiden (Hook vs. Skill/Instruktion vs. npm-Verb).
**Datum:** 2026-08-23
**Herkunft:** Umsetzung von CR-GC-405 (reine Modelländerung, keine Quelldatei angefasst).
**Vorgänger:** CR-GC-399 — dort wurde die Spurwahl gebaut und die Zeitersparnis gemessen.

## Problem — CR-GC-399 hat die Entscheidung getroffen, aber nicht plaziert

CR-GC-399 hat richtig entschieden: reine `docs/`-Änderung → `npm run verify:model` (31 Dateien,
~45 s) statt `npm test` (115 Dateien, ~4–6,5 min). Der Hook sagt die Spur auch korrekt an:

```
[pre-commit] Spur: MODELL — nur docs/ im Diff.
[pre-commit]   -> npm run verify:model   (31 Dateien, ~45 s)
```

Nur: **dieser Satz erscheint beim `git commit`** — also nachdem der Agent (oder der Mensch) längst
entschieden hat, was er fährt. Bei CR-GC-405 wurden erst `verify:model` (grün) *und* danach die
volle Suite gefahren, ~4,2 min umsonst; die Ansage kam anschliessend.

Der Hook kann das strukturell nicht lösen: er ist an `git commit` gebunden, die Entscheidung fällt
Minuten vorher. CR-GC-399 begründet ausdrücklich, warum der Hook *keine* Tests fährt — das bleibt
richtig. Er ist nur der falsche Ort für einen Hinweis, der vor dem Testen gebraucht wird.

Eine Notiz im Gedächtnis des Agenten löst es ebenfalls nicht verlässlich: sie konkurriert mit dem
Reflex „Änderung fertig → `npm test`", der in CLAUDE.md als Done-Definition steht.

## Kern

Die Spurwahl ist **Wissen ohne Abrufpunkt**. Sie steht in einem `done`-CR, im Hook-Kommentar und in
zwei Skripten — an keiner Stelle, die jemand *anschaut, bevor er testet*. Der zuverlässige Ort ist
der Testbefehl selbst.

## Optionen (zu entscheiden, nicht vorentschieden)

| | Ansatz | Wirkt bei | Kosten |
|---|---|---|---|
| **A** | `npm test` wählt die Spur selbst am `git status` und sagt an, was es überspringt | Agent + Mensch, ohne dass jemand die Regel kennen muss | `package.json` + ein Wrapper-Skript; „volle Suite" braucht dann ein explizites Verb (`test:all`), das CI fährt |
| **B** | CLAUDE.md-Done-Definition um die Spur ergänzen („bei reinem `docs/`-Diff gilt `verify:model`") | Agent, solange er die Datei liest | eine Zeile, keine Durchsetzung |
| **C** | Pre-**Tool**-Hook auf `npm test` bei reinem `docs/`-Diff | Agent, hart | ein weiterer Hook; Gefahr, einen bewusst vollen Lauf zu blockieren |

A ist der einzige Ansatz, der am Ort der Entscheidung greift. Gegenargument gegen A: er entscheidet
still — und genau das hat CR-GC-399 dem Hook vorgeworfen (dreimal einen beabsichtigten Schnitt
zunichtegemacht). Der Unterschied wäre, dass A die Wahl **ansagt und überschreibbar** lässt, statt
sie zu verstecken. Das ist der zu klärende Punkt.

## Nicht Teil dieses CRs

- Die Spur-Kriterien selbst (Dateilisten, `model-test-set.mjs`) — die stimmen, CR-GC-399.
- CI: fährt weiterhin immer alles. Die Ersparnis ist ausschliesslich lokal.

## Akzeptanzkriterien (Entwurf)

- [ ] Bei reinem `docs/`-Diff läuft ohne Zusatzwissen die Modell-Spur, und der Lauf sagt, was er
      überspringt und wie man die volle Suite erzwingt.
- [ ] Ein bewusst voller Lauf ist mit einem Verb erreichbar, das der Hook nicht kennt.
- [ ] Der Befund aus CR-GC-405 ist nachgestellt: `docs/`-only-Änderung → kein 4-Minuten-Lauf.
